import { useEffect, useMemo, useRef, useState } from "react";
import MapView from "@/components/map/MapView";
import { EditorToolbar } from "@/components/toolbar/EditorToolbar";
import LayerPanel from "@/components/ui/LayerPanel";
import LayerNameModal from "@/components/ui/LayerNameModal";
import TransformPanel from "@/components/ui/TransformPanel";
import type { LayerOption, MapStyleOption, ThemeMode, TransformMode, TransformValues } from "@/types/common";
import type { MapViewHandle } from "@/components/map/MapView";

function App() {
  const envStylePath = (import.meta.env.VITE_STYLE_PATH as string | undefined)?.trim() ?? "";
  const styleOptions: MapStyleOption[] = useMemo(() => {
    const options: MapStyleOption[] = [
      {
        id: "openfreemap-liberty",
        label: "OpenFreeMap Liberty",
        url: "https://tiles.openfreemap.org/styles/liberty",
      },
      {
        id: "openfreemap-bright",
        label: "OpenFreeMap Bright",
        url: "https://tiles.openfreemap.org/styles/bright",
      },
      {
        id: "openfreemap-positron",
        label: "OpenFreeMap Positron",
        url: "https://tiles.openfreemap.org/styles/positron",
      },
      {
        id: "maplibre-demotiles",
        label: "MapLibre Demo",
        url: "https://demotiles.maplibre.org/style.json",
      },
      {
        id: "carto-positron",
        label: "CARTO Positron",
        url: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      },
      {
        id: "carto-voyager",
        label: "CARTO Voyager",
        url: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      },
      {
        id: "carto-dark-matter",
        label: "CARTO Dark Matter",
        url: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      },
    ];

    if (envStylePath) {
      options.unshift({
        id: "env-custom",
        label: "Custom (Env)",
        url: envStylePath,
      });
    }

    return options;
  }, [envStylePath]);

  const [mode, setMode] = useState<TransformMode>("translate");
  const [showTiles, setShowTiles] = useState<boolean>(false);
  const [hasSelection, setHasSelection] = useState<boolean>(false);
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [selectionElevation, setSelectionElevation] = useState<number | null>(null);
  const [layerOptions, setLayerOptions] = useState<LayerOption[]>([{ id: "models", label: "Models (Base)" }]);
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({ models: true });
  const [activeLayerId, setActiveLayerId] = useState<string>(() => {
    if (typeof window === "undefined") {
      return "models";
    }
    return window.localStorage.getItem("scene-editor-active-layer") || "models";
  });
  const [layerModalOpen, setLayerModalOpen] = useState(false);
  const [layerModalInitialName, setLayerModalInitialName] = useState("Edit Layer 1");
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(true);
  const [transformValues, setTransformValues] = useState<TransformValues | null>(null);
  const [styleId, setStyleId] = useState<string>(() => {
    if (typeof window === "undefined") {
      return "carto-positron";
    }
    const stored = window.localStorage.getItem("scene-editor-style-id");
    if (stored) {
      return stored;
    }
    return "carto-positron";
  });
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "dark";
    }
    const stored = window.localStorage.getItem("scene-editor-theme");
    return stored === "light" ? "light" : "dark";
  });
  const mapHandleRef = useRef<MapViewHandle>(null);
  const mapCenter = useMemo(() => [106.6297, 10.8231] as [number, number], []);
  const currentStyle = styleOptions.find((option) => option.id === styleId) ?? styleOptions[0];
  const styleUrl = currentStyle.url;
  const editLayerCount = layerOptions.filter((option) => option.id !== "models").length;

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
    if (currentStyle.id !== styleId) {
      setStyleId(currentStyle.id);
    }
  }, [currentStyle.id, styleId]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("theme-light", "theme-dark");
    root.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
    window.localStorage.setItem("scene-editor-theme", theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem("scene-editor-style-id", currentStyle.id);
    setHasSelection(false);
    setHasChanges(false);
    setSelectionElevation(null);
  }, [currentStyle.id]);

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

  const handleConfirmLayerName = (name: string, file: File | null, coords: { lat: number; lng: number } | null) => {
    const nextName = name || layerModalInitialName;
    const modelUrl = file ? URL.createObjectURL(file) : undefined;
    const newLayerId =
      mapHandleRef.current?.addEditLayer({ name: nextName, modelUrl, coords: coords ?? undefined }) ?? null;
    if (newLayerId) {
      setActiveLayerId(newLayerId);
    }
    if (coords) {
      mapHandleRef.current?.flyToLatLng(coords.lat, coords.lng);
    }
    setLayerModalOpen(false);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <MapView
        center={mapCenter}
        zoom={16}
        styleUrl={styleUrl}
        activeLayerId={activeLayerId}
        ref={mapHandleRef}
        showTileBoundaries={showTiles}
        onSelectionChange={(selected) => {
          setHasSelection(selected);
          if (!selected) {
            setHasChanges(false);
            setSelectionElevation(null);
          }
        }}
        onSelectionElevationChange={setSelectionElevation}
        onTransformDirtyChange={setHasChanges}
        onLayerOptionsChange={setLayerOptions}
      />
      <LayerPanel
        layers={layerOptions}
        activeLayerId={activeLayerId}
        visibility={layerVisibility}
        onSelectLayer={setActiveLayerId}
        onToggleVisibility={(id, visible) => {
          setLayerVisibility((prev) => ({ ...prev, [id]: visible }));
          mapHandleRef.current?.setLayerVisibility(id, visible);
        }}
        onDeleteLayer={(id) => {
          mapHandleRef.current?.removeLayer(id);
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
            setMode("translate");
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
        onAddLayer={() => {
          openLayerModal();
        }}
        theme={theme}
        onToggleTheme={() => {
          setTheme((current) => (current === "dark" ? "light" : "dark"));
        }}
        styleOptions={styleOptions}
        styleId={currentStyle.id}
        onChangeStyle={setStyleId}
        defaultZoom={16}
        onFlyTo={(lat, lng, zoom) => {
          mapHandleRef.current?.flyToLatLng(lat, lng, zoom);
        }}
      />
      <LayerNameModal
        open={layerModalOpen}
        initialValue={layerModalInitialName}
        onCancel={() => setLayerModalOpen(false)}
        onConfirm={handleConfirmLayerName}
        title="New Edit Layer"
        confirmLabel="Create Layer"
      />
    </div>
  );
}

export default App;
