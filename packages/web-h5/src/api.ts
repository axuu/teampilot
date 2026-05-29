export async function api<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { credentials: "include", headers: { "content-type": "application/json", ...(opts.headers ?? {}) }, ...opts });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((body as any).error ?? "请求失败"), { status: res.status, body });
  return body as T;
}
export const get = <T>(p: string) => api<T>(p);
export const post = <T>(p: string, data?: unknown) => api<T>(p, { method: "POST", body: JSON.stringify(data ?? {}) });
export const put = <T>(p: string, data?: unknown) => api<T>(p, { method: "PUT", body: JSON.stringify(data ?? {}) });
