import {
  checkPassword,
  hashPassword,
  isValidPassword,
  requireAdmin,
  saveAdminProfile,
  sendError,
  setSessionCookie,
  type ApiRequest,
  type ApiResponse,
} from "../_auth.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const currentProfile = await requireAdmin(req);
  if (!currentProfile) {
    sendError(res, 401, "Nicht angemeldet.");
    return;
  }

  if (req.method === "GET") {
    res.status(200).json({ email: currentProfile.email });
    return;
  }

  if (req.method !== "POST") {
    sendError(res, 405, "Method not allowed.");
    return;
  }

  const body = (req.body ?? {}) as { email?: string; currentPassword?: string; newPassword?: string };
  const email = body.email?.trim().toLowerCase() ?? "";
  const currentPassword = body.currentPassword ?? "";
  const newPassword = body.newPassword?.trim() ?? "";

  if (!email || !email.includes("@")) {
    sendError(res, 400, "Bitte eine gueltige Email eingeben.");
    return;
  }

  if (!checkPassword(currentPassword, currentProfile.passwordHash)) {
    sendError(res, 400, "Aktuelles Passwort ist falsch.");
    return;
  }

  if (!isValidPassword(newPassword)) {
    sendError(res, 400, "Neues Passwort muss mindestens 10 Zeichen haben.");
    return;
  }

  const profile = { email, passwordHash: hashPassword(newPassword) };
  await saveAdminProfile(profile);
  setSessionCookie(res, profile.email);
  res.status(200).json({ email: profile.email });
}
