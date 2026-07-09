import { getAdminSiteData, getStoredSiteData, saveStoredSiteData, type AppointmentSlot, type SiteImage } from "../_siteData.js";
import { requireAdmin, sendError, type ApiRequest, type ApiResponse } from "../_auth.js";

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
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
      id?: string;
      slot?: Pick<AppointmentSlot, "date" | "startTime"> & { endTime?: string; blockedReason?: string };
    };

    if (body.action === "saveHeroImage" && body.image?.src) {
      const heroImage: SiteImage = {
        src: body.image.src,
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
      const nextData = await saveStoredSiteData({ ...data, heroImage: null });
      res.status(200).json(getAdminSiteData(nextData));
      return;
    }

    if (body.action === "addGalleryImage" && body.image?.src) {
      const galleryImage: SiteImage = {
        src: body.image.src,
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
      const nextData = await saveStoredSiteData({
        ...data,
        galleryImages: data.galleryImages.filter((image) => image.id !== body.id),
      });
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
