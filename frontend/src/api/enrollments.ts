import { api } from './client';

export type Enrollment = {
  id: string;
  tenantId: string;
  courseId: string;
  studentId: string;
  status: 'active' | 'inactive';
  alreadyEnrolled?: boolean;
};

export async function listSelfEnrollments() {
  const { data } = await api.get<Enrollment[]>('/api/enrollments/self');
  return data;
}

export async function enrollInCourse(courseId: string) {
  const { data } = await api.post<Enrollment>('/api/enrollments/self', { courseId });
  return data;
}

export async function unenrollFromCourse(courseId: string) {
  const { data } = await api.delete<{ success: boolean }>(
    '/api/enrollments/self/' + courseId
  );
  return data;
}
export type CourseEnrollmentWithStudent = {
  id: string;
  courseId: string;
  studentId: string;
  status: 'active' | 'inactive';
  student?: { id: string; username: string; role: string } | null;
};

export async function listCourseEnrollments(courseId: string) {
  const { data } = await api.get<CourseEnrollmentWithStudent[]>(
    `/api/courses/${courseId}/enrollments`
  );
  return data;
}