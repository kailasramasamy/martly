import { useEffect, useState } from "react";
import { Alert, Button } from "antd";
import { isAxiosError } from "axios";
import { useNavigate } from "react-router";
import { axiosInstance } from "../../providers/data-provider";

/** Prices are only worth settling for products the store carries, so unconfirmed listings come first */
export const StockCheckBanner = ({ storeId, version }: { storeId: string | undefined; version: number }) => {
  const navigate = useNavigate();
  const [unchecked, setUnchecked] = useState(0);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    axiosInstance
      .get("/stock-check/summary", { params: { storeId } })
      .then(({ data }) => !cancelled && setUnchecked(data.data.unchecked))
      .catch((err) => {
        if (!isAxiosError(err)) throw err;
        if (!cancelled) setUnchecked(0);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId, version]);

  if (unchecked === 0) return null;
  return (
    <Alert
      type="info"
      showIcon
      style={{ marginBottom: 12 }}
      message={`Confirm what you stock first: ${unchecked.toLocaleString("en-IN")} products to confirm`}
      action={<Button size="small" type="link" onClick={() => navigate("/stock-check")}>Open stock check</Button>}
    />
  );
};
