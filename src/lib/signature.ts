import type { MotionPoint } from '../types/klym';

export interface SeedPathPoint extends MotionPoint {
  minor?: boolean;
}

export interface SeedPath {
  points: SeedPathPoint[];
  crux: number;
  minorCrux: number;
  dynos: number[];
}

export function mulberry32(seed: number) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateSeedPath(seed: number, width = 280, height = 380): SeedPath {
  const rng = mulberry32(seed);
  const steps = 22 + Math.floor(rng() * 8);
  const yStart = height * 0.82;
  const yEnd = height * (0.12 + rng() * 0.06);
  const crux = Math.floor(steps * (0.45 + rng() * 0.25));
  const minorCrux = rng() > 0.4 ? Math.floor(steps * (0.18 + rng() * 0.18)) : -1;
  const swayAmp = width * (0.18 + rng() * 0.1);
  const swayFreq = 1.4 + rng() * 1.2;
  const swayPhase = rng() * Math.PI * 2;

  const points: SeedPathPoint[] = [];
  let x = width * 0.5 + (rng() - 0.5) * width * 0.12;
  let y = yStart;

  for (let i = 0; i < steps; i += 1) {
    const t = i / (steps - 1);
    const isCrux = i === crux;
    const isMinor = i === minorCrux;
    const nearCrux =
      Math.abs(i - crux) <= 1 || (minorCrux >= 0 && Math.abs(i - minorCrux) <= 1);

    let targetY: number;
    if (i < crux) {
      const local = i / crux;
      targetY = yStart + (yEnd - yStart) * (local * 0.55);
      if (i === crux - 1) targetY += height * 0.025;
    } else {
      const local = (i - crux) / Math.max(1, steps - 1 - crux);
      const jumpProfile = local < 0.15 ? local * 6 : 0.9 + local * 0.1;
      targetY = yStart + (yEnd - yStart) * (0.55 + 0.45 * Math.min(1, jumpProfile));
    }
    y += (targetY - y) * 0.7;

    const sway = Math.sin(t * Math.PI * swayFreq + swayPhase) * swayAmp;
    let targetX = width * 0.5 + sway + (rng() - 0.5) * width * 0.04;
    if (isCrux) targetX += (rng() > 0.5 ? 1 : -1) * width * 0.18;
    x += (targetX - x) * 0.5;

    const velocity = isCrux ? 1 : isMinor ? 0.75 : nearCrux ? 0.5 : 0.18 + rng() * 0.32;
    points.push({
      x,
      y,
      t,
      velocity,
      confidence: 1,
      dyno: isCrux,
      minor: isMinor,
    });
  }

  return { points, crux, minorCrux, dynos: [crux, ...(minorCrux >= 0 ? [minorCrux] : [])] };
}

export function smoothPath(points: Pick<MotionPoint, 'x' | 'y'>[]) {
  if (points.length < 2) return '';
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(
      2,
    )}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

export function partialSmoothPath(points: MotionPoint[], progress: number) {
  if (points.length < 2) return '';
  const clampedProgress = clamp(progress, 0, 1);
  const firstT = pointTime(points[0], 0, points.length);
  if (clampedProgress <= firstT) return '';

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const startT = pointTime(p1, i, points.length);
    const endT = pointTime(p2, i + 1, points.length);
    const controls = cubicControls(p0, p1, p2, p3);

    if (clampedProgress >= endT || i === points.length - 2) {
      if (clampedProgress >= endT) {
        d += cubicSegment(controls.cp1, controls.cp2, p2);
        continue;
      }
    }

    if (clampedProgress > startT && clampedProgress < endT) {
      const local = clamp((clampedProgress - startT) / Math.max(0.0001, endT - startT));
      const split = splitCubic(p1, controls.cp1, controls.cp2, p2, local);
      d += cubicSegment(split.cp1, split.cp2, split.end);
    }
    break;
  }
  return d;
}

export function motionPointAtProgress(points: MotionPoint[], progress: number): MotionPoint | undefined {
  if (!points.length) return undefined;
  if (points.length === 1) return points[0];

  const clampedProgress = clamp(progress, 0, 1);
  const firstT = pointTime(points[0], 0, points.length);
  if (clampedProgress <= firstT) return points[0];

  for (let i = 0; i < points.length - 1; i += 1) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const startT = pointTime(p1, i, points.length);
    const endT = pointTime(p2, i + 1, points.length);
    if (clampedProgress <= endT || i === points.length - 2) {
      const local = clamp((clampedProgress - startT) / Math.max(0.0001, endT - startT));
      const p0 = points[i - 1] || p1;
      const p3 = points[i + 2] || p2;
      const controls = cubicControls(p0, p1, p2, p3);
      const current = cubicPoint(p1, controls.cp1, controls.cp2, p2, local);
      return {
        ...p2,
        x: current.x,
        y: current.y,
        t: clampedProgress,
        velocity: p1.velocity ?? p2.velocity,
      };
    }
  }

  return points[points.length - 1];
}

export function scaledPoints(points: MotionPoint[], width = 280, height = 380): MotionPoint[] {
  return points.map((point) => ({
    ...point,
    x: point.x * width,
    y: point.y * height,
  }));
}

export function normalizePoints(points: MotionPoint[], width: number, height: number): MotionPoint[] {
  return points.map((point) => ({
    ...point,
    x: clamp(point.x / width, 0, 1),
    y: clamp(point.y / height, 0, 1),
  }));
}

export function markDynamicSegments(points: MotionPoint[]) {
  if (points.length < 2) return points;
  const velocities = points.map((point, index) => {
    if (index === 0) return 0;
    const prev = points[index - 1];
    return Math.hypot(point.x - prev.x, point.y - prev.y);
  });
  const maxVelocity = Math.max(...velocities, 0.0001);
  const sorted = [...velocities].sort((a, b) => b - a);
  const dynoThreshold = sorted[Math.min(2, sorted.length - 1)] || maxVelocity;

  return points.map((point, index) => {
    const velocity = velocities[index] / maxVelocity;
    return {
      ...point,
      velocity,
      dyno: index > 0 && velocities[index] >= dynoThreshold && velocity > 0.55,
    };
  });
}

export function signaturePathFromNormalized(points: MotionPoint[], width = 280, height = 380) {
  return smoothPath(scaledPoints(points, width, height));
}

export function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function pointTime(point: Pick<MotionPoint, 't'>, index: number, count: number) {
  return Number.isFinite(point.t) ? point.t : index / Math.max(1, count - 1);
}

function cubicControls(
  p0: Pick<MotionPoint, 'x' | 'y'>,
  p1: Pick<MotionPoint, 'x' | 'y'>,
  p2: Pick<MotionPoint, 'x' | 'y'>,
  p3: Pick<MotionPoint, 'x' | 'y'>,
) {
  return {
    cp1: {
      x: p1.x + (p2.x - p0.x) / 6,
      y: p1.y + (p2.y - p0.y) / 6,
    },
    cp2: {
      x: p2.x - (p3.x - p1.x) / 6,
      y: p2.y - (p3.y - p1.y) / 6,
    },
  };
}

function cubicSegment(
  cp1: Pick<MotionPoint, 'x' | 'y'>,
  cp2: Pick<MotionPoint, 'x' | 'y'>,
  end: Pick<MotionPoint, 'x' | 'y'>,
) {
  return ` C ${cp1.x.toFixed(2)} ${cp1.y.toFixed(2)}, ${cp2.x.toFixed(2)} ${cp2.y.toFixed(
    2,
  )}, ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function splitCubic(
  p0: Pick<MotionPoint, 'x' | 'y'>,
  p1: Pick<MotionPoint, 'x' | 'y'>,
  p2: Pick<MotionPoint, 'x' | 'y'>,
  p3: Pick<MotionPoint, 'x' | 'y'>,
  t: number,
) {
  const p01 = lerpPoint(p0, p1, t);
  const p12 = lerpPoint(p1, p2, t);
  const p23 = lerpPoint(p2, p3, t);
  const p012 = lerpPoint(p01, p12, t);
  const p123 = lerpPoint(p12, p23, t);
  const end = lerpPoint(p012, p123, t);
  return { cp1: p01, cp2: p012, end };
}

function cubicPoint(
  p0: Pick<MotionPoint, 'x' | 'y'>,
  p1: Pick<MotionPoint, 'x' | 'y'>,
  p2: Pick<MotionPoint, 'x' | 'y'>,
  p3: Pick<MotionPoint, 'x' | 'y'>,
  t: number,
) {
  const oneMinusT = 1 - t;
  const a = oneMinusT ** 3;
  const b = 3 * oneMinusT ** 2 * t;
  const c = 3 * oneMinusT * t ** 2;
  const d = t ** 3;
  return {
    x: p0.x * a + p1.x * b + p2.x * c + p3.x * d,
    y: p0.y * a + p1.y * b + p2.y * c + p3.y * d,
  };
}

function lerpPoint(
  a: Pick<MotionPoint, 'x' | 'y'>,
  b: Pick<MotionPoint, 'x' | 'y'>,
  t: number,
) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}
