import { api } from './client';

export type QuizQuestion = {
  id: string;
  quizId: string;
  questionText: string;
  options: string[];
  correctAnswers?: string[];
  marks?: number;
  order?: number;
};

export async function listQuestions(quizId: string) {
  const { data } = await api.get<QuizQuestion[]>(
    `/api/quizzes/${quizId}/questions`
  );
  return data;
}

export async function addQuestion(
  quizId: string,
  input: {
    questionText: string;
    options: string[];
    correctAnswers: number[];
    marks?: number;
    order?: number;
  }
) {
  const { data } = await api.post<QuizQuestion>(
    `/api/quizzes/${quizId}/questions`,
    input
  );
  return data;
}

export async function updateQuestion(
  quizId: string,
  questionId: string,
  input: Partial<{
    questionText: string;
    options: string[];
    correctAnswers?: number[]; 
    marks: number;
    order: number;
  }>
) {
  const { data } = await api.put<QuizQuestion>(
    `/api/quizzes/${quizId}/questions/${questionId}`,
    input
  );
  return data;
}

export async function deleteQuestion(quizId: string, questionId: string) {
  await api.delete(`/api/quizzes/${quizId}/questions/${questionId}`);
}