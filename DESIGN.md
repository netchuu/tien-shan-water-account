# Design: Tien Shan Water Account

Locked on 2026-11-14. The look below is fixed. Later work changes functionality and content only.

Canvas with every screen: https://claude.ai/artifact/S2uch14eu5CQqYn1sS7g3D
Source copies of the screens: `design/canvas/` (the `G*.dc.html` files are the chosen direction).

## Direction

"Control room": the board a dam dispatcher would read. Dark, dense, condensed type, no decoration.
It was chosen from ten directions (A to J on the canvas). The other nine are kept for reference only.

## Colour

| Role | Hex | Use |
|---|---|---|
| Ground | `#142230` | Page background |
| Panel | `#1D3144` | Tiles, table blocks, side panels |
| Text | `#EAF0F5` | Main text; also the fill of a selected button and of the note strip |
| Muted text | `#B9C7D3` | Captions, units, axis labels |
| Rule, strong | `#5B7186` | Table header rule |
| Rule, soft | `#34495D` | Row rules |
| Outline | `#7F93A5` | Unselected button border, raw data line, dashed "not proven" border |
| Rising | `#8FC3FF` | A proven rising trend: figure, trend line, filled cell |
| Falling | `#FFB866` | A proven falling trend: figure, trend line, filled cell |

Rules:
- Blue and amber mean direction, never decoration. Do not use them for anything else.
- Text on a blue or amber fill is `#142230`.
- A trend that is not proven gets no colour: plain text, a dashed outline, a dashed grey trend line.
- Direction is always also written in words ("rising, proven"), so colour is never the only signal.

## Type

One family: **Sofia Sans Condensed** (Google Fonts, weights 400, 600, 800; it has Cyrillic). Fallback: `'Arial Narrow', sans-serif`.

| Use | Size | Weight |
|---|---|---|
| Hero figure | 78–96px, line-height 0.9–0.95 | 800 |
| Screen title | 26–28px | 800 |
| Panel title | 20–22px | 600 |
| Tile figure | 30–34px | 800 |
| Body and table text | 19–21px | 400 or 600 |
| Captions | 16–18px, muted | 400 |

Numbers use `font-variant-numeric: tabular-nums`. Sentence case everywhere. No all-caps labels.

## Shape and spacing

- Corners: 3px on buttons and the note strip, 0 on panels.
- No shadows, no gradients, no icons, no emoji.
- Screen padding 20–24px. Gap between panels 12px. Panel padding 14–18px.
- Buttons are at least 44px tall. Selected: text-colour fill with ground-colour text, weight 800. Unselected: transparent with the outline border.

## Charts

- Yearly values: thin line in the outline colour, 1.25–1.5px.
- Trend: 3–3.5px line, blue if rising and proven, amber if falling and proven, dashed outline colour if not proven.
- Stripes: one block per year, from amber (least) through `#2A3F54` (middle) to blue (most), scaled within each basin's own record.
- Every chart has a text label for screen readers that says what it shows and which way it goes.

## Wording

- A finding is a sentence: "Snow depth is rising by 0.20 cm per decade. Proven."
- Verdict words: "proven" and "not proven". The test result is given as "p = 0.048" or "p below 0.001".
- No middle dots, arrows, or dash-joined labels.
- Every number on screen comes from the calculation. Missing data is a bracketed placeholder such as `[CHU DATA NOT LOADED YET]`.
- The limits stay on screen: past trend, not a forecast; model data; no glaciers in the model.

## Screens available

| File | Screen | Intended use |
|---|---|---|
| `G-ControlRoom` | Two basin tiles and one variable table | The original direction |
| `G1-WallBoard` | One basin in depth | Detail view |
| `G2-BasinMatrix` | Every basin against every variable | Overview |
| `G3-StripesConsole` | Two bands of yearly stripes | Opposite trends at a glance |
| `G4-ShiftLog` | Findings as sentences with a role switch | Text view |
| `G5-PhoneConsole` | One basin, stacked | Phone layout |

Which screens the app uses, and how they connect, is a functionality decision and is still open.

## Data

The mock-ups on the canvas use stand-in NASA POWER figures for 1981–2025. The built site (`index.html`) uses NASA POWER basin means for 1981–2025 and Giovanni basin averages for 2000–2025, and the findings differ from the mock-ups. Every label on the site is generated from the calculation, so do not copy text from the mock-ups.
