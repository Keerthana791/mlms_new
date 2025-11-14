import { api } from './client';

export type Course = {
  id: string;
  title: string;
  description?: string;
  teacherId?: string;
  tenantId?: string;
  createdAt?: string;
};

export async function listCourses() {
  const { data } = await api.get<Course[]>('/api/courses');
  return data;
}

export async function createCourse(input: { title: string; description?: string; teacherId?: string }) {
  const { data } = await api.post<Course>('/api/courses', input);
  return data;
}
export async function getCourse(id: string) {
  const { data } = await api.get<Course>(`/api/courses/${id}`);
  return data;
}
