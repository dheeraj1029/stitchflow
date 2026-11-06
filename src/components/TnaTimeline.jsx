import { Check, Circle, Clock3 } from "lucide-react";

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const dateTimeFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatDate(value, formatter = dateFormatter) {
  if (!value) {
    return "";
  }
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "" : formatter.format(date);
}

export default function TnaTimeline({ milestones }) {
  const today = new Date();
  const todayDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  if (!milestones?.length) {
    return (
      <p className="details-empty">
        No time-and-action milestones have been added to this order.
      </p>
    );
  }

  return (
    <ol className="tna-timeline">
      {milestones.map((milestone) => {
        const planned = milestone.plannedDate
          ? new Date(`${milestone.plannedDate}T12:00:00`)
          : null;
        const isOverdue =
          !milestone.completed && planned && planned < todayDate;
        const status = milestone.completed
          ? "completed"
          : isOverdue
            ? "overdue"
            : planned
              ? "upcoming"
              : "pending";
        const Icon =
          status === "completed" ? Check : status === "overdue" ? Clock3 : Circle;

        return (
          <li
            className={`tna-timeline__item tna-timeline__item--${status}`}
            key={milestone.id}
          >
            <span aria-hidden="true" className="tna-timeline__marker">
              <Icon size={14} />
            </span>
            <div className="tna-timeline__content">
              <div className="tna-timeline__heading">
                <h3>{milestone.name}</h3>
                <span className="tna-timeline__status">
                  {status === "overdue" ? "Overdue · Pending" : status}
                </span>
              </div>
              <p>
                Planned:{" "}
                {formatDate(milestone.plannedDate) || "Date not scheduled"}
              </p>
              {milestone.completed && milestone.completedDate && (
                <p>Completed: {formatDate(milestone.completedDate)}</p>
              )}
              {milestone.updatedAt &&
                !Number.isNaN(Date.parse(milestone.updatedAt)) && (
                <p className="tna-timeline__updated">
                  Last updated{" "}
                  {dateTimeFormatter.format(new Date(milestone.updatedAt))}
                </p>
                )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
