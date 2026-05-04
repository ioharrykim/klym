import { MotionSignature } from '../components/MotionSignature';
import { EmptyState, Eyebrow, GradeChip, Icon, KButton, StatBlock, StatusPill } from '../components/UI';
import { useI18n } from '../lib/i18n';
import type { Attempt, MotionSignatureData, MotionSignatureStyle, Project } from '../types/klym';

interface DashboardScreenProps {
  projects: Project[];
  attempts: Attempt[];
  stats: {
    openCount: number;
    closeCount: number;
    sentCount: number;
    attempts30d: number;
    recentAttempts: Attempt[];
    recentSends: Project[];
    focusProject?: Project;
  };
  signaturesByProject: Map<string, MotionSignatureData>;
  style: MotionSignatureStyle;
  onProject: (project: Project) => void;
  onProjects: () => void;
  onMotion: (project?: Project) => void;
  onQuickSend: () => void;
}

export function DashboardScreen({
  projects,
  attempts,
  stats,
  signaturesByProject,
  style,
  onProject,
  onProjects,
  onMotion,
  onQuickSend,
}: DashboardScreenProps) {
  const { t, locale, status, attemptResult } = useI18n();
  const focus = stats.focusProject;
  const dateLabel = new Intl.DateTimeFormat(locale, { month: '2-digit', day: '2-digit', year: '2-digit' }).format(new Date());

  if (projects.length === 0) {
    return (
      <section className="screen scroll-screen with-tabs first-run-screen">
        <header className="dashboard-top">
          <div>
            <strong>KLYM</strong>
            <span>{t('app.tagline')}</span>
          </div>
          <button className="square-icon" type="button" onClick={onProjects} aria-label={t('projects.create')}>
            <Icon name="plus" />
          </button>
        </header>

        <div className="first-run-hero">
          <div className="first-run-signature">
            <MotionSignature seed={4371} style={style} animate showGrid />
          </div>
          <span>{t('dashboard.firstRunKicker')}</span>
          <h1>{t('dashboard.firstRunTitle')}</h1>
          <p>{t('dashboard.firstRunBody')}</p>
          <div className="first-run-actions">
            <KButton icon="upload" onClick={onQuickSend}>
              {t('dashboard.quickSend')}
            </KButton>
            <KButton variant="ghost" icon="plus" onClick={onProjects}>
              {t('dashboard.fullProjectLog')}
            </KButton>
          </div>
        </div>

        <div className="first-run-steps">
          {[
            ['01', t('dashboard.step1Title'), t('dashboard.step1Body')],
            ['02', t('dashboard.step2Title'), t('dashboard.step2Body')],
            ['03', t('dashboard.step3Title'), t('dashboard.step3Body')],
            ['04', t('dashboard.step4Title'), t('dashboard.step4Body')],
          ].map(([index, title, body]) => (
            <div key={index}>
              <span>{index}</span>
              <strong>{title}</strong>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="screen scroll-screen with-tabs">
      <header className="dashboard-top">
        <div>
          <strong>KLYM</strong>
          <span>{dateLabel}</span>
        </div>
        <button className="square-icon" type="button" onClick={() => onMotion(focus)}>
          <Icon name="bolt" />
        </button>
      </header>

      <div className="dashboard-copy">
        <h1>{t('dashboard.title')}</h1>
        <p>{t('dashboard.localSummary', { projects: projects.length, attempts: attempts.length })}</p>
      </div>

      <button type="button" className="quick-send-hero" onClick={onQuickSend}>
        <div className="quick-send-hero-signature">
          <MotionSignature seed={9183} style={style} animate showGrid={false} strokeScale={0.9} />
        </div>
        <div className="quick-send-hero-copy">
          <span>{t('dashboard.quickSend')}</span>
          <strong>{t('dashboard.quickHeroTitle')}</strong>
          <p>{t('dashboard.quickHeroBody')}</p>
        </div>
        <div className="quick-send-hero-cta">
          <Icon name="upload" size={14} />
          {t('common.start')}
        </div>
      </button>

      {focus ? (
        <div className="section-pad">
          <Eyebrow>{t('dashboard.focus')}</Eyebrow>
          <button className="focus-card" type="button" onClick={() => onProject(focus)}>
            <div className="focus-signature">
              <MotionSignature
                data={signaturesByProject.get(focus.id)}
                seed={focus.seed}
                style={signaturesByProject.get(focus.id)?.style || style}
                showGrid={false}
                animate={false}
                strokeScale={0.72}
              />
              <span>{t('dashboard.betaAttempts', { count: focus.attemptsCount })}</span>
            </div>
            <div className="focus-info">
              <div className="card-chip-row">
                <GradeChip grade={focus.grade} color={focus.gradeColor} />
                <StatusPill status={focus.status} />
              </div>
              <h2>{focus.localName || focus.displayName}</h2>
              {focus.localName && <small className="line-alias">{focus.displayName}</small>}
              <p>{focus.gymName} / {focus.wallName}</p>
              <div className="stat-row">
                <StatBlock label={t('common.attempts')} value={focus.attemptsCount} />
                <StatBlock label={t('common.days')} value={projectDays(focus)} />
              </div>
            </div>
            <div className="focus-action">
              {t('dashboard.continueProject')}
              <Icon name="arrow-right" size={14} />
            </div>
          </button>
        </div>
      ) : (
        <EmptyState
          title={t('dashboard.noProjectsTitle')}
          body={t('dashboard.noProjectsBody')}
          action={<KButton icon="plus" onClick={onProjects}>{t('common.createProject')}</KButton>}
        />
      )}

      <div className="quick-actions">
        <button type="button" onClick={() => onMotion(focus)}>
          <Icon name="upload" />
          <strong>{t('dashboard.uploadToProject')}</strong>
          <span>{t('dashboard.attachSignature')}</span>
        </button>
        <button type="button" onClick={onProjects}>
          <Icon name="plus" />
          <strong>{t('dashboard.addProject')}</strong>
          <span>{t('dashboard.newLine')}</span>
        </button>
      </div>

      <div className="stats-strip">
        <StatBlock label={t('common.open')} value={stats.openCount} />
        <StatBlock label={status('close')} value={stats.closeCount} />
        <StatBlock label={t('common.sent')} value={stats.sentCount} />
        <StatBlock label={t('common.tries')} value={stats.attempts30d} />
      </div>

      <Eyebrow right={<button className="link-button" type="button" onClick={onProjects}>{t('common.viewAll')}</button>}>{t('dashboard.recentSends')}</Eyebrow>
      <div className="signature-row">
        {(stats.recentSends.length ? stats.recentSends : projects.slice(0, 4)).map((project) => {
          const signature = signaturesByProject.get(project.id);
          return (
            <button key={project.id} type="button" onClick={() => onProject(project)} className="mini-send">
              <div>
                <MotionSignature data={signature} seed={project.seed} style={signature?.style || style} showGrid={false} strokeScale={0.6} />
              </div>
              <strong>{project.displayName}</strong>
              <span>{project.grade} · {shortGym(project.gymName)}</span>
            </button>
          );
        })}
      </div>

      <Eyebrow>{t('dashboard.recentActivity')}</Eyebrow>
      <div className="activity-list">
        {stats.recentAttempts.map((attempt) => {
          const project = projects.find((item) => item.id === attempt.projectId);
          return (
            <div key={attempt.id} className="activity-row">
              <span>{attempt.date.slice(5)}</span>
              <div>
                <b>{attemptResult(attempt.result)}</b>
                <strong>{project?.displayName || t('common.project')}</strong>
                <p>{attempt.notes || t('dashboard.attemptsLogged', { count: attempt.attemptCount })}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function shortGym(gym: string) {
  return gym.split('·').pop()?.trim() || gym;
}

function projectDays(project: Project) {
  const start = new Date(project.createdAt).getTime();
  const end = new Date(project.sentAt || project.updatedAt).getTime();
  return Math.max(1, Math.ceil((end - start) / 86400000));
}
