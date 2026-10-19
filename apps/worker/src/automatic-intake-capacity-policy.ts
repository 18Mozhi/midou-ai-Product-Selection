/** Existing per-intelligence query fanout; shared with output validation. */
export const intelligenceProductQueryLimit = 3;

/** Keep downstream admission space within the existing global budget.
 * Tiny explicitly configured budgets still permit the first intake item.
 * This is admission headroom, not a cross-producer atomic reservation.
 */
export const automaticIntakeBacklogLimit = (queueBacklogLimit: number) =>
  Math.max(1, queueBacklogLimit - intelligenceProductQueryLimit);
