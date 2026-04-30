import { MotionSignature } from '../components/MotionSignature';
import { EmptyState, Eyebrow, GradeChip, Icon, KButton, StatBlock, StatusPill } from '../components/UI';
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
}: DashboardScreenProps) {
  const focus = stats.focusProject;

  if (projects.length === 0) {
    return (
      <section className="screen scroll-screen with-tabs first-run-screen">
        <header className="dashboard-top">
          <div>
            <strong>KLYM</strong>
            <span>KEEP LINES, YOUR MOVE</span>
          </div>
          <button className="square-icon" type="button" onClick={onProjects} aria-label="Create first project">
            <Icon name="plus" />
          </button>
        </header>

        <div className="first-run-hero">
          <div className="first-run-signature">
            <MotionSignature seed={4371} style={style} animate showGrid />
          </div>
          <span>KLYM // LOCAL-FIRST PROJECT LOG</span>
          <h1>
            START WITH
            <br />
            YOUR FIRST LINE.
          </h1>
          <p>
            Create a climbing project, log attempts, mark the send, then turn your send video into a Motion Signature and export a premium card.
          </p>
          <div className="first-run-actions">
            <KButton icon="plus" onClick={onProjects}>
              CREATE PROJECT
            </KButton>
            <KButton variant="ghost" icon="upload" onClick={onProjects}>
              UPLOAD AFTER PROJECT
            </KButton>
          </div>
        </div>

        <div className="first-run-steps">
          {[
            ['01', 'PROJECT', 'Gym, grade, wall, notes, and beta.'],
            ['02', 'ATTEMPTS', 'Track tries and refine the next move.'],
            ['03', 'SEND VIDEO', 'Generate a pose-based Motion Signature.'],
            ['04', 'SEND CARD', 'Export a premium visual record.'],
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
          <span>{new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }).format(new Date())}</span>
        </div>
        <button className="square-icon" type="button" onClick={() => onMotion(focus)}>
          <Icon name="bolt" />
        </button>
      </header>

      <div className="dashboard-copy">
        <h1>WHAT LINE WILL YOU DRAW?</h1>
        <p>{projects.length} lines stored locally · {attempts.length} attempt logs</p>
      </div>

      {focus ? (
        <div className="section-pad">
          <Eyebrow>TODAY&apos;S FOCUS</Eyebrow>
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
              <span>BETA · {focus.attemptsCount} ATTEMPTS</span>
            </div>
            <div className="focus-info">
              <div className="card-chip-row">
                <GradeChip grade={focus.grade} />
                <StatusPill status={focus.status} />
              </div>
              <h2>{focus.localName || focus.displayName}</h2>
              <p>{focus.gymName} / {focus.wallName}</p>
              <div className="stat-row">
                <StatBlock label="ATTEMPTS" value={focus.attemptsCount} />
                <StatBlock label="DAYS" value={projectDays(focus)} />
              </div>
            </div>
            <div className="focus-action">
              CONTINUE PROJECT
              <Icon name="arrow-right" size={14} />
            </div>
          </button>
        </div>
      ) : (
        <EmptyState
          title="NO PROJECTS YET"
          body="Create your first line and KLYM will start tracking the work."
          action={<KButton icon="plus" onClick={onProjects}>CREATE PROJECT</KButton>}
        />
      )}

      <div className="quick-actions">
        <button type="button" onClick={() => onMotion(focus)}>
          <Icon name="upload" />
          <strong>UPLOAD SEND</strong>
          <span>MOTION SIGNATURE</span>
        </button>
        <button type="button" onClick={onProjects}>
          <Icon name="plus" />
          <strong>ADD PROJECT</strong>
          <span>NEW LINE</span>
        </button>
      </div>

      <div className="stats-strip">
        <StatBlock label="OPEN" value={stats.openCount} />
        <StatBlock label="CLOSE" value={stats.closeCount} />
        <StatBlock label="SENT" value={stats.sentCount} />
        <StatBlock label="TRIES" value={stats.attempts30d} />
      </div>

      <Eyebrow right={<button className="link-button" type="button" onClick={onProjects}>VIEW ALL</button>}>RECENT SENDS</Eyebrow>
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

      <Eyebrow>RECENT ACTIVITY</Eyebrow>
      <div className="activity-list">
        {stats.recentAttempts.map((attempt) => {
          const project = projects.find((item) => item.id === attempt.projectId);
          return (
            <div key={attempt.id} className="activity-row">
              <span>{attempt.date.slice(5)}</span>
              <div>
                <b>{attempt.result.toUpperCase()}</b>
                <strong>{project?.displayName || 'PROJECT'}</strong>
                <p>{attempt.notes || `${attempt.attemptCount} attempts logged`}</p>
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
