import { FormEvent, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Ban, CheckCircle2, ChevronLeft, ChevronRight, Download, Eye, EyeOff, ImagePlus, LogOut, Save, Trash2, XCircle } from "lucide-react";
import {
  addGalleryImage,
  blockSlotRange,
  convertImageFileForStorage,
  defaultHeroImage,
  deleteGalleryImage,
  deleteHeroImage,
  formatGermanDate,
  getBookings,
  getGalleryImages,
  getHeroImage,
  getSlots,
  saveHeroImage,
  unblockSlot,
  updateBookingStatus,
} from "../lib/storage";
import { getAdminSession, loginAdmin, logoutAdmin, updateAdminProfile } from "../lib/auth";
import type { AppointmentSlot, Booking, BookingStatus } from "../lib/types";

type AdminSection = "slots" | "gallery" | "profile";
type SlotViewFilter = "all" | "booked" | "blocked" | "completed" | "cancelled" | "noShow";
type AppointmentAction = "cancelled" | "completed" | "noShow";
type AppointmentRow =
  | { type: "slot"; slot: AppointmentSlot; booking?: Booking }
  | { type: "cancelled"; booking: Booking; date: string; startTime: string };

const emptyBlockedTime = {
  startDate: new Date().toISOString().slice(0, 10),
  startTime: "09:00",
  endDate: new Date().toISOString().slice(0, 10),
  endTime: "10:00",
  blockedReason: "",
};

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && endA > startB;
}

function getBlockedDisplayRange(slot: AppointmentSlot) {
  return {
    startDate: slot.blockedStartDate ?? slot.date,
    startTime: slot.blockedStartTime ?? slot.startTime,
    endDate: slot.blockedEndDate ?? slot.date,
    endTime: slot.blockedEndTime ?? addMinutes(slot.startTime, slot.duration),
  };
}

function getDateTimeValue(date: string, time: string) {
  return new Date(`${date}T${time}:00`).getTime();
}

function formatBlockedRange(slot: AppointmentSlot) {
  const range = getBlockedDisplayRange(slot);
  const startLabel = `${formatGermanDate(range.startDate)} ${range.startTime}`;
  const endLabel = `${formatGermanDate(range.endDate)} ${range.endTime}`;
  return range.startDate === range.endDate ? `${range.startTime} - ${range.endTime}` : `${startLabel} - ${endLabel}`;
}

function addMinutes(time: string, duration: number) {
  const totalMinutes = timeToMinutes(time) + duration;
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function addMinutesWithinDay(time: string, duration: number) {
  const totalMinutes = Math.min(23 * 60 + 59, timeToMinutes(time) + duration);
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

function pdfText(value: string, x: number, y: number, size = 10, font = "F1", color = "0.13 0.10 0.08") {
  return `${color} rg BT /${font} ${size} Tf ${x} ${y} Td (${sanitizePdfText(value)}) Tj ET`;
}

const slotFilterLabels: Record<SlotViewFilter, string> = {
  all: "Alle",
  booked: "Nur gebucht",
  blocked: "Nur blockiert",
  completed: "Abgeschlossen",
  cancelled: "Storniert",
  noShow: "No Show",
};

const bookingStatusLabels: Record<BookingStatus, string> = {
  booked: "Booked",
  completed: "Completed",
  cancelled: "Cancelled",
  noShow: "No Show",
};

const cancellationReasonOptions = ["Barber unavailable", "Vacation", "Emergency", "Other"];

function getBookingStatus(booking?: Booking): BookingStatus {
  return booking?.status ?? "booked";
}

function getBookingDate(slotId: string) {
  return slotId.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
}

function getBookingTime(slotId: string) {
  return slotId.match(/^\d{4}-\d{2}-\d{2}-(\d{2}:\d{2})$/)?.[1] ?? "";
}

function buildSlotsPdf(slots: AppointmentSlot[], bookingsBySlotId: Map<string, Booking>, selectedDate: string, filter: SlotViewFilter) {
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 42;
  const rowHeight = 58;
  const slotsByPage: AppointmentSlot[][] = [];
  let currentPage: AppointmentSlot[] = [];

  slots.forEach((slot) => {
    if (currentPage.length === 10) {
      slotsByPage.push(currentPage);
      currentPage = [];
    }
    currentPage.push(slot);
  });
  slotsByPage.push(currentPage);

  const objects: string[] = [];
  const pages: number[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  slotsByPage.forEach((pageSlots, pageIndex) => {
    const content: string[] = [
      "0.96 0.94 0.9 rg 0 0 595 842 re f",
      "0.70 0.33 0.18 rg 0 782 595 60 re f",
      pdfText("Adem Barbershop", margin, 812, 18, "F2", "1 1 1"),
      pdfText(`Terminliste: ${formatGermanDate(selectedDate)}`, margin, 792, 11, "F1", "1 1 1"),
      pdfText(`Generated: ${new Date().toLocaleDateString("de-DE")}`, 420, 812, 10, "F1", "1 1 1"),
      pdfText(`Filter: ${slotFilterLabels[filter]}`, 420, 792, 10, "F1", "1 1 1"),
      "1 1 1 rg 42 724 511 34 re f",
      "0.86 0.84 0.79 RG 42 724 511 34 re S",
      pdfText("Status", 56, 737, 10, "F2"),
      pdfText("Date", 210, 737, 10, "F2"),
      pdfText("Time", 318, 737, 10, "F2"),
      pdfText("Details", 390, 737, 10, "F2"),
    ];

    if (slots.length === 0) {
      content.push("1 1 1 rg 42 650 511 58 re f");
      content.push("0.86 0.84 0.79 RG 42 650 511 58 re S");
      content.push(pdfText("Keine passenden Zeiten fuer dieses Datum.", 56, 680, 12, "F2"));
    }

    pageSlots.forEach((slot, index) => {
      const y = 666 - index * rowHeight;
      const booking = bookingsBySlotId.get(slot.id);
      const isBooked = slot.status === "booked";
      content.push(index % 2 === 0 ? "1 1 1 rg" : "0.985 0.98 0.965 rg");
      content.push(`42 ${y} 511 50 re f`);
      content.push(`0.86 0.84 0.79 RG 42 ${y} 511 50 re S`);
      content.push(pdfText(isBooked ? "Gebucht" : "Blockiert", 56, y + 31, 10, "F2", isBooked ? "0.08 0.28 0.55" : "0.63 0.16 0.16"));
      content.push(pdfText(isBooked && booking ? booking.customerName : "Fuer Kunden gesperrt", 56, y + 18, 8));
      content.push(pdfText(isBooked && booking?.service ? `Service: ${booking.service}` : "", 56, y + 8, 8));
      content.push(pdfText(formatGermanDate(slot.date, slot.startTime), 210, y + 31, 9));
      content.push(pdfText(`${slot.startTime} - ${isBooked ? addMinutes(slot.startTime, slot.duration) : getBlockedDisplayRange(slot).endTime}`, 318, y + 31, 9));
      content.push(pdfText(isBooked ? booking?.customerEmail ?? "-" : slot.blockedReason ? `Grund: ${slot.blockedReason}` : "Kein Grund angegeben", 390, y + 31, 8));
      content.push(pdfText(isBooked ? booking?.customerPhone ?? "-" : formatBlockedRange(slot), 390, y + 16, 8));
    });

    content.push(pdfText(`Page ${pageIndex + 1} / ${slotsByPage.length}`, 488, 32, 9));

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
  const [authLoading, setAuthLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [activeSection, setActiveSection] = useState<AdminSection>("slots");
  const [loginError, setLoginError] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [blockError, setBlockError] = useState("");
  const [imageMessage, setImageMessage] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileForm, setProfileForm] = useState(() => ({
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  }));
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [blockedTimeForm, setBlockedTimeForm] = useState(emptyBlockedTime);
  const [blockedListDate, setBlockedListDate] = useState(emptyBlockedTime.startDate);
  const [slotViewFilter, setSlotViewFilter] = useState<SlotViewFilter>("all");
  const [appointmentSearch, setAppointmentSearch] = useState("");
  const [appointmentMessage, setAppointmentMessage] = useState("");
  const [appointmentError, setAppointmentError] = useState("");
  const [pendingAppointmentId, setPendingAppointmentId] = useState<string | null>(null);
  const [appointmentDialog, setAppointmentDialog] = useState<{ action: AppointmentAction; booking: Booking; slot?: AppointmentSlot } | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
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
        const bookingStatus = getBookingStatus(bookingsBySlotId.get(slot.id));
        if (slotViewFilter === "booked") return slot.status === "booked" && bookingStatus === "booked";
        if (slotViewFilter === "blocked") return slot.status === "blocked";
        if (slotViewFilter === "completed") return bookingStatus === "completed";
        if (slotViewFilter === "noShow") return bookingStatus === "noShow";
        if (slotViewFilter === "cancelled") return false;
        return true;
      }),
    [bookingsBySlotId, occupiedSlotsForSelectedDate, slotViewFilter],
  );
  const cancelledAppointmentsForSelectedDate = useMemo(
    () =>
      bookings
        .filter((booking) => getBookingStatus(booking) === "cancelled" && getBookingDate(booking.slotId) === blockedListDate)
        .sort((a, b) => getBookingTime(a.slotId).localeCompare(getBookingTime(b.slotId))),
    [blockedListDate, bookings],
  );
  const visibleAppointmentRows = useMemo(() => {
    const rows: AppointmentRow[] = [
      ...visibleOccupiedSlotsForSelectedDate.map((slot) => ({ type: "slot" as const, slot, booking: bookingsBySlotId.get(slot.id) })),
      ...cancelledAppointmentsForSelectedDate.map((booking) => ({
        type: "cancelled" as const,
        booking,
        date: getBookingDate(booking.slotId),
        startTime: getBookingTime(booking.slotId),
      })),
    ];
    const search = appointmentSearch.trim().toLowerCase();
    return rows.filter((row) => {
      if (slotViewFilter === "cancelled" && getBookingStatus(row.booking) !== "cancelled") return false;
      if (!search) return true;
      const booking = row.booking;
      const date = row.type === "slot" ? row.slot.date : row.date;
      return [
        booking?.customerName,
        booking?.customerEmail,
        date,
        booking ? bookingStatusLabels[getBookingStatus(booking)] : "Blocked",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [appointmentSearch, bookingsBySlotId, cancelledAppointmentsForSelectedDate, slotViewFilter, visibleOccupiedSlotsForSelectedDate]);
  const visibleBookedCount = useMemo(
    () => bookedSlotsForSelectedDate.filter((slot) => getBookingStatus(bookingsBySlotId.get(slot.id)) === "booked").length,
    [bookedSlotsForSelectedDate, bookingsBySlotId],
  );
  const adminSections: Array<{ id: AdminSection; label: string }> = [
    { id: "slots", label: "Slots" },
    { id: "gallery", label: "Galerie" },
    { id: "profile", label: "Profil" },
  ];
  const activeSectionTitle = adminSections.find((section) => section.id === activeSection)?.label ?? "Slots";

  useEffect(() => {
    let active = true;

    getAdminSession()
      .then((session) => {
        if (!active) return;
        setAuthenticated(session.authenticated);
        setProfileForm((current) => ({
          ...current,
          email: session.email ?? "",
        }));
      })
      .catch(() => {
        if (!active) return;
        setAuthenticated(false);
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

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

  async function deleteSelectedBlockedSlots() {
    for (const slot of selectedBlockedSlots) {
      await unblockSlot(slot.id);
    }
    setSelectedBlockedSlotIds([]);
    setConfirmDeleteOpen(false);
    queryClient.invalidateQueries({ queryKey: ["slots"] });
  }

  function openAppointmentDialog(action: AppointmentAction, booking: Booking, slot?: AppointmentSlot) {
    setAppointmentMessage("");
    setAppointmentError("");
    setCancellationReason("");
    setAppointmentDialog({ action, booking, slot });
  }

  async function confirmAppointmentAction() {
    if (!appointmentDialog) return;
    const { action, booking } = appointmentDialog;
    setPendingAppointmentId(booking.id);
    setAppointmentError("");
    setAppointmentMessage("");

    try {
      const result = await updateBookingStatus({
        bookingId: booking.id,
        status: action,
        cancellationReason: action === "cancelled" ? cancellationReason || undefined : undefined,
      });
      setAppointmentDialog(null);
      queryClient.setQueryData(["bookings"], result.bookings);
      queryClient.setQueryData(["slots"], result.slots);
      if (action === "cancelled") {
        setAppointmentMessage(
          result.emailWarning ?? "Appointment cancelled successfully. Customer has been notified by email.",
        );
      } else {
        setAppointmentMessage(action === "completed" ? "Appointment marked as completed." : "Appointment marked as no show.");
      }
    } catch (error) {
      setAppointmentError(error instanceof Error ? error.message : "Aktion fehlgeschlagen.");
    } finally {
      setPendingAppointmentId(null);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email"));
    const password = String(data.get("password"));
    setLoginError("");

    try {
      const profile = await loginAdmin(email, password);
      setAuthenticated(true);
      setProfileForm((current) => ({ ...current, email: profile.email }));
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["slots"] });
      queryClient.invalidateQueries({ queryKey: ["galleryImages"] });
      queryClient.invalidateQueries({ queryKey: ["heroImage"] });
    } catch (error) {
      setAuthenticated(false);
      setLoginError(error instanceof Error ? error.message : "Login fehlgeschlagen.");
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileMessage("");
    setProfileError("");

    if (profileForm.newPassword !== profileForm.confirmPassword) {
      setProfileError("Neues Passwort und Wiederholung stimmen nicht ueberein.");
      return;
    }

    try {
      const nextProfile = await updateAdminProfile(profileForm);
      setProfileForm({
        email: nextProfile.email,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setProfileMessage("Profil wurde gespeichert. Nutze die neuen Daten beim naechsten Login.");
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Profil konnte nicht gespeichert werden.");
    }
  }

  async function saveBlockedTime(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const startValue = getDateTimeValue(blockedTimeForm.startDate, blockedTimeForm.startTime);
    const endValue = getDateTimeValue(blockedTimeForm.endDate, blockedTimeForm.endTime);
    if (!Number.isFinite(startValue) || !Number.isFinite(endValue) || endValue <= startValue) {
      setBlockError("Endzeit muss nach der Startzeit liegen.");
      return;
    }
    const existingBlockedSlots = blockedSlots.filter((slot) => {
      const slotStart = getDateTimeValue(slot.date, slot.startTime);
      const slotEnd = slotStart + slot.duration * 60 * 1000;
      return rangesOverlap(slotStart, slotEnd, startValue, endValue);
    });
    if (existingBlockedSlots.length > 0) {
      const times = existingBlockedSlots
        .map((slot) => formatBlockedRange(slot))
        .join(", ");
      setBlockError(`Diese Zeit ist bereits blockiert: ${times}.`);
      return;
    }
    const existingBookedSlots = bookedSlots.filter((slot) => {
      const slotStart = getDateTimeValue(slot.date, slot.startTime);
      const slotEnd = slotStart + slot.duration * 60 * 1000;
      return rangesOverlap(slotStart, slotEnd, startValue, endValue);
    });
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

    const blockedRange = await blockSlotRange(blockedTimeForm);
    if (blockedRange.length === 0) {
      setBlockError("Fuer dieses Datum und diese Uhrzeit gibt es keine blockierbaren Termine.");
      return;
    }

    setBlockError("");
    setBlockedTimeForm({ ...emptyBlockedTime, startDate: blockedTimeForm.startDate, endDate: blockedTimeForm.startDate });
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
      const image = await convertImageFileForStorage(file);
      const fallbackNote = image.formatLabel === "AVIF" ? "" : ` (${image.formatLabel}, weil AVIF hier nicht unterstuetzt wird)`;
      await saveHeroImage({ src: image.src, alt: "Barbershop Hero" });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["heroImage"] });
      setImageMessage(`Hero-Bild wurde gespeichert${fallbackNote}.`);
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
      const image = await convertImageFileForStorage(file, 1200);
      const fallbackNote = image.formatLabel === "AVIF" ? "" : ` (${image.formatLabel}, weil AVIF hier nicht unterstuetzt wird)`;
      await addGalleryImage({ src: image.src, alt, label });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["galleryImages"] });
      setImageMessage(`Galerie-Bild wurde gespeichert${fallbackNote}.`);
    } catch (error) {
      setImageMessage(error instanceof Error ? error.message : "Bild konnte nicht gespeichert werden.");
    } finally {
      setIsUploadingImage(false);
    }
  }

  if (authLoading) {
    return (
      <section className="section admin-login">
        <div className="form-panel login-panel">
          <p className="eyebrow">Admin Login</p>
          <h1>Session wird geprueft</h1>
        </div>
      </section>
    );
  }

  if (!authenticated) {
    return (
      <section className="section admin-login">
        <form className="form-panel login-panel" onSubmit={handleLogin}>
          <p className="eyebrow">Admin Login</p>
          <h1>Geschuetzter Bereich</h1>
          <label>
            Email
            <input name="email" type="email" autoComplete="username" />
          </label>
          <label>
            Password
            <span className="password-input-wrap">
              <input name="password" type={showLoginPassword ? "text" : "password"} autoComplete="current-password" />
              <button
                type="button"
                className="password-visibility-button"
                aria-label={showLoginPassword ? "Passwort verbergen" : "Passwort anzeigen"}
                aria-pressed={showLoginPassword}
                onClick={() => setShowLoginPassword((current) => !current)}
              >
                {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
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
            void logoutAdmin();
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
      <>
      <div className="admin-grid">
        <form className="form-panel block-time-panel" onSubmit={saveBlockedTime}>
          <h2>Zeit blockieren</h2>
          <label>
            Startdatum
            <input
              type="date"
              value={blockedTimeForm.startDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(event) => {
                const startDate = event.target.value;
                const endDate = blockedTimeForm.endDate < startDate ? startDate : blockedTimeForm.endDate;
                setBlockedTimeForm({ ...blockedTimeForm, startDate, endDate });
              }}
            />
          </label>
          <label>
            Startzeit
            <input
              type="time"
              step="60"
              required
              value={blockedTimeForm.startTime}
              onChange={(event) => {
                const startTime = event.target.value;
                const nextEndTime =
                  blockedTimeForm.endDate > blockedTimeForm.startDate || timeToMinutes(blockedTimeForm.endTime) > timeToMinutes(startTime)
                    ? blockedTimeForm.endTime
                    : addMinutes(startTime, 1);
                setBlockedTimeForm({ ...blockedTimeForm, startTime, endTime: nextEndTime });
              }}
            />
          </label>
          <label>
            Enddatum
            <input
              type="date"
              value={blockedTimeForm.endDate}
              min={blockedTimeForm.startDate}
              onChange={(event) => setBlockedTimeForm({ ...blockedTimeForm, endDate: event.target.value })}
            />
          </label>
          <label>
            Endzeit
            <input
              type="time"
              step="60"
              required
              value={blockedTimeForm.endTime}
              onChange={(event) => setBlockedTimeForm({ ...blockedTimeForm, endTime: event.target.value })}
            />
          </label>
          <div className="quick-time-actions" aria-label="Schnelle Zeitwahl">
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                setBlockedTimeForm({
                  ...blockedTimeForm,
                  endDate: blockedTimeForm.startDate,
                  endTime: addMinutesWithinDay(blockedTimeForm.startTime, 1),
                })
              }
            >
              1 Minute
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                setBlockedTimeForm({
                  ...blockedTimeForm,
                  endDate: blockedTimeForm.startDate,
                  endTime: addMinutesWithinDay(blockedTimeForm.startTime, 120),
                })
              }
            >
              2 Stunden
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                setBlockedTimeForm({ ...blockedTimeForm, startTime: "00:00", endDate: blockedTimeForm.startDate, endTime: "23:59" })
              }
            >
              Ganzer Tag
            </button>
          </div>
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
              onClick={() =>
                downloadBlob(
                  buildSlotsPdf(visibleOccupiedSlotsForSelectedDate, bookingsBySlotId, blockedListDate, slotViewFilter),
                  `barbershop-${slotViewFilter}-${blockedListDate}.pdf`,
                )
              }
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
              {blockedSlotsForSelectedDate.length} blockiert - {visibleBookedCount} gebucht - {cancelledAppointmentsForSelectedDate.length} storniert
            </span>
          </div>
          <div className="slot-filter-tabs" aria-label="Terminfilter">
            {[
              { id: "all", label: "Alle" },
              { id: "booked", label: "Nur gebucht" },
              { id: "blocked", label: "Nur blockiert" },
              { id: "completed", label: "Abgeschlossen" },
              { id: "cancelled", label: "Storniert" },
              { id: "noShow", label: "No Show" },
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
          <label className="appointment-search">
            Suche
            <input
              type="search"
              value={appointmentSearch}
              placeholder="Name, Email, Datum oder Status"
              onChange={(event) => setAppointmentSearch(event.target.value)}
            />
          </label>
          {appointmentMessage ? (
            <p className={appointmentMessage.includes("could not") ? "warning-message" : "success-message"}>{appointmentMessage}</p>
          ) : null}
          {appointmentError ? <p className="error-message">{appointmentError}</p> : null}
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
            {visibleAppointmentRows.length === 0 ? <p>Keine passenden Termine fuer dieses Datum.</p> : null}
            {visibleAppointmentRows.map((row) => {
              const slot = row.type === "slot" ? row.slot : undefined;
              const booking = row.booking;
              const status = getBookingStatus(booking);
              const isBooked = row.type === "slot" && row.slot.status === "booked";
              const isBlocked = row.type === "slot" && row.slot.status === "blocked";
              const rowDate = row.type === "slot" ? row.slot.date : row.date;
              const rowStartTime = row.type === "slot" ? row.slot.startTime : row.startTime;
              const rowKey = row.type === "slot" ? row.slot.id : `cancelled-${row.booking.id}`;
              return (
                <article key={rowKey} className={`slot-row ${isBlocked ? "slot-row-blocked" : `slot-row-${status}`}`}>
                  {isBlocked && slot ? (
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
                  ) : (
                    <span className={`slot-status-dot slot-status-dot-${status}`} aria-label={bookingStatusLabels[status]} />
                  )}
                  <div>
                    <strong>
                      {formatGermanDate(rowDate, rowStartTime)} -{" "}
                      {isBooked && slot ? `${slot.startTime} - ${addMinutes(slot.startTime, slot.duration)}` : isBlocked && slot ? formatBlockedRange(slot) : rowStartTime}
                    </strong>
                    {isBlocked && slot ? (
                      <span>{slot.blockedReason ? `Grund: ${slot.blockedReason}` : "Fuer Kunden nicht buchbar"}</span>
                    ) : booking ? (
                      <>
                        <span className={`status-badge status-badge-${status}`}>{bookingStatusLabels[status]}</span>
                        <span>Kundenbuchung: {booking.customerName}</span>
                        {booking?.service ? <span>Service: {booking.service}</span> : null}
                        {booking?.customerEmail ? <span>{booking.customerEmail}</span> : null}
                      </>
                    ) : null}
                  </div>
                  {booking && status === "booked" ? (
                    <div className="row-actions appointment-actions">
                      <button type="button" className="success-action" disabled={pendingAppointmentId === booking.id} onClick={() => openAppointmentDialog("completed", booking, slot)}>
                        <CheckCircle2 size={16} />
                        Completed
                      </button>
                      <button type="button" className="warning-action" disabled={pendingAppointmentId === booking.id} onClick={() => openAppointmentDialog("noShow", booking, slot)}>
                        <AlertTriangle size={16} />
                        No Show
                      </button>
                      <button type="button" className="danger-action" disabled={pendingAppointmentId === booking.id} onClick={() => openAppointmentDialog("cancelled", booking, slot)}>
                        <XCircle size={16} />
                        Cancel
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      </div>
      {appointmentDialog ? (
        <div className="appointment-modal-backdrop" role="dialog" aria-modal="true">
          <div className="appointment-modal">
            <h2>{appointmentDialog.action === "cancelled" ? "Cancel Appointment?" : appointmentDialog.action === "noShow" ? "Customer did not arrive?" : "Mark appointment completed?"}</h2>
            <dl>
              <dt>Customer:</dt>
              <dd>{appointmentDialog.booking.customerName}</dd>
              <dt>Date:</dt>
              <dd>{formatGermanDate(appointmentDialog.slot?.date ?? getBookingDate(appointmentDialog.booking.slotId), appointmentDialog.slot?.startTime ?? getBookingTime(appointmentDialog.booking.slotId))}</dd>
              <dt>Time:</dt>
              <dd>{appointmentDialog.slot?.startTime ?? getBookingTime(appointmentDialog.booking.slotId)}</dd>
            </dl>
            {appointmentDialog.action === "cancelled" ? (
              <label>
                Reason (optional)
                <select value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)}>
                  <option value="">No reason</option>
                  {cancellationReasonOptions.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="appointment-modal-actions">
              <button type="button" className={appointmentDialog.action === "completed" ? "success-action" : appointmentDialog.action === "noShow" ? "warning-action" : "danger-action"} disabled={pendingAppointmentId === appointmentDialog.booking.id} onClick={confirmAppointmentAction}>
                {pendingAppointmentId === appointmentDialog.booking.id ? "Saving..." : appointmentDialog.action === "cancelled" ? "Cancel Appointment" : "Confirm"}
              </button>
              <button type="button" className="secondary-button" disabled={pendingAppointmentId === appointmentDialog.booking.id} onClick={() => setAppointmentDialog(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </>
      ) : null}

      {activeSection === "gallery" ? (
      <div className="admin-grid">
        <form className="form-panel" onSubmit={uploadHeroImage}>
          <h2>Hero-Bild</h2>
          <div className="admin-image-preview">
            <img src={heroImage?.src ?? defaultHeroImage} alt={heroImage?.alt ?? "Barbershop Hero"} loading="lazy" decoding="async" />
          </div>
          <label>
            Bild hochladen
            <input name="heroImage" type="file" accept="image/*" />
          </label>
          <button type="submit" disabled={isUploadingImage}>
            <ImagePlus size={18} />
            Bild speichern
          </button>
          {heroImage ? (
            <button
              type="button"
              className="secondary-button"
              onClick={async () => {
                await deleteHeroImage();
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
              Bild speichern
            </button>
            {imageMessage ? <p className={imageMessage.includes("gespeichert") ? "success-message" : "error-message"}>{imageMessage}</p> : null}
          </form>

          <div className="admin-gallery-list">
            {galleryImages.map((image) => (
              <article key={image.id} className="admin-gallery-row">
                <img src={image.src} alt={image.alt} loading="lazy" decoding="async" />
                <div>
                  <strong>{image.label}</strong>
                  <span>{image.createdAt === "default" ? "Standardbild" : "Upload"}</span>
                </div>
                <button
                  type="button"
                  aria-label="Galerie-Bild loeschen"
                  onClick={async () => {
                    await deleteGalleryImage(image.id);
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

      {activeSection === "profile" ? (
      <div className="profile-admin-layout">
        <form className="form-panel profile-panel" onSubmit={saveProfile}>
          <h2>Profil bearbeiten</h2>
          <label>
            Email
            <input
              type="email"
              value={profileForm.email}
              onChange={(event) => setProfileForm({ ...profileForm, email: event.target.value })}
            />
          </label>
          <label>
            Aktuelles Passwort
            <input
              type="password"
              value={profileForm.currentPassword}
              autoComplete="current-password"
              onChange={(event) => setProfileForm({ ...profileForm, currentPassword: event.target.value })}
            />
          </label>
          <label>
            Neues Passwort
            <input
              type="password"
              value={profileForm.newPassword}
              autoComplete="new-password"
              onChange={(event) => setProfileForm({ ...profileForm, newPassword: event.target.value })}
            />
          </label>
          <label>
            Neues Passwort wiederholen
            <input
              type="password"
              value={profileForm.confirmPassword}
              autoComplete="new-password"
              onChange={(event) => setProfileForm({ ...profileForm, confirmPassword: event.target.value })}
            />
          </label>
          <button type="submit">
            <Save size={18} />
            Profil speichern
          </button>
          {profileMessage ? <p className="success-message">{profileMessage}</p> : null}
          {profileError ? <p className="error-message">{profileError}</p> : null}
        </form>
        <div className="panel profile-help-panel">
          <h2>Login Daten</h2>
          <p>
            Die Admin-Daten werden auf dem Server gespeichert und gelten nach dem Speichern fuer alle Geraete.
          </p>
          <p>Nach dem Speichern bleibt die aktuelle Sitzung aktiv.</p>
        </div>
      </div>
      ) : null}

    </section>
  );
}
