import { useMemo, useState } from 'react';
import { useI18n } from '../lib/i18n';
import type {
  AttemptDraft,
  AttemptResult,
  ClimbEnvironment,
  GradeMode,
  Project,
  ProjectDraft,
  ProjectStatus,
} from '../types/klym';
import { GradeInput } from './GradeInput';
import { KButton } from './UI';

const statusOptions: ProjectStatus[] = ['projecting', 'close', 'sent', 'archived'];
const resultOptions: AttemptResult[] = ['attempt', 'highpoint', 'beta', 'close', 'send', 'dnf'];

export function ProjectForm({
  project,
  onSubmit,
  onCancel,
  onDelete,
}: {
  project?: Project;
  onSubmit: (draft: ProjectDraft) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const { t, status: statusLabel } = useI18n();
  const [draft, setDraft] = useState<ProjectDraft>(() => ({
    gymName: project?.gymName || '',
    environment: project?.environment || 'indoor',
    grade: project?.grade || '',
    gradeMode: project?.gradeMode || 'scale',
    gradeColor: project?.gradeColor,
    wallName: project?.wallName || '',
    problemName: project?.problemName || '',
    displayName: project?.displayName || '',
    localName: project?.localName || '',
    notes: project?.notes || '',
    betaNotes: project?.betaNotes || '',
    nextAttemptStrategy: project?.nextAttemptStrategy || '',
    status: project?.status || 'projecting',
  }));

  const gradeValid = draft.gradeMode === 'color' ? Boolean(draft.gradeColor) : Boolean(draft.grade.trim());
  const canSubmit = draft.displayName.trim() && draft.gymName.trim() && gradeValid && draft.wallName.trim();

  function update<K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <form
      className="editor-panel"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit) return;
        onSubmit({
          ...draft,
          displayName: draft.displayName.trim().toUpperCase(),
          problemName: draft.problemName?.trim() || draft.displayName.trim(),
        });
      }}
    >
      <div className="editor-head">
        <div>
          <span>{project ? t('projectForm.editLine') : t('projectForm.newLine')}</span>
          <h2>{project ? project.displayName : t('projectForm.createProject')}</h2>
        </div>
        <button type="button" onClick={onCancel} aria-label={t('common.close')}>
          {t('common.close')}
        </button>
      </div>

      <div className="field-grid">
        <label>
          <span>{t('projectForm.projectName')}</span>
          <input value={draft.displayName} onChange={(event) => update('displayName', event.target.value)} placeholder={t('placeholder.projectName')} />
        </label>
        <label>
          <span>{t('projectForm.localName')}</span>
          <input value={draft.localName} onChange={(event) => update('localName', event.target.value)} placeholder={t('placeholder.localName')} />
        </label>
        <label>
          <span>{t('projectForm.gym')}</span>
          <input value={draft.gymName} onChange={(event) => update('gymName', event.target.value)} placeholder={t('placeholder.gym')} />
        </label>
        <label>
          <span>{t('projectForm.environment')}</span>
          <select value={draft.environment || 'indoor'} onChange={(event) => update('environment', event.target.value as ClimbEnvironment)}>
            <option value="indoor">{t('environment.indoor')}</option>
            <option value="outdoor">{t('environment.outdoor')}</option>
          </select>
        </label>
        <label>
          <span>{t('projectForm.wall')}</span>
          <input value={draft.wallName} onChange={(event) => update('wallName', event.target.value)} placeholder={t('placeholder.wall')} />
        </label>
        <label className="grade-input-label">
          <span>{t('common.grade')}</span>
          <GradeInput
            mode={(draft.gradeMode as GradeMode) || 'scale'}
            grade={draft.grade}
            color={draft.gradeColor}
            onChange={(next) =>
              setDraft((current) => ({
                ...current,
                gradeMode: next.mode,
                grade: next.grade,
                gradeColor: next.color,
              }))
            }
          />
        </label>
        <label>
          <span>{t('common.status')}</span>
          <select value={draft.status} onChange={(event) => update('status', event.target.value as ProjectStatus)}>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        <span>{t('common.notes')}</span>
        <textarea value={draft.notes} onChange={(event) => update('notes', event.target.value)} rows={3} />
      </label>
      <label>
        <span>{t('projectForm.betaNotes')}</span>
        <textarea value={draft.betaNotes} onChange={(event) => update('betaNotes', event.target.value)} rows={3} />
      </label>
      <label>
        <span>{t('projectForm.nextStrategy')}</span>
        <textarea value={draft.nextAttemptStrategy} onChange={(event) => update('nextAttemptStrategy', event.target.value)} rows={2} />
      </label>

      <div className="editor-actions">
        {onDelete && (
          <KButton variant="ghost" icon="trash" onClick={onDelete}>
            {t('common.delete')}
          </KButton>
        )}
        <KButton variant="primary" icon="check" disabled={!canSubmit} type="submit">
          {t('common.saveProject')}
        </KButton>
      </div>
    </form>
  );
}

export function AttemptForm({
  projectId,
  onSubmit,
  onCancel,
}: {
  projectId: string;
  onSubmit: (draft: AttemptDraft) => void;
  onCancel: () => void;
}) {
  const { t, attemptResult } = useI18n();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [draft, setDraft] = useState<AttemptDraft>({
    projectId,
    date: today,
    attemptCount: 1,
    result: 'attempt',
    notes: '',
  });

  function update<K extends keyof AttemptDraft>(key: K, value: AttemptDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <form
      className="editor-panel compact"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(draft);
      }}
    >
      <div className="editor-head">
        <div>
          <span>{t('projectForm.attemptLog')}</span>
          <h2>{t('projectForm.addTry')}</h2>
        </div>
        <button type="button" onClick={onCancel}>
          {t('common.close')}
        </button>
      </div>

      <div className="field-grid">
        <label>
          <span>{t('common.date')}</span>
          <input type="date" value={draft.date} onChange={(event) => update('date', event.target.value)} />
        </label>
        <label>
          <span>{t('common.attempts')}</span>
          <input
            type="number"
            min={1}
            max={99}
            value={draft.attemptCount}
            onChange={(event) => update('attemptCount', Number(event.target.value))}
          />
        </label>
        <label>
          <span>{t('common.result')}</span>
          <select value={draft.result} onChange={(event) => update('result', event.target.value as AttemptResult)}>
            {resultOptions.map((result) => (
              <option key={result} value={result}>
                {attemptResult(result)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        <span>{t('common.notes')}</span>
        <textarea rows={3} value={draft.notes} onChange={(event) => update('notes', event.target.value)} />
      </label>
      <div className="editor-actions">
        <KButton variant="primary" icon="plus" type="submit">
          {t('projectForm.addAttempt')}
        </KButton>
      </div>
    </form>
  );
}
