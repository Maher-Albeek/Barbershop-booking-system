import { clearSessionCookie, sendError, type ApiRequest, type ApiResponse } from "../_auth.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    sendError(res, 405, "Method not allowed.");
    return;
  }

  clearSessionCookie(res);
  res.status(200).json({ ok: true });
}
