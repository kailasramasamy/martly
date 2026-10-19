import { useEffect, useState } from "react";
import { App, Button, Card, Input, Popconfirm, Select, Space, Typography } from "antd";
import { DeleteOutlined, HomeOutlined, ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import { isAxiosError } from "axios";
import { axiosInstance } from "../../providers/data-provider";
import { sectionTitle } from "../../theme";
import { AI_IMAGE_COST } from "@martly/shared/constants";
import { AiImageUsage } from "../../components/ai-images/ai-image-usage";
import { canAfford, useAiImages } from "../../hooks/use-ai-images";
import { ReplaceImageButton } from "./replace-image-button";

interface HeroTile {
  id: string;
  title: string;
  translations: { ta?: { title?: string } } | null;
  imageUrl: string | null;
  subcategoryIds: string[];
  sortOrder: number;
}

interface HomeHeroRecord {
  id: string;
  heroTitle: string | null;
  heroImageUrl: string | null;
  heroTheme: { background: string; title: string; dark: boolean; ornamentDepth: number } | null;
  translations: { ta?: { heroTitle?: string } } | null;
  tiles: HeroTile[];
}

interface TreeDepartment {
  categories: { name: string; subcategories: { id: string; name: string }[] }[];
}

interface SubcategoryGroup {
  label: string;
  options: { value: string; label: string }[];
}

const PREVIEW_WIDTH = 300;
const PREVIEW_HEIGHT = PREVIEW_WIDTH * 1.5;
const TILE_THUMB = 44;

function buildSubcategoryGroups(departments: TreeDepartment[]): SubcategoryGroup[] {
  return departments
    .flatMap((d) => d.categories)
    .map((c) => ({ label: c.name, options: c.subcategories.map((s) => ({ value: s.id, label: s.name })) }))
    .filter((g) => g.options.length > 0);
}

function useSubcategoryGroups() {
  const { message } = App.useApp();
  const [groups, setGroups] = useState<SubcategoryGroup[]>([]);
  useEffect(() => {
    axiosInstance.get("/categories/tree")
      .then((res) => setGroups(buildSubcategoryGroups(res.data.data)))
      .catch(() => message.error("Couldn't load subcategories; tile aisles can't be edited until the page is reloaded"));
  }, [message]);
  return groups;
}

// Mirrors the app: headline tucked under the measured ornament, tiles as gradients of the festival's wash
function HeroPreview({ record }: { record: HomeHeroRecord }) {
  const theme = record.heroTheme;
  const wash = theme?.background ?? "#f8fafc";
  return (
    <div
      style={{
        width: PREVIEW_WIDTH,
        height: PREVIEW_HEIGHT,
        flexShrink: 0,
        borderRadius: 16,
        overflow: "hidden",
        paddingTop: Math.max(8, (theme?.ornamentDepth ?? 0.25) * PREVIEW_HEIGHT),
        background: `${wash} url(${record.heroImageUrl}) top / cover no-repeat`,
      }}
    >
      <div
        style={{
          textAlign: "center", padding: "0 16px 8px", color: theme?.title, fontVariant: "small-caps",
          fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 20, fontWeight: 700, lineHeight: 1.2,
        }}
      >
        {record.heroTitle}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, padding: "0 10px" }}>
        {record.tiles.map((tile) => (
          <div
            key={tile.id}
            style={{
              borderRadius: 10, padding: 6, textAlign: "center",
              border: `1px solid color-mix(in srgb, ${wash}, black 16%)`,
              background: `linear-gradient(color-mix(in srgb, ${wash}, white 70%), ${wash}, color-mix(in srgb, ${wash}, black 10%))`,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: "#0f172a", lineHeight: 1.2 }}>{tile.title}</div>
            {tile.imageUrl && (
              <img src={tile.imageUrl} alt={tile.title} style={{ width: "100%", aspectRatio: "1", objectFit: "contain" }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function useAction(onDone: () => void, ai: ReturnType<typeof useAiImages>) {
  const { message } = App.useApp();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, call: () => Promise<unknown>, success: string, failure: string) => {
    setBusy(key);
    try {
      await call();
      message.success(success);
      onDone();
      void ai.refresh();
    } catch (err) {
      if (ai.handleExhausted(err)) return;
      if (!isAxiosError(err)) throw err;
      message.error(err.response?.data?.message ?? failure);
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}

function TitleEditor({ record, run, busy }: { record: HomeHeroRecord; run: ReturnType<typeof useAction>["run"]; busy: string | null }) {
  const [title, setTitle] = useState(record.heroTitle ?? "");
  const [titleTa, setTitleTa] = useState(record.translations?.ta?.heroTitle ?? "");

  const save = () =>
    run(
      "title",
      () => axiosInstance.put(`/collections/${record.id}/hero`, { heroTitle: title.trim(), heroTitleTa: titleTa.trim() || null }),
      "Hero title saved",
      "Could not save hero title",
    );

  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Input addonBefore="English" value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} />
      <Input addonBefore="Tamil" value={titleTa} maxLength={40} onChange={(e) => setTitleTa(e.target.value)} />
      <Button icon={<SaveOutlined />} loading={busy === "title"} disabled={!title.trim()} onClick={save}>
        Save title
      </Button>
    </Space>
  );
}

function TileRow({ collectionId, tile, groups, run, busy, onChanged }: {
  collectionId: string;
  tile: HeroTile;
  groups: SubcategoryGroup[];
  run: ReturnType<typeof useAction>["run"];
  busy: string | null;
  onChanged: () => void;
}) {
  const [title, setTitle] = useState(tile.title);
  const [titleTa, setTitleTa] = useState(tile.translations?.ta?.title ?? "");
  const [subcategoryIds, setSubcategoryIds] = useState(tile.subcategoryIds);

  const save = () =>
    run(
      tile.id,
      () =>
        axiosInstance.put(`/collections/${collectionId}/tiles/${tile.id}`, {
          title: title.trim(),
          titleTa: titleTa.trim() || null,
          subcategoryIds,
        }),
      `Saved "${title.trim()}"`,
      "Could not save tile",
    );

  return (
    <Space align="start" wrap style={{ width: "100%" }}>
      {tile.imageUrl && <img src={tile.imageUrl} alt="" style={{ width: TILE_THUMB, height: TILE_THUMB, objectFit: "contain" }} />}
      <ReplaceImageButton
        path={`/collections/${collectionId}/tiles/${tile.id}/image`}
        hint="A PNG or WebP with a transparent background works best; empty margins are trimmed automatically."
        onReplaced={onChanged}
      />
      <Input style={{ width: 150 }} placeholder="Title" value={title} maxLength={30} onChange={(e) => setTitle(e.target.value)} />
      <Input style={{ width: 150 }} placeholder="Tamil title" value={titleTa} maxLength={30} onChange={(e) => setTitleTa(e.target.value)} />
      <Select
        mode="multiple"
        style={{ width: 320 }}
        placeholder="Subcategories (max 4)"
        maxCount={4}
        options={groups}
        optionFilterProp="label"
        value={subcategoryIds}
        onChange={setSubcategoryIds}
      />
      <Button
        icon={<SaveOutlined />}
        loading={busy === tile.id}
        disabled={!title.trim() || subcategoryIds.length === 0}
        onClick={save}
      >
        Save
      </Button>
    </Space>
  );
}

const HERO_USAGE_NOTE = "unused tiles are given back";

function HeroActions({ busy, ai, onRegenerate, onRemove }: { busy: string | null; ai: ReturnType<typeof useAiImages>; onRegenerate: () => void; onRemove: () => void }) {
  return (
    <Space>
      <AiImageUsage usage={ai.usage} cost={AI_IMAGE_COST.FESTIVE_HERO} upTo note={HERO_USAGE_NOTE} onBuy={ai.openBuy} />
      <Popconfirm title="Repaints the background and all tiles; edits are lost" onConfirm={onRegenerate}>
        <Button size="small" icon={<ReloadOutlined />} loading={busy === "regenerate"} disabled={!canAfford(ai.usage, AI_IMAGE_COST.FESTIVE_HERO)}>Regenerate</Button>
      </Popconfirm>
      <Popconfirm title="Remove the hero? Home falls back to the banner carousel" onConfirm={onRemove}>
        <Button size="small" danger icon={<DeleteOutlined />} loading={busy === "remove"}>Remove hero</Button>
      </Popconfirm>
    </Space>
  );
}

export const HomeHeroCard = ({ record, onChanged }: { record: HomeHeroRecord; onChanged: () => void }) => {
  const ai = useAiImages();
  const { busy, run } = useAction(onChanged, ai);
  const groups = useSubcategoryGroups();
  const hasHero = !!record.heroImageUrl;

  const regenerate = () =>
    run(
      "regenerate",
      () => axiosInstance.post(`/collections/${record.id}/regenerate-hero`, undefined, { timeout: 240000 }),
      "Hero generated",
      "Hero generation failed",
    );
  const remove = () =>
    run("remove", () => axiosInstance.delete(`/collections/${record.id}/hero`), "Hero removed", "Could not remove hero");

  if (!hasHero) {
    return (
      <Card title={sectionTitle(<HomeOutlined />, "Home Hero")} size="small" style={{ marginTop: 16 }}>
        <Typography.Paragraph type="secondary">
          A live festival's hero replaces the home banner carousel. Generating paints the background and tiles; takes 1–2 minutes.
        </Typography.Paragraph>
        <Space wrap>
          <Button type="primary" icon={<ReloadOutlined />} loading={busy === "regenerate"} disabled={!canAfford(ai.usage, AI_IMAGE_COST.FESTIVE_HERO)} onClick={regenerate}>
            Generate hero
          </Button>
          <AiImageUsage usage={ai.usage} cost={AI_IMAGE_COST.FESTIVE_HERO} upTo note={HERO_USAGE_NOTE} onBuy={ai.openBuy} />
        </Space>
        {ai.buyModal}
      </Card>
    );
  }

  return (
    <Card title={sectionTitle(<HomeOutlined />, "Home Hero")} size="small" extra={<HeroActions busy={busy} ai={ai} onRegenerate={regenerate} onRemove={remove} />} style={{ marginTop: 16 }}>
      <Space size={24} align="start" wrap>
        <Space direction="vertical" size={8}>
          <HeroPreview record={record} />
          <ReplaceImageButton
            path={`/collections/${record.id}/hero/image`}
            hint="A tall 2:3 image with decoration at the top and a plain colour below. The headline position, fade colour and headline contrast are re-measured from it."
            onReplaced={onChanged}
          />
        </Space>
        <Space direction="vertical" size={16} style={{ minWidth: 320 }}>
          <TitleEditor key={`${record.heroTitle}|${record.translations?.ta?.heroTitle}`} record={record} run={run} busy={busy} />
          <Typography.Text strong>Tiles</Typography.Text>
          {record.tiles.map((tile) => (
            <TileRow key={tile.id} collectionId={record.id} tile={tile} groups={groups} run={run} busy={busy} onChanged={onChanged} />
          ))}
        </Space>
      </Space>
      {ai.buyModal}
    </Card>
  );
};
