import { api } from "../../../lib/api";
import type { UserDetail } from "./types";

/** Apply a store-assignment diff via the store staff endpoints; resolves to how many calls failed */
async function syncUserStores(userId: string, before: string[], after: string[]): Promise<number> {
  const calls = [
    ...after.filter((id) => !before.includes(id)).map((id) => api.post(`/api/v1/stores/${id}/staff`, { userId })),
    ...before.filter((id) => !after.includes(id)).map((id) => api.delete(`/api/v1/stores/${id}/staff/${userId}`)),
  ];
  const results = await Promise.allSettled(calls);
  return results.filter((r) => r.status === "rejected").length;
}

export interface UserSubmission {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: string;
  storeIds: string[];
  isSuper: boolean;
}

/** Create or update the user, then reconcile store assignments. ORG_ADMIN may not send email or password on update. */
export async function saveUser(existing: UserDetail | undefined, form: UserSubmission): Promise<{ id: string; failed: number }> {
  const fields = { name: form.name.trim(), phone: form.phone.trim() || undefined, ...(form.role !== existing?.role ? { role: form.role } : {}) };
  const superFields = form.isSuper ? { email: form.email.trim(), ...(form.password ? { password: form.password } : {}) } : {};
  const saved = existing
    ? await api.put<{ id: string }>(`/api/v1/users/${existing.id}`, { ...fields, ...superFields })
    : await api.post<{ id: string }>("/api/v1/users", { ...fields, role: form.role, email: form.email.trim(), password: form.password });
  const before = existing?.userStores.map((us) => us.store.id) ?? [];
  const failed = form.role === "SUPER_ADMIN" ? 0 : await syncUserStores(saved.data.id, before, form.storeIds);
  return { id: saved.data.id, failed };
}
