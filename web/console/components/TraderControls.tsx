"use client";
import { PRESETS, TRADER_META, TraderConfig } from "@/lib/simulation";

// Scenario presets + live sliders for the trader mix. Changing these mutates
// the running market in place (no reset) so regime changes unfold live.
export default function TraderControls({
  config,
  activePreset,
  onPreset,
  onChange,
}: {
  config: TraderConfig;
  activePreset: string | null;
  onPreset: (name: string) => void;
  onChange: (next: TraderConfig) => void;
}) {
  const set = (key: keyof TraderConfig, val: number) =>
    onChange({ ...config, [key]: Math.max(0, Math.min(8, val)) });

  return (
    <div className="mix">
      <div className="presets">
        {PRESETS.map((p) => (
          <button
            key={p.name}
            className={`preset ${activePreset === p.name ? "on" : ""}`}
            title={p.blurb}
            onClick={() => onPreset(p.name)}
          >
            {p.name}
          </button>
        ))}
      </div>
      <div className="sliders">
        {TRADER_META.map((m) => (
          <div className="slider-row" key={m.key} title={m.hint}>
            <span className="sl-label">{m.label}</span>
            <input
              type="range"
              min={0}
              max={8}
              value={config[m.key]}
              onChange={(e) => set(m.key, parseInt(e.target.value))}
            />
            <span className="sl-val">{config[m.key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
