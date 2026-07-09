# DESIGN.md — Agora Console

**Register:** product. **Mandate:** brutal exchange-operations terminal. The tool disappears into the task; the task is watching a market breathe.

## Theme
- **True black everywhere.** `--bg` and `--panel` are both `#000`. Surfaces never tint; separation is 1px hairlines (`--hair #222226`) only. Raised controls may use `--panel-2 #0b0b0c`.
- **Red is the system color** (`--accent #f23645`): brand tick, active tab/preset, selection, halt state, slider thumbs. Green (`#16c784`) is *data only* — bids, up-moves. Red doubles as ask-side data (`#ff3347` bright).
- Text `#f2f2f4`; muted labels `#7c7c86` (≈4.9:1 on black — do not go dimmer on small text).
- One family: **Inter** via `next/font`, tabular numerals (`font-variant-numeric: tabular-nums`) on every numeric readout. No second font, ever.

## Vocabulary
- Panel titles: 10px uppercase, 2px tracking, muted, hairline underline.
- Buttons (`.ctl`, `.tab`, `.preset`, `.seg-btn`): square, hairline border, uppercase, flat. Active = red text on `#0b0b0c`. No radii, no shadows, no gradients.
- Charts are custom `<canvas>`, pure black grounds, hard pixels (`imageSmoothingEnabled = false` on the depth map — the pixel grid is the aesthetic).
- Status strip (26px, bottom): live/halt dot, step, seed, book shape, tape count, latency legend. Terminal signature — keep it.

## Signature visual
The **Depth Map** (Bookmap-style liquidity heatmap): time × price, log-intensity resting volume, asks red / bids green, trades as white strikes, last price as a 1px white trace, live red price tag on the axis. Default chart view. Rendered via offscreen ImageData (1 slice = 1px column) upscaled without smoothing.

## Bans (project-specific)
- No surface tints, glows, glass, or rounded corners.
- No decorative motion; the market ticking IS the motion.
- Green never used for chrome/selection (data only). Red never used for bid-side data.
