import { useCallback } from "react";
import { api } from "../../../lib/api";
import { toQuery } from "../../../lib/manage/query";
import { useAction } from "../../../lib/manage/use-action";
import { useResource } from "../../../lib/manage/use-resource";
import { useManageScope } from "../../../lib/manage-scope-context";
import type { HomeLayoutData, HomeSectionRecord, PreviewHint } from "./types";

const BASE = "/api/v1/home-layout";

/** The organisation's layout, scoped like the admin panel (a SUPER_ADMIN names the organisation) */
export function useHomeLayout() {
  const { organizationId, storeId } = useManageScope();
  const org = toQuery({ organizationId });
  const layout = useResource<HomeLayoutData>(organizationId ? `${BASE}${org}` : null);
  const preview = useResource<PreviewHint[]>(organizationId && storeId ? `${BASE}/preview${toQuery({ organizationId, storeId })}` : null);
  return { organizationId, org, layout, hidden: new Set((preview.data ?? []).filter((h) => !h.resolves).map((h) => h.id)) };
}

/** Mutations for the list screen; each one reloads on failure so the screen never shows a stale order */
export function useLayoutActions(org: string, layout: ReturnType<typeof useResource<HomeLayoutData>>) {
  const { run, running } = useAction();
  const { data, setData, reload } = layout;

  const customize = async () => {
    const res = await run(() => api.post<HomeLayoutData>(`${BASE}/customize${org}`, {}), "Layout customized");
    if (res) setData(res.data);
  };

  const patchLocal = (id: string, patch: Partial<HomeSectionRecord>) =>
    data && setData({ ...data, sections: data.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  const toggle = async (section: HomeSectionRecord, isActive: boolean) => {
    patchLocal(section.id, { isActive });
    if (!(await run(() => api.patch(`${BASE}/${section.id}${org}`, { isActive })))) await reload();
  };

  const move = async (from: number, to: number) => {
    if (!data || to < 0 || to >= data.sections.length) return;
    const sections = [...data.sections];
    sections.splice(to, 0, ...sections.splice(from, 1));
    setData({ ...data, sections });
    if (!(await run(() => api.put(`${BASE}/order${org}`, { ids: sections.map((s) => s.id) })))) await reload();
  };

  const remove = useCallback(async (section: HomeSectionRecord) => {
    const done = await run(() => api.delete(`${BASE}/${section.id}${org}`), "Section removed");
    if (done) await reload();
  }, [run, org, reload]);

  return { customize, toggle, move, remove, running };
}
