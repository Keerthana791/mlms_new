import { submitAssignment } from '@/api/submissions';
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';
import { getCourse, type Course } from '@/api/courses';
import { listAssignments, createAssignment, deleteAssignment,type Assignment } from '@/api/assignments';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export default function CourseAssignments() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { role } = useAuthStore();

  const [course, setCourse] = useState<Course | null>(null);
  const [courseLoading, setCourseLoading] = useState(true);
  const [courseError, setCourseError] = useState<string | null>(null);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignLoading, setAssignLoading] = useState(true);
  const [assignError, setAssignError] = useState<string | null>(null);

  // create-assignment dialog state (for Admin/Teacher)
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createDueAt, setCreateDueAt] = useState('');
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [submitFileById, setSubmitFileById] = useState<Record<string, File | null>>({});
const [submittingId, setSubmittingId] = useState<string | null>(null);
const [submitError, setSubmitError] = useState<string | null>(null);
const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);



  // load course
  useEffect(() => {
    if (!courseId) return;
    setCourseLoading(true);
    getCourse(courseId)
      .then((data) => {
        setCourse(data);
        setCourseError(null);
      })
      .catch((e: any) => {
        setCourseError(e?.response?.data?.error || 'Failed to load course');
      })
      .finally(() => setCourseLoading(false));
  }, [courseId]);

  // load assignments
  useEffect(() => {
    if (!courseId) return;
    setAssignLoading(true);
    listAssignments(courseId)
      .then((data) => {
        setAssignments(data);
        setAssignError(null);
      })
      .catch((e: any) => {
        setAssignError(e?.response?.data?.error || 'Failed to load assignments');
      })
      .finally(() => setAssignLoading(false));
  }, [courseId]);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    if (!createTitle.trim()) {
      setCreateError('Title is required');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await createAssignment(courseId, {
        title: createTitle.trim(),
        description: createDescription.trim() || undefined,
        dueDate: createDueAt || undefined,
        file: createFile,
      });

      // reset
      setCreateTitle('');
      setCreateDescription('');
      setCreateDueAt('');
      setCreateFile(null);
      setCreateOpen(false);

      // refresh list
      setAssignLoading(true);
      const updated = await listAssignments(courseId);
      setAssignments(updated);
      setAssignError(null);
    } catch (e: any) {
      setCreateError(e?.response?.data?.error || 'Failed to create assignment');
    } finally {
      setCreating(false);
      setAssignLoading(false);
    }
  };

  const handleDelete = async (assignmentId: string) => {
    if (!courseId) return;
    if (!window.confirm('Delete this assignment?')) return;
    try {
      await deleteAssignment(courseId, assignmentId);
      const updated = await listAssignments(courseId);
      setAssignments(updated);
      setAssignError(null);
    } catch (e: any) {
      setAssignError(e?.response?.data?.error || 'Failed to delete assignment');
    }
  };

  const handleSubmitAssignment = async (assignmentId: string) => {
  const file = submitFileById[assignmentId];
  if (!file) {
    setSubmitError('Please choose a file to submit');
    return;
  }
  setSubmittingId(assignmentId);
  setSubmitError(null);
  setSubmitSuccess(null);

  try {
    await submitAssignment(assignmentId, { file });
    setSubmitSuccess('Submission uploaded successfully');
    setSubmitFileById((prev) => ({ ...prev, [assignmentId]: null }));
  } catch (e: any) {
    setSubmitError(e?.response?.data?.error || 'Failed to submit assignment');
  } finally {
    setSubmittingId(null);
  }
};



  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {course?.title || 'Assignments'}
            </h1>
            {course && (
              <p className="text-sm text-gray-500 mt-1">
                Assignments for this course
              </p>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={() => navigate('/assignments')}>
            Back to assignments
          </Button>
        </div>

        {courseError && (
          <div className="text-sm text-red-600">{courseError}</div>
        )}

        {/* Create assignment (Admin/Teacher only) */}
        {(role === 'Admin' || role === 'Teacher') && (
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-base">Create assignment</CardTitle>
            </CardHeader>
            <CardContent>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">New assignment</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New assignment</DialogTitle>
                  </DialogHeader>

                  {createError && (
                    <div className="mb-2 text-xs text-red-600">
                      {createError}
                    </div>
                  )}

                  <form className="space-y-3" onSubmit={handleCreateAssignment}>
                    <div className="space-y-1">
                      <Label htmlFor="as-title">Title</Label>
                      <input
                        id="as-title"
                        className="w-full border rounded px-2 py-1 text-sm"
                        value={createTitle}
                        onChange={(e) => setCreateTitle(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="as-desc">Description</Label>
                      <Textarea
                        id="as-desc"
                        value={createDescription}
                        onChange={(e) => setCreateDescription(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="as-due">Due date/time</Label>
                      <input
                        id="as-due"
                        type="datetime-local"
                        className="w-full border rounded px-2 py-1 text-sm"
                        value={createDueAt}
                        onChange={(e) => setCreateDueAt(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="as-file">Assignment PDF (optional)</Label>
                      <input
                        id="as-file"
                        type="file"
                        className="w-full text-sm"
                        onChange={(e) =>
                          setCreateFile(e.target.files?.[0] ?? null)
                        }
                      />
                    </div>

                    <Button type="submit" size="sm" disabled={creating}>
                      {creating ? 'Creating…' : 'Create'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        )}

        {/* Assignments list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            {submitError && (
    <div className="text-xs text-red-600 mb-2">{submitError}</div>
  )}
  {submitSuccess && (
    <div className="text-xs text-green-600 mb-2">{submitSuccess}</div>
  )}
            {assignLoading && (
              <div className="text-sm text-gray-500">Loading…</div>
            )}
            {assignError && (
              <div className="text-sm text-red-600">{assignError}</div>
            )}
            {!assignLoading && !assignError && assignments.length === 0 && (
              <div className="text-sm text-gray-500">
                No assignments yet.
              </div>
            )}
            {!assignLoading && !assignError && assignments.length > 0 && (
              <div className="divide-y border rounded-md bg-white">
                {assignments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div className="space-y-1">
                      <div className="font-medium text-md">
                        {a.title}
                      </div>
                      {a.description && (
                        <div className="text-xs text-gray-500 line-clamp-2">
                          {a.description}
                        </div>
                      )}
                      {a.dueDate && (
                         <div className="text-xs text-gray-500">
    Due:{' '}
    {new Date(
      typeof a.dueDate === 'string' ? a.dueDate : a.dueDate.iso
    ).toLocaleString()}
  </div>
)}
                      {a.file && a.file.url && (
  <div className="text-xs">
    <a
      href={a.file.url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline"
    >
      View assignment file
    </a>
  </div>
)} 

    <div className="flex items-center gap-2">
      {(role === 'Admin' || role === 'Teacher') && (
        <Button
          variant="destructive"
          size="sm"
          onClick={() => handleDelete(a.id)}
        >
          Delete
        </Button>
      )}
    </div>
    {role === 'Student' && (
  <div className="flex items-center gap-2 mt-1">
    <input
      type="file"
      className="text-xs"
      onChange={(e) =>
        setSubmitFileById((prev) => ({
          ...prev,
          [a.id]: e.target.files?.[0] ?? null,
        }))
      }
    />
    <Button
      size="sm"
      onClick={() => handleSubmitAssignment(a.id)}
      disabled={submittingId === a.id}
    >
      {submittingId === a.id ? 'Submitting…' : 'Submit'}
    </Button>
  </div>
)}
<div className="flex items-center gap-2 mt-1">
  {(role === 'Admin' || role === 'Teacher') && (
    <>
      <Button
  variant="outline"
  size="sm"
  onClick={() => navigate(`/assignments/${courseId}/${a.id}/submissions`)}
>
  View submissions
</Button>
      {/* <Button
        variant="destructive"
        size="sm"
        onClick={() => handleDelete(a.id)}
      >
        Delete
      </Button> */}
    </>
  )}
  {role === 'Student' && (
    <Button
      variant="outline"
      size="sm"
      onClick={() => navigate(`/assignments/${courseId}/${a.id}/submissions`)}
    >
      My submissions
    </Button>
  )}
</div>



                    </div>

                    {/* Student submit / Teacher view submissions will go here next */}
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