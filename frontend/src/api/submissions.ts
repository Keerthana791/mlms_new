import { api } from './client';

export type Submission = {
  id: string;
  assignmentId: string;
  courseId: string;
  studentId: string;
  studentName?: string;
  fileUrl?: string;
  createdAt?: string;
  grade?: string | number | null;
  feedback?: string | null;
  status?: string;   
};

export async function listSubmissions(assignmentId: string) {
  const { data } = await api.get<Submission[]>(
    `/api/submissions/${assignmentId}/submissions`
  );
  return data;
}
export async function submitAssignment(
  assignmentId: string,
  input: { file: File }
) {
  const form = new FormData();
  form.append('file', input.file);

  const { data } = await api.post<Submission>(
    `/api/submissions/${assignmentId}/submissions`,   // <-- FIXED
    form
  );
  return data;
}
export async function gradeSubmission(
  assignmentId: string,
  submissionId: string,
  input: { grade: number | string; feedback?: string }
) {
  const { data } = await api.put<Submission>(
    `/api/submissions/${assignmentId}/submissions/${submissionId}/grade`,
    {
      grade: input.grade,
      feedback: input.feedback,
    }
  );
  return data;
}

export async function deleteSubmission(
  assignmentId: string,
  submissionId: string
) {
  await api.delete(
    `/api/submissions/${assignmentId}/submissions/${submissionId}`
  );
}