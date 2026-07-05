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

export class Simulation {
  eng = new MatchingEngine();
  traders: Trader[] = [];
  private mms: MarketMaker[] = [];
  private rng: () => number;
  private spreads: number[] = [];
  private mids: number[] = [];
  candles: Candle[] = [];
  private candleSize = 5; // steps per candle
  tickSize = 0.01;

  constructor(public seed = 42, config: TraderConfig = DEFAULT_CONFIG) {
    this.rng = makeRng(seed);
    this.build(config);
    this.eng.onTrade = (t) => this.routeFill(t);
    this.seedBook();
  }

  private build(c: TraderConfig) {
    for (let i = 0; i < c.marketMakers; i++)
      this.traders.push(new MarketMaker(`MM-${i + 1}`, 3 + i, 12 - i * 3));
    for (let i = 0; i < c.noise; i++) this.traders.push(new RandomTrader(`NOISE-${i + 1}`));
    for (let i = 0; i < c.momentum; i++) this.traders.push(new MomentumTrader(`MOM-${i + 1}`));
    for (let i = 0; i < c.meanReversion; i++)
      this.traders.push(new MeanReversionTrader(`MR-${i + 1}`));
    for (let i = 0; i < c.aggressive; i++)
      this.traders.push(new AggressiveBuyer(`INST-${i + 1}`));
    for (let i = 0; i < c.passive; i++) this.traders.push(new PassiveSeller(`PASS-${i + 1}`));
    this.mms = this.traders.filter((t) => t instanceof MarketMaker) as MarketMaker[];
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
    const order = [...this.traders];
    // Fisher-Yates with the sim rng
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (const tr of order) for (const o of tr.act(this.eng, this.rng)) this.eng.submit(o);

    const sp = this.eng.spread();
    if (sp !== null) this.spreads.push(sp);
    const m = this.eng.mid();
    if (m !== null) this.mids.push(m);
    this.updateCandles();
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
