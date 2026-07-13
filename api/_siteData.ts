import { redisCommand } from "./_auth.js";

export type SlotStatus = "available" | "booked" | "blocked";

export type AppointmentSlot = {
  id: string;
  date: string;
  startTime: string;
  duration: number;
  service: string;
  status: SlotStatus;
  blockedReason?: string;
};

export type Booking = {
  id: string;
  slotId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  message?: string;
  createdAt: string;
};

export type SiteImage = {
  id: string;
  src: string;
  pathname?: string;
  alt: string;
  label: string;
  createdAt: string;
};

export type ServiceItem = {
  id: string;
  title: string;
  description: string;
  duration: string;
  price: string;
};

export type SiteData = {
  heroImage: SiteImage | null;
  galleryImages: SiteImage[];
  services: ServiceItem[];
  slots: AppointmentSlot[];
  bookings: Booking[];
};

const siteDataKey = "barbershop:siteData";
const workingTimes = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
const defaultServices: ServiceItem[] = [
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

function emptySiteData(): SiteData {
  return {
    heroImage: null,
    galleryImages: [],
    services: defaultServices,
    slots: [],
    bookings: [],
  };
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

function generateSlots(persistedSlots: AppointmentSlot[]) {
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

function normalizeSiteData(value: Partial<SiteData> | null | undefined): SiteData {
  return {
    ...emptySiteData(),
    ...value,
    heroImage: value?.heroImage ?? null,
    galleryImages: Array.isArray(value?.galleryImages) ? value.galleryImages : [],
    services: Array.isArray(value?.services) && value.services.length > 0 ? value.services : defaultServices,
    slots: Array.isArray(value?.slots) ? value.slots : [],
    bookings: Array.isArray(value?.bookings) ? value.bookings : [],
  };
}

export async function getStoredSiteData() {
  const stored = await redisCommand<string | null>("GET", siteDataKey);
  if (!stored) return emptySiteData();
  return normalizeSiteData(JSON.parse(stored) as Partial<SiteData>);
}

export async function saveStoredSiteData(data: SiteData) {
  const persisted = {
    ...normalizeSiteData(data),
    slots: data.slots.filter((slot) => slot.status === "booked" || slot.status === "blocked"),
  };
  await redisCommand("SET", siteDataKey, JSON.stringify(persisted));
  return persisted;
}

export function getPublicSiteData(data: SiteData) {
  return {
    heroImage: data.heroImage,
    galleryImages: data.galleryImages,
    services: data.services,
    slots: generateSlots(data.slots),
  };
}

export function getAdminSiteData(data: SiteData) {
  return {
    ...getPublicSiteData(data),
    bookings: data.bookings,
  };
}

export function createBooking(data: SiteData, input: Omit<Booking, "id" | "createdAt">) {
  const slots = generateSlots(data.slots);
  const slot = slots.find((item) => item.id === input.slotId);
  if (!slot || slot.status !== "available") {
    throw new Error("Dieser Termin ist nicht mehr verfuegbar.");
  }

  const booking: Booking = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };

  return {
    booking,
    data: {
      ...data,
      slots: slots.map((item) => (item.id === input.slotId ? { ...item, status: "booked" as const } : item)),
      bookings: [...data.bookings, booking],
    },
  };
}
