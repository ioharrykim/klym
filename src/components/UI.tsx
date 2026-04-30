import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from 'react';
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Bolt,
  Check,
  ChevronRight,
  Clock,
  Download,
  Filter,
  Grid2X2,
  Home,
  List,
  Pencil,
  Plus,
  Share2,
  Trash2,
  Upload,
  User,
  Video,
  X,
} from 'lucide-react';
import { gradeColors, statusLabels, tokens } from '../lib/tokens';
import type { ProjectStatus } from '../types/klym';

export type IconName =
  | 'archive'
  | 'arrow-left'
  | 'arrow-right'
  | 'bolt'
  | 'check'
  | 'chevron'
  | 'clock'
  | 'download'
  | 'filter'
  | 'grid'
  | 'home'
  | 'list'
  | 'pencil'
  | 'plus'
  | 'share'
  | 'trash'
  | 'upload'
  | 'user'
  | 'video'
  | 'x';

export function Icon({ name, size = 18, stroke = 'currentColor' }: { name: IconName; size?: number; stroke?: string }) {
  const props = { size, color: stroke, strokeWidth: 1.8, absoluteStrokeWidth: true };
  switch (name) {
    case 'archive':
      return <Archive {...props} />;
    case 'arrow-left':
      return <ArrowLeft {...props} />;
    case 'arrow-right':
      return <ArrowRight {...props} />;
    case 'bolt':
      return <Bolt {...props} />;
    case 'check':
      return <Check {...props} />;
    case 'chevron':
      return <ChevronRight {...props} />;
    case 'clock':
      return <Clock {...props} />;
    case 'download':
      return <Download {...props} />;
    case 'filter':
      return <Filter {...props} />;
    case 'grid':
      return <Grid2X2 {...props} />;
    case 'home':
      return <Home {...props} />;
    case 'list':
      return <List {...props} />;
    case 'pencil':
      return <Pencil {...props} />;
    case 'plus':
      return <Plus {...props} />;
    case 'share':
      return <Share2 {...props} />;
    case 'trash':
      return <Trash2 {...props} />;
    case 'upload':
      return <Upload {...props} />;
    case 'user':
      return <User {...props} />;
    case 'video':
      return <Video {...props} />;
    case 'x':
      return <X {...props} />;
  }
}

export function PhoneShell({ children }: PropsWithChildren) {
  return (
    <div className="phone-shell">
      <div className="phone-screen">
        <div className="dynamic-island" />
        <StatusBar />
        <div className="phone-content">{children}</div>
        <div className="home-indicator" />
      </div>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="status-bar">
      <span>9:41</span>
      <span className="status-icons">
        <span className="signal-bars">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className="battery">
          <i />
        </span>
      </span>
    </div>
  );
}

export function Stage({ children }: PropsWithChildren) {
  return (
    <main className="stage">
      <div className="stage-mark">
        KLYM
        <span>KEEP LINES, YOUR MOVE</span>
      </div>
      <div className="stage-meta">
        MVP · v0.1
        <br />
        <b>LOCAL-FIRST</b>
      </div>
      {children}
    </main>
  );
}

interface TabBarProps {
  active: string;
  onTab: (tab: string) => void;
}

export function TabBar({ active, onTab }: TabBarProps) {
  const tabs = [
    { id: 'home', label: 'HOME', icon: 'home' as IconName },
    { id: 'projects', label: 'PROJECTS', icon: 'grid' as IconName },
    { id: 'send', label: 'SEND', icon: 'plus' as IconName, big: true },
    { id: 'sessions', label: 'SESSIONS', icon: 'list' as IconName },
    { id: 'profile', label: 'ME', icon: 'user' as IconName },
  ];
  return (
    <nav className="tab-bar" aria-label="Primary">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={tab.big ? 'tab-button tab-button-send' : 'tab-button'}
          data-active={active === tab.id}
          onClick={() => onTab(tab.id)}
          type="button"
        >
          <span className="tab-icon">
            <Icon name={tab.icon} size={tab.big ? 22 : 19} />
          </span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <header className="screen-header">
      <div>
        {onBack && (
          <button type="button" className="back-link" onClick={onBack}>
            <Icon name="arrow-left" size={14} />
            BACK
          </button>
        )}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

export function Eyebrow({ children, right }: PropsWithChildren<{ right?: ReactNode }>) {
  return (
    <div className="eyebrow">
      <span>
        <i />
        {children}
      </span>
      {right}
    </div>
  );
}

export function Chip({ children, color, active = false }: PropsWithChildren<{ color?: string; active?: boolean }>) {
  return (
    <span
      className="chip"
      style={{
        background: active ? tokens.accent : color || 'transparent',
        color: active || color ? '#000' : tokens.bone,
        borderColor: active || color ? 'transparent' : tokens.hairline,
      }}
    >
      {children}
    </span>
  );
}

export function GradeChip({ grade }: { grade: string }) {
  return <Chip color={gradeColors[grade] || tokens.accent}>{grade}</Chip>;
}

export function StatusPill({ status }: { status: ProjectStatus }) {
  const color =
    status === 'sent'
      ? tokens.ok
      : status === 'close'
        ? tokens.yellow
        : status === 'archived'
          ? tokens.concrete
          : tokens.accent;
  return <Chip color={color}>{statusLabels[status]}</Chip>;
}

export function KButton({
  children,
  variant = 'primary',
  icon,
  ...props
}: PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'ghost' | 'paper' | 'dark';
    icon?: IconName;
  }
>) {
  return (
    <button {...props} className={`k-button k-button-${variant} ${props.className || ''}`} type={props.type || 'button'}>
      {icon && <Icon name={icon} size={17} />}
      {children}
    </button>
  );
}

export function StatBlock({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="stat-block">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-glyph">
        <Icon name="bolt" size={24} />
      </div>
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </div>
  );
}
