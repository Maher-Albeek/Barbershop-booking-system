import type { AppointmentSlot, Booking, ContactRequest } from "./types";

const slotsKey = "barber.slots";
const bookingsKey = "barber.bookings";
const contactsKey = "barber.contacts";
const authKey = "barber.admin.auth";

const today = new Date();
const toDate = (offset: number) => {
  const date = new Date(today);
  date.setDate(today.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

const defaultSlots: AppointmentSlot[] = [
  { id: "slot-1", date: toDate(1), startTime: "10:00", duration: 30, service: "Haircut", status: "available" },
  { id: "slot-2", date: toDate(1), startTime: "11:00", duration: 60, service: "Haircut + Beard", status: "available" },
  { id: "slot-3", date: toDate(2), startTime: "14:00", duration: 20, service: "Beard", status: "available" },
  { id: "slot-4", date: toDate(3), startTime: "16:30", duration: 45, service: "Style Beratung", status: "available" },
];

function readJson<T>(key: string, fallback: T): T {
  const stored = localStorage.getItem(key);
  if (!stored) return fallback;
  try {
    return JSON.parse(stored) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getSlots() {
  const slots = readJson<AppointmentSlot[]>(slotsKey, defaultSlots);
  return slots.filter((slot) => slot.date >= today.toISOString().slice(0, 10));
}

export function saveSlots(slots: AppointmentSlot[]) {
  writeJson(slotsKey, slots);
}

export function createSlot(slot: Omit<AppointmentSlot, "id" | "status">) {
  const slots = getSlots();
  const nextSlot: AppointmentSlot = {
    ...slot,
    id: crypto.randomUUID(),
    status: "available",
  };
  saveSlots([...slots, nextSlot]);
  return nextSlot;
}

export function updateSlot(slot: AppointmentSlot) {
  const slots = getSlots().map((item) => (item.id === slot.id ? slot : item));
  saveSlots(slots);
}

export function deleteSlot(id: string) {
  saveSlots(getSlots().filter((slot) => slot.id !== id));
}

export function getBookings() {
  return readJson<Booking[]>(bookingsKey, []);
}

export function createBooking(input: Omit<Booking, "id" | "createdAt">) {
  const slots = getSlots();
  const slot = slots.find((item) => item.id === input.slotId);
  if (!slot || slot.status !== "available") {
    throw new Error("Dieser Termin ist nicht mehr verfügbar.");
  }

  saveSlots(slots.map((item) => (item.id === input.slotId ? { ...item, status: "booked" } : item)));
  const booking: Booking = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  writeJson(bookingsKey, [...getBookings(), booking]);
  return booking;
}

export function getContacts() {
  return readJson<ContactRequest[]>(contactsKey, []);
}

export function createContact(input: Omit<ContactRequest, "id" | "createdAt">) {
  const contact = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  writeJson(contactsKey, [...getContacts(), contact]);
  return contact;
}

export function isAdminAuthenticated() {
  return localStorage.getItem(authKey) === "true";
}

export function loginAdmin(email: string, password: string) {
  const isValid = email === "admin@barber.local" && password === "Barber2026!";
  if (isValid) localStorage.setItem(authKey, "true");
  return isValid;
}

export function logoutAdmin() {
  localStorage.removeItem(authKey);
}

export function formatGermanDate(date: string, time?: string) {
  const dateValue = new Date(`${date}T${time ?? "12:00"}:00`);
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(dateValue);
}
