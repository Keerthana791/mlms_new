import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { getCourseQuizAnalytics } from '@/api/analytics';

export default function CourseQuizAnalytics() {
  const { courseId } = useParams<{ courseId: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof getCourseQuizAnalytics>> | null>(null);

  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    setError(null);
    getCourseQuizAnalytics(courseId)
      .then(setData)
      .catch((e: any) => setError(e?.response?.data?.error || 'Failed to load quiz analytics'))
      .finally(() => setLoading(false));
  }, [courseId]);

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Quiz analytics</h1>
          <p className="text-sm text-gray-600">
  Course: {data?.courseTitle || data?.courseId || courseId}
</p>
          <div className="mt-2 text-xs">
            <Link to="/dashboard" className="text-blue-600 hover:underline">
              ← Back to dashboard
            </Link>
          </div>
        </div>

        {loading && <div className="text-sm text-gray-600">Loading...</div>}
        {error && <div className="text-sm text-red-600">Error: {error}</div>}

        {!loading && !error && data && (
          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium text-gray-600">Quiz</th>
                  <th className="px-3 py-2 font-medium text-gray-600">Avg score (out of)</th>
                  <th className="px-3 py-2 font-medium text-gray-600">Attempts</th>
                  <th className="px-3 py-2 font-medium text-gray-600">Highest</th>
                  <th className="px-3 py-2 font-medium text-gray-600">Lowest</th>
                </tr>
              </thead>
              <tbody>
                {data.quizzes.map(q => (
                  <tr key={q.id} className="border-t">
                    <td className="px-3 py-2">{q.title || q.id}</td>
                    <td className="px-3 py-2">
                      {q.totalPoints > 0
                        ? `${q.avgScore.toFixed(1)} / ${q.totalPoints}`
                        : q.avgScore.toFixed(1)}
                    </td>
                    <td className="px-3 py-2">{q.attemptCount}</td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {q.topAttempt
                        ? `${q.topAttempt.score} (${q.topAttempt.student.username ?? q.topAttempt.student.id})`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {q.bottomAttempt
                        ? `${q.bottomAttempt.score} (${q.bottomAttempt.student.username ?? q.bottomAttempt.student.id})`
                        : '—'}
                    </td>
                  </tr>
                ))}
                {data.quizzes.length === 0 && (
                  <tr>
                    <td className="px-3 py-3 text-sm text-gray-500" colSpan={5}>
                      No quizzes in this course.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}