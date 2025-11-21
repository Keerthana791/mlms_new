import { api } from './client';

export type UserRole = 'Admin' | 'Teacher' | 'Student';

export type User = {
  id: string;
  username?: string;          // backend returns usernameOnTenant or username
  usernameOnTenant?: string;
  email?: string;
  role?: UserRole;
};
export async function listUsers(role?: 'Teacher' | 'Student'): Promise<User[]> {
  const { data } = await api.get<User[]>('/api/users', {
    params: role ? { role } : undefined,
  });
  return data;
}
export async function listTeachers() {
  const { data } = await api.get<User[]>('/api/users', {
    params: { role: 'Teacher' },
  });
  return data;
}
export async function createUser(input: {
  username: string;
  email: string;
  password: string;
  role: 'Teacher' | 'Student';
}): Promise<User> {
  const { data } = await api.post<User>('/api/users', input);
  return data;
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/api/users/${id}`);
}