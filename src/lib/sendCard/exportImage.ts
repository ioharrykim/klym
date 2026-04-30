import { toPng, toCanvas } from 'html-to-image';
import type { MotionPoint, MotionSignatureData, SendCardFormat } from '../../types/klym';
import { scaledPoints, smoothPath } from '../signature';

const SIGNATURE_VB_W = 280;
const SIGNATURE_VB_H = 380;

export function formatDimensions(format: SendCardFormat): { width: number; height: number } {
  switch (format) {
    case 'square':
      return { width: 1440, height: 1440 };
    case 'feed-tall':
      return { width: 1440, height: 1800 };
    case 'story':
      return { width: 1080, height: 1920 };
  }
}

export async function exportElementAsPng(element: HTMLElement, fileName: string) {
  const dataUrl = await toPng(element, {
    cacheBust: true,
    pixelRatio: 4,
    backgroundColor: '#0A0A0B',
  });
  const link = document.createElement('a');
  link.download = fileName;
  link.href = dataUrl;
  link.click();
  return dataUrl;
}

interface VideoExportOptions {
  element: HTMLElement;
  signature: MotionSignatureData;
  format: SendCardFormat;
  fileName: string;
  hideSignatureClass?: string;
  durationMs?: number;
  holdMs?: number;
  fps?: number;
  accent?: string;
  ink?: string;
  onProgress?: (phase: 'preparing' | 'recording' | 'encoding', progress: number) => void;
}

export async function exportElementAsVideo({
  element,
  signature,
  format,
  fileName,
  hideSignatureClass = 'send-card-line-hidden',
  durationMs = 3200,
  holdMs = 900,
  fps = 60,
  accent = '#ff5a1f',
  ink = '#f4f1ea',
  onProgress,
}: VideoExportOptions) {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Video export is not supported in this browser.');
  }

  onProgress?.('preparing', 0.05);

  const { width: targetWidth, height: targetHeight } = formatDimensions(format);
  const sourceRect = element.getBoundingClientRect();
  const renderScale = Math.max(targetWidth / sourceRect.width, targetHeight / sourceRect.height);

  element.classList.add(hideSignatureClass);
  let rawCanvas: HTMLCanvasElement;
  try {
    rawCanvas = await toCanvas(element, {
      cacheBust: true,
      pixelRatio: renderScale,
      backgroundColor: '#0A0A0B',
    });
  } finally {
    element.classList.remove(hideSignatureClass);
  }

  // Normalize to exact target dimensions (the raw canvas may be sized to natural ratio)
  const backgroundCanvas = document.createElement('canvas');
  backgroundCanvas.width = targetWidth;
  backgroundCanvas.height = targetHeight;
  const bgCtx = backgroundCanvas.getContext('2d');
  if (!bgCtx) throw new Error('Could not create background canvas context.');
  bgCtx.imageSmoothingQuality = 'high';
  bgCtx.fillStyle = '#0A0A0B';
  bgCtx.fillRect(0, 0, targetWidth, targetHeight);
  bgCtx.drawImage(rawCanvas, 0, 0, targetWidth, targetHeight);

  onProgress?.('preparing', 0.65);

  const recordCanvas = document.createElement('canvas');
  recordCanvas.width = targetWidth;
  recordCanvas.height = targetHeight;
  const ctx = recordCanvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas context.');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(backgroundCanvas, 0, 0, targetWidth, targetHeight);

  const stream = recordCanvas.captureStream(fps);
  const mimeCandidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  const mimeType = mimeCandidates.find((type) => MediaRecorder.isTypeSupported(type)) || 'video/webm';
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 16_000_000,
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) chunks.push(event.data);
  };

  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      try {
        resolve(new Blob(chunks, { type: mimeType }));
      } catch (error) {
        reject(error);
      }
    };
    recorder.onerror = (event) => reject((event as ErrorEvent).error || new Error('MediaRecorder error.'));
  });

  const points = scaledPoints(signature.points, SIGNATURE_VB_W, SIGNATURE_VB_H);
  const totalDuration = durationMs + holdMs;

  recorder.start(200);
  onProgress?.('recording', 0);

  const start = performance.now();

  await new Promise<void>((resolve) => {
    function frame() {
      const elapsed = performance.now() - start;
      const drawProgress = Math.min(1, elapsed / durationMs);
      ctx!.clearRect(0, 0, targetWidth, targetHeight);
      ctx!.drawImage(backgroundCanvas, 0, 0, targetWidth, targetHeight);
      drawSignatureProgressive(ctx!, points, drawProgress, {
        targetWidth,
        targetHeight,
        accent,
        ink,
      });
      onProgress?.('recording', Math.min(0.99, elapsed / totalDuration));
      if (elapsed < totalDuration) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });

  recorder.stop();
  onProgress?.('encoding', 0.98);

  const blob = await stopped;
  triggerDownload(blob, fileName);
  onProgress?.('encoding', 1);
  return blob;
}

interface DrawOptions {
  targetWidth: number;
  targetHeight: number;
  accent: string;
  ink: string;
}

function drawSignatureProgressive(
  ctx: CanvasRenderingContext2D,
  points: MotionPoint[],
  progress: number,
  { targetWidth, targetHeight, accent, ink }: DrawOptions,
) {
  if (!points.length) return;
  const scale = Math.min(targetWidth / SIGNATURE_VB_W, targetHeight / SIGNATURE_VB_H);
  const scaledW = SIGNATURE_VB_W * scale;
  const scaledH = SIGNATURE_VB_H * scale;
  const offsetX = (targetWidth - scaledW) / 2;
  const offsetY = (targetHeight - scaledH) / 2;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  const visiblePoints = sliceProgressivePoints(points, progress);
  if (visiblePoints.length < 2) {
    ctx.restore();
    return;
  }

  const path = smoothPath(visiblePoints);

  // Glow halo
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 18;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 22;
  strokeSvgPath(ctx, path);

  // Soft outer glow
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 9;
  strokeSvgPath(ctx, path);

  // Reset shadow for crisp inner stroke
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';

  // Underlay
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 4.2;
  strokeSvgPath(ctx, path);

  // Main crisp stroke
  ctx.globalAlpha = 1;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2.6;
  strokeSvgPath(ctx, path);

  // Accent thin line
  ctx.globalAlpha = 0.65;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 0.8;
  ctx.translate(2.4, -1.2);
  strokeSvgPath(ctx, path);
  ctx.translate(-2.4, 1.2);
  ctx.globalAlpha = 1;

  // Endpoints
  const head = visiblePoints[0];
  const tail = visiblePoints[visiblePoints.length - 1];
  drawStartMark(ctx, head, ink);
  if (progress >= 1) {
    drawEndMark(ctx, tail, accent);
    drawCrux(ctx, points.find((point) => point.dyno) || maxVelocityPoint(points), accent);
  } else {
    drawHead(ctx, tail, accent);
  }

  ctx.restore();
}

function sliceProgressivePoints(points: MotionPoint[], progress: number): MotionPoint[] {
  if (progress >= 1) return points;
  if (progress <= 0) return [];
  const result: MotionPoint[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    const t = point.t ?? i / Math.max(1, points.length - 1);
    if (t <= progress) {
      result.push(point);
      continue;
    }
    const prev = points[i - 1];
    if (!prev) break;
    const prevT = prev.t ?? (i - 1) / Math.max(1, points.length - 1);
    const denom = Math.max(0.0001, t - prevT);
    const lerp = (progress - prevT) / denom;
    result.push({
      ...prev,
      x: prev.x + (point.x - prev.x) * lerp,
      y: prev.y + (point.y - prev.y) * lerp,
      t: progress,
    });
    break;
  }
  return result;
}

function strokeSvgPath(ctx: CanvasRenderingContext2D, path: string) {
  if (!path) return;
  if (typeof Path2D !== 'undefined') {
    try {
      const p = new Path2D(path);
      ctx.stroke(p);
      return;
    } catch {
      /* fall through */
    }
  }
}

function drawStartMark(ctx: CanvasRenderingContext2D, point: MotionPoint, color: string) {
  ctx.save();
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.arc(point.x, point.y, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEndMark(ctx: CanvasRenderingContext2D, point: MotionPoint, accent: string) {
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(point.x - 4, point.y - 4, 8, 8);
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.4;
  ctx.fillRect(point.x - 1.6, point.y - 1.6, 3.2, 3.2);
  ctx.restore();
}

function drawHead(ctx: CanvasRenderingContext2D, point: MotionPoint, accent: string) {
  ctx.save();
  ctx.fillStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCrux(ctx: CanvasRenderingContext2D, point: MotionPoint | undefined, accent: string) {
  if (!point) return;
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 0.9;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function maxVelocityPoint(points: MotionPoint[]) {
  return points.reduce<MotionPoint | undefined>((best, point) => {
    if (!best || (point.velocity || 0) > (best.velocity || 0)) return point;
    return best;
  }, undefined);
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
