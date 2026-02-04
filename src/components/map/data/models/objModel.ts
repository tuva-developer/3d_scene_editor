import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { tileLocalToLatLon } from "@/components/map/data/convert/coords";
import type { ModelData } from "@/components/map/data/types";

export function createYupToZUpMatrix(): THREE.Matrix4 {
  const matrix = new THREE.Matrix4();
  matrix.set(1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1);
  return matrix;
}

export function convertRawMeshYupToZup(mesh: THREE.Mesh): void {
  const matrix = createYupToZUpMatrix();
  mesh.geometry.applyMatrix4(matrix);
  mesh.geometry.computeVertexNormals();
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();
}

export function bakeWorldAndConvertYupToZup(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) {
      return;
    }
    convertRawMeshYupToZup(obj);
    reverseFaceWinding(obj.geometry);
  });
  root.traverse((obj) => {
    obj.position.set(0, 0, 0);
    obj.rotation.set(0, 0, 0);
    obj.scale.set(1, 1, 1);
    obj.updateMatrix();
    obj.updateMatrixWorld();
  });
  root.updateMatrixWorld(true);
}

export function downloadTexture(url: string): Promise<THREE.Texture> {
  const loader = new THREE.TextureLoader();
  return loader.loadAsync(url);
}

export function downloadModel(url: string): Promise<THREE.Group> {
  const loader = new OBJLoader();
  return loader.loadAsync(url);
}

export function reverseFaceWinding(geometry: THREE.BufferGeometry): void {
  const index = geometry.index;
  if (index) {
    const indices = index.array;
    for (let i = 0; i < indices.length; i += 3) {
      const tmp = indices[i];
      indices[i] = indices[i + 2];
      indices[i + 2] = tmp;
    }
    index.needsUpdate = true;
    return;
  }

  const position = geometry.getAttribute("position");
  if (position) {
    const posArray = position.array;
    const itemSize = position.itemSize;
    for (let i = 0; i < posArray.length; i += itemSize * 3) {
      for (let j = 0; j < itemSize; j++) {
        const tmp = posArray[i + j];
        posArray[i + j] = posArray[i + itemSize * 2 + j];
        posArray[i + itemSize * 2 + j] = tmp;
      }
    }
    position.needsUpdate = true;
  }

  const normal = geometry.getAttribute("normal");
  if (normal) {
    const normArray = normal.array;
    const itemSize = normal.itemSize;
    for (let i = 0; i < normArray.length; i += itemSize * 3) {
      for (let j = 0; j < itemSize; j++) {
        const tmp = normArray[i + j];
        normArray[i + j] = normArray[i + itemSize * 2 + j];
        normArray[i + itemSize * 2 + j] = tmp;
      }
    }
    normal.needsUpdate = true;
  }

  const uv = geometry.getAttribute("uv");
  if (uv) {
    const uvArray = uv.array;
    const itemSize = uv.itemSize;
    for (let i = 0; i < uvArray.length; i += itemSize * 3) {
      for (let j = 0; j < itemSize; j++) {
        const tmp = uvArray[i + j];
        uvArray[i + j] = uvArray[i + itemSize * 2 + j];
        uvArray[i + itemSize * 2 + j] = tmp;
      }
    }
    uv.needsUpdate = true;
  }
}

export function prepareModelForRender(model: THREE.Object3D, setDefaultMat: boolean = true): void {
  model.matrixAutoUpdate = false;
  const defaultMat = new THREE.MeshLambertMaterial({ color: 0xc0c0c0, side: THREE.DoubleSide });
  defaultMat.polygonOffset = true;
  defaultMat.polygonOffsetFactor = -1;
  defaultMat.polygonOffsetUnits = -1;
  model.rotation.x = -Math.PI / 2;
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      reverseFaceWinding(child.geometry);
      if (setDefaultMat) {
        child.material = defaultMat;
      } else {
        const mat = child.material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => (m.side = THREE.DoubleSide));
        } else {
          mat.side = THREE.DoubleSide;
        }
      }
    }
  });
  model.updateMatrix();
  model.updateMatrixWorld(true);
}

export async function loadModelFromGlb(url: string): Promise<ModelData> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  const obj = gltf.scene as THREE.Object3D;
  return {
    object3d: obj,
    animations: gltf.animations,
  };
}

export async function loadModelFromGlbNotAnimation(url: string): Promise<THREE.Object3D> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  return gltf.scene as THREE.Object3D;
}

export function obj3dReceiveShadow(model: THREE.Object3D): void {
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = false;
    }
  });
}

export function obj3dReviceShadow(model: THREE.Object3D): void {
  obj3dReceiveShadow(model);
}

export function decomposeObject(model: THREE.Object3D): {
  latlon: { lat: number; lon: number };
  tileCoord: THREE.Vector3;
  elevation: number;
  scale: { scaleX: number; scaleY: number; scaleZ: number };
  bearing: number;
  height: number;
} {
  const userData = model.userData as {
    scaleUnit?: number;
    tile?: { z: number; x: number; y: number };
  };
  const scaleUnit = userData?.scaleUnit ?? 1;
  const tile = userData?.tile ?? { z: 0, x: 0, y: 0 };
  const localPos = model.position;
  const latlon = tileLocalToLatLon(tile.z, tile.x, tile.y, localPos.x, localPos.y);
  const scaleX = model.scale.x / scaleUnit;
  const scaleY = -model.scale.y / scaleUnit;
  const scaleZ = model.scale.z;
  const bearing = THREE.MathUtils.radToDeg(model.rotation.z * -1);
  const box = new THREE.Box3().setFromObject(model);
  const height = box.max.z - box.min.z;
  return {
    latlon,
    tileCoord: localPos,
    elevation: model.position.z,
    scale: { scaleX, scaleY, scaleZ },
    bearing,
    height,
  };
}

export function createLightGroup(scene: THREE.Scene, dir?: THREE.Vector3): void {
  const lightGroup = new THREE.Group();
  lightGroup.name = "light_group";
  const dirLight = new THREE.DirectionalLight(0xffffff, 5);
  dirLight.color.setHSL(0.12, 0.7, 0.98);
  const dirVector = dir ?? new THREE.Vector3(0.5, 0.5, 0.5);
  dirLight.target.position.copy(dirVector.clone().multiplyScalar(5000));
  lightGroup.add(dirLight);
  lightGroup.add(dirLight.target);
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 2.5);
  hemiLight.color.setHSL(0.55, 0.4, 0.95);
  hemiLight.groundColor.setHSL(0.08, 0.25, 0.6);
  hemiLight.position.set(0, 0, -1);
  lightGroup.add(hemiLight);
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  ambientLight.color.setHSL(0.15, 0.2, 1);
  lightGroup.add(ambientLight);
  scene.add(lightGroup);
}

export function objectEnableClippingPlaneZ(object: THREE.Object3D, enable: boolean): void {
  const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }
    const mat = child.material;
    if (Array.isArray(mat)) {
      mat.forEach((material) => {
        if (enable) {
          material.clippingPlanes = [planeZ];
          material.clipIntersection = false;
          material.clipShadows = false;
        } else {
          material.clippingPlanes = [];
          material.clipIntersection = false;
          material.clipShadows = false;
        }
        material.needsUpdate = true;
      });
    } else {
      if (enable) {
        mat.clippingPlanes = [planeZ];
        mat.clipIntersection = false;
        mat.clipShadows = false;
      } else {
        mat.clippingPlanes = [];
        mat.clipIntersection = false;
        mat.clipShadows = false;
      }
      mat.needsUpdate = true;
    }
  });
}

export function transformModel(
  posX: number,
  posY: number,
  posZ: number,
  bearing: number,
  objectScale: number,
  scaleUnit: number,
  object3d: THREE.Object3D
): void {
  object3d.scale.set(scaleUnit * objectScale, -objectScale, scaleUnit * objectScale);
  object3d.position.set(posX, posY, posZ);
  object3d.rotation.y = THREE.MathUtils.degToRad(bearing);
  object3d.matrixAutoUpdate = false;
  object3d.updateMatrix();
  object3d.updateMatrixWorld(true);
}

export function isGlbModel(modelUrl: string): boolean {
  try {
    const url = new URL(modelUrl, window.location.origin);
    return url.pathname.toLowerCase().endsWith(".glb");
  } catch {
    return modelUrl.toLowerCase().split("?")[0].endsWith(".glb");
  }
}
