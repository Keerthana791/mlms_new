import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';
import { getCourse, type Course } from '@/api/courses';
import { listQuestions, type QuizQuestion } from '@/api/quizQuestions';
import {
  startAttempt,
  getActiveAttempt,
  submitAttempt,
  type QuizAttempt,
} from '@/api/quizAttempts';

export default function QuizAttemptPage() {
  const { courseId, quizId } = useParams<{
    courseId: string;
    quizId: string;
  }>();
  const navigate = useNavigate();
  const { role } = useAuthStore();

  const [course, setCourse] = useState<Course | null>(null);
  const [courseError, setCourseError] = useState<string | null>(null);

  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answersById, setAnswersById] = useState<Record<string, number | null>>(
    {}
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);



  // Load course for header
  useEffect(() => {
    if (!courseId) return;
    getCourse(courseId)
      .then((c) => {
        setCourse(c);
        setCourseError(null);
      })
      .catch((e: any) =>
        setCourseError(e?.response?.data?.error || 'Failed to load course')
      );
  }, [courseId]);

  // Load attempt (active or start new) + questions
  useEffect(() => {
    let cancelled = false;
    if (!quizId) return;
    const qid = quizId;

    async function init() {
      setLoading(true);
      setError(null);
      try {
        let att: QuizAttempt | null = null;
        // Try active attempt first
        try {
          att = await getActiveAttempt(qid);
        } catch (e: any) {
          if (e?.response?.status === 404) {
            // no active attempt → start new
            att = await startAttempt(qid);
          } else {
            throw e;
          }
        }
        if (cancelled) return;
        setAttempt(att);

        // Load questions
        const qs = await listQuestions(qid);
        if (cancelled) return;
        setQuestions(qs);
        // Initialize answers state as null
        const initial: Record<string, number | null> = {};
        qs.forEach((q) => {
          initial[q.id] = null;
        });
        setAnswersById(initial);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.response?.data?.error || 'Failed to start quiz');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [quizId]);

  // Load attempt (active or start new) + questions
  useEffect(() => {
    let cancelled = false;
    if (!quizId) return;
    const qid = quizId;

    async function init() {
      setLoading(true);
      setError(null);
      try {
        let att: QuizAttempt | null = null;
        // Try active attempt first
        try {
          att = await getActiveAttempt(qid);
        } catch (e: any) {
          if (e?.response?.status === 404) {
            // no active attempt → start new
            att = await startAttempt(qid);
          } else {
            throw e;
          }
        }
        if (cancelled) return;
        setAttempt(att);

        // Load questions
        const qs = await listQuestions(qid);
        if (cancelled) return;
        setQuestions(qs);
        // Initialize answers state as null
        const initial: Record<string, number | null> = {};
        qs.forEach((q) => {
          initial[q.id] = null;
        });
        setAnswersById(initial);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.response?.data?.error || 'Failed to start quiz');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [quizId]);

  useEffect(() => {
    if (!attempt || attempt.status === 'submitted') return;
    if (attempt.remainingSeconds == null) return;

    setRemainingSeconds(attempt.remainingSeconds);

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev == null) return prev;
        if (prev <= 1) {
          clearInterval(interval);
          // Auto-submit when time is up, if not already submitted
          if (attempt.status !== 'submitted') {
            handleSubmit();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const handleSelect = (questionId: string, index: number) => {
    setAnswersById((prev) => ({
      ...prev,
      [questionId]: index,
    }));
  };

  const handleSubmit = async () => {
    if (!quizId || !attempt) return;
    const qid = quizId;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    // Build answers array
    const answers = Object.entries(answersById)
      .filter(([, idx]) => idx !== null)
      .map(([questionId, idx]) => ({
        questionId,
        selectedOptionIndex: idx as number,
      }));

    if (answers.length === 0) {
      setSubmitError('Please answer at least one question before submitting');
      setSubmitting(false);
      return;
    }

    try {
      const updated = await submitAttempt(qid, attempt.id, answers);
      setAttempt(updated);
      setSubmitSuccess(
        typeof updated.score === 'number'
          ? `Quiz submitted. Score: ${updated.score}`
          : 'Quiz submitted.'
      );
    } catch (e: any) {
      setSubmitError(e?.response?.data?.error || 'Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  const isSubmitted = attempt?.status === 'submitted';
  const timeUp = remainingSeconds !== null && remainingSeconds <= 0;
  if (role !== 'Student') {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto py-8">
          <div className="text-sm text-gray-500">
            Only students can take quizzes from this page.
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Quiz attempt
            </h1>
            {course && (
              <p className="text-sm text-gray-500 mt-1">
                Course: {course.title}
              </p>
            )}
            {attempt && remainingSeconds != null && (
              <p className="text-xs text-gray-500 mt-1">
                Time remaining:{' '}
                <span
                  className={
                    remainingSeconds <= 60 ? 'text-red-600 font-semibold' : 'font-semibold'
                  }
                >
                  {Math.floor(remainingSeconds / 60)}:
                  {(remainingSeconds % 60).toString().padStart(2, '0')}
                </span>
              </p>
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

        {courseError && (
          <div className="text-sm text-red-600">{courseError}</div>
        )}
        {error && <div className="text-sm text-red-600">{error}</div>}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Questions</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && (
              <div className="text-sm text-gray-500">Loading…</div>
            )}

            {submitError && (
              <div className="text-xs text-red-600 mb-2">{submitError}</div>
            )}
            {submitSuccess && (
              <div className="text-xs text-green-600 mb-2">
                {submitSuccess}
              </div>
            )}

            {!loading && !error && questions.length === 0 && (
              <div className="text-sm text-gray-500">
                No questions available for this quiz.
              </div>
            )}

            {!loading && !error && questions.length > 0 && (
              <div className="space-y-4">
                {questions.map((q, idx) => (
                  <div key={q.id} className="border rounded-md p-3 text-sm">
                    <div className="font-medium">
                      Q{idx + 1}. {q.questionText}
                    </div>
                    <div className="mt-2 space-y-1">
                      {q.options.map((opt, i) => (
                        <label
                          key={i}
                          className="flex items-center gap-2 text-xs"
                        >
                          <input
                            type="radio"
                            name={q.id}
                            className="h-3 w-3"
                            disabled={isSubmitted || timeUp}
                            checked={answersById[q.id] === i}
                            onChange={() => handleSelect(q.id, i)}
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isSubmitted && !loading && questions.length > 0 && (
              <div className="mt-4">
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={submitting || timeUp}
                >
                  {submitting ? 'Submitting…' : 'Submit quiz'}
                </Button>
              </div>
            )}

            {isSubmitted && attempt && typeof attempt.score === 'number' && (
              <div className="mt-4 text-sm text-green-700">
                Final score: {attempt.score}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}