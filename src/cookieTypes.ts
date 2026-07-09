export const COOKIE_CONSENT_VERSION = "1.0" as const;

export type OptionalCookieCategory = "preferences" | "statistics" | "marketing";
export type CookieCategory = "necessary" | OptionalCookieCategory;

export type CookieConsentState = {
  necessary: true;
  preferences: boolean;
  statistics: boolean;
  marketing: boolean;
  timestamp: string;
  version: typeof COOKIE_CONSENT_VERSION;
};

export type CookieCategoryDefinition = {
  id: CookieCategory;
  title: string;
  description: string;
  examples: string[];
  required: boolean;
};

export type CookieScriptDefinition = {
  id: string;
  category: OptionalCookieCategory;
  load: () => void | Promise<void>;
  unload?: () => void | Promise<void>;
};

export const cookieCategoryDefinitions: CookieCategoryDefinition[] = [
  {
    id: "necessary",
    title: "Notwendige Cookies",
    description:
      "Diese Cookies sind für den sicheren Betrieb, die Terminbuchung, den Login, den Schutz vor Missbrauch und die technische Bereitstellung der Website erforderlich.",
    examples: ["Session", "Authentifizierung", "CSRF-Schutz", "Sicherheit", "Buchungssitzung"],
    required: true,
  },
  {
    id: "preferences",
    title: "Präferenzen",
    description:
      "Diese Cookies speichern freiwillige Einstellungen, damit die Website für Sie komfortabler funktioniert.",
    examples: ["Sprache", "Designmodus", "UI-Einstellungen"],
    required: false,
  },
  {
    id: "statistics",
    title: "Statistiken",
    description:
      "Diese Dienste helfen uns, die Nutzung der Website zu verstehen und das Angebot zu verbessern. Sie werden erst nach Ihrer Einwilligung geladen.",
    examples: ["Google Analytics", "Matomo", "Plausible, wenn Cookies genutzt werden"],
    required: false,
  },
  {
    id: "marketing",
    title: "Marketing",
    description:
      "Diese Dienste können zur Messung von Kampagnen und zur Anzeige relevanter Werbung eingesetzt werden. Sie werden erst nach Ihrer Einwilligung geladen.",
    examples: ["Meta Pixel", "Google Ads", "TikTok Pixel"],
    required: false,
  },
];

export const createConsentState = (
  values: Pick<CookieConsentState, "preferences" | "statistics" | "marketing">,
): CookieConsentState => ({
  necessary: true,
  preferences: values.preferences,
  statistics: values.statistics,
  marketing: values.marketing,
  timestamp: new Date().toISOString(),
  version: COOKIE_CONSENT_VERSION,
});

export const rejectAllConsent = (): CookieConsentState =>
  createConsentState({
    preferences: false,
    statistics: false,
    marketing: false,
  });

export const acceptAllConsent = (): CookieConsentState =>
  createConsentState({
    preferences: true,
    statistics: true,
    marketing: true,
  });
