/**
 * Monthly generation period helpers (UTC calendar month).
 * Pure functions — safe to unit test without a database.
 */

export function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

export function isSameUtcMonth(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth()
  );
}

export type UsagePeriodState = {
  monthlyGenerationCount: number;
  generationPeriodStart: Date;
  needsReset: boolean;
};

export function resolveUsagePeriod(
  periodStart: Date,
  count: number,
  now: Date = new Date()
): UsagePeriodState {
  if (isSameUtcMonth(periodStart, now)) {
    return {
      monthlyGenerationCount: count,
      generationPeriodStart: periodStart,
      needsReset: false,
    };
  }
  return {
    monthlyGenerationCount: 0,
    generationPeriodStart: startOfUtcMonth(now),
    needsReset: true,
  };
}
