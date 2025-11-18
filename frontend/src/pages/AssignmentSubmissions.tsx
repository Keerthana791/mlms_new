import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { listSubmissions, type Submission,gradeSubmission,deleteSubmission, } from '@/api/submissions';
import { useAuthStore } from '@/store/auth';
import { getCourse, type Course } from '@/api/courses';

export default function AssignmentSubmissions() {
  const { courseId, assignmentId } = useParams<{
    courseId: string;
    assignmentId: string;
  }>();
  const navigate = useNavigate();
const { role } = useAuthStore();
  const [course, setCourse] = useState<Course | null>(null);
  const [courseError, setCourseError] = useState<string | null>(null);

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gradeById, setGradeById] = useState<Record<string, string>>({});
const [feedbackById, setFeedbackById] = useState<Record<string, string>>({});
const [gradingId, setGradingId] = useState<string | null>(null);
const [gradeError, setGradeError] = useState<string | null>(null);
const [gradeSuccess, setGradeSuccess] = useState<string | null>(null);

  // load course (optional, just for header)
  useEffect(() => {
    if (!courseId) return;
    getCourse(courseId)
      .then((c) => {
        setCourse(c);
        setCourseError(null);
      })
      .catch((e: any) => {
        setCourseError(e?.response?.data?.error || 'Failed to load course');
      });
  }, [courseId]);

  // load submissions
  useEffect(() => {
    if (!assignmentId) return;
    setLoading(true);
    listSubmissions(assignmentId)
      .then((res) => {
        setSubmissions(res);
        setError(null);
      })
      .catch((e: any) => {
        setError(e?.response?.data?.error || 'Failed to load submissions');
      })
      .finally(() => setLoading(false));
  }, [assignmentId]);

  const handleGrade = async (submission: Submission) => {
  if (!assignmentId) return;

  const gradeValue = gradeById[submission.id] ?? '';
  if (!gradeValue.trim()) {
    setGradeError('Grade is required');
    return;
  }

  setGradingId(submission.id);
  setGradeError(null);
  setGradeSuccess(null);

  try {
    const updated = await gradeSubmission(assignmentId, submission.id, {
      grade: gradeValue,
      feedback: feedbackById[submission.id],
    });

    // Update that submission in local state
    setSubmissions((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s))
    );
    setGradeSuccess('Grade saved');
  } catch (e: any) {
    setGradeError(e?.response?.data?.error || 'Failed to save grade');
  } finally {
    setGradingId(null);
  }
};

const handleDeleteSubmission = async (submission: Submission) => {
  if (!assignmentId) return;
  if (!window.confirm('Delete this submission?')) return;

  try {
    await deleteSubmission(assignmentId, submission.id);
    setSubmissions((prev) => prev.filter((s) => s.id !== submission.id));
  } catch (e: any) {
    setGradeError(e?.response?.data?.error || 'Failed to delete submission');
  }
};

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Assignment submissions
            </h1>
            {course && (
              <p className="text-sm text-gray-500 mt-1">
                Course: {course.title}
              </p>
            )}
            {courseError && (
              <p className="text-xs text-red-600 mt-1">{courseError}</p>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/assignments/${courseId}`)}
          >
            Back to assignments
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submissions</CardTitle>
          </CardHeader>
          <CardContent>

            {gradeError && (
  <div className="text-xs text-red-600 mb-2">{gradeError}</div>
)}
{gradeSuccess && (
  <div className="text-xs text-green-600 mb-2">{gradeSuccess}</div>
)}
            {loading && (
              <div className="text-sm text-gray-500">
                Loading submissions…
              </div>
            )}
            {error && (
              <div className="text-sm text-red-600">
                {error}
              </div>
            )}
            {!loading && !error && submissions.length === 0 && (
              <div className="text-sm text-gray-500">
                No submissions yet.
              </div>
            )}
            {!loading && !error && submissions.length > 0 && (
              <div className="divide-y border rounded-md bg-white">
                {submissions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between px-4 py-3 text-sm"
                  >
                    <div>
                      <div>
                        Student: {s.studentName || s.studentId}
                      </div>
                      {s.createdAt && (
                        <div className="text-xs text-gray-500">
                          Submitted:{' '}
                          {new Date(s.createdAt).toLocaleString()}
                        </div>
                      )}

                      <div className="text-xs text-gray-500">
  Status:{' '}
  {s.status ?? (s.grade !== undefined && s.grade !== null ? 'graded' : 'submitted')}
</div>
           {s.grade !== undefined && s.grade !== null && (
      <div className="text-xs">
        Current grade: {String(s.grade)} / 10
      </div>
    )}
    {s.feedback && (
      <div className="text-xs text-gray-600">
        Feedback: {s.feedback}
      </div>
    )}
  </div>

  <div className="flex flex-col items-end gap-2">
                    </div>
                    {s.fileUrl && (
                      <a
                        href={s.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-xs"
                      >
                        View file
                      </a>
                    )}
                     {(role === 'Admin' || role === 'Teacher') && (
      <div className="flex flex-col items-end gap-1 text-xs">
        <div className="flex items-center gap-2">
          <span>Grade (0–10):</span>
          <input
            type="number"
            min={0}
            max={10}
            className="w-16 border rounded px-1 py-0.5 text-xs"
            value={gradeById[s.id] ?? (s.grade !== undefined && s.grade !== null ? String(s.grade) : '')}
            onChange={(e) =>
              setGradeById((prev) => ({
                ...prev,
                [s.id]: e.target.value,
              }))
            }
          />
        </div>
        <textarea
          className="border rounded px-1 py-0.5 text-xs w-48"
          placeholder="Feedback (optional)"
          value={feedbackById[s.id] ?? (s.feedback ?? '')}
          onChange={(e) =>
            setFeedbackById((prev) => ({
              ...prev,
              [s.id]: e.target.value,
            }))
          }
        />
        <Button
          size="sm"
          onClick={() => handleGrade(s)}
          disabled={gradingId === s.id}
        >
          {gradingId === s.id ? 'Saving…' : 'Save grade'}
        </Button>
         <Button
        size="sm"
        variant="destructive"
        onClick={() => handleDeleteSubmission(s)}
      >
        Delete submission
      </Button>
    
      </div>
    )}
    {role === 'Student' &&
    (s.status !== 'graded' && s.grade == null) && (
      <Button
        size="sm"
        variant="destructive"
        onClick={() => handleDeleteSubmission(s)}
      >
        Delete submission
      </Button>
    )}
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