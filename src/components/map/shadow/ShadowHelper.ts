import * as THREE from "three";
// @ts-ignore
import * as SunCalc from "suncalc";

export function calculateSunDirectionMaplibre(altitude: number, azimuth: number): THREE.Vector3 {
  const dir = new THREE.Vector3(0, -1, 0);
  dir.x = -Math.sin(azimuth) * Math.cos(altitude);
  dir.y = Math.cos(azimuth) * Math.cos(altitude);
  dir.z = Math.sin(altitude);
  return dir.normalize();
}

export function getSunPosition(lat: number, lon: number) {
  const now = new Date();
  const sunPos = SunCalc.getPosition(now, lat, lon);
  return {
    altitude: sunPos.altitude * (180 / Math.PI),
    azimuth: sunPos.azimuth * (180 / Math.PI) + 180,
    altitudeRad: sunPos.altitude,
    azimuthRad: sunPos.azimuth,
  };
}
