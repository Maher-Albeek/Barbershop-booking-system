import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <strong>Barber Booking</strong>
        <p>Hauptstraße 12, 10115 Berlin · +49 30 123456 · info@barber-booking.de</p>
      </div>
      <nav aria-label="Footer Navigation">
        <a href="/#booking">Verfügbare Termine</a>
        <Link to="/datenschutz">Datenschutz</Link>
        <Link to="/impressum">Impressum</Link>
        <button type="button" onClick={() => localStorage.removeItem("barber.cookie.notice")}>
          Cookie Settings
        </button>
      </nav>
    </footer>
  );
}
