"use client";

// Tiny dependency-free SVG sparkline. `bipolar` centres the baseline at 0
// (used for order imbalance, which ranges -1..+1).
export default function Sparkline({
  data,
  color = "#16c784",
  height = 34,
  bipolar = false,
}: {
  data: number[];
  color?: string;
  height?: number;
  bipolar?: boolean;
}) {
  const w = 100; // viewBox width; stretched by CSS
  if (data.length < 2) {
    return <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="spark" />;
  }
  const view = data.slice(-80);
  let lo = Math.min(...view);
  let hi = Math.max(...view);
  if (bipolar) {
    const m = Math.max(Math.abs(lo), Math.abs(hi), 0.1);
    lo = -m;
    hi = m;
  }
  const range = hi - lo || 1;
  const n = view.length;
  const x = (i: number) => (i / (n - 1)) * w;
  const y = (v: number) => height - ((v - lo) / range) * height;
  const pts = view.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  const zeroY = bipolar ? y(0) : null;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="spark">
      {zeroY !== null && (
        <line x1="0" y1={zeroY} x2={w} y2={zeroY} stroke="#2a2a30" strokeWidth="0.5" />
      )}
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
