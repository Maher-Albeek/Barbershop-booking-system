export type AdminSession = {
  authenticated: boolean;
  email?: string;
};

type ApiErrorBody = {
  message?: string;
};

async function apiRequest<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = "Aktion fehlgeschlagen.";
    try {
      const body = (await response.json()) as ApiErrorBody;
      message = body.message || message;
    } catch {
      // Keep the generic message when the server returns no JSON body.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export function getAdminSession() {
  return apiRequest<AdminSession>("/api/auth/me");
}

export function loginAdmin(email: string, password: string) {
  return apiRequest<{ email: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logoutAdmin() {
  return apiRequest<{ ok: boolean }>("/api/auth/logout", {
    method: "POST",
  });
}

export function updateAdminProfile(input: { email: string; currentPassword: string; newPassword: string }) {
  return apiRequest<{ email: string }>("/api/admin/profile", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
