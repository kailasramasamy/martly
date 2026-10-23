import { useState } from "react";
import { Button, Modal, Typography } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import type { AdProductKind } from "@martly/shared/constants";
import { previewFor, type PlacementMockup } from "./placement-previews";

export interface PreviewTarget { name: string; kind: AdProductKind; placement: string | null }

function Pager({ mockups }: { mockups: PlacementMockup[] }) {
  const [index, setIndex] = useState(0);
  const current = mockups[index];
  const Mockup = current.render;
  const many = mockups.length > 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "8px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {many && <Button shape="circle" icon={<LeftOutlined />} disabled={index === 0} onClick={() => setIndex(index - 1)} aria-label="Previous view" />}
        <Mockup />
        {many && <Button shape="circle" icon={<RightOutlined />} disabled={index === mockups.length - 1} onClick={() => setIndex(index + 1)} aria-label="Next view" />}
      </div>
      <Typography.Text style={{ textAlign: "center", maxWidth: 320 }}>{current.caption}</Typography.Text>
      {many && (
        <div style={{ display: "flex", gap: 6 }}>
          {mockups.map((_, i) => <span key={i} style={{ width: i === index ? 18 : 6, height: 6, borderRadius: 3, background: i === index ? "#0d9488" : "#e2e8f0" }} />)}
        </div>
      )}
    </div>
  );
}

/** "Where it shows" for a package: its mockups one at a time with captions */
export function PlacementPreviewModal({ target, onClose }: { target: PreviewTarget | null; onClose: () => void }) {
  const preview = target ? previewFor(target.kind, target.placement) : null;
  return (
    <Modal open={!!target && !!preview} title={target?.name} onCancel={onClose} footer={null} centered destroyOnHidden width={440}>
      {target && preview && <Pager key={`${target.kind}-${target.placement}`} mockups={preview.mockups} />}
    </Modal>
  );
}
