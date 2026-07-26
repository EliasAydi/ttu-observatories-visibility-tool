import * as Astronomy from "astronomy-engine";
import { addDaysToDateString, formatInZone, zonedDateTimeToUtc } from "@/lib/timezone";

export const OBSERVATORIES = {
  skyview: {
    id: "skyview",
    name: "Preston Gott Skyview Observatory",
    shortName: "Skyview Observatory",
    location: "Shallowater, Texas",
    latitude: 33.689,
    longitude: -101.9982,
    elevationMeters: 1010,
    timeZone: "America/Chicago",
  },
  threeRivers: {
    id: "threeRivers",
    name: "3 Rivers Ranch Observatory",
    shortName: "3 Rivers Ranch",
    location: "Crowell, Texas",
    latitude: 33.99243213301273,
    longitude: -99.95481284232942,
    elevationMeters: 500,
    timeZone: "America/Chicago",
  },
} as const;

export type ObservatoryId = keyof typeof OBSERVATORIES;
export type Observatory = (typeof OBSERVATORIES)[ObservatoryId];

// Kept as an export for compatibility with any other code that still imports SKYVIEW.
export const SKYVIEW = OBSERVATORIES.skyview;

export type ChartPoint = {
  timestamp: number;
  targetAltitude: number;
  moonAltitude: number;
  sunAltitude: number;
  airmass: number | null;
};

export type EventTimes = {
  sunset: Date | null;
  sunrise: Date | null;
  civilDusk: Date | null;
  civilDawn: Date | null;
  nauticalDusk: Date | null;
  nauticalDawn: Date | null;
  astronomicalDusk: Date | null;
  astronomicalDawn: Date | null;
  moonrise: Date | null;
  moonset: Date | null;
  targetRise: Date | null;
  targetTransit: Date | null;
  targetSet: Date | null;
};

export type VisibilityResult = {
  current: {
    altitude: number;
    azimuth: number;
    hourAngle: number;
    airmass: number | null;
    moonAltitude: number;
    moonSeparation: number;
  };
  moon: {
    phaseName: string;
    phaseAngle: number;
    illuminatedFraction: number;
    symbol: string;
  };
  events: EventTimes;
  chart: ChartPoint[];
  bestWindow: string;
  targetClass: "Circumpolar" | "Rises and sets" | "Never rises";
  nightStart: Date;
  nightEnd: Date;
};

function astroDate(value: Astronomy.AstroTime | null): Date | null {
  return value?.date ?? null;
}

function duringNight(date: Date | null, nightStart: Date, nightEnd: Date): Date | null {
  if (!date) return null;
  return date >= nightStart && date <= nightEnd ? date : null;
}

function wrap12(hours: number): number {
  let value = ((hours + 12) % 24 + 24) % 24 - 12;
  if (Object.is(value, -0)) value = 0;
  return value;
}

function horizontal(
  body: Astronomy.Body,
  date: Date,
  observer: Astronomy.Observer,
): Astronomy.HorizontalCoordinates {
  const equatorial = Astronomy.Equator(body, date, observer, true, true);
  return Astronomy.Horizon(date, observer, equatorial.ra, equatorial.dec, "normal");
}

export function airmassFromAltitude(altitudeDegrees: number): number | null {
  if (altitudeDegrees <= 0) return null;
  const zenithDistance = 90 - altitudeDegrees;
  const radians = (zenithDistance * Math.PI) / 180;
  return 1 / (Math.cos(radians) + 0.50572 * Math.pow(96.07995 - zenithDistance, -1.6364));
}

function phaseDescription(angle: number): { name: string; symbol: string } {
  if (angle < 11.25 || angle >= 348.75) return { name: "New Moon", symbol: "🌑" };
  if (angle < 78.75) return { name: "Waxing Crescent", symbol: "🌒" };
  if (angle < 101.25) return { name: "First Quarter", symbol: "🌓" };
  if (angle < 168.75) return { name: "Waxing Gibbous", symbol: "🌔" };
  if (angle < 191.25) return { name: "Full Moon", symbol: "🌕" };
  if (angle < 258.75) return { name: "Waning Gibbous", symbol: "🌖" };
  if (angle < 281.25) return { name: "Third Quarter", symbol: "🌗" };
  return { name: "Waning Crescent", symbol: "🌘" };
}

function findWindow(points: ChartPoint[], timeZone: string): string {
  const eligible = points.map((point) =>
    point.sunAltitude <= -18 && point.targetAltitude >= 30 && (point.airmass ?? 99) <= 2,
  );

  let bestStart = -1;
  let bestEnd = -1;
  let runStart = -1;

  for (let index = 0; index <= eligible.length; index += 1) {
    if (eligible[index] && runStart < 0) runStart = index;
    if ((!eligible[index] || index === eligible.length) && runStart >= 0) {
      const end = index - 1;
      if (bestStart < 0 || end - runStart > bestEnd - bestStart) {
        bestStart = runStart;
        bestEnd = end;
      }
      runStart = -1;
    }
  }

  if (bestStart >= 0) {
    const start = new Date(points[bestStart].timestamp);
    const end = new Date(points[bestEnd].timestamp);
    return `${formatInZone(start, timeZone)}–${formatInZone(end, timeZone)}`;
  }

  const darkPoints = points.filter((point) => point.sunAltitude <= -18 && point.targetAltitude > 0);
  if (darkPoints.length === 0) return "No dark-time visibility";

  const best = darkPoints.reduce((highest, point) =>
    point.targetAltitude > highest.targetAltitude ? point : highest,
  );
  return `Best near ${formatInZone(new Date(best.timestamp), timeZone)}`;
}

function classifyTarget(
  decDegrees: number,
  latitude: number,
): "Circumpolar" | "Rises and sets" | "Never rises" {
  const boundary = 90 - Math.abs(latitude);

  if (latitude >= 0) {
    if (decDegrees >= boundary) return "Circumpolar";
    if (decDegrees <= -boundary) return "Never rises";
  } else {
    if (decDegrees <= -boundary) return "Circumpolar";
    if (decDegrees >= boundary) return "Never rises";
  }

  return "Rises and sets";
}

export function calculateVisibility(
  raHours: number,
  decDegrees: number,
  selectedDate: string,
  selectedTime: string,
  observatory: Observatory = SKYVIEW,
): VisibilityResult {
  Astronomy.DefineStar(Astronomy.Body.Star1, raHours, decDegrees, 1000);

  const observer = new Astronomy.Observer(
    observatory.latitude,
    observatory.longitude,
    observatory.elevationMeters,
  );

  const checkTime = zonedDateTimeToUtc(selectedDate, selectedTime, observatory.timeZone);
  const nextDate = addDaysToDateString(selectedDate, 1);
  const nightStart = zonedDateTimeToUtc(selectedDate, "16:00:00", observatory.timeZone);
  const nightEnd = zonedDateTimeToUtc(nextDate, "08:00:00", observatory.timeZone);

  const starEq = Astronomy.Equator(Astronomy.Body.Star1, checkTime, observer, true, true);
  const starHor = Astronomy.Horizon(checkTime, observer, starEq.ra, starEq.dec, "normal");
  const moonEq = Astronomy.Equator(Astronomy.Body.Moon, checkTime, observer, true, true);
  const moonHor = Astronomy.Horizon(checkTime, observer, moonEq.ra, moonEq.dec, "normal");

  const localSiderealTime = (Astronomy.SiderealTime(checkTime) + observatory.longitude / 15 + 24) % 24;
  const hourAngle = wrap12(localSiderealTime - starEq.ra);
  const moonSeparation = Astronomy.AngleBetween(starEq.vec, moonEq.vec);

  const eventStart = nightStart;
  const inSelectedNight = (date: Date | null) => duringNight(date, nightStart, nightEnd);
  const sunset = inSelectedNight(
    astroDate(Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, -1, eventStart, 2, 0)),
  );
  const sunrise = inSelectedNight(
    astroDate(Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, +1, eventStart, 2, 0)),
  );
  const moonrise = inSelectedNight(
    astroDate(Astronomy.SearchRiseSet(Astronomy.Body.Moon, observer, +1, eventStart, 2, 0)),
  );
  const moonset = inSelectedNight(
    astroDate(Astronomy.SearchRiseSet(Astronomy.Body.Moon, observer, -1, eventStart, 2, 0)),
  );
  const targetRise = inSelectedNight(
    astroDate(Astronomy.SearchRiseSet(Astronomy.Body.Star1, observer, +1, eventStart, 2, 0)),
  );
  const targetSet = inSelectedNight(
    astroDate(Astronomy.SearchRiseSet(Astronomy.Body.Star1, observer, -1, eventStart, 2, 0)),
  );
  const transitEvent = Astronomy.SearchHourAngle(Astronomy.Body.Star1, observer, 0, eventStart, +1);
  const targetTransit = inSelectedNight(transitEvent?.time.date ?? null);

  const civilDusk = inSelectedNight(
    astroDate(Astronomy.SearchAltitude(Astronomy.Body.Sun, observer, -1, eventStart, 2, -6)),
  );
  const civilDawn = inSelectedNight(
    astroDate(Astronomy.SearchAltitude(Astronomy.Body.Sun, observer, +1, eventStart, 2, -6)),
  );
  const nauticalDusk = inSelectedNight(
    astroDate(Astronomy.SearchAltitude(Astronomy.Body.Sun, observer, -1, eventStart, 2, -12)),
  );
  const nauticalDawn = inSelectedNight(
    astroDate(Astronomy.SearchAltitude(Astronomy.Body.Sun, observer, +1, eventStart, 2, -12)),
  );
  const astronomicalDusk = inSelectedNight(
    astroDate(Astronomy.SearchAltitude(Astronomy.Body.Sun, observer, -1, eventStart, 2, -18)),
  );
  const astronomicalDawn = inSelectedNight(
    astroDate(Astronomy.SearchAltitude(Astronomy.Body.Sun, observer, +1, eventStart, 2, -18)),
  );

  const chart: ChartPoint[] = [];
  const intervalMs = 10 * 60 * 1000;
  for (let timestamp = nightStart.getTime(); timestamp <= nightEnd.getTime(); timestamp += intervalMs) {
    const date = new Date(timestamp);
    const target = horizontal(Astronomy.Body.Star1, date, observer);
    const moon = horizontal(Astronomy.Body.Moon, date, observer);
    const sun = horizontal(Astronomy.Body.Sun, date, observer);
    chart.push({
      timestamp,
      targetAltitude: Number(target.altitude.toFixed(3)),
      moonAltitude: Number(moon.altitude.toFixed(3)),
      sunAltitude: Number(sun.altitude.toFixed(3)),
      airmass: target.altitude > 0 ? Number((airmassFromAltitude(target.altitude) ?? 0).toFixed(3)) : null,
    });
  }

  const phaseAngle = Astronomy.MoonPhase(checkTime);
  const illumination = Astronomy.Illumination(Astronomy.Body.Moon, checkTime);
  const phase = phaseDescription(phaseAngle);
  const targetClass = classifyTarget(decDegrees, observatory.latitude);

  return {
    current: {
      altitude: starHor.altitude,
      azimuth: starHor.azimuth,
      hourAngle,
      airmass: airmassFromAltitude(starHor.altitude),
      moonAltitude: moonHor.altitude,
      moonSeparation,
    },
    moon: {
      phaseName: phase.name,
      phaseAngle,
      illuminatedFraction: illumination.phase_fraction,
      symbol: phase.symbol,
    },
    events: {
      sunset,
      sunrise,
      civilDusk,
      civilDawn,
      nauticalDusk,
      nauticalDawn,
      astronomicalDusk,
      astronomicalDawn,
      moonrise,
      moonset,
      targetRise,
      targetTransit,
      targetSet,
    },
    chart,
    bestWindow: findWindow(chart, observatory.timeZone),
    targetClass,
    nightStart,
    nightEnd,
  };
}