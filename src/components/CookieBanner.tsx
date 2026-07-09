import { useState } from "react";

export function CookieBanner() {
  const [visible, setVisible] = useState(() => localStorage.getItem("barber.cookie.notice") !== "accepted");

  if (!visible) return null;

  return (
    <section className="cookie-banner" aria-label="Cookie Hinweis">
      <p>
        Diese Demo nutzt nur technisch notwendige lokale Speicherung für Termin- und Login-Funktionen. Marketing-Cookies
        werden erst nach ausdrücklicher Einwilligung geladen.
      </p>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem("barber.cookie.notice", "accepted");
          setVisible(false);
        }}
      >
        Verstanden
      </button>
    </section>
  );
}
