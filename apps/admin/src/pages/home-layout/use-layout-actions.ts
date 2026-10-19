import { message } from "antd";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { axiosInstance } from "../../providers/data-provider";
import type { useAiImages } from "../../hooks/use-ai-images";
import type { HomeLayoutSection, SectionPayload, useHomeLayout } from "./use-home-layout";

const ART_TIMEOUT_MS = 5 * 60 * 1000;

type Layout = ReturnType<typeof useHomeLayout>;

/** Edit calls for the layout list; each customizes the default layout first so ids stay valid */
export function useLayoutActions(layout: Layout, editing: HomeLayoutSection | undefined, onSaved: () => void, ai: ReturnType<typeof useAiImages>) {
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

  /** Creates or updates the section and returns its persisted id */
  const saveSection = async (body: Omit<SectionPayload, "items">): Promise<string> => {
    if (editing) {
      const { type: _type, ...rest } = body;
      const id = await resolveId(editing);
      await axiosInstance.patch(`/home-layout/${id}`, rest, { params });
      return id;
    }
    await layout.ensureCustom();
    return (await axiosInstance.post("/home-layout", body, { params })).data.data.id;
  };

  const onSave = async ({ items, ...body }: SectionPayload) => {
    const id = await saveSection(body);
    if (items) await axiosInstance.put(`/home-layout/${id}/items`, { items }, { params });
    await layout.load();
    onSaved();
    message.success("Section saved");
  };

  /** Paints tile art for a saved grid section; image generation can run for minutes */
  const onPaint = async (s: HomeLayoutSection, repaint: boolean) => {
    try {
      const id = await resolveId(s);
      const res = await axiosInstance.post(`/home-layout/${id}/art`, repaint ? { repaint } : {}, { params, timeout: ART_TIMEOUT_MS });
      await layout.load();
      void ai.refresh();
      const painted = res.data.data.painted as number;
      message.success(`Painted ${painted} ${painted === 1 ? "tile" : "tiles"}`);
    } catch (e: any) {
      if (ai.handleExhausted(e)) return;
      message.error(e?.code === "ECONNABORTED" ? "Painting is taking too long; refresh in a minute to see the tiles" : (e?.response?.data?.error ?? e?.response?.data?.message ?? "Could not paint tiles"));
    }
  };

  return { onPaint, onToggle, onDelete, onDragEnd, onSave, onCustomize: () => run(layout.customize, "Layout customized") };
}
