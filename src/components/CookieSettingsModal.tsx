import { ChangeEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cookieCategoryDefinitions, CookieConsentState, OptionalCookieCategory } from "../cookieTypes";
import { useCookieConsent } from "../useCookieConsent";

type PreferenceSelection = Pick<CookieConsentState, "preferences" | "statistics" | "marketing">;

const optionalCategories: OptionalCookieCategory[] = ["preferences", "statistics", "marketing"];

const focusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function CookieSettingsModal() {
  const {
    consent,
    hasStoredConsent,
    isSettingsOpen,
    acceptAll,
    rejectAll,
    savePreferences,
    closeSettingsModal,
  } = useCookieConsent();
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [selection, setSelection] = useState<PreferenceSelection>({
    preferences: consent.preferences,
    statistics: consent.statistics,
    marketing: consent.marketing,
  });

  useEffect(() => {
    if (!isSettingsOpen) return;

    setSelection({
      preferences: consent.preferences,
      statistics: consent.statistics,
      marketing: consent.marketing,
    });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [consent.marketing, consent.preferences, consent.statistics, isSettingsOpen]);

  if (!isSettingsOpen) return null;

  const updateSelection = (category: OptionalCookieCategory) => (event: ChangeEvent<HTMLInputElement>) => {
    setSelection((current) => ({
      ...current,
      [category]: event.target.checked,
    }));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      closeSettingsModal();
      return;
    }

    if (event.key !== "Tab" || !modalRef.current) return;

    const focusableElements = Array.from(modalRef.current.querySelectorAll<HTMLElement>(focusableSelector));
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  return (
    <div className="cookie-modal-backdrop" role="presentation">
      <div
        ref={modalRef}
        className="cookie-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-settings-title"
        aria-describedby="cookie-settings-description"
        onKeyDown={handleKeyDown}
      >
        <div className="cookie-modal-header">
          <div>
            <p className="cookie-eyebrow">Datenschutz</p>
            <h2 id="cookie-settings-title">Cookie-Einstellungen</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="cookie-icon-button"
            onClick={closeSettingsModal}
            aria-label="Cookie-Einstellungen schließen"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <p id="cookie-settings-description" className="cookie-modal-copy">
          Sie können freiwillige Cookies jederzeit aktivieren, deaktivieren oder Ihre Einwilligung widerrufen.
          Notwendige Cookies bleiben aktiv, weil sie für Sicherheit, Login und Buchung erforderlich sind.
        </p>

        <div className="cookie-category-list" aria-label="Cookie-Kategorien">
          {cookieCategoryDefinitions.map((category) => {
            const isOptional = optionalCategories.includes(category.id as OptionalCookieCategory);
            const checked = category.id === "necessary" ? true : selection[category.id as OptionalCookieCategory];

            return (
              <section className="cookie-category-card" key={category.id} aria-labelledby={`cookie-${category.id}`}>
                <div className="cookie-category-content">
                  <h3 id={`cookie-${category.id}`}>{category.title}</h3>
                  <p>{category.description}</p>
                  <p className="cookie-examples">
                    Beispiele: <span>{category.examples.join(", ")}</span>
                  </p>
                </div>

                <label className="cookie-switch">
                  <span className="sr-only">
                    {category.required ? `${category.title} sind immer aktiv` : `${category.title} umschalten`}
                  </span>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={category.required}
                    onChange={isOptional ? updateSelection(category.id as OptionalCookieCategory) : undefined}
                  />
                  <span aria-hidden="true" />
                </label>
              </section>
            );
          })}
        </div>

        <div className="cookie-modal-actions">
          <button type="button" className="cookie-button cookie-button-strong" onClick={acceptAll}>
            Alle akzeptieren
          </button>
          <button type="button" className="cookie-button cookie-button-strong" onClick={rejectAll}>
            Alle ablehnen
          </button>
          <button type="button" className="cookie-button cookie-button-accent" onClick={() => savePreferences(selection)}>
            Auswahl speichern
          </button>
        </div>

        {hasStoredConsent ? (
          <p className="cookie-withdraw-copy">
            Durch "Alle ablehnen" widerrufen Sie freiwillige Einwilligungen für Präferenzen, Statistik und Marketing.
          </p>
        ) : null}
      </div>
    </div>
  );
}
