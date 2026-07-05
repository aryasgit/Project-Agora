"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Simulation, Summary, DEFAULT_CONFIG } from "@/lib/simulation";
import type { Trade } from "@/lib/engine";
import CandleChart from "@/components/CandleChart";

const TICK = 0.01;
const fmt = (t: number | null) => (t === null ? "—" : (t * TICK).toFixed(2));

const SPEEDS = [
  { label: "1×", steps: 1 },
  { label: "4×", steps: 4 },
  { label: "16×", steps: 16 },
];

export default function Console() {
  const simRef = useRef<Simulation>(new Simulation(42, DEFAULT_CONFIG));
  const [, force] = useState(0);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const raf = useRef<number | null>(null);
  const prevPrice = useRef<number | null>(null);

  const tick = useCallback(() => {
    const sim = simRef.current;
    for (let i = 0; i < SPEEDS[speed].steps; i++) sim.step();
    force((x) => x + 1);
    raf.current = requestAnimationFrame(tick);
  }, [speed]);

  useEffect(() => {
    if (running) raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [running, tick]);

  const reset = () => {
    const seed = Math.floor(Math.random() * 1e9);
    simRef.current = new Simulation(seed, DEFAULT_CONFIG);
    prevPrice.current = null;
    force((x) => x + 1);
  };

  const sim = simRef.current;
  const s: Summary = sim.summary();
  const depth = sim.depth(11);
  const trades = sim.recentTrades(34);
  const last = s.lastPrice;
  const dir =
    prevPrice.current === null || last === null
      ? 0
      : last > prevPrice.current
      ? 1
      : last < prevPrice.current
      ? -1
      : 0;
  if (last !== null) prevPrice.current = last;

  const maxDepth = Math.max(
    1,
    ...depth.bids.map((d) => d[1]),
    ...depth.asks.map((d) => d[1])
  );

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          AGORA<span className="greek">ἀγορά · exchange console</span>
        </div>
        <div className="ticker">
          <span className="sym">AGORA/USD</span>
          <span className={`px ${dir > 0 ? "up" : dir < 0 ? "down" : ""}`}>{fmt(last)}</span>
        </div>
        <div className="spacer" />
        <div className="controls">
          <div className="speed">
            {SPEEDS.map((sp, i) => (
              <button
                key={sp.label}
                className={`ctl ${i === speed ? "active" : ""}`}
                onClick={() => setSpeed(i)}
              >
                {sp.label}
              </button>
            ))}
          </div>
          <button
            className={`ctl ${running ? "pause" : "run"}`}
            onClick={() => setRunning((r) => !r)}
          >
            {running ? "Pause" : "Run"}
          </button>
          <button className="ctl" onClick={reset}>
            Reseed
          </button>
        </div>
      </div>

      <div className="grid">
        {/* price chart */}
        <div className="panel chart-panel">
          <div className="panel-title">Price · candles (5-step)</div>
          <CandleChart candles={sim.candles} tickSize={TICK} version={sim.eng.step} />
        </div>

        {/* order book */}
        <div className="panel book-panel">
          <div className="panel-title">Order Book · depth</div>
          <div className="ladder">
            {[...depth.asks].reverse().map(([p, v]) => (
              <div className="ladder-row ask" key={`a${p}`}>
                <span className="price">{fmt(p)}</span>
                <span className="qty">{v}</span>
                <span className="cum" />
                <span
                  className="depthbar"
                  style={{ width: `${(v / maxDepth) * 100}%` }}
                />
              </div>
            ))}
            <div className="spread-row">
              SPREAD {s.currentSpread === null ? "—" : (s.currentSpread * TICK).toFixed(2)}
            </div>
            {depth.bids.map(([p, v]) => (
              <div className="ladder-row bid" key={`b${p}`}>
                <span className="price">{fmt(p)}</span>
                <span className="qty">{v}</span>
                <span className="cum" />
                <span
                  className="depthbar"
                  style={{ width: `${(v / maxDepth) * 100}%` }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* trade tape */}
        <div className="panel tape-panel">
          <div className="panel-title">Time &amp; Sales</div>
          <div className="tape">
            {trades.map((t: Trade) => (
              <div className={`tape-row ${t.aggressor === "BUY" ? "buy" : "sell"}`} key={t.seq}>
                <span className="tprice">{fmt(t.price)}</span>
                <span className="tqty">{t.quantity}</span>
                <span className="ttime">#{t.seq}</span>
              </div>
            ))}
          </div>
        </div>

        {/* stats */}
        <div className="panel stats-panel">
          <div className="panel-title">Analytics</div>
          <div className="stats">
            <Stat label="VWAP" value={fmt(s.vwap === null ? null : Math.round(s.vwap))} />
            <Stat label="Volume" value={s.totalVolume.toLocaleString()} />
            <Stat label="Trades" value={s.tradeCount.toLocaleString()} />
            <Stat
              label="Avg Spread"
              value={s.averageSpread === null ? "—" : (s.averageSpread * TICK).toFixed(3)}
            />
            <Stat
              label="Imbalance"
              value={s.orderImbalance === null ? "—" : s.orderImbalance.toFixed(2)}
              cls={s.orderImbalance === null ? "" : s.orderImbalance >= 0 ? "up" : "down"}
            />
            <Stat
              label="Volatility"
              value={s.volatility === null ? "—" : (s.volatility * 1e4).toFixed(1) + "bp"}
            />
            <Stat label="Step" value={sim.eng.step.toLocaleString()} />
            <Stat
              label="Best Bid/Ask"
              value={`${fmt(sim.eng.bestBid())} / ${fmt(sim.eng.bestAsk())}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="stat">
      <span className="label">{label}</span>
      <span className={`value ${cls}`}>{value}</span>
    </div>
  );
}
