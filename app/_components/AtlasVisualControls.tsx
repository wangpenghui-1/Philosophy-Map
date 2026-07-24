"use client";

import type { EarthLightingMode } from "./GlobeCanvas";
import type { EffectiveQuality, FocusDepth, QualityPreference } from "./atlas-visual-policy";

const qualityLabels: Record<QualityPreference, string> = {
  auto: "自动",
  high: "典藏",
  medium: "均衡",
  low: "轻量",
};

export function DisplaySettings({
  earthMode,
  qualityPreference,
  effectiveQuality,
  onEarthModeChange,
  onQualityPreferenceChange,
}: {
  earthMode: EarthLightingMode;
  qualityPreference: QualityPreference;
  effectiveQuality: EffectiveQuality;
  onEarthModeChange: (mode: EarthLightingMode) => void;
  onQualityPreferenceChange: (preference: QualityPreference) => void;
}) {
  return (
    <details className="display-settings">
      <summary aria-label="打开显示设置">
        <span aria-hidden="true">◐</span>
        <span>显示</span>
      </summary>
      <div className="display-settings__panel">
        <div className="display-settings__heading">
          <div><small>DISPLAY</small><strong>展陈设置</strong></div>
          <span className={`quality-indicator quality-indicator--${effectiveQuality}`}>{qualityLabels[effectiveQuality]}</span>
        </div>
        <fieldset>
          <legend>地球光照</legend>
          <div className="segmented-control">
            <button type="button" className={earthMode === "night" ? "is-active" : ""} aria-pressed={earthMode === "night"} onClick={() => onEarthModeChange("night")}>夜幕</button>
            <button type="button" className={earthMode === "day" ? "is-active" : ""} aria-pressed={earthMode === "day"} onClick={() => onEarthModeChange("day")}>白昼</button>
          </div>
        </fieldset>
        <fieldset>
          <legend>渲染画质</legend>
          <div className="quality-options">
            {(Object.keys(qualityLabels) as QualityPreference[]).map((preference) => (
              <button
                key={preference}
                type="button"
                className={qualityPreference === preference ? "is-active" : ""}
                aria-pressed={qualityPreference === preference}
                onClick={() => onQualityPreferenceChange(preference)}
              >
                <span>{qualityLabels[preference]}</span>
                <small>{preference === "auto" ? `当前${qualityLabels[effectiveQuality]}` : preference.toUpperCase()}</small>
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </details>
  );
}

export function FocusDepthControl({
  value,
  onChange,
}: {
  value: FocusDepth;
  onChange: (value: FocusDepth) => void;
}) {
  const options: Array<{ value: FocusDepth; label: string }> = [
    { value: 1, label: "一度" },
    { value: 2, label: "两度" },
    { value: "all", label: "全图" },
  ];
  return (
    <div className="focus-depth-control" role="group" aria-label="思想关系聚焦范围">
      <small>关系聚焦</small>
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          className={value === option.value ? "is-active" : ""}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
