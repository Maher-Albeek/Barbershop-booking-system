import { requireAdmin, type ApiRequest, type ApiResponse } from "../_auth.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const profile = await requireAdmin(req);
  res.status(200).json(profile ? { authenticated: true, email: profile.email } : { authenticated: false });
}
