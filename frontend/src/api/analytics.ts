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


export async function markMaterialComplete(materialId: string) {
  await api.post('/api/analytics/events', {
    event: 'material.complete',
    entityType: 'CourseMaterial',
    entityId: materialId,
  });
}
export async function getStudentCourseQuizAnalytics(courseId: string) {
  const { data } = await api.get(`/api/analytics/me/courses/${courseId}/quizzes`);
  return data as {
    courseId: string;
    courseTitle: string;
    quizzes: {
      id: string;
      title: string;
      totalPoints: number;
      lastScore: number | null;
      history: { score: number; createdAt: string }[];
    }[];
  };
}
export async function getStudentCourseAssignmentAnalytics(courseId: string) {
  const { data } = await api.get(`/api/analytics/me/courses/${courseId}/assignments`);
  return data as {
    courseId: string;
    courseTitle: string;
    assignments: {
      id: string;
      title: string;
      lastGrade: number | null;
      history: { grade: number; createdAt: string }[];
    }[];
  };
}