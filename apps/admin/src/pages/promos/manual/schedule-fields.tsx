import { DatePicker, Form, InputNumber, Radio, Switch } from "antd";
import dayjs from "dayjs";

const START_OPTIONS = [
  { value: "NOW", label: "Launch now" },
  { value: "READY", label: "Save as ready (launch later by hand)" },
  { value: "SCHEDULE", label: "Schedule" },
];

export function ScheduleFields() {
  const startMode = Form.useWatch("startMode", Form.useFormInstance());
  return (
    <>
      <Form.Item name="durationDays" label="Duration (days)" rules={[{ required: true }]}>
        <InputNumber min={1} max={90} precision={0} />
      </Form.Item>
      <Form.Item name="startMode" label="Start">
        <Radio.Group options={START_OPTIONS} />
      </Form.Item>
      {startMode === "SCHEDULE" && (
        <Form.Item
          name="launchAt"
          label="Launch at"
          rules={[{ required: true, message: "Pick when it goes live" }, { validator: (_, v) => (v && v.isBefore(dayjs()) ? Promise.reject(new Error("Pick a future time")) : Promise.resolve()) }]}
        >
          <DatePicker showTime format="D MMM YYYY, h:mm A" />
        </Form.Item>
      )}
    </>
  );
}

export function NotifyField({ pushAllowed }: { pushAllowed: boolean }) {
  return (
    <Form.Item name="notify" label="Notify customers" valuePropName="checked" extra={pushAllowed ? "One push per day at most" : "Customer notifications come with Growth and Pro"}>
      <Switch disabled={!pushAllowed} />
    </Form.Item>
  );
}
