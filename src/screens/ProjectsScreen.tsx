import { useMemo, useState } from 'react';
import { MotionSignature } from '../components/MotionSignature';
import { ProjectForm } from '../components/ProjectForm';
import { EmptyState, GradeChip, Icon, KButton, ScreenHeader, StatusPill } from '../components/UI';
import { useI18n } from '../lib/i18n';
import type { MotionSignatureData, MotionSignatureStyle, Project, ProjectDraft, ProjectStatus } from '../types/klym';

interface ProjectsScreenProps {
  projects: Project[];
  signaturesByProject: Map<string, MotionSignatureData>;
  style: MotionSignatureStyle;
  onProject: (project: Project) => void;
  onCreateProject: (draft: ProjectDraft) => Project;
}

export function ProjectsScreen({ projects, signaturesByProject, style, onProject, onCreateProject }: ProjectsScreenProps) {
  const { t, status: statusLabel } = useI18n();
  const [status, setStatus] = useState<ProjectStatus | 'all'>('all');
  const [gym, setGym] = useState('all');
  const [grade, setGrade] = useState('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [creating, setCreating] = useState(false);

  const gyms = useMemo(() => Array.from(new Set(projects.map((project) => project.gymName))).sort(), [projects]);
  const grades = useMemo(() => Array.from(new Set(projects.map((project) => project.grade))).sort(gradeSort), [projects]);
  const filtered = projects.filter((project) => {
    if (status !== 'all' && project.status !== status) return false;
    if (gym !== 'all' && project.gymName !== gym) return false;
    if (grade !== 'all' && project.grade !== grade) return false;
    return true;
  });
  const isPristine = projects.length === 0;

  return (
    <section className="screen scroll-screen with-tabs">
      <ScreenHeader
        title={isPristine ? t('projects.firstLine') : t('projects.title')}
        subtitle={
          isPristine
            ? t('projects.noLocalData')
            : t('projects.summary', {
                filtered: filtered.length,
                sent: projects.filter((project) => project.status === 'sent').length,
              })
        }
        right={
          <div className="header-actions">
            <button type="button" data-active={view === 'grid'} onClick={() => setView('grid')} aria-label={t('projects.gridView')}>
              <Icon name="grid" size={16} />
            </button>
            <button type="button" data-active={view === 'list'} onClick={() => setView('list')} aria-label={t('projects.listView')}>
              <Icon name="list" size={16} />
            </button>
            <button type="button" data-active onClick={() => setCreating(true)} aria-label={t('projects.create')}>
              <Icon name="plus" size={16} />
            </button>
          </div>
        }
      />

      {!isPristine && <div className="filter-stack">
        <div className="chip-scroll">
          {(['all', 'projecting', 'close', 'sent', 'archived'] as const).map((item) => (
            <button key={item} type="button" data-active={status === item} onClick={() => setStatus(item)}>
              {statusLabel(item)}
            </button>
          ))}
        </div>
        <div className="select-row">
          <label>
            <Icon name="filter" size={14} />
            <select value={gym} onChange={(event) => setGym(event.target.value)}>
              <option value="all">{t('projects.allGyms')}</option>
              {gyms.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            <select value={grade} onChange={(event) => setGrade(event.target.value)}>
              <option value="all">{t('projects.allGrades')}</option>
              {grades.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>}

      {filtered.length === 0 ? (
        <EmptyState
          title={isPristine ? t('projects.emptyFirstTitle') : t('projects.emptyFilteredTitle')}
          body={isPristine ? t('projects.emptyFirstBody') : t('projects.emptyFilteredBody')}
          action={<KButton icon="plus" onClick={() => setCreating(true)}>{t('common.newProject')}</KButton>}
        />
      ) : view === 'grid' ? (
        <div className="project-grid">
          {filtered.map((project) => (
            <ProjectGridCard
              key={project.id}
              project={project}
              signature={signaturesByProject.get(project.id)}
              style={style}
              onClick={() => onProject(project)}
            />
          ))}
        </div>
      ) : (
        <div className="project-list">
          {filtered.map((project) => (
            <button key={project.id} className="project-list-row" type="button" onClick={() => onProject(project)}>
              <span className="grade-strip" />
              <div>
                <div className="card-chip-row">
                  <GradeChip grade={project.grade} color={project.gradeColor} />
                  <StatusPill status={project.status} />
                </div>
                <strong>{project.displayName}</strong>
                <p>{project.gymName} · {project.wallName} · {project.attemptsCount} {t('common.tries')}</p>
              </div>
              <Icon name="chevron" size={16} />
            </button>
          ))}
        </div>
      )}

      {creating && (
        <div className="modal-sheet">
          <ProjectForm
            onCancel={() => setCreating(false)}
            onSubmit={(draft) => {
              const project = onCreateProject(draft);
              setCreating(false);
              onProject(project);
            }}
          />
        </div>
      )}
    </section>
  );
}

function ProjectGridCard({
  project,
  signature,
  style,
  onClick,
}: {
  project: Project;
  signature?: MotionSignatureData;
  style: MotionSignatureStyle;
  onClick: () => void;
}) {
  const { t, status } = useI18n();

  return (
    <button className="project-card" type="button" onClick={onClick}>
      <div className="project-card-visual">
        <MotionSignature data={signature} seed={project.seed} style={signature?.style || style} showGrid={false} strokeScale={0.62} />
        <div className="card-chip-row">
          <GradeChip grade={project.grade} color={project.gradeColor} />
          {project.status === 'sent' && <StatusPill status="sent" />}
        </div>
      </div>
      <div className="project-card-body">
        <strong>{project.localName || project.displayName}</strong>
        <span>{project.localName ? `${project.displayName} · ` : ''}{project.gymName} · {project.wallName}</span>
        <p>{project.attemptsCount} {t('common.tries')} · {status(project.status)}</p>
      </div>
    </button>
  );
}

function gradeSort(a: string, b: string) {
  return Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, ''));
}
