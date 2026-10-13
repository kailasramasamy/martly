import dayjs, { type Dayjs } from "dayjs";

type ScheduleRange = [Dayjs | null, Dayjs | null] | null | undefined;

export const toSchedulePayload = ({ schedule, ...values }: { schedule?: ScheduleRange } & Record<string, unknown>) => ({
  ...values,
  startsAt: schedule?.[0]?.toISOString() ?? null,
  endsAt: schedule?.[1]?.toISOString() ?? null,
});

export const toScheduleValue = (record?: { startsAt?: string | null; endsAt?: string | null }) =>
  record?.startsAt || record?.endsAt
    ? [record.startsAt ? dayjs(record.startsAt) : null, record.endsAt ? dayjs(record.endsAt) : null]
    : undefined;
