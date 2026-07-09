import { createBooking, getPublicSiteData, getStoredSiteData, saveStoredSiteData } from "./_siteData.js";
import { sendError, type ApiRequest, type ApiResponse } from "./_auth.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  try {
    const data = await getStoredSiteData();

    if (req.method === "GET") {
      res.status(200).json(getPublicSiteData(data));
      return;
    }

    if (req.method === "POST") {
      const body = (req.body ?? {}) as {
        slotId?: string;
        customerName?: string;
        customerEmail?: string;
        customerPhone?: string;
        message?: string;
      };

      const slotId = body.slotId?.trim() ?? "";
      const customerName = body.customerName?.trim() ?? "";
      const customerEmail = body.customerEmail?.trim() ?? "";
      if (!slotId || customerName.length < 2 || !customerEmail.includes("@")) {
        sendError(res, 400, "Bitte Buchungsdaten pruefen.");
        return;
      }

      const next = createBooking(data, {
        slotId,
        customerName,
        customerEmail,
        customerPhone: body.customerPhone?.trim() || undefined,
        message: body.message?.trim() || undefined,
      });
      await saveStoredSiteData(next.data);
      res.status(200).json(next.booking);
      return;
    }

    sendError(res, 405, "Method not allowed.");
  } catch (error) {
    sendError(res, 500, error instanceof Error ? error.message : "Daten konnten nicht geladen werden.");
  }
}
