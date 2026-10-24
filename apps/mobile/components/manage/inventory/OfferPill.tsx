import type { MultiBuyOffer } from "@martly/shared/offers";
import { colors } from "../../../constants/theme";
import { StatusPill } from "../ui/StatusPill";
import { manage } from "../ui/tokens";
import { offerLabel } from "./draft";

/** Teal "Buy 1 Get 1" tag for a listing whose multi-buy offer is live */
export function OfferPill({ offer }: { offer: MultiBuyOffer }) {
  return <StatusPill label={offerLabel(offer)} color={colors.primaryDark} bg={manage.tint} />;
}
