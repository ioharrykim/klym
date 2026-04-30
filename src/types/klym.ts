export type ProjectStatus = 'projecting' | 'close' | 'sent' | 'archived';

export type AttemptResult =
  | 'attempt'
  | 'highpoint'
  | 'beta'
  | 'close'
  | 'send'
  | 'dnf';

export type GradeMode = 'scale' | 'color';

export interface Project {
  id: string;
  gymName: string;
  grade: string;
  gradeMode?: GradeMode;
  gradeColor?: string;
  wallName: string;
  problemName?: string;
  displayName: string;
  localName?: string;
  notes: string;
  betaNotes: string;
  nextAttemptStrategy: string;
  status: ProjectStatus;
  attemptsCount: number;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  archivedAt?: string;
  seed: number;
}

export interface Attempt {
  id: string;
  projectId: string;
  date: string;
  attemptCount: number;
  result: AttemptResult;
  notes: string;
}

export type MotionSignatureStyle = 'dynamic' | 'refined' | 'editorial' | 'data';

export type MotionSignatureSource = 'auto' | 'assisted' | 'manual';
export type MotionAnalysisMethod = 'pose' | 'pixel-motion' | 'manual';

export interface MotionEvent {
  type: 'start' | 'crux' | 'dyno' | 'topout';
  t: number;
  label: string;
  confidence: number;
}

export type MotionProcessingState =
  | 'idle'
  | 'video-selected'
  | 'extracting-frames'
  | 'detecting-motion'
  | 'generating-signature'
  | 'signature-ready'
  | 'failed';

export interface MotionPoint {
  x: number;
  y: number;
  t: number;
  velocity?: number;
  confidence?: number;
  dyno?: boolean;
  manual?: boolean;
}

export interface MotionFrame {
  id: string;
  index: number;
  time: number;
  width: number;
  height: number;
  dataUrl: string;
}

export interface MotionSignatureData {
  id: string;
  projectId?: string;
  createdAt: string;
  videoName: string;
  videoDuration: number;
  frameCount: number;
  backgroundFrameDataUrls?: string[];
  videoDataUrl?: string;
  sourceVideoUrl?: string;
  points: MotionPoint[];
  svgPath: string;
  style: MotionSignatureStyle;
  sourceType: MotionSignatureSource;
  analysisMethod?: MotionAnalysisMethod;
  confidenceScore: number;
  motionEvents?: MotionEvent[];
  processingNotes: string[];
}

export type SendCardFormat = 'square' | 'feed-tall' | 'story';
export type SendCardLayout = 'hero' | 'blueprint' | 'poster';
export type SendCardBackgroundMode = 'signature' | 'video' | 'video-frames' | 'photo';
export type SendCardTextTone = 'light' | 'dark';

export interface SendCard {
  id: string;
  projectId: string;
  signatureId: string;
  createdAt: string;
  format: SendCardFormat;
  layout: SendCardLayout;
  style: MotionSignatureStyle;
  reflection: string;
  backgroundMode?: SendCardBackgroundMode;
  customBackgroundDataUrl?: string;
  textTone?: SendCardTextTone;
}

export interface ProjectDraft {
  gymName: string;
  grade: string;
  gradeMode?: GradeMode;
  gradeColor?: string;
  wallName: string;
  problemName?: string;
  displayName: string;
  localName?: string;
  notes: string;
  betaNotes: string;
  nextAttemptStrategy: string;
  status: ProjectStatus;
}

export interface AttemptDraft {
  projectId: string;
  date: string;
  attemptCount: number;
  result: AttemptResult;
  notes: string;
}
