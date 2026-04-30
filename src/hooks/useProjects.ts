import { useEffect, useMemo, useState } from 'react';
import { readJson, storageKeys, uid, writeJson } from '../lib/storage';
import type { Attempt, AttemptDraft, Project, ProjectDraft, ProjectStatus } from '../types/klym';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>(() => stripPrototypeProjects(readJson<Project[]>(storageKeys.projects, [])));
  const [attempts, setAttempts] = useState<Attempt[]>(() => stripPrototypeAttempts(readJson<Attempt[]>(storageKeys.attempts, [])));

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
  if (projects.some((project) => prototypeProjectIds.has(project.id))) return [];
  return projects;
}

function stripPrototypeAttempts(attempts: Attempt[]) {
  if (attempts.some((attempt) => prototypeProjectIds.has(attempt.projectId))) return [];
  return attempts;
}
