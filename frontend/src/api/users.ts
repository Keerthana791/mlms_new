import { api } from './client';

export type User = {
  id: string;
  username: string;
  email?: string;
  role?: 'Admin' | 'Teacher' | 'Student';
};

export async function listTeachers() {
  const { data } = await api.get<User[]>('/api/users', {
    params: { role: 'Teacher' },
  });
  return data;
}