import type * as THREE from "three";

export type LatLon = {
  lat: number;
  lon: number;
};

export type LocalCoordinate = {
  tileX: number;
  tileY: number;
  tileZ: number;
  coordX: number;
  coordY: number;
};

export type ObjectInfo = {
  id?: string;
  localCoordX?: number;
  localCoordY?: number;
  bearing?: number;
  modelName?: string;
  modelUrl?: string;
  modelType?: string;
  textureName?: string;
  textureUrl?: string;
  scale?: number;
};

export type DataTileInfo = {
  objects?: ObjectInfo[];
};

export type Model = {
  name?: string;
  url?: string;
};

export type ModelData = {
  object3d: THREE.Object3D;
  animations?: THREE.AnimationClip[];
};
