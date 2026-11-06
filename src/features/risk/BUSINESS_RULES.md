# Production risk rules

- Each configured order workflow stage is assessed independently. The target
  comes from that stage's workflow target, falling back to the order target.
  Remaining quantity is clamped at zero; an invalid target is unavailable.
- A stage uses the corresponding available T&A marker (`Cutting Start`,
  `Printing / Embroidery`, `Stitching Start`, `Finishing Start`, or
  `Packing Completion`). A stage with no mapped or valid date is `UNKNOWN`.
  This is a date proxy: the current order model does not store a separate
  planned stage-completion date.
- Required output is remaining quantity divided by future working days through
  the milestone; the current date is excluded and weekends are not counted.
  If none remain, the required rate is unavailable and an incomplete stage is
  high risk.
- Actual output sums matching order-and-stage updates from the last five
  working days ending on the current working date, then divides by five,
  counting dates without updates as zero. At least one matching update in that
  window is required to call the history sufficient. The baseline stage output
  is never treated as daily production.
- Projection rounds required working days up and skips weekends. Zero output
  cannot produce a reliable completion date. Dates, quantities, and stages are
  validated before calculations; unknown data is not treated as on track.
- `RED_RATE_VARIANCE` is the configurable 25% threshold. An overdue incomplete
  stage, no remaining working days, or a required rate more than 25% above
  actual is red. A shortfall within the 25% amber tolerance remains amber even
  if its projected date falls after the milestone; the detail exposes that
  projected miss. A projected miss outside that tolerance is red. Buffer
  counts working days strictly between the projected completion
  and milestone dates (not the deadline itself); fewer than two is amber. A
  stage with enough recent history, an on-time projection, and at least two
  working days of buffer is green.
- A stage already at target is green only when its target and planned milestone
  are valid. Missing target, missing milestone, or insufficient recent history
  is otherwise unknown. An overdue incomplete milestone is red even without
  recent history.
- Summary values count unique orders. An order can be counted in more than one
  warning category when its stages have different risk signals; an order is
  on track only when all of its assessed stages are green.

These are initial transparent heuristics, not a statistical prediction or a
guarantee of delivery.
