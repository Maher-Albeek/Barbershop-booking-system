import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Image, LockKeyhole, QrCode, X } from "lucide-react";

export function Header() {
  const [isQrOpen, setIsQrOpen] = useState(false);

  return (
    <header className="site-header">
      <Link to="/" className="brand" aria-label="Adem Startseite">
        <img className="brand-logo" src="/barbershop-barber.svg" alt="" aria-hidden="true" width="42" height="42" decoding="async" />
        <span>Adem</span>
      </Link>
      <nav aria-label="Hauptnavigation">
        <button type="button" className="header-qr-button" onClick={() => setIsQrOpen(true)}>
          <QrCode size={18} />
          QR
        </button>
        <a href="/#gallery">
          <Image size={18} />
          Galerie
        </a>
        <a href="/#booking">
          <CalendarDays size={18} />
          Termine
        </a>
        <Link to="/admin">
          <LockKeyhole size={18} />
          Admin
        </Link>
      </nav>

      {isQrOpen ? (
        <div className="qr-modal-backdrop" role="presentation" onClick={() => setIsQrOpen(false)}>
          <section
            className="qr-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="qr-close-button" onClick={() => setIsQrOpen(false)} aria-label="QR Code schließen">
              <X size={20} />
            </button>
            <p className="eyebrow">QR Code</p>
            <h2 id="qr-modal-title">Adem Terminbuchung</h2>
            <img
              src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=https%3A%2F%2Fbarber-booking.example"
              alt="QR Code zur Adem Terminbuchung"
              width="220"
              height="220"
              loading="lazy"
              decoding="async"
            />
          </section>
        </div>
      ) : null}
    </header>
  );
}
