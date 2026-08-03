import * as THREE from "three";

export const GLOBE_RADIUS = 2;

export function createElevatedArcPoints(
  start: THREE.Vector3,
  end: THREE.Vector3,
  pointCount: number,
) {
  const startDirection = start.clone().normalize();
  const endDirection = end.clone().normalize();
  const dot = THREE.MathUtils.clamp(startDirection.dot(endDirection), -0.99999, 0.99999);
  const angle = Math.acos(dot);
  const sinAngle = Math.sin(angle);
  const minimumRadius = GLOBE_RADIUS + 0.042;
  const lift = Math.min(0.36, 0.14 + angle * 0.09);
  const points: THREE.Vector3[] = [];

  for (let index = 0; index <= pointCount; index += 1) {
    const progress = index / pointCount;
    const direction = sinAngle < 0.0001
      ? startDirection.clone().lerp(endDirection, progress).normalize()
      : startDirection.clone()
        .multiplyScalar(Math.sin((1 - progress) * angle) / sinAngle)
        .addScaledVector(endDirection, Math.sin(progress * angle) / sinAngle)
        .normalize();
    const radius = minimumRadius + Math.sin(Math.PI * progress) * lift;
    points.push(direction.multiplyScalar(radius));
  }
  return points;
}
