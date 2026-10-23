import { useState } from "react";
import { ManageStackScreen } from "../../ManageStackScreen";
import { campaignsByDay } from "./calendar-data";
import { CalendarToolbar, MonthNav, type CalendarView } from "./CalendarToolbar";
import { DayAgenda } from "./DayAgenda";
import { Legend } from "./Legend";
import { MonthGrid } from "./MonthGrid";
import { MonthPager } from "./MonthPager";
import { Timeline } from "./Timeline";
import { useCalendarData } from "./use-calendar-data";

/** All brand campaigns over time: a month grid with a day agenda, or a per-package timeline; swipe to change month */
export function CampaignCalendar() {
  const [view, setView] = useState<CalendarView>("month");
  const cal = useCalendarData();

  return (
    <ManageStackScreen title="Campaign calendar" loading={cal.loading} error={cal.error} onRetry={cal.reload} refreshing={cal.refreshing} onRefresh={cal.refresh}>
      <CalendarToolbar
        view={view} onView={setView}
        typeOptions={cal.typeOptions} type={cal.type} onType={cal.setType} showClosed={cal.showClosed} onShowClosed={cal.setShowClosed}
      />
      <MonthNav cursor={cal.cursor} onShift={cal.shift} onToday={cal.goToday} />
      <MonthPager
        cursor={cal.cursor}
        onShift={cal.shift}
        renderMonth={(month) => view === "month"
          ? <MonthGrid cursor={month} byDay={campaignsByDay(cal.campaigns, month)} selected={cal.selected} onSelect={cal.setSelected} />
          : <Timeline campaigns={cal.campaigns} cursor={month} />}
      />
      <Legend campaigns={cal.campaigns} />
      {view === "month" ? <DayAgenda dayKey={cal.selected} campaigns={cal.byDay.get(cal.selected) ?? []} /> : null}
    </ManageStackScreen>
  );
}
