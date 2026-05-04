import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import type {
  ClimbEnvironment,
  MotionCompletionStatus,
  MotionFrame,
  MotionPoint,
  MotionProblemStyle,
  MotionTrackingMode,
} from '../../types/klym';
import { normalizeDetectedPoints } from './normalize';
import { confidenceFromPoints } from './path';
import { clamp } from '../signature';

export interface DetectionResult {
  points: MotionPoint[];
  confidenceScore: number;
  failed: boolean;
  method: 'pose' | 'pixel-motion';
  environment?: ClimbEnvironment;
  trackingMode?: MotionTrackingMode;
  problemStyle?: MotionProblemStyle;
  completionStatus?: MotionCompletionStatus;
  topHoldColor?: string;
  fallAt?: number;
  finishConfidence?: number;
  notes: string[];
}

interface DetectionSample {
  x: number;
  y: number;
  confidence: number;
}

interface PoseFrameSample {
  bodyCenter: DetectionSample | null;
  leftHand: DetectionSample | null;
  rightHand: DetectionSample | null;
  leftWrist: DetectionSample | null;
  rightWrist: DetectionSample | null;
  leftFoot: DetectionSample | null;
  rightFoot: DetectionSample | null;
}

interface PoseRouteChoice {
  points: MotionPoint[];
  trackingMode: MotionTrackingMode;
  problemStyle: MotionProblemStyle;
  scores: Record<MotionTrackingMode, number>;
  selectedCoverage: number;
}

interface CompletionAnalysis {
  status: MotionCompletionStatus;
  fallAt?: number;
  topHoldColor?: string;
  confidence: number;
  notes: string[];
}

export async function detectMotionFromFrames(
  frames: MotionFrame[],
  videoDuration = inferDuration(frames),
  environment: ClimbEnvironment = 'indoor',
): Promise<DetectionResult> {
  if (frames.length < 3) {
    return {
      points: [],
      confidenceScore: 0,
      failed: true,
      method: 'pixel-motion',
      environment,
      notes: ['Not enough frames were extracted to solve a movement path.'],
    };
  }

  const poseResult = await detectPosePath(frames, videoDuration, environment);
  if (poseResult && !poseResult.failed) return poseResult;

  const pixelResult = await detectPixelMotionPath(frames, videoDuration);
  return {
    ...pixelResult,
    failed: pixelResult.failed,
    environment,
    notes: [
      ...(poseResult?.notes || ['MediaPipe pose detection could not initialize.']),
      ...pixelResult.notes,
    ],
  };
}

async function detectPosePath(
  frames: MotionFrame[],
  videoDuration: number,
  environment: ClimbEnvironment,
): Promise<DetectionResult | null> {
  try {
    const landmarker = await getPoseLandmarker();
    const bitmaps = await Promise.all(frames.map((frame) => decodeFrame(frame.dataUrl)));
    const poseSamples: PoseFrameSample[] = [];
    let hitCount = 0;
    let lastTimestampMs = -1;

    for (let index = 0; index < bitmaps.length; index += 1) {
      const frame = frames[index];
      const timestampMs = Math.max(lastTimestampMs + 1, Math.round(frame.time * 1000));
      lastTimestampMs = timestampMs;
      const result = landmarker.detectForVideo(bitmaps[index], timestampMs);
      const pose = result.landmarks[0];
      const sample = pose ? poseSample(pose) : emptyPoseSample();
      if (sample.bodyCenter) hitCount += 1;
      poseSamples.push(sample);
    }

    const routeChoice = choosePoseRoute(poseSamples, frames, videoDuration, environment);
    const completion = analyzeCompletion(poseSamples, frames, bitmaps, environment);
    closeBitmaps(bitmaps);

    const interpolatedPoints = stabilizePosePoints(interpolateLowConfidencePoints(routeChoice.points));
    const normalized = normalizeDetectedPoints(interpolatedPoints, frames[0].width, frames[0].height);
    const poseCoverage = hitCount / frames.length;
    const confidenceScore = Number(
      Math.max(
        0,
        Math.min(1, confidenceFromPoints(normalized) * 0.45 + routeChoice.selectedCoverage * 0.35 + poseCoverage * 0.2),
      ).toFixed(2),
    );
    const failed =
      hitCount < Math.max(3, Math.ceil(frames.length * 0.42)) ||
      routeChoice.selectedCoverage < 0.36 ||
      confidenceScore < 0.34;

    return {
      points: normalized,
      confidenceScore,
      failed,
      method: 'pose',
      environment,
      trackingMode: routeChoice.trackingMode,
      problemStyle: routeChoice.problemStyle,
      completionStatus: completion.status,
      topHoldColor: completion.topHoldColor,
      fallAt: completion.fallAt,
      finishConfidence: completion.confidence,
      notes: [
        `MediaPipe pose detection found a climber in ${hitCount}/${frames.length} sampled frames.`,
        `${environment === 'indoor' ? 'Indoor mode looks for matched hands on the finish hold.' : 'Outdoor mode prioritizes topout body progression.'}`,
        `Auto style estimate: ${routeChoice.problemStyle}. Selected ${trackingLabel(routeChoice.trackingMode)} route from body-center, hands, feet, and crux-wrist candidates.`,
        `Route scores — body ${routeChoice.scores['body-center'].toFixed(2)}, hands ${routeChoice.scores.hands.toFixed(2)}, feet ${routeChoice.scores.feet.toFixed(2)}, crux wrist ${routeChoice.scores['crux-wrist'].toFixed(2)}.`,
        ...completion.notes,
        'Low-confidence pose frames are interpolated from adjacent reliable route points and aligned to source-video timestamps.',
        failed
          ? 'Pose confidence was too low for a reliable signature; falling back to pixel motion or manual correction.'
          : 'Automatic detection used video-mode pose tracking across hips, shoulders, elbows, wrists, hands, knees, ankles, heels, and foot index points.',
      ],
    };
  } catch (error) {
    return {
      points: [],
      confidenceScore: 0,
      failed: true,
      method: 'pose',
      environment,
      notes: [
        `MediaPipe pose detection unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
      ],
    };
  }
}

function choosePoseRoute(
  samples: PoseFrameSample[],
  frames: MotionFrame[],
  videoDuration: number,
  environment: ClimbEnvironment,
): PoseRouteChoice {
  const bodyPoints = routeFromSample(samples, frames, videoDuration, (sample) => sample.bodyCenter, { x: 0.5, y: 0.62, confidence: 0 });
  const handPoints = activeLimbRoute(samples, frames, videoDuration, 'hands');
  const footPoints = activeLimbRoute(samples, frames, videoDuration, 'feet');
  const cruxWristPoints = cruxWristRoute(samples, frames, videoDuration);

  const candidates: Record<MotionTrackingMode, MotionPoint[]> = {
    'body-center': bodyPoints,
    hands: handPoints,
    feet: footPoints,
    'crux-wrist': cruxWristPoints,
  };
  const stats = {
    'body-center': routeStats(bodyPoints, frames),
    hands: routeStats(handPoints, frames),
    feet: routeStats(footPoints, frames),
    'crux-wrist': routeStats(cruxWristPoints, frames),
  };
  const problemStyle = estimateProblemStyle(stats);
  const scores: Record<MotionTrackingMode, number> = {
    'body-center':
      stats['body-center'].quality +
      (problemStyle === 'vertical' ? 0.12 : 0.04) +
      (environment === 'outdoor' ? 0.08 : 0),
    hands:
      stats.hands.quality +
      (problemStyle === 'overhang' ? 0.24 : problemStyle === 'coordination' ? 0.12 : problemStyle === 'vertical' ? 0.08 : 0) +
      (environment === 'indoor' ? 0.08 : 0.02),
    feet: stats.feet.quality + (problemStyle === 'slab' ? 0.28 : 0) + (environment === 'outdoor' ? 0.04 : 0),
    'crux-wrist':
      stats['crux-wrist'].quality +
      (problemStyle === 'coordination' ? 0.35 : problemStyle === 'overhang' ? 0.18 : 0.02) +
      (environment === 'indoor' ? 0.04 : 0),
  };

  let trackingMode = (Object.keys(scores) as MotionTrackingMode[]).reduce((best, mode) =>
    scores[mode] > scores[best] ? mode : best,
  );

  if (stats[trackingMode].coverage < 0.36 || stats[trackingMode].quality < 0.2) {
    trackingMode = stats['body-center'].quality >= 0.2 ? 'body-center' : trackingMode;
  }

  return {
    points: candidates[trackingMode],
    trackingMode,
    problemStyle,
    scores,
    selectedCoverage: stats[trackingMode].coverage,
  };
}

function analyzeCompletion(
  samples: PoseFrameSample[],
  frames: MotionFrame[],
  bitmaps: Array<ImageBitmap | HTMLImageElement>,
  environment: ClimbEnvironment,
): CompletionAnalysis {
  const validHands = samples
    .map((sample, index) => {
      const hands = [sample.leftHand, sample.rightHand]
        .filter((point): point is DetectionSample => Boolean(point && point.confidence >= 0.18));
      if (!hands.length) return null;
      const highest = hands.reduce((best, point) => (point.y < best.y ? point : best), hands[0]);
      return { index, point: highest };
    })
    .filter((entry): entry is { index: number; point: DetectionSample } => Boolean(entry));

  if (!validHands.length) {
    return {
      status: 'unknown',
      confidence: 0,
      notes: ['Finish check could not read reliable hand landmarks.'],
    };
  }

  const highHand = validHands.reduce((best, entry) => (entry.point.y < best.point.y ? entry : best), validHands[0]);
  const topHoldColor = sampleDominantHoldColor(bitmaps[highHand.index], highHand.point);
  const fall = detectFall(samples, frames, highHand.index);
  const matchConfidence = indoorMatchConfidence(samples, highHand.point.y);
  const topoutConfidence = outdoorTopoutConfidence(samples, highHand.index);

  if (fall) {
    return {
      status: 'fall',
      fallAt: fall.t,
      topHoldColor,
      confidence: fall.confidence,
      notes: [
        `Finish check detected a downward body drop at ${Math.round(fall.t * 100)}% of the clip.`,
        topHoldColor ? `Likely top or highpoint hold color sampled as ${topHoldColor}.` : 'Top hold color was not saturated enough to sample reliably.',
      ],
    };
  }

  if (environment === 'indoor' && matchConfidence >= 0.58) {
    return {
      status: 'send',
      topHoldColor,
      confidence: Number(matchConfidence.toFixed(2)),
      notes: [
        'Indoor finish check found both hands matched near the highpoint hold.',
        topHoldColor ? `Likely top hold color sampled as ${topHoldColor}.` : 'Top hold color was not saturated enough to sample reliably.',
      ],
    };
  }

  if (environment === 'outdoor' && topoutConfidence >= 0.56) {
    return {
      status: 'topout',
      topHoldColor,
      confidence: Number(topoutConfidence.toFixed(2)),
      notes: [
        'Outdoor finish check found body progression through the highpoint zone.',
        topHoldColor ? `Likely final hold color sampled as ${topHoldColor}.` : 'Final hold color was not saturated enough to sample reliably.',
      ],
    };
  }

  return {
    status: 'attempt',
    topHoldColor,
    confidence: Number(Math.max(matchConfidence, topoutConfidence, 0.28).toFixed(2)),
    notes: [
      environment === 'indoor'
        ? 'Finish check did not see a stable two-hand match before the clip ended.'
        : 'Finish check did not see enough body progression for a confident topout.',
      topHoldColor ? `Likely highpoint hold color sampled as ${topHoldColor}.` : 'Highpoint hold color was not saturated enough to sample reliably.',
    ],
  };
}

function detectFall(samples: PoseFrameSample[], frames: MotionFrame[], highHandIndex: number) {
  let bestBody: { index: number; y: number } | null = null;

  for (let index = 0; index < samples.length; index += 1) {
    const body = samples[index].bodyCenter;
    if (!body || body.confidence < 0.18) continue;
    if (!bestBody || body.y < bestBody.y) bestBody = { index, y: body.y };

    const afterHighpoint = index > highHandIndex + 1 || index > samples.length * 0.62;
    const drop = body.y - bestBody.y;
    const handsVisible = [samples[index].leftHand, samples[index].rightHand].some((hand) => hand && hand.confidence >= 0.18);
    if (afterHighpoint && index > bestBody.index + 1 && drop > 0.15 && (!handsVisible || drop > 0.2)) {
      return {
        t: frameProgress(frames[index], index, frames, inferDuration(frames)),
        confidence: Number(clamp(drop * 3.2, 0.52, 0.92).toFixed(2)),
      };
    }
  }

  const lastBody = [...samples].reverse().find((sample) => sample.bodyCenter && sample.bodyCenter.confidence >= 0.18)?.bodyCenter;
  if (bestBody && lastBody && highHandIndex < samples.length - 3 && lastBody.y - bestBody.y > 0.18) {
    const index = samples.findIndex((sample) => sample.bodyCenter === lastBody);
    return {
      t: frameProgress(frames[Math.max(0, index)], Math.max(0, index), frames, inferDuration(frames)),
      confidence: Number(clamp((lastBody.y - bestBody.y) * 3, 0.5, 0.88).toFixed(2)),
    };
  }

  return null;
}

function indoorMatchConfidence(samples: PoseFrameSample[], topHandY: number) {
  const startIndex = Math.max(0, Math.floor(samples.length * 0.58));
  let best = 0;

  for (let index = startIndex; index < samples.length; index += 1) {
    const left = samples[index].leftHand;
    const right = samples[index].rightHand;
    if (!left || !right || left.confidence < 0.18 || right.confidence < 0.18) continue;

    const handDistance = distance(left, right);
    const averageY = (left.y + right.y) / 2;
    const closeness = clamp(1 - handDistance / 0.26);
    const nearHighpoint = clamp(1 - Math.max(0, averageY - topHandY) / 0.18);
    const confidence = (left.confidence + right.confidence) / 2;
    best = Math.max(best, closeness * 0.44 + nearHighpoint * 0.34 + confidence * 0.22);
  }

  return best;
}

function outdoorTopoutConfidence(samples: PoseFrameSample[], highHandIndex: number) {
  const bodySamples = samples
    .map((sample, index) => (sample.bodyCenter && sample.bodyCenter.confidence >= 0.18 ? { index, point: sample.bodyCenter } : null))
    .filter((entry): entry is { index: number; point: DetectionSample } => Boolean(entry));
  if (bodySamples.length < 3) return 0;

  const first = bodySamples[0].point;
  const highBody = bodySamples.reduce((best, entry) => (entry.point.y < best.point.y ? entry : best), bodySamples[0]);
  const lastWindow = bodySamples.filter((entry) => entry.index >= Math.floor(samples.length * 0.72));
  const lastBest = (lastWindow.length ? lastWindow : bodySamples).reduce((best, entry) => (entry.point.y < best.point.y ? entry : best), bodySamples[0]);
  const bodyGain = clamp((first.y - highBody.point.y) / 0.34);
  const finishNearHighpoint = clamp(1 - Math.max(0, lastBest.point.y - highBody.point.y) / 0.16);
  const lateHighpoint = clamp((highBody.index - highHandIndex + samples.length * 0.18) / Math.max(1, samples.length * 0.28));
  return bodyGain * 0.44 + finishNearHighpoint * 0.38 + lateHighpoint * 0.18;
}

function sampleDominantHoldColor(bitmap: ImageBitmap | HTMLImageElement | undefined, point: DetectionSample) {
  if (!bitmap) return undefined;
  const width = bitmap.width;
  const height = bitmap.height;
  if (!width || !height) return undefined;

  const radius = Math.round(clamp(Math.min(width, height) * 0.048, 18, 40));
  const centerX = Math.round(point.x * width);
  const centerY = Math.round(point.y * height);
  const sx = clamp(centerX - radius, 0, width - 1);
  const sy = clamp(centerY - radius, 0, height - 1);
  const sw = Math.max(1, Math.min(radius * 2, width - sx));
  const sh = Math.max(1, Math.min(radius * 2, height - sy));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return undefined;

  canvas.width = sw;
  canvas.height = sh;
  context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
  const data = context.getImageData(0, 0, sw, sh).data;
  const bins = new Map<number, { r: number; g: number; b: number; weight: number; count: number }>();

  for (let index = 0; index < data.length; index += 16) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const hsv = rgbToHsv(r, g, b);
    if (hsv.v < 0.16 || hsv.s < 0.24) continue;
    const likelySkinOrPlywood = hsv.h >= 18 && hsv.h <= 45 && hsv.s < 0.58 && hsv.v > 0.32;
    if (likelySkinOrPlywood) continue;
    const bin = Math.round(hsv.h / 18) % 20;
    const weight = hsv.s * hsv.v;
    const current = bins.get(bin) || { r: 0, g: 0, b: 0, weight: 0, count: 0 };
    current.r += r * weight;
    current.g += g * weight;
    current.b += b * weight;
    current.weight += weight;
    current.count += 1;
    bins.set(bin, current);
  }

  const best = [...bins.values()].sort((a, b) => b.weight - a.weight)[0];
  if (!best || best.weight <= 0 || best.count < 8) return undefined;
  return rgbToHex(best.r / best.weight, best.g / best.weight, best.b / best.weight);
}

function rgbToHsv(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;

  if (delta !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else h = 60 * ((rn - gn) / delta + 4);
  }

  return {
    h: h < 0 ? h + 360 : h,
    s: max === 0 ? 0 : delta / max,
    v: max,
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((value) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0'))
    .join('')}`;
}

function routeFromSample(
  samples: PoseFrameSample[],
  frames: MotionFrame[],
  videoDuration: number,
  select: (sample: PoseFrameSample) => DetectionSample | null,
  fallback: DetectionSample,
) {
  return samples.map((sample, index) => {
    const point = select(sample) || fallback;
    return sampleToMotionPoint(point, frames[index], index, frames, videoDuration);
  });
}

function activeLimbRoute(
  samples: PoseFrameSample[],
  frames: MotionFrame[],
  videoDuration: number,
  kind: 'hands' | 'feet',
) {
  let activeSide: 'left' | 'right' | null = null;
  let previousPoint: DetectionSample | null = null;

  return samples.map((sample, index) => {
    const left = kind === 'hands' ? sample.leftHand : sample.leftFoot;
    const right = kind === 'hands' ? sample.rightHand : sample.rightFoot;
    const previousSample = samples[index - 1];
    const previousLeft = previousSample ? (kind === 'hands' ? previousSample.leftHand : previousSample.leftFoot) : null;
    const previousRight = previousSample ? (kind === 'hands' ? previousSample.rightHand : previousSample.rightFoot) : null;
    const leftScore = limbScore(left, previousLeft, kind);
    const rightScore = limbScore(right, previousRight, kind);
    const preferredSide = rightScore > leftScore ? 'right' : 'left';
    const activePoint = activeSide === 'right' ? right : left;
    const preferredPoint = preferredSide === 'right' ? right : left;

    if (!activeSide) {
      activeSide = preferredPoint ? preferredSide : left ? 'left' : right ? 'right' : null;
    } else if (preferredPoint && preferredSide !== activeSide && activePoint) {
      const activeScore = activeSide === 'right' ? rightScore : leftScore;
      const preferredScore = preferredSide === 'right' ? rightScore : leftScore;
      const jump = previousPoint ? distance(preferredPoint, previousPoint) : 0;
      if (preferredScore > activeScore + 0.18 && jump < 0.32) activeSide = preferredSide;
    } else if (!activePoint && preferredPoint) {
      activeSide = preferredSide;
    }

    const selected = (activeSide === 'right' ? right : left) || preferredPoint || sample.bodyCenter || previousPoint || {
      x: 0.5,
      y: kind === 'hands' ? 0.38 : 0.76,
      confidence: 0,
    };
    previousPoint = selected;
    return sampleToMotionPoint(selected, frames[index], index, frames, videoDuration);
  });
}

function cruxWristRoute(samples: PoseFrameSample[], frames: MotionFrame[], videoDuration: number) {
  const side = cruxWristSide(samples);
  return routeFromSample(
    samples,
    frames,
    videoDuration,
    (sample) => (side === 'right' ? sample.rightWrist : sample.leftWrist) || sample.bodyCenter,
    { x: 0.5, y: 0.42, confidence: 0 },
  );
}

function cruxWristSide(samples: PoseFrameSample[]) {
  const leftEnergy = limbMotionEnergy(samples.map((sample) => sample.leftWrist));
  const rightEnergy = limbMotionEnergy(samples.map((sample) => sample.rightWrist));
  return rightEnergy > leftEnergy ? 'right' : 'left';
}

function limbScore(point: DetectionSample | null, previous: DetectionSample | null, kind: 'hands' | 'feet') {
  if (!point) return 0;
  const motion = previous ? distance(point, previous) : 0;
  const reachBias = kind === 'hands' ? (1 - point.y) * 0.16 : point.y * 0.08;
  return point.confidence * 0.72 + Math.min(0.36, motion * 1.8) + reachBias;
}

function routeStats(points: MotionPoint[], frames: MotionFrame[]) {
  const normalized = normalizeDetectedPoints(
    stabilizePosePoints(interpolateLowConfidencePoints(points)),
    frames[0].width,
    frames[0].height,
  );
  const quality = confidenceFromPoints(normalized);
  const coverage = points.filter((point) => (point.confidence ?? 0) >= 0.18).length / Math.max(1, points.length);
  const travel = pathTravel(normalized);
  const maxVelocity = maxSegmentDistance(normalized);
  const rangeX = Math.max(...normalized.map((point) => point.x)) - Math.min(...normalized.map((point) => point.x));
  const rangeY = Math.max(...normalized.map((point) => point.y)) - Math.min(...normalized.map((point) => point.y));
  return { quality, coverage, travel, maxVelocity, rangeX, rangeY };
}

function estimateProblemStyle(
  stats: Record<MotionTrackingMode, ReturnType<typeof routeStats>>,
): MotionProblemStyle {
  const hand = stats.hands;
  const foot = stats.feet;
  const body = stats['body-center'];
  const crux = stats['crux-wrist'];

  if (crux.maxVelocity > 0.16 || hand.maxVelocity > 0.14) return 'coordination';
  if (foot.travel > hand.travel * 0.72 && foot.travel > body.travel * 0.72 && foot.quality >= 0.22) return 'slab';
  if (hand.travel > foot.travel * 1.18 && (body.rangeX > body.rangeY * 0.9 || hand.travel > 0.36)) return 'overhang';
  if (body.quality < 0.18 && hand.quality < 0.18 && foot.quality < 0.18) return 'unknown';
  return 'vertical';
}

function pathTravel(points: MotionPoint[]) {
  let travel = 0;
  for (let index = 1; index < points.length; index += 1) {
    travel += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  return travel;
}

function maxSegmentDistance(points: MotionPoint[]) {
  let max = 0;
  for (let index = 1; index < points.length; index += 1) {
    max = Math.max(max, Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y));
  }
  return max;
}

function limbMotionEnergy(points: Array<DetectionSample | null>) {
  let energy = 0;
  for (let index = 1; index < points.length; index += 1) {
    const current = points[index];
    const previous = points[index - 1];
    if (!current || !previous) continue;
    energy += distance(current, previous) * Math.max(current.confidence, previous.confidence);
  }
  return energy;
}

function sampleToMotionPoint(
  point: DetectionSample,
  frame: MotionFrame,
  index: number,
  frames: MotionFrame[],
  videoDuration: number,
): MotionPoint {
  return {
    x: point.x * frame.width,
    y: point.y * frame.height,
    t: frameProgress(frame, index, frames, videoDuration),
    confidence: point.confidence,
  };
}

function trackingLabel(mode: MotionTrackingMode) {
  switch (mode) {
    case 'hands':
      return 'active hand';
    case 'feet':
      return 'active foot';
    case 'crux-wrist':
      return 'crux wrist';
    case 'body-center':
      return 'body-center';
  }
}

function interpolateLowConfidencePoints(points: MotionPoint[]) {
  const reliable = points
    .map((point, index) => ({ point, index }))
    .filter(({ point }) => (point.confidence ?? 0) >= 0.18);

  if (reliable.length < 2) return points;

  return points.map((point, index) => {
    if ((point.confidence ?? 0) >= 0.18) return point;
    const before = [...reliable].reverse().find((entry) => entry.index < index);
    const after = reliable.find((entry) => entry.index > index);

    if (before && after) {
      const span = after.index - before.index;
      const local = span <= 0 ? 0 : (index - before.index) / span;
      return {
        ...point,
        x: before.point.x + (after.point.x - before.point.x) * local,
        y: before.point.y + (after.point.y - before.point.y) * local,
        confidence: Math.max(0.12, Math.min(before.point.confidence ?? 0, after.point.confidence ?? 0) * 0.62),
      };
    }

    const nearest = before || after;
    if (!nearest) return point;
    return {
      ...point,
      x: nearest.point.x,
      y: nearest.point.y,
      confidence: Math.max(0.1, (nearest.point.confidence ?? 0) * 0.5),
    };
  });
}

function stabilizePosePoints(points: MotionPoint[]) {
  if (points.length < 3) return points;
  return points.map((point, index) => {
    if (index === 0 || index === points.length - 1 || point.manual) return point;
    const prev = points[index - 1];
    const next = points[index + 1];
    const confidence = point.confidence ?? 0;
    const centerWeight = confidence >= 0.5 ? 0.68 : 0.54;
    const sideWeight = (1 - centerWeight) / 2;
    return {
      ...point,
      x: point.x * centerWeight + prev.x * sideWeight + next.x * sideWeight,
      y: point.y * centerWeight + prev.y * sideWeight + next.y * sideWeight,
    };
  });
}

async function detectPixelMotionPath(frames: MotionFrame[], videoDuration: number): Promise<DetectionResult> {
  const bitmaps = await Promise.all(frames.map((frame) => decodeFrame(frame.dataUrl)));
  const sampleWidth = 144;
  const sampleHeight = Math.max(96, Math.round(sampleWidth * (frames[0].height / frames[0].width)));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    closeBitmaps(bitmaps);
    return {
      points: [],
      confidenceScore: 0,
      failed: true,
      method: 'pixel-motion',
      notes: ['Canvas pixel access is unavailable; manual correction is ready.'],
    };
  }
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;

  const pixelFrames = bitmaps.map((bitmap) => {
    context.clearRect(0, 0, sampleWidth, sampleHeight);
    context.drawImage(bitmap, 0, 0, sampleWidth, sampleHeight);
    return context.getImageData(0, 0, sampleWidth, sampleHeight);
  });
  closeBitmaps(bitmaps);

  const samples: DetectionSample[] = [];
  for (let index = 1; index < pixelFrames.length; index += 1) {
    samples.push(diffCenter(pixelFrames[index - 1], pixelFrames[index], sampleWidth, sampleHeight));
  }

  const fallbackX = sampleWidth * 0.5;
  const fallbackY = sampleHeight * 0.62;
  const rawPoints: MotionPoint[] = frames.map((frame, index) => {
    const sample = index === 0 ? samples[0] : samples[index - 1] || samples[samples.length - 1];
    const confidence = sample?.confidence ?? 0;
    const x = confidence > 0.04 ? sample.x : fallbackX;
    const y = confidence > 0.04 ? sample.y : fallbackY - index * (sampleHeight * 0.035);
    return {
      x: (x / sampleWidth) * frame.width,
      y: (y / sampleHeight) * frame.height,
      t: frameProgress(frame, index, frames, videoDuration),
      confidence,
    };
  });

  const normalized = normalizeDetectedPoints(rawPoints, frames[0].width, frames[0].height);
  const confidenceScore = confidenceFromPoints(normalized);
  const failed = confidenceScore < 0.24;

  return {
    points: normalized,
    confidenceScore,
    failed,
    method: 'pixel-motion',
    notes: [
      'Fallback detection used frame-to-frame pixel motion.',
      failed
        ? 'Automatic detection failed confidence threshold. Use manual correction.'
        : 'Automatic motion path passed confidence threshold.',
    ],
  };
}

let poseLandmarkerPromise: Promise<PoseLandmarker> | null = null;

function getPoseLandmarker() {
  poseLandmarkerPromise ??= (async () => {
    const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
    return PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: '/models/pose_landmarker_full.task',
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.24,
      minPosePresenceConfidence: 0.24,
      minTrackingConfidence: 0.18,
    });
  })();
  return poseLandmarkerPromise;
}

function emptyPoseSample(): PoseFrameSample {
  return {
    bodyCenter: null,
    leftHand: null,
    rightHand: null,
    leftWrist: null,
    rightWrist: null,
    leftFoot: null,
    rightFoot: null,
  };
}

function poseSample(landmarks: NormalizedLandmark[]): PoseFrameSample {
  return {
    bodyCenter: poseCenter(landmarks),
    leftHand: weightedLandmarkPoint(landmarks, [
      { index: 15, weight: 0.9 },
      { index: 17, weight: 0.24 },
      { index: 19, weight: 0.28 },
      { index: 21, weight: 0.18 },
      { index: 13, weight: 0.16 },
    ]),
    rightHand: weightedLandmarkPoint(landmarks, [
      { index: 16, weight: 0.9 },
      { index: 18, weight: 0.24 },
      { index: 20, weight: 0.28 },
      { index: 22, weight: 0.18 },
      { index: 14, weight: 0.16 },
    ]),
    leftWrist: weightedLandmarkPoint(landmarks, [{ index: 15, weight: 1 }]),
    rightWrist: weightedLandmarkPoint(landmarks, [{ index: 16, weight: 1 }]),
    leftFoot: weightedLandmarkPoint(landmarks, [
      { index: 27, weight: 0.48 },
      { index: 29, weight: 0.3 },
      { index: 31, weight: 0.52 },
    ]),
    rightFoot: weightedLandmarkPoint(landmarks, [
      { index: 28, weight: 0.48 },
      { index: 30, weight: 0.3 },
      { index: 32, weight: 0.52 },
    ]),
  };
}

function poseCenter(landmarks: NormalizedLandmark[]) {
  const weighted = [
    { index: 23, weight: 1.2 },
    { index: 24, weight: 1.2 },
    { index: 11, weight: 0.75 },
    { index: 12, weight: 0.75 },
    { index: 13, weight: 0.36 },
    { index: 14, weight: 0.36 },
    { index: 15, weight: 0.42 },
    { index: 16, weight: 0.42 },
    { index: 25, weight: 0.34 },
    { index: 26, weight: 0.34 },
    { index: 27, weight: 0.34 },
    { index: 28, weight: 0.34 },
  ];

  let x = 0;
  let y = 0;
  let weight = 0;
  let confidence = 0;

  weighted.forEach(({ index, weight: baseWeight }) => {
    const landmark = landmarks[index];
    if (!landmark) return;
    const visibility = landmark.visibility ?? 0.6;
    if (visibility < 0.18) return;
    const w = baseWeight * visibility;
    x += landmark.x * w;
    y += landmark.y * w;
    weight += w;
    confidence += visibility * baseWeight;
  });

  if (weight <= 0) return null;

  return {
    x: Math.max(0, Math.min(1, x / weight)),
    y: Math.max(0, Math.min(1, y / weight)),
    confidence: Math.max(0, Math.min(1, confidence / weighted.reduce((sum, item) => sum + item.weight, 0))),
  };
}

function weightedLandmarkPoint(
  landmarks: NormalizedLandmark[],
  weighted: Array<{ index: number; weight: number }>,
): DetectionSample | null {
  let x = 0;
  let y = 0;
  let weight = 0;
  let confidence = 0;

  weighted.forEach(({ index, weight: baseWeight }) => {
    const landmark = landmarks[index];
    if (!landmark) return;
    const visibility = landmark.visibility ?? 0.6;
    if (visibility < 0.16) return;
    const w = baseWeight * visibility;
    x += landmark.x * w;
    y += landmark.y * w;
    weight += w;
    confidence += visibility * baseWeight;
  });

  if (weight <= 0) return null;

  return {
    x: clamp(x / weight, 0, 1),
    y: clamp(y / weight, 0, 1),
    confidence: clamp(confidence / weighted.reduce((sum, item) => sum + item.weight, 0), 0, 1),
  };
}

function distance(a: Pick<DetectionSample, 'x' | 'y'>, b: Pick<DetectionSample, 'x' | 'y'>) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function diffCenter(
  before: ImageData,
  after: ImageData,
  width: number,
  height: number,
): DetectionSample {
  let sumX = 0;
  let sumY = 0;
  let weight = 0;
  const beforeData = before.data;
  const afterData = after.data;
  const step = 4;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const index = (y * width + x) * 4;
      const b = luminance(beforeData[index], beforeData[index + 1], beforeData[index + 2]);
      const a = luminance(afterData[index], afterData[index + 1], afterData[index + 2]);
      const diff = Math.abs(a - b);
      if (diff > 24) {
        const w = diff - 20;
        sumX += x * w;
        sumY += y * w;
        weight += w;
      }
    }
  }

  const totalSamples = (width / step) * (height / step);
  const density = weight / Math.max(1, totalSamples * 255);
  return {
    x: weight > 0 ? sumX / weight : width * 0.5,
    y: weight > 0 ? sumY / weight : height * 0.58,
    confidence: Math.max(0, Math.min(1, density * 9)),
  };
}

function luminance(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function frameProgress(
  frame: MotionFrame,
  index: number,
  frames: MotionFrame[],
  videoDuration: number,
) {
  if (Number.isFinite(videoDuration) && videoDuration > 0) return clamp(frame.time / videoDuration, 0, 1);
  return frames.length === 1 ? 0 : index / (frames.length - 1);
}

function inferDuration(frames: MotionFrame[]) {
  return frames.reduce((max, frame) => Math.max(max, frame.time), 0);
}

async function decodeFrame(dataUrl: string) {
  if ('createImageBitmap' in window) {
    const response = await fetch(dataUrl);
    return createImageBitmap(await response.blob());
  }

  const image = new Image();
  image.src = dataUrl;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Frame decode failed.'));
  });
  return image;
}

function closeBitmaps(bitmaps: Array<ImageBitmap | HTMLImageElement>) {
  bitmaps.forEach((bitmap) => {
    if ('close' in bitmap) bitmap.close();
  });
}
