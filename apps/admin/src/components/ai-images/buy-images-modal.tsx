import { useEffect, useState } from "react";
import { App, Modal, Spin } from "antd";
import { useCan } from "@refinedev/core";
import { axiosInstance } from "../../providers/data-provider";
import { usePurchase } from "../../pages/marketing/use-purchase";
import { errorMessage } from "../../pages/marketing/utils";
import type { AdProduct, BillingProfile } from "../../pages/marketing/types";
import { PackList } from "./pack-list";

interface BuyImagesModalProps {
  open: boolean;
  onClose: () => void;
  onPaid: () => Promise<void>;
}

function useStoreCatalogue(open: boolean) {
  const { notification } = App.useApp();
  const [packs, setPacks] = useState<AdProduct[] | null>(null);
  const [profile, setProfile] = useState<BillingProfile | null>(null);

  useEffect(() => {
    if (!open || packs) return;
    Promise.all([axiosInstance.get("/marketing/products"), axiosInstance.get("/marketing/billing-profile")])
      .then(([list, billing]) => {
        setPacks((list.data.data as AdProduct[]).filter((p) => p.kind === "AI_IMAGE_PACK"));
        setProfile(billing.data.data);
      })
      .catch((err) => notification.error({ message: errorMessage(err, "Could not load AI image packs") }));
  }, [open, packs, notification]);
  return { packs, profile, setProfile };
}

/** Lists the AI image packs for sale and buys one through the same checkout as the Marketing plan page */
export function BuyImagesModal({ open, onClose, onPaid }: BuyImagesModalProps) {
  const { packs, profile, setProfile } = useStoreCatalogue(open);
  const { data: access } = useCan({ resource: "marketing-plan", action: "create" });
  const { buying, buy, modal } = usePurchase(profile, setProfile, async () => {
    await onPaid();
    onClose();
  });
  return (
    <Modal open={open} title="Buy AI images" footer={null} onCancel={onClose}>
      {packs ? <PackList packs={packs} canBuy={!!access?.can} buying={buying} buy={buy} /> : <Spin style={{ display: "block", margin: "24px auto" }} />}
      {modal}
    </Modal>
  );
}
