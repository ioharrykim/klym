import { useState } from 'react';
import { MotionSignature } from '../components/MotionSignature';
import { AttemptForm, ProjectForm } from '../components/ProjectForm';
import { Eyebrow, GradeChip, Icon, KButton, StatBlock, StatusPill } from '../components/UI';
import { useI18n } from '../lib/i18n';
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
  onMotion,
}: ProjectDetailScreenProps) {
  const { t, status, attemptResult } = useI18n();
  const [editing, setEditing] = useState(false);
  const [addingAttempt, setAddingAttempt] = useState(false);

  return (
    <section className="screen project-detail">
      <div className="detail-scroll">
        <div className="detail-hero">
          <MotionSignature data={signature} seed={project.seed} style={signature?.style || style} animate showGrid />
          <div className="detail-topbar">
            <button type="button" onClick={onBack} aria-label={t('projectDetail.back')}>
              <Icon name="arrow-left" />
            </button>
            <button type="button" onClick={() => setEditing(true)} aria-label={t('projectDetail.edit')}>
              <Icon name="pencil" />
            </button>
          </div>
          <div className="detail-title">
            <div className="card-chip-row">
              <GradeChip grade={project.grade} color={project.gradeColor} />
              <StatusPill status={project.status} />
            </div>
            <h1>{project.localName || project.displayName}</h1>
            <p>{project.gymName} / {project.wallName}</p>
            {project.localName && <small className="line-alias">{project.displayName}</small>}
          </div>
        </div>

        <div className="stats-strip detail-stats">
          <StatBlock label={t('common.attempts')} value={project.attemptsCount} />
          <StatBlock label={t('common.days')} value={projectDays(project)} />
          <StatBlock label={t('common.status')} value={status(project.status)} />
        </div>

        <Eyebrow>{t('projectDetail.betaNext')}</Eyebrow>
        <div className="note-block">
          <p>{project.betaNotes || t('projectDetail.noBeta')}</p>
          {project.nextAttemptStrategy && <b>{project.nextAttemptStrategy}</b>}
        </div>

        <Eyebrow>{t('projectDetail.projectNotes')}</Eyebrow>
        <div className="note-block quiet">
          <p>{project.notes || t('projectDetail.noNotes')}</p>
        </div>

        <Eyebrow>{t('projectDetail.attemptLog')}</Eyebrow>
        <div className="attempt-list">
          {attempts.length === 0 ? (
            <p className="muted-copy">{t('projectDetail.noAttempts')}</p>
          ) : (
            attempts.map((attempt) => (
              <div key={attempt.id} className="attempt-row">
                <span>{attempt.date.slice(5)}</span>
                <div>
                  <b>
                    {attemptResult(attempt.result)} · {attempt.attemptCount} {t('common.tries')}
                  </b>
                  <p>{attempt.notes || t('projectDetail.noAttemptNotes')}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bottom-actions">
        <KButton variant="dark" icon="plus" onClick={() => setAddingAttempt(true)}>
          {t('projectDetail.try')}
        </KButton>
        {project.status !== 'sent' ? (
          <KButton
            variant="primary"
            icon="check"
            onClick={() => onMotion(project)}
          >
            {t('projectDetail.markSentUpload')}
          </KButton>
        ) : (
          <KButton variant="primary" icon="upload" onClick={() => onMotion(project)}>
            {t('projectDetail.uploadSend')}
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
              {t('common.archiveProject')}
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
