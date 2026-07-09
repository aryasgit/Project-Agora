"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Summary, PRESETS, TraderConfig } from "@/lib/simulation";
import { World, change } from "@/lib/world";
import type { Trade } from "@/lib/engine";
import CandleChart from "@/components/CandleChart";
import Sparkline from "@/components/Sparkline";
import OrderTicket from "@/components/OrderTicket";
import TraderControls from "@/components/TraderControls";

const TICK = 0.01;
const fmt = (t: number | null) => (t === null ? "—" : (t * TICK).toFixed(2));
const pctFmt = (p: number | null) => (p === null ? "—" : `${p >= 0 ? "+" : ""}${(p * 100).toFixed(2)}%`);

const SPEEDS = [
  { label: "1×", steps: 1 },
  { label: "4×", steps: 4 },
  { label: "16×", steps: 16 },
];

function readSeed(): number {
  if (typeof window === "undefined") return 42;
  const p = new URLSearchParams(window.location.search).get("seed");
  const n = p ? parseInt(p) : NaN;
  return isNaN(n) ? 42 : n;
}

export default function Console() {
  const worldRef = useRef<World>(new World(42));
  const [, force] = useState(0);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [selected, setSelected] = useState(0);
  const [railOpen, setRailOpen] = useState(true);
  const raf = useRef<number | null>(null);
  const prevPrice = useRef<number | null>(null);

  useEffect(() => {
    const seed = readSeed();
    if (seed !== 42) {
      worldRef.current = new World(seed);
      force((x) => x + 1);
    }
  }, []);

  const tick = useCallback(() => {
    worldRef.current.step(SPEEDS[speed].steps);
    force((x) => x + 1);
    raf.current = requestAnimationFrame(tick);
  }, [speed]);

  useEffect(() => {
    if (running) raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [running, tick]);

  const reseed = useCallback(() => {
    const seed = Math.floor(Math.random() * 1e9);
    worldRef.current = new World(seed);
    prevPrice.current = null;
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("seed", String(seed));
      window.history.replaceState({}, "", url);
    }
    force((x) => x + 1);
  }, []);

  const stepOnce = useCallback(() => {
    worldRef.current.step(1);
    force((x) => x + 1);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space") {
        e.preventDefault();
        setRunning((r) => !r);
      } else if (e.code === "ArrowRight") {
        setRunning(false);
        stepOnce();
      } else if (e.key === "r") {
        reseed();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reseed, stepOnce]);

  const world = worldRef.current;
  const market = world.markets[selected];
  const sim = market.sim;

  const applyPreset = (name: string) => {
    const p = PRESETS.find((x) => x.name === name);
    if (!p) return;
    sim.applyConfig(p.config);
    market.config = p.config;
    market.preset = name;
    force((x) => x + 1);
  };

  const changeConfig = (next: TraderConfig) => {
    sim.applyConfig(next);
    market.config = next;
    market.preset = null;
    force((x) => x + 1);
  };

  const s: Summary = sim.summary();
  const depth = sim.depthCumulative(11);
  const trades = sim.recentTrades(30);
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

  const maxCum = Math.max(1, ...depth.bids.map((d) => d.cum), ...depth.asks.map((d) => d.cum));

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          AGORA<span className="greek">ἀγορά · exchange console</span>
        </div>
        <div className="ticker">
          <span className="sym">{market.spec.symbol}/USD</span>
          <span className={`px ${dir > 0 ? "up" : dir < 0 ? "down" : ""}`}>{fmt(last)}</span>
        </div>
        <div className="spacer" />
        <span className="kbd-hint">space pause · → step · r reseed</span>
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
          <button className={`ctl ${running ? "pause" : "run"}`} onClick={() => setRunning((r) => !r)}>
            {running ? "Pause" : "Run"}
          </button>
          <button className="ctl" onClick={reseed}>
            Reseed
          </button>
          <button
            className={`ctl ${railOpen ? "active" : ""}`}
            onClick={() => setRailOpen((o) => !o)}
            title="Toggle instrument panel"
          >
            {railOpen ? "Panel ›" : "‹ Panel"}
          </button>
        </div>
      </div>

      {/* multi-asset watchlist / symbol switcher */}
      <div className="watchlist">
        {world.markets.map((m, i) => {
          const c = change(m);
          return (
            <button
              key={m.spec.symbol}
              className={`watch ${i === selected ? "on" : ""}`}
              onClick={() => {
                setSelected(i);
                prevPrice.current = null;
              }}
            >
              <span className="w-sym">{m.spec.symbol}</span>
              <span className="w-kind">{m.spec.kind}</span>
              <span className="w-px">{fmt(c.last)}</span>
              <span className={`w-chg ${c.pct !== null && c.pct < 0 ? "down" : "up"}`}>
                {pctFmt(c.pct)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="body">
        <div className="grid">
          <div className="panel chart-panel">
            <div className="panel-title">
              <span>
                {market.spec.name} · {market.spec.symbol}
              </span>
              <span className="col-key">candles · 5-step</span>
            </div>
            <CandleChart candles={sim.candles} tickSize={TICK} version={sim.eng.step} />
          </div>

          <div className="panel book-panel">
            <div className="panel-title">
              <span>Order Book · depth</span>
              <span className="col-key">px · size · cum</span>
            </div>
            <div className="ladder">
              {[...depth.asks].reverse().map((r) => (
                <div className="ladder-row ask" key={`a${r.price}`}>
                  <span className="price">{fmt(r.price)}</span>
                  <span className="qty">{r.volume}</span>
                  <span className="cum">{r.cum}</span>
                  <span className="depthbar" style={{ width: `${(r.cum / maxCum) * 100}%` }} />
                </div>
              ))}
              <div className="spread-row">
                SPREAD {s.currentSpread === null ? "—" : (s.currentSpread * TICK).toFixed(2)}
              </div>
              {depth.bids.map((r) => (
                <div className="ladder-row bid" key={`b${r.price}`}>
                  <span className="price">{fmt(r.price)}</span>
                  <span className="qty">{r.volume}</span>
                  <span className="cum">{r.cum}</span>
                  <span className="depthbar" style={{ width: `${(r.cum / maxCum) * 100}%` }} />
                </div>
              ))}
            </div>
          </div>

          <div className="panel tape-panel">
            <div className="panel-title">Time &amp; Sales</div>
            <div className="tape">
              {trades.map((t: Trade) => (
                <div
                  className={`tape-row ${t.aggressor === "BUY" ? "buy" : "sell"} ${
                    t.takerTrader === "YOU" || t.makerTrader === "YOU" ? "mine" : ""
                  }`}
                  key={t.seq}
                >
                  <span className="tprice">{fmt(t.price)}</span>
                  <span className="tqty">{t.quantity}</span>
                  <span className="ttime">#{t.seq}</span>
                </div>
              ))}
            </div>
          </div>

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
                label="Volatility"
                value={s.volatility === null ? "—" : (s.volatility * 1e4).toFixed(1) + "bp"}
              />
              <Stat label="Step" value={sim.eng.step.toLocaleString()} />
            </div>
            <div className="sparks">
              <div className="spark-tile">
                <div className="spark-head">
                  <span>Spread</span>
                  <span>{s.currentSpread === null ? "—" : (s.currentSpread * TICK).toFixed(2)}</span>
                </div>
                <Sparkline data={sim.spreadHist} color="#8a8a94" />
              </div>
              <div className="spark-tile">
                <div className="spark-head">
                  <span>Imbalance</span>
                  <span className={s.orderImbalance && s.orderImbalance < 0 ? "down" : "up"}>
                    {s.orderImbalance === null ? "—" : s.orderImbalance.toFixed(2)}
                  </span>
                </div>
                <Sparkline
                  data={sim.imbalanceHist}
                  bipolar
                  color={s.orderImbalance && s.orderImbalance < 0 ? "#ef4560" : "#2ebd6b"}
                />
              </div>
            </div>
          </div>
        </div>

        <aside className={`rail ${railOpen ? "" : "rail-collapsed"}`} aria-hidden={!railOpen}>
          <div className="panel">
            <div className="panel-title">Order Ticket · {market.spec.symbol}</div>
            <OrderTicket
              refPrice={sim.eng.marketPrice()}
              onSubmit={(side, type, qty, price) => {
                const r = sim.submitManual(side, type, qty, price);
                force((x) => x + 1);
                return r;
              }}
            />
          </div>
          <div className="panel rail-mix">
            <div className="panel-title">Trader Mix · scenarios</div>
            <TraderControls
              config={market.config}
              activePreset={market.preset}
              onPreset={applyPreset}
              onChange={changeConfig}
            />
          </div>
        </aside>
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
