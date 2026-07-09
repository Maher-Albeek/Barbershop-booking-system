import { Link } from "react-router-dom";
import { CalendarDays, Image, LockKeyhole, Mail, Scissors } from "lucide-react";

export function Header() {
  return (
    <header className="site-header">
      <Link to="/" className="brand" aria-label="Barber Booking System Startseite">
        <Scissors size={24} />
        <span>Barber Booking</span>
      </Link>
      <nav aria-label="Hauptnavigation">
        <a href="/#gallery">
          <Image size={18} />
          Galerie
        </a>
        <a href="/#booking">
          <CalendarDays size={18} />
          Termine
        </a>
        <a href="/#contact">
          <Mail size={18} />
          Kontakt
        </a>
        <Link to="/admin">
          <LockKeyhole size={18} />
          Admin
        </Link>
      </nav>
    </header>
  );
}
