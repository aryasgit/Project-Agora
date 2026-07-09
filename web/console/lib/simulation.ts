// Simulation driver + analytics for the live console. Mirrors engine/agora.
import { MatchingEngine, Order, Side, Trade } from "./engine";
import {
  AggressiveBuyer,
  MarketMaker,
  MeanReversionTrader,
  MomentumTrader,
  PassiveSeller,
  RandomTrader,
  Trader,
  makeRng,
} from "./traders";

export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface Summary {
  lastPrice: number | null;
  vwap: number | null;
  totalVolume: number;
  tradeCount: number;
  currentSpread: number | null;
  averageSpread: number | null;
  orderImbalance: number | null;
  volatility: number | null;
}

export interface TraderConfig {
  marketMakers: number;
  noise: number;
  momentum: number;
  meanReversion: number;
  aggressive: number;
  passive: number;
}

export const DEFAULT_CONFIG: TraderConfig = {
  marketMakers: 2,
  noise: 3,
  momentum: 1,
  meanReversion: 1,
  aggressive: 1,
  passive: 1,
};

// Scenario presets — each is a trader mix that produces a recognisable regime.
export const PRESETS: { name: string; blurb: string; config: TraderConfig }[] = [
  {
    name: "Balanced",
    blurb: "Healthy two-sided market",
    config: DEFAULT_CONFIG,
  },
  {
    name: "Calm",
    blurb: "Deep liquidity, tight spreads",
    config: { marketMakers: 4, noise: 3, momentum: 0, meanReversion: 2, aggressive: 0, passive: 2 },
  },
  {
    name: "Flash Crash",
    blurb: "Momentum dominates, MMs thin out",
    config: { marketMakers: 1, noise: 2, momentum: 5, meanReversion: 0, aggressive: 3, passive: 0 },
  },
  {
    name: "Liquidity Crisis",
    blurb: "Providers gone, takers remain",
    config: { marketMakers: 0, noise: 2, momentum: 2, meanReversion: 0, aggressive: 3, passive: 0 },
  },
];

export const TRADER_META: { key: keyof TraderConfig; label: string; hint: string }[] = [
  { key: "marketMakers", label: "Market Makers", hint: "Post two-sided quotes; provide liquidity" },
  { key: "noise", label: "Noise Traders", hint: "Random uninformed flow" },
  { key: "momentum", label: "Momentum", hint: "Chase trends; amplify moves" },
  { key: "meanReversion", label: "Mean Reversion", hint: "Fade extremes; stabilise" },
  { key: "aggressive", label: "Aggressive Buyers", hint: "Large market buys; cause impact" },
  { key: "passive", label: "Passive Sellers", hint: "Rest offers above market" },
];

export class Simulation {
  eng = new MatchingEngine();
  traders: Trader[] = [];
  private mms: MarketMaker[] = [];
  private rng: () => number;
  private spreads: number[] = [];
  private mids: number[] = [];
  imbalanceHist: number[] = [];
  spreadHist: number[] = [];
  candles: Candle[] = [];
  private candleSize = 5; // steps per candle
  tickSize = 0.01;
  config: TraderConfig;
  startMid: number;

  constructor(public seed = 42, config: TraderConfig = DEFAULT_CONFIG, startMid = 5000) {
    this.rng = makeRng(seed);
    this.config = { ...config };
    this.startMid = startMid;
    this.build(config);
    this.eng.onTrade = (t) => this.routeFill(t);
    this.seedBook(startMid);
  }

  private makeTrader(kind: keyof TraderConfig, i: number): Trader {
    switch (kind) {
      case "marketMakers":
        return new MarketMaker(`MM-${i + 1}`, 3 + (i % 3), 12 - (i % 3) * 3);
      case "noise":
        return new RandomTrader(`NOISE-${i + 1}`);
      case "momentum":
        return new MomentumTrader(`MOM-${i + 1}`);
      case "meanReversion":
        return new MeanReversionTrader(`MR-${i + 1}`);
      case "aggressive":
        return new AggressiveBuyer(`INST-${i + 1}`);
      case "passive":
        return new PassiveSeller(`PASS-${i + 1}`);
    }
  }

  private build(c: TraderConfig) {
    (Object.keys(c) as (keyof TraderConfig)[]).forEach((kind) => {
      for (let i = 0; i < c[kind]; i++) this.traders.push(this.makeTrader(kind, i));
    });
    this.mms = this.traders.filter((t) => t instanceof MarketMaker) as MarketMaker[];
  }

  /** Live-apply a new trader mix WITHOUT resetting the market — adds/removes
   * agent instances to match the requested counts. Lets the user watch a
   * regime change (e.g. adding momentum traders) unfold in real time. */
  applyConfig(next: TraderConfig) {
    (Object.keys(next) as (keyof TraderConfig)[]).forEach((kind) => {
      const prefix = { marketMakers: "MM", noise: "NOISE", momentum: "MOM", meanReversion: "MR", aggressive: "INST", passive: "PASS" }[kind];
      const current = this.traders.filter((t) => t.id.startsWith(prefix + "-"));
      const target = next[kind];
      if (target > current.length) {
        for (let i = current.length; i < target; i++) this.traders.push(this.makeTrader(kind, i));
      } else if (target < current.length) {
        const remove = current.slice(target);
        for (const t of remove) {
          if (t instanceof MarketMaker) t.cancelLive(this.eng); // pull their resting quotes
          const idx = this.traders.indexOf(t);
          if (idx >= 0) this.traders.splice(idx, 1);
        }
      }
    });
    this.mms = this.traders.filter((t) => t instanceof MarketMaker) as MarketMaker[];
    this.config = { ...next };
  }

  /** Submit a manual order on behalf of the user ("YOU"). Returns a fill
   * summary so the UI can show realised price + slippage vs the pre-trade mid. */
  myOrderId: number | null = null; // the user's live resting order, for queue display

  submitManual(side: Side, type: "MARKET" | "LIMIT", qty: number, priceTicks: number | null) {
    const midBefore = this.eng.mid();
    const o: Order = {
      id: this.eng.nextId(),
      side,
      type,
      quantity: qty,
      price: type === "LIMIT" ? priceTicks : null,
      tif: "GTC",
      traderId: "YOU",
      seq: 0,
      latency: 0, // your click reaches the book immediately
      originalQuantity: qty,
    };
    const trades = this.eng.submit(o);
    const filled = trades.reduce((s, t) => s + t.quantity, 0);
    const notional = trades.reduce((s, t) => s + t.price * t.quantity, 0);
    const avg = filled ? notional / filled : null;
    const resting = qty - filled;
    // Track it only if some of it actually rests in the book (a resting LIMIT).
    this.myOrderId = resting > 0 && this.eng.queuePosition(o.id) !== null ? o.id : null;
    return { filled, avg, resting, midBefore, side, type };
  }

  myQueue() {
    return this.eng.queuePosition(this.myOrderId);
  }

  private routeFill(t: Trade) {
    for (const mm of this.mms) {
      if (t.makerTrader === mm.id)
        mm.onFill(t.aggressor === "BUY" ? "SELL" : "BUY", t.quantity);
      if (t.takerTrader === mm.id) mm.onFill(t.aggressor, t.quantity);
    }
  }

  private seedBook(mid = 5000) {
    const e = this.eng;
    for (let i = 1; i <= 5; i++) {
      e.submit(mkLimit(e, "BUY", mid - i, 10, "SEED"));
      e.submit(mkLimit(e, "SELL", mid + i, 10, "SEED"));
    }
    e.lastPrice = mid;
  }

  step() {
    this.eng.step++;
    // Collect all orders this step, then submit them in ARRIVAL order —
    // arrival = trader latency + jitter. Faster agents (market makers) reach the
    // book first and claim the front of the queue. This is what makes queue
    // position, and the latency race for it, meaningful.
    const pending: { arrival: number; order: Order }[] = [];
    for (const tr of this.traders) {
      for (const o of tr.act(this.eng, this.rng)) {
        pending.push({ arrival: (o.latency ?? 100) + this.rng(), order: o });
      }
    }
    pending.sort((a, b) => a.arrival - b.arrival);
    for (const p of pending) this.eng.submit(p.order);

    const sp = this.eng.spread();
    if (sp !== null) {
      this.spreads.push(sp);
      this.spreadHist.push(sp);
      if (this.spreadHist.length > 200) this.spreadHist.shift();
    }
    const m = this.eng.mid();
    if (m !== null) this.mids.push(m);
    const imb = this.imbalanceNow();
    if (imb !== null) {
      this.imbalanceHist.push(imb);
      if (this.imbalanceHist.length > 200) this.imbalanceHist.shift();
    }
    this.updateCandles();
  }

  private imbalanceNow(): number | null {
    const bb = this.eng.bids.best(),
      ba = this.eng.asks.best();
    if (bb && ba && bb.volume + ba.volume > 0)
      return (bb.volume - ba.volume) / (bb.volume + ba.volume);
    return null;
  }

  /** Depth with a running cumulative-volume column per side (best → worse). */
  depthCumulative(n = 12) {
    const d = this.eng.depth(n);
    const withCum = (rows: [number, number][]) => {
      let cum = 0;
      return rows.map(([p, v]) => {
        cum += v;
        return { price: p, volume: v, cum };
      });
    };
    return { bids: withCum(d.bids), asks: withCum(d.asks) };
  }

  private updateCandles() {
    const price = this.eng.lastPrice;
    if (price === null) return;
    const bucket = Math.floor(this.eng.step / this.candleSize);
    const last = this.candles[this.candles.length - 1];
    const vol = this.eng.trades.filter((t) => t.step === this.eng.step).reduce((s, t) => s + t.quantity, 0);
    if (!last || last.t !== bucket) {
      this.candles.push({ t: bucket, o: price, h: price, l: price, c: price, v: vol });
      if (this.candles.length > 240) this.candles.shift();
    } else {
      last.h = Math.max(last.h, price);
      last.l = Math.min(last.l, price);
      last.c = price;
      last.v += vol;
    }
  }

  summary(): Summary {
    const e = this.eng;
    const vol = e.trades.reduce((s, t) => s + t.quantity, 0);
    const vwap = vol ? e.trades.reduce((s, t) => s + t.price * t.quantity, 0) / vol : null;
    const bb = e.bids.best(),
      ba = e.asks.best();
    let imbalance: number | null = null;
    if (bb && ba && bb.volume + ba.volume > 0)
      imbalance = (bb.volume - ba.volume) / (bb.volume + ba.volume);
    return {
      lastPrice: e.lastPrice,
      vwap,
      totalVolume: vol,
      tradeCount: e.trades.length,
      currentSpread: e.spread(),
      averageSpread: this.spreads.length
        ? this.spreads.reduce((s, x) => s + x, 0) / this.spreads.length
        : null,
      orderImbalance: imbalance,
      volatility: this.volatility(),
    };
  }

  private volatility(): number | null {
    const m = this.mids.slice(-120);
    if (m.length < 3) return null;
    const rets: number[] = [];
    for (let i = 1; i < m.length; i++) if (m[i - 1] > 0) rets.push(Math.log(m[i] / m[i - 1]));
    if (rets.length < 2) return null;
    const mean = rets.reduce((s, x) => s + x, 0) / rets.length;
    const varc = rets.reduce((s, x) => s + (x - mean) ** 2, 0) / rets.length;
    return Math.sqrt(varc);
  }

  recentTrades(n = 30): Trade[] {
    return this.eng.trades.slice(-n).reverse();
  }
  depth(n = 12) {
    return this.eng.depth(n);
  }
}

function mkLimit(e: MatchingEngine, side: Side, price: number, qty: number, tid: string): Order {
  return {
    id: e.nextId(),
    side,
    type: "LIMIT",
    quantity: qty,
    price,
    tif: "GTC",
    traderId: tid,
    seq: 0,
    originalQuantity: qty,
  };
}
