"use client";
import { useEffect, useRef } from "react";
import type { Candle } from "@/lib/simulation";

// Lightweight custom canvas candlestick chart — strict black, red/green.
// No external chart lib (keeps the exact TradingView-ish aesthetic + tiny bundle).
export default function CandleChart({
  candles,
  tickSize,
  version,
}: {
  candles: Candle[];
  tickSize: number;
  version: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement!;
    const dpr = window.devicePixelRatio || 1;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (w === 0 || h === 0) return;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // pull the Space Mono family from the canvas's computed style (next/font
    // generates a hashed family name, so we can't hardcode "Space Mono")
    const monoFamily =
      getComputedStyle(canvas).fontFamily || "monospace";

    if (candles.length < 2) return;

    const padR = 62,
      padT = 10,
      padB = 18;
    const plotW = w - padR;
    const plotH = h - padT - padB;

    const view = candles.slice(-120);
    let hi = -Infinity,
      lo = Infinity;
    for (const c of view) {
      hi = Math.max(hi, c.h);
      lo = Math.min(lo, c.l);
    }
    const range = hi - lo || 1;
    hi += range * 0.08;
    lo -= range * 0.08;
    const y = (p: number) => padT + ((hi - p) / (hi - lo)) * plotH;
    const n = view.length;
    const cw = plotW / n;
    const bodyW = Math.max(1, Math.min(cw * 0.62, 9));

    // grid + price axis
    ctx.strokeStyle = "#141418";
    ctx.fillStyle = "#5a5a62";
    ctx.font = `10px ${monoFamily}`;
    ctx.textBaseline = "middle";
    const gridN = 5;
    for (let i = 0; i <= gridN; i++) {
      const p = lo + ((hi - lo) * i) / gridN;
      const yy = y(p);
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(plotW, yy);
      ctx.stroke();
      ctx.fillText((p * tickSize).toFixed(2), plotW + 6, yy);
    }

    // candles
    for (let i = 0; i < n; i++) {
      const c = view[i];
      const cx = i * cw + cw / 2;
      const up = c.c >= c.o;
      const col = up ? "#2ebd6b" : "#ef4560";
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      // wick
      ctx.beginPath();
      ctx.moveTo(cx, y(c.h));
      ctx.lineTo(cx, y(c.l));
      ctx.stroke();
      // body
      const yo = y(c.o),
        yc = y(c.c);
      const top = Math.min(yo, yc);
      const bh = Math.max(1, Math.abs(yc - yo));
      ctx.fillRect(cx - bodyW / 2, top, bodyW, bh);
    }

    // last price line
    const last = view[n - 1].c;
    const ly = y(last);
    ctx.strokeStyle = last >= view[n - 1].o ? "#2ebd6b" : "#ef4560";
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(0, ly);
    ctx.lineTo(plotW, ly);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = last >= view[n - 1].o ? "#2ebd6b" : "#ef4560";
    ctx.fillRect(plotW, ly - 8, padR, 16);
    ctx.fillStyle = "#000";
    ctx.fillText((last * tickSize).toFixed(2), plotW + 6, ly);
  }, [candles, tickSize, version]);

  return <canvas ref={ref} />;
}
