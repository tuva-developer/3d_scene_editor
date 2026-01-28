import { useState } from "react";
import type { LayerOption, MapStyleOption, ThemeMode } from "@/types/common";

interface Props {
  showTiles: boolean;
  onToggleTiles: () => void;
  enableClippingPlane: (enable: boolean) => void;
  enableFootPrintWhenEdit: (enable: boolean) => void;
  onAddLayer: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  styleOptions: MapStyleOption[];
  styleId: string;
  onChangeStyle: (styleId: string) => void;
  layerOptions: LayerOption[];
  activeLayerId: string;
  onChangeActiveLayer: (layerId: string) => void;
}

export const EditorToolbar = ({
  showTiles,
  onToggleTiles,
  enableClippingPlane,
  enableFootPrintWhenEdit,
  onAddLayer,
  theme,
  onToggleTheme,
  styleOptions,
  styleId,
  onChangeStyle,
  layerOptions,
  activeLayerId,
  onChangeActiveLayer,
}: Props) => {
  const [clippingEnabled, setClippingEnabled] = useState(false);
  const [footprintEnabled, setFootprintEnabled] = useState(false);

  const panelClassName =
    "absolute left-4 top-4 z-[2000] flex w-[312px] max-w-[min(92vw,360px)] flex-col gap-2 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-2 text-[var(--text)] shadow-[var(--panel-shadow)]";
  const headerClassName =
    "flex items-baseline justify-between gap-2 border-b border-[var(--divider)] px-0.5 pb-2";
  const headerMetaClassName = "flex flex-col gap-px";
  const titleClassName = "text-[13px] font-semibold tracking-[0.02em]";
  const subtitleClassName = "text-[10px] uppercase tracking-[0.06em] text-[var(--text-muted)]";
  const themeToggleClassName =
    "grid h-8 w-8 place-items-center rounded-[7px] border border-[var(--btn-border)] bg-[var(--btn-bg)] text-[var(--text)] transition hover:-translate-y-px hover:border-[var(--btn-border-hover)] hover:bg-[var(--btn-hover)]";
  const themeToggleActiveClassName =
    "border-[var(--btn-active-border)] bg-[var(--btn-active-bg)] text-[var(--btn-active-text)] shadow-[var(--btn-active-ring)]";
  const sectionsClassName = "flex flex-col gap-2.5";
  const sectionClassName = "flex flex-col gap-1.5";
  const sectionHeadingClassName = "px-0.5 text-[11px] font-semibold text-[var(--section-heading)]";
  const sectionBodyClassName = "flex items-center gap-1.5";
  const sectionBodyColumnClassName = "flex flex-col gap-1.5";
  const toolGridClassName = "grid w-full grid-cols-2 gap-1.5";
  const selectClassName =
    "h-9 w-full rounded-md border border-[var(--btn-border)] bg-[var(--btn-bg)] px-2.5 text-[13px] font-medium text-[var(--text)] outline-none transition focus:border-[var(--btn-active-border)] focus:ring-2 focus:ring-[color:var(--focus-ring)]/40";
  const buttonBaseClassName =
    "flex items-center rounded-lg border border-[var(--btn-border)] bg-[var(--btn-bg)] text-[15px] text-[var(--text)] transition hover:-translate-y-px hover:border-[var(--btn-border-hover)] hover:bg-[var(--btn-hover)]";
  const buttonStandardClassName = "h-11 w-full gap-2 px-2.5 text-left";
  const buttonActiveClassName =
    "border-[var(--btn-active-border)] bg-[var(--btn-active-bg)] text-[var(--btn-active-text)] shadow-[var(--btn-active-ring)]";
  const toolLabelClassName = "text-[11px] font-semibold tracking-[0.01em]";
  const srOnlyClassName =
    "sr-only";

  return (
    <div className={panelClassName}>
      <div className={headerClassName}>
        <div className={headerMetaClassName}>
          <div className={titleClassName}>Scene Editor</div>
          <div className={subtitleClassName}>Tools & View</div>
        </div>
        <button
          className={`${themeToggleClassName} ${theme === "dark" ? themeToggleActiveClassName : ""}`}
          onClick={onToggleTheme}
          type="button"
          title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          <i
            className={`fa-solid fa-circle-half-stroke transition-transform duration-200 ${
              theme === "dark" ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      <div className={sectionsClassName}>
        <section className={sectionClassName} aria-label="Map style">
          <div className={sectionHeadingClassName}>Style</div>
          <div className={sectionBodyClassName}>
            <label className="sr-only" htmlFor="map-style-select">
              Map style
            </label>
            <select
              id="map-style-select"
              className={selectClassName}
              value={styleId}
              onChange={(event) => onChangeStyle(event.target.value)}
            >
              {styleOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className={sectionClassName} aria-label="View tools">
          <div className={sectionHeadingClassName}>View</div>
          <div className={toolGridClassName}>
            <button
              className={`${buttonBaseClassName} ${buttonStandardClassName} ${clippingEnabled ? buttonActiveClassName : ""}`}
              onClick={() => {
                const next = !clippingEnabled;
                setClippingEnabled(next);
                enableClippingPlane(next);
              }}
              title="Clipping Plane"
              aria-label="Clipping Plane"
            >
              <i className="fa-solid fa-scissors" />
              <span className={toolLabelClassName}>Clip</span>
            </button>
            <button
              className={`${buttonBaseClassName} ${buttonStandardClassName} ${footprintEnabled ? buttonActiveClassName : ""}`}
              onClick={() => {
                const next = !footprintEnabled;
                setFootprintEnabled(next);
                enableFootPrintWhenEdit(next);
              }}
              title="Footprint"
              aria-label="Footprint"
            >
              <i className="fa-solid fa-shoe-prints" />
              <span className={toolLabelClassName}>Footprint</span>
            </button>
          </div>
        </section>

        <div className="my-0.5 h-px w-full bg-(--divider)" />

        <section className={sectionClassName} aria-label="Layer tools">
          <div className={sectionHeadingClassName}>Layer</div>
          <div className={sectionBodyColumnClassName}>
            <label className="sr-only" htmlFor="layer-select">
              Active layer
            </label>
            <select
              id="layer-select"
              className={selectClassName}
              value={activeLayerId}
              onChange={(event) => onChangeActiveLayer(event.target.value)}
            >
              {layerOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              className={`${buttonBaseClassName} ${buttonStandardClassName}`}
              onClick={onAddLayer}
              title="Add Edit Layer"
              aria-label="Add Edit Layer"
            >
              <i className="fa-solid fa-layer-group" />
              <span className={toolLabelClassName}>Add Layer</span>
            </button>
          </div>
        </section>

        <section className={sectionClassName} aria-label="Tile tools">
          <div className={sectionHeadingClassName}>Tiles</div>
          <div className={sectionBodyClassName}>
            <button
              className={`${buttonBaseClassName} ${buttonStandardClassName} ${showTiles ? buttonActiveClassName : ""}`}
              onClick={onToggleTiles}
              title="Tile Boundaries"
              aria-label="Tile Boundaries"
            >
              <i className="fa-solid fa-border-all" />
              <span className={toolLabelClassName}>Boundaries</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
