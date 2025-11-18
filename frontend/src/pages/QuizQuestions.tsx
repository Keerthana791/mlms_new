import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';
import { getCourse, type Course } from '@/api/courses';
import { listQuizzes, type Quiz } from '@/api/quizzes';
import {
  listQuestions,
  addQuestion,
  deleteQuestion,
  type QuizQuestion,
} from '@/api/quizQuestions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function QuizQuestions() {
  const { courseId, quizId } = useParams<{
    courseId: string;
    quizId: string;
  }>();
  const navigate = useNavigate();
  const { role } = useAuthStore();

  const [course, setCourse] = useState<Course | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [courseError, setCourseError] = useState<string | null>(null);
const [questionText, setQuestionText] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
 const [options, setOptions] = useState<string[]>(['']);
const [correctIndices, setCorrectIndices] = useState<number[]>([]);
  const [correctText, setCorrectText] = useState('');
  const [marks, setMarks] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const isTeacherOrAdmin = role === 'Teacher' || role === 'Admin';

  // load course + quiz (for header)
  useEffect(() => {
    if (!courseId) return;
    getCourse(courseId)
      .then(setCourse)
      .catch((e: any) =>
        setCourseError(e?.response?.data?.error || 'Failed to load course')
      );
  }, [courseId]);

  useEffect(() => {
    if (!courseId || !quizId) return;
    listQuizzes(courseId)
      .then((qs) => {
        const q = qs.find((x) => x.id === quizId) || null;
        setQuiz(q);
      })
      .catch(() => {
        // non‑fatal
      });
  }, [courseId, quizId]);

  // load questions
  useEffect(() => {
    if (!quizId) return;
    setLoading(true);
    listQuestions(quizId)
      .then((data) => {
        setQuestions(data);
        setError(null);
      })
      .catch((e: any) => {
        setError(e?.response?.data?.error || 'Failed to load questions');
      })
      .finally(() => setLoading(false));
  }, [quizId]);

  const refreshQuestions = async () => {
    if (!quizId) return;
    setLoading(true);
    try {
      const data = await listQuestions(quizId);
      setQuestions(data);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!quizId) return;

  if (!questionText.trim()) {
    setCreateError('Question text is required');
    return;
  }

  const cleanedOptions = options.map((o) => o.trim()).filter(Boolean);

  if (cleanedOptions.length === 0 || correctIndices.length === 0) {
    setCreateError('At least one option and one correct answer are required');
    return;
  }

  const validCorrect = correctIndices.filter(
    (i) => i >= 0 && i < cleanedOptions.length
  );
  if (validCorrect.length === 0) {
    setCreateError('Select at least one valid correct option');
    return;
  }

  setCreating(true);
  setCreateError(null);
  try {
    await addQuestion(quizId, {
      questionText: questionText.trim(),
      options: cleanedOptions,
      correctAnswers: validCorrect,
      marks: marks ? Number(marks) : undefined,
    });
    setQuestionText('');
    setOptions(['']);
    setCorrectIndices([]);
    setMarks('');
    setCreateOpen(false);
    await refreshQuestions();
  } catch (e: any) {
    setCreateError(e?.response?.data?.error || 'Failed to add question');
  } finally {
    setCreating(false);
  }
};

  const handleDeleteQuestion = async (questionId: string) => {
    if (!quizId) return;
    if (!window.confirm('Delete this question?')) return;
    try {
      await deleteQuestion(quizId, questionId);
      await refreshQuestions();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to delete question');
    }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {quiz?.title || 'Quiz questions'}
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
            onClick={() => navigate(`/quizzes/${courseId}`)}
          >
            Back to quizzes
          </Button>
        </div>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-base">Questions</CardTitle>
            {isTeacherOrAdmin && (
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">Add question</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add question</DialogTitle>
                  </DialogHeader>

                  {createError && (
                    <div className="mb-2 text-xs text-red-600">
                      {createError}
                    </div>
                  )}

                  <form className="space-y-3" onSubmit={handleAddQuestion}>
                    <div className="space-y-1">
                      <Label htmlFor="qq-text">Question text</Label>
                      <Textarea
                        id="qq-text"
                        value={questionText}
                        onChange={(e) => setQuestionText(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
  <Label>Options</Label>
  <div className="space-y-2">
    {options.map((opt, index) => (
      <div key={index} className="flex items-center gap-2">
        <input
          className="flex-1 border rounded px-2 py-1 text-sm"
          value={opt}
          onChange={(e) => {
            const next = [...options];
            next[index] = e.target.value;
            setOptions(next);
          }}
        />
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={correctIndices.includes(index)}
            onChange={(e) => {
              if (e.target.checked) {
                setCorrectIndices((prev) =>
                  prev.includes(index) ? prev : [...prev, index]
                );
              } else {
                setCorrectIndices((prev) =>
                  prev.filter((i) => i !== index)
                );
              }
            }}
          />
          Correct
        </label>
        {options.length > 1 && (
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => {
              const next = options.filter((_, i) => i !== index);
              setOptions(next);
              setCorrectIndices((prev) =>
                prev
                  .filter((i) => i !== index)
                  .map((i) => (i > index ? i - 1 : i))
              );
            }}
          >
            -
          </Button>
        )}
      </div>
    ))}
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => setOptions((prev) => [...prev, ''])}
    >
      Add option
    </Button>
  </div>
</div>

                    <div className="space-y-1">
                      <Label htmlFor="qq-marks">Marks </Label>
                      <input
                        id="qq-marks"
                        type="number"
                        min={0}
                        className="w-24 border rounded px-2 py-1 text-sm"
                        value={marks}
                        onChange={(e) => setMarks(e.target.value)}
                      />
                    </div>

                    <Button type="submit" size="sm" disabled={creating}>
                      {creating ? 'Adding…' : 'Add question'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent>
            {loading && (
              <div className="text-sm text-gray-500">Loading…</div>
            )}
            {error && (
              <div className="text-sm text-red-600">{error}</div>
            )}
            {!loading && !error && questions.length === 0 && (
              <div className="text-sm text-gray-500">
                No questions yet.
              </div>
            )}
            {!loading && !error && questions.length > 0 && (
              <div className="divide-y border rounded-md bg-white">
                {questions.map((q) => (
                  <div
                    key={q.id}
                    className="flex items-center justify-between px-4 py-3 text-sm"
                  >
                    <div className="space-y-1">
                      <div className="font-medium">
                        {q.questionText}
                      </div>
                      <div className="text-xs text-gray-600">
                        Options: {q.options.join(' | ')}
                      </div>
                      {q.correctAnswers && (
                        <div className="text-xs text-gray-600">
                          Correct: {q.correctAnswers.join(' | ')}
                        </div>
                      )}
                      {q.marks !== undefined && (
                        <div className="text-xs text-gray-500">
                          Marks: {q.marks}
                        </div>
                      )}
                    </div>

                    {isTeacherOrAdmin && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteQuestion(q.id)}
                      >
                        Delete
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