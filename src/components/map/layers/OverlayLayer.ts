import type { Map, OverscaledTileID, CustomLayerInterface } from "maplibre-gl";
import { MaplibreTransformControls } from "@/components/map/controls/MaplibreTransformControls";
import type { HoverParameter } from "@/components/map/controls/MaplibreTransformControls";
import { decomposeObject, objectEnableClippingPlaneZ } from "@/components/map/data/models/objModel";
import type { TransformControlsMode } from "three/examples/jsm/controls/TransformControls.js";
import * as THREE from "three";
import { MaplibreShadowMesh } from "@/components/map/shadow/ShadowGeometry";

export type OverlayLayerOptions = {
  id: string;
  onTransformChange?: (dirty: boolean) => void;
  onElevationChange?: (elevation: number | null) => void;
};

export type TransformSnapshot = {
  position: THREE.Vector3;
  scale: THREE.Vector3;
  quaternion: THREE.Quaternion;
};

export class OverlayLayer implements CustomLayerInterface {
  id: string;
  readonly type = "custom" as const;
  readonly renderingMode = "3d" as const;
  private map: Map | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private scene: THREE.Scene | null = null;
  private transformControl: MaplibreTransformControls | null = null;
  private visible = true;
  private objectTransformSnapshot: TransformSnapshot | null = null;
  private applyGlobeMatrix = false;
  private currentTile: OverscaledTileID | null = null;
  private currentObject: THREE.Object3D | null = null;
  private hoverDiv: HTMLDivElement | null = null;
  private onTransformChange?: (dirty: boolean) => void;
  private onElevationChange?: (elevation: number | null) => void;
  private isDirty = false;
  private footprintMeshes: MaplibreShadowMesh[] = [];
  private showFootprintEnabled = false;
  private currentMode: TransformControlsMode = "translate";
  private currentLocalClippingPlane = false;

  constructor(opts: OverlayLayerOptions) {
    this.id = opts.id;
    this.onTransformChange = opts.onTransformChange;
    this.onElevationChange = opts.onElevationChange;
    this.createToolTip();
  }

  setCurrentTileID(overTile: OverscaledTileID): void {
    this.currentTile = overTile;
  }

  getCurrentObject(): THREE.Object3D | null {
    return this.currentObject;
  }

  unselect(): void {
    if (!this.scene) {
      return;
    }
    if (this.transformControl) {
      this.transformControl.removeEventListener("objectChange", this.handleObjectChange);
      this.transformControl.detach();
      this.transformControl.dispose();
      this.transformControl = null;
    }
    this.currentTile = null;
    this.currentObject = null;
    this.objectTransformSnapshot = null;
    this.setDirty(false);
    this.onElevationChange?.(null);
    this.clearFootprintMeshes();
    this.scene.clear();
  }

  reset(): void {
    if (!this.objectTransformSnapshot || !this.currentObject) {
      return;
    }
    const obj = this.currentObject;
    obj.position.copy(this.objectTransformSnapshot.position);
    obj.scale.copy(this.objectTransformSnapshot.scale);
    obj.quaternion.copy(this.objectTransformSnapshot.quaternion);
    obj.updateMatrix();
    obj.updateMatrixWorld(true);
    this.map?.triggerRepaint();
    this.setDirty(false);
    this.onElevationChange?.(obj.position.z);
  }

  snapCurrentObjectToGround(): void {
    if (!this.currentObject) {
      return;
    }
    this.currentObject.position.z = 0;
    this.currentObject.updateMatrix();
    this.currentObject.updateMatrixWorld(true);
    this.map?.triggerRepaint();
    this.updateDirtyState();
    this.onElevationChange?.(0);
  }

  showFootprint(enable: boolean): void {
    this.showFootprintEnabled = enable;
    for (const mesh of this.footprintMeshes) {
      mesh.visible = enable;
    }
    this.map?.triggerRepaint();
  }

  showFootPrint(enable: boolean): void {
    this.showFootprint(enable);
  }

  showToolTip(parameter: HoverParameter): void {
    if (!this.map || !this.hoverDiv) {
      return;
    }
    const object = parameter.object3D;
    const decompose = decomposeObject(parameter.object3D);
    const canvas = this.map.getCanvas();
    const rect = canvas.getBoundingClientRect();
    const screenX = (parameter.ndc_x * 0.5 + 0.5) * rect.width + rect.left;
    const screenY = (-parameter.ndc_y * 0.5 + 0.5) * rect.height + rect.top;
    const scale = decompose.scale;
    const bearing = decompose.bearing;
    const tileCoord = decompose.tileCoord;
    const height = decompose.height;
    this.hoverDiv.innerText =
      `Name: ${object.name}\n` +
      `Id: ${object.id}\n` +
      `Lat: ${decompose.latlon.lat}\n` +
      `Lon: ${decompose.latlon.lon}\n` +
      `Tile Coord: ${tileCoord.x}, ${tileCoord.y}\n` +
      `Elevation: ${decompose.elevation}\n` +
      `Scale: ${scale.scaleX}, ${scale.scaleY}, ${scale.scaleZ}\n` +
      `Bearing: ${bearing}\n` +
      `Height: ${height}(m)`;
    this.hoverDiv.style.left = `${screenX}px`;
    this.hoverDiv.style.top = `${screenY}px`;
    this.hoverDiv.style.display = "block";
  }

  hideToolTip(): void {
    if (!this.hoverDiv) {
      return;
    }
    this.hoverDiv.style.display = "none";
  }

  applyScaleTransformGizmo(scaleUnit: number): void {
    if (!this.transformControl) {
      return;
    }
    const controlObj = this.transformControl as unknown as THREE.Object3D;
    controlObj.scale.set(1, 1, 1);
    controlObj.updateMatrix();
    controlObj.updateMatrixWorld(true);
    controlObj.scale.set(1, 1, 1 / scaleUnit);
  }

  enableLocalClippingPlane(enable: boolean): void {
    this.currentLocalClippingPlane = enable;
    if (!this.currentObject) {
      return;
    }
    objectEnableClippingPlaneZ(this.currentObject, this.currentLocalClippingPlane);
  }

  attachGizmoToObject(object: THREE.Object3D, mode?: TransformControlsMode): void {
    if (!this.currentTile || !this.renderer || !this.camera || !this.scene || !this.map) {
      return;
    }
    if (mode) {
      this.currentMode = mode;
    }
    if (this.transformControl) {
      this.transformControl.removeEventListener("objectChange", this.handleObjectChange);
      this.transformControl.dispose();
      this.transformControl = null;
    }
    this.scene.clear();
    this.clearFootprintMeshes();
    this.currentObject = object;
    if (!this.currentObject) {
      return;
    }
    this.enableLocalClippingPlane(this.currentLocalClippingPlane);
    this.onElevationChange?.(this.currentObject.position.z);
    this.transformControl = new MaplibreTransformControls(this.camera, this.renderer.domElement, this.map, this.applyGlobeMatrix);
    this.transformControl.setSize(1);
    this.transformControl.attach(object);
    this.objectTransformSnapshot = {
      position: object.position.clone(),
      scale: object.scale.clone(),
      quaternion: object.quaternion.clone(),
    };
    this.setMode(this.currentMode);
    (this.transformControl as unknown as THREE.Object3D).name = "TransformControls";
    this.transformControl.setCurrentTile(this.currentTile);
    this.transformControl.addEventListener("objectChange", this.handleObjectChange);
    this.scene.add(this.transformControl as unknown as THREE.Object3D);
    this.buildFootprintMeshes();
    this.showFootprint(this.showFootprintEnabled);
    this.setDirty(false);

    this.transformControl.onHover = (parameter: HoverParameter): void => {
      this.showToolTip(parameter);
    };
    this.transformControl.onNotHover = (): void => {
      this.hideToolTip();
    };
  }

  setMode(mode: TransformControlsMode): void {
    this.currentMode = mode;
    if (!this.transformControl || !this.currentObject) {
      return;
    }
    const scaleUnit = (this.currentObject.userData as { scaleUnit?: number } | undefined)?.scaleUnit ?? 1;
    this.transformControl.setMode(mode);
    this.applyScaleTransformGizmo(scaleUnit);
    this.map?.triggerRepaint();
  }

  createToolTip(): void {
    this.hoverDiv = document.createElement("div");
    this.hoverDiv.style.position = "absolute";
    this.hoverDiv.style.pointerEvents = "none";
    this.hoverDiv.style.padding = "4px 6px";
    this.hoverDiv.style.background = "rgba(0,0,0,0.7)";
    this.hoverDiv.style.color = "white";
    this.hoverDiv.style.fontSize = "12px";
    this.hoverDiv.style.borderRadius = "4px";
    this.hoverDiv.style.whiteSpace = "pre-line";
    this.hoverDiv.style.display = "none";
    document.body.appendChild(this.hoverDiv);
  }

  onAdd(map: Map, gl: WebGLRenderingContext): void {
    this.map = map;
    this.camera = new THREE.PerspectiveCamera();
    this.camera.matrixAutoUpdate = false;
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.autoClear = false;
  }

  onRemove(): void {
    if (this.transformControl) {
      this.transformControl.removeEventListener("objectChange", this.handleObjectChange);
    }
    this.clearFootprintMeshes();
    this.renderer?.dispose();
    this.scene = null;
    this.renderer = null;
    this.camera = null;
    this.map = null;
  }

  render(): void {
    if (!this.map || !this.camera || !this.renderer || !this.visible || !this.transformControl) {
      return;
    }
    if (this.currentTile) {
      const tr = this.map.transform;
      if (!tr?.getProjectionData) {
        return;
      }
      const projectionData = tr.getProjectionData({
        overscaledTileID: this.currentTile,
        applyGlobeMatrix: this.applyGlobeMatrix,
      });
      const tileMatrix = projectionData.mainMatrix;
      this.camera.projectionMatrix = new THREE.Matrix4().fromArray(tileMatrix);
      this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
      this.renderer.resetState();
      if (!this.scene) {
        return;
      }
      this.updateFootprintMatrix();
      this.renderer.render(this.scene, this.camera);
    }
  }

  private updateFootprintMatrix(): void {
    if (!this.scene) {
      return;
    }
    const dir = new THREE.Vector3(0, 0, 1);
    this.scene.traverse((child) => {
      if (child instanceof MaplibreShadowMesh) {
        const scaleUnit = child.userData?.scale_unit ?? 1;
        child.update(new THREE.Vector3(dir.x, dir.y, -dir.z / scaleUnit));
      }
    });
  }

  private handleObjectChange = (): void => {
    this.updateDirtyState();
    this.onElevationChange?.(this.currentObject?.position.z ?? null);
  };

  private updateDirtyState(): void {
    if (!this.objectTransformSnapshot || !this.currentObject) {
      this.setDirty(false);
      return;
    }
    const snap = this.objectTransformSnapshot;
    const obj = this.currentObject;
    const epsilon = 1e-4;
    const posDiff = snap.position.distanceTo(obj.position);
    const scaleDiff = snap.scale.distanceTo(obj.scale);
    const quatDiff = 1 - Math.abs(snap.quaternion.dot(obj.quaternion));
    const dirty = posDiff > epsilon || scaleDiff > epsilon || quatDiff > epsilon;
    this.setDirty(dirty);
  }

  private setDirty(nextDirty: boolean): void {
    if (this.isDirty === nextDirty) {
      return;
    }
    this.isDirty = nextDirty;
    this.onTransformChange?.(nextDirty);
  }

  private buildFootprintMeshes(): void {
    if (!this.scene || !this.currentObject || !this.renderer) {
      return;
    }
    this.clearFootprintMeshes();
    this.renderer.clearStencil();
    const scaleUnit = (this.currentObject.userData as { scaleUnit?: number } | undefined)?.scaleUnit ?? 1;
    this.currentObject.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const footprint = new MaplibreShadowMesh(child, 0x00e5ff, 1.0);
        footprint.userData = { scale_unit: scaleUnit };
        footprint.matrixAutoUpdate = false;
        footprint.visible = this.showFootprintEnabled;
        this.scene?.add(footprint);
        this.footprintMeshes.push(footprint);
      }
    });
  }

  private clearFootprintMeshes(): void {
    if (!this.scene) {
      this.footprintMeshes = [];
      return;
    }
    for (const mesh of this.footprintMeshes) {
      this.scene.remove(mesh);
    }
    this.footprintMeshes = [];
  }
}
