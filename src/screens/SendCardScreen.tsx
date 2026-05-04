import { useEffect, useMemo, useRef, useState } from 'react';
import { SendCardPreview } from '../components/SendCardPreview';
import { EmptyState, Icon, KButton } from '../components/UI';
import { useI18n } from '../lib/i18n';
import { exportElementAsPng, exportElementAsVideo } from '../lib/sendCard/exportImage';
import type {
  MotionSignatureData,
  MotionSignatureStyle,
  Project,
  SendCard,
  SendCardBackgroundMode,
  SendCardFormat,
  SendCardLayout,
  SendCardTextTone,
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
  const { t, language, source, format: formatLabel, background, layout: layoutLabel, style: styleLabel, textTone: textToneLabel } = useI18n();
  const sentProjects = projects.filter((project) => project.status === 'sent');
  const selectableProjects = sentProjects.length ? sentProjects : projects;
  const [projectId, setProjectId] = useState(initialProject?.id || selectableProjects[0]?.id || '');
  const project = projects.find((item) => item.id === projectId);
  const projectSignatures = signatures.filter((signature) => signature.projectId === projectId);
  const firstSignature = initialSignature?.projectId === projectId ? initialSignature : projectSignatures[0];
  const [signatureId, setSignatureId] = useState(firstSignature?.id || '');
  const storedSignature = signatures.find((item) => item.id === signatureId);
  const signature = initialSignature?.id === signatureId ? initialSignature : storedSignature || firstSignature;
  const [format, setFormat] = useState<SendCardFormat>('square');
  const [layout, setLayout] = useState<SendCardLayout>('hero');
  const [style, setStyle] = useState<MotionSignatureStyle>(signature?.style || 'data');
  const defaultReflection = language === 'ko' ? t('send.defaultReflectionKo') : t('send.defaultReflection');
  const defaultReflectionRef = useRef(defaultReflection);
  const [reflection, setReflection] = useState(defaultReflection);
  const [backgroundMode, setBackgroundMode] = useState<SendCardBackgroundMode>(preferredBackgroundMode(signature));
  const [textTone, setTextTone] = useState<SendCardTextTone>('light');
  const [customBackgroundDataUrl, setCustomBackgroundDataUrl] = useState('');
  const [exporting, setExporting] = useState(false);
  const [videoExporting, setVideoExporting] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoStatus, setVideoStatus] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setReflection((current) => (current === defaultReflectionRef.current ? defaultReflection : current));
    defaultReflectionRef.current = defaultReflection;
  }, [defaultReflection]);

  const availableSignatures = useMemo(() => {
    if (!project) return [];
    const projectItems = signatures.filter((item) => item.projectId === project.id);
    if (!initialSignature || initialSignature.projectId !== project.id) return projectItems;
    if (projectItems.some((item) => item.id === initialSignature.id)) return projectItems;
    return [initialSignature, ...projectItems];
  }, [initialSignature, project, signatures]);

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
      textTone,
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
      await exportElementAsPng(cardRef.current, `klym-${fileSlug()}-${format}.png`, format);
    } finally {
      setExporting(false);
    }
  }

  async function exportVideo() {
    if (!cardRef.current || !project || !signature) return;
    setVideoExporting(true);
    setVideoProgress(0);
    setVideoStatus(t('send.preparing'));
    persistCard();
    try {
      const result = await exportElementAsVideo({
        element: cardRef.current,
        signature,
        format,
        fileName: `klym-${fileSlug()}-${format}.mp4`,
        backgroundVideoUrl: backgroundMode === 'video' ? getSignatureVideoUrl(signature) : '',
        textTone,
        style,
        onProgress: (phase, progress) => {
          setVideoProgress(progress);
          setVideoStatus(phase === 'preparing' ? t('send.preparing') : phase === 'recording' ? t('send.recording') : t('send.encoding'));
        },
      });
      setVideoStatus(
        result.delivery === 'shared'
          ? t('send.shared')
          : t('send.saved', { type: result.fileName.split('.').pop()?.toUpperCase() || 'VIDEO' }),
      );
    } catch (error) {
      console.error(error);
      setVideoStatus(error instanceof Error ? error.message : t('send.exportFailed'));
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
          {t('common.back')}
        </button>
        <span>{t('send.header')}</span>
      </div>

      <div className="send-builder">
        <div className="send-builder-head">
          <h1>{t('send.title')}</h1>
          <p>{t('send.body')}</p>
        </div>

        {!project ? (
          <EmptyState title={t('send.noProjectTitle')} body={t('send.noProjectBody')} />
        ) : !signature ? (
          <EmptyState
            title={t('send.noSignatureTitle')}
            body={t('send.noSignatureBody')}
            action={<KButton icon="upload" onClick={() => onMotion(project)}>{t('send.generateSignature')}</KButton>}
          />
        ) : (
          <>
            <div className="builder-controls">
              <label>
                <span>{t('common.project')}</span>
                <select
                  value={projectId}
                  onChange={(event) => {
                    setProjectId(event.target.value);
                    const nextSignature =
                      initialSignature?.projectId === event.target.value
                        ? initialSignature
                        : signatures.find((item) => item.projectId === event.target.value);
                    setSignatureId(nextSignature?.id || '');
                    if (nextSignature) setStyle(nextSignature.style);
                    setBackgroundMode(preferredBackgroundMode(nextSignature));
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
                <span>{t('common.signature')}</span>
                <select
                  value={signature.id}
                  onChange={(event) => {
                    setSignatureId(event.target.value);
                    const next =
                      initialSignature?.id === event.target.value
                        ? initialSignature
                        : signatures.find((item) => item.id === event.target.value);
                    if (next) {
                      setStyle(next.style);
                      setBackgroundMode(preferredBackgroundMode(next));
                    }
                  }}
                >
                  {availableSignatures.map((item) => (
                    <option key={item.id} value={item.id}>
                      {source(item.sourceType)} · {Math.round(item.confidenceScore * 100)}% · {new Date(item.createdAt).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="segmented-row segmented-row-tri">
              {(['square', 'feed-tall', 'story'] as const).map((item) => (
                <button key={item} type="button" data-active={format === item} onClick={() => setFormat(item)}>
                  {formatLabel(item)}
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
                textTone={textTone}
              />
            </div>

            <div className="builder-controls">
              <label>
                <span>{t('send.reflection')}</span>
                <textarea value={reflection} onChange={(event) => setReflection(event.target.value)} maxLength={84} rows={2} />
              </label>
            </div>

            <div className="chip-scroll">
              {(['video', 'video-frames', 'signature', 'photo'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  data-active={backgroundMode === item}
                  disabled={
                    (item === 'video' && !getSignatureVideoUrl(signature)) ||
                    (item === 'video-frames' && !signature.backgroundFrameDataUrls?.length)
                  }
                  onClick={() => setBackgroundMode(item)}
                >
                  {background(item)}
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
                <span>{customBackgroundDataUrl ? t('send.photoLoaded') : t('send.selectAlbumPhoto')}</span>
              </label>
            )}

            <div className="chip-scroll">
              {(['hero', 'blueprint', 'poster'] as const).map((item) => (
                <button key={item} type="button" data-active={layout === item} onClick={() => setLayout(item)}>
                  {layoutLabel(item)}
                </button>
              ))}
            </div>

            <div className="chip-scroll">
              {(['dynamic', 'refined', 'editorial', 'data'] as const).map((item) => (
                <button key={item} type="button" data-active={style === item} onClick={() => setStyle(item)}>
                  {styleLabel(item)}
                </button>
              ))}
            </div>

            <div className="chip-scroll chip-scroll-compact">
              {(['light', 'dark'] as const).map((item) => (
                <button key={item} type="button" data-active={textTone === item} onClick={() => setTextTone(item)}>
                  {textToneLabel(item)}
                </button>
              ))}
            </div>

            <div className="export-actions">
              <KButton variant="ghost" icon="download" onClick={exportCard} disabled={exporting || videoExporting}>
                {exporting ? t('send.exporting') : t('send.exportPng')}
              </KButton>
              <KButton icon="video" onClick={exportVideo} disabled={exporting || videoExporting}>
                {videoExporting ? t('send.capturing') : t('send.saveVideo')}
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

function getSignatureVideoUrl(signature?: MotionSignatureData) {
  return signature?.sourceVideoUrl || signature?.videoDataUrl || '';
}

function preferredBackgroundMode(signature?: MotionSignatureData): SendCardBackgroundMode {
  if (getSignatureVideoUrl(signature)) return 'video';
  if (signature?.backgroundFrameDataUrls?.length) return 'video-frames';
  return 'signature';
}
