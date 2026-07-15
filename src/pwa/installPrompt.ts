export type InstallPromptStatus = "unsupported" | "available" | "installed" | "dismissed";

type PromptOutcome = "accepted" | "dismissed";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: PromptOutcome; platform: string }>;
  prompt: () => Promise<void>;
}

type InstallPromptListener = (status: InstallPromptStatus) => void;

const DISMISSED_KEY = "barber.pwa.install.dismissed.v1";

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<InstallPromptListener>();

function isIosStandalone() {
  return "standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || isIosStandalone();
}

function wasDismissed() {
  return localStorage.getItem(DISMISSED_KEY) === "true";
}

function setDismissed(value: boolean) {
  if (value) {
    localStorage.setItem(DISMISSED_KEY, "true");
  } else {
    localStorage.removeItem(DISMISSED_KEY);
  }
}

function getStatus(): InstallPromptStatus {
  if (isStandaloneMode()) {
    return "installed";
  }

  if (deferredPrompt) {
    return wasDismissed() ? "dismissed" : "available";
  }

  return wasDismissed() ? "dismissed" : "unsupported";
}

function notify() {
  const status = getStatus();
  listeners.forEach((listener) => listener(status));
}

export function subscribeInstallPrompt(listener: InstallPromptListener) {
  listeners.add(listener);
  listener(getStatus());

  return () => {
    listeners.delete(listener);
  };
}

export function setupInstallPrompt() {
  const handleBeforeInstallPrompt = (event: Event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  };

  const handleAppInstalled = () => {
    deferredPrompt = null;
    setDismissed(false);
    notify();
  };

  window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  window.addEventListener("appinstalled", handleAppInstalled);

  return () => {
    window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.removeEventListener("appinstalled", handleAppInstalled);
  };
}

export async function promptInstallApp() {
  if (!deferredPrompt) {
    return "dismissed" satisfies PromptOutcome;
  }

  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;

  if (choice.outcome === "dismissed") {
    setDismissed(true);
  }

  notify();
  return choice.outcome;
}

export function dismissInstallPrompt() {
  setDismissed(true);
  notify();
}
