"use client";
import { useEffect, useRef, useState } from "react";
import { INTERVENTIONS, Intervention, DecisionReport, runScenario } from "@/lib/scenario";
import type { TraderConfig } from "@/lib/simulation";

const TICK = 0.01;

interface JournalEntry {
  ts: number;
  symbol: string;
  intervention: string;
  verdict: string;
  confidence: string;
  headline: string;
}

// A dedicated decision surface: leave the live tape, run a controlled A/B
// experiment on the market, and walk away with an answer. Fork → run → report.
export default function ScenarioLab({
  symbol,
  config,
  startMid,
  seed,
  onClose,
}: {
  symbol: string;
  config: TraderConfig;
  startMid: number;
  seed: number;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Intervention>(INTERVENTIONS[0]);
  const [report, setReport] = useState<DecisionReport | null>(null);
  const [running, setRunning] = useState(false);
  const [journal, setJournal] = useState<JournalEntry[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("agora.journal");
      if (raw) setJournal(JSON.parse(raw));
    } catch {}
  }, []);

  const run = () => {
    setRunning(true);
    // let the button paint before the synchronous compute
    setTimeout(() => {
      const r = runScenario(seed, config, startMid, selected, 200, 8);
      setReport(r);
      const headline = r.metrics.map((m) => `${m.label} ${m.fmt(m.delta)}`).slice(0, 2).join(" · ");
      const entry: JournalEntry = {
        ts: Date.now(),
        symbol,
        intervention: selected.label,
        verdict: r.verdict,
        confidence: r.confidence,
        headline,
      };
      const next = [entry, ...journal].slice(0, 12);
      setJournal(next);
      try {
        localStorage.setItem("agora.journal", JSON.stringify(next));
      } catch {}
      setRunning(false);
    }, 20);
  };

  return (
    <div className="lab-overlay" role="dialog" aria-modal="true">
      <div className="lab">
        <div className="lab-top">
          <div className="lab-title">
            SCENARIO LAB <span className="lab-sym">· {symbol}</span>
          </div>
          <div className="lab-sub">Fork the market · apply one intervention · compare timelines across 8 seeds</div>
          <button className="ctl" onClick={onClose}>
            Close ✕
          </button>
        </div>

        <div className="lab-body">
          {/* left: choose the intervention */}
          <div className="lab-choose">
            <div className="lab-h">1 · What if I…</div>
            {INTERVENTIONS.map((iv) => (
              <button
                key={iv.id}
                className={`iv ${selected.id === iv.id ? "on" : ""}`}
                onClick={() => setSelected(iv)}
              >
                <span className="iv-label">{iv.label}</span>
                <span className="iv-q">{iv.question}</span>
              </button>
            ))}
            <button className="lab-run" onClick={run} disabled={running}>
              {running ? "Running 8 timelines…" : "▶ Run experiment"}
            </button>
          </div>

          {/* right: the decision report */}
          <div className="lab-report">
            {!report ? (
              <div className="lab-empty">
                <div className="lab-h">The decision surface</div>
                <p>
                  Pick an intervention and run it. Agora builds a <b>control</b> market and a{" "}
                  <b>treatment</b> market from an identical seed, applies your change to only the
                  treatment, and runs both forward. Because they start identical, the difference is{" "}
                  <b>caused</b> by your intervention — measured across 8 seeds so you get a real
                  confidence, not one lucky run.
                </p>
                <p className="lab-dim">
                  This is the point of the whole system: answer <b>&ldquo;what happens if I do X?&rdquo;</b>{" "}
                  before committing to X.
                </p>
              </div>
            ) : (
              <Report report={report} />
            )}
          </div>
        </div>

        {/* decision journal */}
        {journal.length > 0 && (
          <div className="lab-journal">
            <div className="lab-h">Decision journal</div>
            <div className="journal-rows">
              {journal.map((j, i) => (
                <div className="j-row" key={i}>
                  <span className="j-sym">{j.symbol}</span>
                  <span className="j-iv">{j.intervention}</span>
                  <span className="j-head">{j.headline}</span>
                  <span className={`j-conf c-${j.confidence.toLowerCase()}`}>{j.confidence}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Report({ report }: { report: DecisionReport }) {
  return (
    <div className="report">
      <div className="rp-verdict-row">
        <div className="lab-h">Decision report</div>
        <span className={`conf-badge c-${report.confidence.toLowerCase()}`}>
          {report.confidence} confidence
        </span>
      </div>
      <div className="rp-verdict">{report.verdict}</div>
      <div className="rp-confwhy">{report.confidenceWhy}</div>

      <PathChart base={report.chartBase} treat={report.chartTreat} />

      <div className="rp-h">Why — the causal chain</div>
      <ol className="rp-chain">
        {report.narrative.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ol>

      <div className="rp-h">Measured effect (treatment vs control, mean of 8)</div>
      <table className="rp-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Δ</th>
            <th>Consistency</th>
          </tr>
        </thead>
        <tbody>
          {report.metrics.map((m) => {
            const bad = m.goodDown ? m.delta > 8 : false;
            const good = m.goodDown ? m.delta < -8 : false;
            return (
              <tr key={m.key}>
                <td>{m.label}</td>
                <td className={`rp-delta ${bad ? "down" : good ? "up" : ""}`}>{m.fmt(m.delta)}</td>
                <td className="rp-hit">
                  <span className="hit-bar">
                    <span style={{ width: `${m.hitRate * 100}%` }} />
                  </span>
                  {Math.round(m.hitRate * 8)}/8
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="rp-h">Trade-offs &amp; unknowns</div>
      <ul className="rp-trade">
        {report.tradeoffs.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

// Dual-path comparison: control (muted) vs treatment (red). The whole point in
// one picture — same start, diverging futures.
function PathChart({ base, treat }: { base: number[]; treat: number[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement!;
    const dpr = window.devicePixelRatio || 1;
    const w = parent.clientWidth;
    const h = 150;
    if (w === 0) return;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    const all = [...base, ...treat];
    if (all.length < 4) return;
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const range = hi - lo || 1;
    const padT = 8;
    const padB = 8;
    const plotH = h - padT - padB;
    const line = (data: number[], color: string, width: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      data.forEach((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = padT + ((hi - v) / range) * plotH;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    };
    line(base, "#55555f", 1.25); // control
    line(treat, "#ff3347", 1.5); // treatment
  }, [base, treat]);
  return (
    <div className="path-wrap">
      <canvas ref={ref} />
      <div className="path-legend">
        <span>
          <i className="sw-base" /> Control
        </span>
        <span>
          <i className="sw-treat" /> Treatment
        </span>
      </div>
    </div>
  );
}
