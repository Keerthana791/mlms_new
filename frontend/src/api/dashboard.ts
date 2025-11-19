import { api } from './client';

export async function getAdminDashboardSummary() {
  const { data } = await api.get('/api/analytics/admin/summary');
  return data;
}

export async function getTeacherDashboardSummary() {
  const { data } = await api.get('/api/analytics/teacher/summary');
  return data;
}

export async function getStudentDashboardSummary() {
  const { data } = await api.get('/api/analytics/me/summary');
  return data;
}