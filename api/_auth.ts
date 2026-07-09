import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const adminKey = "barbershop:admin";
const sessionCookie = "barber_admin_session";
const sessionMaxAge = 60 * 60 * 24 * 7;

type AdminProfile = {
  email: string;
  passwordHash: string;
};

type RedisResult<T> = {
  result?: T;
  error?: string;
};

export type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

export type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string | string[]) => void;
};

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function getRedisConfig() {
  const url = env("UPSTASH_REDIS_REST_URL") || env("UPSTASH_REDIS_REST_KV_REST_API_URL");
  const token = env("UPSTASH_REDIS_REST_TOKEN") || env("UPSTASH_REDIS_REST_KV_REST_API_TOKEN");
  if (!url || !token) {
    throw new Error("Redis env vars are missing.");
  }
  return { url, token };
}

function getSessionSecret() {
  const secret = env("SESSION_SECRET");
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters.");
  }
  return secret;
}

export async function redisCommand<T>(command: string, ...args: string[]) {
  const { url, token } = getRedisConfig();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([command, ...args]),
  });

  if (!response.ok) {
    throw new Error("Redis request failed.");
  }

  const payload = (await response.json()) as RedisResult<T>;
  if (payload.error) {
    throw new Error(payload.error);
  }
  return payload.result;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 64).toString("base64url");
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password: string, storedHash: string) {
  const [scheme, salt, hash] = storedHash.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;

  const expected = Buffer.from(hash, "base64url");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function readCookie(req: ApiRequest, name: string) {
  const header = req.headers.cookie;
  const cookieHeader = Array.isArray(header) ? header.join(";") : header ?? "";
  return cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function createSession(email: string) {
  const payload = Buffer.from(
    JSON.stringify({
      email,
      expiresAt: Date.now() + sessionMaxAge * 1000,
    }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function verifySession(token?: string) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || sign(payload) !== signature) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email?: string; expiresAt?: number };
    if (!session.email || !session.expiresAt || session.expiresAt < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: ApiResponse, email: string) {
  res.setHeader(
    "Set-Cookie",
    `${sessionCookie}=${createSession(email)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${sessionMaxAge}`,
  );
}

export function clearSessionCookie(res: ApiResponse) {
  res.setHeader("Set-Cookie", `${sessionCookie}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}

export async function getAdminProfile() {
  const stored = await redisCommand<string | null>("GET", adminKey);
  if (stored) return JSON.parse(stored) as AdminProfile;

  const email = env("ADMIN_BOOTSTRAP_EMAIL").toLowerCase();
  const password = env("ADMIN_BOOTSTRAP_PASSWORD");
  if (!email || !password) {
    throw new Error("Bootstrap admin env vars are missing.");
  }

  const profile = { email, passwordHash: hashPassword(password) };
  await saveAdminProfile(profile);
  return profile;
}

export async function saveAdminProfile(profile: AdminProfile) {
  await redisCommand("SET", adminKey, JSON.stringify(profile));
}

export function isValidPassword(password: string) {
  return password.length >= 10;
}

export function checkPassword(password: string, passwordHash: string) {
  return verifyPassword(password, passwordHash);
}

export async function requireAdmin(req: ApiRequest) {
  const session = verifySession(readCookie(req, sessionCookie));
  if (!session) return null;

  const profile = await getAdminProfile();
  return session.email === profile.email ? profile : null;
}

export function sendError(res: ApiResponse, status: number, message: string) {
  res.status(status).json({ message });
}
