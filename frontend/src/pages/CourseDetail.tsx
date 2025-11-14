import { useAuthStore } from '@/store/auth';
import { listCourseEnrollments, type CourseEnrollmentWithStudent } from '@/api/enrollments';
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCourse, type Course } from '@/api/courses';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { role } = useAuthStore();
  const [enrollments, setEnrollments] = useState<CourseEnrollmentWithStudent[]>([]);
  const [enrollmentsError, setEnrollmentsError] = useState<string | null>(null);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getCourse(id)
      .then((data) => {
        setCourse(data);
        setError(null);
      })
      .catch((e: any) => {
        setError(e?.response?.data?.error || 'Failed to load course');
      })
      .finally(() => setLoading(false));
  }, [id]);

    useEffect(() => {
    if (!id) return;
    if (role !== 'Admin' && role !== 'Teacher') return;

    setEnrollmentsLoading(true);
    setEnrollmentsError(null);

    listCourseEnrollments(id)
      .then((data) => {
        setEnrollments(data);
      })
      .catch((e: any) => {
        setEnrollmentsError(e?.response?.data?.error || 'Failed to load enrollments');
      })
      .finally(() => setEnrollmentsLoading(false));
  }, [id, role]);

    

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {course?.title || 'Course'}
            </h1>
            {course?.description && (
              <p className="text-sm text-gray-500 mt-1">
                {course.description}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/courses')}>
            Back to courses
          </Button>
        </div>


        <Card>
          <CardHeader>
            <CardTitle className="text-base">Course details</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && <div className="text-sm text-gray-500">Loading…</div>}
            {error && <div className="text-sm text-red-600">{error}</div>}
            {!loading && !error && course && (
              <div className="space-y-1 text-sm text-gray-700">
                <div><span className="font-medium">ID:</span> {course.id}</div>
                {course.teacherId && (
                  <div><span className="font-medium">Teacher ID:</span> {course.teacherId}</div>
                )}
                {course.tenantId && (
                  <div><span className="font-medium">Tenant:</span> {course.tenantId}</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>


           {(role === 'Admin' || role === 'Teacher') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enrolled students</CardTitle>
          </CardHeader>
          <CardContent>
            {enrollmentsLoading && (
              <div className="text-sm text-gray-500">Loading…</div>
            )}
            {enrollmentsError && (
              <div className="text-sm text-red-600">{enrollmentsError}</div>
            )}
            {!enrollmentsLoading &&
              !enrollmentsError &&
              enrollments.length === 0 && (
                <div className="text-sm text-gray-500">
                  No students enrolled yet.
                </div>
              )}
            {!enrollmentsLoading &&
              !enrollmentsError &&
              enrollments.length > 0 && (
                <ul className="text-sm space-y-1">
                  {enrollments.map((e) => (
                    <li key={e.id}>
                      {e.student?.username || e.studentId}{' '}
                      <span className="text-xs text-gray-500">
                        ({e.student?.role || 'Student'})
                      </span>
                    </li>
                  ))}
                </ul>
              )}
          </CardContent>
        </Card>
      )}
      </div>
    </AppLayout>
  );
}