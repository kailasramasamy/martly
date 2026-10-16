import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { SelectField } from "../ui/SelectField";
import { SwitchRow } from "../ui/SwitchRow";
import { useManageScope } from "../../../lib/manage-scope-context";
import { roleOptions } from "./constants";
import { ResponsibilitiesSection } from "./ResponsibilitiesSection";

export interface UserDraft {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: string;
  storeIds: string[];
  /** Owner-granted add-on permissions in the current organization */
  addOns: string[];
}

interface UserFieldsProps {
  draft: UserDraft;
  set: (patch: Partial<UserDraft>) => void;
  roles: string[];
  creating: boolean;
  isSuper: boolean;
}

function StoreToggles({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { stores } = useManageScope();
  return (
    <SectionCard title="Store access">
      {stores.map((s) => (
        <SwitchRow key={s.id} label={s.name} description={s.address} value={value.includes(s.id)} onValueChange={(on) => onChange(on ? [...value, s.id] : value.filter((id) => id !== s.id))} />
      ))}
    </SectionCard>
  );
}

export function UserFields({ draft, set, roles, creating, isSuper }: UserFieldsProps) {
  const emailEditable = creating || isSuper;
  return (
    <>
      <SectionCard title="User details">
        <TextField label="Name" required value={draft.name} onChangeText={(name) => set({ name })} />
        <TextField label="Email" required autoCapitalize="none" keyboardType="email-address" editable={emailEditable} hint={emailEditable ? undefined : "Only a super admin can change email"} value={draft.email} onChangeText={(email) => set({ email })} />
        <TextField label="Phone" keyboardType="phone-pad" value={draft.phone} onChangeText={(phone) => set({ phone })} />
        <SelectField label="Role" required value={draft.role || null} options={roleOptions(roles)} onChange={(role) => set({ role })} />
      </SectionCard>
      {emailEditable && (
        <SectionCard title={creating ? "Password" : "Change password"}>
          <TextField label={creating ? "Password" : "New password"} required={creating} secureTextEntry autoCapitalize="none" hint={creating ? "At least 8 characters" : "Leave blank to keep the current password"} value={draft.password} onChangeText={(password) => set({ password })} />
        </SectionCard>
      )}
      {draft.role !== "SUPER_ADMIN" && <StoreToggles value={draft.storeIds} onChange={(storeIds) => set({ storeIds })} />}
      {!isSuper && <ResponsibilitiesSection role={draft.role} value={draft.addOns} onChange={(addOns) => set({ addOns })} />}
    </>
  );
}
