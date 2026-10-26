import { useEffect, useState } from "react";
import { Alert, Button, List, Modal, Space, Spin, Tag, Typography, message } from "antd";

import { axiosInstance } from "../../providers/data-provider";
import type { DraftAction } from "./checks-card";

interface BrandingDraft { tagline: { en: string; ta: string }; highlights: string[] }
interface PostDraft {
  kind: "NEW_IN_STORE" | "FRESH_TODAY";
  text: string;
  translations: { ta: { text: string } };
  products: { id: string; name: string; imageUrl: string | null }[];
}
interface Listing { id: string; name: string; size: string; price: number; imageUrl: string | null }
interface OfferDraft {
  buyGet: { buy: number; get: number; listings: Listing[] };
  discount: { discountType: "PERCENTAGE"; discountValue: number; listings: Listing[] };
}

const errorText = (err: any, fallback: string) => err.response?.data?.message ?? fallback;

async function applyBranding(storeId: string, draft: BrandingDraft) {
  const current = await axiosInstance.get(`/stores/${storeId}`);
  const existing = current.data.data.translations;
  await axiosInstance.put(`/stores/${storeId}`, {
    tagline: draft.tagline.en,
    highlights: draft.highlights,
    translations: { ...existing, ta: { ...existing?.ta, tagline: draft.tagline.ta } },
  });
}

const publishPost = (storeId: string, d: PostDraft) =>
  axiosInstance.post("/store-voice/posts", {
    storeId, kind: d.kind, text: d.text, productIds: d.products.map((p) => p.id), translations: d.translations, notify: false,
  });

const startOffer = (storeId: string, listings: Listing[], terms: Record<string, unknown>) =>
  axiosInstance.post("/offers", {
    kind: terms.buy != null ? "BUY_GET" : "DISCOUNT", storeId, storeProductIds: listings.map((l) => l.id), startsAt: null, endsAt: null, ...terms,
  });

const ListingList = ({ listings }: { listings: Listing[] }) => (
  <List size="small" dataSource={listings} renderItem={(l) => (
    <List.Item>{l.name} · {l.size} <Typography.Text type="secondary">₹{l.price}</Typography.Text></List.Item>
  )} />
);

function OfferBody({ draft, busy, onStart }: { draft: OfferDraft; busy: boolean; onStart: (listings: Listing[], terms: Record<string, unknown>) => void }) {
  const { buyGet, discount } = draft;
  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div>
        <Space><Typography.Text strong>Buy {buyGet.buy} get {buyGet.get}</Typography.Text><Tag>{buyGet.listings.length} products</Tag></Space>
        <ListingList listings={buyGet.listings} />
        <Button type="primary" disabled={buyGet.listings.length === 0} loading={busy} onClick={() => onStart(buyGet.listings, { buy: buyGet.buy, get: buyGet.get })}>Start Buy X get Y</Button>
      </div>
      <div>
        <Space><Typography.Text strong>{discount.discountValue}% off</Typography.Text><Tag>{discount.listings.length} products</Tag></Space>
        <ListingList listings={discount.listings} />
        <Button type="primary" disabled={discount.listings.length === 0} loading={busy} onClick={() => onStart(discount.listings, { discountType: discount.discountType, discountValue: discount.discountValue })}>Start discount</Button>
      </div>
    </Space>
  );
}

function BrandingBody({ draft, busy, onApply }: { draft: BrandingDraft; busy: boolean; onApply: () => void }) {
  return (
    <Space direction="vertical" size={8} style={{ width: "100%" }}>
      <Typography.Text strong>Tagline</Typography.Text>
      <Typography.Text>{draft.tagline.en}</Typography.Text>
      <Typography.Text type="secondary">{draft.tagline.ta}</Typography.Text>
      <Typography.Text strong>Highlights</Typography.Text>
      <Space wrap>{draft.highlights.map((h) => <Tag key={h}>{h}</Tag>)}</Space>
      <Button type="primary" loading={busy} onClick={onApply}>Apply</Button>
    </Space>
  );
}

function PostBody({ draft, busy, onPublish }: { draft: PostDraft; busy: boolean; onPublish: () => void }) {
  return (
    <Space direction="vertical" size={8} style={{ width: "100%" }}>
      <Tag>{draft.kind === "FRESH_TODAY" ? "Fresh today" : "New in store"}</Tag>
      <Typography.Text>{draft.text}</Typography.Text>
      <Typography.Text type="secondary">{draft.translations.ta.text}</Typography.Text>
      <Typography.Text type="secondary">{draft.products.map((p) => p.name).join(", ")}</Typography.Text>
      <Button type="primary" loading={busy} onClick={onPublish}>Publish</Button>
    </Space>
  );
}

const ENDPOINT = { BRANDING: "branding", POST: "post", OFFER_PICKS: "offer-picks" } as const;
const TITLE = { BRANDING: "Branding draft", POST: "Post draft", OFFER_PICKS: "Offer picks" } as const;

interface Props { storeId: string; action: DraftAction | null; onClose: () => void; onDone: () => void }

/** Asks the AI for a draft, shows it, and applies it through the normal endpoints only when the owner says so */
export function AiDraftModal({ storeId, action, onClose, onDone }: Props) {
  const [draft, setDraft] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(null);
    setError(null);
    if (!action) return;
    axiosInstance.post(`/storefront/ai/${ENDPOINT[action]}`, { storeId })
      .then((res) => setDraft(res.data.data))
      .catch((err) => setError(errorText(err, "The AI couldn't draft this right now")));
  }, [action, storeId]);

  const run = async (job: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await job();
      message.success(done);
      onDone();
      onClose();
    } catch (err: any) {
      message.error(errorText(err, "Couldn't save"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!action} title={action ? TITLE[action] : ""} onCancel={onClose} footer={null} destroyOnClose>
      {error && <Alert type="warning" message={error} showIcon />}
      {!draft && !error && <Spin style={{ display: "block", margin: "24px auto" }} />}
      {!!draft && action === "BRANDING" && <BrandingBody draft={draft as BrandingDraft} busy={busy} onApply={() => run(() => applyBranding(storeId, draft as BrandingDraft), "Branding updated")} />}
      {!!draft && action === "POST" && <PostBody draft={draft as PostDraft} busy={busy} onPublish={() => run(() => publishPost(storeId, draft as PostDraft), "Post published")} />}
      {!!draft && action === "OFFER_PICKS" && <OfferBody draft={draft as OfferDraft} busy={busy} onStart={(listings, terms) => run(() => startOffer(storeId, listings, terms), "Offer started")} />}
    </Modal>
  );
}
