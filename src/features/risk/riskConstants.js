export const RISK_LEVELS = {
  RED: "red",
  AMBER: "amber",
  GREEN: "green",
  UNKNOWN: "unknown",
};

export const RED_RATE_VARIANCE = 0.25;
export const OBSERVATION_WORKING_DAYS = 5;

export const STAGE_MILESTONE_KEYS = {
  Cutting: "cutting-start",
  Printing: "printing-embroidery",
  Embroidery: "printing-embroidery",
  Stitching: "stitching-start",
  Finishing: "finishing-start",
  Packing: "packing-completion",
};

export const RISK_LABELS = {
  [RISK_LEVELS.RED]: "High risk",
  [RISK_LEVELS.AMBER]: "Needs attention",
  [RISK_LEVELS.GREEN]: "On track",
  [RISK_LEVELS.UNKNOWN]: "Insufficient data",
};
