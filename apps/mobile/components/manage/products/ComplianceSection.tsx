import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { SelectField } from "../ui/SelectField";
import { GST_OPTIONS } from "./options";
import { TagListField } from "./TagListField";
import type { SectionProps } from "./sections";

const REGULATORY_MARKS = ["FSSAI", "ISI", "AGMARK", "BIS", "ORGANIC_INDIA", "HALAL", "KOSHER", "ECOMARK", "FPO"];
const CERTIFICATIONS = ["Organic", "Cruelty-Free", "ISO 22000", "GMP", "HACCP", "Vegan Certified", "Dermatologically Tested"];

export function ComplianceSection({ values, onChange }: SectionProps) {
  return (
    <SectionCard title="Compliance & tax">
      <SelectField label="GST rate" value={values.gstPercent} options={[{ value: "", label: "Not set" }, ...GST_OPTIONS]}
        onChange={(gstPercent) => onChange({ gstPercent })} placeholder="Select GST rate" />
      <TextField label="HSN code" value={values.hsnCode} onChangeText={(hsnCode) => onChange({ hsnCode })} />
      <TextField label="FSSAI license" value={values.fssaiLicense} maxLength={14} keyboardType="number-pad" onChangeText={(fssaiLicense) => onChange({ fssaiLicense })} hint="14-digit license number" />
      <TextField label="Mfg license no" value={values.mfgLicenseNo} onChangeText={(mfgLicenseNo) => onChange({ mfgLicenseNo })} />
      <TextField label="Manufacturer" value={values.manufacturerName} onChangeText={(manufacturerName) => onChange({ manufacturerName })} />
      <TextField label="Country of origin" value={values.countryOfOrigin} onChangeText={(countryOfOrigin) => onChange({ countryOfOrigin })} placeholder="e.g. India" />
      <TagListField label="Regulatory marks" value={values.regulatoryMarks} onChange={(regulatoryMarks) => onChange({ regulatoryMarks })} suggestions={REGULATORY_MARKS} />
      <TagListField label="Certifications" value={values.certifications} onChange={(certifications) => onChange({ certifications })} suggestions={CERTIFICATIONS} />
      <TextField label="Danger warnings" multiline value={values.dangerWarnings} onChangeText={(dangerWarnings) => onChange({ dangerWarnings })} />
      <TextField label="Usage instructions" multiline value={values.usageInstructions} onChangeText={(usageInstructions) => onChange({ usageInstructions })} />
    </SectionCard>
  );
}
