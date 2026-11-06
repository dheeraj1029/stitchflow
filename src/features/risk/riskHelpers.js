function parseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
}

export function toDateString(value = new Date()) {
  if (typeof value === "string") {
    return parseDate(value) ? value : null;
  }
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return null;
  }
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isWorkingDay(date) {
  const weekday = date.getUTCDay();
  return weekday !== 0 && weekday !== 6;
}

export function getLastWorkingDates(endDate, count) {
  const end = parseDate(endDate);
  if (!end || !Number.isInteger(count) || count < 1) {
    return [];
  }
  const dates = [];
  const cursor = new Date(end);
  while (dates.length < count) {
    if (isWorkingDay(cursor)) {
      dates.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return dates.reverse();
}

export function countWorkingDaysAfter(startDate, endDate) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end || end <= start) {
    return 0;
  }
  let count = 0;
  const cursor = new Date(start);
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  while (cursor <= end) {
    if (isWorkingDay(cursor)) {
      count += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

export function countWorkingDaysBetween(startDate, endDate) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end || end <= start) {
    return 0;
  }
  let count = 0;
  const cursor = new Date(start);
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  while (cursor < end) {
    if (isWorkingDay(cursor)) {
      count += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

export function addWorkingDays(startDate, workingDays) {
  const start = parseDate(startDate);
  if (!start || !Number.isInteger(workingDays) || workingDays < 0) {
    return null;
  }
  const cursor = new Date(start);
  let added = 0;
  while (added < workingDays) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isWorkingDay(cursor)) {
      added += 1;
    }
  }
  return cursor.toISOString().slice(0, 10);
}

export function formatDate(value, options = { dateStyle: "medium" }) {
  const date = parseDate(value);
  return date
    ? new Intl.DateTimeFormat("en", {
        ...options,
        timeZone: "UTC",
      }).format(date)
    : "Date unavailable";
}
