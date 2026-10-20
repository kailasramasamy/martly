import { useState } from "react";
import { Alert, App, Button } from "antd";
import { RocketOutlined } from "@ant-design/icons";
import { axiosInstance } from "../../providers/data-provider";
import { errorMessage } from "../marketing/utils";

interface Props {
  productId: string;
  canLaunch: boolean;
  onLaunched: () => void;
}

/** Shown on a product saved for review: shoppers can't see it until it's launched */
export function DraftBanner({ productId, canLaunch, onLaunched }: Props) {
  const { notification } = App.useApp();
  const [launching, setLaunching] = useState(false);

  const launch = async () => {
    setLaunching(true);
    try {
      await axiosInstance.post(`/products/${productId}/launch`);
      notification.success({ message: "Product is live" });
      onLaunched();
    } catch (err) {
      notification.error({ message: errorMessage(err, "Could not launch the product") });
    } finally {
      setLaunching(false);
    }
  };

  return (
    <Alert
      type="warning"
      showIcon
      style={{ marginBottom: 16 }}
      message="Draft"
      description="Shoppers can't see this product yet. Check the details and the Tamil translation, then launch it."
      action={canLaunch ? <Button type="primary" icon={<RocketOutlined />} loading={launching} onClick={launch}>Launch product</Button> : undefined}
    />
  );
}
