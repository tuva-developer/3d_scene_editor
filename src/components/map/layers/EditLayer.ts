import maplibregl, { MapMouseEvent, OverscaledTileID } from "maplibre-gl";
import type { CustomLayerInterface } from "maplibre-gl";
import * as THREE from "three";
import { MaplibreShadowMesh } from "@/components/map/shadow/ShadowGeometry";
import { calculateSunDirectionMaplibre } from "@/components/map/shadow/ShadowHelper";
import { createLightGroup, prepareModelForRender, transformModel } from "@/components/map/data/models/objModel";
import { getMetersPerExtentUnit, latlonToLocal, clampZoom } from "@/components/map/data/convert/coords";
import type { ModelData } from "@/components/map/data/types";

export type SunOptions = {
  shadow: boolean;
  altitude: number;
  azimuth: number;
};

export type SunParameter = {
  altitude: number;
  azimuth: number;
  sunDir: THREE.Vector3;
  shadow: boolean;
};

export type PickHit = {
  dist: number;
  tileKey: string;
  overScaledTileId: OverscaledTileID;
  object: THREE.Object3D;
};

export type EditorLayerOpts = {
  id: string;
  applyGlobeMatrix: boolean;
  editorLevel: number;
  sun?: SunOptions;
};

export type ObjectDefine = {
  id: string;
  modeldata: ModelData;
};

export type ObjectInfoForEditorLayer = {
  id: string;
  name: string;
  object3d: THREE.Object3D;
  textureUrl: string;
  textureName: string;
  modelName: string;
  modelUrl: string;
  mixer?: THREE.AnimationMixer | null;
  actions?: THREE.AnimationAction[] | null;
  animations?: THREE.AnimationClip[];
};

export type DataTileInfoForEditorLayer = {
  objects: Array<ObjectInfoForEditorLayer>;
  sceneTile: THREE.Scene;
};

type RenderTile = {
  overScaledTileID: OverscaledTileID;
  tileInfo: DataTileInfoForEditorLayer;
};

export class EditLayer implements CustomLayerInterface {
  id: string;
  editorLevel = 16;
  readonly type = "custom" as const;
  readonly renderingMode = "3d" as const;
  tileSize = 512;
  private sun: SunParameter | null | undefined;
  private map: maplibregl.Map | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private camera: THREE.Camera | null = null;
  private visible = true;
  private raycaster = new THREE.Raycaster();
  private modelCache: Map<string, ModelData> = new Map<string, ModelData>();
  private tileCache: Map<string, DataTileInfoForEditorLayer> = new Map<string, DataTileInfoForEditorLayer>();
  private applyGlobeMatrix = false;
  private onPick?: (info: PickHit) => void;
  private onPickFail?: () => void;
  private pickEnabled = true;
  private clock: THREE.Clock | null = null;

  constructor(opts: EditorLayerOpts & { onPick?: (info: PickHit) => void } & { onPickFail?: () => void }) {
    this.id = opts.id;
    this.editorLevel = opts.editorLevel;
    this.applyGlobeMatrix = opts.applyGlobeMatrix;
    this.onPick = opts.onPick;
    this.onPickFail = opts.onPickFail;
    if (opts.sun) {
      this.sun = {
        altitude: opts.sun.altitude,
        azimuth: opts.sun.azimuth,
        sunDir: calculateSunDirectionMaplibre(
          THREE.MathUtils.degToRad(opts.sun.altitude),
          THREE.MathUtils.degToRad(opts.sun.azimuth)
        ),
        shadow: opts.sun.shadow,
      };
    }
  }

  setSunPos(altitude: number, azimuth: number, shadow: boolean = true): void {
    this.sun = {
      altitude,
      azimuth,
      sunDir: calculateSunDirectionMaplibre(THREE.MathUtils.degToRad(altitude), THREE.MathUtils.degToRad(azimuth)),
      shadow,
    };
  }

  setPickEnabled(enabled: boolean): void {
    this.pickEnabled = enabled;
  }

  onAdd(map: maplibregl.Map, gl: WebGLRenderingContext): void {
    this.map = map;
    this.camera = new THREE.Camera();
    this.camera.matrixAutoUpdate = false;
    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true,
      stencil: true,
    });
    this.renderer.autoClear = false;
    this.renderer.localClippingEnabled = true;
    this.clock = new THREE.Clock();
    map.on("click", this.handleClick);
  }

  onRemove(): void {
    this.map?.off("click", this.handleClick);
    this.renderer?.dispose();
    this.renderer = null;
    this.camera = null;
    this.map = null;
  }

  addObjectsToCache(objects: ObjectDefine[]): void {
    for (const obj of objects) {
      if (!this.modelCache.has(obj.id)) {
        prepareModelForRender(obj.modeldata.object3d as THREE.Object3D, false);
        this.modelCache.set(obj.id, obj.modeldata);
      }
    }
  }

  addObjectToScene(id: string, defaultScale: number = 1): void {
    if (!this.map) {
      return;
    }
    const modelData = this.modelCache.get(id);
    if (!modelData) {
      return;
    }
    const rootObj = modelData.object3d;
    if (!rootObj) {
      return;
    }
    const center = this.map.getCenter();
    const local = latlonToLocal(center.lng, center.lat, this.editorLevel);
    const key = this.tileKey(local.tileX, local.tileY, local.tileZ);
    const tileData = this.getTileData(key);
    const cloneObj3d = rootObj.clone(true);
    const scaleUnit = getMetersPerExtentUnit(center.lat, this.editorLevel);
    const bearing = 0;
    const objectScale = defaultScale;
    cloneObj3d.name = id;
    transformModel(local.coordX, local.coordY, 0, bearing, objectScale, scaleUnit, cloneObj3d);
    cloneObj3d.matrixAutoUpdate = false;
    cloneObj3d.updateMatrix();
    cloneObj3d.updateMatrixWorld(true);

    let mixer: THREE.AnimationMixer | null = null;
    let actions: THREE.AnimationAction[] | null = null;
    if (modelData.animations && modelData.animations.length > 0) {
      mixer = new THREE.AnimationMixer(cloneObj3d);
      actions = [];
      modelData.animations.forEach((clip) => {
        const action = mixer?.clipAction(clip);
        if (action) {
          action.reset();
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.play();
          actions?.push(action);
        }
      });
    }

    cloneObj3d.userData = {
      tile: { z: this.editorLevel, x: local.tileX, y: local.tileY },
      isModelRoot: true,
      scaleUnit,
      mixer,
    };

    tileData.objects.push({
      id: "",
      name: "",
      object3d: cloneObj3d,
      textureUrl: "",
      textureName: "",
      modelName: "",
      modelUrl: "",
      mixer,
      actions,
      animations: modelData.animations ?? [],
    });

    const mainScene = tileData.sceneTile;
    cloneObj3d.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const objectShadow = new MaplibreShadowMesh(child);
        objectShadow.userData = { scale_unit: scaleUnit };
        objectShadow.matrixAutoUpdate = false;
        mainScene.add(objectShadow);
      }
    });
    mainScene.add(cloneObj3d);
    this.map?.triggerRepaint();
  }

  render(): void {
    if (!this.map || !this.camera || !this.renderer || !this.visible) {
      return;
    }
    this.renderer.clearStencil();
    const zoom = clampZoom(this.editorLevel, this.editorLevel, Math.round(this.map.getZoom()));
    const visibleTiles = this.map.coveringTiles({
      tileSize: this.tileSize,
      minzoom: zoom,
      maxzoom: zoom,
      roundZoom: true,
    });
    const renderTiles = this.ensureTiles(visibleTiles as OverscaledTileID[]);
    const tr = this.map.transform;
    if (!tr?.getProjectionData) {
      return;
    }
    for (const tile of renderTiles) {
      if (!tile.overScaledTileID || !tile.tileInfo.sceneTile) {
        continue;
      }
      const projectionData = tr.getProjectionData({
        overscaledTileID: tile.overScaledTileID,
        applyGlobeMatrix: this.applyGlobeMatrix,
      });
      const tileMatrix = projectionData.mainMatrix;
      this.camera.projectionMatrix = new THREE.Matrix4().fromArray(tileMatrix);
      this.renderer.resetState();
      this.updateShadow(tile.tileInfo.sceneTile);
      const delta = this.clock?.getDelta();
      if (delta) {
        this.animate(tile.tileInfo, delta);
      }
      this.renderer.render(tile.tileInfo.sceneTile, this.camera);
    }
  }

  private handleClick = (e: MapMouseEvent) => {
    if (!this.map || !this.camera || !this.renderer || !this.visible || !this.pickEnabled) {
      return;
    }
    const canvas = this.map.getCanvas();
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2((e.point.x / rect.width) * 2 - 1, -((e.point.y / rect.height) * 2 - 1));
    const zoom = clampZoom(this.editorLevel, this.editorLevel, Math.round(this.map.getZoom()));
    const visibleTiles = this.map.coveringTiles({
      tileSize: this.tileSize,
      minzoom: zoom,
      maxzoom: zoom,
      roundZoom: true,
    }) as OverscaledTileID[];
    const tr = this.map.transform;
    if (!tr?.getProjectionData) {
      return;
    }

    let bestHit: { dist: number; tileKey: string; overScaledTileID: OverscaledTileID; group: THREE.Object3D } | null = null;

    for (const tid of visibleTiles) {
      const key = this.tileKey(tid.canonical.x, tid.canonical.y, tid.canonical.z);
      const tile = this.tileCache.get(key);
      if (!tile?.sceneTile) {
        continue;
      }

      const proj = tr.getProjectionData({
        overscaledTileID: tid,
        applyGlobeMatrix: this.applyGlobeMatrix,
      });

      const mvp = new THREE.Matrix4().fromArray(proj.mainMatrix);
      const inv = mvp.clone().invert();
      const pNear = new THREE.Vector4(ndc.x, ndc.y, -1, 1).applyMatrix4(inv);
      pNear.multiplyScalar(1 / pNear.w);
      const pFar = new THREE.Vector4(ndc.x, ndc.y, 1, 1).applyMatrix4(inv);
      pFar.multiplyScalar(1 / pFar.w);

      const origin = new THREE.Vector3(pNear.x, pNear.y, pNear.z);
      const direction = new THREE.Vector3(pFar.x, pFar.y, pFar.z).sub(origin).normalize();
      this.raycaster.ray.origin.copy(origin);
      this.raycaster.ray.direction.copy(direction);

      const hits = this.raycaster.intersectObjects(tile.sceneTile.children, true);
      if (hits.length) {
        const h0 = hits[0];
        let obj: THREE.Object3D | null = h0.object;
        while (obj && !obj.userData?.isModelRoot) {
          obj = obj.parent as THREE.Object3D;
        }
        if (obj) {
          if (!bestHit || h0.distance < bestHit.dist) {
            bestHit = { dist: h0.distance, tileKey: key, overScaledTileID: tid, group: obj };
          }
        }
      }
    }

    if (!bestHit) {
      this.onPickFail?.();
      this.map.triggerRepaint();
      return;
    }

    this.onPick?.({
      dist: bestHit.dist,
      tileKey: bestHit.tileKey,
      object: bestHit.group,
      overScaledTileId: bestHit.overScaledTileID,
    });
    this.map.triggerRepaint();
  };

  private tileKey(x: number, y: number, z: number): string {
    return `${z}/${x}/${y}`;
  }

  private getTileData(key: string): DataTileInfoForEditorLayer {
    let tileData = this.tileCache.get(key);
    if (!tileData) {
      const scene = new THREE.Scene();
      const dirLight = (this.sun?.sunDir ?? new THREE.Vector3(0.5, 0.5, 0.5)).clone().normalize();
      createLightGroup(scene, dirLight);
      tileData = {
        objects: [],
        sceneTile: scene,
      };
      this.tileCache.set(key, tileData);
    }
    return tileData;
  }

  private updateShadow(scene: THREE.Scene): void {
    const sunDir = this.sun?.sunDir;
    if (!sunDir) {
      return;
    }
    scene.traverse((child) => {
      if (child instanceof MaplibreShadowMesh) {
        const shadowScaleZ = child.userData.scale_unit ?? child.userData.scaleUnit;
        child.update(new THREE.Vector3(sunDir.x, sunDir.y, -sunDir.z / shadowScaleZ));
      }
    });
  }

  private ensureTiles(tiles: OverscaledTileID[]): RenderTile[] {
    const result: RenderTile[] = [];
    for (const overScaledTileID of tiles) {
      const canonical = overScaledTileID.canonical;
      const key = this.tileKey(canonical.x, canonical.y, canonical.z);
      const tileData = this.tileCache.get(key);
      if (tileData) {
        result.push({
          overScaledTileID,
          tileInfo: tileData,
        });
      }
    }
    return result;
  }

  private animate(tileInfo: DataTileInfoForEditorLayer, delta: number): void {
    tileInfo.objects.forEach((obj) => {
      const mixer = obj.mixer;
      if (mixer) {
        mixer.update(delta);
      }
    });
    this.map?.triggerRepaint();
  }
}
