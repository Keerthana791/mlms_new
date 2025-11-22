import { api } from './client';

export type Quiz = {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  isPublished?: boolean;  
  opensAt?: string | null;
  closesAt?: string | null;
  durationMinutes?: number;
  createdAt?: string;
};

export async function listQuizzes(courseId: string) {
  const { data } = await api.get<Quiz[]>(
    `/api/courses/${courseId}/quizzes`
  );
  return data;
}

export async function createQuiz(
  courseId: string,
  input: {
    title: string;
    description?: string;
    opensAt?: string | null;
    closesAt?: string | null;
    durationMinutes?: number;
  }
) {
  const { data } = await api.post<Quiz>(
    `/api/courses/${courseId}/quizzes`,
    input
  );
  return data;
}

export async function updateQuiz(
  courseId: string,
  quizId: string,
  input: {
    title?: string;
    description?: string;
    opensAt?: string | null;
    closesAt?: string | null;
    durationMinutes?: number;
  }
) {
  const { data } = await api.put<Quiz>(
    `/api/courses/${courseId}/quizzes/${quizId}`,
    input
  );
  return data;
}

export async function publishQuiz(courseId: string, quizId: string) {
  const { data } = await api.put<Quiz>(
    `/api/courses/${courseId}/quizzes/${quizId}/publish`,
    {}
  );
  
  return data;
}

export async function closeQuiz(courseId: string, quizId: string) {
  const { data } = await api.put<Quiz>(
    `/api/courses/${courseId}/quizzes/${quizId}/close`,
    {}
  );
  return data;
}

export async function deleteQuiz(courseId: string, quizId: string, force?: boolean) {
  const suffix = force ? '?force=true' : '';
  await api.delete(`/api/courses/${courseId}/quizzes/${quizId}${suffix}`);
}