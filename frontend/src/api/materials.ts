import { api } from './client';

export type Material = {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  fileType: 'video' | 'pdf' | string;
  fileUrl?: string;   // <- add this
  url?: string;       // optional, for future
  createdAt?: string;
};

export async function listMaterials(courseId: string) {
  const { data } = await api.get<Material[]>(`/api/courses/${courseId}/materials`);
  return data;
}
export async function uploadMaterial(
  courseId: string,
  input: { title: string; description?: string; fileType: 'video' | 'pdf'; file: File }
) {
  const form = new FormData();
  form.append('title', input.title);
  if (input.description) form.append('description', input.description);
  form.append('fileType', input.fileType);
  form.append('file', input.file);

  const { data } = await api.post<Material>(`/api/courses/${courseId}/materials`, form);
  return data;
}
export async function deleteMaterial(courseId: string, materialId: string) {
  const { data } = await api.delete<{ success: boolean }>(
    `/api/courses/${courseId}/materials/${materialId}`
  );
  return data;
}