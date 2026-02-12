import React, { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import maplibregl from "maplibre-gl";
import type { WebGLContextAttributesWithType } from "maplibre-gl";
import { ModelLayer } from "@/components/map/layers/ModelLayer";
import { OverlayLayer } from "@/components/map/layers/OverlayLayer";
import OutlineLayer from "@/components/map/layers/OutlineLayer";
import { EditLayer } from "@/components/map/layers/EditLayer";
import type { LayerOption, TransformMode, TransformValues } from "@/types/common";
import { loadModelFromGlb, type LightGroupOption } from "@/components/map/data/models/objModel";
import { getSunPosition, getSunPositionAt } from "@/components/map/shadow/ShadowHelper";
import { MathUtils } from "three";
import { CustomVectorSource } from "@/components/map/source/CustomVectorSource";
import { WaterLayer } from "@/components/map/water/WaterLayer";
import { normalizeWaterSettings, type WaterSettings } from "@/components/map/water/WaterMaterial";
import { InstanceLayer } from "@/components/map/instance/InstanceLayer";

type WeatherMode = "sun" | "rain" | "snow";
type DaylightMode = "morning" | "noon" | "evening" | "night";

interface MapViewProps {
  center?: [number, number];
  zoom?: number;
  styleUrl?: string;
  activeLayerId?: string;
  style?: React.CSSProperties;
  showTileBoundaries?: boolean;
  weather?: WeatherMode;
  daylight?: DaylightMode;
  rainDensity?: number;
  snowDensity?: number;
  mapControlsRef?: React.RefObject<HTMLDivElement | null>;
  onSelectionChange?: (selected: boolean) => void;
  onSelectionElevationChange?: (elevation: number | null) => void;
  onTransformDirtyChange?: (dirty: boolean) => void;
  onLayerOptionsChange?: (options: LayerOption[]) => void;
}

export interface MapViewHandle {
  setTransformMode(m: TransformMode): void;
  setShowTileBoundaries(show: boolean): void;
  snapObjectSelectedToGround(): void;
  enableClippingPlanesObjectSelected(enable: boolean): void;
  enableFootPrintWhenEdit(enable: boolean): void;
  addEditLayer(options?: { name?: string; modelUrl?: string; coords?: { lat: number; lng: number } }): string | null;
  addModelToLayer(
    layerId: string,
    options?: { modelUrl?: string; coords?: { lat: number; lng: number }; instanceId?: string; name?: string }
  ): boolean;
  removeModelFromLayer(layerId: string, instanceId: string): boolean;
  cloneModelInLayer(layerId: string, instanceId: string, newInstanceId: string): boolean;
  getSelectedTransform(): TransformValues | null;
  setSelectedTransform(values: Partial<TransformValues>): void;
  flyToLatLng(lat: number, lng: number, zoom?: number): void;
  getCenter(): { lat: number; lng: number } | null;
  setLayerVisibility(id: string, visible: boolean): void;
  setLayerLightOption(id: string, option: LightGroupOption): void;
  removeLayer(id: string): void;
  setSunTime(date: Date): void;
  addInstanceLayer(options: {
    tileUrl: string;
    sourceLayer: string;
    modelUrls: string[];
    layerId?: string;
    minZoom?: number;
    maxZoom?: number;
    tileSize?: number;
    applyGlobeMatrix?: boolean;
  }): string | null;
  addWaterLayer(options: {
    tileUrl: string;
    sourceLayer: string;
    normalTextureUrl?: string;
    settings?: WaterSettings;
    layerId?: string;
    minZoom?: number;
    maxZoom?: number;
    tileSize?: number;
    applyGlobeMatrix?: boolean;
  }): string | null;
  setWaterLayerSettings(layerId: string, settings: WaterSettings): void;
}

function addControlMaplibre(map: maplibregl.Map, container?: HTMLElement | null): () => void {
  const navControl = new maplibregl.NavigationControl();
  const fullscreenControl = new maplibregl.FullscreenControl();
  const scaleControl = new maplibregl.ScaleControl();

  if (container) {
    const elements = [navControl, fullscreenControl].map((control) => control.onAdd(map));
    elements.forEach((el) => container.appendChild(el));
    map.addControl(scaleControl, "bottom-left");
    return () => {
      [navControl, fullscreenControl].forEach((control) => control.onRemove?.());
      elements.forEach((el) => el.parentElement?.removeChild(el));
      map.removeControl(scaleControl);
    };
  }

  map.addControl(navControl, "bottom-right");
  map.addControl(fullscreenControl, "bottom-right");
  map.addControl(scaleControl, "bottom-left");
  return () => {
    [navControl, fullscreenControl, scaleControl].forEach((control) => map.removeControl(control));
  };
}

function generateId(): string {
  const cryptoObj = globalThis.crypto as Crypto | undefined;
  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }
  const rand = Math.random().toString(36).slice(2, 10);
  return `layer-${Date.now().toString(36)}-${rand}`;
}

type RainDrop = {
  x: number;
  y: number;
  len: number;
  vy: number;
  vx: number;
  alpha: number;
};

type SnowFlake = {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  alpha: number;
};

const daylightPresets: Record<
  DaylightMode,
  {
    tint: { color: string; opacity: number; blend: React.CSSProperties["mixBlendMode"] };
    light: LightGroupOption;
  }
> = {
  morning: {
    tint: { color: "#f3c07d", opacity: 0.75, blend: "soft-light" },
    light: {
      directional: { intensity: 5.6, color: "#ffffff" },
      hemisphere: { intensity: 2.9, skyColor: "#ffffff", groundColor: "#ffffff" },
      ambient: { intensity: 1.4, color: "#ffffff" },
    },
  },
  noon: {
    tint: { color: "#ffffff", opacity: 0, blend: "normal" },
    light: {
      directional: { intensity: 5, color: "#ffffff" },
      hemisphere: { intensity: 2.5, skyColor: "#ffffff", groundColor: "#ffffff" },
      ambient: { intensity: 1.2, color: "#ffffff" },
    },
  },
  evening: {
    tint: { color: "#f08b4b", opacity: 0.75, blend: "soft-light" },
    light: {
      directional: { intensity: 4.2, color: "#ffffff" },
      hemisphere: { intensity: 2.1, skyColor: "#ffffff", groundColor: "#ffffff" },
      ambient: { intensity: 0.95, color: "#ffffff" },
    },
  },
  night: {
    tint: { color: "#471396", opacity: 0.45, blend: "multiply" },
    light: {
      directional: { intensity: 3.1, color: "#ffffff" },
      hemisphere: { intensity: 1.6, skyColor: "#ffffff", groundColor: "#ffffff" },
      ambient: { intensity: 0.7, color: "#ffffff" },
    },
  },
};

const WeatherOverlay = ({
  mode,
  rainDensity,
  snowDensity,
}: {
  mode: WeatherMode;
  rainDensity: number;
  snowDensity: number;
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const sizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const rainRef = useRef<RainDrop[]>([]);
  const snowRef = useRef<SnowFlake[]>([]);

  const rebuildParticles = () => {
    const { width, height } = sizeRef.current;
    if (width <= 0 || height <= 0) {
      return;
    }
    if (mode === "rain") {
      const base = Math.min(900, Math.max(200, Math.floor((width * height) / 4600)));
      const count = Math.round(base * rainDensity);
      rainRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        len: 8 + Math.random() * 12,
        vy: 450 + Math.random() * 450,
        vx: -50 + Math.random() * 100,
        alpha: 0.25 + Math.random() * 0.35,
      }));
      snowRef.current = [];
      return;
    }
    if (mode === "snow") {
      const base = Math.min(520, Math.max(120, Math.floor((width * height) / 7000)));
      const count = Math.round(base * snowDensity);
      snowRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 1 + Math.random() * 2.2,
        vy: 20 + Math.random() * 50,
        vx: -20 + Math.random() * 40,
        alpha: 0.4 + Math.random() * 0.4,
      }));
      rainRef.current = [];
      return;
    }
    rainRef.current = [];
    snowRef.current = [];
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const resize = () => {
      const target = canvas.parentElement ?? canvas;
      const rect = target.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      sizeRef.current = { width: rect.width, height: rect.height };
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      rebuildParticles();
    };

    resize();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => resize());
      resizeObserver.observe(canvas.parentElement ?? canvas);
    } else {
      window.addEventListener("resize", resize);
    }

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [mode, rainDensity, snowDensity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const clearCanvas = () => {
      const { width, height } = sizeRef.current;
      ctx.clearRect(0, 0, width, height);
    };

    if (mode === "sun") {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = null;
      clearCanvas();
      return;
    }

    rebuildParticles();
    lastTimeRef.current = performance.now();

    const tick = (time: number) => {
      const { width, height } = sizeRef.current;
      const dt = Math.min(0.033, (time - lastTimeRef.current) / 1000);
      lastTimeRef.current = time;
      ctx.clearRect(0, 0, width, height);

      if (mode === "rain") {
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = "rgba(70, 120, 200, 0.85)";
        for (const drop of rainRef.current) {
          drop.x += drop.vx * dt;
          drop.y += drop.vy * dt;
          if (drop.y > height + drop.len) {
            drop.y = -drop.len;
            drop.x = Math.random() * width;
          }
          if (drop.x < -20) {
            drop.x = width + 20;
          } else if (drop.x > width + 20) {
            drop.x = -20;
          }
          const alpha = Math.min(1, drop.alpha + 0.25);
          const tailX = drop.x + drop.vx * 0.04;
          const tailY = drop.y - drop.len;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.moveTo(drop.x, drop.y);
          ctx.lineTo(tailX, tailY);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (mode === "snow") {
        ctx.fillStyle = "rgba(255, 255, 255, 0.98)";
        ctx.strokeStyle = "rgba(120, 150, 180, 0.9)";
        ctx.lineWidth = 0.9;
        for (const flake of snowRef.current) {
          flake.x += flake.vx * dt;
          flake.y += flake.vy * dt;
          if (flake.y > height + 10) {
            flake.y = -10;
            flake.x = Math.random() * width;
          }
          if (flake.x < -10) {
            flake.x = width + 10;
          } else if (flake.x > width + 10) {
            flake.x = -10;
          }
          ctx.globalAlpha = flake.alpha;
          const r = flake.r * 2.6;
          ctx.globalAlpha = Math.min(1, flake.alpha + 0.15);
          // Draw a simple 6-armed snowflake.
          for (let arm = 0; arm < 6; arm += 1) {
            const angle = (Math.PI / 3) * arm;
            const dx = Math.cos(angle) * r;
            const dy = Math.sin(angle) * r;
            ctx.beginPath();
            ctx.moveTo(flake.x - dx * 0.2, flake.y - dy * 0.2);
            ctx.lineTo(flake.x + dx, flake.y + dy);
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = null;
    };
  }, [mode, rainDensity, snowDensity]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-[30]"
      style={{ width: "100%", height: "100%" }}
      aria-hidden="true"
    />
  );
};

const MapView = forwardRef<MapViewHandle, MapViewProps>(
  (
    {
      center = [106.6297, 10.8231],
      zoom = 12,
      styleUrl,
      activeLayerId,
      showTileBoundaries = true,
      weather = "sun",
      daylight = "noon",
      rainDensity = 1,
      snowDensity = 1,
      mapControlsRef,
      onSelectionChange,
      onSelectionElevationChange,
      onTransformDirtyChange,
      onLayerOptionsChange,
    },
    ref
  ) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<maplibregl.Map | null>(null);
    const overlayLayerRef = useRef<OverlayLayer | null>(null);
    const outlineLayerRef = useRef<OutlineLayer | null>(null);
    const modelLayerRef = useRef<ModelLayer | null>(null);
    const customWaterLayerRef = useRef<Map<string, WaterLayer>>(new Map());
    const customWaterSourceRef = useRef<Map<string, CustomVectorSource>>(new Map());
    const customWaterConfigRef = useRef<
      Map<
        string,
        {
          tileUrl: string;
          sourceLayer: string;
          normalTextureUrl?: string;
          settings: WaterSettings;
          layerId: string;
          minZoom: number;
          maxZoom: number;
          tileSize: number;
          applyGlobeMatrix: boolean;
        }
      >
    >(new Map());
    const instanceLayerRef = useRef<Map<string, InstanceLayer>>(new Map());
    const instanceSourceRef = useRef<Map<string, CustomVectorSource>>(new Map());
    const instanceLayerConfigRef = useRef<
      Map<
        string,
        {
          tileUrl: string;
          sourceLayer: string;
          modelUrls: string[];
          layerId: string;
          minZoom: number;
          maxZoom: number;
          tileSize: number;
          applyGlobeMatrix: boolean;
        }
      >
    >(new Map());
    const currentModeRef = useRef<TransformMode>("translate");
    const editLayersRef = useRef<Array<{ layer: EditLayer; name: string }>>([]);
    const styleUrlRef = useRef<string | null>(null);
    const activeLayerIdRef = useRef<string | undefined>(activeLayerId);
    const showTileBoundariesRef = useRef<boolean>(showTileBoundaries);
    const sunTimeRef = useRef<Date | null>(null);
    const daylightRef = useRef<DaylightMode>(daylight);
    const onSelectionChangeRef = useRef<typeof onSelectionChange>(onSelectionChange);
    const onSelectionElevationChangeRef = useRef<typeof onSelectionElevationChange>(onSelectionElevationChange);
    const onTransformDirtyChangeRef = useRef<typeof onTransformDirtyChange>(onTransformDirtyChange);
    const onLayerOptionsChangeRef = useRef<typeof onLayerOptionsChange>(onLayerOptionsChange);

    useEffect(() => {
      activeLayerIdRef.current = activeLayerId;
    }, [activeLayerId]);

    useEffect(() => {
      showTileBoundariesRef.current = showTileBoundaries;
    }, [showTileBoundaries]);

    useEffect(() => {
      onSelectionChangeRef.current = onSelectionChange;
    }, [onSelectionChange]);

    useEffect(() => {
      onSelectionElevationChangeRef.current = onSelectionElevationChange;
    }, [onSelectionElevationChange]);

    useEffect(() => {
      onTransformDirtyChangeRef.current = onTransformDirtyChange;
    }, [onTransformDirtyChange]);

    useEffect(() => {
      onLayerOptionsChangeRef.current = onLayerOptionsChange;
    }, [onLayerOptionsChange]);

    useEffect(() => {
      daylightRef.current = daylight;
    }, [daylight]);

    const applyDaylightToLayers = (mode: DaylightMode) => {
      const preset = daylightPresets[mode];
      modelLayerRef.current?.setLightOption(preset.light);
      instanceLayerRef.current.forEach((layer) => {
        layer.setLightOption(preset.light);
      });
      editLayersRef.current.forEach((entry) => {
        entry.layer.setLightOption(preset.light);
      });
      map.current?.triggerRepaint();
    };

    useEffect(() => {
      if (!mapContainer.current) return;
      const envStylePath = (import.meta.env.VITE_STYLE_PATH as string | undefined)?.trim() ?? "";
      const stylePath = styleUrl?.trim() || envStylePath;
      if (!stylePath) {
        console.error("[MapView] Missing VITE_STYLE_PATH, map cannot initialize.");
        return;
      }
      styleUrlRef.current = stylePath;

      let canvasContextAttributes: WebGLContextAttributesWithType = {};
      const isHighPerformance = import.meta.env.VITE_HIGH_PERFORMANCE_RENDER;
      if (isHighPerformance === "true") {
        canvasContextAttributes = {
          antialias: true,
          powerPreference: "high-performance",
          contextType: "webgl2",
        };
      }

      const mapOptions = {
        container: mapContainer.current,
        style: stylePath,
        center,
        zoom,
        antialias: true,
        canvasContextAttributes,
      } as maplibregl.MapOptions & { antialias?: boolean };

      map.current = new maplibregl.Map(mapOptions as maplibregl.MapOptions);

      const cleanupControls = addControlMaplibre(map.current, mapControlsRef?.current ?? null);
      map.current.showTileBoundaries = showTileBoundaries;

      const handleResize = () => {
        map.current?.resize();
      };
      window.addEventListener("resize", handleResize);
      // Ensure the map gets a correct size after initial layout.
      requestAnimationFrame(handleResize);

      const removeLayerIfExists = (mainMap: maplibregl.Map, id: string) => {
        if (mainMap.getLayer(id)) {
          mainMap.removeLayer(id);
        }
      };

      const cleanupEditorLayers = (mainMap: maplibregl.Map) => {
        overlayLayerRef.current?.unselect();
        outlineLayerRef.current?.unselect();
        removeLayerIfExists(mainMap, "models");
        for (const [layerId] of instanceLayerConfigRef.current) {
          removeLayerIfExists(mainMap, layerId);
        }
        instanceLayerRef.current.clear();
        instanceSourceRef.current.clear();
        for (const [layerId] of customWaterConfigRef.current) {
          removeLayerIfExists(mainMap, layerId);
        }
        customWaterLayerRef.current.clear();
        customWaterSourceRef.current.clear();
        const overlayId = (import.meta.env.VITE_OVERLAY_LAYER_ID as string | undefined)?.trim() || "overlay";
        const outlineId = (import.meta.env.VITE_OUTLINE_LAYER_ID as string | undefined)?.trim() || "outline";
        removeLayerIfExists(mainMap, outlineId);
        removeLayerIfExists(mainMap, overlayId);
        for (const entry of editLayersRef.current) {
          if (mainMap.getLayer(entry.layer.id)) {
            mainMap.removeLayer(entry.layer.id);
          }
        }
      };

      const getLayerOptions = (): LayerOption[] => {
        const options: LayerOption[] = [{ id: "models", label: "Base Models", kind: "base" }];
        for (const entry of editLayersRef.current) {
          options.push({ id: entry.layer.id, label: entry.name, kind: "edit" as const });
        }
        return options;
      };

      const updatePickEnabled = () => {
        const activeId = activeLayerIdRef.current;
        modelLayerRef.current?.setPickEnabled(activeId === "models" || !activeId);
        for (const entry of editLayersRef.current) {
          entry.layer.setPickEnabled(activeId === entry.layer.id);
        }
      };

      const addEditorLayers = (mainMap: maplibregl.Map) => {
        cleanupEditorLayers(mainMap);

        const overlayId = (import.meta.env.VITE_OVERLAY_LAYER_ID as string | undefined)?.trim() || "overlay";
        const outlineId = (import.meta.env.VITE_OUTLINE_LAYER_ID as string | undefined)?.trim() || "outline";
        const overlayLayer = new OverlayLayer({
          id: overlayId,
          onTransformChange: (dirty) => onTransformDirtyChangeRef.current?.(dirty),
          onElevationChange: (elevation) => onSelectionElevationChangeRef.current?.(elevation),
        });
        const outlineLayer = new OutlineLayer({ id: outlineId });
        overlayLayerRef.current = overlayLayer;
        outlineLayerRef.current = outlineLayer;

        const centerPoint = mainMap.getCenter();
        const vectorSourceUrl = (import.meta.env.VITE_MAP4D_TILE_URL as string | undefined)?.trim() ?? "";
        const rootModelUrl = (import.meta.env.VITE_ROOT_MODEL_URL as string | undefined)?.trim() ?? "";
        const sourceLayer = "map4d_3dmodels";
        const sunPos = getSunPosition(centerPoint.lat, centerPoint.lng);
        const sunOptions = {
          shadow: true,
          altitude: sunPos.altitude,
          azimuth: sunPos.azimuth,
        };

        const modelLayer = new ModelLayer({
          id: "models",
          vectorSourceUrl,
          sourceLayer,
          rootUrl: rootModelUrl,
          minZoom: 16,
          maxZoom: 19,
          sun: sunOptions,
          onPick: (info) => {
            overlayLayer.setCurrentTileID(info.overScaledTileId);
            overlayLayer.attachGizmoToObject(
              info.object,
              currentModeRef.current === "reset" ? "translate" : currentModeRef.current
            );
            outlineLayer.setCurrentTileID(info.overScaledTileId);
            outlineLayer.attachObject(info.object);
            onSelectionChangeRef.current?.(true);
          },
          onPickFail: () => {
            overlayLayer.unselect();
            outlineLayer.unselect();
            onSelectionChangeRef.current?.(false);
            onSelectionElevationChangeRef.current?.(null);
          },
        });

        modelLayer.setSunPos(sunPos.altitude, sunPos.azimuth);
        modelLayerRef.current = modelLayer;
        mainMap.addLayer(modelLayer);

        for (const [layerId, config] of customWaterConfigRef.current) {
          const customWaterSource = new CustomVectorSource({
            id: `water-custom-source-${layerId}`,
            url: config.tileUrl,
            minZoom: config.minZoom,
            maxZoom: config.maxZoom,
            tileSize: config.tileSize,
            maxTileCache: 1024,
            map: mainMap,
          });
          customWaterSourceRef.current.set(layerId, customWaterSource);
          const customWaterLayer = new WaterLayer({
            id: config.layerId,
            applyGlobeMatrix: config.applyGlobeMatrix,
            sourceLayer: config.sourceLayer,
            normalTextureUrl: config.normalTextureUrl,
            settings: config.settings,
            sun: sunOptions,
          });
          customWaterLayer.setVectorSource(customWaterSource);
          customWaterLayerRef.current.set(layerId, customWaterLayer);
          const beforeId = mainMap.getLayer("fill-vnairport-index") ? "fill-vnairport-index" : undefined;
          if (beforeId) {
            mainMap.addLayer(customWaterLayer, beforeId);
          } else {
            mainMap.addLayer(customWaterLayer);
          }
        }

        for (const [layerId, config] of instanceLayerConfigRef.current) {
          const instanceSource = new CustomVectorSource({
            id: `instance-custom-source-${layerId}`,
            url: config.tileUrl,
            minZoom: config.minZoom,
            maxZoom: config.maxZoom,
            tileSize: config.tileSize,
            maxTileCache: 1024,
            map: mainMap,
          });
          instanceSourceRef.current.set(layerId, instanceSource);
          const instanceLayer = new InstanceLayer({
            id: config.layerId,
            sourceLayer: config.sourceLayer,
            applyGlobeMatrix: config.applyGlobeMatrix,
            sun: sunOptions,
            objectUrl: config.modelUrls,
          });
          instanceLayer.setVectorSource(instanceSource);
          instanceLayerRef.current.set(layerId, instanceLayer);
          mainMap.addLayer(instanceLayer);
        }

        mainMap.addLayer(outlineLayer);
        mainMap.addLayer(overlayLayer);

        for (const entry of editLayersRef.current) {
          mainMap.addLayer(entry.layer);
          if (mainMap.getLayer(outlineLayer.id)) {
            mainMap.moveLayer(entry.layer.id, outlineLayer.id);
          }
        }

        mainMap.showTileBoundaries = showTileBoundariesRef.current;
        updatePickEnabled();
        onLayerOptionsChangeRef.current?.(getLayerOptions());
        applyDaylightToLayers(daylightRef.current);
      };

      const handleStyleLoad = () => {
        const mainMap = map.current;
        if (!mainMap) {
          return;
        }
        addEditorLayers(mainMap);
      };

      map.current.on("style.load", handleStyleLoad);
      map.current.on("load", handleStyleLoad);

      return () => {
        window.removeEventListener("resize", handleResize);
        map.current?.off("style.load", handleStyleLoad);
        map.current?.off("load", handleStyleLoad);
        cleanupControls();
        if (map.current) {
          map.current.remove();
        }
      };
    }, [center, zoom, mapControlsRef]);

    useEffect(() => {
      const mainMap = map.current;
      if (!mainMap) {
        return;
      }
      const envStylePath = (import.meta.env.VITE_STYLE_PATH as string | undefined)?.trim() ?? "";
      const nextStyleUrl = styleUrl?.trim() || envStylePath;
      if (!nextStyleUrl || styleUrlRef.current === nextStyleUrl) {
        return;
      }
      styleUrlRef.current = nextStyleUrl;
      mainMap.setStyle(nextStyleUrl, { diff: true });
    }, [styleUrl]);

    useEffect(() => {
      const activeId = activeLayerId;
      modelLayerRef.current?.setPickEnabled(activeId === "models" || !activeId);
      for (const entry of editLayersRef.current) {
        entry.layer.setPickEnabled(activeId === entry.layer.id);
      }
      overlayLayerRef.current?.unselect();
      outlineLayerRef.current?.unselect();
      onSelectionChangeRef.current?.(false);
      onSelectionElevationChangeRef.current?.(null);
    }, [activeLayerId]);

    useEffect(() => {
      if (map.current) {
        map.current.showTileBoundaries = showTileBoundaries;
      }
    }, [showTileBoundaries]);

    useEffect(() => {
      const mainMap = map.current;
      if (!mainMap) {
        return;
      }
      applyDaylightToLayers(daylight);
    }, [daylight]);

    useImperativeHandle(ref, () => ({
      setTransformMode(m) {
        currentModeRef.current = m;
        const overlay = overlayLayerRef.current;
        if (!overlay) {
          return;
        }
        if (m === "reset") {
          overlay.reset();
        } else {
          overlay.setMode(m);
        }
      },
      setShowTileBoundaries(show) {
        if (map.current) {
          map.current.showTileBoundaries = show;
        }
      },
      snapObjectSelectedToGround() {
        overlayLayerRef.current?.snapCurrentObjectToGround();
        map.current?.triggerRepaint();
      },
      enableClippingPlanesObjectSelected(enable) {
        overlayLayerRef.current?.enableLocalClippingPlane(enable);
        map.current?.triggerRepaint();
      },
      enableFootPrintWhenEdit(enable) {
        overlayLayerRef.current?.showFootprint(enable);
        map.current?.triggerRepaint();
      },
      getSelectedTransform() {
        const overlay = overlayLayerRef.current;
        const transform = overlay?.getTransform();
        if (!transform) {
          return null;
        }
        const currentObject = overlay?.getCurrentObject();
        const scaleUnit = (currentObject?.userData as { scaleUnit?: number } | undefined)?.scaleUnit ?? 1;
        const objectScaleX = Math.abs((transform.scale[0] ?? 1) / scaleUnit);
        const objectScaleY = Math.abs(transform.scale[1] ?? 1);
        const objectScaleZ = Math.abs((transform.scale[2] ?? 1) / scaleUnit);
        return {
          position: transform.position,
          rotation: [
            MathUtils.radToDeg(transform.rotation[0]),
            MathUtils.radToDeg(transform.rotation[1]),
            MathUtils.radToDeg(transform.rotation[2]),
          ],
          scale: [objectScaleX, objectScaleY, objectScaleZ],
        };
      },
      setSelectedTransform(values) {
        const overlay = overlayLayerRef.current;
        if (!overlay) {
          return;
        }
        const next: { position?: [number, number, number]; rotation?: [number, number, number]; scale?: [number, number, number] } = {};
        if (values.position) {
          next.position = values.position;
        }
        if (values.scale) {
          const currentObject = overlay.getCurrentObject();
          const scaleUnit = (currentObject?.userData as { scaleUnit?: number } | undefined)?.scaleUnit ?? 1;
          const currentScale = currentObject?.scale;
          const fallbackSigns: [number, number, number] = [
            currentScale?.x && currentScale.x !== 0 ? Math.sign(currentScale.x) : 1,
            currentScale?.y && currentScale.y !== 0 ? Math.sign(currentScale.y) : -1,
            currentScale?.z && currentScale.z !== 0 ? Math.sign(currentScale.z) : 1,
          ];
          const nextScaleAbs: [number, number, number] = [
            Math.abs(values.scale[0]),
            Math.abs(values.scale[1]),
            Math.abs(values.scale[2]),
          ];
          const nextSigns: [number, number, number] = fallbackSigns;
          next.scale = [
            nextScaleAbs[0] * scaleUnit * nextSigns[0],
            nextScaleAbs[1] * nextSigns[1],
            nextScaleAbs[2] * scaleUnit * nextSigns[2],
          ];
        }
        if (values.rotation) {
          next.rotation = [
            MathUtils.degToRad(values.rotation[0]),
            MathUtils.degToRad(values.rotation[1]),
            MathUtils.degToRad(values.rotation[2]),
          ];
        }
        overlay.applyTransform(next);
      },
      flyToLatLng(lat, lng, zoom) {
        if (!map.current) {
          return;
        }
        map.current.flyTo({
          center: [lng, lat],
          zoom: typeof zoom === "number" ? zoom : map.current.getZoom(),
          essential: true,
        });
      },
      getCenter() {
        if (!map.current) {
          return null;
        }
        const centerPoint = map.current.getCenter();
        return { lat: centerPoint.lat, lng: centerPoint.lng };
      },
      setLayerVisibility(id, visible) {
        if (id === "models") {
          modelLayerRef.current?.setVisible(visible);
          return;
        }
        if (instanceLayerRef.current.has(id)) {
          instanceLayerRef.current.get(id)?.setVisible(visible);
          map.current?.triggerRepaint();
          return;
        }
        if (customWaterLayerRef.current.has(id)) {
          customWaterLayerRef.current.get(id)?.setVisible(visible);
          map.current?.triggerRepaint();
          return;
        }
        const entry = editLayersRef.current.find((item) => item.layer.id === id);
        if (entry) {
          entry.layer.setVisible(visible);
          map.current?.triggerRepaint();
        }
      },
      setLayerLightOption(id, option) {
        if (id === "models") {
          modelLayerRef.current?.setLightOption(option);
          return;
        }
        if (instanceLayerRef.current.has(id)) {
          instanceLayerRef.current.get(id)?.setLightOption(option);
          map.current?.triggerRepaint();
          return;
        }
        const entry = editLayersRef.current.find((item) => item.layer.id === id);
        if (entry) {
          entry.layer.setLightOption(option);
          map.current?.triggerRepaint();
        }
      },
      removeLayer(id) {
        if (id === "models") {
          return;
        }
        if (instanceLayerRef.current.has(id)) {
          if (map.current?.getLayer(id)) {
            map.current.removeLayer(id);
          }
          instanceLayerRef.current.delete(id);
          instanceSourceRef.current.delete(id);
          instanceLayerConfigRef.current.delete(id);
          map.current?.triggerRepaint();
          return;
        }
        if (customWaterLayerRef.current.has(id)) {
          if (map.current?.getLayer(id)) {
            map.current.removeLayer(id);
          }
          customWaterLayerRef.current.delete(id);
          customWaterSourceRef.current.delete(id);
          customWaterConfigRef.current.delete(id);
          map.current?.triggerRepaint();
          return;
        }
        const idx = editLayersRef.current.findIndex((item) => item.layer.id === id);
        if (idx === -1) {
          return;
        }
        overlayLayerRef.current?.unselect();
        outlineLayerRef.current?.unselect();
        const entry = editLayersRef.current[idx];
        if (map.current?.getLayer(entry.layer.id)) {
          map.current.removeLayer(entry.layer.id);
        }
        editLayersRef.current.splice(idx, 1);
        const options: LayerOption[] = [
          { id: "models", label: "Base Models", kind: "base" as const },
          ...editLayersRef.current.map((item) => ({ id: item.layer.id, label: item.name, kind: "edit" as const })),
        ];
        onLayerOptionsChangeRef.current?.(options);
      },
      addEditLayer(options) {
        const mainMap = map.current;
        const overlayLayer = overlayLayerRef.current;
        const outlineLayer = outlineLayerRef.current;
        if (!mainMap || !overlayLayer || !outlineLayer) {
          return null;
        }
        const id = generateId();
        const layerName = options?.name?.trim() ? options.name.trim() : `Edit Layer ${id.slice(0, 6)}`;
        const centerPoint = mainMap.getCenter();
        const lat = options?.coords?.lat ?? centerPoint.lat;
        const lng = options?.coords?.lng ?? centerPoint.lng;
        const sunTime = sunTimeRef.current ?? new Date();
        const sunPos = getSunPositionAt(lat, lng, sunTime);
        const sunOptions = {
          shadow: true,
          altitude: sunPos.altitude,
          azimuth: sunPos.azimuth,
        };
        const editorLayer = new EditLayer({
          id,
          sun: sunOptions,
          editorLevel: 16,
          applyGlobeMatrix: false,
          onPick: (info) => {
            overlayLayer.setCurrentTileID(info.overScaledTileId);
            overlayLayer.attachGizmoToObject(
              info.object,
              currentModeRef.current === "reset" ? "translate" : currentModeRef.current
            );
            outlineLayer.setCurrentTileID(info.overScaledTileId);
            outlineLayer.attachObject(info.object);
            onSelectionChange?.(true);
          },
          onPickFail: () => {
            overlayLayer.unselect();
            outlineLayer.unselect();
            onSelectionChange?.(false);
            onSelectionElevationChange?.(null);
          },
        });
        editorLayer.setSunPos(sunPos.altitude, sunPos.azimuth);
        if (options?.modelUrl?.trim()) {
          const glbPath = options.modelUrl.trim();
          const isBlobUrl = glbPath.startsWith("blob:");
          loadModelFromGlb(glbPath)
            .then((modeldata) => {
              editorLayer.addObjectsToCache([
                {
                  id: glbPath,
                  modeldata,
                },
              ]);
              editorLayer.addObjectToScene(glbPath, 1, options?.coords);
              if (isBlobUrl) {
                URL.revokeObjectURL(glbPath);
              }
            })
            .catch((err) => {
              console.error("[MapView] Failed to load edit model:", err);
              if (isBlobUrl) {
                URL.revokeObjectURL(glbPath);
              }
            });
        }
        mainMap.addLayer(editorLayer);
        mainMap.moveLayer(editorLayer.id, outlineLayer.id);
        editLayersRef.current.push({ layer: editorLayer, name: layerName });
        editorLayer.setPickEnabled(activeLayerIdRef.current === editorLayer.id);
        onLayerOptionsChangeRef.current?.([
          { id: "models", label: "Base Models", kind: "base" as const },
          ...editLayersRef.current.map((entry) => ({
            id: entry.layer.id,
            label: entry.name,
            kind: "edit" as const,
          })),
        ]);
        return id;
      },
      addModelToLayer(layerId, options) {
        if (layerId === "models") {
          return false;
        }
        const mainMap = map.current;
        if (!mainMap) {
          return false;
        }
        const entry = editLayersRef.current.find((item) => item.layer.id === layerId);
        if (!entry) {
          return false;
        }
        const defaultGlbPath =
          (import.meta.env.VITE_EDIT_MODEL_URL as string | undefined)?.trim() || "/models/default.glb";
        const glbPath = options?.modelUrl?.trim() || defaultGlbPath;
        const isBlobUrl = glbPath.startsWith("blob:");
        loadModelFromGlb(glbPath)
          .then((modeldata) => {
            entry.layer.addObjectsToCache([
              {
                id: glbPath,
                modeldata,
              },
            ]);
            entry.layer.addObjectToScene(glbPath, 1, options?.coords, {
              instanceId: options?.instanceId,
              name: options?.name,
            });
            if (isBlobUrl) {
              URL.revokeObjectURL(glbPath);
            }
          })
          .catch((err) => {
            console.error("[MapView] Failed to load edit model:", err);
            if (isBlobUrl) {
              URL.revokeObjectURL(glbPath);
            }
          });
        return true;
      },
      removeModelFromLayer(layerId, instanceId) {
        if (layerId === "models") {
          return false;
        }
        const entry = editLayersRef.current.find((item) => item.layer.id === layerId);
        if (!entry) {
          return false;
        }
        return entry.layer.removeObjectByInstanceId(instanceId);
      },
      cloneModelInLayer(layerId, instanceId, newInstanceId) {
        if (layerId === "models") {
          return false;
        }
        const entry = editLayersRef.current.find((item) => item.layer.id === layerId);
        if (!entry) {
          return false;
        }
        return entry.layer.cloneObjectByInstanceId(instanceId, newInstanceId);
      },
      setSunTime(date) {
        const mainMap = map.current;
        if (!mainMap) {
          return;
        }
        sunTimeRef.current = date;
        const centerPoint = mainMap.getCenter();
        const sunPos = getSunPositionAt(centerPoint.lat, centerPoint.lng, date);
        modelLayerRef.current?.setSunPos(sunPos.altitude, sunPos.azimuth);
        instanceLayerRef.current.forEach((layer) => {
          layer.setSunPos(sunPos.altitude, sunPos.azimuth);
        });
        editLayersRef.current.forEach((entry) => {
          entry.layer.setSunPos(sunPos.altitude, sunPos.azimuth);
        });
        mainMap.triggerRepaint();
      },
      addInstanceLayer(options) {
        const mainMap = map.current;
        if (!mainMap) {
          return null;
        }
        const layerId =
          options.layerId?.trim() ||
          `instance-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

        const centerPoint = mainMap.getCenter();
        const sunTime = sunTimeRef.current ?? new Date();
        const sunPos = getSunPositionAt(centerPoint.lat, centerPoint.lng, sunTime);
        const sunOptions = {
          shadow: true,
          altitude: sunPos.altitude,
          azimuth: sunPos.azimuth,
        };

        const instanceSource = new CustomVectorSource({
          id: `instance-custom-source-${layerId}`,
          url: options.tileUrl,
          minZoom: options.minZoom ?? 0,
          maxZoom: options.maxZoom ?? 16,
          tileSize: options.tileSize ?? 512,
          maxTileCache: 1024,
          map: mainMap,
        });
        instanceSourceRef.current.set(layerId, instanceSource);
        const instanceLayer = new InstanceLayer({
          id: layerId,
          sourceLayer: options.sourceLayer,
          applyGlobeMatrix: options.applyGlobeMatrix ?? false,
          sun: sunOptions,
          objectUrl: options.modelUrls,
        });
        instanceLayer.setVectorSource(instanceSource);
        instanceLayerRef.current.set(layerId, instanceLayer);
        instanceLayerConfigRef.current.set(layerId, {
          tileUrl: options.tileUrl,
          sourceLayer: options.sourceLayer,
          modelUrls: options.modelUrls,
          layerId,
          minZoom: options.minZoom ?? 0,
          maxZoom: options.maxZoom ?? 16,
          tileSize: options.tileSize ?? 512,
          applyGlobeMatrix: options.applyGlobeMatrix ?? false,
        });
        mainMap.addLayer(instanceLayer);
        mainMap.triggerRepaint();
        return layerId;
      },
      addWaterLayer(options) {
        const mainMap = map.current;
        if (!mainMap) {
          return null;
        }
        const layerId =
          options.layerId?.trim() ||
          `water-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const centerPoint = mainMap.getCenter();
        const sunTime = sunTimeRef.current ?? new Date();
        const sunPos = getSunPositionAt(centerPoint.lat, centerPoint.lng, sunTime);
        const sunOptions = {
          shadow: true,
          altitude: sunPos.altitude,
          azimuth: sunPos.azimuth,
        };
        const customWaterSource = new CustomVectorSource({
          id: `water-custom-source-${layerId}`,
          url: options.tileUrl,
          minZoom: options.minZoom ?? 0,
          maxZoom: options.maxZoom ?? 16,
          tileSize: options.tileSize ?? 512,
          maxTileCache: 1024,
          map: mainMap,
        });
        customWaterSourceRef.current.set(layerId, customWaterSource);
        const customWaterLayer = new WaterLayer({
          id: layerId,
          applyGlobeMatrix: options.applyGlobeMatrix ?? false,
          sourceLayer: options.sourceLayer,
          normalTextureUrl: options.normalTextureUrl,
          settings: options.settings,
          sun: sunOptions,
        });
        customWaterLayer.setVectorSource(customWaterSource);
        customWaterLayerRef.current.set(layerId, customWaterLayer);
        customWaterConfigRef.current.set(layerId, {
          tileUrl: options.tileUrl,
          sourceLayer: options.sourceLayer,
          normalTextureUrl: options.normalTextureUrl,
          settings: normalizeWaterSettings(options.settings),
          layerId,
          minZoom: options.minZoom ?? 0,
          maxZoom: options.maxZoom ?? 16,
          tileSize: options.tileSize ?? 512,
          applyGlobeMatrix: options.applyGlobeMatrix ?? false,
        });
        const beforeId = mainMap.getLayer("fill-vnairport-index") ? "fill-vnairport-index" : undefined;
        if (beforeId) {
          mainMap.addLayer(customWaterLayer, beforeId);
        } else {
          mainMap.addLayer(customWaterLayer);
        }
        mainMap.triggerRepaint();
        return layerId;
      },
      setWaterLayerSettings(layerId, settings) {
        const layer = customWaterLayerRef.current.get(layerId);
        if (layer) {
          layer.setWaterSettings(settings);
        }
        const config = customWaterConfigRef.current.get(layerId);
        if (config) {
          customWaterConfigRef.current.set(layerId, { ...config, settings });
        }
      },
    }));

    const daylightTint = daylightPresets[daylight].tint;

    return (
      <div ref={mapContainer} className="relative h-full w-full">
        {daylightTint.opacity > 0 ? (
          <div
            className="pointer-events-none absolute inset-0 z-[6]"
            style={{
              backgroundColor: daylightTint.color,
              opacity: daylightTint.opacity,
              mixBlendMode: daylightTint.blend,
            }}
            aria-hidden="true"
          />
        ) : null}
        <WeatherOverlay mode={weather} rainDensity={rainDensity} snowDensity={snowDensity} />
      </div>
    );
  }
);

export default MapView;
