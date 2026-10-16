import { Button, Space, Popconfirm } from "antd";

interface CountHeaderButtonsProps {
  entry: boolean;
  isRecount: boolean;
  isDraft: boolean;
  reviewing: boolean;
  counted: number;
  total: number;
  selectedCount: number;
  onDiscard: () => void;
  onSave: () => void;
  onSubmit: () => void;
  onRecount: () => void;
  onReject: () => void;
  onApprove: () => void;
}

/** Actions for whoever is looking: the counter entering numbers, or the approver reviewing them */
export function CountHeaderButtons(p: CountHeaderButtonsProps) {
  return (
    <Space>
      {p.entry && (
        <>
          {p.isDraft && (
            <Popconfirm title="Discard this count?" onConfirm={p.onDiscard}>
              <Button danger>Discard</Button>
            </Popconfirm>
          )}
          <Button onClick={p.onSave}>Save</Button>
          <Popconfirm title={p.isRecount ? "Submit this recount?" : "Submit this count?"} description={`${p.counted} of ${p.total} items counted`} onConfirm={p.onSubmit}>
            <Button type="primary" disabled={p.isRecount ? p.counted < p.total : p.counted === 0}>{p.isRecount ? "Submit recount" : "Submit"}</Button>
          </Popconfirm>
        </>
      )}
      {p.reviewing && (
        <>
          <Button disabled={p.selectedCount === 0} onClick={p.onRecount}>Request recount</Button>
          <Button danger onClick={p.onReject}>Reject</Button>
          <Popconfirm title="Approve and apply this count to stock?" onConfirm={p.onApprove}>
            <Button type="primary">Approve</Button>
          </Popconfirm>
        </>
      )}
    </Space>
  );
}
