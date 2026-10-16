import { Tag, Space } from "antd";
import dayjs from "dayjs";

import type { CountItem } from "./count-items-table";

const REVISION_LABEL = { COUNT: "Counted", RECOUNT: "Recounted", CORRECTION: "Corrected to" } as const;

export const LineTags = ({ item }: { item: CountItem }) => (
  <Space size={4} wrap>
    {item.applied && <Tag color="green">Applied</Tag>}
    {item.revisions?.some((r) => r.kind === "CORRECTION") && <Tag color="blue">Corrected</Tag>}
    {item.recountRequested && <Tag color="volcano">Recount</Tag>}
  </Space>
);

export const LineHistory = ({ item }: { item: CountItem }) => (
  <ul style={{ margin: 0, paddingLeft: 20 }}>
    {(item.revisions ?? []).map((r, i) => (
      <li key={i}>
        {REVISION_LABEL[r.kind]} {r.qty} — {r.userName} — {dayjs(r.createdAt).format("DD MMM HH:mm")}
        {r.reason ? ` — ${r.reason}` : ""}
      </li>
    ))}
  </ul>
);
