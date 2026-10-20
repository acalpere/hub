export type Role = "admin" | "germa";
export interface User { id: number; username: string; role: Role }
export interface MenuItem { id: number; name: string; url: string }
export interface Site { id: number; name: string; url: string; status: string; notes: string }
export interface Agent {
  id: number; name: string; kind: string; enabled: boolean; site_id: number | null;
  config: Record<string, unknown>;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method,
    credentials: "same-origin",
    // La capçalera personalitzada fa de protecció CSRF: el backend la exigeix a les escriptures.
    headers: { "X-Requested-With": "acalpere", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.error ?? data.detail;
    throw new ApiError(res.status, typeof detail === "string" ? detail : "Error inesperat");
  }
  return data as T;
}

export const api = {
  login: (usuari: string, clau: string) => request<User>("POST", "/auth/login", { usuari, clau }),
  logout: () => request<void>("POST", "/auth/logout"),
  me: () => request<User>("GET", "/auth/me"),
  menu: () => request<MenuItem[]>("GET", "/menu"),
  sites: () => request<Site[]>("GET", "/hub/sites"),
  createSite: (s: Omit<Site, "id">) => request<Site>("POST", "/hub/sites", s),
  updateSite: (id: number, s: Partial<Omit<Site, "id">>) => request<Site>("PATCH", `/hub/sites/${id}`, s),
  deleteSite: (id: number) => request<void>("DELETE", `/hub/sites/${id}`),
  agents: () => request<Agent[]>("GET", "/hub/agents"),
  createAgent: (a: Omit<Agent, "id">) => request<Agent>("POST", "/hub/agents", a),
  updateAgent: (id: number, a: Partial<Omit<Agent, "id">>) => request<Agent>("PATCH", `/hub/agents/${id}`, a),
  deleteAgent: (id: number) => request<void>("DELETE", `/hub/agents/${id}`),
};
