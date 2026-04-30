export const tokens = {
  ink: '#0A0A0B',
  deepInk: '#050506',
  graphite: '#16171A',
  panel: '#1C1D21',
  concrete: '#2A2C30',
  hairline: '#2E3035',
  dust: '#6B6E75',
  ash: '#A4A7AD',
  bone: '#E6E2D8',
  paper: '#F4F1EA',
  accent: '#FF5A1F',
  ok: '#9DFF4A',
  yellow: '#FFD23F',
  red: '#FF3344',
};

export const gradeColors: Record<string, string> = {
  V0: '#7BD389',
  V1: '#7BD389',
  V2: '#4AA8FF',
  V3: '#4AA8FF',
  V4: '#FFD23F',
  V5: '#FFD23F',
  V6: '#FF5A1F',
  V7: '#FF5A1F',
  V8: '#FF3344',
  V9: '#FF3344',
  V10: '#B266FF',
  V11: '#B266FF',
  V12: '#B266FF',
};

export const fontDisplay =
  "'Space Grotesk', 'Wanted Sans Variable', 'Wanted Sans', system-ui, sans-serif";
export const fontMono = "'JetBrains Mono', ui-monospace, monospace";
export const fontKR =
  "'Wanted Sans Variable', 'Wanted Sans', 'Space Grotesk', system-ui, sans-serif";

export const statusLabels = {
  projecting: 'PROJECTING',
  close: 'CLOSE',
  sent: 'SENT',
  archived: 'ARCHIVED',
} as const;
