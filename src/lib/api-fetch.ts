import { getAuth } from "firebase/auth";

async function authHeaders(): Promise<Record<string, string>> {
  const user = getAuth().currentUser;
  if (!user) throw new Error("No autenticado.");
  const idToken = await user.getIdToken();
  return {
    "Content-Type": "application/json",
    Authorization:  `Bearer ${idToken}`,
  };
}

/**
 * Wrapper de fetch que incluye automáticamente el token de Firebase Auth
 * en el header `Authorization: Bearer <idToken>`.
 *
 * Uso idéntico al fetch nativo:
 *   const res = await apiFetch("/api/backoffice-users/create", {
 *     method: "POST",
 *     body: JSON.stringify(payload),
 *   });
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = await authHeaders();
  return fetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string> | undefined) },
  });
}
