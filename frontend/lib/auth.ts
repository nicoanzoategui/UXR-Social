import { api } from "./api";

export const SHARE_TOKEN_STORAGE_KEY = "uxr_share_token";

export function getStoredShareToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(SHARE_TOKEN_STORAGE_KEY);
}

export function setStoredShareToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) sessionStorage.setItem(SHARE_TOKEN_STORAGE_KEY, token);
  else sessionStorage.removeItem(SHARE_TOKEN_STORAGE_KEY);
}

export async function validateShareToken(token: string) {
  const { data } = await api.get<{ valid: boolean; label: string }>(
    "/api/auth/validate-share-token",
    { params: { token } }
  );
  return data;
}

export async function fetchMeWithCredentials() {
  const { data } = await api.get<{ id: number; username: string; role: string }>(
    "/api/auth/me"
  );
  return data;
}

export function getServerApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
}
