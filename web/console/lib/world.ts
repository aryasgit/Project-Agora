// Multi-asset layer (Module 10): several instruments, each with its own
// independent order book, matching engine, and trader population. The World
// steps them all every frame so the watchlist stays live even for symbols you
// aren't currently viewing. Reinforces the core lesson — the matching engine is
// instrument-agnostic; only the contract's character (price level, trader mix)
// differs.
import { Simulation, TraderConfig } from "./simulation";

export interface InstrumentSpec {
  symbol: string;
  name: string;
  kind: string; // display tag: large-cap / small-cap / ETF …
  startMid: number; // starting mid in TICKS ($ = ticks * 0.01)
  config: TraderConfig;
}

// Distinct regimes so the assets *feel* different, not just relabelled.
export const INSTRUMENTS: InstrumentSpec[] = [
  {
    symbol: "AGORA",
    name: "Agora Composite",
    kind: "index",
    startMid: 5000, // $50.00
    config: { marketMakers: 2, noise: 3, momentum: 1, meanReversion: 1, aggressive: 1, passive: 1 },
  },
  {
    symbol: "TITAN",
    name: "Titan Industries",
    kind: "large-cap",
    startMid: 12850, // $128.50 — deep, calm, tight spreads
    config: { marketMakers: 4, noise: 3, momentum: 0, meanReversion: 2, aggressive: 0, passive: 2 },
  },
  {
    symbol: "NOVA",
    name: "Nova Dynamics",
    kind: "small-cap",
    startMid: 840, // $8.40 — thin, jumpy, momentum-driven
    config: { marketMakers: 1, noise: 2, momentum: 3, meanReversion: 0, aggressive: 2, passive: 0 },
  },
  {
    symbol: "HELIX",
    name: "Helix Sector ETF",
    kind: "ETF",
    startMid: 31500, // $315.00 — steady basket
    config: { marketMakers: 3, noise: 2, momentum: 1, meanReversion: 2, aggressive: 1, passive: 1 },
  },
];

export interface Market {
  spec: InstrumentSpec;
  sim: Simulation;
  config: TraderConfig;
  preset: string | null;
}

export class World {
  markets: Market[];

  constructor(seed: number) {
    this.markets = INSTRUMENTS.map((spec, i) => ({
      spec,
      // distinct seed per instrument so they don't move in lockstep
      sim: new Simulation(seed + i * 7919, spec.config, spec.startMid),
      config: { ...spec.config },
      preset: null,
    }));
  }

  step(steps: number) {
    for (let s = 0; s < steps; s++) {
      for (const m of this.markets) m.sim.step();
    }
  }
}

// last price + % change vs the instrument's opening mid (for the watchlist).
export function change(m: Market): { last: number | null; pct: number | null } {
  const last = m.sim.eng.lastPrice;
  if (last === null) return { last: null, pct: null };
  return { last, pct: (last - m.spec.startMid) / m.spec.startMid };
}
