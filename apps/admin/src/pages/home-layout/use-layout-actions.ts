import { message } from "antd";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { axiosInstance } from "../../providers/data-provider";
import type { HomeLayoutSection, SectionPayload, useHomeLayout } from "./use-home-layout";

type Layout = ReturnType<typeof useHomeLayout>;

/** Edit calls for the layout list; each customizes the default layout first so ids stay valid */
export function useLayoutActions(layout: Layout, editing: HomeLayoutSection | undefined, onSaved: () => void) {
  const { sections, params } = layout;

  /** Resolves a row to its persisted id, customizing the default layout first when needed */
  const resolveId = async (section: HomeLayoutSection) => {
    const index = sections.findIndex((s) => s.id === section.id);
    return (await layout.ensureCustom())[index]?.id;
  };

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    try {
      await fn();
      await layout.load();
      if (done) message.success(done);
    } catch (e: any) {
      message.error(e?.response?.data?.error ?? e?.response?.data?.message ?? "Request failed");
    }
  };

  const onToggle = (s: HomeLayoutSection, isActive: boolean) =>
    run(async () => axiosInstance.patch(`/home-layout/${await resolveId(s)}`, { isActive }, { params }));
  const onDelete = (s: HomeLayoutSection) =>
    run(async () => axiosInstance.delete(`/home-layout/${await resolveId(s)}`, { params }), "Section removed");

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const next = arrayMove(sections, sections.findIndex((s) => s.id === active.id), sections.findIndex((s) => s.id === over.id));
    layout.setSections(next);
    run(async () => {
      const fresh = await layout.ensureCustom();
      const ids = layout.isDefault ? next.map((s) => fresh[sections.findIndex((o) => o.id === s.id)].id) : next.map((s) => s.id);
      await axiosInstance.put("/home-layout/order", { ids }, { params });
    });
  };

  const onSave = async (payload: SectionPayload) => {
    const existing = editing;
    if (existing) {
      const { type: _type, ...rest } = payload;
      await axiosInstance.patch(`/home-layout/${await resolveId(existing)}`, rest, { params });
    } else {
      await layout.ensureCustom();
      await axiosInstance.post("/home-layout", payload, { params });
    }
    await layout.load();
    onSaved();
    message.success("Section saved");
  };

  return { onToggle, onDelete, onDragEnd, onSave, onCustomize: () => run(layout.customize, "Layout customized") };
}
