import { ROLE_ADDONS } from "@martly/shared/permissions";
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
  addOns: string[];
  isSuper: boolean;
}

/** Save the add-ons the member's role may hold; a super admin has no organization to grant them in */
async function saveAddOns(userId: string, form: UserSubmission): Promise<number> {
  const allowed: readonly string[] = ROLE_ADDONS[form.role] ?? [];
  if (form.isSuper || allowed.length === 0) return 0;
  return api.put(`/api/v1/users/${userId}/permissions`, { permissions: form.addOns.filter((p) => allowed.includes(p)) })
    .then(() => 0, () => 1);
}

/** Create or update the user, reconcile store assignments, then save responsibilities. ORG_ADMIN may not send email or password on update. */
export async function saveUser(existing: UserDetail | undefined, form: UserSubmission): Promise<{ id: string; failed: number }> {
  const fields = { name: form.name.trim(), phone: form.phone.trim() || undefined, ...(form.role !== existing?.role ? { role: form.role } : {}) };
  const superFields = form.isSuper ? { email: form.email.trim(), ...(form.password ? { password: form.password } : {}) } : {};
  const saved = existing
    ? await api.put<{ id: string }>(`/api/v1/users/${existing.id}`, { ...fields, ...superFields })
    : await api.post<{ id: string }>("/api/v1/users", { ...fields, role: form.role, email: form.email.trim(), password: form.password });
  const before = existing?.userStores.map((us) => us.store.id) ?? [];
  const storeFailures = form.role === "SUPER_ADMIN" ? 0 : await syncUserStores(saved.data.id, before, form.storeIds);
  return { id: saved.data.id, failed: storeFailures + (await saveAddOns(saved.data.id, form)) };
}
