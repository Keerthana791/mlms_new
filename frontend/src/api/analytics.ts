import { api } from './client';

export async function getCourseQuizAnalytics(courseId: string) {
  const { data } = await api.get(`/api/analytics/courses/${courseId}/quizzes/detail`);
  return data as {
    courseId: string;
    courseTitle?: string;
    quizzes: {
      id: string;
      title: string;
      totalPoints: number;
      avgScore: number;
      attemptCount: number;
      topAttempt: { score: number; student: { id: string; username: string | null } } | null;
      bottomAttempt: { score: number; student: { id: string; username: string | null } } | null;
    }[];
  };
}

export async function getCourseAssignmentAnalytics(courseId: string) {
  const { data } = await api.get(`/api/analytics/courses/${courseId}/assignments/detail`);
  return data as {
    courseId: string;
    courseTitle?: string;
    assignments: {
      id: string;
      title: string;
      avgGrade: number;
      gradedCount: number;
      topSubmission: { grade: number; student: { id: string; username: string | null } } | null;
      bottomSubmission: { grade: number; student: { id: string; username: string | null } } | null;
    }[];
  };
}