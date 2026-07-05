"use client";
import { useState } from "react";
import type { Side } from "@/lib/engine";

const TICK = 0.01;

export interface FillResult {
  filled: number;
  avg: number | null;
  resting: number;
  midBefore: number | null;
  side: Side;
  type: "MARKET" | "LIMIT";
}

// Manual order entry. Lets the user fire an order into the live book and see
// exactly what it filled at — making market impact and price-time priority
// tangible. `refPrice` (ticks) seeds the limit-price field.
export default function OrderTicket({
  refPrice,
  onSubmit,
}: {
  refPrice: number | null;
  onSubmit: (side: Side, type: "MARKET" | "LIMIT", qty: number, priceTicks: number | null) => FillResult;
}) {
  const [side, setSide] = useState<Side>("BUY");
  const [type, setType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [qty, setQty] = useState(20);
  const [price, setPrice] = useState<string>("");
  const [result, setResult] = useState<FillResult | null>(null);

  const submit = () => {
    if (qty <= 0) return;
    let priceTicks: number | null = null;
    if (type === "LIMIT") {
      const dollars = parseFloat(price);
      const seed = refPrice ?? 5000;
      priceTicks = isNaN(dollars) ? seed : Math.round(dollars / TICK);
    }
    setResult(onSubmit(side, type, qty, priceTicks));
  };

  const slip =
    result && result.avg !== null && result.midBefore !== null
      ? (result.avg - result.midBefore) * TICK * (result.side === "BUY" ? 1 : -1)
      : null;

  return (
    <div className="ticket">
      <div className="seg">
        <button className={`seg-btn buy ${side === "BUY" ? "on" : ""}`} onClick={() => setSide("BUY")}>
          Buy
        </button>
        <button className={`seg-btn sell ${side === "SELL" ? "on" : ""}`} onClick={() => setSide("SELL")}>
          Sell
        </button>
      </div>
      <div className="seg">
        <button className={`seg-btn ${type === "MARKET" ? "on" : ""}`} onClick={() => setType("MARKET")}>
          Market
        </button>
        <button className={`seg-btn ${type === "LIMIT" ? "on" : ""}`} onClick={() => setType("LIMIT")}>
          Limit
        </button>
      </div>
      <label className="fld">
        <span>Qty</span>
        <input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(parseInt(e.target.value) || 0)}
        />
      </label>
      {type === "LIMIT" && (
        <label className="fld">
          <span>Price</span>
          <input
            type="number"
            step="0.01"
            placeholder={refPrice ? (refPrice * TICK).toFixed(2) : "—"}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
      )}
      <button className={`submit ${side === "BUY" ? "buy" : "sell"}`} onClick={submit}>
        {side} {qty} {type}
      </button>
      {result && (
        <div className="fill">
          {result.filled > 0 ? (
            <>
              <div>
                Filled <b>{result.filled}</b> @ avg{" "}
                <b>{result.avg !== null ? (result.avg * TICK).toFixed(2) : "—"}</b>
              </div>
              {slip !== null && (
                <div className={slip > 0 ? "down" : "up"}>
                  Slippage {slip >= 0 ? "+" : ""}
                  {slip.toFixed(3)} vs mid
                </div>
              )}
              {result.resting > 0 && <div className="muted">{result.resting} resting</div>}
            </>
          ) : (
            <div className="muted">No fill — {result.resting} resting on book</div>
          )}
        </div>
      )}
    </div>
  );
}
