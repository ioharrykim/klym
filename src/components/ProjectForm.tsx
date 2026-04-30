import { useMemo, useState } from 'react';
import type { AttemptDraft, AttemptResult, GradeMode, Project, ProjectDraft, ProjectStatus } from '../types/klym';
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
  const [draft, setDraft] = useState<ProjectDraft>(() => ({
    gymName: project?.gymName || 'THE CLIMB · SEONGSU',
    grade: project?.grade || 'V6',
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
          <span>{project ? 'EDIT LINE' : 'NEW LINE'}</span>
          <h2>{project ? project.displayName : 'CREATE PROJECT'}</h2>
        </div>
        <button type="button" onClick={onCancel}>
          CLOSE
        </button>
      </div>

      <div className="field-grid">
        <label>
          <span>PROJECT NAME</span>
          <input value={draft.displayName} onChange={(event) => update('displayName', event.target.value)} placeholder="CONCRETE TRAVERSE" />
        </label>
        <label>
          <span>KOREAN / LOCAL NAME</span>
          <input value={draft.localName} onChange={(event) => update('localName', event.target.value)} placeholder="콘크리트 트래버스" />
        </label>
        <label>
          <span>GYM</span>
          <input value={draft.gymName} onChange={(event) => update('gymName', event.target.value)} placeholder="THE CLIMB · SEONGSU" />
        </label>
        <label>
          <span>WALL</span>
          <input value={draft.wallName} onChange={(event) => update('wallName', event.target.value)} placeholder="WALL 03" />
        </label>
        <label className="grade-input-label">
          <span>GRADE</span>
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
          <span>STATUS</span>
          <select value={draft.status} onChange={(event) => update('status', event.target.value as ProjectStatus)}>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        <span>NOTES</span>
        <textarea value={draft.notes} onChange={(event) => update('notes', event.target.value)} rows={3} />
      </label>
      <label>
        <span>BETA NOTES</span>
        <textarea value={draft.betaNotes} onChange={(event) => update('betaNotes', event.target.value)} rows={3} />
      </label>
      <label>
        <span>NEXT ATTEMPT STRATEGY</span>
        <textarea value={draft.nextAttemptStrategy} onChange={(event) => update('nextAttemptStrategy', event.target.value)} rows={2} />
      </label>

      <div className="editor-actions">
        {onDelete && (
          <KButton variant="ghost" icon="trash" onClick={onDelete}>
            DELETE
          </KButton>
        )}
        <KButton variant="primary" icon="check" disabled={!canSubmit} type="submit">
          SAVE PROJECT
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
          <span>ATTEMPT LOG</span>
          <h2>ADD TRY</h2>
        </div>
        <button type="button" onClick={onCancel}>
          CLOSE
        </button>
      </div>

      <div className="field-grid">
        <label>
          <span>DATE</span>
          <input type="date" value={draft.date} onChange={(event) => update('date', event.target.value)} />
        </label>
        <label>
          <span>ATTEMPTS</span>
          <input
            type="number"
            min={1}
            max={99}
            value={draft.attemptCount}
            onChange={(event) => update('attemptCount', Number(event.target.value))}
          />
        </label>
        <label>
          <span>RESULT</span>
          <select value={draft.result} onChange={(event) => update('result', event.target.value as AttemptResult)}>
            {resultOptions.map((result) => (
              <option key={result} value={result}>
                {result.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        <span>NOTES</span>
        <textarea rows={3} value={draft.notes} onChange={(event) => update('notes', event.target.value)} />
      </label>
      <div className="editor-actions">
        <KButton variant="primary" icon="plus" type="submit">
          ADD ATTEMPT
        </KButton>
      </div>
    </form>
  );
}
