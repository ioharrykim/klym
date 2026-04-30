import type { MotionPoint } from '../../types/klym';
import { clamp, markDynamicSegments, smoothPath } from '../signature';

export function normalizeDetectedPoints(
  points: MotionPoint[],
  frameWidth: number,
  frameHeight: number,
): MotionPoint[] {
  const normalized = points.map((point) => ({
    ...point,
    x: clamp(point.x / frameWidth, 0, 1),
    y: clamp(point.y / frameHeight, 0, 1),
  }));

  return markDynamicSegments(smoothNormalizedPoints(normalized));
}

export function smoothNormalizedPoints(points: MotionPoint[]) {
  if (points.length < 3) return points;
  return points.map((point, index) => {
    if (index === 0 || index === points.length - 1 || point.manual) return point;
    const prev = points[index - 1];
    const next = points[index + 1];
    return {
      ...point,
      x: clamp(point.x * 0.5 + prev.x * 0.25 + next.x * 0.25),
      y: clamp(point.y * 0.5 + prev.y * 0.25 + next.y * 0.25),
    };
  });
}

export function buildSvgPath(points: MotionPoint[], width = 280, height = 380) {
  return smoothPath(points.map((point) => ({ x: point.x * width, y: point.y * height })));
}
