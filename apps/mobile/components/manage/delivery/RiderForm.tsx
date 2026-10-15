import { useState } from "react";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";
import type { Rider } from "./types";

export interface RiderValues {
  name: string;
  phone: string;
  email: string;
  password: string;
}

interface RiderFormProps {
  rider?: Rider;
  saving: boolean;
  onSubmit: (values: RiderValues) => void;
}

type Errors = Partial<Record<keyof RiderValues, string>>;

function validate(v: RiderValues, isNew: boolean): Errors {
  const errors: Errors = {};
  if (v.name.trim().length < 2) errors.name = "Enter the rider's name";
  if (v.phone.trim().length < 10 || v.phone.trim().length > 15) errors.phone = "Enter a 10 to 15 digit phone number";
  if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) errors.email = "Enter a valid email";
  if ((isNew || v.password) && (v.password.length < 6 || v.password.length > 100)) errors.password = "Use at least 6 characters";
  return errors;
}

/** Create or edit form for a rider; the password stays optional when editing */
export function RiderForm({ rider, saving, onSubmit }: RiderFormProps) {
  const [values, setValues] = useState<RiderValues>({
    name: rider?.name ?? "",
    phone: rider?.phone ?? "",
    email: rider?.email ?? "",
    password: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const set = (key: keyof RiderValues) => (text: string) => setValues((v) => ({ ...v, [key]: text }));

  const submit = () => {
    const found = validate(values, !rider);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit({ ...values, name: values.name.trim(), phone: values.phone.trim(), email: values.email.trim() });
  };

  return (
    <>
      <SectionCard title="Rider details">
        <TextField label="Name" required value={values.name} onChangeText={set("name")} error={errors.name} autoCapitalize="words" />
        <TextField label="Phone" required value={values.phone} onChangeText={set("phone")} error={errors.phone} keyboardType="phone-pad" />
        <TextField label="Email" required value={values.email} onChangeText={set("email")} error={errors.email} keyboardType="email-address" autoCapitalize="none" />
        <TextField
          label={rider ? "New password" : "Password"}
          required={!rider}
          hint={rider ? "Leave empty to keep the current password" : undefined}
          value={values.password}
          onChangeText={set("password")}
          error={errors.password}
          secureTextEntry
          autoCapitalize="none"
        />
      </SectionCard>
      <Button label={rider ? "Save changes" : "Add rider"} onPress={submit} loading={saving} />
    </>
  );
}
