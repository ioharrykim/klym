import type { MotionPoint } from '../../types/klym';
import { markDynamicSegments } from '../signature';
import { buildSvgPath, smoothNormalizedPoints } from './normalize';

export function composeMotionPath(points: MotionPoint[]) {
  const smooth = markDynamicSegments(smoothNormalizedPoints(points));
  return {
    points: smooth,
    svgPath: buildSvgPath(smooth),
  };
}

export function confidenceFromPoints(points: MotionPoint[]) {
  if (!points.length) return 0;
  const avg = points.reduce((sum, point) => sum + (point.confidence ?? 0), 0) / points.length;
  const spreadX = Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x));
  const spreadY = Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y));
  const motionSpread = Math.min(1, (spreadX + spreadY) * 1.25);
  return Number(Math.max(0, Math.min(1, avg * 0.7 + motionSpread * 0.3)).toFixed(2));
}
