import { useEffect, useMemo, useRef, useState } from "react";
import MapView from "@/components/map/MapView";
import { EditorToolbar } from "@/components/toolbar/EditorToolbar";
import LayerPanel from "@/components/ui/LayerPanel";
import LayerNameModal from "@/components/ui/LayerNameModal";
import InstanceLayerModal from "@/components/ui/InstanceLayerModal";
import WaterLayerModal from "@/components/ui/WaterLayerModal";
import WaterSettingsModal from "@/components/ui/WaterSettingsModal";
import LightSettingsModal, { type LightIntensitySettings } from "@/components/ui/LightSettingsModal";
import TimeShadowBar from "@/components/ui/TimeShadowBar";
import TransformPanel from "@/components/ui/TransformPanel";
import type { LayerModelInfo, LayerOption, ThemeMode, TransformMode, TransformValues } from "@/types/common";
import type { MapViewHandle } from "@/components/map/MapView";
import type { LightGroupOption } from "@/components/map/data/models/objModel";
import { DEFAULT_WATER_SETTINGS, type WaterSettings } from "@/components/map/water/WaterMaterial";

function App() {
  const styleUrl = (import.meta.env.VITE_STYLE_PATH as string | undefined)?.trim() ?? "";

  const [mode, setMode] = useState<TransformMode>("translate");
  const [showTiles, setShowTiles] = useState<boolean>(false);
  const [hasSelection, setHasSelection] = useState<boolean>(false);
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [selectionElevation, setSelectionElevation] = useState<number | null>(null);
  const [mapLayerOptions, setMapLayerOptions] = useState<LayerOption[]>([
    { id: "models", label: "Base Models", kind: "base" },
  ]);
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({ models: true });
  const [layerModels, setLayerModels] = useState<Record<string, LayerModelInfo[]>>({});
  const [activeLayerId, setActiveLayerId] = useState<string>(() => {
    if (typeof window === "undefined") {
      return "models";
    }
    return window.localStorage.getItem("scene-editor-active-layer") || "models";
  });
  const [layerModalOpen, setLayerModalOpen] = useState(false);
  const [layerModalInitialName, setLayerModalInitialName] = useState("Edit Layer 1");
  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [modelModalTargetId, setModelModalTargetId] = useState<string | null>(null);
  const [modelModalTitle, setModelModalTitle] = useState("Add Model");
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(true);
  const [sunMinutes, setSunMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });
  const [sunDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });
  const [showShadowTime, setShowShadowTime] = useState(true);
  const [weather, setWeather] = useState<"sun" | "rain" | "snow">("sun");
  const [daylight, setDaylight] = useState<"morning" | "noon" | "evening" | "night">("noon");
  const [rainDensity, setRainDensity] = useState(1.4);
  const [snowDensity, setSnowDensity] = useState(1.3);
  const [transformValues, setTransformValues] = useState<TransformValues | null>(null);
  const [instanceLayerModalOpen, setInstanceLayerModalOpen] = useState(false);
  const [instanceModelFiles, setInstanceModelFiles] = useState<File[]>([]);
  const [instanceLayerName, setInstanceLayerName] = useState("Custom Layer 1");
  const [customInstanceLayers, setCustomInstanceLayers] = useState<LayerOption[]>([]);
  const [waterLayerModalOpen, setWaterLayerModalOpen] = useState(false);
  const [waterLayerName, setWaterLayerName] = useState("Water Layer 1");
  const [waterTextureFile, setWaterTextureFile] = useState<File | null>(null);
  const [customWaterLayers, setCustomWaterLayers] = useState<LayerOption[]>([]);
  const [waterLayerSettings, setWaterLayerSettings] = useState<Record<string, WaterSettings>>({});
  const [layerLightSettings, setLayerLightSettings] = useState<Record<string, LightIntensitySettings>>({});
  const [waterSettingsModalOpen, setWaterSettingsModalOpen] = useState(false);
  const [waterSettingsTargetId, setWaterSettingsTargetId] = useState<string | null>(null);
  const [lightSettingsModalOpen, setLightSettingsModalOpen] = useState(false);
  const [lightSettingsTargetId, setLightSettingsTargetId] = useState<string | null>(null);
  const instanceBlobUrlsRef = useRef<Map<string, string[]>>(new Map());
  const waterBlobUrlsRef = useRef<Map<string, string>>(new Map());
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "dark";
    }
    const stored = window.localStorage.getItem("scene-editor-theme");
    return stored === "light" ? "light" : "dark";
  });
  const mapHandleRef = useRef<MapViewHandle>(null);
  const mapControlsRef = useRef<HTMLDivElement>(null);
  const mapCenter = useMemo(() => [106.6297, 10.8231] as [number, number], []);
  const editLayerCount = mapLayerOptions.filter((option) => option.id !== "models").length;
  const customLayerCount = customInstanceLayers.length;
  const customWaterCount = customWaterLayers.length;
  const defaultGlbPath = (import.meta.env.VITE_EDIT_MODEL_URL as string | undefined)?.trim() || "/models/default.glb";
  const defaultInstanceTileUrl =
    (import.meta.env.VITE_INSTANCE_TILE_URL as string | undefined)?.trim() ||
    "http://10.222.3.81:8083/VietbandoMapService/api/image/?Function=GetVectorTile&MapName=IndoorNavigation&Level={z}&TileX={x}&TileY={y}&UseTileCache=true";
  const defaultInstanceSourceLayer =
    (import.meta.env.VITE_INSTANCE_SOURCE_LAYER as string | undefined)?.trim() || "trees";
  const defaultInstanceModelUrls = useMemo(
    () => [
      "/test_data/test_instance/tree2.glb",
      "/test_data/test_instance/tree3.glb",
      "/test_data/test_instance/tree4.glb",
      "/test_data/test_instance/tree5.glb",
      "/test_data/test_instance/tree6.glb",
    ],
    []
  );
  const defaultWaterTileUrl =
    (import.meta.env.VITE_WATER_TILE_URL as string | undefined)?.trim() ||
    "https://images.daklak.gov.vn/v2/tile/{z}/{x}/{y}/306ec9b5-8146-4a83-9271-bd7b343a574a";
  const defaultWaterSourceLayer =
    (import.meta.env.VITE_WATER_SOURCE_LAYER as string | undefined)?.trim() || "region_river_index";
  const defaultLightOption: LightGroupOption = {
    directional: {
      intensity: 5,
    },
    hemisphere: {
      intensity: 2.5,
    },
    ambient: {
      intensity: 1.2,
    },
  };
  const defaultLightSettings: LightIntensitySettings = {
    directional: defaultLightOption.directional?.intensity ?? 5,
    hemisphere: defaultLightOption.hemisphere?.intensity ?? 2.5,
    ambient: defaultLightOption.ambient?.intensity ?? 1.2,
  };
  const lightIntensityRange = { min: 0.2, max: 3, step: 0.05 };
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
  const applyLightSettings = (layerId: string, settings: LightIntensitySettings) => {
    const next: LightIntensitySettings = {
      directional: clamp(settings.directional, lightIntensityRange.min, lightIntensityRange.max),
      hemisphere: clamp(settings.hemisphere, lightIntensityRange.min, lightIntensityRange.max),
      ambient: clamp(settings.ambient, lightIntensityRange.min, lightIntensityRange.max),
    };
    const option: LightGroupOption = {
      directional: {
        intensity: next.directional,
      },
      hemisphere: {
        intensity: next.hemisphere,
      },
      ambient: {
        intensity: next.ambient,
      },
    };
    mapHandleRef.current?.setLayerLightOption(layerId, option);
    setLayerLightSettings((prev) => ({ ...prev, [layerId]: next }));
  };

  const applyDaylight = (mode: "morning" | "noon" | "evening" | "night") => {
    setDaylight(mode);
    const presetMinutes =
      mode === "morning" ? 8 * 60 : mode === "noon" ? 12 * 60 : mode === "evening" ? 17 * 60 + 30 : 21 * 60;
    setSunMinutes(presetMinutes);
    const next = new Date(sunDate);
    next.setHours(Math.floor(presetMinutes / 60), presetMinutes % 60, 0, 0);
    mapHandleRef.current?.setSunTime(next);
  };

  const getDaylightFromMinutes = (minutes: number) => {
    if (minutes >= 5 * 60 && minutes < 11 * 60) {
      return "morning";
    }
    if (minutes >= 11 * 60 && minutes < 15 * 60) {
      return "noon";
    }
    if (minutes >= 15 * 60 && minutes < 19 * 60 + 30) {
      return "evening";
    }
    return "night";
  };

  const revokeInstanceBlobUrls = (layerId?: string) => {
    if (layerId) {
      const urls = instanceBlobUrlsRef.current.get(layerId);
      if (urls && urls.length > 0) {
        urls.forEach((url) => URL.revokeObjectURL(url));
        instanceBlobUrlsRef.current.delete(layerId);
      }
      return;
    }
    for (const [id, urls] of instanceBlobUrlsRef.current.entries()) {
      urls.forEach((url) => URL.revokeObjectURL(url));
      instanceBlobUrlsRef.current.delete(id);
    }
  };

  const revokeWaterBlobUrls = (layerId?: string) => {
    if (layerId) {
      const url = waterBlobUrlsRef.current.get(layerId);
      if (url) {
        URL.revokeObjectURL(url);
        waterBlobUrlsRef.current.delete(layerId);
      }
      return;
    }
    for (const [id, url] of waterBlobUrlsRef.current.entries()) {
      URL.revokeObjectURL(url);
      waterBlobUrlsRef.current.delete(id);
    }
  };

  useEffect(() => {
    return () => {
      revokeInstanceBlobUrls();
      revokeWaterBlobUrls();
    };
  }, []);

  const layerOptions = useMemo(() => {
    const merged = new Map<string, LayerOption>();
    mapLayerOptions.forEach((layer) => {
      merged.set(layer.id, layer);
    });
    customInstanceLayers.forEach((layer) => {
      merged.set(layer.id, layer);
    });
    customWaterLayers.forEach((layer) => {
      merged.set(layer.id, layer);
    });
    return Array.from(merged.values());
  }, [customInstanceLayers, customWaterLayers, mapLayerOptions]);

  const getModelName = (file: File | null, modelUrl?: string) => {
    if (file?.name) {
      return file.name;
    }
    if (modelUrl) {
      const trimmed = modelUrl.split("?")[0];
      const parts = trimmed.split("/");
      return parts[parts.length - 1] || "model.glb";
    }
    const fallback = defaultGlbPath.split("?")[0];
    const fallbackParts = fallback.split("/");
    return fallbackParts[fallbackParts.length - 1] || "model.glb";
  };

  const createModelInfo = (
    file: File | null,
    modelUrl: string | undefined,
    coords: { lat: number; lng: number } | null,
    nameOverride?: string
  ): LayerModelInfo => {
    const cryptoObj = globalThis.crypto as Crypto | undefined;
    const id = cryptoObj?.randomUUID ? cryptoObj.randomUUID() : `model-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    return {
      id,
      name: nameOverride ?? getModelName(file, modelUrl),
      coords,
    };
  };

  useEffect(() => {
    const exists = layerOptions.some((option) => option.id === activeLayerId);
    if (!exists && layerOptions[0]) {
      setActiveLayerId(layerOptions[0].id);
    }
  }, [activeLayerId, layerOptions]);

  useEffect(() => {
    setLayerVisibility((prev) => {
      const next: Record<string, boolean> = {};
      for (const option of layerOptions) {
        next[option.id] = prev[option.id] ?? true;
      }
      return next;
    });
  }, [layerOptions]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("theme-light", "theme-dark");
    root.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
    window.localStorage.setItem("scene-editor-theme", theme);
  }, [theme]);

  useEffect(() => {
    setHasSelection(false);
    setHasChanges(false);
    setSelectionElevation(null);
  }, []);

  useEffect(() => {
    if (!hasSelection) {
      return;
    }
    mapHandleRef.current?.setTransformMode(mode);
  }, [hasSelection, mode]);

  useEffect(() => {
    window.localStorage.setItem("scene-editor-active-layer", activeLayerId);
    setHasSelection(false);
    setHasChanges(false);
    setSelectionElevation(null);
  }, [activeLayerId]);

  useEffect(() => {
    if (!hasSelection) {
      setTransformValues(null);
      return;
    }
    let raf = 0;
    const epsilon = 1e-6;
    const isClose = (a: number, b: number) => Math.abs(a - b) <= epsilon;
    const isTransformEqual = (next: TransformValues, prev: TransformValues | null) => {
      if (!prev) return false;
      return (
        isClose(next.position[0], prev.position[0]) &&
        isClose(next.position[1], prev.position[1]) &&
        isClose(next.position[2], prev.position[2]) &&
        isClose(next.rotation[0], prev.rotation[0]) &&
        isClose(next.rotation[1], prev.rotation[1]) &&
        isClose(next.rotation[2], prev.rotation[2]) &&
        isClose(next.scale[0], prev.scale[0]) &&
        isClose(next.scale[1], prev.scale[1]) &&
        isClose(next.scale[2], prev.scale[2])
      );
    };
    const tick = () => {
      const next = mapHandleRef.current?.getSelectedTransform() ?? null;
      if (next) {
        setTransformValues((prev) => (isTransformEqual(next, prev) ? prev : next));
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [hasSelection]);

  const openLayerModal = () => {
    const defaultName = `Edit Layer ${editLayerCount + 1}`;
    setLayerModalInitialName(defaultName);
    setLayerModalOpen(true);
  };

  const openInstanceLayerModal = () => {
    const defaultName = `Custom Layer ${customLayerCount + 1}`;
    setInstanceLayerName(defaultName);
    setInstanceLayerModalOpen(true);
  };

  const openWaterLayerModal = () => {
    const defaultName = `Water Layer ${customWaterCount + 1}`;
    setWaterLayerName(defaultName);
    setWaterLayerModalOpen(true);
  };

  const openWaterSettingsModal = (layerId: string) => {
    setWaterSettingsTargetId(layerId);
    setWaterSettingsModalOpen(true);
  };

  const openLightSettingsModal = (layerId: string) => {
    setLightSettingsTargetId(layerId);
    setLightSettingsModalOpen(true);
  };

  const handleConfirmLayerName = (name: string, _file: File | null, coords: { lat: number; lng: number } | null) => {
    const nextName = name || layerModalInitialName;
    const fallbackCenter = mapHandleRef.current?.getCenter() ?? { lat: mapCenter[1], lng: mapCenter[0] };
    const targetCoords = coords ?? fallbackCenter;
    const newLayerId = mapHandleRef.current?.addEditLayer({ name: nextName, coords: targetCoords }) ?? null;
    if (newLayerId) {
      setLayerModels((prev) => ({ ...prev, [newLayerId]: [] }));
    }
    if (coords) {
      mapHandleRef.current?.flyToLatLng(coords.lat, coords.lng);
    }
    setLayerModalOpen(false);
  };

  const openModelModal = (layerId: string) => {
    const targetLayer = layerOptions.find((option) => option.id === layerId);
    setModelModalTargetId(layerId);
    setModelModalTitle(targetLayer ? `Add Model to ${targetLayer.label}` : "Add Model");
    setModelModalOpen(true);
    setActiveLayerId(layerId);
  };

  const handleConfirmAddModel = (
    layerId: string,
    _name: string,
    file: File | null,
    coords: { lat: number; lng: number } | null
  ) => {
    const modelUrl = file ? URL.createObjectURL(file) : undefined;
    const fallbackCenter = mapHandleRef.current?.getCenter() ?? { lat: mapCenter[1], lng: mapCenter[0] };
    const targetCoords = coords ?? fallbackCenter;
    const modelInfo = createModelInfo(file, modelUrl, targetCoords);
    const added =
      mapHandleRef.current?.addModelToLayer(layerId, {
        modelUrl,
        coords: targetCoords,
        instanceId: modelInfo.id,
        name: modelInfo.name,
      }) ?? false;
    if (added) {
      setLayerModels((prev) => ({
        ...prev,
        [layerId]: [...(prev[layerId] ?? []), modelInfo],
      }));
      if (coords) {
        mapHandleRef.current?.flyToLatLng(coords.lat, coords.lng);
      }
    }
    setModelModalOpen(false);
    setModelModalTargetId(null);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <div className="absolute inset-0">
      <MapView
        center={mapCenter}
        zoom={16}
        styleUrl={styleUrl}
          activeLayerId={activeLayerId}
          ref={mapHandleRef}
          mapControlsRef={mapControlsRef}
          showTileBoundaries={showTiles}
          weather={weather}
          daylight={daylight}
          rainDensity={rainDensity}
          snowDensity={snowDensity}
          onSelectionChange={(selected) => {
            setHasSelection(selected);
            if (!selected) {
              setHasChanges(false);
              setSelectionElevation(null);
            }
          }}
          onSelectionElevationChange={setSelectionElevation}
          onTransformDirtyChange={setHasChanges}
        onLayerOptionsChange={setMapLayerOptions}
        />
      </div>
      {showShadowTime ? (
        <TimeShadowBar
          minutes={sunMinutes}
          date={sunDate}
          onChange={(minutes) => {
            setSunMinutes(minutes);
            setDaylight(getDaylightFromMinutes(minutes));
            const next = new Date(sunDate);
            next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
            mapHandleRef.current?.setSunTime(next);
          }}
          onClose={() => {
            setShowShadowTime(false);
          }}
        />
      ) : null}
      <LayerPanel
        layers={layerOptions}
        activeLayerId={activeLayerId}
        visibility={layerVisibility}
        modelsByLayer={layerModels}
        onSelectLayer={setActiveLayerId}
        onToggleVisibility={(id, visible) => {
          setLayerVisibility((prev) => ({ ...prev, [id]: visible }));
          mapHandleRef.current?.setLayerVisibility(id, visible);
        }}
        onAddModel={(id) => {
          if (id === "models") {
            return;
          }
          openModelModal(id);
        }}
        onCloneModel={(layerId, model) => {
          const clonedName = `${model.name} Copy`;
          const cloned = createModelInfo(null, undefined, model.coords ?? null, clonedName);
          const clonedOk =
            mapHandleRef.current?.cloneModelInLayer(layerId, model.id, cloned.id) ?? false;
          if (!clonedOk) {
            return;
          }
          setLayerModels((prev) => ({
            ...prev,
            [layerId]: [...(prev[layerId] ?? []), { ...cloned, coords: model.coords ?? null }],
          }));
        }}
        onDeleteModel={(layerId, model) => {
          const removed = mapHandleRef.current?.removeModelFromLayer(layerId, model.id) ?? false;
          if (!removed) {
            return;
          }
          setLayerModels((prev) => ({
            ...prev,
            [layerId]: (prev[layerId] ?? []).filter((entry) => entry.id !== model.id),
          }));
        }}
        onDeleteLayer={(id) => {
          const isCustom = customInstanceLayers.some((layer) => layer.id === id);
          const isWater = customWaterLayers.some((layer) => layer.id === id);
          mapHandleRef.current?.removeLayer(id);
          setLayerLightSettings((prev) => {
            if (!(id in prev)) {
              return prev;
            }
            const next = { ...prev };
            delete next[id];
            return next;
          });
          if (isCustom) {
            revokeInstanceBlobUrls(id);
            setCustomInstanceLayers((prev) => prev.filter((layer) => layer.id !== id));
            setLayerVisibility((prev) => {
              if (!(id in prev)) {
                return prev;
              }
              const next = { ...prev };
              delete next[id];
              return next;
            });
            return;
          }
          if (isWater) {
            revokeWaterBlobUrls(id);
            setCustomWaterLayers((prev) => prev.filter((layer) => layer.id !== id));
            setLayerVisibility((prev) => {
              if (!(id in prev)) {
                return prev;
              }
              const next = { ...prev };
              delete next[id];
              return next;
            });
            setWaterLayerSettings((prev) => {
              if (!(id in prev)) {
                return prev;
              }
              const next = { ...prev };
              delete next[id];
              return next;
            });
            return;
          }
          setLayerModels((prev) => {
            if (!prev[id]) {
              return prev;
            }
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }}
        onJumpToModel={(model) => {
          if (!model.coords) {
            return;
          }
          mapHandleRef.current?.flyToLatLng(model.coords.lat, model.coords.lng, 20);
        }}
        onShowAll={() => {
          setLayerVisibility((prev) => {
            const next: Record<string, boolean> = { ...prev };
            layerOptions.forEach((layer) => {
              next[layer.id] = true;
            });
            return next;
          });
          layerOptions.forEach((layer) => {
            mapHandleRef.current?.setLayerVisibility(layer.id, true);
          });
        }}
        onHideAll={() => {
          setLayerVisibility((prev) => {
            const next: Record<string, boolean> = { ...prev };
            layerOptions.forEach((layer) => {
              next[layer.id] = false;
            });
            return next;
          });
          layerOptions.forEach((layer) => {
            mapHandleRef.current?.setLayerVisibility(layer.id, false);
          });
        }}
        onAddLayer={openLayerModal}
        onAddInstanceLayer={openInstanceLayerModal}
        onAddWaterLayer={openWaterLayerModal}
        onEditWaterLayer={openWaterSettingsModal}
        onEditLayerLight={openLightSettingsModal}
        isOpen={isLayerPanelOpen}
        onToggleOpen={() => setIsLayerPanelOpen((prev) => !prev)}
      />
      <TransformPanel
        values={transformValues}
        disabled={!hasSelection}
        mode={mode}
        onChangeMode={(nextMode) => {
          if (nextMode === "reset") {
            mapHandleRef.current?.setTransformMode(nextMode);
            return;
          }
          setMode(nextMode);
          mapHandleRef.current?.setTransformMode(nextMode);
        }}
        onSnapToGround={() => {
          mapHandleRef.current?.snapObjectSelectedToGround();
        }}
        enableClippingPlane={(enable) => {
          mapHandleRef.current?.enableClippingPlanesObjectSelected(enable);
        }}
        enableFootPrintWhenEdit={(enable) => {
          mapHandleRef.current?.enableFootPrintWhenEdit(enable);
        }}
        onChange={(next) => {
          mapHandleRef.current?.setSelectedTransform(next);
          setTransformValues((prev) => {
            if (!prev) {
              return prev;
            }
            return {
              position: next.position ?? prev.position,
              rotation: next.rotation ?? prev.rotation,
              scale: next.scale ?? prev.scale,
            };
          });
        }}
      />
      <EditorToolbar
        showTiles={showTiles}
        onToggleTiles={() => {
          setShowTiles((current) => {
            const next = !current;
            mapHandleRef.current?.setShowTileBoundaries(next);
            return next;
          });
        }}
        theme={theme}
        onToggleTheme={() => {
          setTheme((current) => (current === "dark" ? "light" : "dark"));
        }}
        defaultZoom={16}
        onFlyTo={(lat, lng, zoom) => {
          mapHandleRef.current?.flyToLatLng(lat, lng, zoom);
        }}
        showShadowTime={showShadowTime}
        onToggleShadowTime={() => setShowShadowTime((prev) => !prev)}
        weather={weather}
        onChangeWeather={setWeather}
        daylight={daylight}
        onChangeDaylight={applyDaylight}
        rainDensity={rainDensity}
        snowDensity={snowDensity}
        onChangeRainDensity={setRainDensity}
        onChangeSnowDensity={setSnowDensity}
        mapControlsRef={mapControlsRef}
      />
      <LayerNameModal
        open={layerModalOpen}
        initialValue={layerModalInitialName}
        onCancel={() => setLayerModalOpen(false)}
        onConfirm={handleConfirmLayerName}
        title="New Edit Layer"
        confirmLabel="Create Layer"
        showModelInput={false}
        showCoordsInput={false}
      />
      <LayerNameModal
        open={modelModalOpen}
        initialValue=""
        onCancel={() => {
          setModelModalOpen(false);
          setModelModalTargetId(null);
        }}
        onConfirm={(name, file, coords) => {
          if (!modelModalTargetId) {
            setModelModalOpen(false);
            return;
          }
          handleConfirmAddModel(modelModalTargetId, name, file, coords);
        }}
        title={modelModalTitle}
        subtitle="Choose a model to add to this layer."
        confirmLabel="Add Model"
        showNameInput={false}
        showCoordsInput={true}
        showModelInput={true}
      />
      <InstanceLayerModal
        open={instanceLayerModalOpen}
        defaultTileUrl={defaultInstanceTileUrl}
        defaultSourceLayer={defaultInstanceSourceLayer}
        defaultModelUrls={defaultInstanceModelUrls}
        selectedFiles={instanceModelFiles}
        onChangeFiles={setInstanceModelFiles}
        onCancel={() => setInstanceLayerModalOpen(false)}
        nameValue={instanceLayerName}
        onChangeName={setInstanceLayerName}
        onConfirm={(data) => {
          const fileUrls =
            data.modelFiles.length > 0
              ? data.modelFiles.map((file) => URL.createObjectURL(file))
              : [];
          const layerId =
            mapHandleRef.current?.addInstanceLayer({
              tileUrl: data.tileUrl,
              sourceLayer: data.sourceLayer,
              modelUrls: fileUrls.length > 0 ? fileUrls : data.modelUrls,
            }) ?? null;
          if (!layerId) {
            fileUrls.forEach((url) => URL.revokeObjectURL(url));
            return;
          }
          if (fileUrls.length > 0) {
            instanceBlobUrlsRef.current.set(layerId, fileUrls);
          }
          const label = data.name.trim() || instanceLayerName.trim() || `Custom Layer ${customLayerCount + 1}`;
          setCustomInstanceLayers((prev) => [
            ...prev,
            { id: layerId, label, kind: "instance" },
          ]);
          setLayerVisibility((prev) => ({ ...prev, [layerId]: true }));
          setInstanceLayerModalOpen(false);
        }}
      />
      <WaterLayerModal
        open={waterLayerModalOpen}
        nameValue={waterLayerName}
        onChangeName={setWaterLayerName}
        defaultTileUrl={defaultWaterTileUrl}
        defaultSourceLayer={defaultWaterSourceLayer}
        selectedFile={waterTextureFile}
        onChangeFile={setWaterTextureFile}
        onCancel={() => setWaterLayerModalOpen(false)}
        onConfirm={(data) => {
          const textureUrl = data.file ? URL.createObjectURL(data.file) : undefined;
          const settings = { ...DEFAULT_WATER_SETTINGS };
          const layerId =
            mapHandleRef.current?.addWaterLayer({
              tileUrl: data.tileUrl,
              sourceLayer: data.sourceLayer,
              normalTextureUrl: textureUrl,
              settings,
            }) ?? null;
          if (!layerId) {
            if (textureUrl) {
              URL.revokeObjectURL(textureUrl);
            }
            return;
          }
          if (textureUrl) {
            waterBlobUrlsRef.current.set(layerId, textureUrl);
          }
          const label = data.name.trim() || waterLayerName.trim() || `Water Layer ${customWaterCount + 1}`;
          setCustomWaterLayers((prev) => [
            ...prev,
            { id: layerId, label, kind: "water" },
          ]);
          setLayerVisibility((prev) => ({ ...prev, [layerId]: true }));
          setWaterLayerSettings((prev) => ({ ...prev, [layerId]: settings }));
          setWaterLayerModalOpen(false);
        }}
      />
      <WaterSettingsModal
        open={waterSettingsModalOpen}
        layerName={
          (waterSettingsTargetId &&
            customWaterLayers.find((layer) => layer.id === waterSettingsTargetId)?.label) ||
          "Water Layer"
        }
        initialSettings={
          (waterSettingsTargetId && waterLayerSettings[waterSettingsTargetId]) || DEFAULT_WATER_SETTINGS
        }
        onCancel={() => {
          setWaterSettingsModalOpen(false);
          setWaterSettingsTargetId(null);
        }}
        onConfirm={(settings) => {
          if (!waterSettingsTargetId) {
            setWaterSettingsModalOpen(false);
            return;
          }
          setWaterLayerSettings((prev) => ({ ...prev, [waterSettingsTargetId]: settings }));
          mapHandleRef.current?.setWaterLayerSettings(waterSettingsTargetId, settings);
          setWaterSettingsModalOpen(false);
          setWaterSettingsTargetId(null);
        }}
      />
      <LightSettingsModal
        open={lightSettingsModalOpen}
        layerName={
          (lightSettingsTargetId &&
            layerOptions.find((layer) => layer.id === lightSettingsTargetId)?.label) ||
          "Layer"
        }
        initialSettings={
          (lightSettingsTargetId && layerLightSettings[lightSettingsTargetId]) || defaultLightSettings
        }
        defaultSettings={defaultLightSettings}
        min={lightIntensityRange.min}
        max={lightIntensityRange.max}
        step={lightIntensityRange.step}
        onCancel={() => {
          setLightSettingsModalOpen(false);
          setLightSettingsTargetId(null);
        }}
        onConfirm={(settings) => {
          if (!lightSettingsTargetId) {
            setLightSettingsModalOpen(false);
            return;
          }
          applyLightSettings(lightSettingsTargetId, settings);
          setLightSettingsModalOpen(false);
          setLightSettingsTargetId(null);
        }}
      />
    </div>
  );
}

export default App;
