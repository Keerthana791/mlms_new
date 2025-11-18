import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';
import { listCourses, type Course } from '@/api/courses';
import { listSelfEnrollments, type Enrollment } from '@/api/enrollments';

export default function Quizzes() {
  const { role, user } = useAuthStore();
  const navigate = useNavigate();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [enrError, setEnrError] = useState<string | null>(null);

  // Load all courses (tenant-scoped, backend already handles role)
  useEffect(() => {
    let active = true;
    setLoading(true);
    listCourses()
      .then((data) => {
        if (active) {
          setCourses(data);
          setError(null);
        }
      })
      .catch((e: any) => {
        if (active) {
          setError(e?.response?.data?.error || 'Failed to load courses');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Load self-enrollments (for students)
  useEffect(() => {
    if (role !== 'Student') return;
    listSelfEnrollments()
      .then((data) => {
        setEnrollments(data);
        setEnrError(null);
      })
      .catch((e: any) => {
        setEnrError(e?.response?.data?.error || 'Failed to load enrollments');
      });
  }, [role]);

  // Role-based visible courses
  let visibleCourses = courses;
  if (role === 'Teacher') {
    visibleCourses = courses.filter((c) => c.teacherId === user?.id);
  } else if (role === 'Student') {
    const enrolledIds = new Set(
      enrollments.filter((e) => e.status === 'active').map((e) => e.courseId)
    );
    visibleCourses = courses.filter((c) => enrolledIds.has(c.id));
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quizzes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage and attempt quizzes in this tenant.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Courses</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && (
              <div className="text-sm text-gray-500">Loading…</div>
            )}
            {error && (
              <div className="text-sm text-red-600">{error}</div>
            )}
            {role === 'Student' && enrError && (
              <div className="text-sm text-red-600">{enrError}</div>
            )}

            {!loading && !error && visibleCourses.length === 0 && (
              <div className="text-sm text-gray-500">
                No courses available for quizzes.
              </div>
            )}

            {!loading && !error && visibleCourses.length > 0 && (
              <div className="divide-y border rounded-md bg-white">
                {visibleCourses.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div>
                      <div className="font-medium">{c.title}</div>
                      {c.description && (
                        <div className="text-xs text-gray-500 line-clamp-1">
                          {c.description}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => navigate(`/quizzes/${c.id}`)}
                    >
                      {role === 'Student'
                        ? 'View quizzes'
                        : 'Manage quizzes'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}