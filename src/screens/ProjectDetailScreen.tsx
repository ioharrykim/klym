import { useState } from 'react';
import { MotionSignature } from '../components/MotionSignature';
import { AttemptForm, ProjectForm } from '../components/ProjectForm';
import { Eyebrow, GradeChip, Icon, KButton, StatBlock, StatusPill } from '../components/UI';
import type { Attempt, AttemptDraft, MotionSignatureData, MotionSignatureStyle, Project, ProjectDraft } from '../types/klym';

interface ProjectDetailScreenProps {
  project: Project;
  attempts: Attempt[];
  signature?: MotionSignatureData;
  style: MotionSignatureStyle;
  onBack: () => void;
  onUpdate: (projectId: string, draft: Partial<ProjectDraft & Project>) => void;
  onDelete: (projectId: string) => void;
  onArchive: (projectId: string) => void;
  onAddAttempt: (draft: AttemptDraft) => void;
  onMarkSent: (projectId: string) => void;
  onMotion: (project: Project) => void;
}

export function ProjectDetailScreen({
  project,
  attempts,
  signature,
  style,
  onBack,
  onUpdate,
  onDelete,
  onArchive,
  onAddAttempt,
  onMarkSent,
  onMotion,
}: ProjectDetailScreenProps) {
  const [editing, setEditing] = useState(false);
  const [addingAttempt, setAddingAttempt] = useState(false);

  return (
    <section className="screen project-detail">
      <div className="detail-scroll">
        <div className="detail-hero">
          <MotionSignature data={signature} seed={project.seed} style={signature?.style || style} animate showGrid />
          <div className="detail-topbar">
            <button type="button" onClick={onBack} aria-label="Back">
              <Icon name="arrow-left" />
            </button>
            <button type="button" onClick={() => setEditing(true)} aria-label="Edit project">
              <Icon name="pencil" />
            </button>
          </div>
          <div className="detail-title">
            <div className="card-chip-row">
              <GradeChip grade={project.grade} />
              <StatusPill status={project.status} />
            </div>
            <h1>{project.localName || project.displayName}</h1>
            <p>{project.gymName} / {project.wallName}</p>
          </div>
        </div>

        <div className="stats-strip detail-stats">
          <StatBlock label="ATTEMPTS" value={project.attemptsCount} />
          <StatBlock label="DAYS" value={projectDays(project)} />
          <StatBlock label="STATUS" value={project.status.toUpperCase()} />
        </div>

        <Eyebrow>BETA · NEXT TRY</Eyebrow>
        <div className="note-block">
          <p>{project.betaNotes || 'No beta stored yet.'}</p>
          {project.nextAttemptStrategy && <b>{project.nextAttemptStrategy}</b>}
        </div>

        <Eyebrow>PROJECT NOTES</Eyebrow>
        <div className="note-block quiet">
          <p>{project.notes || 'No notes yet.'}</p>
        </div>

        <Eyebrow>ATTEMPT LOG</Eyebrow>
        <div className="attempt-list">
          {attempts.length === 0 ? (
            <p className="muted-copy">No attempts logged yet.</p>
          ) : (
            attempts.map((attempt) => (
              <div key={attempt.id} className="attempt-row">
                <span>{attempt.date.slice(5)}</span>
                <div>
                  <b>
                    {attempt.result.toUpperCase()} · {attempt.attemptCount} TRIES
                  </b>
                  <p>{attempt.notes}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bottom-actions">
        <KButton variant="dark" icon="plus" onClick={() => setAddingAttempt(true)}>
          TRY
        </KButton>
        {project.status !== 'sent' ? (
          <KButton
            variant="primary"
            icon="check"
            onClick={() => {
              onMarkSent(project.id);
              onMotion(project);
            }}
          >
            MARK SENT · UPLOAD
          </KButton>
        ) : (
          <KButton variant="primary" icon="upload" onClick={() => onMotion(project)}>
            UPLOAD SEND
          </KButton>
        )}
      </div>

      {editing && (
        <div className="modal-sheet">
          <ProjectForm
            project={project}
            onCancel={() => setEditing(false)}
            onSubmit={(draft) => {
              onUpdate(project.id, draft);
              setEditing(false);
            }}
            onDelete={() => {
              onDelete(project.id);
              setEditing(false);
              onBack();
            }}
          />
          <div className="archive-strip">
            <button
              type="button"
              onClick={() => {
                onArchive(project.id);
                setEditing(false);
              }}
            >
              ARCHIVE PROJECT
            </button>
          </div>
        </div>
      )}

      {addingAttempt && (
        <div className="modal-sheet">
          <AttemptForm
            projectId={project.id}
            onCancel={() => setAddingAttempt(false)}
            onSubmit={(draft) => {
              onAddAttempt(draft);
              setAddingAttempt(false);
            }}
          />
        </div>
      )}
    </section>
  );
}

function projectDays(project: Project) {
  const start = new Date(project.createdAt).getTime();
  const end = new Date(project.sentAt || project.updatedAt).getTime();
  return Math.max(1, Math.ceil((end - start) / 86400000));
}
