import { useLocalSearchParams } from "expo-router";
import { CouponForm } from "../../../components/manage/marketing/CouponForm";

export default function EditCoupon() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CouponForm id={id} />;
}
