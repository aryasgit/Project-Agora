// Faithful, compact TypeScript port of the Agora matching engine.
// Source of truth is the tested Python engine (engine/agora). See vault ADR-0003.
// Prices are integer TICKS; quantities are integer units. Price-time priority.

export type Side = "BUY" | "SELL";
export type OrderType = "MARKET" | "LIMIT";
export type TIF = "GTC" | "IOC" | "FOK";

export interface Order {
  id: number;
  side: Side;
  type: OrderType;
  quantity: number;
  price: number | null; // ticks; null for MARKET
  tif: TIF;
  traderId?: string;
  seq: number;
  latency?: number; // arrival delay; lower = faster tech = better queue spot
  originalQuantity: number;
}

export interface Trade {
  price: number;
  quantity: number;
  aggressor: Side;
  makerId: number;
  takerId: number;
  seq: number;
  makerTrader?: string;
  takerTrader?: string;
  step: number;
}

// A price level is a FIFO array of orders (front = index 0 fills first).
class PriceLevel {
  price: number;
  orders: Order[] = [];
  volume = 0;
  constructor(price: number) {
    this.price = price;
  }
  append(o: Order) {
    this.orders.push(o);
    this.volume += o.quantity;
  }
}

// Sorted map of price -> level. Bids: highest first. Asks: lowest first.
// Simulation scale is small, so an array kept sorted on insert is plenty fast
// and keeps the port dependency-free.
class BookSide {
  levels: PriceLevel[] = []; // sorted best-first
  private index = new Map<number, PriceLevel>();
  constructor(private side: Side) {}

  private better(a: number, b: number) {
    return this.side === "BUY" ? a > b : a < b; // best-first comparator
  }

  add(o: Order) {
    const price = o.price!;
    let level = this.index.get(price);
    if (!level) {
      level = new PriceLevel(price);
      this.index.set(price, level);
      // insert keeping best-first order
      let lo = 0,
        hi = this.levels.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (this.better(price, this.levels[mid].price)) hi = mid;
        else lo = mid + 1;
      }
      this.levels.splice(lo, 0, level);
    }
    level.append(o);
  }

  best(): PriceLevel | null {
    return this.levels.length ? this.levels[0] : null;
  }

  popFilledFront(level: PriceLevel) {
    level.orders.shift();
    if (level.orders.length === 0) {
      this.levels.shift();
      this.index.delete(level.price);
    }
  }

  remove(id: number): boolean {
    for (let i = 0; i < this.levels.length; i++) {
      const lvl = this.levels[i];
      const idx = lvl.orders.findIndex((o) => o.id === id);
      if (idx >= 0) {
        lvl.volume -= lvl.orders[idx].quantity;
        lvl.orders.splice(idx, 1);
        if (lvl.orders.length === 0) {
          this.levels.splice(i, 1);
          this.index.delete(lvl.price);
        }
        return true;
      }
    }
    return false;
  }

  depth(n: number): [number, number][] {
    return this.levels.slice(0, n).map((l) => [l.price, l.volume]);
  }

  queuePosition(id: number): QueuePosition | null {
    for (const lvl of this.levels) {
      const idx = lvl.orders.findIndex((o) => o.id === id);
      if (idx < 0) continue;
      let volumeAhead = 0;
      for (let i = 0; i < idx; i++) volumeAhead += lvl.orders[i].quantity;
      let volumeBehind = 0;
      for (let i = idx + 1; i < lvl.orders.length; i++) volumeBehind += lvl.orders[i].quantity;
      return {
        price: lvl.price,
        rank: idx + 1,
        totalOrders: lvl.orders.length,
        ordersAhead: idx,
        volumeAhead,
        ordersBehind: lvl.orders.length - idx - 1,
        volumeBehind,
        ownRemaining: lvl.orders[idx].quantity,
      };
    }
    return null;
  }
}

export interface QueuePosition {
  price: number;
  rank: number;
  totalOrders: number;
  ordersAhead: number;
  volumeAhead: number;
  ordersBehind: number;
  volumeBehind: number;
  ownRemaining: number;
}

export class MatchingEngine {
  bids = new BookSide("BUY");
  asks = new BookSide("SELL");
  lastPrice: number | null = null;
  trades: Trade[] = [];
  private orderSeq = 0;
  private tradeSeq = 0;
  private idSeq = 0;
  step = 0;
  onTrade?: (t: Trade) => void;

  // --- order-lifecycle KPIs (for the execution log + KPI board) ---------
  stats = {
    submitted: 0,       // orders received
    submittedVolume: 0, // total lots requested
    fullyFilled: 0,
    partiallyFilled: 0,
    restedNoFill: 0,    // limit orders that rested with zero fill
    unfilled: 0,        // market/IOC/FOK that found no liquidity
    cancelled: 0,
    matchedVolume: 0,   // lots that actually traded
  };
  fillRate(): number {
    return this.stats.submittedVolume
      ? this.stats.matchedVolume / this.stats.submittedVolume
      : 0;
  }

  nextId() {
    return ++this.idSeq;
  }

  queuePosition(id: number | null): QueuePosition | null {
    if (id === null) return null;
    return this.bids.queuePosition(id) ?? this.asks.queuePosition(id);
  }

  bestBid(): number | null {
    return this.bids.best()?.price ?? null;
  }
  bestAsk(): number | null {
    return this.asks.best()?.price ?? null;
  }
  spread(): number | null {
    const b = this.bestBid(),
      a = this.bestAsk();
    return b !== null && a !== null ? a - b : null;
  }
  mid(): number | null {
    const b = this.bestBid(),
      a = this.bestAsk();
    return b !== null && a !== null ? (a + b) / 2 : null;
  }
  marketPrice(): number | null {
    return this.lastPrice ?? this.mid();
  }

  submit(o: Order): Trade[] {
    o.seq = ++this.orderSeq;
    if (o.originalQuantity === 0) o.originalQuantity = o.quantity;
    const wantsRest = o.type === "LIMIT" && o.tif === "GTC";
    this.stats.submitted++;
    this.stats.submittedVolume += o.originalQuantity;

    const trades = this.match(o);

    const filled = o.originalQuantity - o.quantity;
    this.stats.matchedVolume += filled;
    if (o.quantity === 0) {
      this.stats.fullyFilled++;
    } else if (filled > 0) {
      this.stats.partiallyFilled++;
    } else if (wantsRest && this.queuePosition(o.id) !== null) {
      this.stats.restedNoFill++;
    } else {
      this.stats.unfilled++;
    }
    return trades;
  }

  cancel(id: number): boolean {
    const ok = this.bids.remove(id) || this.asks.remove(id);
    if (ok) this.stats.cancelled++;
    return ok;
  }

  private crosses(o: Order, restingPrice: number): boolean {
    return o.side === "BUY" ? o.price! >= restingPrice : o.price! <= restingPrice;
  }

  private canFullyFill(o: Order): boolean {
    const isMarket = o.type === "MARKET" || o.price === null;
    const side = o.side === "BUY" ? this.asks : this.bids;
    let need = o.quantity;
    for (const lvl of side.levels) {
      if (!isMarket && !this.crosses(o, lvl.price)) break;
      need -= lvl.volume;
      if (need <= 0) return true;
    }
    return need <= 0;
  }

  private match(o: Order): Trade[] {
    const out: Trade[] = [];
    const isMarket = o.type === "MARKET" || o.price === null;
    const opp = o.side === "BUY" ? this.asks : this.bids;

    if (o.tif === "FOK" && !this.canFullyFill(o)) return out;

    while (o.quantity > 0) {
      const level = opp.best();
      if (!level) break;
      if (!isMarket && !this.crosses(o, level.price)) break;
      const maker = level.orders[0];
      const qty = Math.min(o.quantity, maker.quantity);
      this.tradeSeq++;
      this.lastPrice = level.price;
      const t: Trade = {
        price: level.price,
        quantity: qty,
        aggressor: o.side,
        makerId: maker.id,
        takerId: o.id,
        seq: this.tradeSeq,
        makerTrader: maker.traderId,
        takerTrader: o.traderId,
        step: this.step,
      };
      this.trades.push(t);
      out.push(t);
      this.onTrade?.(t);
      o.quantity -= qty;
      maker.quantity -= qty;
      level.volume -= qty;
      if (maker.quantity === 0) opp.popFilledFront(level);
    }

    if (o.quantity > 0 && !isMarket && o.tif === "GTC") {
      (o.side === "BUY" ? this.bids : this.asks).add(o);
    }
    return out;
  }

  depth(n = 12) {
    return { bids: this.bids.depth(n), asks: this.asks.depth(n) };
  }
}
