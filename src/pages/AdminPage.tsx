import { FormEvent, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, ChevronLeft, ChevronRight, Download, ImagePlus, LogOut, Trash2 } from "lucide-react";
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
import type { AppointmentSlot, Booking } from "../lib/types";

type AdminSection = "slots" | "gallery";
type SlotViewFilter = "all" | "booked" | "blocked";

const emptyBlockedTime = {
  date: new Date().toISOString().slice(0, 10),
  startTime: "09:00",
  endTime: "10:00",
  blockedReason: "",
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

function sanitizePdfText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function pdfText(value: string, x: number, y: number, size = 10, font = "F1") {
  return `BT /${font} ${size} Tf ${x} ${y} Td (${sanitizePdfText(value)}) Tj ET`;
}

function buildBookingsPdf(bookings: Booking[], slots: AppointmentSlot[]) {
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 42;
  const rowHeight = 58;
  const bookingsByPage: Booking[][] = [];
  let currentPage: Booking[] = [];

  bookings.forEach((booking) => {
    if (currentPage.length === 10) {
      bookingsByPage.push(currentPage);
      currentPage = [];
    }
    currentPage.push(booking);
  });
  bookingsByPage.push(currentPage);

  const objects: string[] = [];
  const pages: number[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  bookingsByPage.forEach((pageBookings, pageIndex) => {
    const content: string[] = [
      "0.96 0.94 0.9 rg 0 0 595 842 re f",
      "0.70 0.33 0.18 rg 0 782 595 60 re f",
      pdfText("Adem Barbershop", margin, 812, 18, "F2"),
      pdfText("Booking list", margin, 792, 11),
      pdfText(`Generated: ${new Date().toLocaleDateString("de-DE")}`, 420, 812, 10),
      "1 1 1 rg 42 724 511 34 re f",
      "0.86 0.84 0.79 RG 42 724 511 34 re S",
      pdfText("Client", 56, 737, 10, "F2"),
      pdfText("Date", 210, 737, 10, "F2"),
      pdfText("Time", 318, 737, 10, "F2"),
      pdfText("Contact", 390, 737, 10, "F2"),
    ];

    if (bookings.length === 0) {
      content.push("1 1 1 rg 42 650 511 58 re f");
      content.push("0.86 0.84 0.79 RG 42 650 511 58 re S");
      content.push(pdfText("No bookings yet.", 56, 680, 12, "F2"));
    }

    pageBookings.forEach((booking, index) => {
      const y = 666 - index * rowHeight;
      const slot = slots.find((item) => item.id === booking.slotId);
      content.push(index % 2 === 0 ? "1 1 1 rg" : "0.985 0.98 0.965 rg");
      content.push(`42 ${y} 511 50 re f`);
      content.push(`0.86 0.84 0.79 RG 42 ${y} 511 50 re S`);
      content.push(pdfText(booking.customerName, 56, y + 31, 10, "F2"));
      content.push(pdfText(booking.message ? `Note: ${booking.message.slice(0, 36)}` : "No note", 56, y + 15, 8));
      content.push(pdfText(slot ? formatGermanDate(slot.date, slot.startTime) : "Slot deleted", 210, y + 31, 9));
      content.push(pdfText(slot?.startTime ? `${slot.startTime} Uhr` : "-", 318, y + 31, 9));
      content.push(pdfText(booking.customerEmail, 390, y + 31, 8));
      content.push(pdfText(booking.customerPhone || "-", 390, y + 16, 8));
    });

    content.push(pdfText(`Page ${pageIndex + 1} / ${bookingsByPage.length}`, 488, 32, 9));

    const contentStream = content.join("\n");
    const contentObjectNumber = objects.length + 1;
    objects.push(`<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`);
    const pageObjectNumber = objects.length + 1;
    pages.push(pageObjectNumber);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
    );
  });

  objects[1] = `<< /Type /Pages /Kids [${pages.map((page) => `${page} 0 R`).join(" ")}] /Count ${pages.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [authenticated, setAuthenticated] = useState(isAdminAuthenticated);
  const [activeSection, setActiveSection] = useState<AdminSection>("slots");
  const [loginError, setLoginError] = useState("");
  const [blockError, setBlockError] = useState("");
  const [imageMessage, setImageMessage] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [blockedTimeForm, setBlockedTimeForm] = useState(emptyBlockedTime);
  const [blockedListDate, setBlockedListDate] = useState(emptyBlockedTime.date);
  const [slotViewFilter, setSlotViewFilter] = useState<SlotViewFilter>("all");
  const [selectedBlockedSlotIds, setSelectedBlockedSlotIds] = useState<string[]>([]);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
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
  const bookedSlots = useMemo(() => slots.filter((slot) => slot.status === "booked"), [slots]);
  const bookedDateKeys = useMemo(() => new Set(bookedSlots.map((slot) => slot.date)), [bookedSlots]);
  const calendarDays = useMemo(() => getCalendarMonthDays(calendarMonth), [calendarMonth]);
  const todayKey = getDateKey(new Date());
  const bookingsBySlotId = useMemo(() => new Map(bookings.map((booking) => [booking.slotId, booking])), [bookings]);
  const bookedSlotsForSelectedDate = useMemo(
    () => bookedSlots.filter((slot) => slot.date === blockedListDate).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [blockedListDate, bookedSlots],
  );
  const occupiedSlotsForSelectedDate = useMemo(
    () => [...blockedSlotsForSelectedDate, ...bookedSlotsForSelectedDate].sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [blockedSlotsForSelectedDate, bookedSlotsForSelectedDate],
  );
  const visibleOccupiedSlotsForSelectedDate = useMemo(
    () =>
      occupiedSlotsForSelectedDate.filter((slot) => {
        if (slotViewFilter === "booked") return slot.status === "booked";
        if (slotViewFilter === "blocked") return slot.status === "blocked";
        return true;
      }),
    [occupiedSlotsForSelectedDate, slotViewFilter],
  );
  const adminSections: Array<{ id: AdminSection; label: string }> = [
    { id: "slots", label: "Slots" },
    { id: "gallery", label: "Galerie" },
  ];
  const activeSectionTitle = adminSections.find((section) => section.id === activeSection)?.label ?? "Slots";

  function updateBlockedListDate(date: string) {
    const selectedDate = new Date(`${date}T12:00:00`);
    setBlockedListDate(date);
    setCalendarMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    setSelectedBlockedSlotIds([]);
    setConfirmDeleteOpen(false);
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
    const existingBookedSlots = bookedSlots.filter(
      (slot) =>
        slot.date === blockedTimeForm.date &&
        timeToMinutes(slot.startTime) >= startMinutes &&
        timeToMinutes(slot.startTime) < endMinutes,
    );
    if (existingBookedSlots.length > 0) {
      const times = existingBookedSlots
        .map((slot) => {
          const booking = bookingsBySlotId.get(slot.id);
          return `${slot.startTime} Uhr${booking ? ` (${booking.customerName})` : ""}`;
        })
        .join(", ");
      setBlockError(`Diese Zeit ist bereits von Kunden gebucht: ${times}.`);
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
          <h1>{activeSectionTitle} verwalten</h1>
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

      <nav className="admin-section-nav" aria-label="Admin Bereiche">
        {adminSections.map((section) => (
          <button
            key={section.id}
            type="button"
            className={activeSection === section.id ? "is-active" : ""}
            aria-current={activeSection === section.id ? "page" : undefined}
            onClick={() => setActiveSection(section.id)}
          >
            {section.label}
          </button>
        ))}
      </nav>

      {activeSection === "slots" ? (
      <div className="admin-grid">
        <form className="form-panel block-time-panel" onSubmit={saveBlockedTime}>
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
          <label>
            Grund
            <textarea
              value={blockedTimeForm.blockedReason}
              rows={3}
              placeholder="z.B. Pause, privater Termin oder Wartung"
              onChange={(event) => setBlockedTimeForm({ ...blockedTimeForm, blockedReason: event.target.value })}
            />
          </label>
          {blockError && <p className="error-message">{blockError}</p>}
          <button type="submit">
            <Ban size={18} />
            Blockieren
          </button>
        </form>

        <div className="panel slots-overview-panel">
          <div className="panel-heading-actions">
            <h2>Blockierte Zeiten und Buchungen</h2>
            <button
              type="button"
              className="secondary-button"
              onClick={() => downloadBlob(buildBookingsPdf(bookings, slots), `barbershop-bookings-${new Date().toISOString().slice(0, 10)}.pdf`)}
            >
              <Download size={16} />
              PDF herunterladen
            </button>
          </div>
          <div className="blocked-calendar blocked-calendar-inline">
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
                      bookedDateKeys.has(day.dateKey) ? "has-booked-slots" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={day.dateKey < todayKey}
                    onClick={() => updateBlockedListDate(day.dateKey)}
                  >
                    <span>{day.day}</span>
                    <span className="calendar-day-markers" aria-hidden="true">
                      {blockedDateKeys.has(day.dateKey) ? <span className="calendar-marker calendar-marker-blocked" /> : null}
                      {bookedDateKeys.has(day.dateKey) ? <span className="calendar-marker calendar-marker-booked" /> : null}
                    </span>
                  </button>
                ) : (
                  <span key={`empty-${index}`} className="blocked-calendar-empty" />
                ),
              )}
            </div>
          </div>
          <div className="calendar-legend" aria-label="Kalender Legende">
            <span>
              <span className="calendar-marker calendar-marker-blocked" />
              Blockiert
            </span>
            <span>
              <span className="calendar-marker calendar-marker-booked" />
              Gebucht
            </span>
          </div>
          <div className="slot-day-heading">
            <strong>{formatGermanDate(blockedListDate)}</strong>
            <span>
              {blockedSlotsForSelectedDate.length} blockiert · {bookedSlotsForSelectedDate.length} gebucht
            </span>
          </div>
          <div className="slot-filter-tabs" aria-label="Terminfilter">
            {[
              { id: "all", label: "Alle" },
              { id: "booked", label: "Nur gebucht" },
              { id: "blocked", label: "Nur blockiert" },
            ].map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={slotViewFilter === filter.id ? "is-active" : ""}
                onClick={() => {
                  setSlotViewFilter(filter.id as SlotViewFilter);
                  setSelectedBlockedSlotIds([]);
                  setConfirmDeleteOpen(false);
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>
          {slotViewFilter !== "booked" && blockedSlotsForSelectedDate.length > 0 ? (
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
            {visibleOccupiedSlotsForSelectedDate.length === 0 ? <p>Keine passenden Zeiten fuer dieses Datum.</p> : null}
            {visibleOccupiedSlotsForSelectedDate.map((slot) => {
              const booking = bookingsBySlotId.get(slot.id);
              const isBooked = slot.status === "booked";
              return (
                <article key={slot.id} className={`slot-row ${isBooked ? "slot-row-booked" : "slot-row-blocked"}`}>
                  {isBooked ? (
                    <span className="slot-status-dot slot-status-dot-booked" aria-label="Kundenbuchung" />
                  ) : (
                    <>
                      <label className="slot-select">
                        <input
                          type="checkbox"
                          checked={selectedBlockedSlotIds.includes(slot.id)}
                          onChange={() => toggleBlockedSlotSelection(slot.id)}
                        />
                        <span className="sr-only">Blockierte Zeit auswaehlen</span>
                      </label>
                      <span className="slot-status-dot slot-status-dot-blocked" aria-label="Blockierte Zeit" />
                    </>
                  )}
                  <div>
                    <strong>
                      {formatGermanDate(slot.date, slot.startTime)} · {slot.startTime} - {addMinutes(slot.startTime, slot.duration)}
                    </strong>
                    {isBooked ? (
                      <>
                        <span>Kundenbuchung{booking ? `: ${booking.customerName}` : ""}</span>
                        {booking?.customerEmail ? <span>{booking.customerEmail}</span> : null}
                      </>
                    ) : (
                      <span>{slot.blockedReason ? `Grund: ${slot.blockedReason}` : "Fuer Kunden nicht buchbar"}</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
      ) : null}

      {activeSection === "gallery" ? (
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
      ) : null}

    </section>
  );
}
