import { useEffect, useMemo, useRef, useState } from 'react';
import { MotionSignature } from '../components/MotionSignature';
import { EmptyState, Icon, KButton } from '../components/UI';
import { GradeInput } from '../components/GradeInput';
import { extractFramesFromVideo } from '../lib/motion/extractFrames';
import { detectMotionFromFrames } from '../lib/motion/poseDetection';
import { composeMotionPath } from '../lib/motion/path';
import type {
  GradeMode,
  MotionFrame,
  MotionEvent,
  MotionPoint,
  MotionProcessingState,
  MotionSignatureData,
  MotionSignatureStyle,
  Project,
  ProjectDraft,
} from '../types/klym';

type SignatureDraft = Omit<MotionSignatureData, 'id' | 'createdAt'>;

interface MotionFlowScreenProps {
  projects: Project[];
  selectedProject?: Project;
  style: MotionSignatureStyle;
  quickMode?: boolean;
  onCreateProject: () => void;
  onBack: () => void;
  onComplete: (signature: SignatureDraft, project?: Project) => void;
  onQuickComplete?: (signature: SignatureDraft, projectDraft: ProjectDraft) => void;
}

export function MotionFlowScreen({
  projects,
  selectedProject,
  style,
  quickMode = false,
  onCreateProject,
  onBack,
  onComplete,
  onQuickComplete,
}: MotionFlowScreenProps) {
  const [projectId, setProjectId] = useState(selectedProject?.id || projects[0]?.id || '');
  const project = projects.find((item) => item.id === projectId);
  const [signatureStyle, setSignatureStyle] = useState<MotionSignatureStyle>(style);
  const [state, setState] = useState<MotionProcessingState>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [frames, setFrames] = useState<MotionFrame[]>([]);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [readySignature, setReadySignature] = useState<SignatureDraft | null>(null);
  const [manualPoints, setManualPoints] = useState<Record<string, MotionPoint>>({});
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    setProjectId(selectedProject?.id || projects[0]?.id || '');
  }, [projects, selectedProject]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const manualCount = Object.keys(manualPoints).length;

  async function handleFile(file: File) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setFrames([]);
    setManualPoints({});
    setReadySignature(null);
    setNotes([]);
    setError('');
    setProgress(0);
    setState('video-selected');
  }

  async function processVideo() {
    if (!selectedFile) return;
    try {
      setState('extracting-frames');
      const extracted = await extractFramesFromVideo(selectedFile, {
        count: 18,
        maxWidth: 512,
        trimStartRatio: 0.06,
        trimEndRatio: 0.94,
        onProgress: (value) => setProgress(Math.round(value * 40)),
      });
      URL.revokeObjectURL(extracted.videoUrl);
      setFrames(extracted.frames);
      setDuration(extracted.duration);

      setState('detecting-motion');
      setProgress(56);
      const detection = await detectMotionFromFrames(extracted.frames);
      setNotes(detection.notes);
      setProgress(76);

      if (detection.failed) {
        setState('failed');
        setError('Automatic detection failed. Use manual correction.');
        return;
      }

      setState('generating-signature');
      const composed = composeMotionPath(detection.points);
      setReadySignature({
        projectId: project?.id,
        videoName: selectedFile.name,
        videoDuration: extracted.duration,
        frameCount: extracted.frames.length,
        backgroundFrameDataUrls: keyFrameDataUrls(extracted.frames),
        points: composed.points,
        svgPath: composed.svgPath,
        style: signatureStyle,
        sourceType: 'auto',
        analysisMethod: detection.method,
        confidenceScore: detection.confidenceScore,
        motionEvents: detectMotionEvents(composed.points),
        processingNotes: detection.notes,
      });
      setProgress(100);
      setState('signature-ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Video processing failed.');
      setState('failed');
    }
  }

  function setManualPoint(frame: MotionFrame, event: React.MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    setManualPoints((current) => ({
      ...current,
      [frame.id]: {
        x,
        y,
        t: frames.length <= 1 ? 0 : frame.index / (frames.length - 1),
        confidence: 1,
        manual: true,
      },
    }));
  }

  function buildManualSignature() {
    if (!selectedFile || manualCount < 3) return;
    setState('generating-signature');
    const points = Object.entries(manualPoints)
      .map(([frameId, point]) => {
        const frame = frames.find((item) => item.id === frameId);
        return { frame, point };
      })
      .filter((entry): entry is { frame: MotionFrame; point: MotionPoint } => Boolean(entry.frame))
      .sort((a, b) => a.frame.index - b.frame.index)
      .map((entry) => entry.point);
    const composed = composeMotionPath(points);
    setReadySignature({
      projectId: project?.id,
      videoName: selectedFile.name,
      videoDuration: duration,
      frameCount: frames.length,
      backgroundFrameDataUrls: keyFrameDataUrls(frames),
      points: composed.points,
      svgPath: composed.svgPath,
      style: signatureStyle,
      sourceType: state === 'failed' ? 'manual' : 'assisted',
      analysisMethod: 'manual',
      confidenceScore: 1,
      motionEvents: detectMotionEvents(composed.points),
      processingNotes: ['Signature generated from user-selected body-center points on sampled video frames.'],
    });
    setProgress(100);
    setState('signature-ready');
  }

  function updateReadyStyle(nextStyle: MotionSignatureStyle) {
    setSignatureStyle(nextStyle);
    setReadySignature((current) => (current ? { ...current, style: nextStyle } : current));
  }

  return (
    <section className="screen motion-screen">
      <div className="motion-top">
        <button type="button" onClick={onBack}>
          <Icon name="x" size={16} />
          CLOSE
        </button>
        <span>MOTION SIGNATURE / {stateLabel(state)}</span>
      </div>

      <div className="motion-body">
        {!quickMode && projects.length === 0 ? (
          <EmptyState
            title="CREATE A PROJECT FIRST"
            body="Motion Signatures attach to a real line. Add the gym, grade, and wall first, then upload the send video."
            action={<KButton icon="plus" onClick={onCreateProject}>CREATE PROJECT</KButton>}
          />
        ) : (
          <>
            {!quickMode && (
              <label className="motion-project-select">
                <span>PROJECT</span>
                <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                  {projects.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.displayName} · {item.grade}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {quickMode && (state === 'idle' || state === 'video-selected') && (
              <div className="quick-banner">
                <span>QUICK SEND</span>
                <p>Drop a send clip and KLYM builds a Motion Signature card. No project log required.</p>
              </div>
            )}

            {(state === 'idle' || state === 'video-selected') && (
              <UploadStep
                selectedFile={selectedFile}
                previewUrl={previewUrl}
                onFile={handleFile}
                onProcess={processVideo}
                quickMode={quickMode}
              />
            )}

            {['extracting-frames', 'detecting-motion', 'generating-signature'].includes(state) && (
              <ProcessingStep state={state} progress={progress} frames={frames} previewUrl={previewUrl} />
            )}

            {state === 'failed' && (
              <ManualStep
                error={error}
                notes={notes}
                frames={frames}
                manualPoints={manualPoints}
                onTap={setManualPoint}
                onBuild={buildManualSignature}
                manualCount={manualCount}
              />
            )}

            {state === 'signature-ready' && readySignature && (
              <ReadyStep
                signature={readySignature}
                project={project}
                previewUrl={previewUrl}
                style={signatureStyle}
                quickMode={quickMode}
                onStyle={updateReadyStyle}
                onManual={() => setState('failed')}
                onComplete={() => onComplete({ ...readySignature, style: signatureStyle }, project)}
                onQuickComplete={(draft) => onQuickComplete?.({ ...readySignature, style: signatureStyle }, draft)}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}

function UploadStep({
  selectedFile,
  previewUrl,
  onFile,
  onProcess,
  quickMode = false,
}: {
  selectedFile: File | null;
  previewUrl: string;
  onFile: (file: File) => void;
  onProcess: () => void;
  quickMode?: boolean;
}) {
  return (
    <div className="upload-step">
      <div>
        <h1>{quickMode ? 'DROP YOUR SEND CLIP.' : 'UPLOAD YOUR SEND VIDEO.'}</h1>
        <p>
          {quickMode
            ? 'Pick a clip from your gallery — KLYM extracts the line and lets you finalize the card with a name and grade.'
            : 'Your movement becomes a unique continuous line. Automatic detection runs first; manual correction is available if confidence drops.'}
        </p>
      </div>
      <label className="video-drop">
        <input
          type="file"
          accept="video/mp4,video/quicktime,video/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
          }}
        />
        {previewUrl ? (
          <video src={previewUrl} controls muted playsInline />
        ) : (
          <>
            <span>
              <Icon name="upload" size={26} />
            </span>
            <strong>SELECT FROM GALLERY</strong>
            <small>MP4 / MOV · sampled in-browser</small>
          </>
        )}
      </label>
      {selectedFile && (
        <div className="video-file-row">
          <span>{selectedFile.name}</span>
          <KButton icon="bolt" onClick={onProcess}>
            GENERATE SIGNATURE
          </KButton>
        </div>
      )}
      <div className="motion-callout">
        <b>HOW IT WORKS</b>
        <p>KLYM samples key frames, tracks the center of visual motion, then turns the video-derived points into a normalized SVG Motion Signature.</p>
      </div>
    </div>
  );
}

function ProcessingStep({
  state,
  progress,
  frames,
  previewUrl,
}: {
  state: MotionProcessingState;
  progress: number;
  frames: MotionFrame[];
  previewUrl: string;
}) {
  return (
    <div className="processing-step">
      <div className="scanner-window">
        {previewUrl ? (
          <video src={previewUrl} muted playsInline autoPlay loop />
        ) : frames[0] ? (
          <img src={frames[0].dataUrl} alt="" />
        ) : (
          <span>[ SOURCE VIDEO ]</span>
        )}
        <div className="scanner-dim" />
        <i style={{ top: `${100 - progress}%` }} />
      </div>
      <h1>{state === 'extracting-frames' ? 'EXTRACTING FRAMES' : state === 'detecting-motion' ? 'DETECTING MOTION' : 'GENERATING SIGNATURE'}</h1>
      <div className="progress-readout">
        <span>{stateLabel(state)}</span>
        <b>{String(progress).padStart(3, '0')}%</b>
      </div>
      <div className="progress-line">
        <i style={{ width: `${progress}%` }} />
      </div>
      <div className="process-list">
        {['VIDEO SELECTED', 'EXTRACTING FRAMES', 'DETECTING MOTION', 'GENERATING SIGNATURE'].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}

function ManualStep({
  error,
  notes,
  frames,
  manualPoints,
  manualCount,
  onTap,
  onBuild,
}: {
  error: string;
  notes: string[];
  frames: MotionFrame[];
  manualPoints: Record<string, MotionPoint>;
  manualCount: number;
  onTap: (frame: MotionFrame, event: React.MouseEvent<HTMLButtonElement>) => void;
  onBuild: () => void;
}) {
  return (
    <div className="manual-step">
      <div className="failure-banner">
        <b>{error || 'Automatic detection failed'}</b>
        <p>Tap the climber&apos;s body center on at least three sampled frames. KLYM will generate the signature from those video-derived points.</p>
      </div>
      <div className="note-list">
        {notes.map((note) => (
          <span key={note}>{note}</span>
        ))}
      </div>
      <div className="frame-grid">
        {frames.map((frame) => {
          const point = manualPoints[frame.id];
          return (
            <button key={frame.id} type="button" onClick={(event) => onTap(frame, event)}>
              <img src={frame.dataUrl} alt={`Sample frame ${frame.index + 1}`} />
              <span>{frame.time.toFixed(1)}s</span>
              {point && <i style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} />}
            </button>
          );
        })}
      </div>
      <KButton icon="check" disabled={manualCount < 3} onClick={onBuild}>
        GENERATE FROM {manualCount} POINTS
      </KButton>
    </div>
  );
}

function ReadyStep({
  signature,
  project,
  previewUrl,
  style,
  quickMode = false,
  onStyle,
  onManual,
  onComplete,
  onQuickComplete,
}: {
  signature: SignatureDraft;
  project?: Project;
  previewUrl: string;
  style: MotionSignatureStyle;
  quickMode?: boolean;
  onStyle: (style: MotionSignatureStyle) => void;
  onManual: () => void;
  onComplete: () => void;
  onQuickComplete?: (draft: ProjectDraft) => void;
}) {
  const styles: MotionSignatureStyle[] = useMemo(() => ['dynamic', 'refined', 'editorial', 'data'], []);
  const [quickDraft, setQuickDraft] = useState<ProjectDraft>({
    displayName: '',
    localName: '',
    gymName: '',
    wallName: '',
    grade: 'V6',
    gradeMode: 'scale',
    gradeColor: undefined,
    notes: '',
    betaNotes: '',
    nextAttemptStrategy: '',
    status: 'sent',
  });
  const quickCanSubmit =
    quickDraft.displayName.trim().length > 0 &&
    (quickDraft.gradeMode === 'color'
      ? Boolean(quickDraft.gradeColor)
      : quickDraft.grade.trim().length > 0);

  function updateQuick<K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) {
    setQuickDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="ready-step">
      <span className="ready-kicker">SIGNATURE READY · {signature.sourceType.toUpperCase()} · {Math.round(signature.confidenceScore * 100)}%</span>
      <h1>YOUR LINE IS READY.</h1>
      <VideoMotionPreview signature={signature} project={project} previewUrl={previewUrl} style={style} />
      {signature.motionEvents && signature.motionEvents.length > 0 && (
        <div className="motion-event-row">
          {signature.motionEvents.map((event) => (
            <span key={`${event.type}-${event.t}`}>
              {event.label} · {Math.round(event.t * 100)}%
            </span>
          ))}
        </div>
      )}
      <div className="style-picker">
        <span>STYLE</span>
        {styles.map((item) => (
          <button key={item} type="button" data-active={style === item} onClick={() => onStyle(item)}>
            {item.toUpperCase()}
          </button>
        ))}
      </div>
      {quickMode ? (
        <div className="quick-meta-form">
          <div className="quick-meta-head">
            <span>FINISH THE CARD</span>
            <h2>NAME THIS SEND.</h2>
          </div>
          <label>
            <span>PROJECT NAME</span>
            <input
              value={quickDraft.displayName}
              onChange={(event) => updateQuick('displayName', event.target.value)}
              placeholder="CONCRETE TRAVERSE"
              autoFocus
            />
          </label>
          <div className="field-grid">
            <label>
              <span>GYM (OPTIONAL)</span>
              <input
                value={quickDraft.gymName}
                onChange={(event) => updateQuick('gymName', event.target.value)}
                placeholder="THE CLIMB · SEONGSU"
              />
            </label>
            <label>
              <span>WALL (OPTIONAL)</span>
              <input
                value={quickDraft.wallName}
                onChange={(event) => updateQuick('wallName', event.target.value)}
                placeholder="WALL 03"
              />
            </label>
          </div>
          <label className="grade-input-label">
            <span>GRADE</span>
            <GradeInput
              mode={(quickDraft.gradeMode as GradeMode) || 'scale'}
              grade={quickDraft.grade}
              color={quickDraft.gradeColor}
              onChange={(next) =>
                setQuickDraft((current) => ({
                  ...current,
                  gradeMode: next.mode,
                  grade: next.grade,
                  gradeColor: next.color,
                }))
              }
              compact
            />
          </label>
          <div className="ready-actions">
            <KButton variant="ghost" icon="pencil" onClick={onManual}>
              MANUAL FIX
            </KButton>
            <KButton
              icon="arrow-right"
              onClick={() =>
                onQuickComplete?.({
                  ...quickDraft,
                  displayName: quickDraft.displayName.trim().toUpperCase(),
                  problemName: quickDraft.displayName.trim(),
                  gymName: quickDraft.gymName.trim() || 'KLYM',
                  wallName: quickDraft.wallName.trim() || 'LINE',
                })
              }
              disabled={!quickCanSubmit}
            >
              BUILD CARD
            </KButton>
          </div>
        </div>
      ) : (
        <div className="ready-actions">
          <KButton variant="ghost" icon="pencil" onClick={onManual}>
            MANUAL CORRECTION
          </KButton>
          <KButton icon="arrow-right" onClick={onComplete}>
            SAVE · BUILD CARD
          </KButton>
        </div>
      )}
    </div>
  );
}

function VideoMotionPreview({
  signature,
  project,
  previewUrl,
  style,
}: {
  signature: SignatureDraft;
  project?: Project;
  previewUrl: string;
  style: MotionSignatureStyle;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const video = videoRef.current;
      if (video && Number.isFinite(video.duration) && video.duration > 0) {
        setProgress((video.currentTime % video.duration) / video.duration);
      } else {
        setProgress((Date.now() % 2400) / 2400);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="video-motion-stage">
      {previewUrl ? (
        <video ref={videoRef} src={previewUrl} muted playsInline autoPlay loop />
      ) : signature.backgroundFrameDataUrls?.[0] ? (
        <img src={signature.backgroundFrameDataUrls[0]} alt="" />
      ) : null}
      <div className="video-motion-dim" />
      <MotionSignature
        className="video-signature-overlay"
        data={{ ...signature, id: 'preview', createdAt: new Date().toISOString(), style }}
        style={style}
        progress={progress}
        showGrid={style === 'data'}
        showLabels
        strokeScale={1.12}
      />
      <div className="video-motion-info">
        <span>{signature.frameCount} FRAMES</span>
        <strong>{project?.displayName || 'SEND VIDEO'}</strong>
        <p>
          {project ? `${project.gymName} / ${project.wallName} / ${project.grade}` : signature.videoName}
        </p>
      </div>
    </div>
  );
}

function stateLabel(state: MotionProcessingState) {
  const labels: Record<MotionProcessingState, string> = {
    idle: '01·UPLOAD',
    'video-selected': '01·VIDEO SELECTED',
    'extracting-frames': '02·FRAMES',
    'detecting-motion': '03·DETECT',
    'generating-signature': '04·GENERATE',
    'signature-ready': '05·READY',
    failed: 'MANUAL',
  };
  return labels[state];
}

function keyFrameDataUrls(frames: MotionFrame[]) {
  if (frames.length <= 3) return frames.map((frame) => frame.dataUrl);
  return [
    frames[Math.floor(frames.length * 0.18)],
    frames[Math.floor(frames.length * 0.5)],
    frames[Math.floor(frames.length * 0.82)],
  ]
    .filter(Boolean)
    .map((frame) => frame.dataUrl);
}

function detectMotionEvents(points: MotionPoint[]): MotionEvent[] {
  if (points.length === 0) return [];
  const velocities = points.map((point, index) => {
    if (index === 0) return 0;
    const prev = points[index - 1];
    return Math.hypot(point.x - prev.x, point.y - prev.y);
  });
  const cruxIndex = velocities.reduce((best, value, index) => (value > velocities[best] ? index : best), 0);
  const topout = points.reduce((best, point, index) => (point.y < points[best].y ? index : best), 0);
  return [
    { type: 'start', t: points[0].t, label: 'START', confidence: points[0].confidence ?? 1 },
    {
      type: points[cruxIndex]?.dyno ? 'dyno' : 'crux',
      t: points[cruxIndex]?.t ?? 0.5,
      label: points[cruxIndex]?.dyno ? 'DYNO / POWER MOVE' : 'CRUX',
      confidence: points[cruxIndex]?.confidence ?? 0.7,
    },
    {
      type: 'topout',
      t: points[topout]?.t ?? 1,
      label: 'TOP OUT',
      confidence: points[topout]?.confidence ?? 0.7,
    },
  ];
}
