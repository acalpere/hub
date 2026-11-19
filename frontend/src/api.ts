export type Role = "admin" | "germa" | "usuari";
export interface Profile { first_name: string; last_name: string; email: string; phone: string }
export interface User extends Profile { id: number; username: string; role: Role }
export type LoginStep = "mfa_required" | "mfa_setup";
export interface Passkey { id: number; label: string; created_at: string | null }
export interface MenuItem { id: number; name: string; url: string }
export interface Access {
  site_ids: number[]; agent_ids: number[]; work_agent_ids: number[]; content_ids: number[];
}
export interface Verse { id: number; text: string; created_at: string | null }
export interface VerseSettings { max_length: number; font_large: number; font_small: number }
export interface CustomNeed {
  id: number; slug: string; name: string; tagline: string; what: string;
  services: { name: string; why: string }[]; custom: true;
}
export interface SavedAnswer { id: number; question: string; answer: string; created_at: string | null }
export interface Content { id: number; name: string; url: string; roles: string[] }
export interface Site { id: number; name: string; url: string; status: string; notes: string }
export interface Agent {
  id: number; name: string; kind: string; enabled: boolean; site_id: number | null;
  config: Record<string, unknown>; can_work?: boolean;
}

export type CyranoKind = "speech" | "stage" | "text" | "title" | "note";
export interface CyranoLine {
  id: number; act: number; scene: number; kind: CyranoKind;
  speaker: string | null; stamp: string | null; text: string;
}
export interface CyranoRevision {
  id: number; speaker: string | null; kind: CyranoKind; text: string; stamp: string | null;
  edited_by: string | null; edited_at: string | null;
}
export interface CyranoOutline {
  acts: { act: number; title: string; scenes: number[] }[];
  speakers: { name: string; lines: number }[];
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
  }).catch(() => {
    throw new ApiError(0, "No s'ha pogut connectar amb el servidor.");
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
  login: (usuari: string, clau: string) =>
    request<{ status: LoginStep }>("POST", "/auth/login", { usuari, clau }),
  mfa: (code: string) => request<User>("POST", "/auth/mfa", { code }),
  mfaSetup: () => request<{ secret: string; uri: string }>("POST", "/auth/mfa/setup"),
  mfaEnable: (code: string) => request<User>("POST", "/auth/mfa/enable", { code }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  passkeyLoginOptions: () => request<Record<string, any>>("POST", "/auth/passkey/options"),
  passkeyLogin: (credential: unknown) => request<User>("POST", "/auth/passkey/login", { credential }),
  reverifyCode: (code: string) => request<unknown>("POST", "/auth/reverify/code", { code }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reverifyPasskeyOptions: () => request<Record<string, any>>("POST", "/auth/reverify/passkey/options"),
  reverifyPasskey: (credential: unknown) => request<unknown>("POST", "/auth/reverify/passkey", { credential }),
  passkeys: () => request<Passkey[]>("GET", "/auth/passkeys"),
  passkeyRegisterOptions: () => request<Record<string, any>>("POST", "/auth/passkeys/options"),
  passkeyRegister: (credential: unknown, label: string) =>
    request<Passkey>("POST", "/auth/passkeys", { credential, label }),
  passkeyDelete: (id: number) => request<void>("DELETE", `/auth/passkeys/${id}`),
  awsTutor: (q: { service?: string; concept?: string; question: string; history: { role: "user" | "assistant"; text: string }[]; level?: string }) =>
    request<{ answer: string }>("POST", "/aws/tutor", q),
  awsExplain: (topic: string, level: string) =>
    request<{ answer: string }>("POST", "/aws/explain", { topic, level }),
  awsQuiz: (topic: string, level: string, count: number) =>
    request<{ cards: { question: string; answer: string }[] }>("POST", "/aws/quiz", { topic, level, count }),
  awsNeeds: () => request<CustomNeed[]>("GET", "/aws/needs"),
  createAwsNeed: (name: string) => request<CustomNeed>("POST", "/aws/needs", { name }),
  deleteAwsNeed: (id: number) => request<void>("DELETE", `/aws/needs/${id}`),
  awsMarks: () => request<Record<string, number>>("GET", "/aws/marks"),
  setAwsMark: (key: string, level: number) => request<Record<string, number>>("PUT", "/aws/marks", { key, level }),
  awsSaved: () => request<SavedAnswer[]>("GET", "/aws/saved"),
  saveAwsAnswer: (question: string, answer: string) => request<SavedAnswer>("POST", "/aws/saved", { question, answer }),
  deleteAwsSaved: (id: number) => request<void>("DELETE", `/aws/saved/${id}`),
  mfaKey: (code: string) => request<{ secret: string; uri: string }>("POST", "/auth/mfa/key", { code }),
  randomVerse: (exclude?: number) =>
    request<Verse | null>("GET", `/verses/random${exclude ? `?exclude=${exclude}` : ""}`),
  verseSettings: () => request<VerseSettings>("GET", "/verses/settings"),
  setVerseSettings: (s: VerseSettings) => request<VerseSettings>("PUT", "/verses/settings", s),
  verses: () => request<Verse[]>("GET", "/verses"),
  createVerse: (text: string) => request<Verse>("POST", "/verses", { text }),
  updateVerse: (id: number, text: string) => request<Verse>("PUT", `/verses/${id}`, { text }),
  deleteVerse: (id: number) => request<void>("DELETE", `/verses/${id}`),
  logout: () => request<void>("POST", "/auth/logout"),
  me: () => request<User>("GET", "/auth/me"),
  updateProfile: (profile: Profile) => request<User>("PUT", "/auth/profile", profile),
  changePassword: (actual: string, nova: string) =>
    request<void>("POST", "/auth/password", { actual, nova }),
  cyranoOutline: () => request<CyranoOutline>("GET", "/cyrano/outline"),
  cyranoVideo: () => request<{ available: boolean; url: string | null }>("GET", "/cyrano/video"),
  cyranoText: () => request<CyranoLine[]>("GET", "/cyrano/text"),
  cyranoScene: (act: number, scene: number) => request<CyranoLine[]>("GET", `/cyrano/scenes/${act}/${scene}`),
  cyranoSearch: (q: string, speaker: string) =>
    request<{ results: CyranoLine[]; truncated: boolean }>(
      "GET", `/cyrano/search?q=${encodeURIComponent(q)}&speaker=${encodeURIComponent(speaker)}`,
    ),
  cyranoEdit: (id: number, line: { speaker: string | null; kind: CyranoKind; text: string; stamp: string | null }) =>
    request<CyranoLine>("PUT", `/cyrano/lines/${id}`, line),
  cyranoInsert: (afterId: number, line: { speaker: string | null; kind: CyranoKind; text: string; stamp: string | null }) =>
    request<CyranoLine>("POST", `/cyrano/lines/${afterId}/insert`, line),
  cyranoDelete: (id: number) => request<{ ok: boolean }>("DELETE", `/cyrano/lines/${id}`),
  cyranoHistory: (id: number) => request<CyranoRevision[]>("GET", `/cyrano/lines/${id}/history`),
  cyranoRestore: (id: number, revisionId: number) =>
    request<CyranoLine>("POST", `/cyrano/lines/${id}/restore`, { revision_id: revisionId }),
  menu: () => request<MenuItem[]>("GET", "/menu"),
  users: () => request<User[]>("GET", "/users"),
  createUser: (u: Profile & { username: string; password: string; role: Role }) => request<User>("POST", "/users", u),
  updateUser: (id: number, u: Profile & { username: string; role: Role }) => request<User>("PUT", `/users/${id}`, u),
  userAccess: (id: number) => request<Access>("GET", `/users/${id}/access`),
  setUserAccess: (id: number, a: Access) => request<Access>("PUT", `/users/${id}/access`, a),
  contents: () => request<Content[]>("GET", "/contents"),
  setAgentEnabled: (id: number, enabled: boolean) => request<Agent>("PUT", `/hub/agents/${id}/enabled`, { enabled }),
  sites: () => request<Site[]>("GET", "/hub/sites"),
  createSite: (s: Omit<Site, "id">) => request<Site>("POST", "/hub/sites", s),
  updateSite: (id: number, s: Partial<Omit<Site, "id">>) => request<Site>("PATCH", `/hub/sites/${id}`, s),
  deleteSite: (id: number) => request<void>("DELETE", `/hub/sites/${id}`),
  agents: () => request<Agent[]>("GET", "/hub/agents"),
  createAgent: (a: Omit<Agent, "id">) => request<Agent>("POST", "/hub/agents", a),
  updateAgent: (id: number, a: Partial<Omit<Agent, "id">>) => request<Agent>("PATCH", `/hub/agents/${id}`, a),
  deleteAgent: (id: number) => request<void>("DELETE", `/hub/agents/${id}`),
};
