export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const values: Record<string, number> = {};
  for (const part of partsFormatter(timeZone).formatToParts(date)) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

export function dateStringInZone(date: Date, timeZone: string): string {
  const p = getZonedParts(date, timeZone);
  return `${p.year.toString().padStart(4, "0")}-${p.month.toString().padStart(2, "0")}-${p.day
    .toString()
    .padStart(2, "0")}`;
}

export function timeStringInZone(date: Date, timeZone: string): string {
  const p = getZonedParts(date, timeZone);
  return `${p.hour.toString().padStart(2, "0")}:${p.minute.toString().padStart(2, "0")}`;
}

export function addDaysToDateString(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear().toString().padStart(4, "0")}-${(date.getUTCMonth() + 1)
    .toString()
    .padStart(2, "0")}-${date.getUTCDate().toString().padStart(2, "0")}`;
}

/**
 * Converts a civil date/time in an IANA time zone into a UTC Date.
 * The iterative offset correction avoids relying on the browser's own local zone.
 */
export function zonedDateTimeToUtc(dateString: string, timeString: string, timeZone: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  const [hour, minute, second = 0] = timeString.split(":").map(Number);
  const requestedAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let candidate = requestedAsUtc;

  for (let i = 0; i < 4; i += 1) {
    const p = getZonedParts(new Date(candidate), timeZone);
    const representedAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const correction = requestedAsUtc - representedAsUtc;
    candidate += correction;
    if (correction === 0) break;
  }

  return new Date(candidate);
}

export function formatInZone(
  date: Date | null | undefined,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = {},
): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    ...options,
  }).format(date);
}
