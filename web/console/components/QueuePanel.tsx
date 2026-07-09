"use client";
import type { QueuePosition } from "@/lib/engine";
import type { Side } from "@/lib/engine";

const TICK = 0.01;

// Shows where the user's resting order stands in the FIFO queue at its price —
// the quantity that actually governs fill probability. Empty until you place a
// limit order that rests (doesn't fully fill on arrival).
export default function QueuePanel({ q, side }: { q: QueuePosition | null; side: Side | null }) {
  if (!q) {
    return (
      <div className="queue empty">
        Place a resting limit order to see your <b>queue position</b> — the lots ahead of you decide
        when you fill.
      </div>
    );
  }
  const aheadPct = q.volumeAhead / Math.max(1, q.volumeAhead + q.ownRemaining + q.volumeBehind);
  const ownPct = q.ownRemaining / Math.max(1, q.volumeAhead + q.ownRemaining + q.volumeBehind);
  return (
    <div className="queue">
      <div className="q-head">
        <span className={`q-side ${side === "SELL" ? "down" : "up"}`}>YOU</span>
        <span>
          @ {(q.price * TICK).toFixed(2)} · rank <b>#{q.rank}</b> of {q.totalOrders}
        </span>
      </div>
      <div className="q-bar" title="ahead · you · behind">
        <span className="q-ahead" style={{ width: `${aheadPct * 100}%` }} />
        <span className="q-own" style={{ width: `${ownPct * 100}%` }} />
      </div>
      <div className="q-stats">
        <div>
          <span className="q-num">{q.volumeAhead}</span>
          <span className="q-lbl">lots ahead</span>
        </div>
        <div>
          <span className="q-num">{q.ownRemaining}</span>
          <span className="q-lbl">yours</span>
        </div>
        <div>
          <span className="q-num">{q.volumeBehind}</span>
          <span className="q-lbl">behind</span>
        </div>
      </div>
    </div>
  );
}
