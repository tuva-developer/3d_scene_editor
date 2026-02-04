import * as THREE from "three";
// @ts-ignore
import * as SunCalc from "suncalc";

export function createSunLightArrow(dir: THREE.Vector3, scaleUnit: number): THREE.ArrowHelper {
  const length = 3000;
  const arrow = new THREE.ArrowHelper(
    new THREE.Vector3(dir.x, dir.y, 0).normalize(),
    new THREE.Vector3(4096, 4096, 0),
    length,
    0xff0000,
    400,
    400
  );
  arrow.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (child.material) {
        child.material.depthTest = false;
        child.material.depthWrite = false;
      }
    }
  });
  arrow.position.z = 50;
  arrow.scale.set(1, -1, 1 / scaleUnit);
  return arrow;
}

export function calculateSunDirectionMaplibre(altitude: number, azimuth: number): THREE.Vector3 {
  const dir = new THREE.Vector3(0, -1, 0);
  dir.x = -Math.sin(azimuth) * Math.cos(altitude);
  dir.y = Math.cos(azimuth) * Math.cos(altitude);
  dir.z = Math.sin(altitude);
  return dir.normalize();
}

export function getSunPosition(lat: number, lon: number) {
  return getSunPositionAt(lat, lon, new Date());
}

export function getSunPositionAt(lat: number, lon: number, date: Date) {
  const sunPos = SunCalc.getPosition(date, lat, lon);
  return {
    altitude: sunPos.altitude * (180 / Math.PI),
    azimuth: sunPos.azimuth * (180 / Math.PI) + 180,
    altitudeRad: sunPos.altitude,
    azimuthRad: sunPos.azimuth,
  };
}

export function buildShadowMatrix(sunDir: THREE.Vector3, planeZ: number, out: THREE.Matrix4) {
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -planeZ);
  const lightDir = sunDir.clone().normalize();
  const lightPos4D = new THREE.Vector4(-lightDir.x, -lightDir.y, -lightDir.z, 0);
  const dot =
    plane.normal.dot(new THREE.Vector3(lightPos4D.x, lightPos4D.y, lightPos4D.z)) - plane.constant * lightPos4D.w;
  const m = out.elements;

  m[0] = dot - lightPos4D.x * plane.normal.x;
  m[4] = -lightPos4D.x * plane.normal.y;
  m[8] = -lightPos4D.x * plane.normal.z;
  m[12] = -lightPos4D.x * -plane.constant;

  m[1] = -lightPos4D.y * plane.normal.x;
  m[5] = dot - lightPos4D.y * plane.normal.y;
  m[9] = -lightPos4D.y * plane.normal.z;
  m[13] = -lightPos4D.y * -plane.constant;

  m[2] = -lightPos4D.z * plane.normal.x;
  m[6] = -lightPos4D.z * plane.normal.y;
  m[10] = dot - lightPos4D.z * plane.normal.z;
  m[14] = -lightPos4D.z * -plane.constant;

  m[3] = -lightPos4D.w * plane.normal.x;
  m[7] = -lightPos4D.w * plane.normal.y;
  m[11] = -lightPos4D.w * plane.normal.z;
  m[15] = dot - lightPos4D.w * -plane.constant;
}
