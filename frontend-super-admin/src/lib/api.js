const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

function getAccessToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
}

function getRefreshToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("refreshToken");
}

export function saveTokens({ accessToken, refreshToken }) {
  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("refreshToken", refreshToken);
}

export function clearTokens() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}

// Attempt to get a new access token using the refresh token
async function tryRefresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error("No refresh token");

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    clearTokens();
    throw new Error("Session expired, please log in again");
  }

  const data = await res.json();
  saveTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  return data.accessToken;
}

// Core request function — auto-retries once with refreshed token on 401
async function request(path, options = {}, retry = true) {
  const token = getAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  // Auto-refresh on 401 and retry once
  if (res.status === 401 && retry) {
    try {
      await tryRefresh();
      return request(path, options, false);
    } catch {
      clearTokens();
      window.location.reload();
      return;
    }
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const api = {
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  logout: () =>
    request("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken: getRefreshToken() }),
    }),

  getOrgs: () => request("/super/organizations"),

  createOrg: (name) =>
    request("/super/organizations", { method: "POST", body: JSON.stringify({ name }) }),

  deleteOrg: (id) =>
    request(`/super/organizations/${id}`, { method: "DELETE" }),
};
