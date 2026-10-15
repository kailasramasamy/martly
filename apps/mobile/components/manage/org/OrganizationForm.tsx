import { useState } from "react";
import { StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { FESTIVAL_REGIONS } from "@martly/shared/constants";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useToast } from "../../../lib/toast-context";
import { ManageStackScreen } from "../ManageStackScreen";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { SwitchRow } from "../ui/SwitchRow";
import { Button } from "../ui/Button";
import { DeleteAction } from "../delivery-config/DeleteAction";
import { numberText, parseNumber } from "../delivery-config/numbers";
import { slugify } from "./store-draft";
import type { OrganizationRow } from "./types";

const SLUG = /^[a-z0-9-]+$/;

function problem(name: string, slug: string, regions: string[], cap: number | null, editing: boolean): string | null {
  if (!name.trim()) return "Name is required";
  if (!SLUG.test(slug)) return "Slug can only use lowercase letters, numbers and hyphens";
  if (!editing) return null;
  if (regions.length === 0) return "Pick at least one festival region";
  if (cap === null || !Number.isInteger(cap) || cap < 1 || cap > 90) return "Promo discount cap must be a whole number from 1 to 90";
  return null;
}

interface OrgSettingsProps {
  regions: string[];
  onToggle: (code: string, on: boolean) => void;
  cap: string;
  onCap: (text: string) => void;
  loading: boolean;
  onDelete: () => void;
}

function OrgSettings({ regions, onToggle, cap, onCap, loading, onDelete }: OrgSettingsProps) {
  return (
    <>
      <SectionCard title="Festival calendar regions">
        {Object.entries(FESTIVAL_REGIONS).map(([code, label]) => (
          <SwitchRow key={code} label={label} value={regions.includes(code)} onValueChange={(on) => onToggle(code, on)} />
        ))}
      </SectionCard>
      <SectionCard title="Promotions">
        <TextField label="Promo discount cap" suffix="%" keyboardType="number-pad" hint="The promo agent never sets a discount above this" value={cap} onChangeText={onCap} />
      </SectionCard>
      <SectionCard title="Danger zone">
        <DeleteAction title="Delete this organization?" message="Organizations that still have stores or users can't be deleted." loading={loading} onConfirm={onDelete} />
      </SectionCard>
    </>
  );
}

export function OrganizationForm({ org }: { org?: OrganizationRow }) {
  const router = useRouter();
  const toast = useToast();
  const { run, running } = useAction();
  const [name, setName] = useState(org?.name ?? "");
  const [slug, setSlug] = useState(org?.slug ?? "");
  const [regions, setRegions] = useState<string[]>(org?.festivalRegions ?? ["ALL"]);
  const [cap, setCap] = useState(numberText(org?.promoDiscountCap ?? 20));

  const rename = (value: string) => {
    if (!org && slug === slugify(name)) setSlug(slugify(value));
    setName(value);
  };
  const toggleRegion = (code: string, on: boolean) => setRegions((r) => (on ? [...r, code] : r.filter((x) => x !== code)));

  const save = async () => {
    const promoDiscountCap = parseNumber(cap);
    const invalid = problem(name, slug, regions, promoDiscountCap, !!org);
    if (invalid) return toast.show(invalid, "error");
    const base = { name: name.trim(), slug };
    const done = await run(
      () => (org ? api.put(`/api/v1/organizations/${org.id}`, { ...base, festivalRegions: regions, promoDiscountCap }) : api.post("/api/v1/organizations", base)),
      org ? "Organization updated" : "Organization created",
    );
    if (done) router.back();
  };

  const remove = async () => {
    if (!org) return;
    const done = await run(() => api.delete(`/api/v1/organizations/${org.id}`), "Organization deleted");
    if (done) router.back();
  };

  return (
    <ManageStackScreen
      title={org?.name ?? "New organization"}
      actions={<Button label={org ? "Save changes" : "Create organization"} onPress={save} loading={running} style={styles.flex} />}
    >
      <SectionCard title="Organization details">
        <TextField label="Name" required value={name} onChangeText={rename} />
        <TextField label="Slug" required autoCapitalize="none" hint="Lowercase letters, numbers and hyphens" value={slug} onChangeText={setSlug} />
      </SectionCard>
      {org && <OrgSettings regions={regions} onToggle={toggleRegion} cap={cap} onCap={setCap} loading={running} onDelete={remove} />}
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
