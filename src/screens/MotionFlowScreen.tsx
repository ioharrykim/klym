import { useEffect, useMemo, useRef, useState } from 'react';
import { MotionSignature } from '../components/MotionSignature';
import { EmptyState, Icon, KButton } from '../components/UI';
import { GradeInput } from '../components/GradeInput';
import { useI18n } from '../lib/i18n';
import { extractFramesFromVideo } from '../lib/motion/extractFrames';
import { detectMotionFromFrames } from '../lib/motion/poseDetection';
import { composeMotionPath } from '../lib/motion/path';
import type {
  ClimbEnvironment,
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
  const { t, processingState } = useI18n();
  const [projectId, setProjectId] = useState(quickMode ? '' : selectedProject?.id || projects[0]?.id || '');
  const project = quickMode ? undefined : projects.find((item) => item.id === projectId);
  const [environment, setEnvironment] = useState<ClimbEnvironment>(selectedProject?.environment || 'indoor');
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
  const preserveVideoUrlRef = useRef(false);

  useEffect(() => {
    setProjectId(quickMode ? '' : selectedProject?.id || projects[0]?.id || '');
  }, [projects, quickMode, selectedProject]);

  useEffect(() => {
    setEnvironment(project?.environment || 'indoor');
  }, [project?.environment, project?.id]);

  useEffect(() => {
    return () => {
      if (previewUrl && !preserveVideoUrlRef.current) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const manualCount = Object.keys(manualPoints).length;

  async function handleFile(file: File) {
    preserveVideoUrlRef.current = false;
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
        count: 40,
        maxWidth: 720,
        quality: 0.86,
        trimStartRatio: 0.02,
        trimEndRatio: 0.98,
        onProgress: (value) => setProgress(Math.round(value * 40)),
      });
      URL.revokeObjectURL(extracted.videoUrl);
      setFrames(extracted.frames);
      setDuration(extracted.duration);

      setState('detecting-motion');
      setProgress(56);
      const detection = await detectMotionFromFrames(extracted.frames, extracted.duration, environment);
      setNotes(detection.notes);
      setProgress(76);

      if (detection.failed) {
        setState('failed');
        setError(t('motion.autoFailed'));
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
        sourceVideoUrl: previewUrl,
        points: composed.points,
        svgPath: composed.svgPath,
        style: signatureStyle,
        sourceType: 'auto',
        analysisMethod: detection.method,
        environment,
        trackingMode: detection.trackingMode,
        problemStyle: detection.problemStyle,
        completionStatus: detection.completionStatus,
        topHoldColor: detection.topHoldColor,
        fallAt: detection.fallAt,
        finishConfidence: detection.finishConfidence,
        confidenceScore: detection.confidenceScore,
        motionEvents: detectMotionEvents(composed.points, detection.completionStatus, detection.fallAt, environment),
        processingNotes: detection.notes,
      });
      setProgress(100);
      setState('signature-ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('motion.videoFailed'));
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
        t: duration > 0 ? Math.max(0, Math.min(1, frame.time / duration)) : frames.length <= 1 ? 0 : frame.index / (frames.length - 1),
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
      sourceVideoUrl: previewUrl,
      points: composed.points,
      svgPath: composed.svgPath,
      style: signatureStyle,
      sourceType: state === 'failed' ? 'manual' : 'assisted',
      analysisMethod: 'manual',
      environment,
      trackingMode: 'body-center',
      problemStyle: 'unknown',
      completionStatus: 'unknown',
      confidenceScore: 1,
      motionEvents: detectMotionEvents(composed.points, 'unknown', undefined, environment),
      processingNotes: [t('motion.manualNote')],
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
          {t('common.close')}
        </button>
        <span>{t('motion.header', { state: processingState(state) })}</span>
      </div>

      <div className="motion-body">
        {!quickMode && projects.length === 0 ? (
          <EmptyState
            title={t('motion.createFirstTitle')}
            body={t('motion.createFirstBody')}
            action={<KButton icon="plus" onClick={onCreateProject}>{t('common.createProject')}</KButton>}
          />
        ) : (
          <>
            {!quickMode && (
              <label className="motion-project-select">
                <span>{t('common.project')}</span>
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
                <span>{t('dashboard.quickSend')}</span>
                <p>{t('motion.quickBannerBody')}</p>
              </div>
            )}

            {(state === 'idle' || state === 'video-selected') && (
              <UploadStep
                selectedFile={selectedFile}
                previewUrl={previewUrl}
                environment={environment}
                onEnvironment={setEnvironment}
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
                onComplete={() => {
                  preserveVideoUrlRef.current = true;
                  onComplete({ ...readySignature, style: signatureStyle }, project);
                }}
                onQuickComplete={(draft) => {
                  preserveVideoUrlRef.current = true;
                  onQuickComplete?.({ ...readySignature, style: signatureStyle }, draft);
                }}
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
  environment,
  onEnvironment,
  onFile,
  onProcess,
  quickMode = false,
}: {
  selectedFile: File | null;
  previewUrl: string;
  environment: ClimbEnvironment;
  onEnvironment: (environment: ClimbEnvironment) => void;
  onFile: (file: File) => void;
  onProcess: () => void;
  quickMode?: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="upload-step">
      <div>
        <h1>{quickMode ? t('motion.quickUploadTitle') : t('motion.uploadTitle')}</h1>
        <p>
          {quickMode
            ? t('motion.quickUploadBody')
            : t('motion.uploadBody')}
        </p>
      </div>
      <EnvironmentToggle value={environment} onChange={onEnvironment} />
      <label className={previewUrl ? 'video-drop has-preview' : 'video-drop'}>
        <input
          type="file"
          accept="video/*,.mp4,.mov,.m4v"
          aria-label={t('motion.selectVideoAria')}
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
            <strong>{t('motion.selectGallery')}</strong>
            <small>{t('motion.videoHint')}</small>
          </>
        )}
      </label>
      {selectedFile && (
        <div className="video-file-row">
          <span>{selectedFile.name}</span>
          <KButton icon="bolt" onClick={onProcess}>
            {t('motion.generateSignature')}
          </KButton>
        </div>
      )}
      <div className="motion-callout">
        <b>{t('motion.howItWorks')}</b>
        <p>{t('motion.howItWorksBody')}</p>
      </div>
    </div>
  );
}

function EnvironmentToggle({
  value,
  onChange,
}: {
  value: ClimbEnvironment;
  onChange: (environment: ClimbEnvironment) => void;
}) {
  const { t, environment } = useI18n();
  const options: ClimbEnvironment[] = ['indoor', 'outdoor'];

  return (
    <div className="environment-toggle" role="group" aria-label={t('projectForm.environment')}>
      <span>{t('projectForm.environment')}</span>
      <div>
        {options.map((option) => (
          <button key={option} type="button" data-active={value === option} onClick={() => onChange(option)}>
            {environment(option)}
          </button>
        ))}
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
  const { t, processingState, processingTitle, processSteps } = useI18n();
  const progressState = state as Extract<MotionProcessingState, 'extracting-frames' | 'detecting-motion' | 'generating-signature'>;

  return (
    <div className="processing-step">
      <div className="scanner-window">
        {previewUrl ? (
          <video src={previewUrl} muted playsInline autoPlay loop />
        ) : frames[0] ? (
          <img src={frames[0].dataUrl} alt="" />
        ) : (
          <span>{t('motion.sourceVideo')}</span>
        )}
        <div className="scanner-dim" />
        <i style={{ top: `${100 - progress}%` }} />
      </div>
      <h1>{processingTitle(progressState)}</h1>
      <div className="progress-readout">
        <span>{processingState(state)}</span>
        <b>{String(progress).padStart(3, '0')}%</b>
      </div>
      <div className="progress-line">
        <i style={{ width: `${progress}%` }} />
      </div>
      <div className="process-list">
        {processSteps.map((label) => (
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
  const { t } = useI18n();

  return (
    <div className="manual-step">
      <div className="failure-banner">
        <b>{error || t('motion.manualError')}</b>
        <p>{t('motion.manualHelp')}</p>
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
              <img src={frame.dataUrl} alt={t('motion.sampleFrame', { index: frame.index + 1 })} />
              <span>{frame.time.toFixed(1)}s</span>
              {point && <i style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} />}
            </button>
          );
        })}
      </div>
      <KButton icon="check" disabled={manualCount < 3} onClick={onBuild}>
        {t('motion.generateFromPoints', { count: manualCount })}
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
  const {
    t,
    source,
    style: styleLabel,
    motionEvent,
    trackingMode,
    problemStyle,
    environment: environmentLabel,
    completionStatus,
  } = useI18n();
  const styles: MotionSignatureStyle[] = useMemo(() => ['dynamic', 'refined', 'editorial', 'data'], []);
  const [quickDraft, setQuickDraft] = useState<ProjectDraft>({
    displayName: '',
    localName: '',
    gymName: '',
    environment: signature.environment || 'indoor',
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
      <span className="ready-kicker">
        {t('motion.readyKicker', {
          source: source(signature.sourceType),
          score: Math.round(signature.confidenceScore * 100),
        })}
      </span>
      <h1>{t('motion.readyTitle')}</h1>
      <VideoMotionPreview signature={signature} project={project} previewUrl={previewUrl} style={style} />
      {(signature.environment || signature.completionStatus || signature.topHoldColor || signature.fallAt !== undefined) && (
        <div className="motion-event-row motion-analysis-row">
          {signature.environment && <span>{environmentLabel(signature.environment)}</span>}
          {signature.completionStatus && (
            <span data-status={signature.completionStatus}>
              {completionStatus(signature.completionStatus)}
              {signature.finishConfidence !== undefined ? ` · ${Math.round(signature.finishConfidence * 100)}%` : ''}
            </span>
          )}
          {signature.topHoldColor && (
            <span className="motion-color-chip">
              <i style={{ background: signature.topHoldColor }} />
              {t('motion.topHold')}
            </span>
          )}
          {signature.fallAt !== undefined && (
            <span>{t('motion.fallAt', { progress: Math.round(signature.fallAt * 100) })}</span>
          )}
        </div>
      )}
      {(signature.problemStyle || signature.trackingMode) && (
        <div className="motion-event-row">
          {signature.problemStyle && <span>{problemStyle(signature.problemStyle)}</span>}
          {signature.trackingMode && <span>{trackingMode(signature.trackingMode)}</span>}
        </div>
      )}
      {signature.motionEvents && signature.motionEvents.length > 0 && (
        <div className="motion-event-row">
          {signature.motionEvents.map((event) => (
            <span key={`${event.type}-${event.t}`}>
              {motionEvent(event.type, event.label)} · {Math.round(event.t * 100)}%
            </span>
          ))}
        </div>
      )}
      <div className="style-picker">
        <span>{t('common.style')}</span>
        {styles.map((item) => (
          <button key={item} type="button" data-active={style === item} onClick={() => onStyle(item)}>
            {styleLabel(item)}
          </button>
        ))}
      </div>
      {quickMode ? (
        <div className="quick-meta-form">
          <div className="quick-meta-head">
            <span>{t('motion.finishCard')}</span>
            <h2>{t('motion.nameSend')}</h2>
          </div>
          <label>
            <span>{t('projectForm.projectName')}</span>
            <input
              value={quickDraft.displayName}
              onChange={(event) => updateQuick('displayName', event.target.value)}
              placeholder="CONCRETE TRAVERSE"
              autoFocus
            />
          </label>
          <div className="field-grid">
            <label>
              <span>{t('motion.gymOptional')}</span>
              <input
                value={quickDraft.gymName}
                onChange={(event) => updateQuick('gymName', event.target.value)}
                placeholder="THE CLIMB · SEONGSU"
              />
            </label>
            <label>
              <span>{t('motion.wallOptional')}</span>
              <input
                value={quickDraft.wallName}
                onChange={(event) => updateQuick('wallName', event.target.value)}
                placeholder="WALL 03"
              />
            </label>
          </div>
          <label className="grade-input-label">
            <span>{t('common.grade')}</span>
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
              {t('common.manualFix')}
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
              {t('common.buildCard')}
            </KButton>
          </div>
        </div>
      ) : (
        <div className="ready-actions">
          <KButton variant="ghost" icon="pencil" onClick={onManual}>
            {t('common.manualCorrection')}
          </KButton>
          <KButton icon="arrow-right" onClick={onComplete}>
            {t('motion.saveBuildCard')}
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
  const { t } = useI18n();
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
        <span>{t('common.frames', { count: signature.frameCount })}</span>
        <strong>{project?.displayName || t('common.sendVideo')}</strong>
        <p>
          {project ? `${project.gymName} / ${project.wallName} / ${project.grade}` : signature.videoName}
        </p>
      </div>
    </div>
  );
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

function detectMotionEvents(
  points: MotionPoint[],
  completionStatus: MotionSignatureData['completionStatus'] = 'unknown',
  fallAt?: number,
  environment: ClimbEnvironment = 'indoor',
): MotionEvent[] {
  if (points.length === 0) return [];
  const velocities = points.map((point, index) => {
    if (index === 0) return 0;
    const prev = points[index - 1];
    return Math.hypot(point.x - prev.x, point.y - prev.y);
  });
  const cruxIndex = velocities.reduce((best, value, index) => (value > velocities[best] ? index : best), 0);
  const highpoint = points.reduce((best, point, index) => (point.y < points[best].y ? index : best), 0);
  const finishEvent: MotionEvent =
    completionStatus === 'fall'
      ? {
          type: 'fall',
          t: fallAt ?? points[Math.min(points.length - 1, highpoint + 1)]?.t ?? 1,
          label: 'FALL',
          confidence: 0.7,
        }
      : completionStatus === 'send'
        ? {
            type: 'match',
            t: points[highpoint]?.t ?? 1,
            label: 'MATCH',
            confidence: points[highpoint]?.confidence ?? 0.72,
          }
        : {
            type: 'topout',
            t: points[highpoint]?.t ?? 1,
            label: environment === 'outdoor' ? 'TOP OUT' : 'HIGHPOINT',
            confidence: points[highpoint]?.confidence ?? 0.7,
          };

  return [
    { type: 'start', t: points[0].t, label: 'START', confidence: points[0].confidence ?? 1 },
    {
      type: points[cruxIndex]?.dyno ? 'dyno' : 'crux',
      t: points[cruxIndex]?.t ?? 0.5,
      label: points[cruxIndex]?.dyno ? 'DYNO / POWER MOVE' : 'CRUX',
      confidence: points[cruxIndex]?.confidence ?? 0.7,
    },
    finishEvent,
  ];
}
