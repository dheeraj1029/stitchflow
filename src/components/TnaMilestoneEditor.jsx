import { Plus, Trash2 } from "lucide-react";
import Button from "./Button.jsx";
import FormField from "./FormField.jsx";
import { requiredMilestones } from "../data/productionOrders.js";

function localDate(date = new Date()) {
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

export default function TnaMilestoneEditor({
  errors,
  exFactoryDate,
  milestones,
  onChange,
}) {
  function updateMilestone(id, key, value) {
    onChange(
      milestones.map((milestone) =>
        milestone.id === id
          ? {
              ...milestone,
              [key]: value,
              updatedAt: new Date().toISOString(),
              ...(key === "completed" && {
                completedDate: value
                  ? milestone.completedDate || localDate()
                  : "",
              }),
            }
          : milestone,
      ),
    );
  }

  return (
    <div className="milestone-editor">
      {milestones.map((milestone, index) => {
        const dateId = `milestone-date-${milestone.id}`;
        const nameId = `milestone-name-${milestone.id}`;
        const dateError = errors[`milestones.${milestone.id}.plannedDate`];
        const isExFactory = milestone.key === "ex-factory";

        return (
          <div className="milestone-editor__row" key={milestone.id}>
            <span className="milestone-editor__index">
              {String(index + 1).padStart(2, "0")}
            </span>
            <FormField
              error={errors[`milestones.${milestone.id}.name`]}
              id={nameId}
              label="Milestone"
              required={milestone.required}
            >
              <input
                aria-invalid={Boolean(
                  errors[`milestones.${milestone.id}.name`],
                )}
                id={nameId}
                maxLength={60}
                onChange={(event) =>
                  updateMilestone(milestone.id, "name", event.target.value)
                }
                value={milestone.name}
              />
            </FormField>
            <FormField
              error={dateError}
              hint={isExFactory ? "Matches the order ex-factory date." : ""}
              id={dateId}
              label="Planned date"
              required={milestone.required}
            >
              <input
                aria-invalid={Boolean(dateError)}
                id={dateId}
                max={exFactoryDate || undefined}
                onChange={(event) =>
                  updateMilestone(
                    milestone.id,
                    "plannedDate",
                    event.target.value,
                  )
                }
                readOnly={isExFactory}
                type="date"
                value={isExFactory ? exFactoryDate : milestone.plannedDate}
              />
            </FormField>
            <label className="milestone-editor__completion">
              <input
                checked={milestone.completed}
                onChange={(event) =>
                  updateMilestone(
                    milestone.id,
                    "completed",
                    event.target.checked,
                  )
                }
                type="checkbox"
              />
              <span>Completed</span>
            </label>
            {milestone.completed && (
              <FormField
                error={errors[`milestones.${milestone.id}.completedDate`]}
                id={`milestone-completed-${milestone.id}`}
                label="Completed date"
              >
                <input
                  aria-invalid={Boolean(
                    errors[`milestones.${milestone.id}.completedDate`],
                  )}
                  id={`milestone-completed-${milestone.id}`}
                  max={localDate()}
                  onChange={(event) =>
                    updateMilestone(
                      milestone.id,
                      "completedDate",
                      event.target.value,
                    )
                  }
                  type="date"
                  value={milestone.completedDate}
                />
              </FormField>
            )}
            {!milestone.required && (
              <Button
                aria-label={`Remove ${milestone.name || "custom milestone"}`}
                className="milestone-editor__remove"
                onClick={() =>
                  onChange(
                    milestones.filter((item) => item.id !== milestone.id),
                  )
                }
                variant="quiet"
              >
                <Trash2 aria-hidden="true" size={16} />
              </Button>
            )}
          </div>
        );
      })}
      <Button
        className="form-add-button"
        onClick={() =>
          onChange([
            ...milestones,
            {
              id: `custom-${Date.now()}-${milestones.length}`,
              name: "",
              plannedDate: "",
              required: false,
              completed: false,
              completedDate: "",
              updatedAt: new Date().toISOString(),
            },
          ])
        }
        variant="secondary"
      >
        <Plus aria-hidden="true" size={16} />
        Add custom milestone
      </Button>
      {errors.milestones && (
        <p className="form-field__error" role="alert">
          {errors.milestones}
        </p>
      )}
      <p className="milestone-editor__note">
        Required milestones:{" "}
        {requiredMilestones.map((milestone) => milestone.name).join(" · ")}.
        Dates and completion are managed manually; dates in the past do not
        automatically mark a milestone complete.
      </p>
    </div>
  );
}
