import { checkPassword, getAdminProfile, sendError, setSessionCookie, type ApiRequest, type ApiResponse } from "../_auth.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    sendError(res, 405, "Method not allowed.");
    return;
  }

  try {
    const body = (req.body ?? {}) as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    const profile = await getAdminProfile();

    if (email !== profile.email || !checkPassword(password, profile.passwordHash)) {
      sendError(res, 401, "Login fehlgeschlagen.");
      return;
    }

    setSessionCookie(res, profile.email);
    res.status(200).json({ email: profile.email });
  } catch {
    sendError(res, 500, "Login ist nicht konfiguriert.");
  }
}
