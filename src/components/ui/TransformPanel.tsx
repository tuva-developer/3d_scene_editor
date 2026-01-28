import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faChevronUp,
  faUpDownLeftRight,
  faRotate,
  faUpRightAndDownLeftFromCenter,
  faRotateLeft,
} from "@fortawesome/free-solid-svg-icons";
import type { TransformMode, TransformValues } from "@/types/common";

type TransformPanelProps = {
  values: TransformValues | null;
  onChange: (values: Partial<TransformValues>) => void;
  mode: TransformMode;
  onChangeMode: (mode: TransformMode) => void;
  onSnapToGround: () => void;
  enableClippingPlane: (enable: boolean) => void;
  enableFootPrintWhenEdit: (enable: boolean) => void;
  disabled?: boolean;
};

type TransformGroupKey = "position" | "rotation" | "scale";

type TransformDraft = {
  position: [string, string, string];
  rotation: [string, string, string];
  scale: [string, string, string];
};

const defaultDraft: TransformDraft = {
  position: ["0", "0", "0"],
  rotation: ["0", "0", "0"],
  scale: ["1", "1", "1"],
};

const axisLabels: Array<"X" | "Y" | "Z"> = ["X", "Y", "Z"];

function formatNumber(value: number, decimals: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  const fixed = value.toFixed(decimals);
  return fixed.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

function valuesToDraft(values: TransformValues, decimals: { position: number; rotation: number; scale: number }): TransformDraft {
  return {
    position: [
      formatNumber(values.position[0], decimals.position),
      formatNumber(values.position[1], decimals.position),
      formatNumber(values.position[2], decimals.position),
    ],
    rotation: [
      formatNumber(values.rotation[0], decimals.rotation),
      formatNumber(values.rotation[1], decimals.rotation),
      formatNumber(values.rotation[2], decimals.rotation),
    ],
    scale: [
      formatNumber(values.scale[0], decimals.scale),
      formatNumber(values.scale[1], decimals.scale),
      formatNumber(values.scale[2], decimals.scale),
    ],
  };
}

function clampTextValue(value: string): string {
  return value.replace(/[^0-9+\-.]/g, "");
}

export default function TransformPanel({
  values,
  onChange,
  mode,
  onChangeMode,
  onSnapToGround,
  enableClippingPlane,
  enableFootPrintWhenEdit,
  disabled,
}: TransformPanelProps) {
  const decimals = useMemo(() => ({ position: 4, rotation: 2, scale: 3 }), []);
  const [draft, setDraft] = useState<TransformDraft>(defaultDraft);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [clippingEnabled, setClippingEnabled] = useState(false);
  const [footprintEnabled, setFootprintEnabled] = useState(false);

  useEffect(() => {
    if (!values) {
      setDraft(defaultDraft);
      return;
    }
    if (editingKey) {
      return;
    }
    setDraft(valuesToDraft(values, decimals));
  }, [values, decimals, editingKey]);

  const groups = [
    { key: "position" as const, label: "Location", unit: "m" },
    { key: "rotation" as const, label: "Rotation", unit: "deg" },
    { key: "scale" as const, label: "Scale", unit: "" },
  ];

  const panelClassName =
    "absolute right-4 top-16 z-[2000] w-[260px] rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] text-[var(--text)] shadow-[var(--panel-shadow)]";
  const headerClassName = "flex items-center justify-between border-b border-[var(--divider)] px-3 py-2";
  const titleClassName = "text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]";
  const titleDisabledClassName = "text-[var(--btn-danger-text)]/70";
  const subtitleClassName = "text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]";
  const contentClassName = "flex flex-col gap-2.5 px-3 py-2.5";
  const rowClassName = "grid grid-cols-[64px_1fr] items-center gap-2";
  const labelClassName = "text-[11px] font-semibold text-[var(--section-heading)]";
  const axisGridClassName = "grid grid-cols-[16px_1fr] items-center gap-1.5";
  const inputClassName =
    "h-7 w-full rounded-md border border-[var(--btn-border)] bg-[var(--btn-bg)] px-2 text-[11px] text-[var(--text)] outline-none transition focus:border-[var(--btn-active-border)] focus:ring-2 focus:ring-[color:var(--focus-ring)]/30 disabled:cursor-not-allowed disabled:opacity-50";
  const unitClassName = "ml-1 text-[10px] text-[var(--text-muted)]";
  const dividerClassName = "h-px w-full bg-[var(--divider)]";
  const modeRowClassName = "grid grid-cols-[70px_1fr] items-center gap-2";
  const selectClassName =
    "h-7 w-full rounded-md border border-[var(--btn-border)] bg-[var(--btn-bg)] px-2 text-[11px] text-[var(--text)] outline-none transition focus:border-[var(--btn-active-border)] focus:ring-2 focus:ring-[color:var(--focus-ring)]/30 disabled:cursor-not-allowed disabled:opacity-50";
  const segmentedClassName =
    "inline-flex items-center gap-0.5 rounded-[8px] border border-[var(--seg-border)] bg-[var(--seg-bg)] p-[3px]";
  const segmentedButtonBaseClassName =
    "flex h-7 w-7 flex-none items-center justify-center rounded-md text-[12px] text-[var(--text)] transition hover:bg-[var(--seg-hover)]";
  const segmentedButtonActiveClassName =
    "bg-[var(--btn-active-bg)] text-[var(--btn-active-text)] shadow-[var(--btn-active-ring)]";
  const actionRowClassName = "flex items-center justify-between gap-2";
  const buttonBaseClassName =
    "flex items-center justify-center rounded-md border border-[var(--btn-border)] bg-[var(--btn-bg)] text-[11px] text-[var(--text)] transition hover:-translate-y-px hover:border-[var(--btn-border-hover)] hover:bg-[var(--btn-hover)]";
  const buttonCompactClassName = "h-7 w-7";
  const buttonWideClassName = "h-7 px-2 text-[10px] font-semibold";
  const buttonDangerClassName =
    "border-[var(--btn-danger-border)] bg-[var(--btn-danger-bg)] text-[var(--btn-danger-text)] hover:!border-[var(--btn-danger-hover)] hover:!bg-[var(--btn-danger-hover)]";
  const collapseButtonClassName =
    "flex h-7 w-7 items-center justify-center rounded-md border border-[var(--btn-border)] bg-[var(--btn-bg)] text-[12px] text-[var(--text)] transition hover:bg-[var(--btn-hover)]";
  const statusDotBaseClassName = "inline-block h-2 w-2 rounded-full";
  const statusDotOnClassName = "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]";
  const statusDotOffClassName = "bg-rose-400/80 shadow-[0_0_6px_rgba(244,63,94,0.4)]";
  const sectionTitleClassName = "text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]";

  const isDisabled = disabled || !values;

  const commitValue = (groupKey: TransformGroupKey, axisIndex: number) => {
    const nextValue = Number.parseFloat(draft[groupKey][axisIndex]);
    if (!Number.isFinite(nextValue)) {
      if (values) {
        setDraft(valuesToDraft(values, decimals));
      }
      return;
    }
    if (!values) {
      return;
    }
    const nextGroup = [...values[groupKey]] as [number, number, number];
    nextGroup[axisIndex] = nextValue;
    onChange({ [groupKey]: nextGroup } as Partial<TransformValues>);
  };

  const handleToggleClip = () => {
    const next = !clippingEnabled;
    setClippingEnabled(next);
    enableClippingPlane(next);
  };

  const handleToggleFootprint = () => {
    const next = !footprintEnabled;
    setFootprintEnabled(next);
    enableFootPrintWhenEdit(next);
  };

  return (
    <div className={panelClassName} aria-label="Selection panel">
      <div className={headerClassName}>
        <div className="flex flex-col gap-0.5">
          <div className={`${titleClassName} ${isDisabled ? titleDisabledClassName : ""}`}>Selection</div>
          {isDisabled ? <div className={subtitleClassName}>No selection</div> : null}
        </div>
        <button
          className={collapseButtonClassName}
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-label={collapsed ? "Expand selection panel" : "Collapse selection panel"}
          title={collapsed ? "Expand" : "Collapse"}
        >
          <FontAwesomeIcon icon={collapsed ? faChevronDown : faChevronUp} />
        </button>
      </div>
      {collapsed ? null : (
        <div className={contentClassName}>
          <div className={sectionTitleClassName}>Transform</div>
          <div className="flex items-center gap-2">
            <div
              className="flex flex-1 items-center justify-between rounded-lg border border-[var(--seg-border)] bg-[var(--seg-bg)] px-2 py-1.5"
            >
              <div className="flex items-center gap-2" role="radiogroup" aria-label="Transform mode">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  Mode
                </span>
                <div className={segmentedClassName}>
                  <button
                    className={`${segmentedButtonBaseClassName} ${
                      mode === "translate" ? segmentedButtonActiveClassName : ""
                    }`}
                onClick={() => onChangeMode("translate")}
                title="Move"
                aria-label="Move"
                role="radio"
                aria-checked={mode === "translate"}
                disabled={isDisabled}
              >
                <FontAwesomeIcon icon={faUpDownLeftRight} />
              </button>
              <button
                className={`${segmentedButtonBaseClassName} ${mode === "rotate" ? segmentedButtonActiveClassName : ""}`}
                onClick={() => onChangeMode("rotate")}
                title="Rotate"
                aria-label="Rotate"
                role="radio"
                aria-checked={mode === "rotate"}
                disabled={isDisabled}
              >
                <FontAwesomeIcon icon={faRotate} />
              </button>
              <button
                className={`${segmentedButtonBaseClassName} ${mode === "scale" ? segmentedButtonActiveClassName : ""}`}
                onClick={() => onChangeMode("scale")}
                title="Scale"
                aria-label="Scale"
                role="radio"
                aria-checked={mode === "scale"}
                disabled={isDisabled}
                  >
                    <FontAwesomeIcon icon={faUpRightAndDownLeftFromCenter} />
                  </button>
                </div>
              </div>
              <div className="h-6 w-px bg-[var(--seg-border)]" />
              <button
                className={`${buttonBaseClassName} ${buttonCompactClassName} ${buttonDangerClassName}`}
                onClick={() => onChangeMode("reset")}
                title="Reset"
                aria-label="Reset"
                disabled={isDisabled}
              >
              <FontAwesomeIcon icon={faRotateLeft} className="text-[10px]" />
              </button>
            </div>
          </div>

          <div className={sectionTitleClassName}>Edit</div>
          <div className={rowClassName}>
            <div className={labelClassName}>Actions</div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                className={`${buttonBaseClassName} ${buttonWideClassName}`}
                onClick={onSnapToGround}
                disabled={isDisabled}
                type="button"
              >
                Snap
              </button>
              <button
                className={`${buttonBaseClassName} ${buttonWideClassName} ${clippingEnabled ? segmentedButtonActiveClassName : ""}`}
                onClick={handleToggleClip}
                disabled={isDisabled}
                type="button"
              >
                <span className={`${statusDotBaseClassName} ${clippingEnabled ? statusDotOnClassName : statusDotOffClassName}`} />
                <span className="ml-1">Clip</span>
              </button>
              <button
                className={`${buttonBaseClassName} ${buttonWideClassName} ${footprintEnabled ? segmentedButtonActiveClassName : ""}`}
                onClick={handleToggleFootprint}
                disabled={isDisabled}
                type="button"
                style={{ gridColumn: "span 2" }}
              >
                <span className={`${statusDotBaseClassName} ${footprintEnabled ? statusDotOnClassName : statusDotOffClassName}`} />
                <span className="ml-1">Footprint</span>
              </button>
            </div>
          </div>

          {groups.map((group) => (
            <div key={group.key} className={rowClassName}>
              <div className={labelClassName}>{group.label}</div>
              <div className="grid gap-1">
                {axisLabels.map((axis, axisIndex) => {
                  const fieldKey = `${group.key}-${axis}`;
                  return (
                    <label key={fieldKey} className={axisGridClassName}>
                      <span className="text-[10px] font-semibold text-[var(--text-muted)]">{axis}</span>
                      <div className="flex items-center">
                        <input
                          className={inputClassName}
                          value={draft[group.key][axisIndex]}
                          onChange={(event) => {
                            const next = clampTextValue(event.target.value);
                            setDraft((prev) => {
                              const clone = { ...prev } as TransformDraft;
                              clone[group.key] = [...clone[group.key]] as TransformDraft[TransformGroupKey];
                              clone[group.key][axisIndex] = next;
                              return clone;
                            });
                          }}
                          onFocus={() => setEditingKey(fieldKey)}
                          onBlur={() => {
                            setEditingKey(null);
                            commitValue(group.key, axisIndex);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              (event.target as HTMLInputElement).blur();
                            }
                          }}
                          disabled={isDisabled}
                          inputMode="decimal"
                        />
                        {group.unit ? <span className={unitClassName}>{group.unit}</span> : null}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          <div className={dividerClassName} />
          <div className={modeRowClassName}>
            <div className={labelClassName}>Mode</div>
            <select className={selectClassName} disabled>
              <option>XYZ Euler</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
