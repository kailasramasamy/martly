import { useEffect, useState } from "react";
import { Button, ColorPicker, Form, Input, Select, Space, Switch, Typography } from "antd";
import type { SelectProps } from "antd";
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import {
  DAY_PARTS, FIXED_HERO_CARD_KINDS, HERO_CARD_KINDS, HERO_CARD_PALETTES, HeroCardKindLabels, HeroCardPaletteLabels, THEME_BAND_MAX_TILES,
  THEME_BAND_MIN_TILES, type HeroCardKind, type HeroCardPalette,
} from "@martly/shared/constants";
import { useSelect } from "@refinedev/antd";
import { axiosInstance } from "../../providers/data-provider";
import { ImageUpload } from "../../components/ImageUpload";

const { Text } = Typography;

export const MIN_TILES = 2;
export const MAX_TILES = 12;

const urlField = { getValueFromEvent: (url: string) => url };

interface SubcategoryOption {
  value: string;
  label: string;
}

interface DepartmentNode {
  categories: { subcategories: { id: string; name: string }[] }[];
}

const useSubcategories = () => {
  const [options, setOptions] = useState<SubcategoryOption[]>([]);
  useEffect(() => {
    axiosInstance.get("/categories/tree").then((res) => {
      const departments = res.data.data as DepartmentNode[];
      setOptions(departments.flatMap((d) => d.categories.flatMap((c) => c.subcategories.map((s) => ({ value: s.id, label: s.name })))));
    });
  }, []);
  return options;
};

interface TileGridProps {
  collectionProps: SelectProps;
  wideHint: string;
}

/** Tiles of an Explore or Shop-by-store grid; each opens a collection, optionally narrowed to aisles */
export const TileGridFields = ({ collectionProps, wideHint }: TileGridProps) => {
  const subcategories = useSubcategories();
  return (
    <Form.List name="items">
      {(fields, { add, remove }) => (
        <Form.Item label="Tiles" extra={`${MIN_TILES} to ${MAX_TILES} tiles. Leave the image empty and use Generate art on the list.`}>
          {fields.map(({ key, name }) => (
            <div key={key} style={{ marginBottom: 16 }}>
              <Space align="start" wrap>
                <Form.Item name={[name, "label"]} rules={[{ required: true, message: "Label" }]} style={{ marginBottom: 0 }}>
                  <Input placeholder="Label" maxLength={40} style={{ width: 130 }} />
                </Form.Item>
                <Form.Item name={[name, "collectionId"]} rules={[{ required: true, message: "Pick a collection" }]} style={{ marginBottom: 0 }}>
                  <Select {...collectionProps} showSearch optionFilterProp="label" placeholder="Collection" style={{ width: 190 }} />
                </Form.Item>
                <Button icon={<DeleteOutlined />} danger disabled={fields.length <= MIN_TILES} onClick={() => remove(name)} />
              </Space>
              <Form.Item name={[name, "subcategoryIds"]} style={{ marginBottom: 4, marginTop: 4 }}>
                <Select mode="multiple" allowClear optionFilterProp="label" placeholder="All aisles of the collection" options={subcategories} />
              </Form.Item>
              <Space style={{ marginBottom: 4 }}>
                <Form.Item name={[name, "wide"]} valuePropName="checked" style={{ marginBottom: 0 }}>
                  <Switch size="small" />
                </Form.Item>
                <Text type="secondary">Wide tile ({wideHint})</Text>
              </Space>
              <Form.Item name={[name, "imageUrl"]} {...urlField} style={{ marginBottom: 0 }}>
                <ImageUpload />
              </Form.Item>
            </div>
          ))}
          <Button icon={<PlusOutlined />} disabled={fields.length >= MAX_TILES} onClick={() => add({ subcategoryIds: [], wide: false })}>Add tile</Button>
        </Form.Item>
      )}
    </Form.List>
  );
};

const colorField = { getValueFromEvent: (c: { toHexString: () => string }) => c.toHexString() };
// A band tile opens one aisle, stored as the item's one-entry subcategoryIds
const oneAisle = { getValueProps: (ids?: string[]) => ({ value: ids?.[0] }), normalize: (id?: string) => (id ? [id] : []) };

/** A theme band: its tint and art, then a row of tiles that each open one aisle */
export const ThemeBandFields = () => {
  const subcategories = useSubcategories();
  return (
    <>
      <Form.Item label="Band colour" name={["config", "tint"]} rules={[{ required: true, message: "Pick a soft colour" }]} {...colorField}>
        <ColorPicker showText disabledAlpha />
      </Form.Item>
      <Form.Item label="Art" name={["config", "imageUrl"]} extra="A cut-out picture for the band's right side" {...urlField}>
        <ImageUpload />
      </Form.Item>
      <Form.List name="items">
        {(fields, { add, remove }) => (
          <Form.Item label="Tiles" extra={`${THEME_BAND_MIN_TILES} to ${THEME_BAND_MAX_TILES} aisles. Leave the image empty to use the aisle's own picture.`}>
            {fields.map(({ key, name }) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <Space align="start" wrap>
                  <Form.Item name={[name, "subcategoryIds"]} rules={[{ required: true, message: "Pick an aisle" }]} style={{ marginBottom: 0 }} {...oneAisle}>
                    <Select showSearch optionFilterProp="label" placeholder="Aisle" options={subcategories} style={{ width: 190 }} />
                  </Form.Item>
                  <Form.Item name={[name, "label"]} rules={[{ required: true, message: "Label" }]} style={{ marginBottom: 0 }}>
                    <Input placeholder="Label" maxLength={40} style={{ width: 130 }} />
                  </Form.Item>
                  <Button icon={<DeleteOutlined />} danger disabled={fields.length <= THEME_BAND_MIN_TILES} onClick={() => remove(name)} />
                </Space>
                <Form.Item name={[name, "imageUrl"]} {...urlField} style={{ marginBottom: 0, marginTop: 4 }}>
                  <ImageUpload />
                </Form.Item>
              </div>
            ))}
            <Button icon={<PlusOutlined />} disabled={fields.length >= THEME_BAND_MAX_TILES} onClick={() => add({ label: "", subcategoryIds: [], wide: false })}>Add tile</Button>
          </Form.Item>
        )}
      </Form.List>
    </>
  );
};

const DAY_PART_LABELS = { morning: "Morning (6am–12)", afternoon: "Afternoon (12–5pm)", evening: "Evening (5–9pm)", night: "Night (9pm–6am)" };

const PALETTE_OPTIONS = (Object.keys(HERO_CARD_PALETTES) as HeroCardPalette[]).map((p) => ({
  value: p,
  label: (
    <Space size={6}>
      <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 6, background: HERO_CARD_PALETTES[p].card, border: `2px solid ${HERO_CARD_PALETTES[p].ink}` }} />
      {HeroCardPaletteLabels[p]}
    </Space>
  ),
}));

// One carousel card: its kind, and for a collection card which collection and in what colours
// Shown under a Store special row: a particular special, or the store's latest
function StoreSpecialPicker({ name, specialProps }: { name: number; specialProps: SelectProps }) {
  return (
    <Form.Item name={[name, "collectionId"]} style={{ marginBottom: 0, marginTop: 8 }}>
      <Select {...specialProps} allowClear showSearch optionFilterProp="label" placeholder="Latest store special" />
    </Form.Item>
  );
}

function HeroCardRow({ name, index, count, used, collectionProps, specialProps, move, remove }: {
  name: number; index: number; count: number; used: Set<HeroCardKind>; collectionProps: SelectProps; specialProps: SelectProps;
  move: (from: number, to: number) => void; remove: (index: number) => void;
}) {
  const kind = Form.useWatch(["config", "cards", name, "kind"]) as HeroCardKind | undefined;
  const kinds = HERO_CARD_KINDS.map((k) => ({ value: k, label: HeroCardKindLabels[k], disabled: !REPEATABLE.has(k) && k !== kind && used.has(k) }));
  const isCollection = kind === "COLLECTION";
  return (
    <div style={isCollection || kind === "STORE_SPECIAL" ? { border: "1px solid #e2e8f0", borderRadius: 8, padding: 8, marginBottom: 8 } : { marginBottom: 8 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <Form.Item name={[name, "kind"]} rules={[{ required: true, message: "Pick a card" }]} style={{ marginBottom: 0, flex: 1, minWidth: 0 }}>
          <Select options={kinds} />
        </Form.Item>
        <Button icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => move(index, index - 1)} />
        <Button icon={<ArrowDownOutlined />} disabled={index === count - 1} onClick={() => move(index, index + 1)} />
        <Button icon={<DeleteOutlined />} danger disabled={count <= 1} onClick={() => remove(name)} />
      </div>
      {isCollection && (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <Form.Item name={[name, "collectionId"]} rules={[{ required: true, message: "Pick a collection" }]} style={{ marginBottom: 0, flex: 1, minWidth: 0 }}>
            <Select {...collectionProps} showSearch optionFilterProp="label" placeholder="Collection" />
          </Form.Item>
          <Form.Item name={[name, "palette"]} initialValue="MINT" style={{ marginBottom: 0, width: 130 }}>
            <Select options={PALETTE_OPTIONS} />
          </Form.Item>
        </div>
      )}
      {kind === "STORE_SPECIAL" && <StoreSpecialPicker name={name} specialProps={specialProps} />}
    </div>
  );
}

// Cards that can be added more than once, each pointing at a different collection
const REPEATABLE = new Set<HeroCardKind>(["COLLECTION", "STORE_SPECIAL"]);

const CARDS_HINT = "Shown top to bottom as the carousel's order. Store special shows the latest one unless you pick one, and can be added "
  + "once per special. Cards a store has nothing for are left out: no live festival, too few offers, a special it doesn't stock, or a "
  + "collection that is inactive, out of its dates or has fewer than 3 products in stock. The carousel hides itself with fewer than two.";

function HeroCardList({ collectionProps }: { collectionProps: SelectProps }) {
  const cards = (Form.useWatch(["config", "cards"]) ?? []) as { kind?: HeroCardKind }[];
  const { selectProps: specialProps } = useSelect({
    resource: "collections", optionLabel: "title", optionValue: "id", pagination: { pageSize: 100 },
    filters: [{ field: "kind", operator: "eq", value: "STORE_SPECIAL" }],
  });
  const used = new Set(cards.map((c) => c?.kind).filter((k): k is HeroCardKind => !!k));
  return (
    <Form.List name={["config", "cards"]} initialValue={FIXED_HERO_CARD_KINDS.map((kind) => ({ kind }))}>
      {(fields, { add, remove, move }) => (
        <Form.Item label="Cards" extra={<Text type="secondary">{CARDS_HINT}</Text>}>
          {fields.map(({ key, name }, index) => (
            <HeroCardRow key={key} name={name} index={index} count={fields.length} used={used} collectionProps={collectionProps} specialProps={specialProps} move={move} remove={remove} />
          ))}
          <Button icon={<PlusOutlined />} onClick={() => add({ kind: "COLLECTION", palette: "MINT" })}>Add card</Button>
        </Form.Item>
      )}
    </Form.List>
  );
}

/** The carousel's cards in order, and the collection "Right now" shows in each part of the day */
export const HeroCardsFields = ({ collectionProps }: { collectionProps: SelectProps }) => (
  <>
  <HeroCardList collectionProps={collectionProps} />
  <Form.Item label="Right now" extra={<Text type="secondary">The collection the "Right now" card shows in each part of the day (IST). A part left empty shows no card then.</Text>}>
    {DAY_PARTS.map((part) => (
      <Form.Item key={part} label={DAY_PART_LABELS[part]} name={["config", "rightNow", part]} style={{ marginBottom: 8 }}>
        <Select {...collectionProps} allowClear showSearch optionFilterProp="label" placeholder="No card" />
      </Form.Item>
    ))}
  </Form.Item>
  </>
);
