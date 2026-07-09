import { FormEvent, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CalendarDays, ChevronLeft, ChevronRight, ImagePlus, LogOut, Trash2 } from "lucide-react";
import {
  addGalleryImage,
  blockSlotRange,
  convertImageFileToAvif,
  defaultHeroImage,
  deleteGalleryImage,
  deleteHeroImage,
  formatGermanDate,
  getBlockEndTimes,
  getBookings,
  getGalleryImages,
  getHeroImage,
  getSlots,
  getWorkingTimes,
  isAdminAuthenticated,
  loginAdmin,
  logoutAdmin,
  saveHeroImage,
  unblockSlot,
} from "../lib/storage";

const emptyBlockedTime = {
  date: new Date().toISOString().slice(0, 10),
  startTime: "09:00",
  endTime: "10:00",
};

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function addMinutes(time: string, duration: number) {
  const totalMinutes = timeToMinutes(time) + duration;
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(date);
}

function getCalendarMonthDays(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const leadingEmptyDays = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: Array<{ dateKey: string; day: number } | null> = Array.from({ length: leadingEmptyDays }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push({ dateKey: getDateKey(new Date(year, month, day)), day });
  }

  return days;
}

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [authenticated, setAuthenticated] = useState(isAdminAuthenticated);
  const [loginError, setLoginError] = useState("");
  const [blockError, setBlockError] = useState("");
  const [imageMessage, setImageMessage] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [blockedTimeForm, setBlockedTimeForm] = useState(emptyBlockedTime);
  const [blockedListDate, setBlockedListDate] = useState(emptyBlockedTime.date);
  const [selectedBlockedSlotIds, setSelectedBlockedSlotIds] = useState<string[]>([]);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [blockedCalendarOpen, setBlockedCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const initialDate = new Date(`${blockedListDate}T12:00:00`);
    return new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
  });
  const { data: slots = [] } = useQuery({ queryKey: ["slots"], queryFn: getSlots });
  const { data: bookings = [] } = useQuery({ queryKey: ["bookings"], queryFn: getBookings });
  const { data: galleryImages = [] } = useQuery({ queryKey: ["galleryImages"], queryFn: getGalleryImages });
  const { data: heroImage } = useQuery({ queryKey: ["heroImage"], queryFn: getHeroImage });
  const workingTimes = getWorkingTimes();
  const blockEndTimes = getBlockEndTimes();
  const endTimeOptions = blockEndTimes.filter((time) => timeToMinutes(time) > timeToMinutes(blockedTimeForm.startTime));
  const blockedSlots = useMemo(
    () =>
      slots
        .filter((slot) => slot.status === "blocked")
        .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)),
    [slots],
  );
  const blockedSlotsForSelectedDate = useMemo(
    () => blockedSlots.filter((slot) => slot.date === blockedListDate).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [blockedListDate, blockedSlots],
  );
  const selectedBlockedSlots = useMemo(
    () => blockedSlotsForSelectedDate.filter((slot) => selectedBlockedSlotIds.includes(slot.id)),
    [blockedSlotsForSelectedDate, selectedBlockedSlotIds],
  );
  const allVisibleBlockedSlotsSelected =
    blockedSlotsForSelectedDate.length > 0 && blockedSlotsForSelectedDate.every((slot) => selectedBlockedSlotIds.includes(slot.id));
  const blockedDateKeys = useMemo(() => new Set(blockedSlots.map((slot) => slot.date)), [blockedSlots]);
  const calendarDays = useMemo(() => getCalendarMonthDays(calendarMonth), [calendarMonth]);
  const todayKey = getDateKey(new Date());
  const bookedSlots = slots.filter((slot) => slot.status === "booked");

  function updateBlockedListDate(date: string) {
    const selectedDate = new Date(`${date}T12:00:00`);
    setBlockedListDate(date);
    setCalendarMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    setSelectedBlockedSlotIds([]);
    setConfirmDeleteOpen(false);
    setBlockedCalendarOpen(false);
  }

  function changeCalendarMonth(direction: number) {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
    setConfirmDeleteOpen(false);
  }

  function toggleBlockedSlotSelection(slotId: string) {
    setSelectedBlockedSlotIds((current) => (current.includes(slotId) ? current.filter((id) => id !== slotId) : [...current, slotId]));
    setConfirmDeleteOpen(false);
  }

  function toggleAllBlockedSlotsForDate() {
    setSelectedBlockedSlotIds(allVisibleBlockedSlotsSelected ? [] : blockedSlotsForSelectedDate.map((slot) => slot.id));
    setConfirmDeleteOpen(false);
  }

  function deleteSelectedBlockedSlots() {
    selectedBlockedSlots.forEach((slot) => unblockSlot(slot.id));
    setSelectedBlockedSlotIds([]);
    setConfirmDeleteOpen(false);
    queryClient.invalidateQueries({ queryKey: ["slots"] });
  }

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email"));
    const password = String(data.get("password"));
    const valid = loginAdmin(email, password);
    setAuthenticated(valid);
    setLoginError(valid ? "" : "Login fehlgeschlagen. Demo: admin@barber.local / Barber2026!");
  }

  function saveBlockedTime(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const startMinutes = timeToMinutes(blockedTimeForm.startTime);
    const endMinutes = timeToMinutes(blockedTimeForm.endTime);
    if (endMinutes <= startMinutes) {
      setBlockError("Endzeit muss nach der Startzeit liegen.");
      return;
    }
    const existingBlockedSlots = blockedSlots.filter(
      (slot) =>
        slot.date === blockedTimeForm.date &&
        timeToMinutes(slot.startTime) >= startMinutes &&
        timeToMinutes(slot.startTime) < endMinutes,
    );
    if (existingBlockedSlots.length > 0) {
      const times = existingBlockedSlots
        .map((slot) => `${slot.startTime} - ${addMinutes(slot.startTime, slot.duration)}`)
        .join(", ");
      setBlockError(`Diese Zeit ist bereits blockiert: ${times}.`);
      return;
    }

    const blockedRange = blockSlotRange(blockedTimeForm);
    if (blockedRange.length === 0) {
      setBlockError("Fuer dieses Datum und diese Uhrzeit gibt es keine blockierbaren Termine.");
      return;
    }

    setBlockError("");
    setBlockedTimeForm({ ...emptyBlockedTime, date: blockedTimeForm.date });
    setSelectedBlockedSlotIds([]);
    setConfirmDeleteOpen(false);
    queryClient.invalidateQueries({ queryKey: ["slots"] });
  }

  async function uploadHeroImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("heroImage");
    if (!(file instanceof File) || file.size === 0) return;

    try {
      setIsUploadingImage(true);
      setImageMessage("");
      const src = await convertImageFileToAvif(file);
      saveHeroImage({ src, alt: "Barbershop Hero" });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["heroImage"] });
      setImageMessage("Hero-Bild wurde als AVIF gespeichert.");
    } catch (error) {
      setImageMessage(error instanceof Error ? error.message : "Bild konnte nicht gespeichert werden.");
    } finally {
      setIsUploadingImage(false);
    }
  }

  async function uploadGalleryImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("galleryImage");
    const label = String(data.get("label") || "Galerie");
    const alt = String(data.get("alt") || label);
    if (!(file instanceof File) || file.size === 0) return;

    try {
      setIsUploadingImage(true);
      setImageMessage("");
      const src = await convertImageFileToAvif(file, 1200);
      addGalleryImage({ src, alt, label });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["galleryImages"] });
      setImageMessage("Galerie-Bild wurde als AVIF gespeichert.");
    } catch (error) {
      setImageMessage(error instanceof Error ? error.message : "Bild konnte nicht gespeichert werden.");
    } finally {
      setIsUploadingImage(false);
    }
  }

  if (!authenticated) {
    return (
      <section className="section admin-login">
        <form className="form-panel login-panel" onSubmit={handleLogin}>
          <p className="eyebrow">Admin Login</p>
          <h1>Geschuetzter Bereich</h1>
          <label>
            Email
            <input name="email" type="email" defaultValue="admin@barber.local" />
          </label>
          <label>
            Password
            <input name="password" type="password" defaultValue="Barber2026!" />
          </label>
          <button type="submit">Login</button>
          {loginError && <p className="error-message">{loginError}</p>}
        </form>
      </section>
    );
  }

  return (
    <section className="section admin-page">
      <div className="admin-topbar">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Termine verwalten</h1>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            logoutAdmin();
            setAuthenticated(false);
          }}
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>

      <div className="admin-grid">
        <form className="form-panel" onSubmit={saveBlockedTime}>
          <h2>Zeit blockieren</h2>
          <label>
            Datum
            <input
              type="date"
              value={blockedTimeForm.date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setBlockedTimeForm({ ...blockedTimeForm, date: event.target.value })}
            />
          </label>
          <label>
            Startzeit
            <select
              value={blockedTimeForm.startTime}
              onChange={(event) => {
                const startTime = event.target.value;
                const nextEndTime =
                  timeToMinutes(blockedTimeForm.endTime) > timeToMinutes(startTime) ? blockedTimeForm.endTime : addMinutes(startTime, 60);
                setBlockedTimeForm({ ...blockedTimeForm, startTime, endTime: nextEndTime });
              }}
            >
              {workingTimes.map((time) => (
                <option key={time} value={time}>
                  {time} Uhr
                </option>
              ))}
            </select>
          </label>
          <label>
            Endzeit
            <select
              value={blockedTimeForm.endTime}
              onChange={(event) => setBlockedTimeForm({ ...blockedTimeForm, endTime: event.target.value })}
            >
              {endTimeOptions.map((time) => (
                <option key={time} value={time}>
                  {time} Uhr
                </option>
              ))}
            </select>
          </label>
          {blockError && <p className="error-message">{blockError}</p>}
          <button type="submit">
            <Ban size={18} />
            Blockieren
          </button>
        </form>

        <div className="panel">
          <h2>Blockierte Zeiten</h2>
          <div className="blocked-date-filter">
            <span>Datum pruefen</span>
            <div className="blocked-calendar-wrap">
              <button
                type="button"
                className="blocked-calendar-selected"
                aria-expanded={blockedCalendarOpen}
                onClick={() => setBlockedCalendarOpen((open) => !open)}
              >
                <strong>{formatGermanDate(blockedListDate)}</strong>
                <CalendarDays size={18} />
              </button>
              {blockedCalendarOpen ? (
                <div className="blocked-calendar">
                  <div className="blocked-calendar-header">
                    <button type="button" aria-label="Vorheriger Monat" onClick={() => changeCalendarMonth(-1)}>
                      <ChevronLeft size={18} />
                    </button>
                    <strong>{getMonthLabel(calendarMonth)}</strong>
                    <button type="button" aria-label="Naechster Monat" onClick={() => changeCalendarMonth(1)}>
                      <ChevronRight size={18} />
                    </button>
                  </div>
                  <div className="blocked-calendar-weekdays" aria-hidden="true">
                    {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => (
                      <span key={day}>{day}</span>
                    ))}
                  </div>
                  <div className="blocked-calendar-grid">
                    {calendarDays.map((day, index) =>
                      day ? (
                        <button
                          key={day.dateKey}
                          type="button"
                          className={[
                            "blocked-calendar-day",
                            day.dateKey === blockedListDate ? "is-selected" : "",
                            blockedDateKeys.has(day.dateKey) ? "has-blocked-slots" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          disabled={day.dateKey < todayKey}
                          onClick={() => updateBlockedListDate(day.dateKey)}
                        >
                          <span>{day.day}</span>
                        </button>
                      ) : (
                        <span key={`empty-${index}`} className="blocked-calendar-empty" />
                      ),
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          {blockedSlotsForSelectedDate.length > 0 ? (
            <div className="blocked-list-toolbar">
              <label className="slot-select-all">
                <input type="checkbox" checked={allVisibleBlockedSlotsSelected} onChange={toggleAllBlockedSlotsForDate} />
                Alle markieren
              </label>
              <button
                type="button"
                className="danger-action"
                disabled={selectedBlockedSlots.length === 0}
                onClick={() => setConfirmDeleteOpen(true)}
              >
                <Trash2 size={16} />
                Auswahl loeschen
              </button>
            </div>
          ) : null}
          {confirmDeleteOpen ? (
            <div className="delete-confirmation">
              <strong>{selectedBlockedSlots.length} blockierte Zeit(en) wirklich loeschen?</strong>
              <span>Diese Zeiten sind danach fuer Kunden wieder buchbar.</span>
              <div>
                <button type="button" className="danger-action" onClick={deleteSelectedBlockedSlots}>
                  Ja, loeschen
                </button>
                <button type="button" className="secondary-button" onClick={() => setConfirmDeleteOpen(false)}>
                  Abbrechen
                </button>
              </div>
            </div>
          ) : null}
          <div className="table-list">
            {blockedSlotsForSelectedDate.length === 0 ? <p>Keine Zeiten fuer dieses Datum blockiert.</p> : null}
            {blockedSlotsForSelectedDate.map((slot) => (
              <article key={slot.id} className="slot-row">
                <label className="slot-select">
                  <input
                    type="checkbox"
                    checked={selectedBlockedSlotIds.includes(slot.id)}
                    onChange={() => toggleBlockedSlotSelection(slot.id)}
                  />
                  <span className="sr-only">Blockierte Zeit auswaehlen</span>
                </label>
                <div>
                  <strong>
                    {formatGermanDate(slot.date, slot.startTime)} · {slot.startTime} - {addMinutes(slot.startTime, slot.duration)}
                  </strong>
                  <span>Fuer Kunden nicht buchbar</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-grid">
        <form className="form-panel" onSubmit={uploadHeroImage}>
          <h2>Hero-Bild</h2>
          <div className="admin-image-preview">
            <img src={heroImage?.src ?? defaultHeroImage} alt={heroImage?.alt ?? "Barbershop Hero"} />
          </div>
          <label>
            Bild hochladen
            <input name="heroImage" type="file" accept="image/*" />
          </label>
          <button type="submit" disabled={isUploadingImage}>
            <ImagePlus size={18} />
            Als AVIF speichern
          </button>
          {heroImage ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                deleteHeroImage();
                queryClient.invalidateQueries({ queryKey: ["heroImage"] });
              }}
            >
              <Trash2 size={16} />
              Hero loeschen
            </button>
          ) : null}
        </form>

        <div className="panel">
          <form className="admin-media-form" onSubmit={uploadGalleryImage}>
            <h2>Galerie-Bild</h2>
            <label>
              Bild hochladen
              <input name="galleryImage" type="file" accept="image/*" />
            </label>
            <label>
              Titel
              <input name="label" placeholder="Classic Fade" />
            </label>
            <label>
              Alt Text
              <input name="alt" placeholder="Haarschnitt Ergebnis im Barbershop" />
            </label>
            <button type="submit" disabled={isUploadingImage}>
              <ImagePlus size={18} />
              Als AVIF speichern
            </button>
            {imageMessage ? <p className={imageMessage.includes("AVIF gespeichert") ? "success-message" : "error-message"}>{imageMessage}</p> : null}
          </form>

          <div className="admin-gallery-list">
            {galleryImages.map((image) => (
              <article key={image.id} className="admin-gallery-row">
                <img src={image.src} alt={image.alt} />
                <div>
                  <strong>{image.label}</strong>
                  <span>{image.createdAt === "default" ? "Standardbild" : "AVIF Upload"}</span>
                </div>
                <button
                  type="button"
                  aria-label="Galerie-Bild loeschen"
                  onClick={() => {
                    deleteGalleryImage(image.id);
                    queryClient.invalidateQueries({ queryKey: ["galleryImages"] });
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-grid">
        <div className="panel">
          <h2>Neue Terminbuchung</h2>
          {bookings.length === 0 ? <p>Noch keine Buchungen.</p> : null}
          {bookings.map((booking) => {
            const slot = bookedSlots.find((item) => item.id === booking.slotId) ?? slots.find((item) => item.id === booking.slotId);
            return (
              <article key={booking.id} className="notification-box">
                <strong>Name: {booking.customerName}</strong>
                <span>Email: {booking.customerEmail}</span>
                <span>Datum: {slot ? formatGermanDate(slot.date, slot.startTime) : "Slot geloescht"}</span>
                <span>Uhrzeit: {slot?.startTime ?? "-"} Uhr</span>
              </article>
            );
          })}
        </div>
        <div className="panel">
          <h2>Telegram Vorlage</h2>
          <div className="notification-box">
            <strong>Neue Buchung</strong>
            <span>Max Mustermann</span>
            <span>10.08.2026</span>
            <span>14:00 Uhr</span>
          </div>
        </div>
      </div>
    </section>
  );
}
