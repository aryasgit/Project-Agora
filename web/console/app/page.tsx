"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Summary, PRESETS, TraderConfig } from "@/lib/simulation";
import { World, change } from "@/lib/world";
import type { Trade, Side } from "@/lib/engine";
import CandleChart from "@/components/CandleChart";
import DepthMap from "@/components/DepthMap";
import Sparkline from "@/components/Sparkline";
import OrderTicket from "@/components/OrderTicket";
import TraderControls from "@/components/TraderControls";
import QueuePanel from "@/components/QueuePanel";
import ScenarioLab from "@/components/ScenarioLab";

const TICK = 0.01;
const fmt = (t: number | null) => (t === null ? "—" : (t * TICK).toFixed(2));
const pctFmt = (p: number | null) => (p === null ? "—" : `${p >= 0 ? "+" : ""}${(p * 100).toFixed(2)}%`);

// Slow, watchable speeds — the point is to SEE orders match, not to strobe.
// rate = simulation steps per real second.
const SPEEDS = [
  { label: "0.25×", rate: 1.5 },
  { label: "0.5×", rate: 3 },
  { label: "1×", rate: 6 },
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
  const [speed, setSpeed] = useState(2); // default 1× (slow/watchable)
  const [selected, setSelected] = useState(0);
  const [railOpen, setRailOpen] = useState(true);
  const [myOrderSide, setMyOrderSide] = useState<Side | null>(null);
  const [chartMode, setChartMode] = useState<"map" | "candles">("map");
  const [seed, setSeed] = useState(42);
  const [labOpen, setLabOpen] = useState(false);
  const raf = useRef<number | null>(null);
  const prevPrice = useRef<number | null>(null);
  const acc = useRef(0);
  const lastTs = useRef<number | null>(null);

  useEffect(() => {
    const s = readSeed();
    if (s !== 42) {
      worldRef.current = new World(s);
      setSeed(s);
      force((x) => x + 1);
    }
  }, []);

  // Time-accumulator loop: advance `rate` steps per real second, independent
  // of frame rate. At 0.25× that's ~1.5 steps/sec — slow enough to watch each
  // wave of orders hit the book and match.
  const tick = useCallback(
    (ts: number) => {
      if (lastTs.current === null) lastTs.current = ts;
      const dt = (ts - lastTs.current) / 1000;
      lastTs.current = ts;
      acc.current += dt * SPEEDS[speed].rate;
      let ran = 0;
      while (acc.current >= 1 && ran < 40) {
        worldRef.current.step(1);
        acc.current -= 1;
        ran++;
      }
      if (ran > 0) force((x) => x + 1);
      raf.current = requestAnimationFrame(tick);
    },
    [speed]
  );

  useEffect(() => {
    if (running) {
      lastTs.current = null;
      acc.current = 0;
      raf.current = requestAnimationFrame(tick);
    }
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [running, tick]);

  const reseed = useCallback(() => {
    const s = Math.floor(Math.random() * 1e9);
    worldRef.current = new World(s);
    setSeed(s);
    prevPrice.current = null;
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("seed", String(s));
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
  const st = sim.eng.stats;
  const fillRate = sim.eng.fillRate();
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
        <button className="ctl lab-open" onClick={() => setLabOpen(true)}>
          ⑂ Scenario Lab
        </button>
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
              <span className="chart-tabs">
                <button
                  className={`tab ${chartMode === "map" ? "on" : ""}`}
                  onClick={() => setChartMode("map")}
                >
                  Depth Map
                </button>
                <button
                  className={`tab ${chartMode === "candles" ? "on" : ""}`}
                  onClick={() => setChartMode("candles")}
                >
                  Candles
                </button>
              </span>
            </div>
            {chartMode === "map" ? (
              <DepthMap slices={sim.depthHist} tickSize={TICK} version={sim.eng.step} />
            ) : (
              <CandleChart candles={sim.candles} tickSize={TICK} version={sim.eng.step} />
            )}
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
            <div className="panel-title">
              <span>Execution Log</span>
              <span className="col-key">px · size · side</span>
            </div>
            {/* order-flow summary — the completion tally */}
            <div className="oflow">
              <OFlow label="Filled" v={st.fullyFilled} cls="up" />
              <OFlow label="Partial" v={st.partiallyFilled} />
              <OFlow label="Resting" v={st.restedNoFill} />
              <OFlow label="Cancel" v={st.cancelled} cls="down" />
            </div>
            <div className="log-head">
              <span>PRICE</span>
              <span>SIZE</span>
              <span>SIDE</span>
              <span>SEQ</span>
            </div>
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
                  <span className="tside">{t.aggressor === "BUY" ? "BUY" : "SELL"}</span>
                  <span className="ttime">#{t.seq}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel stats-panel">
            <div className="panel-title">Key Metrics</div>
            <div className="kpis">
              <Kpi label="Last" value={fmt(last)} cls={dir > 0 ? "up" : dir < 0 ? "down" : ""} />
              <Kpi label="VWAP" value={fmt(s.vwap === null ? null : Math.round(s.vwap))} />
              <Kpi
                label="Spread"
                value={s.currentSpread === null ? "—" : (s.currentSpread * TICK).toFixed(2)}
              />
              <Kpi
                label="Volatility"
                value={s.volatility === null ? "—" : (s.volatility * 1e4).toFixed(1) + "bp"}
              />
              <Kpi label="Orders" value={st.submitted.toLocaleString()} sub="processed" />
              <Kpi label="Fill Rate" value={(fillRate * 100).toFixed(1) + "%"} sub="vol matched" />
              <Kpi label="Matched" value={st.matchedVolume.toLocaleString()} sub="lots" />
              <Kpi label="Trades" value={s.tradeCount.toLocaleString()} sub="prints" />
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
                  color={s.orderImbalance && s.orderImbalance < 0 ? "#ff3347" : "#16c784"}
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
                setMyOrderSide(r.resting > 0 ? side : null);
                force((x) => x + 1);
                return r;
              }}
            />
            <div className="panel-subtitle">Your Queue Position</div>
            <QueuePanel q={sim.myQueue()} side={myOrderSide} />
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

      {/* terminal status strip */}
      <div className="statusbar">
        <span className={running ? "sb-live" : "sb-halt"}>{running ? "● LIVE" : "■ HALTED"}</span>
        <span>STEP {sim.eng.step.toLocaleString()}</span>
        <span>SEED {seed}</span>
        <span>BOOK {depth.bids.length}×{depth.asks.length} LVLS</span>
        <span>TAPE {s.tradeCount.toLocaleString()} FILLS</span>
        <span className="sb-right">
          LATENCY MM 10 · INST 20 · MOM 30 · MR 40 · NSE 90 · PSV 120 · ENGINE ~95K ORD/S
        </span>
      </div>

      {labOpen && (
        <ScenarioLab
          symbol={market.spec.symbol}
          config={market.config}
          startMid={market.spec.startMid}
          seed={seed}
          onClose={() => setLabOpen(false)}
        />
      )}
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

function Kpi({ label, value, sub, cls = "" }: { label: string; value: string; sub?: string; cls?: string }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <span className={`kpi-value ${cls}`}>{value}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  );
}

function OFlow({ label, v, cls = "" }: { label: string; v: number; cls?: string }) {
  return (
    <div className="of-cell">
      <span className={`of-num ${cls}`}>{v.toLocaleString()}</span>
      <span className="of-label">{label}</span>
    </div>
  );
}
