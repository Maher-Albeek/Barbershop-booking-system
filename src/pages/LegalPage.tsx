type Props = {
  type: "impressum" | "datenschutz";
};

export default function LegalPage({ type }: Props) {
  const isImpressum = type === "impressum";

  return (
    <section className="section legal-page">
      <p className="eyebrow">{isImpressum ? "Impressum" : "Datenschutzerklärung"}</p>
      <h1>{isImpressum ? "Impressum" : "Datenschutzerklärung"}</h1>
      {isImpressum ? (
        <>
          <p>
            Barber Booking Studio, Hauptstraße 12, 10115 Berlin. Vertreten durch Max Mustermann. Kontakt:
            info@barber-booking.de, +49 30 123456.
          </p>
          <p>
            Umsatzsteuer-ID und Aufsichtsbehörde sind projektspezifisch zu ergänzen. Diese Seite dient als
            portfoliofähige Vorlage und ersetzt keine Rechtsberatung.
          </p>
        </>
      ) : (
        <>
          <p>
            Personenbezogene Daten aus Terminbuchungen werden nur zur Bearbeitung der Anfrage gespeichert.
            Pflichtfelder sind Name, E-Mail, Termin und die Datenschutzbestätigung.
          </p>
          <p>
            Technisch notwendige Session- und Login-Daten dürfen für die Funktion des Systems verarbeitet werden.
            Marketing-Dienste wie Google Analytics, Meta Pixel oder vergleichbare Cookies werden nur nach Einwilligung
            geladen.
          </p>
        </>
      )}
    </section>
  );
}
