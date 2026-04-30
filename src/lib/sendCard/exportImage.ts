import { toPng, toCanvas } from 'html-to-image';
import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import type { MotionPoint, MotionSignatureData, SendCardFormat, SendCardTextTone } from '../../types/klym';
import { clamp, motionPointAtProgress, partialSmoothPath, scaledPoints } from '../signature';

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

interface VideoExportResult {
  blob: Blob;
  fileName: string;
  mimeType: string;
  delivery: 'shared' | 'downloaded';
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
}: VideoExportOptions): Promise<VideoExportResult> {
  if (typeof MediaRecorder === 'undefined' && (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined')) {
    throw new Error('Instagram-ready MP4 export is not supported in this browser.');
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
  if (!backgroundVideo) {
    bgCtx.fillStyle = '#0A0A0B';
    bgCtx.fillRect(0, 0, targetWidth, targetHeight);
  } else {
    bgCtx.clearRect(0, 0, targetWidth, targetHeight);
  }
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

  const points = scaledPoints(signature.points, SIGNATURE_VB_W, SIGNATURE_VB_H);
  const videoDurationMs =
    backgroundVideo && Number.isFinite(backgroundVideo.duration) && backgroundVideo.duration > 0
      ? Math.min(Math.max(backgroundVideo.duration * 1000, 1400), 30000)
      : 0;
  const lineDurationMs = backgroundVideo ? videoDurationMs : durationMs;
  const totalDuration = backgroundVideo ? videoDurationMs : durationMs + holdMs;

  const mp4Config = await getMp4EncoderConfig(targetWidth, targetHeight, fps).catch(() => null);
  if (mp4Config) {
    const outputFileName = withVideoExtension(fileName, 'video/mp4');
    const blob = await encodeMp4WithWebCodecs({
      recordCanvas,
      ctx,
      backgroundCanvas,
      backgroundVideo,
      points,
      targetWidth,
      targetHeight,
      totalDuration,
      lineDurationMs,
      fps,
      accent,
      ink,
      encoderConfig: mp4Config,
      onProgress,
    });
    const delivery = await shareOrDownload(blob, outputFileName);
    onProgress?.('encoding', 1);
    return { blob, fileName: outputFileName, mimeType: 'video/mp4', delivery };
  }

  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Instagram-ready MP4 export is not supported in this browser.');
  }

  const stream = recordCanvas.captureStream(fps);
  const { recorder, mimeType } = createVideoRecorder(stream);
  const outputFileName = withVideoExtension(fileName, mimeType);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) chunks.push(event.data);
  };

  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      try {
        const blob = new Blob(chunks, { type: mimeType });
        if (!blob.size) {
          reject(new Error('Video encoder returned an empty file. Try exporting again after the preview video has loaded.'));
          return;
        }
        resolve(blob);
      } catch (error) {
        reject(error);
      }
    };
    recorder.onerror = (event) => reject((event as ErrorEvent).error || new Error('MediaRecorder error.'));
  });

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
      drawExportFrame({
        ctx: ctx!,
        backgroundCanvas,
        backgroundVideo,
        points,
        targetWidth,
        targetHeight,
        drawProgress,
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
  backgroundVideo?.pause();
  stream.getTracks().forEach((track) => track.stop());
  onProgress?.('encoding', 0.98);

  const blob = await stopped;
  const delivery = await shareOrDownload(blob, outputFileName);
  onProgress?.('encoding', 1);
  return { blob, fileName: outputFileName, mimeType, delivery };
}

interface DrawExportFrameOptions {
  ctx: CanvasRenderingContext2D;
  backgroundCanvas: HTMLCanvasElement;
  backgroundVideo?: HTMLVideoElement;
  points: MotionPoint[];
  targetWidth: number;
  targetHeight: number;
  drawProgress: number;
  accent: string;
  ink: string;
}

function drawExportFrame({
  ctx,
  backgroundCanvas,
  backgroundVideo,
  points,
  targetWidth,
  targetHeight,
  drawProgress,
  accent,
  ink,
}: DrawExportFrameOptions) {
  ctx.clearRect(0, 0, targetWidth, targetHeight);
  if (backgroundVideo) {
    drawVideoBackground(ctx, backgroundVideo, targetWidth, targetHeight);
  } else {
    ctx.drawImage(backgroundCanvas, 0, 0, targetWidth, targetHeight);
  }
  drawSignatureProgressive(ctx, points, drawProgress, {
    targetWidth,
    targetHeight,
    accent,
    ink,
  });
  if (backgroundVideo) {
    ctx.drawImage(backgroundCanvas, 0, 0, targetWidth, targetHeight);
  }
}

interface Mp4EncodeOptions {
  recordCanvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  backgroundCanvas: HTMLCanvasElement;
  backgroundVideo?: HTMLVideoElement;
  points: MotionPoint[];
  targetWidth: number;
  targetHeight: number;
  totalDuration: number;
  lineDurationMs: number;
  fps: number;
  accent: string;
  ink: string;
  encoderConfig: VideoEncoderConfig;
  onProgress?: VideoExportOptions['onProgress'];
}

async function encodeMp4WithWebCodecs({
  recordCanvas,
  ctx,
  backgroundCanvas,
  backgroundVideo,
  points,
  targetWidth,
  targetHeight,
  totalDuration,
  lineDurationMs,
  fps,
  accent,
  ink,
  encoderConfig,
  onProgress,
}: Mp4EncodeOptions) {
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: 'avc',
      width: targetWidth,
      height: targetHeight,
      frameRate: fps,
    },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'strict',
  });
  let encoderError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (error) => {
      encoderError = error;
    },
  });
  encoder.configure(encoderConfig);

  if (backgroundVideo) {
    await startBackgroundPlayback(backgroundVideo, totalDuration);
  }

  onProgress?.('recording', 0);
  const frameCount = Math.max(2, Math.ceil((totalDuration / 1000) * fps));
  const frameDurationUs = Math.round(1_000_000 / fps);
  const keyFrameInterval = Math.max(1, Math.round(fps));
  const start = performance.now();

  for (let frameIndex = 0; frameIndex <= frameCount; frameIndex += 1) {
    const targetElapsed = Math.min(totalDuration, (frameIndex / fps) * 1000);
    if (backgroundVideo) {
      const waitMs = start + targetElapsed - performance.now();
      if (waitMs > 1) await delay(waitMs);
    } else if (frameIndex % 8 === 0) {
      await nextAnimationFrame();
    }

    const elapsed = backgroundVideo ? Math.min(totalDuration, performance.now() - start) : targetElapsed;
    const drawProgress = backgroundVideo
      ? videoProgress(backgroundVideo, elapsed, totalDuration)
      : Math.min(1, targetElapsed / lineDurationMs);

    drawExportFrame({
      ctx,
      backgroundCanvas,
      backgroundVideo,
      points,
      targetWidth,
      targetHeight,
      drawProgress,
      accent,
      ink,
    });

    const frame = new VideoFrame(recordCanvas, {
      timestamp: frameIndex * frameDurationUs,
      duration: frameDurationUs,
    });
    encoder.encode(frame, { keyFrame: frameIndex % keyFrameInterval === 0 });
    frame.close();

    if (encoderError) throw encoderError;
    if (encoder.encodeQueueSize > 8) await nextAnimationFrame();
    onProgress?.('recording', Math.min(0.99, targetElapsed / totalDuration));
  }

  onProgress?.('encoding', 0.98);
  await encoder.flush();
  if (encoderError) throw encoderError;
  encoder.close();
  backgroundVideo?.pause();
  muxer.finalize();

  if (!target.buffer.byteLength) {
    throw new Error('MP4 encoder returned an empty file. Try exporting again after the preview video has loaded.');
  }

  return new Blob([target.buffer], { type: 'video/mp4' });
}

async function getMp4EncoderConfig(width: number, height: number, fps: number): Promise<VideoEncoderConfig | null> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return null;

  const bitrate = Math.min(24_000_000, Math.max(10_000_000, Math.round(width * height * fps * 0.12)));
  const codecCandidates = [
    'avc1.42E034',
    'avc1.4D4034',
    'avc1.640034',
    'avc1.42E01F',
    'avc1.42001F',
  ];

  for (const codec of codecCandidates) {
    const config: VideoEncoderConfig = {
      codec,
      width,
      height,
      bitrate,
      framerate: fps,
      hardwareAcceleration: 'prefer-hardware',
      latencyMode: 'quality',
      avc: { format: 'avc' },
    };
    const support = await VideoEncoder.isConfigSupported(config).catch(() => null);
    if (support?.supported) return support.config || config;
  }

  return null;
}

async function startBackgroundPlayback(video: HTMLVideoElement, totalDuration: number) {
  video.currentTime = 0;
  const exportRate = video.duration * 1000 > totalDuration ? video.duration / (totalDuration / 1000) : 1;
  try {
    video.playbackRate = Number.isFinite(exportRate) && exportRate > 0 && exportRate <= 16 ? exportRate : 1;
  } catch {
    video.playbackRate = 1;
  }
  await video.play().catch(() => undefined);
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

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function nextAnimationFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
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

  const path = partialSmoothPath(points, progress);
  if (!path) {
    ctx.restore();
    return;
  }

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
  const movingCrux = motionPointAtProgress(points, progress) || (progress >= 1 ? maxVelocityPoint(points) : undefined);
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

function createVideoRecorder(stream: MediaStream) {
  const mimeCandidates = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4;codecs=h264',
    'video/mp4',
  ];
  const supportedTypes = mimeCandidates.filter((type) => MediaRecorder.isTypeSupported(type));
  if (!supportedTypes.length) throw new Error('Instagram-ready MP4 export is not supported in this browser.');

  for (const mimeType of supportedTypes) {
    try {
      return {
        recorder: new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 16_000_000,
        }),
        mimeType,
      };
    } catch {
      /* try the next encoder */
    }
  }

  throw new Error('Instagram-ready MP4 export is not supported in this browser.');
}

function withVideoExtension(fileName: string, mimeType: string) {
  const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
  return fileName.replace(/\.(webm|mp4)$/i, `.${extension}`);
}

async function shareOrDownload(blob: Blob, fileName: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], fileName, { type: blob.type || 'video/mp4' });
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };

  if (isTouchDevice() && nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
    try {
      await nav.share({
        files: [file],
        title: 'KLYM send card',
      });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Share cancelled.');
      }
    }
  }

  triggerDownload(blob, fileName);
  return 'downloaded';
}

function isTouchDevice() {
  return (
    (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) ||
    navigator.maxTouchPoints > 1
  );
}
