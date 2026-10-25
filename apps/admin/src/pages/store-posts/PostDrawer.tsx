import { useEffect, useMemo, useState } from "react";
import { App, Button, Drawer, Input, Segmented, Select, Space, Spin, Switch, Typography } from "antd";
import { isAxiosError } from "axios";
import { describeAudience } from "@martly/shared/store-voice";
import type { VoiceTranslations } from "@martly/shared/types";
import { axiosInstance } from "../../providers/data-provider";
import {
  KIND_DAYS, KINDS, LANGUAGE_NAMES, errorMessage, otherOf, storeVoice, translatePreview, useAudience,
  type EditablePost, type PostKind, type TaggedProduct,
} from "./api";

const { Text } = Typography;
const MAX_PRODUCTS = 6;
// Typing pauses this long before the words are translated
const SETTLE_MS = 1200;
type Days = "keep" | 0 | 3 | 7;

// The store's active listings matching the search, one option per product
function useProductSearch(storeId: string) {
  const [options, setOptions] = useState<TaggedProduct[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      axiosInstance.get<{ data: { isActive: boolean; product: TaggedProduct }[] }>("/store-products", { params: { storeId, q, pageSize: 30 } })
        .then((r) => {
          if (!live) return;
          const products = r.data.data.filter((sp) => sp.isActive).map((sp) => sp.product);
          setOptions(products.filter((p, i) => products.findIndex((o) => o.id === p.id) === i));
        })
        .catch((err: unknown) => { if (!isAxiosError(err)) throw err; });
    }, 300);
    return () => { live = false; clearTimeout(timer); };
  }, [storeId, q]);
  return { options, search: setQ };
}

// The other language, made once the words settle and the owner's to correct; their edit is never replaced
function useTranslation(text: string, saved: VoiceTranslations | null | undefined) {
  const src = text.trim();
  const other = otherOf(src);
  const [state, setState] = useState({ forText: src, text: saved?.[other]?.text ?? "", edited: false, loading: false });
  useEffect(() => {
    if (!src || state.edited || src === state.forText) return;
    const timer = setTimeout(() => {
      setState((s) => ({ ...s, loading: true }));
      translatePreview(src)
        .then((res) => setState({ forText: src, text: res?.translations[otherOf(src)]?.text ?? "", edited: false, loading: false }))
        .catch((err: unknown) => {
          if (!isAxiosError(err)) throw err;
          setState((s) => ({ ...s, forText: src, loading: false }));
        });
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [src, state.edited, state.forText]);
  const edit = (t: string) => setState((s) => ({ ...s, text: t, edited: true }));
  const again = () => setState((s) => ({ ...s, edited: false, forText: "" }));
  const translations = src && state.text.trim() ? { [other]: { text: state.text.trim() } } : undefined;
  return { ...state, other, edit, again, stale: state.edited && src !== state.forText, translations };
}

interface Props {
  open: boolean;
  storeId: string;
  /** Set when editing; a new post otherwise */
  editing: EditablePost | null;
  onClose: (saved: boolean) => void;
}

// The post being written or edited, and saving it. An edit keeps its end date and doesn't notify unless asked
function usePostDraft(storeId: string, editing: EditablePost | null, onSaved: () => void) {
  const { message } = App.useApp();
  const [kind, setKind] = useState<PostKind>(editing?.kind ?? "FRESH_TODAY");
  const [text, setText] = useState(editing?.text ?? "");
  const [products, setProducts] = useState<TaggedProduct[]>(editing?.products ?? []);
  const [days, setDays] = useState<Days>(editing ? "keep" : KIND_DAYS.FRESH_TODAY);
  const [notify, setNotify] = useState(!editing);
  const [saving, setSaving] = useState(false);
  const translation = useTranslation(text, editing?.translations);
  const pickKind = (k: PostKind) => { setKind(k); if (!editing) setDays(KIND_DAYS[k]); };
  const save = async () => {
    setSaving(true);
    const body = {
      kind, text: text.trim(), productIds: products.map((p) => p.id), notify, translations: translation.translations,
      ...(days === "keep" ? {} : { days }),
    };
    try {
      const res = editing ? await storeVoice.update(editing.id, body) : await storeVoice.create({ ...body, storeId });
      const done = editing ? "Saved" : "Posted";
      message.success(!notify ? done : res.notified ? `${done}, shoppers notified` : `${done}. Today's notification already went out`);
      onSaved();
    } catch (err) {
      if (!isAxiosError(err)) throw err;
      message.error(errorMessage(err, "Couldn't save the post"));
    } finally {
      setSaving(false);
    }
  };
  return { kind, pickKind, text, setText, products, setProducts, days, setDays, notify, setNotify, saving, save, translation };
}

/** Write or edit the owner's post to shoppers: kind, words (with the other language), products, how long, and notify */
export function PostDrawer({ open, storeId, editing, onClose }: Props) {
  const { kind, pickKind, text, setText, products, setProducts, days, setDays, notify, setNotify, saving, save, translation } =
    usePostDraft(storeId, editing, () => onClose(true));
  const search = useProductSearch(storeId);
  const audience = useAudience(storeId, kind, products.map((p) => p.id));
  const known = useMemo(() => [...products, ...search.options.filter((o) => !products.some((p) => p.id === o.id))], [products, search.options]);

  const dayOptions = [
    ...(editing ? [{ value: "keep" as const, label: `Ends ${new Date(editing.expiresAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}` }] : []),
    { value: 0 as const, label: "Today only" }, { value: 3 as const, label: "3 days" }, { value: 7 as const, label: "7 days" },
  ];
  const language = LANGUAGE_NAMES[translation.other];
  return (
    <Drawer
      open={open} width={560} title={editing ? "Edit post" : "Post to shoppers"} onClose={() => onClose(false)} destroyOnClose
      extra={<Button type="primary" loading={saving} disabled={!text.trim() || translation.loading} onClick={save}>{editing ? "Save" : "Post"}</Button>}
    >
      <Space direction="vertical" size={20} style={{ width: "100%" }}>
        <Field label="What's it about">
          <Segmented block value={kind} onChange={(v) => pickKind(v as PostKind)} options={KINDS.map((k) => ({ value: k.value, label: k.label }))} />
        </Field>
        <Field label="Say it like you would at the counter" hint="Tamil or English. The other language is written below.">
          <Input.TextArea value={text} onChange={(e) => setText(e.target.value)} maxLength={400} showCount autoSize={{ minRows: 3, maxRows: 8 }} placeholder="Ooty carrots came in this morning…" />
        </Field>
        {text.trim() && (
          <Field label={<Space>{`Shoppers reading in ${language} see`}{translation.loading && <Spin size="small" />}</Space>} hint="Fix anything that doesn't sound right. Shoppers see exactly this.">
            <Input.TextArea value={translation.text} onChange={(e) => translation.edit(e.target.value)} maxLength={600} autoSize={{ minRows: 2, maxRows: 8 }} placeholder={translation.loading ? "Translating…" : `Write it in ${language}`} />
            {translation.stale && <Button type="link" style={{ padding: 0 }} onClick={translation.again}>{`You changed the post. Translate again into ${language}`}</Button>}
          </Field>
        )}
        <Field label={`Products in the post · ${products.length} of ${MAX_PRODUCTS}`}>
          <Select
            mode="multiple" style={{ width: "100%" }} placeholder="Search the store's products" showSearch filterOption={false} maxCount={MAX_PRODUCTS}
            onSearch={search.search} value={products.map((p) => p.id)}
            onChange={(ids: string[]) => setProducts(ids.map((id) => known.find((p) => p.id === id)!).filter(Boolean))}
            options={known.map((p) => ({ value: p.id, label: p.name }))}
          />
        </Field>
        <Field label="Who sees it">
          <Segmented value={days} onChange={(v) => setDays(v as Days)} options={dayOptions} />
          <Space align="start" style={{ marginTop: 16 }}>
            <Switch checked={notify} onChange={setNotify} />
            <div><Text strong>Notify shoppers</Text><br /><Text type="secondary">{describeAudience(audience)}</Text></div>
          </Space>
        </Field>
      </Space>
    </Drawer>
  );
}

function Field({ label, hint, children }: { label: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Text strong style={{ display: "block", marginBottom: 6 }}>{label}</Text>
      {children}
      {hint && <Text type="secondary" style={{ display: "block", marginTop: 4, fontSize: 12 }}>{hint}</Text>}
    </div>
  );
}
