function normalizeCoordinateText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/−/g, "-")
    .replace(/[hmsd°′″]/g, ":")
    .replace(/\s+/g, ":")
    .replace(/:+/g, ":")
    .replace(/^:|:$/g, "");
}

function parseSexagesimal(value: string): { sign: number; a: number; b: number; c: number } {
  const normalized = normalizeCoordinateText(value);
  if (!normalized) throw new Error("Coordinate is empty.");

  const sign = normalized.startsWith("-") ? -1 : 1;
  const unsigned = normalized.replace(/^[+-]/, "");
  const parts = unsigned.split(":").filter(Boolean).map(Number);

  if (parts.some((part) => !Number.isFinite(part))) {
    throw new Error(`Could not parse “${value}”.`);
  }

  return { sign, a: parts[0] ?? 0, b: parts[1] ?? 0, c: parts[2] ?? 0 };
}

export function parseRightAscension(value: string): number {
  const text = value.trim().toLowerCase();
  if (/^[+-]?\d+(\.\d+)?$/.test(text)) {
    const decimalHours = Number(text);
    if (decimalHours < 0 || decimalHours >= 24) {
      throw new Error("Right ascension must be between 0 and 24 hours.");
    }
    return decimalHours;
  }

  const { sign, a, b, c } = parseSexagesimal(value);
  if (sign < 0 || b >= 60 || c >= 60 || a >= 24) {
    throw new Error("Use RA as HH:MM:SS or decimal hours from 0 to 24.");
  }
  return a + b / 60 + c / 3600;
}

export function parseDeclination(value: string): number {
  const text = value.trim().toLowerCase();
  if (/^[+-]?\d+(\.\d+)?$/.test(text)) {
    const decimalDegrees = Number(text);
    if (decimalDegrees < -90 || decimalDegrees > 90) {
      throw new Error("Declination must be between −90° and +90°.");
    }
    return decimalDegrees;
  }

  const { sign, a, b, c } = parseSexagesimal(value);
  const degrees = sign * (a + b / 60 + c / 3600);
  if (b >= 60 || c >= 60 || degrees < -90 || degrees > 90) {
    throw new Error("Use declination as ±DD:MM:SS or decimal degrees.");
  }
  return degrees;
}

export function formatHourAngle(hours: number): string {
  const sign = hours < 0 ? "−" : "+";
  const totalMinutes = Math.round(Math.abs(hours) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${sign}${h}h ${m.toString().padStart(2, "0")}m`;
}
