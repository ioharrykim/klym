import { Eyebrow, Icon, LanguageSwitch, ScreenHeader, StatBlock } from '../components/UI';
import { useI18n } from '../lib/i18n';
import type { Attempt, Project, SendCard } from '../types/klym';

export function SessionsScreen({ attempts, projects }: { attempts: Attempt[]; projects: Project[] }) {
  const { t, attemptResult } = useI18n();

  return (
    <section className="screen scroll-screen with-tabs">
      <ScreenHeader title={t('sessions.title')} subtitle={t('sessions.subtitle', { count: attempts.length })} />
      <Eyebrow>{t('sessions.recentAttempts')}</Eyebrow>
      {attempts.length === 0 ? (
        <div className="empty-inline section-pad">
          <b>{t('sessions.emptyTitle')}</b>
          <p>{t('sessions.emptyBody')}</p>
        </div>
      ) : (
        <div className="activity-list section-pad">
          {attempts.map((attempt) => {
            const project = projects.find((item) => item.id === attempt.projectId);
            return (
              <div key={attempt.id} className="activity-row">
                <span>{attempt.date.slice(5)}</span>
                <div>
                  <b>{attemptResult(attempt.result)}</b>
                  <strong>{project?.displayName || t('common.project')}</strong>
                  <p>{attempt.attemptCount} {t('common.tries')} · {attempt.notes || t('projectDetail.noAttemptNotes')}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function ProfileScreen({
  projects,
  sendCards,
}: {
  projects: Project[];
  sendCards: SendCard[];
}) {
  const { t } = useI18n();
  const sent = projects.filter((project) => project.status === 'sent').length;
  return (
    <section className="screen scroll-screen with-tabs">
      <ScreenHeader title={t('profile.title')} subtitle={t('profile.subtitle')} />
      <div className="profile-card">
        <div className="profile-mark">KL</div>
        <div>
          <h2>{t('profile.name')}</h2>
          <p>{t('profile.tagline')}</p>
        </div>
      </div>
      <div className="stats-strip">
        <StatBlock label={t('profile.projects')} value={projects.length} />
        <StatBlock label={t('profile.sends')} value={sent} />
        <StatBlock label={t('common.cards')} value={sendCards.length} />
      </div>
      <Eyebrow>{t('common.localData')}</Eyebrow>
      <div className="settings-list">
        <div>
          <span>{t('profile.language')}</span>
          <LanguageSwitch className="settings-language-switch" />
        </div>
        <div>
          <span>{t('common.persistence')}</span>
          <b>localStorage</b>
        </div>
        <div>
          <span>{t('common.videoFiles')}</span>
          <b>{t('profile.videoFilesValue')}</b>
        </div>
        <div>
          <span>{t('common.export')}</span>
          <b>
            <Icon name="download" size={14} /> PNG / MP4
          </b>
        </div>
      </div>
    </section>
  );
}
