import { api } from './client';

export async function login(params: { tenantId: string; username: string; password: string }) {
  const { data } = await api.post('/api/auth/login', params);
  return data as { sessionToken: string; user: { role: 'Admin' | 'Teacher' | 'Student'; tenantId: string; username: string } };
}

export async function signup(params: {
  tenantId: string;
  tenantSecret: string;
  username: string;
  email: string;
  password: string;
  role: 'Admin' | 'Teacher' | 'Student';
}) {
  const { data } = await api.post('/api/auth/signup', params);
  return data;
}