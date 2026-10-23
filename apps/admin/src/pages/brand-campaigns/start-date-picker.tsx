import { useEffect, useMemo, useState } from "react";
import { DatePicker, Form, Space, Tooltip, Typography } from "antd";
import { isAxiosError } from "axios";
import dayjs, { type Dayjs } from "dayjs";
import { BrandCampaignStatusLabels, type BrandCampaignStatus } from "@martly/shared/constants";
import { axiosInstance } from "../../providers/data-provider";
import type { AdProduct } from "../marketing/types";

interface CalendarDay {
  date: string;
  booked: number;
  /** Earliest moment that day a booking of this length can start and fit; null when it can't start that day */
  startsAt: string | null;
  campaigns: { id: string; title: string; status: BrandCampaignStatus; startsAt: string; endsAt: string; brand: { name: string } }[];
}
interface SlotCalendar { cap: number | null; days: CalendarDay[] }

const TINT = { open: "#dcfce7", later: "#fef3c7", full: "#fee2e2" } as const;
const time = (iso: string) => dayjs(iso).format("D MMM HH:mm");

// Takeovers, sponsored products and featured brands are booked per category, so their calendar waits for one
const PER_CATEGORY_KINDS = ["BRAND_TAKEOVER", "BRAND_SPONSORED_PRODUCT", "BRAND_FEATURE"];
const needsCategory = (p?: AdProduct) => !!p && PER_CATEGORY_KINDS.includes(p.kind);

function useSlotCalendar(apiBase: string, product: AdProduct | undefined, quantity: number, categoryId?: string, excludeId?: string) {
  const [calendar, setCalendar] = useState<SlotCalendar | null>(null);
  const productId = product?.id;
  const waiting = needsCategory(product) && !categoryId;
  useEffect(() => {
    setCalendar(null);
    if (!productId || waiting) return;
    let current = true;
    axiosInstance.get(`${apiBase}/calendar`, { params: { productId, quantity, categoryId, excludeId } })
      .then((res) => current && setCalendar(res.data.data))
      .catch((err) => {
        if (!isAxiosError(err)) throw err;
      });
    return () => { current = false; };
  }, [apiBase, productId, quantity, categoryId, excludeId, waiting]);
  return calendar;
}

/** Open from the day's start, opening part-way through (after an earlier booking ends), or full for this length */
function dayState(day: CalendarDay) {
  if (!day.startsAt) return "full" as const;
  return dayjs(day.startsAt).isAfter(dayjs(day.date).startOf("day")) && !dayjs(day.date).isSame(dayjs(), "day") ? "later" as const : "open" as const;
}

function DayTip({ day, cap }: { day: CalendarDay; cap: number | null }) {
  const state = dayState(day);
  return (
    <Space direction="vertical" size={2}>
      <strong>{state === "full" ? "Can't start: full for this length" : state === "later" ? `Opens at ${dayjs(day.startsAt).format("HH:mm")}` : "Can start"}</strong>
      {cap !== null && <span>{day.booked} of {cap} booked</span>}
      {day.campaigns.map((c) => (
        <span key={c.id}>{c.brand.name} · {BrandCampaignStatusLabels[c.status]} · {time(c.startsAt)} – {time(c.endsAt)}</span>
      ))}
    </Space>
  );
}

interface Props {
  value?: Dayjs;
  onChange?: (value: Dayjs) => void;
  apiBase: string;
  product?: AdProduct;
  excludeId?: string;
  disabled?: boolean;
}

/**
 * The start date with the package's slot drawn in: green days can start, amber ones open part-way through (picking one
 * starts the booking then), red ones are full for this length; hovering a day lists who holds it.
 */
export function StartDatePicker({ value, onChange, apiBase, product, excludeId, disabled }: Props) {
  const form = Form.useFormInstance();
  const quantity = Form.useWatch("quantity", form) ?? 1;
  const categoryId = Form.useWatch("categoryId", form);
  const calendar = useSlotCalendar(apiBase, product, quantity, categoryId, excludeId);
  const byDate = useMemo(() => new Map((calendar?.days ?? []).map((d) => [d.date, d])), [calendar]);
  const dayOf = (d: Dayjs) => byDate.get(d.format("YYYY-MM-DD"));

  return (
    <DatePicker
      value={value}
      disabled={disabled}
      style={{ width: "100%" }}
      disabledDate={(d) => d.isBefore(dayjs(), "day") || dayOf(d)?.startsAt === null}
      onChange={(d) => {
        if (!d) return;
        const day = dayOf(d);
        onChange?.(day?.startsAt ? dayjs(day.startsAt) : d);
      }}
      cellRender={(current, info) => {
        if (!dayjs.isDayjs(current) || info.type !== "date") return info.originNode;
        const day = dayOf(current);
        if (!day || !calendar || (value && current.isSame(value, "day"))) return info.originNode;
        return (
          <Tooltip title={<DayTip day={day} cap={calendar.cap} />}>
            <div className="ant-picker-cell-inner" style={{ background: TINT[dayState(day)] }}>{current.date()}</div>
          </Tooltip>
        );
      }}
      renderExtraFooter={() => calendar && (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          <span style={{ background: TINT.open, padding: "0 6px" }}>Can start</span>{" "}
          <span style={{ background: TINT.later, padding: "0 6px" }}>Opens part-way</span>{" "}
          <span style={{ background: TINT.full, padding: "0 6px" }}>Full</span> · hover a day to see who's booked
        </Typography.Text>
      )}
    />
  );
}
