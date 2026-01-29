import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBorderAll,
  faCircleHalfStroke,
  faClock,
  faLayerGroup,
  faLocationDot,
} from "@fortawesome/free-solid-svg-icons";
import type { MapStyleOption, ThemeMode } from "@/types/common";

type FlyToState = {
  open: boolean;
  lat: string;
  lng: string;
  zoom: string;
};

interface Props {
  showTiles: boolean;
  onToggleTiles: () => void;
  onAddLayer: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  styleOptions: MapStyleOption[];
  styleId: string;
  onChangeStyle: (styleId: string) => void;
  onFlyTo: (lat: number, lng: number, zoom?: number) => void;
  defaultZoom: number;
  showShadowTime: boolean;
  onToggleShadowTime: () => void;
  mapControlsRef?: React.RefObject<HTMLDivElement | null>;
}

function clampTextValue(value: string): string {
  return value.replace(/[^0-9+\-.]/g, "");
}

export const EditorToolbar = ({
  showTiles,
  onToggleTiles,
  onAddLayer,
  theme,
  onToggleTheme,
  styleOptions,
  styleId,
  onChangeStyle,
  onFlyTo,
  defaultZoom,
  showShadowTime,
  onToggleShadowTime,
  mapControlsRef,
}: Props) => {
  const [flyTo, setFlyTo] = useState<FlyToState>({
    open: false,
    lat: "10.8231",
    lng: "106.6297",
    zoom: String(defaultZoom),
  });

  const barClassName =
    "absolute left-4 top-3 z-[2000] inline-flex max-w-[calc(100%-2rem)] flex-wrap items-center gap-2 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-[var(--text)] shadow-[var(--panel-shadow)]";
  const titleClassName =
    "text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]";
  const groupClassName =
    "flex items-center gap-2 border-r border-[var(--divider)] pr-2";
  const logoClassName =
    "h-6 w-6 rounded-md border border-[var(--btn-border)] bg-[var(--btn-bg)] p-1";
  const groupLastClassName = "flex items-center gap-2";
  const mapControlsClassName =
    "maplibre-topbar-controls flex items-center gap-2";
  const labelClassName =
    "text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]";
  const selectClassName =
    "h-8 rounded-md border border-[var(--btn-border)] bg-[var(--btn-bg)] px-2 text-[11px] text-[var(--text)] outline-none transition focus:border-[var(--btn-active-border)] focus:ring-2 focus:ring-[color:var(--focus-ring)]/40";
  const buttonBaseClassName =
    "flex h-8 items-center justify-center rounded-md border border-[var(--btn-border)] bg-[var(--btn-bg)] text-[12px] text-[var(--text)] transition hover:-translate-y-px hover:border-[var(--btn-border-hover)] hover:bg-[var(--btn-hover)]";
  const buttonIconClassName = "w-8";
  const buttonWideClassName = "px-2.5";
  const buttonActiveClassName =
    "border-[var(--btn-active-border)] bg-[var(--btn-active-bg)] text-[var(--btn-active-text)] shadow-[var(--btn-active-ring)]";
  const themeToggleActiveClassName =
    "border-[var(--btn-active-border)] bg-[var(--btn-active-bg)] text-[var(--btn-active-text)] shadow-[var(--btn-active-ring)]";
  const modalOverlayClassName =
    "fixed inset-0 z-[2100] flex items-center justify-center bg-gradient-to-b from-black/50 via-black/40 to-black/60 backdrop-blur-md";
  const modalClassName =
    "w-[280px] rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 text-[var(--text)] shadow-[var(--panel-shadow)]";
  const modalTitleClassName =
    "text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]";
  const modalSubtitleClassName = "text-[11px] text-[var(--text-muted)]";
  const modalActionsClassName = "mt-3 flex justify-end gap-2";
  const inputClassName =
    "h-8 w-full rounded-md border border-[var(--btn-border)] bg-[var(--btn-bg)] px-2 text-[12px] text-[var(--text)] outline-none transition focus:border-[var(--btn-active-border)] focus:ring-2 focus:ring-[color:var(--focus-ring)]/30";
  const axisGridClassName = "grid grid-cols-[28px_1fr] items-center gap-2";
  const pillClassName =
    "inline-flex items-center gap-2 rounded-full border border-[var(--btn-border)] bg-[var(--btn-bg)] px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]";
  const buttonPrimaryClassName =
    "border-[var(--btn-active-border)] bg-[var(--btn-active-bg)] text-[var(--btn-active-text)] shadow-[var(--btn-active-ring)]";

  const handleFlyTo = () => {
    const lat = Number.parseFloat(flyTo.lat);
    const lng = Number.parseFloat(flyTo.lng);
    const zoom = flyTo.zoom.trim() ? Number.parseFloat(flyTo.zoom) : undefined;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }
    if (flyTo.zoom.trim() && !Number.isFinite(zoom)) {
      return;
    }
    onFlyTo(lat, lng, zoom);
  };

  return (
    <>
      <div className={barClassName}>
        <div className={groupClassName}>
          <img
            src="/logo-64.svg"
            alt="3D Scene Editor"
            className={logoClassName}
          />
          <div className={titleClassName}>Scene Editor</div>
        </div>

        <div className={groupClassName}>
          <span className={labelClassName}>Map</span>
          {mapControlsRef ? (
            <div
              className={mapControlsClassName}
              ref={mapControlsRef}
              data-maplibre-topbar="true"
            />
          ) : null}
          <button
            className={`${buttonBaseClassName} ${buttonIconClassName}`}
            onClick={() => setFlyTo((prev) => ({ ...prev, open: true }))}
            type="button"
            title="Fly To"
            aria-label="Fly To"
          >
            <FontAwesomeIcon icon={faLocationDot} />
          </button>
        </div>

        <div className={groupClassName}>
          <span className={labelClassName}>Style</span>
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
          <button
            className={`${buttonBaseClassName} ${buttonIconClassName} ${theme === "dark" ? themeToggleActiveClassName : ""}`}
            onClick={onToggleTheme}
            type="button"
            title={
              theme === "dark"
                ? "Switch to light theme"
                : "Switch to dark theme"
            }
            aria-label={
              theme === "dark"
                ? "Switch to light theme"
                : "Switch to dark theme"
            }
          >
            <FontAwesomeIcon
              icon={faCircleHalfStroke}
              className={`transition-transform duration-200 ${theme === "dark" ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        <div className={groupClassName}>
          <span className={labelClassName}>View</span>
          <button
            className={`${buttonBaseClassName} ${buttonIconClassName} ${showTiles ? buttonActiveClassName : ""}`}
            onClick={onToggleTiles}
            title="Tile Boundaries"
            aria-label="Tile Boundaries"
            type="button"
          >
            <FontAwesomeIcon icon={faBorderAll} />
          </button>
          <button
            className={`${buttonBaseClassName} ${buttonIconClassName} ${showShadowTime ? buttonActiveClassName : ""}`}
            onClick={onToggleShadowTime}
            title={showShadowTime ? "Hide shadow time" : "Show shadow time"}
            aria-label={
              showShadowTime ? "Hide shadow time" : "Show shadow time"
            }
            type="button"
          >
            <FontAwesomeIcon icon={faClock} />
          </button>
        </div>

        <div className={groupLastClassName}>
          <span className={labelClassName}>Layer</span>
          <button
            className={`${buttonBaseClassName} ${buttonIconClassName}`}
            onClick={onAddLayer}
            title="Add Edit Layer"
            aria-label="Add Edit Layer"
            type="button"
          >
            <FontAwesomeIcon icon={faLayerGroup} />
          </button>
        </div>
      </div>

      {flyTo.open ? (
        <div className={modalOverlayClassName} role="dialog" aria-modal="true">
          <div className={modalClassName}>
            <div className="flex items-center justify-between">
              <div>
                <div className={modalTitleClassName}>Fly To</div>
                <div className={modalSubtitleClassName}>
                  Jump to coordinates
                </div>
              </div>
              <span className={pillClassName}>
                <FontAwesomeIcon icon={faLocationDot} />
                Geo
              </span>
            </div>
            <div className="mt-3 grid gap-2.5">
              <label className={axisGridClassName}>
                <span className="text-[10px] font-semibold text-(--text-muted)">
                  Lat
                </span>
                <input
                  className={inputClassName}
                  value={flyTo.lat}
                  onChange={(event) =>
                    setFlyTo((prev) => ({
                      ...prev,
                      lat: clampTextValue(event.target.value),
                    }))
                  }
                  inputMode="decimal"
                />
              </label>
              <label className={axisGridClassName}>
                <span className="text-[10px] font-semibold text-(--text-muted)">
                  Lng
                </span>
                <input
                  className={inputClassName}
                  value={flyTo.lng}
                  onChange={(event) =>
                    setFlyTo((prev) => ({
                      ...prev,
                      lng: clampTextValue(event.target.value),
                    }))
                  }
                  inputMode="decimal"
                />
              </label>
              <label className={axisGridClassName}>
                <span className="text-[10px] font-semibold text-(--text-muted)">
                  Zoom
                </span>
                <input
                  className={inputClassName}
                  value={flyTo.zoom}
                  onChange={(event) =>
                    setFlyTo((prev) => ({
                      ...prev,
                      zoom: clampTextValue(event.target.value),
                    }))
                  }
                  inputMode="decimal"
                />
              </label>
            </div>
            <div className={modalActionsClassName}>
              <button
                className={`${buttonBaseClassName} ${buttonWideClassName}`}
                type="button"
                onClick={() => setFlyTo((prev) => ({ ...prev, open: false }))}
              >
                Cancel
              </button>
              <button
                className={`${buttonBaseClassName} ${buttonWideClassName} ${buttonPrimaryClassName}`}
                type="button"
                onClick={() => {
                  handleFlyTo();
                  setFlyTo((prev) => ({ ...prev, open: false }));
                }}
              >
                Fly
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};
