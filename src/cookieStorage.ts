import {
  COOKIE_CONSENT_VERSION,
  CookieConsentState,
  createConsentState,
  rejectAllConsent,
} from "./cookieTypes";

const COOKIE_CONSENT_STORAGE_KEY = "barber.cookie.consent";

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

const isStoredConsent = (value: unknown): value is CookieConsentState => {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;

  return (
    candidate.necessary === true &&
    isBoolean(candidate.preferences) &&
    isBoolean(candidate.statistics) &&
    isBoolean(candidate.marketing) &&
    typeof candidate.timestamp === "string" &&
    candidate.version === COOKIE_CONSENT_VERSION
  );
};

export const getDefaultConsent = (): CookieConsentState => rejectAllConsent();

export const readStoredConsent = (): CookieConsentState | null => {
  if (typeof window === "undefined") return null;

  try {
    const rawConsent = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!rawConsent) return null;

    const parsedConsent: unknown = JSON.parse(rawConsent);
    return isStoredConsent(parsedConsent) ? parsedConsent : null;
  } catch {
    return null;
  }
};

export const writeStoredConsent = (consent: CookieConsentState): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(consent));
};

export const clearStoredConsent = (): void => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
};

export const buildStoredConsent = (values: {
  preferences: boolean;
  statistics: boolean;
  marketing: boolean;
}): CookieConsentState => createConsentState(values);
