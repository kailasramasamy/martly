import { useState } from "react";
import { Create } from "@refinedev/antd";
import { Segmented } from "antd";
import { PromoCreateCard } from "./create-card";
import { ManualPromoForm } from "./manual/form";

type Kind = "AI" | "MANUAL";

export const PromoCreate = () => {
  const [kind, setKind] = useState<Kind>("AI");
  return (
    <Create title="New promotion" footerButtons={[]}>
      <Segmented<Kind>
        value={kind}
        onChange={setKind}
        options={[{ value: "AI", label: "AI promotion" }, { value: "MANUAL", label: "Manual promotion" }]}
        style={{ marginBottom: 16 }}
      />
      {kind === "AI" ? <PromoCreateCard /> : <ManualPromoForm />}
    </Create>
  );
};
