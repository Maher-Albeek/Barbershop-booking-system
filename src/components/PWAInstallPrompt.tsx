import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import {
  dismissInstallPrompt,
  promptInstallApp,
  setupInstallPrompt,
  subscribeInstallPrompt,
  type InstallPromptStatus,
} from "../pwa/installPrompt";

export function PWAInstallPrompt() {
  const [status, setStatus] = useState<InstallPromptStatus>("unsupported");

  useEffect(() => {
    const cleanupInstallPrompt = setupInstallPrompt();
    const unsubscribe = subscribeInstallPrompt(setStatus);

    return () => {
      unsubscribe();
      cleanupInstallPrompt();
    };
  }, []);

  if (status !== "available") {
    return null;
  }

  return (
    <section className="pwa-install-toast" role="dialog" aria-live="polite" aria-label="Barber Booking installieren">
      <div className="pwa-install-icon" aria-hidden="true">
        <Download size={22} />
      </div>
      <div className="pwa-install-copy">
        <strong>Install Barber Booking</strong>
        <p>Install Barber Booking for faster access.</p>
      </div>
      <div className="pwa-install-actions">
        <button type="button" className="cookie-button cookie-button-accent" onClick={() => void promptInstallApp()}>
          Install
        </button>
        <button type="button" className="cookie-button cookie-button-secondary" onClick={dismissInstallPrompt}>
          Later
        </button>
      </div>
    </section>
  );
}
