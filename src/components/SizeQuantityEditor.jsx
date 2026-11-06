import { Plus, Trash2 } from "lucide-react";
import Button from "./Button.jsx";
import FormField from "./FormField.jsx";

const numberFormatter = new Intl.NumberFormat("en");

export default function SizeQuantityEditor({
  error,
  onChange,
  rows,
  savedQuantity,
}) {
  const total = rows.reduce((sum, row) => {
    const quantity = Number(row.quantity);
    return Number.isInteger(quantity) && quantity >= 0 ? sum + quantity : sum;
  }, 0);

  function updateRow(id, key, value) {
    onChange(
      rows.map((row) => (row.id === id ? { ...row, [key]: value } : row)),
    );
  }

  return (
    <div className="quantity-editor">
      {rows.length === 0 && savedQuantity > 0 && (
        <p className="quantity-editor__legacy-note">
          This sample order has no saved size breakdown. Add its sizes to edit
          the breakdown; the current saved total is{" "}
          <strong>{numberFormatter.format(savedQuantity)} pcs</strong>.
        </p>
      )}
      <div className="quantity-editor__rows">
        {rows.map((row, index) => (
          <div className="quantity-editor__row" key={row.id}>
            <FormField id={`size-${row.id}`} label={`Size ${index + 1}`}>
              <input
                autoComplete="off"
                id={`size-${row.id}`}
                maxLength={24}
                onChange={(event) =>
                  updateRow(row.id, "size", event.target.value)
                }
                placeholder="e.g. M"
                value={row.size}
              />
            </FormField>
            <FormField id={`quantity-${row.id}`} label="Quantity">
              <input
                id={`quantity-${row.id}`}
                min="0"
                onChange={(event) =>
                  updateRow(row.id, "quantity", event.target.value)
                }
                placeholder="0"
                step="1"
                type="number"
                value={row.quantity}
              />
            </FormField>
            <Button
              aria-label={`Remove size row ${index + 1}`}
              className="quantity-editor__remove"
              onClick={() => onChange(rows.filter((item) => item.id !== row.id))}
              title="Remove size"
              variant="quiet"
            >
              <Trash2 aria-hidden="true" size={16} />
            </Button>
          </div>
        ))}
      </div>
      <div className="quantity-editor__footer">
        <Button
          className="form-add-button"
          onClick={() =>
            onChange([
              ...rows,
              { id: `size-${Date.now()}-${rows.length}`, size: "", quantity: "" },
            ])
          }
          variant="secondary"
        >
          <Plus aria-hidden="true" size={16} />
          Add size
        </Button>
        <p className="quantity-editor__total">
          Order total <strong>{numberFormatter.format(total)} pcs</strong>
        </p>
      </div>
      {error && (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
