# København · walking guide

**▶ Live site: https://sirsirio.github.io/CopenhagenTours/**

A mobile-first, dark-themed guide to Copenhagen: six colour-coded walking tours ("lines"), an interactive
map, a sortable list of cheap-but-good restaurants, a list of cheap bars, and a plan for the big day.

Static site — no build step. Hosted on GitHub Pages.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Shell: top bar, tab bar, empty view containers |
| `styles.css` | The whole design (dark "metro wayfinding" theme, one colour per line) |
| `app.js` | Hash router, rendering, Leaflet map, filters. You rarely need to touch this |
| `data.js` | **All content lives here** — trip config, places, tours, restaurants, bars, defence-day plan, info |
| `sw.js` | Service worker so the site opens offline (map tiles still need network) |
| `manifest.webmanifest` | Lets you "Add to Home Screen" as an app |

## Reusing it for the next visit (friends edition)

Everything you'd want to change is in `data.js`:

1. `DATA.trip` — edition name, dates, who's coming, the three-day strip on the home page, footer.
2. `DATA.defence` — the "big day" page. For a friends trip you can either repurpose it (e.g. a birthday
   dinner) or remove the callout by deleting `DATA.trip.bigDay` usage in `app.js` (`renderHome`).
3. `DATA.tours` — each tour is a list of `stops`. A stop is `{ place: 'place-id', note, tip, minutes, eat?, optional?, transit? }`.
   Place ids refer to `DATA.places`, which holds names, coordinates, blurbs, opening hours and prices.
4. `DATA.restaurants` / `DATA.bars` — each entry points at a place id and adds price band, type, area, hours.

Add a new place: give it an id in `DATA.places` with `lat`/`lng` (right-click in Google Maps → copy
coordinates), then reference it from a tour, the restaurant list or the bar list.

After editing, bump `VERSION` in `sw.js` so phones that installed the site fetch the new files.

## Running locally

Any static server works, e.g. `python -m http.server 8000` then open http://localhost:8000.
(Opening `index.html` directly from disk also works, just without the service worker.)

## Deploying

Push to `main`; GitHub Pages serves the root of the repo. Nothing to build.
