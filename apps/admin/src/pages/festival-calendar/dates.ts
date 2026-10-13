import dayjs, { type Dayjs } from "dayjs";

export const toFestivalPayload = ({ dates, ...values }: { dates?: [Dayjs, Dayjs] } & Record<string, unknown>) => ({
  ...values,
  startsAt: dates?.[0].startOf("day").toISOString(),
  endsAt: dates?.[1].endOf("day").toISOString(),
});

export const toFestivalDates = (record?: { startsAt?: string; endsAt?: string }) =>
  record?.startsAt && record?.endsAt ? [dayjs(record.startsAt), dayjs(record.endsAt)] : undefined;
