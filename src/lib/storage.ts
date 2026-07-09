import type { AppointmentSlot, Booking, SiteImage } from "./types";

const slotsKey = "barber.slots";
const bookingsKey = "barber.bookings";
const authKey = "barber.admin.auth";
const adminProfileKey = "barber.admin.profile";
const galleryImagesKey = "barber.galleryImages";
const heroImageKey = "barber.heroImage";
export const adminEmail = import.meta.env.VITE_ADMIN_EMAIL ?? "admin@barber.local";
export const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD ?? "Barber2026!";
export const defaultHeroImage =
  "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1800&q=82";
export const defaultGalleryImages: SiteImage[] = [
  {
    id: "gallery-default-1",
    src: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=900&q=80",
    alt: "Barber schneidet Haare im Salon",
    label: "Classic Fade",
    createdAt: "default",
  },
  {
    id: "gallery-default-2",
    src: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=900&q=80",
    alt: "Bartpflege mit Rasiermesser",
    label: "Beard Trim",
    createdAt: "default",
  },
  {
    id: "gallery-default-3",
    src: "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=900&q=80",
    alt: "Moderner Barbershop Innenraum",
    label: "Shop",
    createdAt: "default",
  },
  {
    id: "gallery-default-4",
    src: "https://images.unsplash.com/photo-1517832606299-7ae9b720a186?auto=format&fit=crop&w=900&q=80",
    alt: "Styling Ergebnis nach Haarschnitt",
    label: "Before / After",
    createdAt: "default",
  },
];
const workingTimes = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
];
const closingTime = "19:00";

export function getWorkingTimes() {
  return workingTimes;
}

export function getBlockEndTimes() {
  return [...workingTimes.slice(1), closingTime];
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getTodayKey() {
  return formatDate(new Date());
}

function getAvailabilityEndDate() {
  const date = new Date();
  date.setMonth(date.getMonth() + 4, 0);
  return date;
}

function getSlotId(date: string, startTime: string) {
  return `${date}-${startTime}`;
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

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

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Bild konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Bild konnte nicht verarbeitet werden."));
    image.src = src;
  });
}

function canvasToAvif(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.type !== "image/avif") {
          reject(new Error("AVIF-Konvertierung wird von diesem Browser nicht unterstuetzt."));
          return;
        }
        resolve(blob);
      },
      "image/avif",
      0.82,
    );
  });
}

export async function convertImageFileToAvif(file: File, maxSize = 1800) {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Bild konnte nicht konvertiert werden.");
  context.drawImage(image, 0, 0, width, height);
  const avifBlob = await canvasToAvif(canvas);
  return readFileAsDataUrl(new File([avifBlob], `${file.name.replace(/\.[^.]+$/, "")}.avif`, { type: "image/avif" }));
}

export function getGalleryImages() {
  return readJson<SiteImage[]>(galleryImagesKey, defaultGalleryImages);
}

export function addGalleryImage(image: Omit<SiteImage, "id" | "createdAt">) {
  const nextImage: SiteImage = {
    ...image,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  writeJson(galleryImagesKey, [...getGalleryImages(), nextImage]);
  return nextImage;
}

export function deleteGalleryImage(id: string) {
  writeJson(
    galleryImagesKey,
    getGalleryImages().filter((image) => image.id !== id),
  );
}

export function getHeroImage() {
  return readJson<SiteImage | null>(heroImageKey, null);
}

export function saveHeroImage(image: Omit<SiteImage, "id" | "createdAt" | "label">) {
  const nextImage: SiteImage = {
    ...image,
    id: crypto.randomUUID(),
    label: "Hero",
    createdAt: new Date().toISOString(),
  };
  writeJson(heroImageKey, nextImage);
  return nextImage;
}

export function deleteHeroImage() {
  localStorage.removeItem(heroImageKey);
}

export function getSlots() {
  const persistedSlots = readJson<AppointmentSlot[]>(slotsKey, []);
  const persistedByDateTime = new Map(
    persistedSlots
      .filter((slot) => slot.status === "booked" || slot.status === "blocked")
      .map((slot) => [getSlotId(slot.date, slot.startTime), slot]),
  );
  const slots: AppointmentSlot[] = [];
  const todayKey = getTodayKey();
  const endDate = getAvailabilityEndDate();

  for (const date = new Date(`${todayKey}T12:00:00`); date <= endDate; date.setDate(date.getDate() + 1)) {
    const day = date.getDay();
    if (day === 0 || day === 6) continue;

    const dateKey = formatDate(date);
    for (const startTime of workingTimes) {
      const slotId = getSlotId(dateKey, startTime);
      const persistedSlot = persistedByDateTime.get(slotId);
      slots.push(
        persistedSlot ?? {
          id: slotId,
          date: dateKey,
          startTime,
          duration: 60,
          service: "Termin",
          status: "available",
        },
      );
    }
  }

  return slots;
}

export function saveSlots(slots: AppointmentSlot[]) {
  writeJson(
    slotsKey,
    slots.filter((slot) => slot.status === "booked" || slot.status === "blocked"),
  );
}

export function blockSlot(slot: Pick<AppointmentSlot, "date" | "startTime"> & { blockedReason?: string }) {
  const slots = getSlots();
  const targetId = getSlotId(slot.date, slot.startTime);
  const existingSlot = slots.find((item) => item.id === targetId);
  if (!existingSlot || existingSlot.status === "booked") return existingSlot;

  const blockedSlot: AppointmentSlot = {
    ...existingSlot,
    status: "blocked",
    blockedReason: slot.blockedReason?.trim() || undefined,
  };
  saveSlots(slots.map((item) => (item.id === targetId ? blockedSlot : item)));
  return blockedSlot;
}

export function blockSlotRange(slot: Pick<AppointmentSlot, "date" | "startTime"> & { endTime: string; blockedReason?: string }) {
  const startMinutes = timeToMinutes(slot.startTime);
  const endMinutes = timeToMinutes(slot.endTime);
  if (endMinutes <= startMinutes) return [];

  const slots = getSlots();
  const targetSlots = slots.filter(
    (item) =>
      item.date === slot.date &&
      item.status !== "booked" &&
      timeToMinutes(item.startTime) >= startMinutes &&
      timeToMinutes(item.startTime) < endMinutes,
  );
  const targetIds = new Set(targetSlots.map((item) => item.id));
  const blockedReason = slot.blockedReason?.trim() || undefined;
  const nextSlots = slots.map((item) => (targetIds.has(item.id) ? { ...item, status: "blocked" as const, blockedReason } : item));
  saveSlots(nextSlots);
  return targetSlots;
}

export function unblockSlot(id: string) {
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

export function isAdminAuthenticated() {
  return localStorage.getItem(authKey) === "true";
}

export function getAdminProfile() {
  return readJson(adminProfileKey, {
    email: adminEmail,
    password: adminPassword,
  });
}

export function updateAdminProfile(input: { email: string; currentPassword: string; newPassword: string }) {
  const profile = getAdminProfile();
  const email = input.email.trim().toLowerCase();
  const newPassword = input.newPassword.trim();

  if (!email || !email.includes("@")) {
    throw new Error("Bitte eine gueltige Email eingeben.");
  }

  if (input.currentPassword !== profile.password) {
    throw new Error("Aktuelles Passwort ist falsch.");
  }

  if (newPassword.length < 8) {
    throw new Error("Neues Passwort muss mindestens 8 Zeichen haben.");
  }

  const nextProfile = { email, password: newPassword };
  writeJson(adminProfileKey, nextProfile);
  return nextProfile;
}

export function loginAdmin(email: string, password: string) {
  const profile = getAdminProfile();
  const isValid = email.trim().toLowerCase() === profile.email && password === profile.password;
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
