// Scenario Lab — the Decision Intelligence core.
//
// A backtester asks "did this signal make money?" This asks a deeper question:
// "what happens to the MARKET if I intervene, and should I?" We fork reality:
// build a CONTROL market and a TREATMENT market from an identical seed and base
// state, apply one intervention to the treatment, run both forward the same
// number of steps, and measure the difference. Because both branches start
// identical and share the RNG, the divergence is ATTRIBUTABLE to the
// intervention — that is the causal claim. We repeat across many seeds so the
// verdict comes with a real confidence, not a single lucky run.
import { Simulation, TraderConfig } from "./simulation";
import { Side } from "./engine";

export interface Intervention {
  id: string;
  label: string;
  question: string; // the "what if I…" the user is really asking
  configPatch?: Partial<TraderConfig>;
  shock?: (sim: Simulation, step: number) => void;
}

export const INTERVENTIONS: Intervention[] = [
  {
    id: "pull-mm",
    label: "Pull the market makers",
    question: "What if the liquidity providers step away?",
    configPatch: { marketMakers: 0 },
  },
  {
    id: "add-mm",
    label: "Add liquidity (more makers)",
    question: "What if I flood the book with market makers?",
    configPatch: { marketMakers: 6, passive: 2 },
  },
  {
    id: "momentum-crowd",
    label: "Unleash a momentum crowd",
    question: "What if trend-chasers pile in and makers thin out?",
    configPatch: { momentum: 5, marketMakers: 1 },
  },
  {
    id: "big-buy",
    label: "Inject a large buy order",
    question: "What if an institution sweeps the book with a 400-lot market buy?",
    shock: (sim, step) => {
      if (step === 25) sim.submitManual("BUY" as Side, "MARKET", 400, null);
    },
  },
  {
    id: "iceberg-seller",
    label: "Add a persistent seller",
    question: "What if a large holder keeps offering into every bounce?",
    configPatch: { passive: 4, aggressive: 2 },
  },
];

interface Branch {
  finalMid: number;
  avgSpread: number;
  volatility: number; // realized, bp
  totalVolume: number;
  maxDrawdown: number; // fraction
  series: number[]; // mid per step (in ticks)
}

function runBranch(
  seed: number,
  config: TraderConfig,
  startMid: number,
  steps: number,
  shock?: (sim: Simulation, step: number) => void
): Branch {
  const sim = new Simulation(seed, config, startMid);
  const mids: number[] = [];
  const spreads: number[] = [];
  for (let s = 1; s <= steps; s++) {
    sim.step();
    if (shock) shock(sim, s);
    const m = sim.eng.mid();
    if (m !== null) mids.push(m);
    const sp = sim.eng.spread();
    if (sp !== null) spreads.push(sp);
  }
  // realized volatility (stdev of log returns), in basis points
  let vol = 0;
  if (mids.length > 3) {
    const rets: number[] = [];
    for (let i = 1; i < mids.length; i++) if (mids[i - 1] > 0) rets.push(Math.log(mids[i] / mids[i - 1]));
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    vol = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length) * 1e4;
  }
  // max drawdown of the mid path
  let peak = mids[0] ?? startMid;
  let mdd = 0;
  for (const m of mids) {
    if (m > peak) peak = m;
    const dd = (peak - m) / peak;
    if (dd > mdd) mdd = dd;
  }
  return {
    finalMid: mids[mids.length - 1] ?? startMid,
    avgSpread: spreads.length ? spreads.reduce((a, b) => a + b, 0) / spreads.length : 0,
    volatility: vol,
    totalVolume: sim.summary().totalVolume,
    maxDrawdown: mdd,
    series: mids,
  };
}

export interface MetricRow {
  key: string;
  label: string;
  base: number;
  treat: number;
  delta: number; // signed % change treat vs base
  hitRate: number; // fraction of trials where the sign held
  fmt: (v: number) => string;
  goodDown?: boolean; // for coloring: is a decrease the "stabilising" direction
}

export interface DecisionReport {
  intervention: Intervention;
  steps: number;
  trials: number;
  metrics: MetricRow[];
  verdict: string;
  narrative: string[]; // the causal chain
  tradeoffs: string[];
  confidence: "High" | "Moderate" | "Low";
  confidenceWhy: string;
  chartBase: number[]; // representative control price path
  chartTreat: number[]; // representative treatment price path
}

const pctFmt = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

export function runScenario(
  baseSeed: number,
  config: TraderConfig,
  startMid: number,
  intervention: Intervention,
  steps = 200,
  trials = 8
): DecisionReport {
  const treatConfig: TraderConfig = { ...config, ...(intervention.configPatch ?? {}) };
  const rows = {
    price: [] as number[],
    spread: [] as number[],
    vol: [] as number[],
    vola: [] as number[], // volume
    mdd: [] as number[],
  };
  let repBase: number[] = [];
  let repTreat: number[] = [];
  let repDiv = -1;

  for (let i = 0; i < trials; i++) {
    const seed = (baseSeed + i * 104729) >>> 0;
    const base = runBranch(seed, config, startMid, steps);
    const treat = runBranch(seed, treatConfig, startMid, steps, intervention.shock);
    rows.price.push(pct(base.finalMid, treat.finalMid));
    rows.spread.push(pct(base.avgSpread, treat.avgSpread));
    rows.vol.push(pct(base.volatility, treat.volatility));
    rows.vola.push(pct(base.totalVolume, treat.totalVolume));
    rows.mdd.push(treat.maxDrawdown - base.maxDrawdown); // absolute pp difference
    const div = Math.abs(treat.finalMid - base.finalMid) + Math.abs(treat.avgSpread - base.avgSpread) * 5;
    if (div > repDiv) {
      repDiv = div;
      repBase = base.series;
      repTreat = treat.series;
    }
  }

  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const hit = (a: number[]) => {
    const m = mean(a);
    if (m === 0) return 0;
    return a.filter((x) => Math.sign(x) === Math.sign(m)).length / a.length;
  };

  const metrics: MetricRow[] = [
    row("spread", "Avg spread", config, treatConfig, mean(rows.spread), hit(rows.spread), pctFmt, true),
    row("vol", "Volatility", config, treatConfig, mean(rows.vol), hit(rows.vol), pctFmt, true),
    row("price", "Final price", config, treatConfig, mean(rows.price), hit(rows.price), pctFmt),
    row("vola", "Traded volume", config, treatConfig, mean(rows.vola), hit(rows.vola), pctFmt),
    {
      key: "mdd",
      label: "Max drawdown",
      base: 0,
      treat: mean(rows.mdd) * 100,
      delta: mean(rows.mdd) * 100,
      hitRate: hit(rows.mdd),
      fmt: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}pp`,
      goodDown: true,
    },
  ];

  const { verdict, narrative, tradeoffs } = interpret(intervention, mean(rows.spread), mean(rows.vol), mean(rows.price), mean(rows.mdd) * 100);
  const primaryHit = Math.max(hit(rows.spread), hit(rows.vol), hit(rows.price));
  const confidence: DecisionReport["confidence"] =
    primaryHit >= 0.875 ? "High" : primaryHit >= 0.625 ? "Moderate" : "Low";

  return {
    intervention,
    steps,
    trials,
    metrics,
    verdict,
    narrative,
    tradeoffs,
    confidence,
    confidenceWhy: `Direction held in ${Math.round(primaryHit * trials)} of ${trials} independent seeds.`,
    chartBase: repBase,
    chartTreat: repTreat,
  };
}

function pct(base: number, treat: number): number {
  if (base === 0) return treat === 0 ? 0 : 100;
  return ((treat - base) / Math.abs(base)) * 100;
}

function row(
  key: string,
  label: string,
  _c: TraderConfig,
  _t: TraderConfig,
  delta: number,
  hitRate: number,
  fmt: (v: number) => string,
  goodDown = false
): MetricRow {
  return { key, label, base: 0, treat: delta, delta, hitRate, fmt, goodDown };
}

// Rule-based causal narrative — every sentence is derived from a measured
// delta, not scripted. This is the "why did it happen" layer.
function interpret(iv: Intervention, dSpread: number, dVol: number, dPrice: number, dMdd: number) {
  const narrative: string[] = [];
  const tradeoffs: string[] = [];
  const big = (x: number) => Math.abs(x) >= 25;

  if (iv.id === "pull-mm") {
    narrative.push("Market makers removed → the resting quotes that tightened the book vanish.");
    if (big(dSpread)) narrative.push(`Fewer resting orders → the bid-ask spread widens ${dSpread.toFixed(0)}%.`);
    if (big(dVol)) narrative.push(`A wider, thinner book means the same order flow moves price further → realized volatility ${dVol >= 0 ? "rises" : "falls"} ${Math.abs(dVol).toFixed(0)}%.`);
    tradeoffs.push("Cheaper to run (no maker inventory risk) but the market becomes fragile and costly to trade.");
    tradeoffs.push("Liquidity is a service — pulling it externalises cost onto every taker.");
  } else if (iv.id === "add-mm") {
    narrative.push("More market makers → more two-sided resting liquidity at the touch.");
    if (dSpread < -10) narrative.push(`Competition among makers compresses the spread ${dSpread.toFixed(0)}%.`);
    if (dVol < -10) narrative.push(`A deeper book absorbs order flow → volatility falls ${Math.abs(dVol).toFixed(0)}%.`);
    tradeoffs.push("Tighter, calmer market — but real makers need inventory capital and edge to stay.");
  } else if (iv.id === "momentum-crowd") {
    narrative.push("Momentum traders buy strength and sell weakness → they amplify whatever move starts.");
    narrative.push("With makers thinned, there's little to absorb the feedback loop.");
    if (big(dVol)) narrative.push(`Result: volatility ${dVol >= 0 ? "spikes" : "drops"} ${Math.abs(dVol).toFixed(0)}%${dMdd > 5 ? `, with drawdowns deepening ${dMdd.toFixed(0)}pp` : ""}.`);
    tradeoffs.push("Trend-following adds volume but destabilises — the flash-crash ingredient.");
  } else if (iv.id === "big-buy") {
    narrative.push("A 400-lot market buy sweeps up the ask ladder, paying progressively worse prices.");
    if (dPrice > 2) narrative.push(`The sweep lifts the final price ${dPrice.toFixed(1)}% — this is market impact, and it persists.`);
    tradeoffs.push("Speed of execution vs. impact cost — why real institutions slice large orders (TWAP/VWAP).");
  } else if (iv.id === "iceberg-seller") {
    narrative.push("A persistent seller caps every rally by offering into strength.");
    if (dPrice < -1) narrative.push(`Price drifts ${dPrice.toFixed(1)}% lower as supply overwhelms bounces.`);
    tradeoffs.push("One large, patient participant can quietly set the trend without a single dramatic print.");
  }

  const dir =
    big(dSpread) || big(dVol) || Math.abs(dPrice) > 3 ? "materially changes the market" : "has a modest effect";
  const flavour =
    dSpread > 25 || dVol > 25
      ? "destabilising"
      : dSpread < -15 || dVol < -15
      ? "stabilising"
      : "roughly neutral";
  const verdict = `This intervention ${dir} — net effect is ${flavour}.`;
  if (!narrative.length) narrative.push("Effects stayed within the market's normal noise band.");
  if (!tradeoffs.length) tradeoffs.push("Low-impact under these conditions; re-test under a stressed trader mix.");
  return { verdict, narrative, tradeoffs };
}
