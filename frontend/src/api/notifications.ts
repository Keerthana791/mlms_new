// frontend/src/api/notifications.ts
import { api } from './client';

export type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, any>;
  read: boolean;
  readAt: string | null;
  createdBy: string | null;
  createdAt: string;
  expiresAt: string | null;
};

export async function listNotifications(opts?: {
  read?: 'true' | 'false';
  limit?: number;
  before?: string;
  includeExpired?: boolean;
}) {
  const params = new URLSearchParams();
  if (opts?.read) params.set('read', opts.read);
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.before) params.set('before', opts.before);
  if (opts?.includeExpired) params.set('includeExpired', 'true');

  const qs = params.toString();
  const { data } = await api.get<Notification[]>(
    `/api/notifications${qs ? `?${qs}` : ''}`
  );
  return data;
}

export async function getUnreadCount() {
  const { data } = await api.get<{ unreadCount: number }>(
    '/api/notifications/unread-count'
  );
  return data.unreadCount;
}

export async function markNotificationRead(id: string) {
  const { data } = await api.put<Notification>(
    `/api/notifications/${id}/read`,
    {}
  );
  return data;
}

export async function markAllNotificationsRead(olderThan?: string) {
  const body = olderThan ? { olderThan } : {};
  const { data } = await api.put<{ updated: number }>(
    '/api/notifications/read-all',
    body
  );
  return data.updated;
}
export async function deleteNotification(id: string) {
  await api.delete(`/api/notifications/${id}`);
}