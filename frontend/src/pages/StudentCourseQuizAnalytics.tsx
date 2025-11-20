import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { getStudentCourseQuizAnalytics } from '@/api/analytics';

export default function StudentCourseQuizAnalytics() {
    const { courseId } = useParams<{ courseId: string }>();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] =
        useState<Awaited<ReturnType<typeof getStudentCourseQuizAnalytics>> | null>(null);

    useEffect(() => {
        if (!courseId) return;
        setLoading(true);
        setError(null);
        getStudentCourseQuizAnalytics(courseId)
            .then(setData)
            .catch((e: any) =>
                setError(e?.response?.data?.error || 'Failed to load quiz analytics')
            )
            .finally(() => setLoading(false));
    }, [courseId]);

    return (
        <AppLayout>
            <div className="space-y-4">
                <div>
                    <h1 className="text-2xl font-semibold">My quiz analytics</h1>
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
                                    <th className="px-3 py-2 font-medium text-gray-600">Score</th>
                                    <th className="px-3 py-2 font-medium text-gray-600">History</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.quizzes.map((q) => {
                                    const lastScoreText =
                                        q.lastScore != null
                                            ? q.totalPoints > 0
                                                ? `${q.lastScore} / ${q.totalPoints}`
                                                : `${q.lastScore}`
                                            : 'No attempts yet';

                                    return (
                                        <tr key={q.id} className="border-t align-top">
                                            <td className="px-3 py-2">
                                                <div className="font-medium">{q.title || q.id}</div>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                {lastScoreText}
                                            </td>
                                            <td className="px-3 py-2">
                                                {q.history.length === 0 ? (
                                                    <span className="text-xs text-gray-500">No attempts yet.</span>
                                                ) : (
                                                    <ul className="space-y-0.5 text-xs text-gray-600">
                                                        {q.history.map((h, idx) => (
                                                            <li key={idx}>
                                                                Completed{' '}
                                                                {q.totalPoints > 0
                                                                    ? `(${h.score}/${q.totalPoints})`
                                                                    : `(${h.score})`}{' '}
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
                                {data.quizzes.length === 0 && (
                                    <tr>
                                        <td className="px-3 py-3 text-sm text-gray-500" colSpan={3}>
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