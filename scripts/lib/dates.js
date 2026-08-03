export function formatISODate(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** Lundi (00:00 UTC) de la semaine contenant `date`. */
export function mondayOf(date) {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = result.getUTCDay(); // 0 = dimanche, 1 = lundi, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  return addDays(result, diffToMonday);
}
