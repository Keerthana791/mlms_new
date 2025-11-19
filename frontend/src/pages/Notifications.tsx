// frontend/src/pages/Notifications.tsx
import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  type Notification,
} from '@/api/notifications';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listNotifications({ limit: 50 });
      setNotifications(data);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      const updated = await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? updated : n))
      );
    } catch (e: any) {
      // optional: surface error
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      await load();
    } catch (e: any) {
      // optional: surface error
    } finally {
      setMarkingAll(false);
    }
  };
  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (e: any) {
      // optional: surface error
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            Notifications
          </h1>
          <Button
            size="sm"
            variant="outline"
            onClick={handleMarkAllRead}
            disabled={markingAll || loading || notifications.length === 0}
          >
            {markingAll ? 'Marking…' : 'Mark all as read'}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent notifications</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && (
              <div className="text-sm text-gray-500">Loading…</div>
            )}
            {error && (
              <div className="text-sm text-red-600">{error}</div>
            )}
            {!loading && !error && notifications.length === 0 && (
              <div className="text-sm text-gray-500">
                No notifications.
              </div>
            )}
            {!loading && !error && notifications.length > 0 && (
              <div className="space-y-3">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`border rounded-md px-3 py-2 text-sm ${n.read ? 'bg-white' : 'bg-blue-50'
                      }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{n.title}</div>
                        <div className="text-xs text-gray-700">
                          {n.message}
                        </div>
                        <div className="mt-1 text-[11px] text-gray-400">
                          {new Date(n.createdAt).toLocaleString()}
                        </div>
                      </div>
                      {!n.read && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMarkRead(n.id)}
                        >
                          Mark read
                        </Button>
                    
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(n.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}