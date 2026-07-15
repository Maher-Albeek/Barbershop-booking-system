import { Link } from "react-router-dom";
import { useCookieConsent } from "../useCookieConsent";

export const Footer = () => {
  const { openSettingsModal } = useCookieConsent();

  return (
    <footer className="site-footer">
      <div>
        <strong>Adem Barber</strong>
        <p>Hauptstraße 12, 10115 Berlin · +49 30 123456 · info@barber-booking.de</p>
      </div>
      <nav aria-label="Footer Navigation">
        <a href="/#booking">Verfügbare Termine</a>
        <Link to="/datenschutz">Datenschutz</Link>
        <Link to="/impressum">Impressum</Link>
        <button type="button" onClick={openSettingsModal}>
          Cookie-Einstellungen
        </button>
      </nav>
    </footer>
  );
};
