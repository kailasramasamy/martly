import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Button } from "../../ui/Button";
import { formatINR, tabular } from "../../ui/tokens";
import { colors, fonts } from "../../../../constants/theme";
import { api, ApiError } from "../../../../lib/api";
import { toQuery } from "../../../../lib/manage/query";
import type { BrandPackage, SlotAvailability } from "../types";
import { isFeature, isSponsored } from "./form-state";
import { Notice } from "./Notice";

interface Props {
  product?: BrandPackage;
  quantity: number;
  startsAt: string;
  categoryId: string | null;
  excludeId?: string;
  /** Moves the booking to the suggested start when its dates are full */
  onUseStart: (startsAt: string) => void;
}

function useAvailability({ product, quantity, startsAt, categoryId, excludeId }: Omit<Props, "onUseStart">) {
  const [slot, setSlot] = useState<SlotAvailability | null>(null);
  const productId = product?.id;
  // Sponsored products and featured brands are booked per category
  const waitsForCategory = isSponsored(product) || isFeature(product);

  useEffect(() => {
    setSlot(null);
    if (!productId || !quantity || (waitsForCategory && !categoryId)) return;
    let current = true;
    const query = toQuery({ productId, quantity, startsAt, categoryId, excludeId });
    api.get<SlotAvailability>(`/api/v1/brand-campaigns/availability${query}`)
      .then((res) => current && setSlot(res.data))
      .catch((err) => {
        if (!(err instanceof ApiError)) throw err;
      });
    return () => { current = false; };
  }, [productId, quantity, startsAt, categoryId, excludeId, waitsForCategory]);
  return slot;
}

const day = (iso: string, long = false) =>
  new Date(iso).toLocaleDateString("en-IN", { ...(long ? { weekday: "short" } : {}), day: "numeric", month: "short" });

function describe(slot: SlotAvailability): { text: string; full: boolean } {
  const until = day(slot.endsAt);
  if (slot.cap === null) return { text: `Open slots · runs until ${until}`, full: false };
  if (!slot.available) return { text: `Fully booked${slot.nextStartsAt ? ` · next opening ${day(slot.nextStartsAt, true)}` : ""}`, full: true };
  return { text: `${slot.booked} of ${slot.cap} brand slots booked · runs until ${until}`, full: false };
}

/** How full the package is for these dates, then the price with GST */
export function AvailabilityLine(props: Props) {
  const slot = useAvailability(props);
  const { product, quantity, onUseStart } = props;
  const status = slot ? describe(slot) : null;
  const next = slot?.nextStartsAt;
  return (
    <View style={styles.wrap}>
      {status ? (
        <Notice
          tone={status.full ? "error" : "info"}
          message={status.text}
          action={next ? <Button compact variant="secondary" label="Start then" onPress={() => onUseStart(next)} style={styles.then} /> : undefined}
        />
      ) : null}
      {product ? (
        <Text style={[styles.price, tabular]}>
          {formatINR(product.price * quantity)} <Text style={styles.gst}>+{product.gstPercent}% GST</Text>
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginTop: 2 },
  then: { alignSelf: "flex-start", minHeight: 44 },
  price: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  gst: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
});
