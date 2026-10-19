import { useCallback, useEffect, useState } from "react";
import { axiosInstance } from "../../providers/data-provider";

export interface HomeLayoutItem {
  label: string;
  imageUrl: string | null;
  collectionId: string | null;
}

export interface HomeLayoutSection {
  id: string;
  type: string;
  title: string | null;
  subtitle: string | null;
  collectionId: string | null;
  collection?: { id: string; title: string } | null;
  config: Record<string, any>;
  sortOrder: number;
  isActive: boolean;
  items?: HomeLayoutItem[];
}

export interface SectionPayload {
  type?: string;
  title?: string;
  subtitle?: string;
  collectionId?: string | null;
  config: Record<string, unknown>;
  isActive: boolean;
  /** Tabs of a tabbed row, saved through the items endpoint after the section itself */
  tabs?: TabInput[];
}

export interface TabInput {
  label: string;
  imageUrl?: string;
  collectionId: string;
}

interface LayoutResponse {
  sections: HomeLayoutSection[];
  isDefault: boolean;
}

/** Loads the org's home layout and exposes the edit calls; every edit materializes the default layout first */
export function useHomeLayout(organizationId?: string, ready = true) {
  const [sections, setSections] = useState<HomeLayoutSection[]>([]);
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(true);
  const params = organizationId ? { organizationId } : undefined;

  const load = useCallback(async (): Promise<LayoutResponse> => {
    const res = await axiosInstance.get("/home-layout", { params });
    const data = res.data.data as LayoutResponse;
    setSections(data.sections);
    setIsDefault(data.isDefault);
    return data;
  }, [organizationId]);

  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load, ready]);

  const customize = useCallback(async (): Promise<LayoutResponse> => {
    await axiosInstance.post("/home-layout/customize", undefined, { params });
    return load();
  }, [load, organizationId]);

  /** Returns the ids to act on: after customizing, positions in the default list map to the new ids */
  const ensureCustom = useCallback(async (): Promise<HomeLayoutSection[]> => {
    return isDefault ? (await customize()).sections : sections;
  }, [isDefault, customize, sections]);

  return { sections, isDefault, loading, load, customize, ensureCustom, params, setSections };
}
