"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  Clock3,
  Compass,
  Moon,
  Mountain,
  Orbit,
  Search,
  Sparkles,
  Sun,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  calculateVisibility,
  OBSERVATORIES,
  type Observatory,
  type ObservatoryId,
  type VisibilityResult,
} from "@/lib/astronomy";
import { formatHourAngle, parseDeclination, parseRightAscension } from "@/lib/coordinates";
import { dateStringInZone, formatInZone, timeStringInZone } from "@/lib/timezone";
import targetCatalog from "@/data/targets.json";

type CatalogTarget = {
  id: string;
  name: string;
  aliases: string[];
  ra: string;
  dec: string;
  category: string;
};

const TARGETS = targetCatalog as CatalogTarget[];

function MetricCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500">
        <span>{label}</span>
        <span className="text-[#E90802]">{icon}</span>
      </div>
      <div className="text-2xl font-black tracking-tight text-black">{value}</div>
      {detail ? <div className="mt-1 text-sm text-neutral-500">{detail}</div> : null}
    </div>
  );
}

function EventRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-black/5 py-2.5 last:border-0">
      <span className="text-sm text-neutral-600">{label}</span>
      <span className="text-sm font-bold text-black">{value}</span>
    </div>
  );
}

function visibilitySummary(result: VisibilityResult, observatoryName: string): { title: string; detail: string } {
  const altitude = result.current.altitude;
  if (result.targetClass === "Never rises") {
    return { title: "Not observable", detail: `This declination never rises above the horizon at ${observatoryName}.` };
  }
  if (altitude < 0) return { title: "Below the horizon", detail: "The target is not currently visible." };
  if (altitude < 20) return { title: "Very low", detail: "Strong atmospheric extinction and poor image quality are likely." };
  if (altitude < 30) return { title: "Low", detail: "Observable, but higher altitude would be preferable." };
  if ((result.current.airmass ?? 99) <= 1.5) return { title: "Excellent", detail: "The target is high with low atmospheric path length." };
  if ((result.current.airmass ?? 99) <= 2) return { title: "Good", detail: "Suitable visibility for most observing activities." };
  return { title: "Fair", detail: "The target is visible, with moderate atmospheric attenuation." };
}

function chartTime(timestamp: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function VisibilityTool() {
  const [ra, setRa] = useState("15:59:30.16");
  const [dec, setDec] = useState("+25:55:12.6");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [result, setResult] = useState<VisibilityResult | null>(null);
  const [error, setError] = useState("");
  const [targetQuery, setTargetQuery] = useState("");
  const [targetListOpen, setTargetListOpen] = useState(false);
  const [observatoryId, setObservatoryId] = useState<ObservatoryId>("skyview");

  const observatory = OBSERVATORIES[observatoryId];

  useEffect(() => {
    const now = new Date();
    const initialObservatory = OBSERVATORIES.skyview;
    const initialDate = dateStringInZone(now, initialObservatory.timeZone);
    const initialTime = timeStringInZone(now, initialObservatory.timeZone);
    setDate(initialDate);
    setTime(initialTime);

    try {
      setResult(calculateVisibility(parseRightAscension(ra), parseDeclination(dec), initialDate, initialTime, initialObservatory));
    } catch (initialError) {
      setError(initialError instanceof Error ? initialError.message : "Could not calculate visibility.");
    }
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      setError("");
      setResult(calculateVisibility(parseRightAscension(ra), parseDeclination(dec), date, time, observatory));
    } catch (calculationError) {
      setResult(null);
      setError(calculationError instanceof Error ? calculationError.message : "Could not calculate visibility.");
    }
  }

  function selectObservatory(nextId: ObservatoryId) {
    const nextObservatory = OBSERVATORIES[nextId];
    setObservatoryId(nextId);

    if (date && time) {
      try {
        setError("");
        setResult(
          calculateVisibility(
            parseRightAscension(ra),
            parseDeclination(dec),
            date,
            time,
            nextObservatory,
          ),
        );
      } catch (calculationError) {
        setResult(null);
        setError(calculationError instanceof Error ? calculationError.message : "Could not calculate visibility.");
      }
    }
  }

  function selectCatalogTarget(target: CatalogTarget) {
    setTargetQuery(target.name);
    setTargetListOpen(false);
    setRa(target.ra);
    setDec(target.dec);

    if (date && time) {
      try {
        setError("");
        setResult(calculateVisibility(parseRightAscension(target.ra), parseDeclination(target.dec), date, time, observatory));
      } catch (calculationError) {
        setResult(null);
        setError(calculationError instanceof Error ? calculationError.message : "Could not calculate visibility.");
      }
    }
  }

  const filteredTargets = useMemo(() => {
    const query = targetQuery.trim().toLowerCase();

    if (!query) return TARGETS.slice(0, 12);

    return TARGETS.filter((target) =>
      [target.id, target.name, target.category, ...target.aliases]
        .join(" ")
        .toLowerCase()
        .includes(query),
    ).slice(0, 12);
  }, [targetQuery]);

  const summary = useMemo(() => (result ? visibilitySummary(result, observatory.shortName) : null), [result, observatory.shortName]);
  const eventLines = result
    ? [
        { value: result.events.sunset?.getTime(), label: "Sunset" },
        { value: result.events.astronomicalDusk?.getTime(), label: "Dark" },
        { value: result.events.astronomicalDawn?.getTime(), label: "Dawn" },
        { value: result.events.sunrise?.getTime(), label: "Sunrise" },
      ].filter((event): event is { value: number; label: string } => Boolean(event.value))
    : [];

  return (
    <main className="min-h-screen">
      <header className="border-b-4 border-[#E90802] bg-black text-white">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3 sm:gap-6 sm:px-5 lg:px-8">
          <Image
            src="/physics-astronomy-logo.png"
            alt="Texas Tech University Department of Physics and Astronomy"
            width={220}
            height={210}
            priority
            className="h-auto w-24 justify-self-start object-contain sm:w-15 lg:w-25"
          />

          <div className="text-center">
            <div className="text-xl font-black tracking-tight text-white sm:text-4xl">
              Texas Tech University Observatories
            </div>
            <div className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-[#E90802] sm:text-sm sm:tracking-[0.2em]">
              TTU Physics and Astronomy
            </div>
          </div>

          <Image
            src="/skyview-observatory-logo.png"
            alt="Preston F. Gott Skyview Observatory"
            width={210}
            height={214}
            priority
            className="h-auto w-20 justify-self-end rounded-lg bg-white object-contain sm:w-15 lg:w-25"
          />
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-12">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black tracking-tight text-black sm:text-4xl">
            Astronomical Target Visibility Tool
          </h1>

          <div
            className="mt-6 flex flex-wrap justify-center gap-3"
            role="group"
            aria-label="Select a TTU observatory"
          >
            {(Object.entries(OBSERVATORIES) as [ObservatoryId, Observatory][]).map(([id, site]) => {
              const selected = id === observatoryId;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => selectObservatory(id)}
                  className={`min-w-[250px] rounded-2xl border px-5 py-3 text-center transition ${
                    selected
                      ? "border-[#E90802] bg-[#E90802] text-white shadow-lg shadow-[#E90802]/20"
                      : "border-black/15 bg-white text-black hover:border-[#E90802] hover:text-[#C80702]"
                  }`}
                >
                  <span className="block text-sm font-black">{site.name}</span>
                  <span className={`mt-0.5 block text-xs ${selected ? "text-white/80" : "text-neutral-500"}`}>
                    {site.location}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-neutral-600">
            Select a TTU observatory, then enter J2000 coordinates and an observing time to check altitude,
            azimuth, airmass, twilight, and Moon conditions.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <aside className="h-fit rounded-3xl border border-black/10 bg-white p-5 shadow-xl shadow-black/5 lg:sticky lg:top-5">
            <div className="mb-5 flex items-center gap-2">
              <Orbit className="text-[#E90802]" size={22} />
              <h2 className="text-xl font-black">Target and time</h2>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div className="relative">
                <label htmlFor="popular-target" className="mb-1.5 block text-sm font-bold">
                  Popular target <span className="font-normal text-neutral-500">(optional)</span>
                </label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
                    size={17}
                  />
                  <input
                    id="popular-target"
                    value={targetQuery}
                    onFocus={() => setTargetListOpen(true)}
                    onBlur={() => window.setTimeout(() => setTargetListOpen(false), 150)}
                    onChange={(event) => {
                      setTargetQuery(event.target.value);
                      setTargetListOpen(true);
                    }}
                    placeholder="Search M31, Orion Nebula, Vega..."
                    autoComplete="off"
                    className="w-full rounded-xl border border-black/20 bg-white py-3 pl-10 pr-3.5 outline-none transition focus:border-[#E90802] focus:ring-4 focus:ring-[#E90802]/10"
                  />
                </div>

                {targetListOpen ? (
                  <div className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-black/10 bg-white p-1.5 shadow-2xl shadow-black/15">
                    {filteredTargets.length ? (
                      filteredTargets.map((target) => (
                        <button
                          key={target.id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectCatalogTarget(target)}
                          className="flex w-full items-start justify-between gap-4 rounded-xl px-3 py-2.5 text-left transition hover:bg-[#E90802]/5"
                        >
                          <span>
                            <span className="block text-sm font-black text-black">{target.name}</span>
                            <span className="block text-xs text-neutral-500">{target.category}</span>
                          </span>
                          <span className="shrink-0 text-right font-mono text-[10px] leading-4 text-neutral-400">
                            {target.ra}<br />{target.dec}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-4 text-center text-sm text-neutral-500">
                        No catalog target found. Enter the RA and Dec manually below.
                      </div>
                    )}
                  </div>
                ) : null}

                <span className="mt-1 block text-xs text-neutral-500">
                  Search the local catalog, or enter J2000 coordinates manually.
                </span>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-bold">Right ascension</span>
                <input
                  value={ra}
                  onChange={(event) => {
                    setRa(event.target.value);
                    setTargetQuery("");
                  }}
                  placeholder="15:59:30.16 or 15.9917"
                  className="w-full rounded-xl border border-black/20 bg-white px-3.5 py-3 outline-none transition focus:border-[#E90802] focus:ring-4 focus:ring-[#E90802]/10"
                />
                <span className="mt-1 block text-xs text-neutral-500">HH:MM:SS or decimal hours</span>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-bold">Declination</span>
                <input
                  value={dec}
                  onChange={(event) => {
                    setDec(event.target.value);
                    setTargetQuery("");
                  }}
                  placeholder="+25:55:12.6 or +25.9202"
                  className="w-full rounded-xl border border-black/20 bg-white px-3.5 py-3 outline-none transition focus:border-[#E90802] focus:ring-4 focus:ring-[#E90802]/10"
                />
                <span className="mt-1 block text-xs text-neutral-500">±DD:MM:SS or decimal degrees</span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-sm font-bold"><CalendarDays size={15} /> Date</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className="w-full rounded-xl border border-black/20 px-3 py-3 outline-none transition focus:border-[#E90802] focus:ring-4 focus:ring-[#E90802]/10"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-sm font-bold"><Clock3 size={15} /> Time</span>
                  <input
                    type="time"
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                    className="w-full rounded-xl border border-black/20 px-3 py-3 outline-none transition focus:border-[#E90802] focus:ring-4 focus:ring-[#E90802]/10"
                  />
                </label>
              </div>
              <p className="text-xs text-neutral-500">Times are interpreted in {observatory.timeZone} and automatically account for daylight saving time.</p>

              <button
                type="submit"
                disabled={!date || !time}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E90802] px-4 py-3.5 font-black text-white shadow-lg shadow-[#E90802]/20 transition hover:bg-[#C80702] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Search size={18} /> Check visibility
              </button>
            </form>

            <div className="mt-5 rounded-2xl bg-neutral-100 p-4 text-sm text-neutral-600">
              <div className="mb-2 flex items-center gap-2 font-black text-black"><Mountain size={17} /> Selected observatory</div>
              <span className="font-bold text-black">{observatory.name}</span><br />
              Elevation: {observatory.elevationMeters} m<br />
              Coordinates: {observatory.latitude.toFixed(4)}°, {observatory.longitude.toFixed(4)}°
            </div>
          </aside>

          <div className="space-y-6">
            {error ? (
              <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
                <AlertCircle className="mt-0.5 shrink-0" size={20} />
                <div><div className="font-black">Please check the input</div><div className="text-sm">{error}</div></div>
              </div>
            ) : null}

            {result && summary ? (
              <>
                <section className="overflow-hidden rounded-3xl bg-black text-white shadow-xl shadow-black/10">
                  <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                      <div className="text-sm font-bold uppercase tracking-[0.16em] text-[#E90802]">Visibility at selected time</div>
                      <h2 className="mt-2 text-3xl font-black">{summary.title}</h2>
                      <p className="mt-2 max-w-xl text-neutral-300">{summary.detail}</p>
                    </div>
                    <div className="rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-center">
                      <div className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-400">Best observing window</div>
                      <div className="mt-1 text-xl font-black text-white">{result.bestWindow}</div>
                    </div>
                  </div>
                  <div className="h-1 bg-[#E90802]" />
                </section>

                <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Altitude" value={`${result.current.altitude.toFixed(1)}°`} detail={result.targetClass} icon={<Orbit size={19} />} />
                  <MetricCard label="Azimuth" value={`${result.current.azimuth.toFixed(1)}°`} detail="0° north, 90° east" icon={<Compass size={19} />} />
                  <MetricCard label="Airmass" value={result.current.airmass ? result.current.airmass.toFixed(2) : "—"} detail={result.current.altitude > 0 ? "Kasten–Young estimate" : "Below horizon"} icon={<Mountain size={19} />} />
                  <MetricCard label="Hour angle" value={formatHourAngle(result.current.hourAngle)} detail={result.current.hourAngle < 0 ? "Before transit" : "After transit"} icon={<Clock3 size={19} />} />
                </section>

                <section className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm sm:p-6">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-black">Altitude during the night</h2>
                      <p className="text-sm text-neutral-500">Target and Moon altitude from 4:00 PM to 8:00 AM local time.</p>
                    </div>
                    <div className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-600">Degrees above horizon</div>
                  </div>
                  <div className="h-[360px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={result.chart} margin={{ top: 10, right: 12, left: -12, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                        <XAxis dataKey="timestamp" type="number" domain={[result.nightStart.getTime(), result.nightEnd.getTime()]} tickFormatter={(timestamp) => chartTime(Number(timestamp), observatory.timeZone)} tick={{ fontSize: 12 }} />
                        <YAxis domain={[-20, 90]} tick={{ fontSize: 12 }} unit="°" />
                        <Tooltip labelFormatter={(value) => formatInZone(new Date(Number(value)), observatory.timeZone, { weekday: "short" })} formatter={(value, name) => [`${Number(value).toFixed(1)}°`, name === "targetAltitude" ? "Target" : "Moon"]} />
                        <Legend formatter={(value) => (value === "targetAltitude" ? "Target altitude" : "Moon altitude")} />
                        {eventLines.map((event) => <ReferenceLine key={event.label} x={event.value} stroke="#757575" strokeDasharray="4 4" label={{ value: event.label, position: "insideTop", fontSize: 10 }} />)}
                        <ReferenceLine y={0} stroke="#000000" />
                        <ReferenceLine y={30} stroke="#E90802" strokeDasharray="5 5" label={{ value: "30°", position: "insideTopLeft", fill: "#E90802", fontSize: 11 }} />
                        <Line type="monotone" dataKey="targetAltitude" stroke="#E90802" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
                        <Line type="monotone" dataKey="moonAltitude" stroke="#333333" strokeWidth={2} strokeDasharray="6 4" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm sm:p-6">
                  <div className="mb-5">
                    <h2 className="text-2xl font-black">Airmass during the night</h2>
                    <p className="text-sm text-neutral-500">Lower is better. Airmass 1 is at the zenith; values above 2 are usually less favorable.</p>
                  </div>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={result.chart} margin={{ top: 10, right: 12, left: -12, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                        <XAxis dataKey="timestamp" type="number" domain={[result.nightStart.getTime(), result.nightEnd.getTime()]} tickFormatter={(timestamp) => chartTime(Number(timestamp), observatory.timeZone)} tick={{ fontSize: 12 }} />
                        <YAxis domain={[1, 6]} reversed allowDataOverflow ticks={[1, 2, 3, 4, 5, 6]} tick={{ fontSize: 12 }} />
                        <Tooltip labelFormatter={(value) => formatInZone(new Date(Number(value)), observatory.timeZone, { weekday: "short" })} formatter={(value) => [Number(value).toFixed(2), "Airmass"]} />
                        <ReferenceLine y={2} stroke="#E90802" strokeDasharray="5 5" label={{ value: "Airmass 2", position: "insideTopLeft", fill: "#E90802", fontSize: 11 }} />
                        <Line type="monotone" dataKey="airmass" stroke="#000000" strokeWidth={3} dot={false} connectNulls={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="grid gap-6 xl:grid-cols-3">
                  <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
                    <div className="mb-3 flex items-center gap-2"><Sun className="text-[#E90802]" size={21} /><h3 className="text-lg font-black">Sun and twilight</h3></div>
                    <EventRow label="Sunset" value={formatInZone(result.events.sunset, observatory.timeZone)} />
                    <EventRow label="Civil dusk" value={formatInZone(result.events.civilDusk, observatory.timeZone)} />
                    <EventRow label="Nautical dusk" value={formatInZone(result.events.nauticalDusk, observatory.timeZone)} />
                    <EventRow label="Astronomical dusk" value={formatInZone(result.events.astronomicalDusk, observatory.timeZone)} />
                    <EventRow label="Astronomical dawn" value={formatInZone(result.events.astronomicalDawn, observatory.timeZone)} />
                    <EventRow label="Sunrise" value={formatInZone(result.events.sunrise, observatory.timeZone)} />
                  </div>

                  <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
                    <div className="mb-3 flex items-center gap-2"><Moon className="text-[#E90802]" size={21} /><h3 className="text-lg font-black">Moon conditions</h3></div>
                    <div className="mb-3 flex items-center gap-4 rounded-2xl bg-neutral-100 p-4">
                      <div className="text-4xl">{result.moon.symbol}</div>
                      <div><div className="font-black">{result.moon.phaseName}</div><div className="text-sm text-neutral-500">{(result.moon.illuminatedFraction * 100).toFixed(0)}% illuminated</div></div>
                    </div>
                    <EventRow label="Moonrise" value={formatInZone(result.events.moonrise, observatory.timeZone)} />
                    <EventRow label="Moonset" value={formatInZone(result.events.moonset, observatory.timeZone)} />
                    <EventRow label="Moon altitude" value={`${result.current.moonAltitude.toFixed(1)}°`} />
                    <EventRow label="Target separation" value={`${result.current.moonSeparation.toFixed(1)}°`} />
                  </div>

                  <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
                    <div className="mb-3 flex items-center gap-2"><Orbit className="text-[#E90802]" size={21} /><h3 className="text-lg font-black">Target events</h3></div>
                    <EventRow label="Classification" value={result.targetClass} />
                    <EventRow label="Rise" value={result.targetClass === "Circumpolar" ? "Always above horizon" : formatInZone(result.events.targetRise, observatory.timeZone)} />
                    <EventRow label="Transit" value={formatInZone(result.events.targetTransit, observatory.timeZone)} />
                    <EventRow label="Set" value={result.targetClass === "Circumpolar" ? "Always above horizon" : formatInZone(result.events.targetSet, observatory.timeZone)} />
                    <div className="mt-4 rounded-2xl border-l-4 border-[#E90802] bg-[#E90802]/5 p-3 text-sm text-neutral-700">
                      The preferred observing region is typically altitude ≥30° and airmass ≤2.
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <div className="grid min-h-[420px] place-items-center rounded-3xl border border-dashed border-black/20 bg-white/70 p-8 text-center">
                <div><Orbit className="mx-auto mb-4 text-[#E90802]" size={42} /><h2 className="text-2xl font-black">Enter a target to begin</h2><p className="mt-2 text-neutral-500">The visibility report and nightly plots will appear here.</p></div>
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="mt-8 border-t border-black/10 bg-black px-5 py-7 text-white">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 text-sm text-neutral-400 sm:flex-row">
          <span>TTU Observatories Astronomical Target Visibility Tool.</span>
          <span>For questions contact Dr. Elias Aydi (eaydi@ttu.edu).</span>
        </div>
      </footer>
    </main>
  );
}