import { VectorTile } from "@mapbox/vector-tile";
import type { ObjectInfo } from "@/components/map/data/types";

export function parseTileInfo(tile: VectorTile, sourceLayer: string): ObjectInfo[] {
  const layer = tile.layers[sourceLayer];
  const extent = layer.extent;
  const objects: ObjectInfo[] = [];
  for (let i = 0; i < layer.length; i += 1) {
    const feature = layer.feature(i);
    if (feature.type !== 1) {
      continue;
    }
    const properties = feature.properties;
    const geometries = feature.loadGeometry();
    const pt = geometries[0][0];
    const object: ObjectInfo = {
      localCoordX: pt.x * (8192 / extent),
      localCoordY: pt.y * (8192 / extent),
      id: properties.id as string,
      bearing: properties.bearing as number,
      modelName: properties.modelname as string,
      modelUrl: properties.modelurl as string,
      modelType: properties.modeltype as string,
      textureName: properties.texturename as string,
      textureUrl: properties.textureurl as string,
      scale: properties.scale as number,
    };
    if (object.modelName && object.modelUrl && object.modelType && object.textureName && object.textureUrl) {
      objects.push(object);
    }
  }
  return objects;
}
