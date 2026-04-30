import type { MotionFrame } from '../../types/klym';

interface ExtractFrameOptions {
  count?: number;
  maxWidth?: number;
  quality?: number;
  trimStartRatio?: number;
  trimEndRatio?: number;
  onProgress?: (progress: number) => void;
}

export async function extractFramesFromVideo(
  file: File,
  options: ExtractFrameOptions = {},
): Promise<{ frames: MotionFrame[]; duration: number; videoUrl: string }> {
  const count = options.count ?? 10;
  const maxWidth = options.maxWidth ?? 420;
  const quality = options.quality ?? 0.72;
  const videoUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  video.src = videoUrl;

  try {
    await waitForEvent(video, 'loadedmetadata');
  } catch (error) {
    URL.revokeObjectURL(videoUrl);
    throw new Error(
      `Video metadata could not be loaded. Some HEVC .mov files are not supported by this browser. Try an H.264 .mov/mp4 export. ${error instanceof Error ? error.message : ''}`,
    );
  }

  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const naturalWidth = video.videoWidth || maxWidth;
  const naturalHeight = video.videoHeight || Math.round(maxWidth * 1.4);
  const scale = Math.min(1, maxWidth / naturalWidth);
  const width = Math.max(1, Math.round(naturalWidth * scale));
  const height = Math.max(1, Math.round(naturalHeight * scale));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    URL.revokeObjectURL(videoUrl);
    throw new Error('Canvas is not available in this browser.');
  }
  canvas.width = width;
  canvas.height = height;

  const safeDuration = Math.max(duration, 0.5);
  const trimStartRatio = options.trimStartRatio ?? 0.08;
  const trimEndRatio = options.trimEndRatio ?? 0.92;
  const start = Math.max(0, Math.min(safeDuration * trimStartRatio, safeDuration - 0.2));
  const end = Math.max(start + 0.1, Math.min(safeDuration, safeDuration * trimEndRatio));
  const frames: MotionFrame[] = [];

  for (let index = 0; index < count; index += 1) {
    const t = count === 1 ? start : start + ((end - start) * index) / (count - 1);
    video.currentTime = Math.min(t, Math.max(0, safeDuration - 0.05));
    try {
      await waitForEvent(video, 'seeked');
    } catch (error) {
      URL.revokeObjectURL(videoUrl);
      throw new Error(
        `Video frame ${index + 1} could not be decoded. HEVC/large .mov decoding may be unsupported in this browser. ${error instanceof Error ? error.message : ''}`,
      );
    }
    context.drawImage(video, 0, 0, width, height);
    frames.push({
      id: `frame_${index}`,
      index,
      time: video.currentTime,
      width,
      height,
      dataUrl: canvas.toDataURL('image/jpeg', quality),
    });
    options.onProgress?.((index + 1) / count);
  }

  return { frames, duration, videoUrl };
}

function waitForEvent(target: HTMLMediaElement, eventName: string) {
  return new Promise<void>((resolve, reject) => {
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`Video ${eventName} failed.`));
    };
    const cleanup = () => {
      target.removeEventListener(eventName, onEvent);
      target.removeEventListener('error', onError);
    };
    target.addEventListener(eventName, onEvent, { once: true });
    target.addEventListener('error', onError, { once: true });
  });
}
