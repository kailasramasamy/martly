import { useState } from "react";
import { SegmentedTabs } from "../../ui/SegmentedTabs";
import { OrdersList } from "./OrdersList";
import { PlansList } from "./PlansList";

const VIEWS = [{ value: "orders", label: "Orders" }, { value: "plans", label: "Store plans" }];

export function RevenueScreen() {
  const [view, setView] = useState("orders");
  const switcher = <SegmentedTabs options={VIEWS} value={view} onChange={setView} />;
  return view === "orders" ? <OrdersList switcher={switcher} /> : <PlansList switcher={switcher} />;
}
