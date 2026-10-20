import { useRef } from "react";
import { Text, StyleSheet } from "react-native";
import { can } from "@martly/shared/permissions";
import { BottomSheet } from "../../search/BottomSheet";
import { colors, fonts } from "../../../constants/theme";
import { useAuth } from "../../../lib/auth-context";
import { useResource } from "../../../lib/manage/use-resource";
import { useToast } from "../../../lib/toast-context";
import { ImagePackList } from "./ImagePackList";
import { PlanPayment } from "./PlanPayment";
import { imagePacks } from "./ai-images";
import { useAdCheckout } from "./use-ad-checkout";
import { useBalance } from "./use-balance";
import type { AdProduct } from "./plan-types";

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called once a pack is paid and verified, so the screen can refresh its AI-image meter */
  onBought: () => void;
}

/** Buy AI-image packs without leaving the screen that ran out; images are added as soon as the payment is verified */
export function BuyImagesSheet({ visible, onClose, onBought }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const products = useResource<AdProduct[]>(visible ? "/api/v1/marketing/products" : null);
  const bought = useRef<AdProduct | null>(null);
  const checkout = useAdCheckout(() => {
    if (bought.current) toast.show(`${bought.current.aiImageCredits} AI images added`, "success");
    onBought();
    onClose();
  });
  const balance = useBalance(visible && can(user, "marketing-plan", "create"));
  const packs = imagePacks(products.data);
  const buy = (pack: AdProduct) => {
    bought.current = pack;
    checkout.buy(pack.id, 1);
  };
  const buyFromBalance = (pack: AdProduct) => {
    bought.current = pack;
    checkout.buyFromBalance(pack.id, 1);
  };

  return (
    <>
      <BottomSheet visible={visible && !checkout.order} title="Buy AI images" onClose={onClose}>
        <Text style={styles.note}>Packs are used after your monthly AI images run out, and never expire.</Text>
        {packs.length > 0 ? <ImagePackList
          packs={packs} canBuy={can(user, "marketing-plan", "create")} onBuy={buy}
          onBuyFromBalance={buyFromBalance} coveredByBalance={(p) => balance.covers(p, 1)}
          pendingId={checkout.running ? bought.current?.id ?? null : null} locked={checkout.running}
        /> : (
          <Text style={styles.note}>{products.error ?? "Loading packs…"}</Text>
        )}
        {can(user, "marketing-plan", "create") ? null : <Text style={styles.note}>Only the owner can buy</Text>}
      </BottomSheet>
      <PlanPayment checkout={checkout} description="AI images" />
    </>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: 12 },
});
