import { del, put } from "@vercel/blob";
import {
  getAdminSiteData,
  getStoredSiteData,
  saveStoredSiteData,
  type AppointmentSlot,
  type ServiceItem,
  type SiteImage,
} from "../_siteData.js";
import { requireAdmin, sendError, type ApiRequest, type ApiResponse } from "../_auth.js";

function isTime(value: string | undefined) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isDateKey(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime());
}

function getDateTimeValue(date: string, time: string) {
  return new Date(`${date}T${time}:00`).getTime();
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && endA > startB;
}

function extensionFromMimeType(mimeType: string) {
  if (mimeType === "image/avif") return "avif";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  return "bin";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function dataUrlToBuffer(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Bilddaten sind ungueltig.");
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

function cleanServiceText(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text.slice(0, 160) : fallback;
}

function normalizeServices(services: ServiceItem[]) {
  return services.slice(0, 6).map((service, index) => ({
    id: service.id || `service-${index + 1}`,
    title: cleanServiceText(service.title, `Service ${index + 1}`),
    description: cleanServiceText(service.description, "Beschreibung folgt."),
    duration: cleanServiceText(service.duration, "30 Minuten"),
    price: cleanServiceText(service.price, "Preis auf Anfrage"),
  }));
}

async function uploadImage(image: { src: string; label?: string; alt?: string }, folder: "hero" | "gallery") {
  const { mimeType, buffer } = dataUrlToBuffer(image.src);
  const extension = extensionFromMimeType(mimeType);
  const filename = `${folder}/${Date.now()}-${crypto.randomUUID()}-${slugify(image.label || image.alt || "image")}.${extension}`;
  const blob = await put(filename, buffer, {
    access: "public",
    contentType: mimeType,
  });
  return {
    url: blob.url,
    pathname: blob.pathname,
  };
}

async function deleteImageFile(image?: SiteImage | null) {
  if (!image?.src || image.src.startsWith("data:")) return;
  try {
    await del(image.src);
  } catch {
    // Keep data cleanup moving if the file was already removed from blob storage.
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const profile = await requireAdmin(req);
  if (!profile) {
    sendError(res, 401, "Nicht angemeldet.");
    return;
  }

  try {
    const data = await getStoredSiteData();

    if (req.method === "GET") {
      res.status(200).json(getAdminSiteData(data));
      return;
    }

    if (req.method !== "PATCH") {
      sendError(res, 405, "Method not allowed.");
      return;
    }

    const body = (req.body ?? {}) as {
      action?: string;
      image?: Omit<SiteImage, "id" | "createdAt" | "label"> & { label?: string };
      services?: ServiceItem[];
      id?: string;
      slot?: {
        date?: string;
        startDate?: string;
        startTime?: string;
        endDate?: string;
        endTime?: string;
        blockedReason?: string;
      };
    };

    if (body.action === "saveHeroImage" && body.image?.src) {
      const uploadedImage = await uploadImage(body.image, "hero");
      await deleteImageFile(data.heroImage);
      const heroImage: SiteImage = {
        src: uploadedImage.url,
        pathname: uploadedImage.pathname,
        alt: body.image.alt || "Barbershop Hero",
        label: "Hero",
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      const nextData = await saveStoredSiteData({ ...data, heroImage });
      res.status(200).json(getAdminSiteData(nextData));
      return;
    }

    if (body.action === "deleteHeroImage") {
      await deleteImageFile(data.heroImage);
      const nextData = await saveStoredSiteData({ ...data, heroImage: null });
      res.status(200).json(getAdminSiteData(nextData));
      return;
    }

    if (body.action === "addGalleryImage" && body.image?.src) {
      const uploadedImage = await uploadImage(body.image, "gallery");
      const galleryImage: SiteImage = {
        src: uploadedImage.url,
        pathname: uploadedImage.pathname,
        alt: body.image.alt || body.image.label || "Galerie",
        label: body.image.label || "Galerie",
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      const nextData = await saveStoredSiteData({ ...data, galleryImages: [...data.galleryImages, galleryImage] });
      res.status(200).json(getAdminSiteData(nextData));
      return;
    }

    if (body.action === "deleteGalleryImage" && body.id) {
      const imageToDelete = data.galleryImages.find((image) => image.id === body.id);
      await deleteImageFile(imageToDelete);
      const nextData = await saveStoredSiteData({
        ...data,
        galleryImages: data.galleryImages.filter((image) => image.id !== body.id),
      });
      res.status(200).json(getAdminSiteData(nextData));
      return;
    }

    if (body.action === "saveServices" && Array.isArray(body.services)) {
      const nextData = await saveStoredSiteData({ ...data, services: normalizeServices(body.services) });
      res.status(200).json(getAdminSiteData(nextData));
      return;
    }

    if (body.action === "blockSlotRange" && body.slot?.startTime && body.slot.endTime) {
      const startDate = body.slot.startDate ?? body.slot.date;
      const endDate = body.slot.endDate ?? startDate;
      if (!isDateKey(startDate) || !isDateKey(endDate)) {
        sendError(res, 400, "Datum ist ungueltig.");
        return;
      }
      if (!isTime(body.slot.startTime) || !isTime(body.slot.endTime)) {
        sendError(res, 400, "Uhrzeit ist ungueltig.");
        return;
      }
      const startValue = getDateTimeValue(startDate, body.slot.startTime);
      const endValue = getDateTimeValue(endDate, body.slot.endTime);
      if (endValue <= startValue) {
        sendError(res, 400, "Endzeit muss nach der Startzeit liegen.");
        return;
      }
      const publicData = getAdminSiteData(data);
      const overlappingSlots = publicData.slots.filter((item) => {
        const slotStart = getDateTimeValue(item.date, item.startTime);
        const slotEnd = slotStart + item.duration * 60 * 1000;
        return rangesOverlap(slotStart, slotEnd, startValue, endValue);
      });
      const occupiedSlots = overlappingSlots.filter((item) => item.status === "booked" || item.status === "blocked");
      if (occupiedSlots.length > 0) {
        sendError(res, 400, "Der Zeitraum enthaelt bereits gebuchte oder blockierte Termine.");
        return;
      }
      const targetSlots = overlappingSlots.filter((item) => item.status === "available");
      const targetIds = new Set(targetSlots.map((item) => item.id));
      const nextSlots = publicData.slots.map((item) => {
        if (!targetIds.has(item.id)) return item;
        return {
          ...item,
          status: "blocked" as const,
          blockedReason: body.slot?.blockedReason?.trim() || undefined,
          blockedStartDate: startDate,
          blockedStartTime: body.slot?.startTime,
          blockedEndDate: endDate,
          blockedEndTime: body.slot?.endTime,
        };
      });
      const nextData = await saveStoredSiteData({ ...data, slots: nextSlots });
      res.status(200).json({ ...getAdminSiteData(nextData), changedSlots: nextSlots.filter((item) => targetIds.has(item.id)) });
      return;
    }

    if (body.action === "unblockSlot" && body.id) {
      const nextData = await saveStoredSiteData({ ...data, slots: data.slots.filter((slot) => slot.id !== body.id) });
      res.status(200).json(getAdminSiteData(nextData));
      return;
    }

    sendError(res, 400, "Unbekannte Aktion.");
  } catch (error) {
    sendError(res, 500, error instanceof Error ? error.message : "Daten konnten nicht gespeichert werden.");
  }
}
