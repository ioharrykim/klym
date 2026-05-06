import { useEffect, useMemo, useState } from 'react';
import { readJson, storageKeys, uid, writeJson } from '../lib/storage';
import type { Attempt, AttemptDraft, Project, ProjectDraft, ProjectStatus } from '../types/klym';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>(() => stripPrototypeProjects(readJson(storageKeys.projects, [], isProjectArray)));
  const [attempts, setAttempts] = useState<Attempt[]>(() => stripPrototypeAttempts(readJson(storageKeys.attempts, [], isAttemptArray)));

  useEffect(() => writeJson(storageKeys.projects, projects), [projects]);
  useEffect(() => writeJson(storageKeys.attempts, attempts), [attempts]);

  const stats = useMemo(() => {
    const open = projects.filter((project) => !['sent', 'archived'].includes(project.status));
    const close = projects.filter((project) => project.status === 'close');
    const sent = projects.filter((project) => project.status === 'sent');
    const recentAttempts = [...attempts]
      .sort((a, b) => `${b.date}${b.id}`.localeCompare(`${a.date}${a.id}`))
      .slice(0, 5);
    return {
      openCount: open.length,
      closeCount: close.length,
      sentCount: sent.length,
      archivedCount: projects.filter((project) => project.status === 'archived').length,
      attempts30d: attempts.reduce((sum, attempt) => sum + attempt.attemptCount, 0),
      recentAttempts,
      recentSends: [...sent]
        .sort((a, b) => (b.sentAt || b.updatedAt).localeCompare(a.sentAt || a.updatedAt))
        .slice(0, 5),
      focusProject: open[0] || sent[0] || projects[0],
    };
  }, [attempts, projects]);

  function createProject(draft: ProjectDraft) {
    const now = new Date().toISOString();
    const project: Project = {
      ...draft,
      id: uid('project'),
      attemptsCount: 0,
      createdAt: now,
      updatedAt: now,
      sentAt: draft.status === 'sent' ? now : undefined,
      seed: Math.floor(Math.random() * 9000) + 100,
    };
    setProjects((current) => [project, ...current]);
    return project;
  }

  function updateProject(projectId: string, patch: Partial<ProjectDraft & Project>) {
    setProjects((current) =>
      current.map((project) => {
        if (project.id !== projectId) return project;
        const nextStatus = patch.status ?? project.status;
        const sentAt = nextStatus === 'sent' ? patch.sentAt || project.sentAt || new Date().toISOString() : patch.sentAt;
        return {
          ...project,
          ...patch,
          status: nextStatus,
          sentAt,
          archivedAt: nextStatus === 'archived' ? patch.archivedAt || project.archivedAt || new Date().toISOString() : patch.archivedAt,
          updatedAt: new Date().toISOString(),
        };
      }),
    );
  }

  function deleteProject(projectId: string) {
    setProjects((current) => current.filter((project) => project.id !== projectId));
    setAttempts((current) => current.filter((attempt) => attempt.projectId !== projectId));
  }

  function archiveProject(projectId: string) {
    updateProject(projectId, { status: 'archived' });
  }

  function changeProjectStatus(projectId: string, status: ProjectStatus) {
    updateProject(projectId, { status });
  }

  function markProjectSent(projectId: string) {
    updateProject(projectId, { status: 'sent', sentAt: new Date().toISOString() });
  }

  function addAttempt(draft: AttemptDraft) {
    const attempt: Attempt = {
      ...draft,
      id: uid('attempt'),
    };
    setAttempts((current) => [attempt, ...current]);
    setProjects((current) =>
      current.map((project) => {
        if (project.id !== draft.projectId) return project;
        const isSend = draft.result === 'send';
        return {
          ...project,
          attemptsCount: project.attemptsCount + draft.attemptCount,
          status: isSend ? 'sent' : draft.result === 'close' ? 'close' : project.status,
          sentAt: isSend ? new Date(`${draft.date}T12:00:00`).toISOString() : project.sentAt,
          updatedAt: new Date().toISOString(),
        };
      }),
    );
    return attempt;
  }

  function attemptsForProject(projectId: string) {
    return attempts
      .filter((attempt) => attempt.projectId === projectId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  return {
    projects,
    attempts,
    stats,
    createProject,
    updateProject,
    deleteProject,
    archiveProject,
    changeProjectStatus,
    markProjectSent,
    addAttempt,
    attemptsForProject,
  };
}

const prototypeProjectIds = new Set([
  'project_concrete_traverse',
  'project_crimson_dyno',
  'project_graphite_slab',
  'project_paper_tiger',
  'project_night_shift',
  'project_street_line',
]);

function stripPrototypeProjects(projects: Project[]) {
  return projects.filter((project) => !prototypeProjectIds.has(project.id));
}

function stripPrototypeAttempts(attempts: Attempt[]) {
  return attempts.filter((attempt) => !prototypeProjectIds.has(attempt.projectId));
}

function isProjectArray(value: unknown): value is Project[] {
  return Array.isArray(value) && value.every(isProject);
}

function isAttemptArray(value: unknown): value is Attempt[] {
  return Array.isArray(value) && value.every(isAttempt);
}

function isProject(value: unknown): value is Project {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.gymName === 'string' &&
    typeof value.grade === 'string' &&
    typeof value.wallName === 'string' &&
    typeof value.displayName === 'string' &&
    typeof value.notes === 'string' &&
    typeof value.betaNotes === 'string' &&
    typeof value.nextAttemptStrategy === 'string' &&
    typeof value.status === 'string' &&
    typeof value.attemptsCount === 'number' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    typeof value.seed === 'number'
  );
}

function isAttempt(value: unknown): value is Attempt {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.projectId === 'string' &&
    typeof value.date === 'string' &&
    typeof value.attemptCount === 'number' &&
    typeof value.result === 'string' &&
    typeof value.notes === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
