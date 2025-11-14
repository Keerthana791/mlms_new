import { listSelfEnrollments, enrollInCourse, unenrollFromCourse } from '@/api/enrollments';
import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { listCourses, type Course, createCourse} from '@/api/courses';
import { listTeachers, type User as Teacher } from '@/api/users';
import { useAuthStore } from '@/store/auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/components/layout/AppLayout';
import { useForm } from 'react-hook-form';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
type CourseForm = {
  title: string;
  description?: string;
  teacherId?: string;
};

export default function Courses() {
  const { user, role, tenantId, logout } = useAuthStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
 
const { register, handleSubmit, reset } = useForm<CourseForm>();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [teachersError, setTeachersError] = useState<string | null>(null);
  const [enrolledIds, setEnrolledIds] = useState<string[]>([]);
const [enrollBusyId, setEnrollBusyId] = useState<string | null>(null);
const [enrollError, setEnrollError] = useState<string | null>(null);
  

  useEffect(() => {
    setTeachersLoading(true);
    listTeachers()
      .then((data) => {
        setTeachers(data);
        setTeachersError(null);
      })
      .catch((e: any) => {
        setTeachersError(e?.response?.data?.error || 'Failed to load teachers');
      })
      .finally(() => setTeachersLoading(false));
  }, [role]);

   useEffect(() => {
    if (role !== 'Student') return;
    listSelfEnrollments()
      .then((list) => {
        setEnrolledIds(list.filter(e => e.status === 'active').map(e => e.courseId));
        setEnrollError(null);
      })
      .catch((e: any) => {
        setEnrollError(e?.response?.data?.error || 'Failed to load enrollments');
      });
  }, [role]);

    const getTeacherLabel = (c: Course) => {
    if (!c.teacherId) return null;
    const t = teachers.find((x) => x.id === c.teacherId);
    return t?.username || c.teacherId;
  };

   

  const isEnrolled = (courseId: string) => enrolledIds.includes(courseId);

  const handleEnroll = async (courseId: string) => {
    if (role !== 'Student') return;
    setEnrollBusyId(courseId);
    setEnrollError(null);
    try {
      await enrollInCourse(courseId);
      setEnrolledIds((prev) =>
        prev.includes(courseId) ? prev : [...prev, courseId]
      );
    } catch (e: any) {
      setEnrollError(e?.response?.data?.error || 'Failed to enroll');
    } finally {
      setEnrollBusyId(null);
    }
  };

  const handleUnenroll = async (courseId: string) => {
    if (role !== 'Student') return;
    setEnrollBusyId(courseId);
    setEnrollError(null);
    try {
      await unenrollFromCourse(courseId);
      setEnrolledIds((prev) => prev.filter((id) => id !== courseId));
    } catch (e: any) {
      setEnrollError(e?.response?.data?.error || 'Failed to unenroll');
    } finally {
      setEnrollBusyId(null);
    }
  };

  
 const onCreateCourse = async (values: CourseForm) => {
    setCreateError(null);
    setCreating(true);
     try {
    const payload = {
      title: values.title,
      description: values.description,
      ...(role === 'Admin' && values.teacherId ? { teacherId: values.teacherId } : {}),
    };
    await createCourse(payload);
      reset();
      // Refresh list
      const data = await listCourses();
      setCourses(data);
    } catch (e: any) {
      setCreateError(e?.response?.data?.error || 'Failed to create course');
    } finally {
      setCreating(false);
    }
  };

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
      .catch((e) => {
        if (active) setError(e?.response?.data?.error || 'Failed to load courses');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
  <AppLayout>
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Courses</h1>
        <p className="text-sm text-gray-500">
          Manage and browse courses in this tenant.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Courses</CardTitle>
          {(role === 'Admin' || role === 'Teacher') && (
  <Dialog>
    <DialogTrigger asChild>
      <Button size="sm">
        New course
      </Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Create course</DialogTitle>
      </DialogHeader>

      {createError && (
        <div className="mb-2 text-xs text-red-600">{createError}</div>
      )}

      <form
        className="space-y-4"
        onSubmit={handleSubmit(onCreateCourse)}
      >
        <div className="grid gap-2">
          <Label htmlFor="title">Title</Label>
          <input
            id="title"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            {...register('title', { required: true })}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            className="text-sm"
            {...register('description')}
          />
        </div>

        {role === 'Admin' && (
    <div className="grid gap-2">
      <Label htmlFor="teacherId">Assign teacher</Label>
      <select
        id="teacherId"
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        {...register('teacherId')}
      >
        <option value="">(Assign myself)</option>
        {teachers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.username} {t.email ? `(${t.email})` : ''}
          </option>
        ))}
      </select>
      {teachersLoading && (
        <span className="text-xs text-gray-500">Loading teachers…</span>
      )}
      {teachersError && (
        <span className="text-xs text-red-600">{teachersError}</span>
      )}
    </div>
  )}


        <Button type="submit" className="w-full" disabled={creating}>
          {creating ? 'Creating…' : 'Create course'}
        </Button>
      </form>
    </DialogContent>
  </Dialog>
)}
        </CardHeader>
        <CardContent>
         {!loading && !error && courses.length > 0 && (
  <div className="divide-y border rounded-md bg-white">
    {courses.map((c) => {
      const enrolled = isEnrolled(c.id);
      return (
        <div key={c.id} className="flex items-center justify-between px-4 py-3">
          <div>
            {role === 'Student' && !enrolled ? (
              <span className="text-sm font-medium">{c.title}</span>
            ) : (
              <Link
                to={`/courses/${c.id}`}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                {c.title}
              </Link>
            )}

            {/* keep your existing teacher label call here */}
            {(() => {
              const teacherLabel = getTeacherLabel(c);
              if (!teacherLabel) return null;
              return (
                <div className="text-xs text-gray-500">
                  Teacher: {teacherLabel}
                </div>
              );
            })()}
          </div>

          <div className="flex items-center gap-3">
            {role === 'Student' && (
              <Button
                size="sm"
                variant={enrolled ? 'outline' : 'default'}
                disabled={enrollBusyId === c.id}
                onClick={() =>
                  enrolled ? handleUnenroll(c.id) : handleEnroll(c.id)
                }
              >
                {enrollBusyId === c.id
                  ? 'Processing...'
                  : enrolled
                  ? 'Enrolled (Unenroll)'
                  : 'Enroll'}
              </Button>
            )}
          </div>
        </div>
      );
    })}
  </div>
)}
{enrollError && (
  <div className="mt-2 text-xs text-red-600">{enrollError}</div>
)}
        </CardContent>
      </Card>
    </div>
  </AppLayout>
);
}