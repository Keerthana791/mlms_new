import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { getCourseAssignmentAnalytics } from '@/api/analytics';

export default function CourseAssignmentAnalytics() {
  const { courseId } = useParams<{ courseId: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] =
    useState<Awaited<ReturnType<typeof getCourseAssignmentAnalytics>> | null>(null);

  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    setError(null);
    getCourseAssignmentAnalytics(courseId)
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
          <h1 className="text-2xl font-semibold">Assignment analytics</h1>
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
                  <th className="px-3 py-2 font-medium text-gray-600">Avg grade (out of)</th>
                  <th className="px-3 py-2 font-medium text-gray-600">Graded</th>
                  <th className="px-3 py-2 font-medium text-gray-600">Highest</th>
                  <th className="px-3 py-2 font-medium text-gray-600">Lowest</th>
                </tr>
              </thead>
              <tbody>
                {data.assignments.map(a => (
                  <tr key={a.id} className="border-t">
                    <td className="px-3 py-2">{a.title || a.id}</td>
                    <td className="px-3 py-2">
                      {`${a.avgGrade.toFixed(1)} / 10`}
                    </td>
                    <td className="px-3 py-2">{a.gradedCount}</td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {a.topSubmission
                        ? `${a.topSubmission.grade} (${a.topSubmission.student.username ?? a.topSubmission.student.id})`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {a.bottomSubmission
                        ? `${a.bottomSubmission.grade} (${a.bottomSubmission.student.username ?? a.bottomSubmission.student.id})`
                        : '—'}
                    </td>
                  </tr>
                ))}
                {data.assignments.length === 0 && (
                  <tr>
                    <td className="px-3 py-3 text-sm text-gray-500" colSpan={5}>
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