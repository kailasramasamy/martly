import { useCallback, useEffect, useRef, useState } from "react";
import { App } from "antd";
import { notificationAudience } from "@martly/shared/constants";
import type { NotificationType } from "@martly/shared/constants";
import { axiosInstance } from "../providers/data-provider";
import { addSocketListener } from "./sharedSocket";
import { IS_NEW_ORDER, playBeep, type StaffNotification } from "../components/notifications/helpers";

const PAGE_SIZE = 20;

/** Staff bell state: inbox, unread count, live socket pushes. `onNavigate` runs when a notification is opened */
export function useNotifications(onNavigate: (notification: StaffNotification) => void) {
  const { notification: toast } = App.useApp();
  const [items, setItems] = useState<StaffNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, count] = await Promise.all([
        axiosInstance.get(`/notifications?audience=staff&page=1&pageSize=${PAGE_SIZE}`),
        axiosInstance.get("/notifications/unread-count"),
      ]);
      setItems(list.data.data);
      setUnread(count.data.data.staff);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = useCallback(async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnread((c) => Math.max(0, c - 1));
    await axiosInstance.patch(`/notifications/${id}/read`);
  }, []);

  const openNotification = useCallback(
    (n: StaffNotification) => {
      if (!n.isRead) void markRead(n.id);
      onNavigateRef.current(n);
    },
    [markRead],
  );

  useEffect(() => {
    return addSocketListener((msg) => {
      if (msg.type !== "notification:new") return;
      const incoming = msg.data as StaffNotification;
      if (notificationAudience(incoming.type as NotificationType) !== "staff") return;
      setItems((prev) => [incoming, ...prev.filter((n) => n.id !== incoming.id)].slice(0, PAGE_SIZE));
      setUnread((c) => c + 1);
      toast.open({
        key: incoming.id,
        message: incoming.title,
        description: incoming.body,
        placement: "topRight",
        onClick: () => {
          toast.destroy(incoming.id);
          openNotification(incoming);
        },
        style: { cursor: "pointer" },
      });
      if (IS_NEW_ORDER(incoming.type)) playBeep();
    });
  }, [toast, openNotification]);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
    await axiosInstance.patch("/notifications/read-all?audience=staff");
  }, []);

  return { items, unread, loading, reload: load, openNotification, markAllRead };
}
