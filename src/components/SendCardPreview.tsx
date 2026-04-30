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
  hideSignatureLine?: boolean;
  signatureProgress?: number;
}

export const SendCardPreview = forwardRef<HTMLDivElement, SendCardPreviewProps>(function SendCardPreview(
  {
    project,
    signature,
    format,
    layout,
    style,
    reflection,
    backgroundMode,
    customBackgroundDataUrl,
    hideSignatureLine,
    signatureProgress,
  },
  ref,
) {
  const sentDate = formatDate(project.sentAt || project.updatedAt);
  const backgroundImages =
    backgroundMode === 'photo' && customBackgroundDataUrl
      ? [customBackgroundDataUrl]
      : backgroundMode === 'video-frames'
        ? signature.backgroundFrameDataUrls || []
        : [];
  const backgroundVideo = backgroundMode === 'video-frames' ? signature.videoDataUrl : '';
  const showColorGrade = project.gradeMode === 'color' && Boolean(project.gradeColor);
  const metaGrade = showColorGrade ? `COLOR ${project.gradeColor?.toUpperCase() || ''}`.trim() : project.grade;
  const metaParts = [project.gymName, project.wallName, metaGrade].filter(Boolean) as string[];
  if (project.sentAt) metaParts.push(`${projectDuration(project)}D`);
  return (
    <div
      ref={ref}
      className={[
        'send-card',
        `send-card-${format}`,
        `send-card-${layout}`,
        backgroundImages.length ? 'send-card-has-media' : '',
        hideSignatureLine ? 'send-card-line-hidden' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {(backgroundVideo || backgroundImages.length > 0) && <MediaBackground images={backgroundImages} videoUrl={backgroundVideo} />}
      {layout === 'blueprint' && <BlueprintGrid />}
      <div className="send-card-signature">
        <MotionSignature
          data={{ ...signature, style }}
          style={style}
          animate={false}
          showGrid={false}
          ink={layout === 'poster' ? tokens.ink : tokens.paper}
          progress={signatureProgress}
        />
      </div>
      <div className="send-card-frame" aria-hidden />
      <div className="send-card-chrome">
        <div className="send-card-top">
          <div className="send-card-mark">
            <strong>KLYM</strong>
            <span>{sentDate}</span>
          </div>
        </div>
        <div className="send-card-bottom">
          {reflection && <p className="send-card-reflection">"{reflection}"</p>}
          <div className="send-card-title-row">
            <h2>{project.displayName}</h2>
            {project.localName && <h3>{project.localName}</h3>}
          </div>
          <div className="send-card-meta">{metaParts.join(' · ')}</div>
          <div className="send-card-footer">
            <span className={showColorGrade ? 'send-card-grade-pill is-color' : 'send-card-grade-pill'}>{showColorGrade ? project.gradeColor?.toUpperCase() : project.grade}</span>
            <span>{(signature.analysisMethod || signature.sourceType).toUpperCase()}</span>
          </div>
        </div>
      </div>
    </div>
  );
});

function MediaBackground({ images, videoUrl }: { images: string[]; videoUrl?: string }) {
  if (videoUrl) {
    return (
      <div className="send-card-media-bg single">
        <video src={videoUrl} muted playsInline autoPlay loop />
      </div>
    );
  }
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
