import { Col, Row, Typography } from "antd";
import { TripCard } from "./trip-card";
import { TRIP_GROUPS, isUnstarted } from "./types";
import type { PlanRider, PlanTrip, TripHandlers } from "./types";

interface TripGroupsProps {
  trips: PlanTrip[];
  riders: PlanRider[];
  canDispatch: boolean;
  busyId: string | null;
  handlers: TripHandlers;
}

export function TripGroups({ trips, riders, canDispatch, busyId, handlers }: TripGroupsProps) {
  const unstarted = trips.filter(isUnstarted);

  return (
    <>
      {TRIP_GROUPS.map((group) => {
        const inGroup = trips.filter((t) => group.statuses.includes(t.status));
        if (inGroup.length === 0) return null;
        return (
          <div key={group.key} style={{ marginTop: 16 }}>
            <Typography.Title level={5}>{group.title} ({inGroup.length})</Typography.Title>
            <Row gutter={[12, 12]}>
              {inGroup.map((trip) => (
                <Col key={trip.id} xs={24} xl={12}>
                  <TripCard
                    trip={trip}
                    riders={riders}
                    moveTargets={unstarted.filter((t) => t.id !== trip.id)}
                    canDispatch={canDispatch}
                    busy={busyId === trip.id}
                    handlers={handlers}
                  />
                </Col>
              ))}
            </Row>
          </div>
        );
      })}
    </>
  );
}
