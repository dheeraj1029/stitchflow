import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ImagePlus } from "lucide-react";
import Button from "../../components/Button.jsx";
import Card from "../../components/Card.jsx";
import FormField from "../../components/FormField.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import { getOrderWorkflow } from "../../data/productionOrders.js";
import { useOrders } from "../../state/OrdersContext.js";
import { useIssues } from "./IssuesContext.js";
import {
  ISSUE_CATEGORIES,
  CATEGORY_LABELS,
  LANGUAGE_HINTS,
  REVIEW_STATUS_LABELS,
  SEVERITY_LABELS,
} from "./issueConstants.js";
import { createIssueRecord } from "./issueModel.js";
import { classifySavedIssue } from "./issueApi.js";

const MAX_NOTE_LENGTH = 4000;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const issueStages = [
  "Cutting",
  "Printing",
  "Embroidery",
  "Stitching",
  "Washing",
  "Finishing",
  "Packing",
];

function createId() {
  return window.crypto?.randomUUID?.() ||
    `issue-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function dateTime(value) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function IssueReportPage() {
  const { orders } = useOrders();
  const { createIssue, applyClassification, markClassificationFailed } =
    useIssues();
  const [orderId, setOrderId] = useState("");
  const [stage, setStage] = useState("");
  const [originalNote, setOriginalNote] = useState("");
  const [languageHint, setLanguageHint] = useState("auto");
  const [attachment, setAttachment] = useState(null);
  const [fileError, setFileError] = useState("");
  const [issueId, setIssueId] = useState("");
  const [isClassifying, setIsClassifying] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const { issues } = useIssues();
  const selectedOrder = orders.find((order) => order.id === orderId);
  const workflow = useMemo(
    () => (selectedOrder ? getOrderWorkflow(selectedOrder) : []),
    [selectedOrder],
  );
  const availableStages = workflow.length
    ? workflow.map(({ name }) => name)
    : issueStages;
  const currentIssue = issues.find((issue) => issue.id === issueId);

  function chooseOrder(value) {
    const nextOrder = orders.find((order) => order.id === value);
    setOrderId(value);
    const orderStages = nextOrder ? getOrderWorkflow(nextOrder) : [];
    setStage(nextOrder?.stage || orderStages[0]?.name || "");
    setFieldError("");
  }

  function chooseAttachment(event) {
    const file = event.target.files?.[0];
    setFileError("");
    setAttachment(null);
    if (!file) {
      return;
    }
    const extension = file.name.split(".").pop().toLowerCase();
    const allowed = new Map([
      ["jpg", "image/jpeg"],
      ["jpeg", "image/jpeg"],
      ["png", "image/png"],
      ["webp", "image/webp"],
    ]);
    const mimeType = allowed.get(extension);
    if (!mimeType || (file.type && file.type !== mimeType)) {
      setFileError("Choose a JPG, PNG, or WEBP image.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setFileError("Photo must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }
    setAttachment({
      fileName: file.name,
      mimeType,
      size: file.size,
    });
  }

  async function classify(issue) {
    setError("");
    setIsClassifying(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      const classification = await classifySavedIssue(issue, {
        signal: controller.signal,
      });
      const result = await applyClassification(issue.id, classification);
      if (!result.ok) {
        throw new Error(result.error);
      }
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Classification failed. The original issue is saved; retry.";
      const saveResult = await markClassificationFailed(issue.id, message);
      setError(
        saveResult.ok
          ? message
          : `${message} ${saveResult.error}`,
      );
    } finally {
      window.clearTimeout(timeout);
      setIsClassifying(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setFieldError("");
    if (!selectedOrder || !stage || !originalNote.trim()) {
      setFieldError("Select an order and stage, then enter an issue note.");
      return;
    }
    if (originalNote.length > MAX_NOTE_LENGTH) {
      setFieldError(`Issue notes must be ${MAX_NOTE_LENGTH} characters or fewer.`);
      return;
    }
    const issue = createIssueRecord({
      id: createId(),
      order: selectedOrder,
      stage,
      originalNote,
      languageHint,
      attachment,
    });
    const result = await createIssue(issue);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const savedIssue = { ...issue, id: result.issue.id };
    setIssueId(savedIssue.id);
    await classify(savedIssue);
  }

  return (
    <div className="issue-report-page">
      <PageHeader
        description="Record an issue in Tamil or English. The original note is saved before classification and is never edited by AI."
        title="Report Production Issue"
      />
      {error && (
        <p className="form-alert form-alert--error" role="alert">{error}</p>
      )}
      <form className="issue-report-form" onSubmit={handleSubmit}>
        <Card className="issue-form-card" title="Issue details">
          <div className="issue-form-grid">
            <FormField id="issue-order" label="Production order" required>
              <select
                id="issue-order"
                onChange={(event) => chooseOrder(event.target.value)}
                value={orderId}
              >
                <option value="">Select an order</option>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.poNumber} · {order.buyer} · {order.style}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              hint={selectedOrder ? `For ${selectedOrder.poNumber}` : "Choose an order first."}
              id="issue-stage"
              label="Production stage"
              required
            >
              <select
                disabled={!orderId}
                id="issue-stage"
                onChange={(event) => setStage(event.target.value)}
                value={stage}
              >
                <option value="">Select a stage</option>
                {availableStages.map((stageName) => (
                  <option key={stageName} value={stageName}>{stageName}</option>
                ))}
              </select>
            </FormField>
            <FormField
              hint={`${originalNote.length}/${MAX_NOTE_LENGTH} characters. Supports Tamil Unicode and English.`}
              id="issue-original-note"
              label="Issue note"
              required
            >
              <textarea
                id="issue-original-note"
                maxLength={MAX_NOTE_LENGTH}
                onChange={(event) => setOriginalNote(event.target.value)}
                placeholder="Describe the production issue in Tamil or English"
                rows={5}
                value={originalNote}
              />
            </FormField>
            <FormField
              hint="Choose Tamil, English, or let the service detect the language."
              id="issue-language-hint"
              label="Language hint"
            >
              <select
                id="issue-language-hint"
                onChange={(event) => setLanguageHint(event.target.value)}
                value={languageHint}
              >
                {Object.entries(LANGUAGE_HINTS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </FormField>
          </div>
          {fieldError && <p className="form-field__error" role="alert">{fieldError}</p>}
        </Card>

        <Card className="issue-form-card" title="Photo attachment (optional)">
          <p className="issue-muted">
            Photos are kept as local metadata only in this phase. Image contents
            are not uploaded or sent to the AI service.
          </p>
          <label className="issue-photo-picker" htmlFor="issue-photo">
            <ImagePlus aria-hidden="true" size={19} />
            <span>{attachment ? attachment.fileName : "Attach a photo"}</span>
            <small>JPG, PNG, or WEBP · up to 5 MB</small>
            <input
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              id="issue-photo"
              onChange={chooseAttachment}
              type="file"
            />
          </label>
          {fileError && <p className="form-field__error" role="alert">{fileError}</p>}
          {attachment && (
            <button
              className="text-button"
              onClick={() => {
                setAttachment(null);
                document.getElementById("issue-photo").value = "";
              }}
              type="button"
            >
              Remove attachment
            </button>
          )}
        </Card>
        <div className="issue-form-actions">
          <Button as={Link} to="/production-updates" variant="secondary">
            <ArrowLeft aria-hidden="true" size={16} />
            Cancel
          </Button>
          <Button disabled={isClassifying} type="submit" variant="primary">
            {isClassifying ? "Saving original and classifying…" : "Submit for classification"}
          </Button>
        </div>
      </form>

      {isClassifying && (
        <Card className="issue-result-card" title="Classification in progress">
          <p role="status">
            Your original note is saved. The AI suggestion is being prepared and
            will still require merchandiser review.
          </p>
        </Card>
      )}
      {currentIssue?.reviewStatus === "CLASSIFICATION_FAILED" && (
        <Card className="issue-result-card issue-result-card--failed" title="Classification unavailable">
          <p>{currentIssue.classificationError}</p>
          <p>Your original note remains saved and unchanged.</p>
          <Button
            disabled={isClassifying}
            onClick={() => classify(currentIssue)}
            variant="secondary"
          >
            Retry classification
          </Button>
          <Link to={`/issues?issue=${encodeURIComponent(currentIssue.id)}`}>
            Open saved issue
          </Link>
        </Card>
      )}
      {currentIssue?.suggestedCategory && (
        <Card className="issue-result-card" title="AI suggestion · merchandiser review required">
          <p className="issue-original-preview" lang={currentIssue.detectedLanguage === "Tamil" ? "ta" : "en"}>
            <strong>Original note (unchanged)</strong>
            <span>{currentIssue.originalNote}</span>
          </p>
          <dl className="issue-suggestion-grid">
            <div><dt>Detected language</dt><dd>{currentIssue.detectedLanguage}</dd></div>
            <div><dt>English translation</dt><dd>{currentIssue.suggestedTranslation}</dd></div>
            <div><dt>Suggested category</dt><dd>{CATEGORY_LABELS[currentIssue.suggestedCategory]}</dd></div>
            <div><dt>Suggested severity</dt><dd>{SEVERITY_LABELS[currentIssue.suggestedSeverity]}</dd></div>
            <div><dt>Explanation</dt><dd>{currentIssue.aiExplanation}</dd></div>
            <div><dt>Confidence</dt><dd>{Math.round(currentIssue.confidence * 100)}%</dd></div>
          </dl>
          <p className="issue-review-status issue-review-status--pending">
            {REVIEW_STATUS_LABELS[currentIssue.reviewStatus]} · AI suggestions
            are not confirmed decisions.
          </p>
          <Link to={`/issues?issue=${encodeURIComponent(currentIssue.id)}`}>
            Open in Production Issues to review
          </Link>
        </Card>
      )}
    </div>
  );
}
