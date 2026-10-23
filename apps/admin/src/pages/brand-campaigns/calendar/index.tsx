import { useState } from "react";
import { Alert, Button, Col, Empty, Row, Spin } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { List } from "@refinedev/antd";
import { useNavigate } from "react-router";
import { PLATFORM_SCOPE, type Campaign } from "../types";
import { CalendarToolbar, Legend, type CalendarView } from "./CalendarToolbar";
import { DayPanel } from "./DayPanel";
import { MonthView } from "./MonthView";
import { TimelineView } from "./TimelineView";
import { useCalendarData } from "./use-calendar-data";

export function CampaignCalendar() {
  const navigate = useNavigate();
  const [view, setView] = useState<CalendarView>("month");
  const d = useCalendarData();
  const open = (c: Campaign) => navigate(`${PLATFORM_SCOPE.path}/show/${c.id}`);
  const book = (dayKey: string) => navigate(`${PLATFORM_SCOPE.path}/create?startDate=${dayKey}`);

  return (
    <List
      title="Campaign calendar"
      breadcrumb={false}
      canCreate={false}
      headerButtons={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate(PLATFORM_SCOPE.path)}>Campaigns</Button>}
    >
      <CalendarToolbar
        month={d.month} view={view} onView={setView} onShift={d.shift} onToday={d.goToday}
        type={d.type} typeNames={d.typeNames} onType={d.setType} showClosed={d.showClosed} onShowClosed={d.setShowClosed}
      />
      <Legend campaigns={d.campaigns} />
      {d.error ? (
        <Alert type="error" showIcon message={d.error} action={<Button size="small" onClick={d.reload}>Retry</Button>} />
      ) : d.loading ? (
        <Spin style={{ display: "block", margin: "64px auto" }} />
      ) : view === "month" ? (
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={17}>
            <MonthView month={d.month} byDay={d.byDay} selected={d.selected} onSelect={d.setSelected} onOpen={open} />
          </Col>
          <Col xs={24} xl={7}>
            <DayPanel dayKey={d.selected} campaigns={d.byDay.get(d.selected) ?? []} onOpen={open} onBook={book} />
          </Col>
        </Row>
      ) : d.campaigns.length === 0 ? (
        <Empty description="No campaigns match these filters" />
      ) : (
        <TimelineView month={d.month} campaigns={d.campaigns} onOpen={open} />
      )}
    </List>
  );
}
