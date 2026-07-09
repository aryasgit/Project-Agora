"use client";
import { useEffect, useRef } from "react";
import type { DepthSlice } from "@/lib/simulation";

// Bookmap-style liquidity heatmap: time (x) × price (y), color intensity =
// resting volume at that level. Asks burn red above, bids green below, trades
// strike through as white marks, last price traces a hairline. Rendered as an
// offscreen ImageData (1 slice = 1px column) and upscaled with smoothing OFF —
// fast, and the hard pixel grid is the aesthetic.
export default function DepthMap({
  slices,
  tickSize,
  version,
}: {
  slices: DepthSlice[];
  tickSize: number;
  version: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const off = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement!;
    const dpr = window.devicePixelRatio || 1;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (w === 0 || h === 0 || slices.length < 4) return;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    const padR = 62;
    const plotW = w - padR;
    const plotH = h;
    const view = slices.slice(-300);
    const n = view.length;

    // --- price range: cover the visible book, clamped to a sane band -------
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of view) {
      for (const [p] of s.bids) if (p < lo) lo = p;
      for (const [p] of s.asks) if (p > hi) hi = p;
      if (s.last !== null) {
        if (s.last < lo) lo = s.last;
        if (s.last > hi) hi = s.last;
      }
    }
    if (!isFinite(lo) || !isFinite(hi)) return;
    const lastRef = view[n - 1].last ?? Math.round((lo + hi) / 2);
    const MAXROWS = 120;
    if (hi - lo > MAXROWS) {
      lo = lastRef - MAXROWS / 2;
      hi = lastRef + MAXROWS / 2;
    }
    lo -= 2;
    hi += 2;
    const rows = hi - lo + 1;

    // --- max volume for intensity normalisation (log scale) ----------------
    let maxV = 1;
    for (const s of view) {
      for (const [, v] of s.bids) if (v > maxV) maxV = v;
      for (const [, v] of s.asks) if (v > maxV) maxV = v;
    }
    const logMax = Math.log1p(maxV);

    // --- paint the offscreen heat buffer: 1 slice = 1px col, 1 tick = 1px row
    if (!off.current) off.current = document.createElement("canvas");
    const buf = off.current;
    buf.width = n;
    buf.height = rows;
    const bctx = buf.getContext("2d")!;
    const img = bctx.createImageData(n, rows);
    const px = img.data;
    const put = (x: number, p: number, r: number, g: number, b: number, a: number) => {
      const y = hi - p; // top = highest price
      if (y < 0 || y >= rows) return;
      const i = (y * n + x) * 4;
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = a;
    };
    for (let x = 0; x < n; x++) {
      const s = view[x];
      for (const [p, v] of s.asks) {
        const t = Math.log1p(v) / logMax; // 0..1
        put(x, p, 255, 34 + 30 * t, 55 + 20 * t, Math.round(28 + 215 * t));
      }
      for (const [p, v] of s.bids) {
        const t = Math.log1p(v) / logMax;
        put(x, p, 8 + 20 * t, 210, 120 + 15 * t, Math.round(28 + 215 * t));
      }
    }
    bctx.putImageData(img, 0, 0);

    // --- upscale, hard pixels ----------------------------------------------
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, 0, 0, n, rows, 0, 0, plotW, plotH);

    const colW = plotW / n;
    const rowH = plotH / rows;
    const yOf = (p: number) => (hi - p + 0.5) * rowH;

    // --- last-price trace ----------------------------------------------------
    ctx.strokeStyle = "rgba(240,240,244,0.9)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    let started = false;
    for (let x = 0; x < n; x++) {
      const p = view[x].last;
      if (p === null) continue;
      const yy = yOf(p);
      const xx = (x + 0.5) * colW;
      if (!started) {
        ctx.moveTo(xx, yy);
        started = true;
      } else ctx.lineTo(xx, yy);
    }
    ctx.stroke();

    // --- executed trades: white strikes, sized by quantity -------------------
    ctx.fillStyle = "#ffffff";
    for (let x = 0; x < n; x++) {
      for (const [p, q] of view[x].trades) {
        const size = Math.min(4, 1 + Math.log1p(q));
        ctx.fillRect((x + 0.5) * colW - size / 2, yOf(p) - size / 2, size, size);
      }
    }

    // --- price axis ----------------------------------------------------------
    ctx.fillStyle = "#000";
    ctx.fillRect(plotW, 0, padR, plotH);
    ctx.strokeStyle = "#1c1c20";
    ctx.beginPath();
    ctx.moveTo(plotW + 0.5, 0);
    ctx.lineTo(plotW + 0.5, plotH);
    ctx.stroke();
    ctx.fillStyle = "#7c7c86";
    ctx.font = `10px ${getComputedStyle(canvas).fontFamily || "sans-serif"}`;
    ctx.textBaseline = "middle";
    const gridN = 6;
    for (let i = 1; i < gridN; i++) {
      const p = lo + ((hi - lo) * i) / gridN;
      ctx.fillText((p * tickSize).toFixed(2), plotW + 6, (hi - p) * rowH);
    }
    // live last-price tag
    if (view[n - 1].last !== null) {
      const lp = view[n - 1].last!;
      const yy = yOf(lp);
      ctx.fillStyle = "#f23645";
      ctx.fillRect(plotW, yy - 8, padR, 16);
      ctx.fillStyle = "#000";
      ctx.fillText((lp * tickSize).toFixed(2), plotW + 6, yy);
    }
  }, [slices, tickSize, version]);

  return <canvas ref={ref} />;
}
