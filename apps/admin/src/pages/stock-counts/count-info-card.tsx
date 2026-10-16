import { Card, Descriptions, Tag, Alert } from "antd";
import dayjs from "dayjs";
import { COUNT_STATUS_CONFIG } from "../../constants/tag-colors";
import type { CountDetail } from "./count-items-table";

const when = (iso: string) => dayjs(iso).format("DD MMM YYYY, HH:mm");

/** Header facts for a count, plus the recount banner or review note */
export function CountInfoCard({ count, counterView }: { count: CountDetail; counterView: boolean }) {
  const cfg = COUNT_STATUS_CONFIG[count.status];
  const isRecount = count.status === "RECOUNT";
  return (
    <Card style={{ marginBottom: 16 }}>
      <Descriptions size="small" column={{ xs: 1, md: 3 }}>
        <Descriptions.Item label="Status"><Tag color={cfg?.color}>{cfg?.label ?? count.status}</Tag></Descriptions.Item>
        <Descriptions.Item label="Store">{count.store.name}</Descriptions.Item>
        <Descriptions.Item label="Aisle">{count.subcategory.name}</Descriptions.Item>
        <Descriptions.Item label="Created by">{count.createdBy.name}</Descriptions.Item>
        <Descriptions.Item label="Submitted">{count.submittedAt ? when(count.submittedAt) : "—"}</Descriptions.Item>
        {count.reviewedBy && (
          <Descriptions.Item label="Reviewed by">
            {count.reviewedBy.name}
            {count.reviewedAt ? ` (${when(count.reviewedAt)})` : ""}
          </Descriptions.Item>
        )}
        {count.note && <Descriptions.Item label="Note" span={3}>{count.note}</Descriptions.Item>}
      </Descriptions>
      {isRecount && (
        <Alert
          style={{ marginTop: 12 }}
          type="warning"
          showIcon
          message={`${counterView ? "Recount requested" : "Waiting for recount"} · ${count.recountItems} items`}
          description={count.reviewNote}
        />
      )}
      {count.reviewNote && !isRecount && (
        <Alert style={{ marginTop: 12 }} type={count.status === "REJECTED" ? "error" : "info"} message={`Review note: ${count.reviewNote}`} />
      )}
    </Card>
  );
}
