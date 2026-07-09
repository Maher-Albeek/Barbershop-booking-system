import { Link } from "react-router-dom";
import { CookieSettingsModal } from "./CookieSettingsModal";
import { useCookieConsent } from "../useCookieConsent";

const bannerText =
  "Wir verwenden Cookies, um unsere Website sicher zu betreiben, Einstellungen zu speichern und – mit Ihrer Zustimmung – statistische Auswertungen sowie Marketingmaßnahmen durchzuführen. Sie können Ihre Auswahl jederzeit ändern.";

export function CookieConsent() {
  const { isBannerVisible, acceptAll, rejectAll, openSettingsModal } = useCookieConsent();

  return (
    <>
      {isBannerVisible ? (
        <section
          className="cookie-consent-banner"
          role="dialog"
          aria-modal="false"
          aria-labelledby="cookie-banner-title"
          aria-describedby="cookie-banner-description"
        >
          <div className="cookie-banner-content">
            <p className="cookie-eyebrow">Cookie-Hinweis</p>
            <h2 id="cookie-banner-title">Ihre Privatsphaere</h2>
            <p id="cookie-banner-description">{bannerText}</p>
            <div className="cookie-banner-links" aria-label="Rechtliche Links">
              <Link to="/datenschutz">Datenschutzerkl&auml;rung</Link>
              <Link to="/impressum">Impressum</Link>
            </div>
          </div>

          <div className="cookie-banner-actions">
            <button type="button" className="cookie-button cookie-button-strong" onClick={acceptAll}>
              Alle akzeptieren
            </button>
            <button type="button" className="cookie-button cookie-button-strong" onClick={rejectAll}>
              Alle ablehnen
            </button>
            <button type="button" className="cookie-button cookie-button-secondary" onClick={openSettingsModal}>
              Einstellungen
            </button>
          </div>
        </section>
      ) : null}

      <CookieSettingsModal />
    </>
  );
}
