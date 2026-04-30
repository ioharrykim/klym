import { forwardRef } from 'react';
import type {
  MotionSignatureData,
  Project,
  SendCardBackgroundMode,
  SendCardFormat,
  SendCardLayout,
  MotionSignatureStyle,
} from '../types/klym';
import { tokens } from '../lib/tokens';
import { MotionSignature } from './MotionSignature';

interface SendCardPreviewProps {
  project: Project;
  signature: MotionSignatureData;
  format: SendCardFormat;
  layout: SendCardLayout;
  style: MotionSignatureStyle;
  reflection: string;
  backgroundMode: SendCardBackgroundMode;
  customBackgroundDataUrl?: string;
}

export const SendCardPreview = forwardRef<HTMLDivElement, SendCardPreviewProps>(function SendCardPreview(
  { project, signature, format, layout, style, reflection, backgroundMode, customBackgroundDataUrl },
  ref,
) {
  const sentDate = formatDate(project.sentAt || project.updatedAt);
  const backgroundImages =
    backgroundMode === 'photo' && customBackgroundDataUrl
      ? [customBackgroundDataUrl]
      : backgroundMode === 'video-frames'
        ? signature.backgroundFrameDataUrls || []
        : [];
  return (
    <div
      ref={ref}
      className={`send-card send-card-${format} send-card-${layout} ${backgroundImages.length ? 'send-card-has-media' : ''}`}
    >
      {backgroundImages.length > 0 && <MediaBackground images={backgroundImages} />}
      {layout === 'blueprint' && <BlueprintGrid />}
      <div className="send-card-signature">
        <MotionSignature data={{ ...signature, style }} style={style} animate={false} showGrid={layout !== 'poster'} ink={layout === 'poster' ? tokens.ink : tokens.paper} />
      </div>
      <div className="send-card-chrome">
        <div className="send-card-top">
          <div>
            <strong>KLYM</strong>
            <span>SENT · {sentDate}</span>
          </div>
          <b>{project.grade}</b>
        </div>
        <div className="send-card-bottom">
          <p>{reflection || 'A line worth keeping.'}</p>
          <h2>{project.displayName}</h2>
          {project.localName && <h3>{project.localName}</h3>}
          <div className="send-card-meta">
            <span>{project.gymName}</span>
            <span>{project.wallName}</span>
            <span>{project.grade}</span>
            <span>{project.attemptsCount} TRIES</span>
            {project.sentAt && <span>{projectDuration(project)} DAYS</span>}
          </div>
          <div className="send-card-footer">
            KEEP LINES, YOUR MOVE. · {(signature.analysisMethod || signature.sourceType).toUpperCase()}
          </div>
        </div>
      </div>
    </div>
  );
});

function MediaBackground({ images }: { images: string[] }) {
  if (images.length === 1) {
    return (
      <div className="send-card-media-bg single">
        <img src={images[0]} alt="" />
      </div>
    );
  }

  return (
    <div className="send-card-media-bg strip">
      {images.slice(0, 3).map((image, index) => (
        <img key={`${image.slice(0, 32)}-${index}`} src={image} alt="" />
      ))}
    </div>
  );
}

function BlueprintGrid() {
  return (
    <svg className="blueprint-grid" width="100%" height="100%" aria-hidden="true">
      {Array.from({ length: 20 }).map((_, index) => (
        <line key={`v${index}`} x1={`${index * 5}%`} y1="0" x2={`${index * 5}%`} y2="100%" />
      ))}
      {Array.from({ length: 20 }).map((_, index) => (
        <line key={`h${index}`} x1="0" y1={`${index * 5}%`} x2="100%" y2={`${index * 5}%`} />
      ))}
    </svg>
  );
}

function projectDuration(project: Project) {
  const start = new Date(project.createdAt).getTime();
  const end = new Date(project.sentAt || project.updatedAt).getTime();
  return Math.max(1, Math.ceil((end - start) / 86400000));
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit',
  }).format(new Date(iso));
}
