# Preston Gott Skyview Observatory Visibility Tool

A TTU-themed observing-planner prototype for students. It calculates target altitude, azimuth, hour angle, airmass, target rise/transit/set times, Sun and twilight times, Moon rise/set, lunar phase, Moon altitude, and Moon-target angular separation.

## Technology

- Next.js App Router
- TypeScript and React
- Tailwind CSS
- Astronomy Engine
- Recharts
- Vercel-ready deployment

## Observatory configuration

The current location is fixed in `src/lib/astronomy.ts`:

- Latitude: `33.6890°`
- Longitude: `-101.9982°`
- Elevation: `1010 m`
- Time zone: `America/Chicago`

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Build check

```bash
npm run lint
npm run build
```

## Publish

1. Create a GitHub repository.
2. Push this project to the repository.
3. Import the repository into Vercel.
4. Deploy using the default Next.js settings.
5. Add the purchased domain in Vercel project settings.

## Important validation step

Before public launch, compare a set of targets and dates against the original Astropy script. Suggested cases:

- T CrB at the date/time from the original Python example.
- A target close to the northern circumpolar limit.
- A target that never rises from Skyview.
- Dates immediately before and after daylight-saving transitions.
- A Moon rise/set event near local midnight.

## Planned additions

- Object-name lookup using SIMBAD.
- Weather and cloud forecast.
- Observatory horizon/obstruction mask.
- Saved target lists and shareable URLs.
- Exportable observing plan.
- Optional instrument limits for each Skyview telescope.

## Branding

The prototype uses official TTU web colors:

- Scarlet: `#E90802`
- Black: `#000000`
- White: `#FFFFFF`
- Light gray: `#EDEDED`
- Dark gray: `#333333`
- Medium gray: `#757575`

No official TTU logo file is bundled. Add only an approved university asset before launch.
