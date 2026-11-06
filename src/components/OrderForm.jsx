import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useOrders } from "../state/OrdersContext.js";
import Button from "./Button.jsx";
import Card from "./Card.jsx";
import FormField from "./FormField.jsx";
import PageHeader from "./PageHeader.jsx";
import SizeQuantityEditor from "./SizeQuantityEditor.jsx";
import TnaMilestoneEditor from "./TnaMilestoneEditor.jsx";
import { requiredMilestones } from "../data/productionOrders.js";
import { validateOrder } from "../data/orderValidation.js";

const buyers = [
  { name: "Company A (US)", country: "United States" },
  { name: "Company B (UK)", country: "United Kingdom" },
  { name: "Company C (Germany)", country: "Germany" },
];
const productionUnits = [
  "North Mill (Demo)",
  "Riverside Works (Demo)",
  "East Works (Demo)",
];
const productionStages = [
  "Order Received",
  "Fabric",
  "Cutting",
  "Printing",
  "Stitching",
  "Finishing",
  "Inspection",
  "Packing",
];
const categories = ["T-shirt", "Polo", "Sweatshirt", "Knitwear", "Other"];

function localDate(date = new Date()) {
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function createMilestones() {
  return [
    ...requiredMilestones.map((milestone) => ({
      ...milestone,
      id: milestone.key,
      plannedDate: "",
      required: true,
      completed: false,
      completedDate: "",
      updatedAt: new Date().toISOString(),
    })),
    {
      id: "printing-embroidery",
      key: "printing-embroidery",
      name: "Printing / Embroidery",
      plannedDate: "",
      required: false,
      completed: false,
      completedDate: "",
      updatedAt: new Date().toISOString(),
    },
  ];
}

function createEmptyOrder() {
  const today = localDate();
  return {
    id: "",
    poNumber: "",
    buyer: "",
    buyerCountry: "",
    buyerReference: "",
    orderDate: today,
    style: "",
    styleNumber: "",
    productCategory: "",
    colour: "",
    fabricDescription: "",
    notes: "",
    quantity: 0,
    sizeBreakdown: [],
    stage: "Order Received",
    stageOutput: 0,
    productionTarget: 0,
    separateProductionTarget: false,
    productionNotes: "",
    exFactoryDate: "",
    status: "pending",
    productionUnit: "",
    milestones: createMilestones(),
  };
}

function createFormOrder(order) {
  const source = order || createEmptyOrder();
  return {
    ...source,
    sizeBreakdown: (source.sizeBreakdown || []).map((row, index) => ({
      ...row,
      id: row.id || `saved-size-${index}`,
      quantity: String(row.quantity),
    })),
    productionTarget: String(source.productionTarget || source.quantity || ""),
    separateProductionTarget: Boolean(source.separateProductionTarget),
    milestones: (source.milestones || createMilestones()).map((item) => ({
      ...item,
      updatedAt: item.updatedAt || new Date().toISOString(),
    })),
  };
}

export default function OrderForm() {
  const { poNumber: routePo } = useParams();
  const navigate = useNavigate();
  const { orders, saveOrder } = useOrders();
  const existingOrder = routePo
    ? orders.find((order) => order.poNumber === routePo)
    : null;
  const [initialForm] = useState(() => createFormOrder(existingOrder));
  const [form, setForm] = useState(initialForm);
  const baselineRef = useRef(JSON.stringify(initialForm));
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [confirmLeave, setConfirmLeave] = useState(false);

  useEffect(() => {
    const nextForm = createFormOrder(existingOrder);
    baselineRef.current = JSON.stringify(nextForm);
    setForm(nextForm);
  }, [existingOrder]);

  const isEditing = Boolean(routePo);
  const sizeBreakdownChanged =
    JSON.stringify(
      form.sizeBreakdown.map(({ size, quantity }) => ({ size, quantity })),
    ) !==
    JSON.stringify(
      initialForm.sizeBreakdown.map(({ size, quantity }) => ({
        size,
        quantity,
      })),
    );
  const sizeTotal = useMemo(
    () =>
      form.sizeBreakdown.reduce((sum, row) => {
        const quantity = Number(row.quantity);
        return Number.isInteger(quantity) && quantity >= 0
          ? sum + quantity
          : sum;
      }, 0),
    [form.sizeBreakdown],
  );
  const displayedProductionTarget =
    isEditing && !sizeBreakdownChanged
      ? existingOrder.productionTarget ?? existingOrder.quantity
      : sizeTotal;

  const isDirty = JSON.stringify(form) !== baselineRef.current;

  useEffect(() => {
    if (!isDirty) {
      return undefined;
    }
    function warnBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);

  if (isEditing && !existingOrder) {
    return (
      <>
        <PageHeader title="Order not found" />
        <Card className="order-not-found">
          <p>This order may have been removed or its PO number has changed.</p>
          <Button as={Link} to="/orders" variant="secondary">
            Back to Orders
          </Button>
        </Card>
      </>
    );
  }

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  function updateSizeRows(rows) {
    setForm((current) => ({
      ...current,
      sizeBreakdown: rows,
      quantity: rows.reduce((sum, row) => {
        const quantity = Number(row.quantity);
        return Number.isInteger(quantity) && quantity >= 0 ? sum + quantity : sum;
      }, 0),
      productionTarget: current.separateProductionTarget
        ? current.productionTarget
        : String(
            rows.reduce((sum, row) => {
              const quantity = Number(row.quantity);
              return Number.isInteger(quantity) && quantity >= 0
                ? sum + quantity
                : sum;
            }, 0),
          ),
    }));
    setErrors((current) => ({ ...current, sizeBreakdown: "" }));
  }

  function updateMilestones(milestones) {
    const previousById = new Map(
      form.milestones.map((milestone) => [milestone.id, milestone]),
    );
    const nextErrors = { ...errors, milestones: "" };
    for (const milestone of milestones) {
      const previous = previousById.get(milestone.id);
      if (!previous) {
        continue;
      }
      for (const field of ["name", "plannedDate", "completedDate"]) {
        if (previous[field] !== milestone[field]) {
          nextErrors[`milestones.${milestone.id}.${field}`] = "";
        }
      }
    }

    setForm((current) => ({
      ...current,
      milestones: milestones.map((milestone) =>
        milestone.key === "ex-factory"
          ? { ...milestone, plannedDate: current.exFactoryDate }
          : milestone,
      ),
    }));
    setErrors(nextErrors);
  }

  function handleExFactoryChange(value) {
    setForm((current) => ({
      ...current,
      exFactoryDate: value,
      milestones: current.milestones.map((milestone) =>
        milestone.key === "ex-factory"
          ? { ...milestone, plannedDate: value, updatedAt: new Date().toISOString() }
          : milestone,
      ),
    }));
    setErrors((current) => ({ ...current, exFactoryDate: "" }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setSubmitError("");
    const normalized = {
      ...form,
      poNumber: form.poNumber.trim(),
      buyer: form.buyer.trim(),
      style: form.style.trim(),
      quantity:
        isEditing && !sizeBreakdownChanged
          ? existingOrder.quantity
          : sizeTotal,
      productionTarget: form.separateProductionTarget
        ? Number(form.productionTarget)
        : isEditing && !sizeBreakdownChanged
          ? existingOrder.productionTarget ?? existingOrder.quantity
          : sizeTotal,
      stageOutput: existingOrder?.stageOutput ?? 0,
      status: existingOrder?.status ?? "pending",
      sizeBreakdown: form.sizeBreakdown.map((row) => ({
        size: row.size.trim(),
        quantity: Number(row.quantity),
      })),
      milestones: form.milestones.map((milestone) => ({
        ...milestone,
        plannedDate:
          milestone.key === "ex-factory"
            ? form.exFactoryDate
            : milestone.plannedDate,
        updatedAt: milestone.updatedAt || new Date().toISOString(),
      })),
    };
    const validation = validateOrder(normalized, orders, existingOrder?.id, {
      requireSizeBreakdown: !isEditing || sizeBreakdownChanged,
    });
    setErrors(validation.errors);
    if (Object.keys(validation.errors).length > 0) {
      setSubmitError("Review the highlighted fields before saving.");
      return;
    }

    const result = saveOrder(normalized, existingOrder?.id);
    if (!result.ok) {
      setSubmitError(result.error);
      setErrors((current) => ({ ...current, poNumber: result.error }));
      return;
    }
    baselineRef.current = JSON.stringify(createFormOrder(normalized));
    navigate(`/orders/${encodeURIComponent(normalized.poNumber)}`, {
      state: {
        message: isEditing ? "Order changes saved." : "Order created.",
      },
    });
  }

  return (
    <>
      <PageHeader
        description={
          isEditing
            ? "Update order information, quantities and time-and-action milestones."
            : "Add production details and set the time-and-action plan."
        }
        title={isEditing ? `Edit ${existingOrder.poNumber}` : "Create Order"}
      />
      {submitError && (
        <p className="form-alert form-alert--error" role="alert">
          {submitError}
        </p>
      )}
      <form className="order-form" noValidate onSubmit={handleSubmit}>
        <Card className="form-section" title="Order information">
          <div className="form-grid">
            <FormField
              error={errors.poNumber}
              id="po-number"
              label="PO number"
              required
            >
              <input
                aria-invalid={Boolean(errors.poNumber)}
                autoComplete="off"
                id="po-number"
                maxLength={60}
                onChange={(event) => updateField("poNumber", event.target.value)}
                placeholder="e.g. B-PO-88241"
                value={form.poNumber}
              />
            </FormField>
            <FormField
              error={errors.buyer}
              id="buyer"
              label="Buyer"
              required
            >
              <>
                <input
                  aria-invalid={Boolean(errors.buyer)}
                  id="buyer"
                  list="buyer-options"
                  onChange={(event) => {
                    const selected = buyers.find(
                      (buyer) => buyer.name === event.target.value,
                    );
                    setForm((current) => ({
                      ...current,
                      buyer: event.target.value,
                      buyerCountry: selected?.country || current.buyerCountry,
                    }));
                    setErrors((current) => ({ ...current, buyer: "" }));
                  }}
                  placeholder="Select or enter a buyer"
                  value={form.buyer}
                />
                <datalist id="buyer-options">
                  {buyers.map((buyer) => (
                    <option key={buyer.name} value={buyer.name} />
                  ))}
                </datalist>
              </>
            </FormField>
            <FormField id="buyer-country" label="Buyer country">
              <input
                id="buyer-country"
                onChange={(event) =>
                  updateField("buyerCountry", event.target.value)
                }
                placeholder="e.g. United Kingdom"
                value={form.buyerCountry}
              />
            </FormField>
            <FormField id="buyer-reference" label="Buyer reference">
              <input
                id="buyer-reference"
                onChange={(event) =>
                  updateField("buyerReference", event.target.value)
                }
                placeholder="Optional reference"
                value={form.buyerReference}
              />
            </FormField>
            <FormField
              error={errors.orderDate}
              id="order-date"
              label="Order date"
            >
              <input
                aria-invalid={Boolean(errors.orderDate)}
                id="order-date"
                onChange={(event) => updateField("orderDate", event.target.value)}
                type="date"
                value={form.orderDate}
              />
            </FormField>
            <FormField
              error={errors.exFactoryDate}
              id="ex-factory-date"
              label="Ex-factory date"
              required
            >
              <input
                aria-invalid={Boolean(errors.exFactoryDate)}
                id="ex-factory-date"
                min={form.orderDate || undefined}
                onChange={(event) => handleExFactoryChange(event.target.value)}
                type="date"
                value={form.exFactoryDate}
              />
            </FormField>
            <FormField
              error={errors.productionUnit}
              id="production-unit"
              label="Production unit"
              required
            >
              <select
                aria-invalid={Boolean(errors.productionUnit)}
                id="production-unit"
                onChange={(event) =>
                  updateField("productionUnit", event.target.value)
                }
                value={form.productionUnit}
              >
                <option value="">Select a unit</option>
                {productionUnits.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </Card>

        <Card className="form-section" title="Style information">
          <div className="form-grid">
            <FormField
              error={errors.style}
              id="style-name"
              label="Style name"
              required
            >
              <input
                aria-invalid={Boolean(errors.style)}
                id="style-name"
                onChange={(event) => updateField("style", event.target.value)}
                placeholder="e.g. Men's Crew Neck Tee"
                value={form.style}
              />
            </FormField>
            <FormField id="style-number" label="Style number">
              <input
                id="style-number"
                onChange={(event) =>
                  updateField("styleNumber", event.target.value)
                }
                placeholder="Optional style number"
                value={form.styleNumber}
              />
            </FormField>
            <FormField id="product-category" label="Product category">
              <select
                id="product-category"
                onChange={(event) =>
                  updateField("productCategory", event.target.value)
                }
                value={form.productCategory}
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="colour" label="Colour">
              <input
                id="colour"
                onChange={(event) => updateField("colour", event.target.value)}
                placeholder="e.g. Navy"
                value={form.colour}
              />
            </FormField>
            <FormField id="fabric-description" label="Fabric description">
              <input
                id="fabric-description"
                onChange={(event) =>
                  updateField("fabricDescription", event.target.value)
                }
                placeholder="Optional fabric details"
                value={form.fabricDescription}
              />
            </FormField>
            <FormField id="order-notes" label="Additional notes">
              <textarea
                id="order-notes"
                onChange={(event) => updateField("notes", event.target.value)}
                placeholder="Optional notes"
                rows="3"
                value={form.notes}
              />
            </FormField>
          </div>
        </Card>

        <Card
          className="form-section"
          title="Size-wise quantity"
        >
          <p className="form-section__description">
            Enter one quantity for each size. A single colour variant is
            supported for this phase.
          </p>
          <SizeQuantityEditor
            error={errors.sizeBreakdown}
            onChange={updateSizeRows}
            rows={form.sizeBreakdown}
            savedQuantity={existingOrder?.quantity || 0}
          />
        </Card>

        <Card className="form-section" title="Production information">
          <div className="form-grid">
            <FormField id="initial-stage" label="Initial production stage">
              <select
                id="initial-stage"
                onChange={(event) => updateField("stage", event.target.value)}
                value={form.stage}
              >
                {productionStages.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              error={errors.productionTarget}
              hint={
                form.separateProductionTarget
                  ? "Separate stage target; the order quantity remains the size total."
                  : "Defaults to total size quantity."
              }
              id="production-target"
              label="Production target quantity"
            >
              <input
                aria-invalid={Boolean(errors.productionTarget)}
                disabled={!form.separateProductionTarget}
                id="production-target"
                min="1"
                onChange={(event) =>
                  updateField("productionTarget", event.target.value)
                }
                step="1"
                type="number"
                value={
                  form.separateProductionTarget
                    ? form.productionTarget
                    : displayedProductionTarget
                }
              />
            </FormField>
            <label className="form-checkbox">
              <input
                checked={form.separateProductionTarget}
                onChange={(event) => {
                  updateField(
                    "separateProductionTarget",
                    event.target.checked,
                  );
                  if (!event.target.checked) {
                    updateField("productionTarget", String(sizeTotal));
                  }
                }}
                type="checkbox"
              />
              Use a separate production target
            </label>
            <FormField id="production-notes" label="Production notes">
              <textarea
                id="production-notes"
                onChange={(event) =>
                  updateField("productionNotes", event.target.value)
                }
                placeholder="Optional production notes"
                rows="3"
                value={form.productionNotes}
              />
            </FormField>
          </div>
        </Card>

        <Card className="form-section" title="Time and action milestones">
          <p className="form-section__description">
            Plan milestone dates and manually record completion. Past dates are
            never marked complete automatically.
          </p>
          <TnaMilestoneEditor
            errors={errors}
            exFactoryDate={form.exFactoryDate}
            milestones={form.milestones}
            onChange={updateMilestones}
          />
        </Card>

        {isDirty && (
          <div className="unsaved-notice" role="status">
            Unsaved changes. Leaving this form may discard your updates.
          </div>
        )}
        {confirmLeave && (
          <div className="form-alert form-alert--warning" role="alert">
            <span>Discard unsaved changes and leave this form?</span>
            <Button onClick={() => setConfirmLeave(false)} variant="secondary">
              Keep editing
            </Button>
            <Button
              onClick={() => navigate("/orders")}
              variant="secondary"
            >
              Discard changes
            </Button>
          </div>
        )}
        <div className="order-form__actions">
          <Button
            onClick={() =>
              isDirty ? setConfirmLeave(true) : navigate("/orders")
            }
            variant="secondary"
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {isEditing ? "Save changes" : "Create order"}
          </Button>
        </div>
      </form>
    </>
  );
}
