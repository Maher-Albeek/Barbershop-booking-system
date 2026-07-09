import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  acceptAllConsent,
  CookieConsentState,
  CookieScriptDefinition,
  rejectAllConsent,
} from "./cookieTypes";
import { buildStoredConsent, getDefaultConsent, readStoredConsent, writeStoredConsent } from "./cookieStorage";

type CookieConsentContextValue = {
  consent: CookieConsentState;
  hasStoredConsent: boolean;
  isBannerVisible: boolean;
  isSettingsOpen: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  savePreferences: (preferences: Pick<CookieConsentState, "preferences" | "statistics" | "marketing">) => void;
  withdrawConsent: () => void;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
};

type CookieConsentProviderProps = {
  children: ReactNode;
  scriptLoaders?: CookieScriptDefinition[];
};

const CookieConsentContext = createContext<CookieConsentContextValue | undefined>(undefined);

const loadConsentedScripts = (
  consent: CookieConsentState,
  scriptLoaders: CookieScriptDefinition[],
  loadedScriptIds: Set<string>,
) => {
  scriptLoaders.forEach((script) => {
    if (!consent[script.category] && loadedScriptIds.has(script.id)) {
      loadedScriptIds.delete(script.id);
      void script.unload?.();
      return;
    }

    if (!consent[script.category] || loadedScriptIds.has(script.id)) return;

    loadedScriptIds.add(script.id);
    void script.load();
  });
};

export const CookieConsentProvider = ({ children, scriptLoaders = [] }: CookieConsentProviderProps) => {
  const [storedConsent, setStoredConsent] = useState<CookieConsentState | null>(() => readStoredConsent());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const loadedScriptIds = useRef(new Set<string>());

  const consent = storedConsent ?? getDefaultConsent();
  const hasStoredConsent = storedConsent !== null;

  const persistConsent = useCallback((nextConsent: CookieConsentState) => {
    writeStoredConsent(nextConsent);
    setStoredConsent(nextConsent);
    setIsSettingsOpen(false);
  }, []);

  const acceptAll = useCallback(() => {
    persistConsent(acceptAllConsent());
  }, [persistConsent]);

  const rejectAll = useCallback(() => {
    persistConsent(rejectAllConsent());
  }, [persistConsent]);

  const savePreferences = useCallback(
    (preferences: Pick<CookieConsentState, "preferences" | "statistics" | "marketing">) => {
      persistConsent(buildStoredConsent(preferences));
    },
    [persistConsent],
  );

  const withdrawConsent = useCallback(() => {
    persistConsent(rejectAllConsent());
  }, [persistConsent]);

  const openSettingsModal = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const closeSettingsModal = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  useEffect(() => {
    if (!storedConsent) return;
    loadConsentedScripts(storedConsent, scriptLoaders, loadedScriptIds.current);
  }, [scriptLoaders, storedConsent]);

  const value = useMemo<CookieConsentContextValue>(
    () => ({
      consent,
      hasStoredConsent,
      isBannerVisible: !hasStoredConsent && !isSettingsOpen,
      isSettingsOpen,
      acceptAll,
      rejectAll,
      savePreferences,
      withdrawConsent,
      openSettingsModal,
      closeSettingsModal,
    }),
    [
      acceptAll,
      closeSettingsModal,
      consent,
      hasStoredConsent,
      isSettingsOpen,
      openSettingsModal,
      rejectAll,
      savePreferences,
      withdrawConsent,
    ],
  );

  return <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>;
};

export const useCookieConsentContext = () => {
  const context = useContext(CookieConsentContext);
  if (!context) {
    throw new Error("useCookieConsentContext must be used inside CookieConsentProvider.");
  }

  return context;
};
