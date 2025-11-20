import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { getStudentCourseAssignmentAnalytics } from '@/api/analytics';

export default function StudentCourseAssignmentAnalytics() {
  const { courseId } = useParams<{ courseId: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] =
    useState<Awaited<ReturnType<typeof getStudentCourseAssignmentAnalytics>> | null>(null);

  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    setError(null);
    getStudentCourseAssignmentAnalytics(courseId)
      .then(setData)
      .catch((e: any) =>
        setError(e?.response?.data?.error || 'Failed to load assignment analytics')
      )
      .finally(() => setLoading(false));
  }, [courseId]);

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">My assignment analytics</h1>
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
                  <th className="px-3 py-2 font-medium text-gray-600">Assignment</th>
                  <th className="px-3 py-2 font-medium text-gray-600">Grade</th>
                  <th className="px-3 py-2 font-medium text-gray-600">History</th>
                </tr>
              </thead>
              <tbody>
                {data.assignments.map((a) => {
                  const lastText =
                    a.lastGrade != null ? `${a.lastGrade} / 10` : 'Not graded yet';

                  return (
                    <tr key={a.id} className="border-t align-top">
                      <td className="px-3 py-2">
                        <div className="font-medium">{a.title || a.id}</div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{lastText}</td>
                      <td className="px-3 py-2">
                        {a.history.length === 0 ? (
                          <span className="text-xs text-gray-500">No graded submissions yet.</span>
                        ) : (
                          <ul className="space-y-0.5 text-xs text-gray-600">
                            {a.history.map((h, idx) => (
                              <li key={idx}>
                                Completed ({h.grade}/10){' '}
                                {h.createdAt &&
                                  `on ${new Date(h.createdAt).toLocaleDateString()}`}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {data.assignments.length === 0 && (
                  <tr>
                    <td className="px-3 py-3 text-sm text-gray-500" colSpan={3}>
                      No assignments in this course.
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