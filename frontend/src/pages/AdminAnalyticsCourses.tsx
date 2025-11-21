import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { listCourses, type Course } from '@/api/courses'; // or similar

export default function AdminAnalyticsCourses() {
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchParams] = useSearchParams();
    const mode = searchParams.get('mode'); // 'quiz' | 'assignment' | null
    const isAssignment = mode === 'assignment';

    useEffect(() => {
        setLoading(true);
        setError(null);
        listCourses()
            .then(setCourses)
            .catch((e: any) => setError(e?.response?.data?.error || 'Failed to load courses'))
            .finally(() => setLoading(false));
    }, []);

    return (
        <AppLayout>
            <div className="space-y-4">
                <div>
                    <h1 className="text-2xl font-semibold">Course quiz analytics</h1>
                    <p className="text-sm text-gray-600">
                        Select a course to view detailed quiz analytics.
                    </p>
                    <div className="mt-2 text-xs">
                        <Link to="/dashboard" className="text-blue-600 hover:underline">
                            ← Back to dashboard
                        </Link>
                    </div>
                </div>

                {loading && <div className="text-sm text-gray-600">Loading...</div>}
                {error && <div className="text-sm text-red-600">Error: {error}</div>}

                {!loading && !error && (
                    <div className="overflow-x-auto rounded-lg border bg-white">
                       <table className="min-w-full text-sm">
  <thead className="bg-gray-50 text-left">
    <tr>
      <th className="px-3 py-2 font-medium text-gray-600">Course</th>
      <th className="px-3 py-2 font-medium text-gray-600">
        {isAssignment ? 'Assignment analytics' : 'Quiz analytics'}
      </th>
    </tr>
  </thead>
  <tbody>
    {courses.map((c) => (
      <tr key={c.id} className="border-t">
        <td className="px-3 py-2">{c.title || c.id}</td>
        <td className="px-3 py-2">
          {isAssignment ? (
            <Link
              to={`/analytics/courses/${c.id}/assignments`}
              className="text-blue-600 hover:underline text-xs"
            >
              View assignment analytics
            </Link>
          ) : (
            <Link
              to={`/analytics/courses/${c.id}/quizzes`}
              className="text-blue-600 hover:underline text-xs"
            >
              View quiz analytics
            </Link>
          )}
        </td>
      </tr>
    ))}
    {courses.length === 0 && (
      <tr>
        <td className="px-3 py-3 text-sm text-gray-500" colSpan={2}>
          No courses found.
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