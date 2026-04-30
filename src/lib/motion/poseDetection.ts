import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { MotionFrame, MotionPoint } from '../../types/klym';
import { normalizeDetectedPoints } from './normalize';
import { confidenceFromPoints } from './path';

export interface DetectionResult {
  points: MotionPoint[];
  confidenceScore: number;
  failed: boolean;
  method: 'pose' | 'pixel-motion';
  notes: string[];
}

interface DetectionSample {
  x: number;
  y: number;
  confidence: number;
}

export async function detectMotionFromFrames(frames: MotionFrame[]): Promise<DetectionResult> {
  if (frames.length < 3) {
    return {
      points: [],
      confidenceScore: 0,
      failed: true,
      method: 'pixel-motion',
      notes: ['Not enough frames were extracted to solve a movement path.'],
    };
  }

  const poseResult = await detectPosePath(frames);
  if (poseResult && !poseResult.failed) return poseResult;

  const pixelResult = await detectPixelMotionPath(frames);
  return {
    ...pixelResult,
    failed: pixelResult.failed,
    notes: [
      ...(poseResult?.notes || ['MediaPipe pose detection could not initialize.']),
      ...pixelResult.notes,
    ],
  };
}

async function detectPosePath(frames: MotionFrame[]): Promise<DetectionResult | null> {
  try {
    const landmarker = await getPoseLandmarker();
    const bitmaps = await Promise.all(frames.map((frame) => decodeFrame(frame.dataUrl)));
    const rawPoints: MotionPoint[] = [];
    let hitCount = 0;

    for (let index = 0; index < bitmaps.length; index += 1) {
      const frame = frames[index];
      const result = landmarker.detect(bitmaps[index]);
      const pose = result.landmarks[0];
      const center = pose ? poseCenter(pose) : null;
      if (center) hitCount += 1;
      rawPoints.push({
        x: (center?.x ?? 0.5) * frame.width,
        y: (center?.y ?? 0.62) * frame.height,
        t: frames.length === 1 ? 0 : index / (frames.length - 1),
        confidence: center?.confidence ?? 0,
      });
    }

    closeBitmaps(bitmaps);

    const interpolatedPoints = interpolateLowConfidencePoints(rawPoints);
    const normalized = normalizeDetectedPoints(interpolatedPoints, frames[0].width, frames[0].height);
    const poseCoverage = hitCount / frames.length;
    const confidenceScore = Number(
      Math.max(0, Math.min(1, confidenceFromPoints(normalized) * 0.45 + poseCoverage * 0.55)).toFixed(2),
    );
    const failed = hitCount < Math.max(3, Math.ceil(frames.length * 0.42)) || confidenceScore < 0.34;

    return {
      points: normalized,
      confidenceScore,
      failed,
      method: 'pose',
      notes: [
        `MediaPipe pose detection found a climber in ${hitCount}/${frames.length} sampled frames.`,
        'Low-confidence pose frames are interpolated from adjacent reliable body-center points.',
        failed
          ? 'Pose confidence was too low for a reliable signature; falling back to pixel motion or manual correction.'
          : 'Automatic detection used pose landmarks: hips, shoulders, wrists, and ankles.',
      ],
    };
  } catch (error) {
    return {
      points: [],
      confidenceScore: 0,
      failed: true,
      method: 'pose',
      notes: [
        `MediaPipe pose detection unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
      ],
    };
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

async function detectPixelMotionPath(frames: MotionFrame[]): Promise<DetectionResult> {
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
      t: frames.length === 1 ? 0 : index / (frames.length - 1),
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
      runningMode: 'IMAGE',
      numPoses: 1,
      minPoseDetectionConfidence: 0.35,
      minPosePresenceConfidence: 0.35,
      minTrackingConfidence: 0.35,
    });
  })();
  return poseLandmarkerPromise;
}

function poseCenter(landmarks: NormalizedLandmark[]) {
  const weighted = [
    { index: 23, weight: 1.2 },
    { index: 24, weight: 1.2 },
    { index: 11, weight: 0.75 },
    { index: 12, weight: 0.75 },
    { index: 15, weight: 0.42 },
    { index: 16, weight: 0.42 },
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
