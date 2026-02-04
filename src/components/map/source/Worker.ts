import Protobuf from "pbf";
import { VectorTile } from "@mapbox/vector-tile";
import { vectorTileToJSON } from "./GeojsonConverter";
import type { GetTileOptions } from "./CustomVectorSource";

export {};

export type WorkerInput = {
  buffer: ArrayBuffer;
  tile_key: string;
  opts: GetTileOptions;
};

export type WorkerOutput = {
  tile_key: string;
  result: ReturnType<typeof vectorTileToJSON>;
  indices: number[][];
};

self.onmessage = (event: MessageEvent<WorkerInput>) => {
  const buffer = event.data.buffer;
  const tile_key = event.data.tile_key;
  const pbf = new Protobuf(buffer);
  const vectorTile = new VectorTile(pbf);
  const indices: number[][] = [];
  const output: WorkerOutput = {
    tile_key,
    result: vectorTileToJSON(vectorTile),
    indices,
  };
  self.postMessage(output);
};
