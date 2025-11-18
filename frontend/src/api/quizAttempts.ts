import { api } from './client';

export type QuizAttempt = {
  id: string;
  quizId: string;
  startedAt?: string;
  expiresAt?: string | null;
  status: 'in_progress' | 'submitted';
  submittedAt?: string | null;
  remainingSeconds?: number | null;
  score?: number;
  studentCanSeeCorrect?: boolean;
};

export type QuizAnswerInput = {
  questionId: string;
  selectedOptionIndex: number | number[]; // single or multi-select
};

export async function startAttempt(quizId: string) {
  const { data } = await api.post<QuizAttempt>(
    `/api/quizzes/${quizId}/attempts/start`,
    {}
  );
  return data;
}

export async function getActiveAttempt(quizId: string) {
  const { data } = await api.get<QuizAttempt>(
    `/api/quizzes/${quizId}/attempts/active`
  );
  return data;
}

export async function submitAttempt(
  quizId: string,
  attemptId: string,
  answers: QuizAnswerInput[]
) {
  const { data } = await api.post<QuizAttempt>(
    `/api/quizzes/${quizId}/attempts/${attemptId}/submit`,
    { answers }
  );
  return data;
}