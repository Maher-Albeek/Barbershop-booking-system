import type { AppointmentSlot, Booking, ServiceItem, SiteImage } from "./types";

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
export const defaultServices: ServiceItem[] = [
  {
    id: "service-haircut",
    title: "Haarschnitt",
    description: "Klassische und moderne Schnitte mit sauberem Finish.",
    duration: "30 Minuten",
    price: "ab 20 EUR",
  },
  {
    id: "service-beard",
    title: "Bartpflege",
    description: "Konturen, Form und Pflege für einen gepflegten Bart.",
    duration: "15 Minuten",
    price: "ab 15 EUR",
  },
  {
    id: "service-complete",
    title: "Komplettpaket",
    description: "Haarschnitt und Bart in einem Termin abgestimmt.",
    duration: "1 Stunde",
    price: "ab 30 EUR",
  },
];

const workingTimes = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
type PublicSiteData = {
  heroImage: SiteImage | null;
  galleryImages: SiteImage[];
  services: ServiceItem[];
  slots: AppointmentSlot[];
};

type AdminSiteData = PublicSiteData & {
  bookings: Booking[];
};

type ChangedSlotsResponse = AdminSiteData & {
  changedSlots: AppointmentSlot[];
};

export function getWorkingTimes() {
  return workingTimes;
}

async function apiRequest<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = "Daten konnten nicht geladen werden.";
    try {
      const body = (await response.json()) as { message?: string };
      message = body.message || message;
    } catch {
      // Keep the generic message when the server returns no JSON body.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

function withFallbackGallery<T extends PublicSiteData>(data: T): T {
  return {
    ...data,
    galleryImages: data.galleryImages.length > 0 ? data.galleryImages : defaultGalleryImages,
    services: data.services.length > 0 ? data.services : defaultServices,
  };
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

type ConvertedImage = {
  src: string;
  formatLabel: "AVIF" | "WebP" | "JPEG";
};

const imageFormats: Array<{ mimeType: string; extension: string; formatLabel: ConvertedImage["formatLabel"]; quality: number }> = [
  { mimeType: "image/avif", extension: "avif", formatLabel: "AVIF", quality: 0.82 },
  { mimeType: "image/webp", extension: "webp", formatLabel: "WebP", quality: 0.86 },
  { mimeType: "image/jpeg", extension: "jpg", formatLabel: "JPEG", quality: 0.88 },
];

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.type !== mimeType) {
          reject(new Error(`${mimeType} wird von diesem Browser nicht unterstuetzt.`));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
}

export async function convertImageFileForStorage(file: File, maxSize = 1800): Promise<ConvertedImage> {
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

  for (const format of imageFormats) {
    try {
      const blob = await canvasToBlob(canvas, format.mimeType, format.quality);
      const storedFile = new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.${format.extension}`, { type: format.mimeType });
      return {
        src: await readFileAsDataUrl(storedFile),
        formatLabel: format.formatLabel,
      };
    } catch {
      // Try the next browser-supported image encoder.
    }
  }

  throw new Error("Bild konnte in diesem Browser nicht gespeichert werden.");
}

export async function getPublicSiteData() {
  try {
    return withFallbackGallery(await apiRequest<PublicSiteData>("/api/site-data"));
  } catch {
    return {
      heroImage: null,
      galleryImages: defaultGalleryImages,
      services: defaultServices,
      slots: [],
    };
  }
}

export async function getAdminSiteData() {
  return withFallbackGallery(await apiRequest<AdminSiteData>("/api/admin/site-data"));
}

export async function getGalleryImages() {
  return (await getPublicSiteData()).galleryImages;
}

export async function addGalleryImage(image: Omit<SiteImage, "id" | "createdAt">) {
  return apiRequest<AdminSiteData>("/api/admin/site-data", {
    method: "PATCH",
    body: JSON.stringify({ action: "addGalleryImage", image }),
  });
}

export async function deleteGalleryImage(id: string) {
  return apiRequest<AdminSiteData>("/api/admin/site-data", {
    method: "PATCH",
    body: JSON.stringify({ action: "deleteGalleryImage", id }),
  });
}

export async function getHeroImage() {
  return (await getPublicSiteData()).heroImage;
}

export async function getServices() {
  return (await getPublicSiteData()).services;
}

export async function saveServices(services: ServiceItem[]) {
  return apiRequest<AdminSiteData>("/api/admin/site-data", {
    method: "PATCH",
    body: JSON.stringify({ action: "saveServices", services }),
  });
}

export async function saveHeroImage(image: Omit<SiteImage, "id" | "createdAt" | "label">) {
  return apiRequest<AdminSiteData>("/api/admin/site-data", {
    method: "PATCH",
    body: JSON.stringify({ action: "saveHeroImage", image }),
  });
}

export async function deleteHeroImage() {
  return apiRequest<AdminSiteData>("/api/admin/site-data", {
    method: "PATCH",
    body: JSON.stringify({ action: "deleteHeroImage" }),
  });
}

export async function getSlots() {
  return (await getPublicSiteData()).slots;
}

export type BlockSlotRangeInput = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  blockedReason?: string;
};

function getDateTimeValue(date: string, time: string) {
  return new Date(`${date}T${time}:00`).getTime();
}

export async function blockSlotRange(slot: BlockSlotRangeInput) {
  const startValue = getDateTimeValue(slot.startDate, slot.startTime);
  const endValue = getDateTimeValue(slot.endDate, slot.endTime);
  if (!Number.isFinite(startValue) || !Number.isFinite(endValue) || endValue <= startValue) return [];

  const response = await apiRequest<ChangedSlotsResponse>("/api/admin/site-data", {
    method: "PATCH",
    body: JSON.stringify({ action: "blockSlotRange", slot }),
  });
  return response.changedSlots;
}

export async function unblockSlot(id: string) {
  return apiRequest<AdminSiteData>("/api/admin/site-data", {
    method: "PATCH",
    body: JSON.stringify({ action: "unblockSlot", id }),
  });
}

export async function getBookings() {
  return (await getAdminSiteData()).bookings;
}

export async function createBooking(input: Omit<Booking, "id" | "createdAt">) {
  return apiRequest<Booking>("/api/site-data", {
    method: "POST",
    body: JSON.stringify(input),
  });
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
