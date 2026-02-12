import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBorderAll,
  faCircleHalfStroke,
  faClock,
  faCloudRain,
  faCloudMoon,
  faCloudSun,
  faLocationDot,
  faMoon,
  faSnowflake,
  faSun,
} from "@fortawesome/free-solid-svg-icons";
import type { ThemeMode } from "@/types/common";

type WeatherOption = "sun" | "rain" | "snow";
type DaylightMode = "morning" | "noon" | "evening" | "night";

type FlyToState = {
  open: boolean;
  lat: string;
  lng: string;
  zoom: string;
};

type SearchResponse = {
  Error: string | null;
  IsSuccess: boolean;
  ResponseTime: string;
  HasMoreItem: boolean;
  List: string[];
  TotalCount: number;
};

type GeoCodingResponse = {
  Value?: {
    Result?: {
      Latitude?: number;
      Longitude?: number;
    };
  };
};

interface Props {
  showTiles: boolean;
  onToggleTiles: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onFlyTo: (lat: number, lng: number, zoom?: number) => void;
  defaultZoom: number;
  showShadowTime: boolean;
  onToggleShadowTime: () => void;
  weather: WeatherOption;
  onChangeWeather: (weather: WeatherOption) => void;
  daylight: DaylightMode;
  onChangeDaylight: (mode: DaylightMode) => void;
  rainDensity: number;
  snowDensity: number;
  onChangeRainDensity: (value: number) => void;
  onChangeSnowDensity: (value: number) => void;
  mapControlsRef?: React.RefObject<HTMLDivElement | null>;
}

function clampTextValue(value: string): string {
  return value.replace(/[^0-9+\-.]/g, "");
}

export const EditorToolbar = ({
  showTiles,
  onToggleTiles,
  theme,
  onToggleTheme,
  onFlyTo,
  defaultZoom,
  showShadowTime,
  onToggleShadowTime,
  weather,
  onChangeWeather,
  daylight,
  onChangeDaylight,
  rainDensity,
  snowDensity,
  onChangeRainDensity,
  onChangeSnowDensity,
  mapControlsRef,
}: Props) => {
  const [weatherMenuOpen, setWeatherMenuOpen] = useState(false);
  const weatherMenuRef = useRef<HTMLDivElement | null>(null);
  const [daylightMenuOpen, setDaylightMenuOpen] = useState(false);
  const daylightMenuRef = useRef<HTMLDivElement | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
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
  const groupLastClassName = "flex items-center gap-2";
  const logoClassName =
    "h-7 w-7 rounded-md";
  const mapControlsClassName =
    "maplibre-topbar-controls flex items-center gap-2";
  const labelClassName =
    "text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]";
  const buttonBaseClassName =
    "flex h-8 items-center justify-center rounded-md border border-[var(--btn-border)] bg-[var(--btn-bg)] text-[12px] text-[var(--text)] transition hover:border-[var(--btn-border-hover)] hover:bg-[var(--btn-hover)]";
  const buttonIconClassName = "w-8";
  const buttonWideClassName = "px-2.5";
  const buttonActiveClassName =
    "border-[var(--btn-active-border)] bg-[var(--btn-active-bg)] text-[var(--btn-active-text)]";
  const themeToggleActiveClassName =
    "border-[var(--btn-active-border)] bg-[var(--btn-active-bg)] text-[var(--btn-active-text)]";
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

  const weatherCycle: Record<WeatherOption, WeatherOption> = {
    sun: "rain",
    rain: "snow",
    snow: "sun",
  };
  const weatherLabel: Record<WeatherOption, string> = {
    sun: "Sun",
    rain: "Rain",
    snow: "Snow",
  };
  const weatherIcon: Record<WeatherOption, typeof faSun> = {
    sun: faSun,
    rain: faCloudRain,
    snow: faSnowflake,
  };
  const weatherMenuClassName =
    "absolute left-0 top-full z-[2100] mt-2 grid min-w-[120px] gap-1 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-1 shadow-[var(--panel-shadow)]";
  const weatherMenuItemClassName =
    "flex h-8 items-center gap-2 rounded-md px-2 text-[11px] text-[var(--text)] transition hover:bg-[var(--btn-hover)]";
  const weatherMenuItemActiveClassName =
    "bg-[var(--btn-active-bg)] text-[var(--btn-active-text)]";
  const weatherSliderClassName =
    "h-8 w-full cursor-pointer accent-[var(--btn-active-bg)]";
  const searchInputClassName =
    "h-9 w-[260px] rounded-full border border-[var(--btn-border)] bg-[var(--btn-bg)] px-9 text-[12px] text-[var(--text)] shadow-[var(--panel-shadow)] outline-none transition focus:border-[var(--btn-active-border)] focus:ring-2 focus:ring-[color:var(--focus-ring)]/40 placeholder:text-[var(--text-muted)]";
  const searchItemClassName =
    "flex min-h-8 items-start gap-2 text-left rounded-md px-2 py-1 text-[12px] transition";
  const daylightLabel: Record<DaylightMode, string> = {
    morning: "Morning",
    noon: "Noon",
    evening: "Evening",
    night: "Night",
  };
  const daylightIcon: Record<DaylightMode, typeof faSun> = {
    morning: faCloudSun,
    noon: faSun,
    evening: faCloudMoon,
    night: faMoon,
  };

  useEffect(() => {
    if (!weatherMenuOpen) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (weatherMenuRef.current?.contains(target)) {
        return;
      }
      setWeatherMenuOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [weatherMenuOpen]);

  useEffect(() => {
    if (!daylightMenuOpen) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (daylightMenuRef.current?.contains(target)) {
        return;
      }
      setDaylightMenuOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [daylightMenuOpen]);

  useEffect(() => {
    if (!searchOpen) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (searchRef.current?.contains(target)) {
        return;
      }
      setSearchOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [searchOpen]);

  useEffect(() => {
    const keyword = searchValue.trim();
    if (keyword.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setSearchLoading(true);
        setSearchError(null);
        const registerKey =
          (import.meta.env.VITE_VIETBANDO_REGISTER_KEY as string | undefined)?.trim() ||
          "00d1eec9-0632-42ba-a085-2133667b3cd9";
        const response = await fetch(
          "/api/vbd/AutoSuggestSearch",
          {
            method: "POST",
            headers: {
              Connection: "keep-alive",
              "Content-Type": "application/json",
              RegisterKey: registerKey,
            },
            body: JSON.stringify({ Keyword: keyword }),
            signal: controller.signal,
          }
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = (await response.json()) as SearchResponse;
        if (!data.IsSuccess) {
          throw new Error(data.Error || "Search failed");
        }
        setSearchResults(data.List ?? []);
      } catch (err) {
        if ((err as DOMException).name === "AbortError") {
          return;
        }
        setSearchError((err as Error).message || "Search failed");
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [searchValue]);

  const handleSelectSuggestion = async (address: string) => {
    setSearchValue(address);
    setSearchOpen(false);
    setGeoLoading(true);
    try {
      const registerKey =
        (import.meta.env.VITE_VIETBANDO_REGISTER_KEY as string | undefined)?.trim() ||
        "00d1eec9-0632-42ba-a085-2133667b3cd9";
      const response = await fetch("/api/vbd/GeoCoding", {
        method: "POST",
        headers: {
          Connection: "keep-alive",
          "Content-Type": "application/json",
          RegisterKey: registerKey,
        },
        body: JSON.stringify({ Address: address }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as GeoCodingResponse;
      const lat = data.Value?.Result?.Latitude;
      const lon = data.Value?.Result?.Longitude;
      if (typeof lat === "number" && typeof lon === "number") {
        onFlyTo(lat, lon, defaultZoom);
      } else {
        throw new Error("No location data");
      }
    } catch (err) {
      setSearchError((err as Error).message || "GeoCoding failed");
    } finally {
      setGeoLoading(false);
    }
  };

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
          <div className="relative" ref={searchRef}>
            <label className="sr-only" htmlFor="map-search-input">
              Search location
            </label>
            <input
              id="map-search-input"
              className={searchInputClassName}
              value={searchValue}
              placeholder="Search location"
              onFocus={() => setSearchOpen(true)}
              onChange={(event) => {
                setSearchValue(event.target.value);
                setSearchOpen(true);
              }}
              type="text"
              autoComplete="off"
            />
            <span
              className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${
                theme === "dark" ? "text-slate-400" : "text-slate-400"
              }`}
            >
              <FontAwesomeIcon icon={faLocationDot} />
            </span>
            {searchOpen && (searchLoading || searchError || searchResults.length > 0) ? (
              <div
              className="absolute left-0 top-full z-[2100] mt-2 w-[320px] rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-1 shadow-[var(--panel-shadow)] backdrop-blur"
                role="listbox"
              >
                {searchLoading ? (
                  <div className="px-2 py-1 text-[12px] text-[var(--text-muted)]">
                    Searching...
                  </div>
                ) : null}
                {geoLoading ? (
                  <div className="px-2 py-1 text-[12px] text-[var(--text-muted)]">
                    Locating...
                  </div>
                ) : null}
                {searchError ? (
                  <div className="px-2 py-1 text-[12px] text-rose-500">
                    {searchError}
                  </div>
                ) : null}
                {!searchLoading && !searchError && searchResults.length === 0 ? (
                  <div className="px-2 py-1 text-[12px] text-[var(--text-muted)]">
                    No results
                  </div>
                ) : null}
                {searchResults.map((item) => (
                  <button
                    key={item}
                    className={`${searchItemClassName} text-[var(--text)] hover:bg-[var(--btn-hover)]`}
                    type="button"
                    role="option"
                    onClick={() => {
                      handleSelectSuggestion(item);
                    }}
                  >
                    <span className="mt-0.5 text-[var(--text-muted)]">
                      <FontAwesomeIcon icon={faLocationDot} />
                    </span>
                    {item}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
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
          <span className={labelClassName}>Theme</span>
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
          <span className={labelClassName}>Weather</span>
          <div className="relative" ref={weatherMenuRef}>
            <button
              className={`${buttonBaseClassName} ${buttonWideClassName} gap-1`}
              onClick={() => setWeatherMenuOpen((prev) => !prev)}
              title={`Weather: ${weatherLabel[weather]}`}
              aria-label={`Weather: ${weatherLabel[weather]}`}
              type="button"
            >
              <FontAwesomeIcon icon={weatherIcon[weather]} />
              {weatherLabel[weather]}
            </button>
            {weatherMenuOpen ? (
              <div className={weatherMenuClassName} role="menu">
                {(["sun", "rain", "snow"] as WeatherOption[]).map((option) => (
                  <button
                    key={option}
                    className={`${weatherMenuItemClassName} ${weather === option ? weatherMenuItemActiveClassName : ""}`}
                    onClick={() => {
                      onChangeWeather(option);
                      setWeatherMenuOpen(false);
                    }}
                    type="button"
                    role="menuitem"
                  >
                    <FontAwesomeIcon icon={weatherIcon[option]} />
                    {weatherLabel[option]}
                  </button>
                ))}
                <div className="mt-1 rounded-md border border-[var(--divider)] bg-[var(--panel-bg)] px-2 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    Rain Density
                  </div>
                  <input
                    className={weatherSliderClassName}
                    type="range"
                    min="0.2"
                    max="3"
                    step="0.1"
                    value={rainDensity}
                    onChange={(event) => onChangeRainDensity(Number(event.target.value))}
                  />
                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    Snow Density
                  </div>
                  <input
                    className={weatherSliderClassName}
                    type="range"
                    min="0.2"
                    max="3"
                    step="0.1"
                    value={snowDensity}
                    onChange={(event) => onChangeSnowDensity(Number(event.target.value))}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className={groupClassName}>
          <span className={labelClassName}>Daylight</span>
          <div className="relative" ref={daylightMenuRef}>
            <button
              className={`${buttonBaseClassName} ${buttonWideClassName} gap-2`}
              onClick={() => setDaylightMenuOpen((prev) => !prev)}
              title={`Daylight: ${daylightLabel[daylight]}`}
              aria-label={`Daylight: ${daylightLabel[daylight]}`}
              type="button"
            >
              <FontAwesomeIcon icon={daylightIcon[daylight]} />
              {daylightLabel[daylight]}
            </button>
            {daylightMenuOpen ? (
              <div className={weatherMenuClassName} role="menu">
                {(["morning", "noon", "evening", "night"] as DaylightMode[]).map((option) => (
                  <button
                    key={option}
                    className={`${weatherMenuItemClassName} ${daylight === option ? weatherMenuItemActiveClassName : ""}`}
                    onClick={() => {
                      onChangeDaylight(option);
                      setDaylightMenuOpen(false);
                    }}
                    type="button"
                    role="menuitem"
                  >
                    <FontAwesomeIcon icon={daylightIcon[option]} />
                    {daylightLabel[option]}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className={groupLastClassName}>
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
