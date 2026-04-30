import { useMemo, useRef, useState } from 'react';
import { SendCardPreview } from '../components/SendCardPreview';
import { EmptyState, Icon, KButton } from '../components/UI';
import { exportElementAsPng, exportElementAsVideo } from '../lib/sendCard/exportImage';
import type {
  MotionSignatureData,
  MotionSignatureStyle,
  Project,
  SendCard,
  SendCardBackgroundMode,
  SendCardFormat,
  SendCardLayout,
} from '../types/klym';

interface SendCardScreenProps {
  projects: Project[];
  signatures: MotionSignatureData[];
  initialProject?: Project;
  initialSignature?: MotionSignatureData;
  onBack: () => void;
  onMotion: (project?: Project) => void;
  onSaveCard: (card: Omit<SendCard, 'id' | 'createdAt'>) => void;
}

export function SendCardScreen({
  projects,
  signatures,
  initialProject,
  initialSignature,
  onBack,
  onMotion,
  onSaveCard,
}: SendCardScreenProps) {
  const sentProjects = projects.filter((project) => project.status === 'sent');
  const selectableProjects = sentProjects.length ? sentProjects : projects;
  const [projectId, setProjectId] = useState(initialProject?.id || selectableProjects[0]?.id || '');
  const project = projects.find((item) => item.id === projectId);
  const projectSignatures = signatures.filter((signature) => signature.projectId === projectId);
  const firstSignature = initialSignature?.projectId === projectId ? initialSignature : projectSignatures[0];
  const [signatureId, setSignatureId] = useState(firstSignature?.id || '');
  const signature = signatures.find((item) => item.id === signatureId) || firstSignature;
  const [format, setFormat] = useState<SendCardFormat>('square');
  const [layout, setLayout] = useState<SendCardLayout>('hero');
  const [style, setStyle] = useState<MotionSignatureStyle>(signature?.style || 'data');
  const [reflection, setReflection] = useState('Held the swing. Kept the line.');
  const [backgroundMode, setBackgroundMode] = useState<SendCardBackgroundMode>(
    signature?.backgroundFrameDataUrls?.length ? 'video-frames' : 'signature',
  );
  const [customBackgroundDataUrl, setCustomBackgroundDataUrl] = useState('');
  const [exporting, setExporting] = useState(false);
  const [videoExporting, setVideoExporting] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoStatus, setVideoStatus] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);

  const availableSignatures = useMemo(() => {
    if (!project) return [];
    return signatures.filter((item) => item.projectId === project.id);
  }, [project, signatures]);

  function persistCard() {
    if (!project || !signature) return;
    onSaveCard({
      projectId: project.id,
      signatureId: signature.id,
      format,
      layout,
      style,
      reflection,
      backgroundMode,
      customBackgroundDataUrl: backgroundMode === 'photo' ? customBackgroundDataUrl : undefined,
    });
  }

  function fileSlug() {
    return project ? project.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'klym';
  }

  async function exportCard() {
    if (!cardRef.current || !project || !signature) return;
    setExporting(true);
    persistCard();
    try {
      await exportElementAsPng(cardRef.current, `klym-${fileSlug()}-${format}.png`);
    } finally {
      setExporting(false);
    }
  }

  async function exportVideo() {
    if (!cardRef.current || !project || !signature) return;
    setVideoExporting(true);
    setVideoProgress(0);
    setVideoStatus('PREPARING');
    persistCard();
    try {
      await exportElementAsVideo({
        element: cardRef.current,
        signature,
        format,
        fileName: `klym-${fileSlug()}-${format}.webm`,
        onProgress: (phase, progress) => {
          setVideoProgress(progress);
          setVideoStatus(phase === 'preparing' ? 'PREPARING' : phase === 'recording' ? 'RECORDING' : 'ENCODING');
        },
      });
      setVideoStatus('SAVED');
    } catch (error) {
      console.error(error);
      setVideoStatus(error instanceof Error ? error.message.toUpperCase() : 'EXPORT FAILED');
    } finally {
      setVideoExporting(false);
      window.setTimeout(() => {
        setVideoStatus('');
        setVideoProgress(0);
      }, 2400);
    }
  }

  return (
    <section className="screen send-card-screen">
      <div className="motion-top">
        <button type="button" onClick={onBack}>
          <Icon name="arrow-left" size={16} />
          BACK
        </button>
        <span>SEND CARD / EXPORT</span>
      </div>

      <div className="send-builder">
        <div className="send-builder-head">
          <h1>SEND CARD</h1>
          <p>Built for feed covers, stories, and a premium send archive.</p>
        </div>

        {!project ? (
          <EmptyState title="NO SENT PROJECTS" body="Mark a project as sent and generate a Motion Signature first." />
        ) : !signature ? (
          <EmptyState
            title="NO MOTION SIGNATURE"
            body="This project needs a saved video-derived Motion Signature before export."
            action={<KButton icon="upload" onClick={() => onMotion(project)}>GENERATE SIGNATURE</KButton>}
          />
        ) : (
          <>
            <div className="builder-controls">
              <label>
                <span>PROJECT</span>
                <select
                  value={projectId}
                  onChange={(event) => {
                    setProjectId(event.target.value);
                    const nextSignature = signatures.find((item) => item.projectId === event.target.value);
                    setSignatureId(nextSignature?.id || '');
                    if (nextSignature) setStyle(nextSignature.style);
                    setBackgroundMode(nextSignature?.backgroundFrameDataUrls?.length ? 'video-frames' : 'signature');
                  }}
                >
                  {selectableProjects.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.displayName} · {item.grade}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>SIGNATURE</span>
                <select
                  value={signature.id}
                  onChange={(event) => {
                    setSignatureId(event.target.value);
                    const next = signatures.find((item) => item.id === event.target.value);
                    if (next) {
                      setStyle(next.style);
                      setBackgroundMode(next.backgroundFrameDataUrls?.length ? 'video-frames' : 'signature');
                    }
                  }}
                >
                  {availableSignatures.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sourceType.toUpperCase()} · {Math.round(item.confidenceScore * 100)}% · {new Date(item.createdAt).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="segmented-row">
              {(['square', 'story'] as const).map((item) => (
                <button key={item} type="button" data-active={format === item} onClick={() => setFormat(item)}>
                  {item === 'square' ? 'FEED 1:1' : 'STORY 9:16'}
                </button>
              ))}
            </div>

            <div className="card-preview-wrap">
              <SendCardPreview
                ref={cardRef}
                project={project}
                signature={signature}
                format={format}
                layout={layout}
                style={style}
                reflection={reflection}
                backgroundMode={backgroundMode}
                customBackgroundDataUrl={customBackgroundDataUrl}
              />
            </div>

            <div className="builder-controls">
              <label>
                <span>REFLECTION</span>
                <textarea value={reflection} onChange={(event) => setReflection(event.target.value)} maxLength={84} rows={2} />
              </label>
            </div>

            <div className="chip-scroll">
              {(['signature', 'video-frames', 'photo'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  data-active={backgroundMode === item}
                  disabled={item === 'video-frames' && !signature.backgroundFrameDataUrls?.length}
                  onClick={() => setBackgroundMode(item)}
                >
                  {item === 'signature' ? 'GRAPHIC BG' : item === 'video-frames' ? 'VIDEO CUTS' : 'PHOTO BG'}
                </button>
              ))}
            </div>

            {backgroundMode === 'photo' && (
              <label className="photo-background-input">
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setCustomBackgroundDataUrl(await readImageAsDataUrl(file));
                  }}
                />
                <span>{customBackgroundDataUrl ? 'PHOTO BACKGROUND LOADED' : 'SELECT ALBUM PHOTO'}</span>
              </label>
            )}

            <div className="chip-scroll">
              {(['hero', 'blueprint', 'poster'] as const).map((item) => (
                <button key={item} type="button" data-active={layout === item} onClick={() => setLayout(item)}>
                  {item.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="chip-scroll">
              {(['dynamic', 'refined', 'editorial', 'data'] as const).map((item) => (
                <button key={item} type="button" data-active={style === item} onClick={() => setStyle(item)}>
                  {item.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="export-actions">
              <KButton variant="ghost" icon="download" onClick={exportCard} disabled={exporting || videoExporting}>
                {exporting ? 'EXPORTING' : 'EXPORT PNG'}
              </KButton>
              <KButton icon="video" onClick={exportVideo} disabled={exporting || videoExporting}>
                {videoExporting ? 'CAPTURING' : 'EXPORT VIDEO'}
              </KButton>
            </div>
            {(videoExporting || videoStatus) && (
              <div className="video-export-status">
                <div className="video-export-status-row">
                  <span>{videoStatus}</span>
                  <b>{Math.round(videoProgress * 100)}%</b>
                </div>
                <div className="video-export-bar">
                  <i style={{ width: `${Math.round(videoProgress * 100)}%` }} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function readImageAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Image could not be loaded.'));
    reader.readAsDataURL(file);
  });
}
