import {
  getStageProgress,
  getStageTarget,
} from "../data/productionOrders.js";

const numberFormatter = new Intl.NumberFormat("en");

export default function ProductionProgress({ order }) {
  const progress = getStageProgress(order);
  const target = getStageTarget(order);
  const displayedProgress = progress.toFixed(1);

  return (
    <div className={`production-progress production-progress--${order.status}`}>
      <div className="production-progress__track">
        <div
          aria-label={`${order.stage} stage progress for ${order.poNumber}`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Number(displayedProgress)}
          aria-valuetext={`${numberFormatter.format(order.stageOutput)} of ${numberFormatter.format(target)} stage target at ${order.stage}, ${displayedProgress}%`}
          className="production-progress__value"
          role="progressbar"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="production-progress__percentage">{displayedProgress}%</span>
      <span className="production-progress__detail">
        {numberFormatter.format(order.stageOutput)} of{" "}
        {numberFormatter.format(target)} pcs at {order.stage}
      </span>
    </div>
  );
}
