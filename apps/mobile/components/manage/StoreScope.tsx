import { useState, type ReactElement } from "react";
import { useLocalSearchParams } from "expo-router";
import { useManageScope } from "../../lib/manage-scope-context";
import { SelectField } from "./ui/SelectField";

interface StoreScopeOptions {
  /** Picking a store changes the header scope for the whole persona instead of staying local to the screen */
  persist?: boolean;
  /** Fall back to the first store and keep the picker visible even when the header scope is a single store */
  defaultFirst?: boolean;
  /** Honour a `storeId` route param ahead of the header scope; the picker is hidden when it is present */
  routeParam?: boolean;
  required?: boolean;
  placeholder?: string;
  /** Show the organization name under each store option */
  showOrg?: boolean;
}

/** Store for a stack screen that needs exactly one: the header scope when set, else `picker` is an element to render for choosing one */
export function useStoreScope({ persist, defaultFirst, routeParam, required, placeholder, showOrg }: StoreScopeOptions = {}) {
  const params = useLocalSearchParams<{ storeId?: string }>();
  const { storeId: scopeStoreId, stores, setStoreId } = useManageScope();
  const [picked, setPicked] = useState<string | null>(null);
  const param = routeParam ? params.storeId : undefined;

  const local = defaultFirst ? (picked ?? scopeStoreId ?? stores[0]?.id ?? null) : (scopeStoreId ?? picked);
  const storeId = param ?? (persist ? scopeStoreId : local);
  const showPicker = persist || defaultFirst || (!param && !scopeStoreId);

  const picker: ReactElement | null = showPicker ? (
    <SelectField
      label="Store"
      required={required}
      value={storeId}
      options={stores.map((s) => ({ value: s.id, label: s.name, description: showOrg ? s.organizationName : undefined }))}
      onChange={persist ? setStoreId : setPicked}
      placeholder={placeholder}
    />
  ) : null;

  return { storeId, picker, hasStores: stores.length > 0 };
}
