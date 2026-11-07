import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ImagePlus, Trash2 } from "lucide-react";
import Button from "./Button.jsx";
import Card from "./Card.jsx";
import FormField from "./FormField.jsx";
import PageHeader from "./PageHeader.jsx";
import {
  getCumulativeStageOutput,
  getOrderWorkflow,
  getStageTarget,
} from "../data/productionOrders.js";
import { useOrders } from "../state/OrdersContext.js";
import { useProductionUpdates } from "../state/ProductionUpdatesContext.js";
import { useAuth } from "../features/auth/AuthContext.js";

const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const allowedImageTypes = new Map([
  ["image/jpeg", [".jpg", ".jpeg"]],
  ["image/png", [".png"]],
  ["image/webp", [".webp"]],
]);
const issueCategories = [
  "Machine breakdown",
  "Fabric shortage",
  "Labour shortage",
  "Printing quality issue",
  "Washing delay",
  "Material not received",
  "Other production issue",
];

function localDate(date = new Date()) {
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function createUpdateId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `update-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function validateImage(file) {
  const extension = `.${file.name.split(".").pop().toLocaleLowerCase()}`;
  const expectedType = [...allowedImageTypes].find(([, extensions]) =>
    extensions.includes(extension),
  )?.[0];
  const validType =
    Boolean(expectedType) &&
    (!file.type || file.type === expectedType);

  if (!validType) {
    return "Choose a JPG, JPEG, PNG or WEBP image.";
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return "Image must be 5 MB or smaller.";
  }
  return "";
}

export default function ProductionUpdateForm() {
  const { updateId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { orders, loading: ordersLoading } = useOrders();
  const {
    updates,
    saveProductionUpdate,
    updateProductionUpdate,
    error: updateError,
    loading: updatesLoading,
  } = useProductionUpdates();
  const existingUpdate = updateId
    ? updates.find((item) => item.id === updateId)
    : null;
  const [orderId, setOrderId] = useState(searchParams.get("order") || "");
  const [stage, setStage] = useState(() => {
    const selectedOrder = orders.find(
      (item) => item.id === searchParams.get("order"),
    );
    return selectedOrder?.stage || "";
  });
  const [productionDate, setProductionDate] = useState(localDate());
  const [completedQuantity, setCompletedQuantity] = useState("");
  const [issueNote, setIssueNote] = useState("");
  const [issueCategory, setIssueCategory] = useState("");
  const [photo, setPhoto] = useState(null);
  const [existingAttachment, setExistingAttachment] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const order = orders.find((item) => item.id === orderId);
  const workflow = order ? getOrderWorkflow(order) : [];
  const selectedStage = workflow.find((item) => item.name === stage);
  const target = order ? getStageTarget(order, stage) : null;
  const completedOutput =
    order && stage
      ? getCumulativeStageOutput(order, stage, updates) -
        (existingUpdate?.orderId === order.id && existingUpdate.stage === stage
          ? existingUpdate.completedQuantity
          : 0)
      : null;
  const remaining = target
    ? Math.max(target - completedOutput, 0)
    : null;
  const recentOrders = useMemo(
    () =>
      orders.slice().sort((a, b) => a.poNumber.localeCompare(b.poNumber)),
    [orders],
  );

  useEffect(() => {
    if (!existingUpdate) return;
    setOrderId(existingUpdate.orderId);
    setStage(existingUpdate.stage);
    setProductionDate(existingUpdate.productionDate);
    setCompletedQuantity(String(existingUpdate.completedQuantity));
    setIssueNote(existingUpdate.issueNote || "");
    setIssueCategory(existingUpdate.issueCategory || "");
    setExistingAttachment(existingUpdate.attachment || null);
  }, [existingUpdate]);

  useEffect(
    () => () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    },
    [photoPreview],
  );

  function chooseOrder(value) {
    const nextOrder = orders.find((item) => item.id === value);
    setOrderId(value);
    setStage(nextOrder?.stage || "");
    setErrors((current) => ({ ...current, orderId: "", stage: "" }));
  }

  function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    setPhotoError("");
    if (!file) {
      return;
    }

    const validationError = validateImage(file);
    if (validationError) {
      setPhotoError(validationError);
      event.target.value = "";
      return;
    }

    setPhoto(file);
    setExistingAttachment(null);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function removePhoto() {
    setPhoto(null);
    setExistingAttachment(null);
    setPhotoPreview("");
    setPhotoError("");
    const input = document.getElementById("production-photo");
    if (input) {
      input.value = "";
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submittingRef.current) {
      return;
    }

    setSubmitError("");
    const nextErrors = {};
    if (!order) {
      nextErrors.orderId = "Select a production order.";
    }
    if (!stage || !selectedStage) {
      nextErrors.stage = "Select a valid stage for this order.";
    }
    if (!productionDate) {
      nextErrors.productionDate = "Select the production date.";
    } else if (productionDate > localDate()) {
      nextErrors.productionDate = "Production date cannot be in the future.";
    }
    const quantity = Number(completedQuantity);
    if (order && selectedStage) {
      if (target === null || remaining === null) {
        nextErrors.completedQuantity =
          "A valid target is unavailable for this stage; quantity cannot be checked.";
      } else if (remaining === 0) {
        nextErrors.completedQuantity =
          "This stage has already reached its target quantity.";
      } else if (
        completedQuantity === "" ||
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        nextErrors.completedQuantity =
          "Enter a positive whole-number quantity.";
      } else if (quantity > remaining) {
        nextErrors.completedQuantity = `Quantity cannot exceed the remaining target of ${new Intl.NumberFormat("en").format(remaining)} pcs.`;
      }
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    const update = {
      id: createUpdateId(),
      orderId: order.id,
      poNumber: order.poNumber,
      stage,
      productionDate,
      completedQuantity: quantity,
      issueNote,
      issueCategory,
      attachment: photo
        ? {
            fileName: photo.name,
            mimeType: photo.type || "image/unknown",
            size: photo.size,
            previewAvailable: false,
          }
        : existingAttachment
          ? {
              fileName: existingAttachment.fileName,
              mimeType: existingAttachment.mimeType,
              size: existingAttachment.size,
            }
          : null,
      submittedAt: new Date().toISOString(),
    };
    const result = existingUpdate
      ? await updateProductionUpdate(existingUpdate.id, update)
      : await saveProductionUpdate(update);
    submittingRef.current = false;
    setIsSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    const savedId = result.update?.id || existingUpdate?.id;
    navigate(`/production-updates/${encodeURIComponent(savedId)}`, {
      state: { message: existingUpdate ? "Production update saved." : "Production update saved." },
    });
  }

  if (ordersLoading || updatesLoading) {
    return <p aria-live="polite" className="page-load-state">Loading production data…</p>;
  }
  if (existingUpdate && existingUpdate.submittedById !== user?.id) {
    return (
      <section className="buyer-error-state" role="alert">
        <h1>Production update unavailable</h1>
        <p>You can only edit production updates that you submitted.</p>
        <Link className="buyer-outline-link" to="/production-updates">
          Back to Production Updates
        </Link>
      </section>
    );
  }

  return (
    <div className="production-update-form-page">
      <PageHeader
        description={existingUpdate
          ? "Correct this production record. Stage totals are recalculated when it is saved."
          : "Record completed production output for one order and stage."}
        title={existingUpdate ? "Edit Production Update" : "Submit Production Update"}
      />
      {updateError && (
        <p className="storage-warning" role="alert">
          {updateError}
        </p>
      )}
      {submitError && (
        <p className="form-alert form-alert--error" role="alert">
          {submitError}
        </p>
      )}
      <form className="production-update-form" noValidate onSubmit={handleSubmit}>
        <Card className="form-section" title="Production details">
          <div className="form-grid">
            <FormField
              error={errors.orderId}
              id="production-order"
              label="Production order"
              required
            >
              <select
                aria-invalid={Boolean(errors.orderId)}
                id="production-order"
                onChange={(event) => chooseOrder(event.target.value)}
                value={orderId}
              >
                <option value="">Select an order</option>
                {recentOrders.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.poNumber} · {item.buyer} · {item.style}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              error={errors.stage}
              hint={
                order
                  ? `Production workflow for ${order.poNumber}`
                  : "Choose an order first."
              }
              id="production-stage"
              label="Production stage"
              required
            >
              <select
                aria-invalid={Boolean(errors.stage)}
                disabled={!order}
                id="production-stage"
                onChange={(event) => {
                  setStage(event.target.value);
                  setErrors((current) => ({ ...current, stage: "" }));
                }}
                value={stage}
              >
                <option value="">Select a stage</option>
                {workflow.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              error={errors.productionDate}
              id="production-date"
              label="Production date"
              required
            >
              <input
                aria-invalid={Boolean(errors.productionDate)}
                id="production-date"
                max={localDate()}
                onChange={(event) => {
                  setProductionDate(event.target.value);
                  setErrors((current) => ({
                    ...current,
                    productionDate: "",
                  }));
                }}
                type="date"
                value={productionDate}
              />
            </FormField>
            <FormField
              error={errors.completedQuantity}
              hint={
                target && remaining !== null
                  ? `${new Intl.NumberFormat("en").format(completedOutput)} completed of ${new Intl.NumberFormat("en").format(target)} target · ${new Intl.NumberFormat("en").format(remaining)} remaining`
                  : "A valid stage target is required to submit production."
              }
              id="completed-quantity"
              label="Completed quantity (pieces)"
              required
            >
              <input
                aria-invalid={Boolean(errors.completedQuantity)}
                disabled={!target}
                id="completed-quantity"
                max={remaining ?? undefined}
                min="1"
                onChange={(event) => {
                  setCompletedQuantity(event.target.value);
                  setErrors((current) => ({
                    ...current,
                    completedQuantity: "",
                  }));
                }}
                placeholder="Enter pieces completed"
                step="1"
                type="number"
                value={completedQuantity}
              />
            </FormField>
            <FormField id="supervisor-name" label="Supervisor">
              <input
                disabled
                id="supervisor-name"
                value={user?.name || ""}
              />
            </FormField>
            <FormField id="issue-category" label="Issue category">
              <select
                id="issue-category"
                onChange={(event) => setIssueCategory(event.target.value)}
                value={issueCategory}
              >
                <option value="">No issue category</option>
                {issueCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="issue-note" label="Issue note">
              <textarea
                id="issue-note"
                onChange={(event) => setIssueNote(event.target.value)}
                placeholder="Record a production issue or leave blank"
                rows="3"
                value={issueNote}
              />
            </FormField>
          </div>
          {order && selectedStage && target && (
            <div className="production-update-target">
              <div>
                <span>Selected stage</span>
                <strong>{selectedStage.name}</strong>
              </div>
              <div>
                <span>Current cumulative output</span>
                <strong>
                  {new Intl.NumberFormat("en").format(completedOutput)} pcs
                </strong>
              </div>
              <div>
                <span>Remaining target</span>
                <strong>
                  {new Intl.NumberFormat("en").format(remaining)} pcs
                </strong>
              </div>
            </div>
          )}
        </Card>

        <Card className="form-section" title="Production photo (optional)">
          <p className="form-section__description">
            Image preview is temporary in this browser. Only the filename and
            image metadata are saved; server upload will be added later.
          </p>
          <label className="photo-picker" htmlFor="production-photo">
            <ImagePlus aria-hidden="true" size={21} />
            <span>Choose a production photo</span>
            <small>JPG, PNG or WEBP · up to 5 MB</small>
            <input
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              id="production-photo"
              onChange={handlePhotoChange}
              type="file"
            />
          </label>
          {photoError && (
            <p className="form-field__error" role="alert">
              {photoError}
            </p>
          )}
          {photo && photoPreview && (
            <div className="photo-preview">
              <img alt={`Preview of ${photo.name}`} src={photoPreview} />
              <div>
                <strong>{photo.name}</strong>
                <span>
                  {(photo.size / (1024 * 1024)).toFixed(2)} MB · preview only
                </span>
              </div>
              <Button
                aria-label="Remove selected photo"
                onClick={removePhoto}
                variant="quiet"
              >
                <Trash2 aria-hidden="true" size={17} />
              </Button>
            </div>
          )}
        </Card>

        <div className="production-update-form__actions">
          <Button
            as={Link}
            to="/production-updates"
            variant="secondary"
          >
            <ArrowLeft aria-hidden="true" size={16} />
            Cancel
          </Button>
          <Button disabled={isSubmitting} type="submit" variant="primary">
            {isSubmitting
              ? "Saving update…"
              : existingUpdate
                ? "Save changes"
                : "Submit Production Update"}
          </Button>
        </div>
      </form>
    </div>
  );
}
