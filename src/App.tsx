import { useMemo, useState } from 'react';
import { PhoneShell, Stage, TabBar } from './components/UI';
import { defaultStyle } from './lib/data';
import { useMotionSignature } from './hooks/useMotionSignature';
import { useProjects } from './hooks/useProjects';
import { useSendCards } from './hooks/useSendCards';
import { DashboardScreen } from './screens/DashboardScreen';
import { MotionFlowScreen } from './screens/MotionFlowScreen';
import { ProjectDetailScreen } from './screens/ProjectDetailScreen';
import { ProjectsScreen } from './screens/ProjectsScreen';
import { SendCardScreen } from './screens/SendCardScreen';
import { ProfileScreen, SessionsScreen } from './screens/UtilityScreens';
import type { MotionSignatureData, Project, ProjectDraft } from './types/klym';

type Screen = 'home' | 'projects' | 'project' | 'motion' | 'sendcard' | 'sessions' | 'profile';

export default function App() {
  const projectsApi = useProjects();
  const signaturesApi = useMotionSignature();
  const cardsApi = useSendCards();
  const [screen, setScreen] = useState<Screen>('home');
  const [history, setHistory] = useState<Screen[]>([]);
  const [activeProjectId, setActiveProjectId] = useState('');
  const [activeSignature, setActiveSignature] = useState<MotionSignatureData | undefined>();
  const [quickMode, setQuickMode] = useState(false);

  const activeProject = useMemo(
    () => projectsApi.projects.find((project) => project.id === activeProjectId),
    [activeProjectId, projectsApi.projects],
  );

  function goto(next: Screen, project?: Project) {
    setHistory((current) => [...current, screen]);
    if (project) setActiveProjectId(project.id);
    setScreen(next);
  }

  function back() {
    setQuickMode(false);
    setHistory((current) => {
      const previous = current[current.length - 1] || 'home';
      setScreen(previous);
      return current.slice(0, -1);
    });
  }

  function startQuickSend() {
    setQuickMode(true);
    setActiveProjectId('');
    setActiveSignature(undefined);
    goto('motion');
  }

  function handleTab(tab: string) {
    if (tab === 'send') {
      startQuickSend();
      return;
    }
    setQuickMode(false);
    setScreen(tab as Screen);
  }

  const tabActive = screen === 'project' ? 'projects' : screen === 'sendcard' || screen === 'motion' ? 'send' : screen;

  return (
    <Stage>
      <PhoneShell>
        {screen === 'home' && (
          <>
            <DashboardScreen
              projects={projectsApi.projects}
              attempts={projectsApi.attempts}
              stats={projectsApi.stats}
              signaturesByProject={signaturesApi.latestByProject}
              style={defaultStyle}
              onProject={(project) => goto('project', project)}
              onProjects={() => goto('projects')}
              onMotion={(project) => {
                setQuickMode(false);
                goto('motion', project);
              }}
              onQuickSend={startQuickSend}
            />
            <TabBar active={tabActive} onTab={handleTab} />
          </>
        )}
        {screen === 'projects' && (
          <>
            <ProjectsScreen
              projects={projectsApi.projects}
              signaturesByProject={signaturesApi.latestByProject}
              style={defaultStyle}
              onProject={(project) => goto('project', project)}
              onCreateProject={projectsApi.createProject}
            />
            <TabBar active={tabActive} onTab={handleTab} />
          </>
        )}
        {screen === 'project' && activeProject && (
          <ProjectDetailScreen
            project={activeProject}
            attempts={projectsApi.attemptsForProject(activeProject.id)}
            signature={signaturesApi.latestByProject.get(activeProject.id)}
            style={defaultStyle}
            onBack={back}
            onUpdate={projectsApi.updateProject}
            onDelete={projectsApi.deleteProject}
            onArchive={projectsApi.archiveProject}
            onAddAttempt={projectsApi.addAttempt}
            onMarkSent={projectsApi.markProjectSent}
            onMotion={(project) => goto('motion', project)}
          />
        )}
        {screen === 'motion' && (
          <MotionFlowScreen
            projects={projectsApi.projects}
            selectedProject={quickMode ? undefined : activeProject || projectsApi.stats.focusProject}
            quickMode={quickMode}
            style={defaultStyle}
            onCreateProject={() => goto('projects')}
            onBack={back}
            onComplete={(draft, project) => {
              const saved = signaturesApi.saveSignature(draft);
              setActiveSignature(saved);
              if (project) {
                projectsApi.markProjectSent(project.id);
                setActiveProjectId(project.id);
              }
              goto('sendcard', project);
            }}
            onQuickComplete={(draft, projectDraft) => {
              const project = projectsApi.createProject({ ...projectDraft, status: 'sent' });
              const saved = signaturesApi.saveSignature({ ...draft, projectId: project.id });
              setActiveSignature(saved);
              setActiveProjectId(project.id);
              setQuickMode(false);
              goto('sendcard', project);
            }}
          />
        )}
        {screen === 'sendcard' && (
          <SendCardScreen
            projects={projectsApi.projects}
            signatures={signaturesApi.signatures}
            initialProject={activeProject}
            initialSignature={activeSignature}
            onBack={back}
            onMotion={(project) => goto('motion', project)}
            onSaveCard={cardsApi.saveSendCard}
          />
        )}
        {screen === 'sessions' && (
          <>
            <SessionsScreen attempts={projectsApi.attempts} projects={projectsApi.projects} />
            <TabBar active={tabActive} onTab={handleTab} />
          </>
        )}
        {screen === 'profile' && (
          <>
            <ProfileScreen projects={projectsApi.projects} sendCards={cardsApi.sendCards} />
            <TabBar active={tabActive} onTab={handleTab} />
          </>
        )}
      </PhoneShell>
    </Stage>
  );
}
