import React, { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import maplibregl from "maplibre-gl";
import type { WebGLContextAttributesWithType } from "maplibre-gl";
import { ModelLayer } from "@/components/map/layers/ModelLayer";
import { OverlayLayer } from "@/components/map/layers/OverlayLayer";
import OutlineLayer from "@/components/map/layers/OutlineLayer";
import { EditLayer } from "@/components/map/layers/EditLayer";
import type { LayerOption, TransformMode, TransformValues } from "@/types/common";
import { loadModelFromGlb } from "@/components/map/data/models/objModel";
import { getSunPosition, getSunPositionAt } from "@/components/map/shadow/ShadowHelper";
import { MathUtils } from "three";

interface MapViewProps {
  center?: [number, number];
  zoom?: number;
  styleUrl?: string;
  activeLayerId?: string;
  style?: React.CSSProperties;
  showTileBoundaries?: boolean;
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
  getSelectedTransform(): TransformValues | null;
  setSelectedTransform(values: Partial<TransformValues>): void;
  flyToLatLng(lat: number, lng: number, zoom?: number): void;
  getCenter(): { lat: number; lng: number } | null;
  setLayerVisibility(id: string, visible: boolean): void;
  removeLayer(id: string): void;
  setSunTime(date: Date): void;
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

const MapView = forwardRef<MapViewHandle, MapViewProps>(
  (
    {
      center = [106.6297, 10.8231],
      zoom = 12,
      styleUrl,
      activeLayerId,
      showTileBoundaries = true,
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
    const currentModeRef = useRef<TransformMode>("translate");
    const editLayersRef = useRef<Array<{ layer: EditLayer; name: string }>>([]);
    const styleUrlRef = useRef<string | null>(null);
    const activeLayerIdRef = useRef<string | undefined>(activeLayerId);
    const showTileBoundariesRef = useRef<boolean>(showTileBoundaries);
    const sunTimeRef = useRef<Date | null>(null);
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
        const options: LayerOption[] = [{ id: "models", label: "Models (Base)" }];
        for (const entry of editLayersRef.current) {
          options.push({ id: entry.layer.id, label: entry.name });
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
        const entry = editLayersRef.current.find((item) => item.layer.id === id);
        if (entry) {
          entry.layer.setVisible(visible);
          map.current?.triggerRepaint();
        }
      },
      removeLayer(id) {
        if (id === "models") {
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
          { id: "models", label: "Models (Base)" },
          ...editLayersRef.current.map((item) => ({ id: item.layer.id, label: item.name })),
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
        const defaultGlbPath = (import.meta.env.VITE_EDIT_MODEL_URL as string | undefined)?.trim() || "/models/default.glb";
        const glbPath = options?.modelUrl?.trim() || defaultGlbPath;
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
        mainMap.addLayer(editorLayer);
        mainMap.moveLayer(editorLayer.id, outlineLayer.id);
        editLayersRef.current.push({ layer: editorLayer, name: layerName });
        editorLayer.setPickEnabled(activeLayerIdRef.current === editorLayer.id);
        onLayerOptionsChangeRef.current?.([
          { id: "models", label: "Models (Base)" },
          ...editLayersRef.current.map((entry) => ({
            id: entry.layer.id,
            label: entry.name,
          })),
        ]);
        return id;
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
        editLayersRef.current.forEach((entry) => {
          entry.layer.setSunPos(sunPos.altitude, sunPos.azimuth);
        });
        mainMap.triggerRepaint();
      },
    }));

    return <div ref={mapContainer} className="h-full w-full" />;
  }
);

export default MapView;
