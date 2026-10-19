import { useEffect, useState } from "react";
import { List, useSelect } from "@refinedev/antd";
import { useGetIdentity } from "@refinedev/core";
import { Alert, Button, Card, Select, type SelectProps, Space, Spin, Switch, Tag, Typography, message, Popconfirm, theme as antTheme } from "antd";
import { BgColorsOutlined, DeleteOutlined, EditOutlined, HolderOutlined, PlusOutlined } from "@ant-design/icons";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EXPANDING_SECTION_TYPES, HomeSectionTypeLabels, COLLECTION_SECTION_TYPES, type HomeSectionType } from "@martly/shared/constants";
import { axiosInstance } from "../../providers/data-provider";
import { StoreSelect } from "../../components/StoreSelect";
import { SectionDrawer } from "./section-drawer";
import { useHomeLayout, type HomeLayoutSection } from "./use-home-layout";
import { useLayoutActions } from "./use-layout-actions";

const { Text } = Typography;

interface PreviewHint { id: string; resolves: boolean }

const GRID_TYPES = ["EXPLORE_GRID", "STORE_GRID"];

interface ArtProps {
  section: HomeLayoutSection;
  onPaint: (s: HomeLayoutSection, repaint: boolean) => Promise<void>;
}

/** Image generation costs credits and takes a while, so both buttons lock until it finishes */
const ArtButtons = ({ section, onPaint }: ArtProps) => {
  const [running, setRunning] = useState<"missing" | "all">();
  const paint = async (repaint: boolean) => {
    setRunning(repaint ? "all" : "missing");
    await onPaint(section, repaint);
    setRunning(undefined);
  };
  const noTiles = (section.items ?? []).length === 0;
  return (
    <Space.Compact>
      <Button size="small" icon={<BgColorsOutlined />} loading={running === "missing"} disabled={!!running || noTiles} onClick={() => paint(false)}>
        Generate art
      </Button>
      <Popconfirm title="Repaint every tile?" description="Replaces all tile images and uses image credits." onConfirm={() => paint(true)} disabled={!!running || noTiles}>
        <Button size="small" loading={running === "all"} disabled={!!running || noTiles}>Repaint all</Button>
      </Popconfirm>
    </Space.Compact>
  );
};

const isAutomatic = (type: string) => (EXPANDING_SECTION_TYPES as readonly string[]).includes(type);
const sectionName = (s: HomeLayoutSection) =>
  s.title || s.collection?.title || HomeSectionTypeLabels[s.type as HomeSectionType] || s.type;

interface RowProps {
  section: HomeLayoutSection;
  hint?: PreviewHint;
  storeName?: string;
  onToggle: (s: HomeLayoutSection, active: boolean) => void;
  onEdit: (s: HomeLayoutSection) => void;
  onDelete: (s: HomeLayoutSection) => void;
  onPaint: (s: HomeLayoutSection, repaint: boolean) => Promise<void>;
}

const SectionRow = ({ section, hint, storeName, onToggle, onEdit, onDelete, onPaint }: RowProps) => {
  const { token } = antTheme.useToken();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const hidden = hint && !hint.resolves;
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        marginBottom: 8,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadius,
        background: isDragging ? token.colorBgElevated : token.colorBgContainer,
        opacity: section.isActive ? 1 : 0.6,
        position: "relative",
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      <HolderOutlined ref={setActivatorNodeRef} {...attributes} {...listeners} style={{ cursor: "grab", color: token.colorTextQuaternary }} />
      <Tag color={(COLLECTION_SECTION_TYPES as readonly string[]).includes(section.type) ? "geekblue" : "default"} style={{ margin: 0 }}>
        {HomeSectionTypeLabels[section.type as HomeSectionType] ?? section.type}
      </Tag>
      {isAutomatic(section.type) && <Tag color="purple" style={{ margin: 0 }}>automatic</Tag>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text strong ellipsis>{sectionName(section)}</Text>
        {hidden && (
          <div><Text type="warning" style={{ fontSize: 12 }}>Hidden at {storeName}: nothing to show there</Text></div>
        )}
      </div>
      {GRID_TYPES.includes(section.type) && <ArtButtons section={section} onPaint={onPaint} />}
      <Switch checked={section.isActive} onChange={(v) => onToggle(section, v)} />
      <Button icon={<EditOutlined />} size="small" onClick={() => onEdit(section)}>Edit</Button>
      <Popconfirm title="Remove this section?" onConfirm={() => onDelete(section)}>
        <Button icon={<DeleteOutlined />} size="small" danger>Delete</Button>
      </Popconfirm>
    </div>
  );
};

const OrgPicker = ({ value, onChange }: { value?: string; onChange: (id: string) => void }) => {
  const { selectProps } = useSelect({ resource: "organizations", optionLabel: "name", optionValue: "id" });
  return <Select {...(selectProps as SelectProps)} value={value} onChange={onChange} placeholder="Select organization" style={{ minWidth: 240 }} />;
};

const usePreview = (organizationId: string | undefined, storeId: string | undefined, version: unknown) => {
  const [hints, setHints] = useState<Record<string, PreviewHint>>({});
  useEffect(() => {
    if (!storeId) { setHints({}); return; }
    axiosInstance
      .get("/home-layout/preview", { params: { storeId, organizationId } })
      .then((res) => setHints(Object.fromEntries((res.data.data as PreviewHint[]).map((h) => [h.id, h]))))
      .catch((e) => { if (e?.response?.status !== 404) message.error("Could not load the preview hints"); setHints({}); });
  }, [storeId, organizationId, version]);
  return hints;
};

export const HomeLayoutList = () => {
  const { data: identity } = useGetIdentity<{ role: string }>();
  const isSuper = identity?.role === "SUPER_ADMIN";
  const [orgId, setOrgId] = useState<string>();
  const layout = useHomeLayout(orgId, !!identity && (!isSuper || !!orgId));
  const [storeId, setStoreId] = useState<string>();
  const [storeName, setStoreName] = useState<string>();
  const [drawer, setDrawer] = useState<{ open: boolean; section?: HomeLayoutSection }>({ open: false });
  const hints = usePreview(orgId, storeId, layout.sections);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const { sections } = layout;

  const { onToggle, onDelete, onDragEnd, onSave, onCustomize, onPaint } = useLayoutActions(layout, drawer.section, () => setDrawer({ open: false }));

  return (
    <List
      title="Home layout"
      headerButtons={
        <Space wrap>
          {isSuper && <OrgPicker value={orgId} onChange={setOrgId} />}
          <StoreSelect
            allowClear
            placeholder="Preview at store"
            style={{ minWidth: 200 }}
            onChange={(v, opt) => { setStoreId(v); setStoreName((opt as { label?: string })?.label); }}
          />
          <Button type="primary" icon={<PlusOutlined />} disabled={isSuper && !orgId} onClick={() => setDrawer({ open: true })}>
            Add section
          </Button>
        </Space>
      }
    >
      {isSuper && !orgId ? (
        <Alert type="info" showIcon message="Select an organization to manage its home layout" />
      ) : (
        <Spin spinning={layout.loading}>
          {layout.isDefault && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="Using the default layout — customize to change it"
              action={<Button size="small" type="primary" onClick={onCustomize}>Customize</Button>}
            />
          )}
          <Card size="small" styles={{ body: { padding: 12 } }}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {sections.map((s) => (
                  <SectionRow
                    key={s.id}
                    section={s}
                    hint={hints[s.id]}
                    storeName={storeName}
                    onToggle={onToggle}
                    onEdit={(sec) => setDrawer({ open: true, section: sec })}
                    onDelete={onDelete}
                    onPaint={onPaint}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </Card>
        </Spin>
      )}
      <SectionDrawer open={drawer.open} section={drawer.section} onClose={() => setDrawer({ open: false })} onSave={onSave} />
    </List>
  );
};
