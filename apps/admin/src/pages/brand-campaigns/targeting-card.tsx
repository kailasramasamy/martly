import { useEffect, useState } from "react";
import { Card, Form, Radio, Select } from "antd";
import { INDIAN_STATES } from "@martly/shared/constants";
import { axiosInstance } from "../../providers/data-provider";
import type { Campaign } from "./types";

export type TargetMode = "ALL" | "REGIONS" | "STORES";

interface RegionRow { state: string; district: string | null; stores: number }

export const inferTargetMode = (c: Pick<Campaign, "targetStoreIds" | "targetStates" | "targetDistricts">): TargetMode =>
  c.targetStoreIds.length ? "STORES" : c.targetStates.length || c.targetDistricts.length ? "REGIONS" : "ALL";

function useDistrictOptions() {
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    axiosInstance.get("/brand-campaigns/regions").then((res) =>
      setOptions((res.data.data as RegionRow[]).flatMap((r) =>
        r.district ? [{ value: `${r.state}:${r.district}`, label: `${r.district}, ${r.state} · ${r.stores} stores` }] : [])),
    );
  }, []);
  return options;
}

interface TargetingCardProps {
  mode: TargetMode;
  stores: { id: string; name: string }[];
}

export function TargetingCard({ mode, stores }: TargetingCardProps) {
  const districts = useDistrictOptions();
  return (
    <Card title="Where it runs" size="small">
      <Form.Item name="targetMode" extra="Runs only in stores that stock the brand" style={{ marginBottom: mode === "ALL" ? 0 : undefined }}>
        <Radio.Group options={[{ value: "ALL", label: "All stores" }, { value: "REGIONS", label: "Regions" }, { value: "STORES", label: "Selected stores" }]} />
      </Form.Item>
      {mode === "REGIONS" && (
        <>
          <Form.Item name="targetStates" label="States">
            <Select mode="multiple" optionFilterProp="label" options={INDIAN_STATES.map((s) => ({ value: s, label: s }))} />
          </Form.Item>
          <Form.Item name="targetDistricts" label="Districts" style={{ marginBottom: 0 }}>
            <Select mode="multiple" optionFilterProp="label" options={districts} />
          </Form.Item>
        </>
      )}
      {mode === "STORES" && (
        <Form.Item name="targetStoreIds" style={{ marginBottom: 0 }}>
          <Select mode="multiple" optionFilterProp="label" options={stores.map((s) => ({ value: s.id, label: s.name }))} />
        </Form.Item>
      )}
    </Card>
  );
}
