# PRODUCT.md — Agora Exchange Console

**What it is:** The live front-end of Project Agora — a first-principles electronic exchange simulator. A matching engine (price-time priority, integer ticks) runs client-side in the browser; the console visualises the market it produces and lets the user trade into it.

**Who uses it:** One person at a time — the author demoing to quant-firm recruiters/interviewers, and the author studying microstructure. Used at a desk, full-screen, usually in a dark room or an interview screen-share. Not a consumer product; a professional instrument.

**Register:** product (design serves the tool). Aesthetic mandate from the owner: *brutal* — perfect blacks, hard reds/greens, zero playfulness. It should read like an exchange operations terminal, not a trading game.

**Core surfaces:**
- Price chart (candles) · order-book depth ladder · time & sales tape
- Analytics (VWAP, spread, imbalance, volatility) with sparklines
- Order ticket (manual orders, slippage receipt, queue position)
- Trader-mix panel (agent sliders + scenario presets)
- Multi-asset watchlist (4 instruments)

**Non-goals:** Mobile-first polish (desktop demo is the target; it must merely survive narrow screens). Marketing pages. Multi-user.

**Success:** An interviewer opens the URL and thinks "this person has used real trading systems." Every pixel supports that.
