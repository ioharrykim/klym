import { Eyebrow, Icon, ScreenHeader, StatBlock } from '../components/UI';
import type { Attempt, Project, SendCard } from '../types/klym';

export function SessionsScreen({ attempts, projects }: { attempts: Attempt[]; projects: Project[] }) {
  return (
    <section className="screen scroll-screen with-tabs">
      <ScreenHeader title="SESSIONS" subtitle={`${attempts.length} LOGGED EVENTS`} />
      <Eyebrow>RECENT ATTEMPTS</Eyebrow>
      <div className="activity-list section-pad">
        {attempts.map((attempt) => {
          const project = projects.find((item) => item.id === attempt.projectId);
          return (
            <div key={attempt.id} className="activity-row">
              <span>{attempt.date.slice(5)}</span>
              <div>
                <b>{attempt.result.toUpperCase()}</b>
                <strong>{project?.displayName || 'PROJECT'}</strong>
                <p>{attempt.attemptCount} tries · {attempt.notes}</p>
              </div>
            </div>
          );
        })}
      </div>
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
  const sent = projects.filter((project) => project.status === 'sent').length;
  return (
    <section className="screen scroll-screen with-tabs">
      <ScreenHeader title="PROFILE" subtitle="@klym.local · THE CLIMB · SEONGSU" />
      <div className="profile-card">
        <div className="profile-mark">KL</div>
        <div>
          <h2>KLYM LOCAL</h2>
          <p>Keep Lines, Your Move.</p>
        </div>
      </div>
      <div className="stats-strip">
        <StatBlock label="PROJECTS" value={projects.length} />
        <StatBlock label="SENDS" value={sent} />
        <StatBlock label="CARDS" value={sendCards.length} />
      </div>
      <Eyebrow>LOCAL DATA</Eyebrow>
      <div className="settings-list">
        <div>
          <span>Persistence</span>
          <b>localStorage</b>
        </div>
        <div>
          <span>Video files</span>
          <b>Not stored</b>
        </div>
        <div>
          <span>Export</span>
          <b>
            <Icon name="download" size={14} /> PNG
          </b>
        </div>
      </div>
    </section>
  );
}
