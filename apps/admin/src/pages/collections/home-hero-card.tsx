import { useEffect, useState } from "react";
import { App, Button, Card, Input, Popconfirm, Select, Space, Typography } from "antd";
import { DeleteOutlined, HomeOutlined, ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import { isAxiosError } from "axios";
import { axiosInstance } from "../../providers/data-provider";
import { sectionTitle } from "../../theme";
import { festivalCardTheme, type HeroCardTheme } from "@martly/shared/constants";
import { isAiImagesExhausted } from "../../components/ai-images/exhausted";
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
  heroKicker: string | null;
  heroImageUrl: string | null;
  heroTheme: { background: string; title: string; dark: boolean } | null;
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

// The preview is drawn at the app's own size (a 393pt-wide phone) and scaled down to fit the card
const PHONE_WIDTH = 393;
const PREVIEW_SCALE = 300 / PHONE_WIDTH;
const PHONE_HEIGHT = 600;
const CARD_WIDTH = Math.round(PHONE_WIDTH * 0.73);
const CARD_HEIGHT = 380;
const CARD_PADDING = 14;
const FESTIVAL_TILES = 6;
// The next card peeking in at the right, in the Buy X get Y card's colour
const NEXT_CARD = "#b3ddd2";
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

// The header over the wash: location line, search bar and the three list pills ringed in the card's ink
function PreviewHeader({ ink }: { ink: string }) {
  const pill = { flex: 1, height: 36, borderRadius: 18, background: "rgba(255,255,255,0.94)", border: `1px solid ${ink}40` };
  return (
    <div style={{ padding: "20px 16px 0" }}>
      <div style={{ color: ink, fontSize: 22, fontWeight: 800 }}>Delivery in 10 minutes</div>
      <div style={{ color: ink, fontSize: 14, fontWeight: 600, opacity: 0.85 }}>Your store</div>
      <div style={{ height: 46, borderRadius: 14, background: "#fff", marginTop: 14 }} />
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <div style={pill} />
        <div style={pill} />
        <div style={pill} />
      </div>
    </div>
  );
}

// The app's festive card: kicker and headline, two columns of aisle tiles, then the "See all" band
function PreviewCard({ record, theme }: { record: HomeHeroRecord; theme: HeroCardTheme }) {
  const ink = theme.cardInk;
  const tiles = record.tiles.slice(0, FESTIVAL_TILES);
  return (
    <div style={{ width: CARD_WIDTH, height: CARD_HEIGHT, flexShrink: 0, borderRadius: 22, padding: CARD_PADDING, background: theme.card, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {record.heroKicker && <div style={{ color: ink, fontSize: 11, fontWeight: 700, letterSpacing: 1, opacity: 0.8, textTransform: "uppercase" }}>{record.heroKicker}</div>}
      <div style={{ color: ink, fontSize: 20, fontWeight: 800, lineHeight: "24px", letterSpacing: -0.3, marginBottom: 10 }}>{record.heroTitle}</div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gridAutoRows: "1fr", gap: 8, marginBottom: 12, minHeight: 0 }}>
        {tiles.map((tile) => (
          <div key={tile.id} style={{ borderRadius: 14, padding: 6, background: "rgba(255,255,255,0.7)", display: "flex", flexDirection: "column", alignItems: "center", minHeight: 0 }}>
            {tile.imageUrl && <img src={tile.imageUrl} alt={tile.title} style={{ flex: 1, minHeight: 0, width: "100%", objectFit: "contain" }} />}
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "#0f172a", marginTop: 2, whiteSpace: "nowrap" }}>{tile.title}</div>
          </div>
        ))}
      </div>
      <div style={{ height: 44, margin: `0 -${CARD_PADDING}px -${CARD_PADDING}px`, background: `${ink}14`, color: ink, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
        See all ›
      </div>
    </div>
  );
}

// Mirrors the app's Home: the wash following the festival card, the header over it, and the card leading the carousel
function HeroPreview({ record }: { record: HomeHeroRecord }) {
  const theme = festivalCardTheme(record.heroTheme ?? { background: "#f8fafc", title: "#0f172a", dark: false });
  return (
    <div style={{ width: PHONE_WIDTH * PREVIEW_SCALE, height: PHONE_HEIGHT * PREVIEW_SCALE, borderRadius: 16, overflow: "hidden", border: "1px solid #e2e8f0" }}>
      <div style={{ width: PHONE_WIDTH, height: PHONE_HEIGHT, transform: `scale(${PREVIEW_SCALE})`, transformOrigin: "top left", background: `linear-gradient(${theme.tint}, ${theme.tintSoft} 45%, #fff 90%)` }}>
        <PreviewHeader ink={theme.ink} />
        <div style={{ display: "flex", gap: 12, padding: "16px 16px 0", overflow: "hidden" }}>
          <PreviewCard record={record} theme={theme} />
          <div style={{ width: CARD_WIDTH, height: CARD_HEIGHT, flexShrink: 0, borderRadius: 22, background: NEXT_CARD }} />
        </div>
      </div>
    </div>
  );
}

function useAction(onDone: () => void) {
  const { message } = App.useApp();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, call: () => Promise<unknown>, success: string, failure: string) => {
    setBusy(key);
    try {
      await call();
      message.success(success);
      onDone();
    } catch (err) {
      if (isAiImagesExhausted(err)) {
        message.warning(err.response?.data.message);
        return;
      }
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

function HeroActions({ busy, onRegenerate, onRemove }: { busy: string | null; onRegenerate: () => void; onRemove: () => void }) {
  return (
    <Space>
      <Popconfirm title="Repaints the background and all tiles; edits are lost" onConfirm={onRegenerate}>
        <Button size="small" icon={<ReloadOutlined />} loading={busy === "regenerate"}>Regenerate</Button>
      </Popconfirm>
      <Popconfirm title="Remove the hero? Home falls back to the banner carousel" onConfirm={onRemove}>
        <Button size="small" danger icon={<DeleteOutlined />} loading={busy === "remove"}>Remove hero</Button>
      </Popconfirm>
    </Space>
  );
}

export const HomeHeroCard = ({ record, onChanged }: { record: HomeHeroRecord; onChanged: () => void }) => {
  const { busy, run } = useAction(onChanged);
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
          <Button type="primary" icon={<ReloadOutlined />} loading={busy === "regenerate"} onClick={regenerate}>
            Generate hero
          </Button>
        </Space>
      </Card>
    );
  }

  return (
    <Card title={sectionTitle(<HomeOutlined />, "Home Hero")} size="small" extra={<HeroActions busy={busy} onRegenerate={regenerate} onRemove={remove} />} style={{ marginTop: 16 }}>
      <Space size={24} align="start" wrap>
        <Space direction="vertical" size={8}>
          <HeroPreview record={record} />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>Background strip (older app versions)</Typography.Text>
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
    </Card>
  );
};
