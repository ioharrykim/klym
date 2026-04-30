import { toPng, toCanvas } from 'html-to-image';
import type { MotionPoint, MotionSignatureData, SendCardFormat, SendCardTextTone } from '../../types/klym';
import { clamp, scaledPoints, smoothPath } from '../signature';

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

export async function exportElementAsPng(
  element: HTMLElement,
  fileName: string,
  format?: SendCardFormat,
) {
  if (format) {
    const { width, height } = formatDimensions(format);
    const sourceRect = element.getBoundingClientRect();
    const renderScale = Math.max(width / sourceRect.width, height / sourceRect.height);
    const rawCanvas = await toCanvas(element, {
      cacheBust: true,
      pixelRatio: renderScale,
      backgroundColor: '#0A0A0B',
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create canvas context.');
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#0A0A0B';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(rawCanvas, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('PNG encoding failed.'))),
        'image/png',
      ),
    );
    triggerDownload(blob, fileName);
    return URL.createObjectURL(blob);
  }
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
  backgroundVideoUrl?: string;
  textTone?: SendCardTextTone;
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
  backgroundVideoUrl,
  textTone = 'light',
  accent = '#ff5a1f',
  ink = textTone === 'dark' ? '#0a0a0b' : '#f4f1ea',
  onProgress,
}: VideoExportOptions) {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Video export is not supported in this browser.');
  }

  onProgress?.('preparing', 0.05);

  const { width: targetWidth, height: targetHeight } = formatDimensions(format);
  const sourceRect = element.getBoundingClientRect();
  const renderScale = Math.max(targetWidth / sourceRect.width, targetHeight / sourceRect.height);
  const backgroundVideo = backgroundVideoUrl ? await prepareBackgroundVideo(backgroundVideoUrl) : undefined;

  element.classList.add(hideSignatureClass);
  if (backgroundVideo) element.classList.add('send-card-media-hidden', 'send-card-export-overlay');
  let rawCanvas: HTMLCanvasElement;
  try {
    rawCanvas = await toCanvas(element, {
      cacheBust: true,
      pixelRatio: renderScale,
      backgroundColor: backgroundVideo ? 'transparent' : '#0A0A0B',
    });
  } catch (error) {
    if (!backgroundVideo) throw error;
    console.warn('KLYM could not capture the card chrome for video export.', error);
    rawCanvas = document.createElement('canvas');
    rawCanvas.width = Math.max(1, Math.round(sourceRect.width * renderScale));
    rawCanvas.height = Math.max(1, Math.round(sourceRect.height * renderScale));
  } finally {
    element.classList.remove(hideSignatureClass);
    element.classList.remove('send-card-media-hidden', 'send-card-export-overlay');
  }

  // Normalize to exact target dimensions (the raw canvas may be sized to natural ratio).
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
  if (backgroundVideo) {
    drawVideoBackground(ctx, backgroundVideo, targetWidth, targetHeight);
    ctx.drawImage(backgroundCanvas, 0, 0, targetWidth, targetHeight);
  } else {
    ctx.drawImage(backgroundCanvas, 0, 0, targetWidth, targetHeight);
  }

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
  const videoDurationMs =
    backgroundVideo && Number.isFinite(backgroundVideo.duration) && backgroundVideo.duration > 0
      ? Math.min(Math.max(backgroundVideo.duration * 1000, 1400), 30000)
      : 0;
  const lineDurationMs = backgroundVideo ? videoDurationMs : durationMs;
  const totalDuration = backgroundVideo ? videoDurationMs : durationMs + holdMs;

  if (backgroundVideo) {
    backgroundVideo.currentTime = 0;
    const exportRate = backgroundVideo.duration * 1000 > totalDuration ? backgroundVideo.duration / (totalDuration / 1000) : 1;
    try {
      backgroundVideo.playbackRate = Number.isFinite(exportRate) && exportRate > 0 && exportRate <= 16 ? exportRate : 1;
    } catch {
      backgroundVideo.playbackRate = 1;
    }
    await backgroundVideo.play().catch(() => undefined);
  }
  recorder.start(200);
  onProgress?.('recording', 0);

  const start = performance.now();

  await new Promise<void>((resolve) => {
    function frame() {
      const elapsed = performance.now() - start;
      const drawProgress = backgroundVideo
        ? videoProgress(backgroundVideo, elapsed, totalDuration)
        : Math.min(1, elapsed / lineDurationMs);
      ctx!.clearRect(0, 0, targetWidth, targetHeight);
      if (backgroundVideo) {
        drawVideoBackground(ctx!, backgroundVideo, targetWidth, targetHeight);
      } else {
        ctx!.drawImage(backgroundCanvas, 0, 0, targetWidth, targetHeight);
      }
      drawSignatureProgressive(ctx!, points, drawProgress, {
        targetWidth,
        targetHeight,
        accent,
        ink,
      });
      if (backgroundVideo) {
        ctx!.drawImage(backgroundCanvas, 0, 0, targetWidth, targetHeight);
      }
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
  backgroundVideo?.pause();
  onProgress?.('encoding', 0.98);

  const blob = await stopped;
  triggerDownload(blob, fileName);
  onProgress?.('encoding', 1);
  return blob;
}

async function prepareBackgroundVideo(url: string) {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.loop = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';
  const metadataReady = waitForMedia(video, 'loadedmetadata');
  video.src = url;
  video.load();
  await metadataReady;
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) await waitForMedia(video, 'loadeddata').catch(() => undefined);
  return video;
}

function waitForMedia(video: HTMLVideoElement, eventName: string) {
  return new Promise<void>((resolve, reject) => {
    if (mediaEventAlreadySatisfied(video, eventName)) {
      resolve();
      return;
    }
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Source video timed out while preparing export.'));
    }, 8000);
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener(eventName, onEvent);
      video.removeEventListener('error', onError);
    };
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Source video could not be prepared for export.'));
    };
    video.addEventListener(eventName, onEvent, { once: true });
    video.addEventListener('error', onError, { once: true });
  });
}

function mediaEventAlreadySatisfied(video: HTMLVideoElement, eventName: string) {
  if (eventName === 'loadedmetadata') return video.readyState >= HTMLMediaElement.HAVE_METADATA;
  if (eventName === 'loadeddata') return video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
  return false;
}

function videoProgress(video: HTMLVideoElement, elapsedMs: number, exportDurationMs: number) {
  if (!Number.isFinite(video.duration) || video.duration <= 0) return Math.min(1, elapsedMs / exportDurationMs);
  const naturalProgress = clamp(video.currentTime / video.duration, 0, 1);
  if (naturalProgress > 0 || !video.paused) return naturalProgress;
  return Math.min(1, elapsedMs / exportDurationMs);
}

function drawVideoBackground(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  targetWidth: number,
  targetHeight: number,
) {
  ctx.save();
  ctx.fillStyle = '#0A0A0B';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  const videoWidth = video.videoWidth || targetWidth;
  const videoHeight = video.videoHeight || targetHeight;
  const scale = Math.max(targetWidth / videoWidth, targetHeight / videoHeight);
  const drawWidth = videoWidth * scale;
  const drawHeight = videoHeight * scale;
  const drawX = (targetWidth - drawWidth) / 2;
  const drawY = (targetHeight - drawHeight) / 2;

  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    ctx.restore();
    return;
  }

  ctx.filter = 'saturate(0.95) contrast(1.08)';
  ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);
  ctx.filter = 'none';
  ctx.restore();
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
  const cruxPoints = points.filter((point) => point.dyno);
  const movingCrux = activeCruxPoint(cruxPoints, progress) || (progress >= 1 ? maxVelocityPoint(points) : undefined);
  if (movingCrux && progress >= Math.max(0.08, (cruxPoints[0]?.t ?? 0) * 0.8)) {
    drawCrux(ctx, movingCrux, accent, ink);
  }
  if (progress >= 1) {
    drawEndMark(ctx, tail, accent);
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

function drawCrux(ctx: CanvasRenderingContext2D, point: MotionPoint | undefined, accent: string, ink: string) {
  if (!point) return;
  const labelX = clamp(point.x + 16, 10, SIGNATURE_VB_W - 46);
  const labelY = clamp(point.y - 17, 12, SIGNATURE_VB_H - 10);
  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 10;
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.22;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 0.9;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(point.x + 8, point.y - 8);
  ctx.lineTo(labelX - 4, labelY - 4);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = ink;
  ctx.font = '600 6px JetBrains Mono, monospace';
  ctx.fillText('CRUX', labelX, labelY);
  ctx.restore();
}

function maxVelocityPoint(points: MotionPoint[]) {
  return points.reduce<MotionPoint | undefined>((best, point) => {
    if (!best || (point.velocity || 0) > (best.velocity || 0)) return point;
    return best;
  }, undefined);
}

function activeCruxPoint(points: MotionPoint[], progress?: number) {
  if (!points.length) return undefined;
  if (progress === undefined || points.length === 1) return points[0];
  const sorted = [...points].sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
  if (progress <= (sorted[0].t ?? 0)) return sorted[0];
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index];
    const next = sorted[index + 1];
    const currentT = current.t ?? 0;
    const nextT = next.t ?? 1;
    if (progress <= nextT) {
      const eased = easeInOutCubic(clamp((progress - currentT) / Math.max(0.001, nextT - currentT), 0, 1));
      return {
        ...next,
        x: current.x + (next.x - current.x) * eased,
        y: current.y + (next.y - current.y) * eased,
        t: progress,
      };
    }
  }
  return sorted[sorted.length - 1];
}

function easeInOutCubic(value: number) {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
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
