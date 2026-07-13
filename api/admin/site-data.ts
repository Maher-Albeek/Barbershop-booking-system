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

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
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
      slot?: Pick<AppointmentSlot, "date" | "startTime"> & { endTime?: string; blockedReason?: string };
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

    if (body.action === "blockSlotRange" && body.slot?.date && body.slot.startTime && body.slot.endTime) {
      const startMinutes = timeToMinutes(body.slot.startTime);
      const endMinutes = timeToMinutes(body.slot.endTime);
      const publicData = getAdminSiteData(data);
      const targetSlots = publicData.slots.filter(
        (item) =>
          item.date === body.slot?.date &&
          item.status !== "booked" &&
          timeToMinutes(item.startTime) >= startMinutes &&
          timeToMinutes(item.startTime) < endMinutes,
      );
      const targetIds = new Set(targetSlots.map((item) => item.id));
      const nextSlots = publicData.slots.map((item) =>
        targetIds.has(item.id)
          ? { ...item, status: "blocked" as const, blockedReason: body.slot?.blockedReason?.trim() || undefined }
          : item,
      );
      const nextData = await saveStoredSiteData({ ...data, slots: nextSlots });
      res.status(200).json({ ...getAdminSiteData(nextData), changedSlots: targetSlots });
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
