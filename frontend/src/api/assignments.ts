import { api } from './client';

export type Assignment = {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  dueDate?: { __type: 'Date'; iso: string } | null;   // backend field name
  file?: { url: string } | null;  // Parse File from toJSON()
  createdAt?: string;
};

export async function listAssignments(courseId: string) {
  const { data } = await api.get<Assignment[]>(
    `/api/courses/${courseId}/assignments`
  );
  return data;
}

export async function createAssignment(
  courseId: string,
  input: { title: string; description?: string; dueDate?: string; file?: File | null }
) {
  const form = new FormData();
  form.append('title', input.title);
  if (input.description) form.append('description', input.description);
  if (input.dueDate) form.append('dueDate', input.dueDate);
  if (input.file) form.append('file', input.file);

  const { data } = await api.post<Assignment>(
    `/api/courses/${courseId}/assignments`,
    form
  );
  return data;
}
export async function deleteAssignment(courseId: string, assignmentId: string) {
  await api.delete(`/api/courses/${courseId}/assignments/${assignmentId}`);
}