// Trader agents (TS port). Mirrors engine/agora/traders.py. See vault ADR-0003.
import { MatchingEngine, Order, Side, OrderType, TIF } from "./engine";

// Deterministic PRNG (mulberry32) so a seed reproduces a market.
export function makeRng(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rng = () => number;
const randint = (r: Rng, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));

export abstract class Trader {
  // Base arrival latency (lower = faster tech = better queue position).
  latency = 100;
  constructor(public id: string) {}
  abstract act(eng: MatchingEngine, r: Rng): Order[];
  protected order(
    eng: MatchingEngine,
    side: Side,
    type: OrderType,
    quantity: number,
    price: number | null = null,
    tif: TIF = "GTC"
  ): Order {
    return {
      id: eng.nextId(),
      side,
      type,
      quantity,
      price,
      tif,
      traderId: this.id,
      seq: 0,
      latency: this.latency,
      originalQuantity: quantity,
    };
  }
}

export class RandomTrader extends Trader {
  latency = 90;
  constructor(id: string, public maxQty = 5, public activity = 0.7) {
    super(id);
  }
  act(eng: MatchingEngine, r: Rng): Order[] {
    if (r() > this.activity) return [];
    const ref = eng.marketPrice() ?? 5000;
    const side: Side = r() < 0.5 ? "BUY" : "SELL";
    const qty = randint(r, 1, this.maxQty);
    if (r() < 0.4) return [this.order(eng, side, "MARKET", qty)];
    const off = randint(r, 1, 5);
    const price = side === "BUY" ? ref - off : ref + off;
    return [this.order(eng, side, "LIMIT", qty, price)];
  }
}

export class MarketMaker extends Trader {
  latency = 10; // colocated / fastest — wins the race to the front of the queue
  inventory = 0;
  private live: number[] = [];
  constructor(id: string, public halfSpread = 3, public quoteSize = 10, public maxInv = 60) {
    super(id);
  }
  onFill(side: Side, qty: number) {
    this.inventory += side === "BUY" ? qty : -qty;
  }
  cancelLive(eng: MatchingEngine) {
    for (const oid of this.live) eng.cancel(oid);
    this.live = [];
  }
  act(eng: MatchingEngine, _r: Rng): Order[] {
    for (const oid of this.live) eng.cancel(oid);
    this.live = [];
    const ref = Math.round(eng.marketPrice() ?? 5000);
    const skew = Math.round((this.inventory / this.maxInv) * this.halfSpread);
    const bid = ref - this.halfSpread - skew;
    const ask = ref + this.halfSpread - skew;
    const out: Order[] = [];
    if (this.inventory < this.maxInv) {
      const b = this.order(eng, "BUY", "LIMIT", this.quoteSize, bid);
      out.push(b);
      this.live.push(b.id);
    }
    if (this.inventory > -this.maxInv) {
      const a = this.order(eng, "SELL", "LIMIT", this.quoteSize, ask);
      out.push(a);
      this.live.push(a.id);
    }
    return out;
  }
}

export class MomentumTrader extends Trader {
  latency = 30;
  constructor(id: string, public lookback = 12, public qty = 4, public threshold = 2) {
    super(id);
  }
  act(eng: MatchingEngine, _r: Rng): Order[] {
    const p = eng.trades.slice(-this.lookback).map((t) => t.price);
    if (p.length < this.lookback) return [];
    const chg = p[p.length - 1] - p[0];
    if (chg > this.threshold) return [this.order(eng, "BUY", "MARKET", this.qty)];
    if (chg < -this.threshold) return [this.order(eng, "SELL", "MARKET", this.qty)];
    return [];
  }
}

export class MeanReversionTrader extends Trader {
  latency = 40;
  constructor(id: string, public lookback = 20, public qty = 4, public band = 3) {
    super(id);
  }
  act(eng: MatchingEngine, _r: Rng): Order[] {
    const p = eng.trades.slice(-this.lookback).map((t) => t.price);
    if (p.length < this.lookback) return [];
    const avg = p.reduce((s, x) => s + x, 0) / p.length;
    const last = p[p.length - 1];
    if (last > avg + this.band) return [this.order(eng, "SELL", "MARKET", this.qty)];
    if (last < avg - this.band) return [this.order(eng, "BUY", "MARKET", this.qty)];
    return [];
  }
}

export class AggressiveBuyer extends Trader {
  latency = 20; // well-resourced desk
  constructor(id: string, public qty = 8, public activity = 0.15) {
    super(id);
  }
  act(eng: MatchingEngine, r: Rng): Order[] {
    if (r() > this.activity) return [];
    return [this.order(eng, "BUY", "MARKET", this.qty)];
  }
}

export class PassiveSeller extends Trader {
  latency = 120; // patient, slow
  constructor(id: string, public qty = 6, public offset = 6, public activity = 0.4) {
    super(id);
  }
  act(eng: MatchingEngine, r: Rng): Order[] {
    if (r() > this.activity) return [];
    const ref = eng.marketPrice() ?? 5000;
    return [this.order(eng, "SELL", "LIMIT", this.qty, ref + this.offset)];
  }
}
