import maplibregl, { MapMouseEvent } from "maplibre-gl";
import type { CustomLayerInterface } from "maplibre-gl";
import * as THREE from "three";
import { InstancedMesh } from "three";
import {
  bakeWorldAndConvertYupToZup,
  createLightGroup,
  loadModelFromGlb,
} from "@/components/map/data/models/objModel";
import { clampZoom, tileLocalToLatLon, getMetersPerExtentUnit } from "@/components/map/data/convert/coords";
import { CustomVectorSource } from "@/components/map/source/CustomVectorSource";
import { buildShadowMatrix, calculateSunDirectionMaplibre } from "@/components/map/shadow/ShadowHelper";
import InstancedGroupMesh from "@/components/map/instance/InstancedGroupMesh";

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
  overScaledTileId: maplibregl.OverscaledTileID;
  object: THREE.Object3D;
};

export type InstanceLayerOpts = {
  id: string;
  applyGlobeMatrix: boolean;
  sourceLayer: string;
  sun?: SunOptions;
  objectUrl: string[];
};

export type DataTileInfoForInstanceLayer = {
  sceneTile: THREE.Scene;
};

export class InstanceLayer implements CustomLayerInterface {
  id: string;
  visible = true;
  sourceLayer: string;
  readonly type = "custom" as const;
  readonly renderingMode = "3d" as const;
  tileSize = 512;
  private vectorSource: CustomVectorSource | null = null;
  private tileCache: Map<string, DataTileInfoForInstanceLayer> = new Map();
  private objectUrls: string[];
  private shadowMaterial: THREE.MeshBasicMaterial | null = null;
  private mapObj3d: Map<string, THREE.Object3D> = new Map();
  private sun: SunParameter | null | undefined;
  private map: maplibregl.Map | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private camera: THREE.Camera | null = null;
  private applyGlobeMatrix = false;
  private onPick?: (info: PickHit) => void;
  private onPickFail?: () => void;

  constructor(opts: InstanceLayerOpts & { onPick?: (info: PickHit) => void } & { onPickfail?: () => void }) {
    this.id = opts.id;
    this.applyGlobeMatrix = opts.applyGlobeMatrix;
    this.onPick = opts.onPick;
    this.onPickFail = opts.onPickfail;
    this.sourceLayer = opts.sourceLayer;
    this.objectUrls = opts.objectUrl;
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
    this.shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      stencilWrite: true,
      stencilFunc: THREE.EqualStencilFunc,
      stencilRef: 0,
      stencilZPass: THREE.IncrementStencilOp,
      side: THREE.DoubleSide,
    });
  }

  setSunPos(altitude: number, azimuth: number, shadow: boolean = true): void {
    this.sun = {
      altitude,
      azimuth,
      sunDir: calculateSunDirectionMaplibre(
        THREE.MathUtils.degToRad(altitude),
        THREE.MathUtils.degToRad(azimuth)
      ),
      shadow,
    };
    this.map?.triggerRepaint();
  }

  onAdd(map: maplibregl.Map, gl: WebGLRenderingContext): void {
    this.map = map;
    this.camera = new THREE.Camera();
    this.camera.matrixAutoUpdate = false;
    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
    });
    this.renderer.autoClear = false;
    this.renderer.localClippingEnabled = true;
    map.on("click", this.handleClick);

    this.objectUrls.forEach((url) => {
      loadModelFromGlb(url).then((modelData) => {
        if (modelData.object3d) {
          const object3d = modelData.object3d;
          bakeWorldAndConvertYupToZup(object3d);
          if (!this.mapObj3d.has(url)) {
            this.mapObj3d.set(url, object3d);
          }
        }
      });
    });
  }

  onRemove(): void {
    this.renderer?.dispose();
    this.renderer = null;
    this.camera = null;
    this.map = null;
  }

  setVectorSource(source: CustomVectorSource): void {
    this.vectorSource = source;
    this.vectorSource.onUnloadTile = (tile_key) => {
      if (this.tileCache.has(tile_key)) {
        this.tileCache.delete(tile_key);
      }
    };
  }

  private tileKey(x: number, y: number, z: number): string {
    return `${z}/${x}/${y}`;
  }

  private updateShadow(scene: THREE.Scene) {
    const sunDir = this.sun?.sunDir;
    if (!sunDir) {
      return;
    }
    for (const [key] of this.mapObj3d) {
      const instanceMesh = scene.getObjectByName(`instancedMesh_${key}`) as InstancedGroupMesh | null;
      const instanceShadowMesh = scene.getObjectByName(`instanceShadowMesh_${key}`) as InstancedMesh | null;
      if (instanceShadowMesh && instanceMesh) {
        const count = instanceShadowMesh.count;
        for (let i = 0; i < count; i += 1) {
          const scaleUnit = instanceMesh.getUserDataAt(i)?.scale_unit as number | undefined;
          if (scaleUnit) {
            const baseMatrix = new THREE.Matrix4();
            const shadowMatrix = new THREE.Matrix4();
            const finalMatrix = new THREE.Matrix4();
            instanceMesh.getMatrixAt(i, baseMatrix);
            buildShadowMatrix(new THREE.Vector3(sunDir.x, sunDir.y, -sunDir.z / scaleUnit), 0, shadowMatrix);
            finalMatrix.multiplyMatrices(shadowMatrix, baseMatrix);
            instanceShadowMesh.setMatrixAt(i, finalMatrix);
          }
        }
        instanceShadowMesh.instanceMatrix.needsUpdate = true;
      }
    }
  }

  private handleClick = (e: MapMouseEvent) => {
    console.log(e);
  };

  distribute(mapNumber: Map<string, number>, object_size: number, feature_size: number) {
    const quotient = Math.floor(feature_size / object_size);
    const remainder = feature_size % feature_size;
    for (const key of mapNumber.keys()) {
      mapNumber.set(key, quotient);
    }
    let count = 0;
    for (const key of mapNumber.keys()) {
      if (count >= remainder) break;
      mapNumber.set(key, (mapNumber.get(key) ?? 0) + 1);
      count += 1;
    }
  }

  prerender(): void {
    if (!this.map || !this.vectorSource || !(this.objectUrls.length === this.mapObj3d.size) || this.mapObj3d.size === 0) {
      return;
    }
    const zoom = clampZoom(this.vectorSource.minZoom, this.vectorSource.maxZoom, Math.round(this.map.getZoom()));

    const visibleTiles = this.map.coveringTiles({
      tileSize: this.tileSize,
      minzoom: zoom,
      maxzoom: zoom,
      roundZoom: true,
    });

    for (const tile of visibleTiles) {
      const canonicalID = tile.canonical;
      const vectorTile = this.vectorSource.getTile(tile, {
        build_triangle: true,
      });
      const tile_key = this.tileKey(tile.canonical.x, tile.canonical.y, tile.canonical.z);
      if (vectorTile.state === "loaded") {
        const layer = vectorTile.data?.layers[this.sourceLayer];
        if (!layer) {
          continue;
        }
        let tileDataInfo = this.tileCache.get(tile_key);
        if (tileDataInfo) continue;
        if (!tileDataInfo) {
          const scene = new THREE.Scene();
          tileDataInfo = {
            sceneTile: scene,
          };
          const dirLight = (this.sun?.sunDir ?? new THREE.Vector3(0.5, 0.5, 0.5)).clone().normalize();
          createLightGroup(scene, dirLight);
          this.tileCache.set(tile_key, tileDataInfo);
        }
        const count = layer.features.length;
        if (count === 0) continue;

        const mapNumber = new Map<string, number>();
        for (const key of this.mapObj3d.keys()) {
          mapNumber.set(key, 0);
        }
        this.distribute(mapNumber, this.mapObj3d.size, count);
        const instanceGroups: InstancedGroupMesh[] = [];
        for (const [key, object_count] of mapNumber) {
          const obj3d = this.mapObj3d.get(key);
          if (!obj3d) continue;
          const instancedObject3d = new InstancedGroupMesh(obj3d as THREE.Group, object_count);
          instancedObject3d.name = `instancedMesh_${key}`;
          obj3d.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              if (this.shadowMaterial) {
                const instanceShadow = new InstancedMesh(child.geometry, this.shadowMaterial, object_count);
                instanceShadow.name = `instanceShadowMesh_${key}`;
                tileDataInfo?.sceneTile.add(instanceShadow);
              }
            }
          });
          tileDataInfo.sceneTile.add(instancedObject3d);
          instanceGroups.push(instancedObject3d);
        }

        for (const [index, feature] of layer.features.entries()) {
          const point = feature.geometry[0][0];
          const latLon = tileLocalToLatLon(canonicalID.z, canonicalID.x, canonicalID.y, point.x, point.y);
          const scaleUnit = getMetersPerExtentUnit(latLon.lat, canonicalID.z);
          const matrix = new THREE.Matrix4();
          const scale = new THREE.Vector3(scaleUnit, -scaleUnit, 1);
          const position = new THREE.Vector3(point.x, point.y, 0);
          const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0);
          matrix.compose(position, rotation, scale);
          const groupIndex = index % instanceGroups.length;
          const instanceIndex = Math.floor(index / instanceGroups.length);
          instanceGroups[groupIndex].setUserDataAt(instanceIndex, {
            scale_unit: scaleUnit,
          });
          instanceGroups[groupIndex].setMatrixAt(instanceIndex, matrix);
        }
      }
    }
  }

  render(): void {
    if (!this.map || !this.camera || !this.renderer || !this.visible || !this.vectorSource) {
      return;
    }
    const zoom = clampZoom(this.vectorSource.minZoom, this.vectorSource.maxZoom, Math.round(this.map.getZoom()));
    const visibleTiles = this.map.coveringTiles({
      tileSize: this.tileSize,
      minzoom: zoom,
      maxzoom: zoom,
      roundZoom: true,
    });
    const tr = this.map.transform;
    for (const tile of visibleTiles) {
      const tile_key = this.tileKey(tile.canonical.x, tile.canonical.y, tile.canonical.z);
      const projectionData = tr.getProjectionData({
        overscaledTileID: tile,
        applyGlobeMatrix: this.applyGlobeMatrix,
      });
      const tileInfo = this.tileCache.get(tile_key);
      if (tileInfo) {
        const tileMatrix = projectionData.mainMatrix;
        this.camera.projectionMatrix = new THREE.Matrix4().fromArray(tileMatrix);
        this.updateShadow(tileInfo.sceneTile);
        this.renderer.resetState();
        this.renderer.render(tileInfo.sceneTile, this.camera);
      }
    }
  }
}
