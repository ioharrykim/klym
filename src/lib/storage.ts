const canUseStorage = () => typeof window !== 'undefined' && 'localStorage' in window;

export function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`KLYM could not persist ${key}.`, error);
  }
}

export function removeJson(key: string) {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(key);
}

export const storageKeys = {
  projects: 'klym.projects.v3',
  attempts: 'klym.attempts.v3',
  signatures: 'klym.motionSignatures.v3',
  sendCards: 'klym.sendCards.v3',
  onboarding: 'klym.onboarding.v3',
};

export function uid(prefix: string) {
  const cryptoId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${cryptoId}`;
}
