# ADR-0001 — Technology Stack & Engine/UI Separation

**Status:** Proposed (awaiting your confirmation)
**Date:** 2026-07-05

## Context
The project needs (a) a rigorous simulation engine that is easy to test and reason about, and (b) a deployed, TradingView-style console (strict black, red/green) on Vercel. The original brief mentions Streamlit for the dashboard.

## Decision
1. **Engine in pure Python**, packaged under `agora/`, with **zero UI dependencies**. It can run headless in a notebook or a test.
2. **Web layer** = **FastAPI** (thin JSON API exposing engine state) + **Next.js** console deployed to **Vercel**.
3. **Streamlit** kept only as an optional *local* exploration view — not the shipped product.

## Why not Streamlit as the main UI?
- Streamlit re-runs the whole script on interaction — awkward for a live, tick-by-tick order book with a custom dark aesthetic.
- Vercel is a JS/edge host; Streamlit wants its own long-lived Python server (Streamlit Cloud / a container), not Vercel.
- A Next.js console gives pixel control for the strict-black + red/green TradingView look, and is a stronger portfolio signal for a quant-dev role.

## Consequences
- We maintain a small API contract between engine and console (documented in `30-guides/` later).
- Slightly more setup than Streamlit, but far better separation of concerns and a real deployable frontend.
- The engine stays independently testable — the single most interview-defensible property of the codebase.

## Alternatives considered
- **Streamlit-only:** fastest to a demo, weakest final product. Rejected as the primary UI.
- **Everything in Next.js (engine in TS):** loses Python's clarity for teaching microstructure; harder to write clean tests quickly. Rejected.

Related: [[Roadmap]], [[Status]].
