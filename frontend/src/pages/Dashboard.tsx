import { AppLayout } from '@/components/layout/AppLayout';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import {
    getAdminDashboardSummary,
    getTeacherDashboardSummary,
    getStudentDashboardSummary,
} from '@/api/dashboard';

type AdminSummary = {
    users: {
        total: number;
        byRole: {
            Teacher?: number;
            Student?: number;
            [key: string]: number | undefined;
        };
    };
    totalCourses: number;
    totalEnrollments: number;
    performance: {
        quiz: { avgScore: number; submittedCount: number };
        assignment: { avgGrade: number; gradedCount: number };
    };
    optional?: {
        newEnrollments7d?: number;
        [key: string]: number | undefined;
    };
};

type TeacherCourseSummaryItem = {
    courseId: string;
    title: string;
    enrolled: number;
    quizAvgScore: number;
    assignmentAvgGrade: number;
};

type TeacherSummary = {
    myCourses: number;
    courseSummary: TeacherCourseSummaryItem[];
    recentSubmissions: any[];
};

type StudentCourseSummaryItem = {
    courseId: string;
    title: string;
    quizAvgScore: number;
    assignmentAvgGrade: number;
    totalVideos: number;
    videosCompleted: number;
    allVideosWatched: boolean;
};

type StudentSummary = {
    myCourses: number;
    courseSummary: StudentCourseSummaryItem[];
};

type Role = 'Admin' | 'Teacher' | 'Student' | null | undefined;

export function Dashboard() {
    const role = useAuthStore((s) => s.role) as Role;
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [adminData, setAdminData] = useState<AdminSummary | null>(null);
    const [teacherData, setTeacherData] = useState<TeacherSummary | null>(null);
    const [studentData, setStudentData] = useState<StudentSummary | null>(null);

    useEffect(() => {
        if (!role) return;

        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                if (role === 'Admin') {
                    const data = await getAdminDashboardSummary();
                    setAdminData(data);
                    setTeacherData(null);
                    setStudentData(null);
                } else if (role === 'Teacher') {
                    const data = await getTeacherDashboardSummary();
                    setTeacherData(data);
                    setAdminData(null);
                    setStudentData(null);
                } else if (role === 'Student') {
                    const data = await getStudentDashboardSummary();
                    setStudentData(data);
                    setAdminData(null);
                    setTeacherData(null);
                }
            } catch (e: any) {
                setError(e?.response?.data?.error || 'Failed to load dashboard');
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [role]);

    if (!role) {
        return (
            <AppLayout>
                <div className="space-y-4">
                    <h1 className="text-2xl font-semibold">Dashboard</h1>
                    <p className="text-sm text-gray-600">Loading user role...</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-semibold">Dashboard</h1>
                    <p className="text-sm text-gray-600 mt-1">Overview for your account</p>
                </div>

                {loading && (
                    <div className="text-sm text-gray-600">Loading dashboard data...</div>
                )}

                {error && (
                    <div className="text-sm text-red-600">Error: {error}</div>
                )}

                {!loading && !error && role === 'Admin' && adminData && (
                    <div className="space-y-6">
                        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="rounded-lg border bg-white p-4">
                                <h2 className="text-sm font-medium text-gray-500">Users</h2>
                                <p className="mt-2 text-2xl font-semibold">
                                    {adminData.users.total}
                                </p>
                                <p className="mt-1 text-xs text-gray-500">
                                    Teachers: {adminData.users.byRole.Teacher ?? 0} · Students:{' '}
                                    {adminData.users.byRole.Student ?? 0}
                                </p>
                            </div>

                            <div className="rounded-lg border bg-white p-4">
                                <h2 className="text-sm font-medium text-gray-500">Courses</h2>
                                <p className="mt-2 text-2xl font-semibold">
                                    {adminData.totalCourses}
                                </p>
                            </div>

                            <div className="rounded-lg border bg-white p-4">
                                <h2 className="text-sm font-medium text-gray-500">Enrollments</h2>
                                <p className="mt-2 text-2xl font-semibold">
                                    {adminData.totalEnrollments}
                                </p>
                            </div>

                            <div className="rounded-lg border bg-white p-4">
                                <h2 className="text-sm font-medium text-gray-500">Quiz performance</h2>
                                <p className="mt-2 text-xl font-semibold">
                                    Avg score: {adminData.performance.quiz.avgScore.toFixed(1)}
                                </p>
                                <p className="mt-1 text-xs text-gray-500">
                                    Submitted attempts: {adminData.performance.quiz.submittedCount}
                                </p>
                            </div>

                            <div className="rounded-lg border bg-white p-4">
                                <h2 className="text-sm font-medium text-gray-500">Assignment performance</h2>
                                <p className="mt-2 text-xl font-semibold">
                                    Avg grade: {adminData.performance.assignment.avgGrade.toFixed(1)}
                                </p>
                                <p className="mt-1 text-xs text-gray-500">
                                    Graded submissions: {adminData.performance.assignment.gradedCount}
                                </p>
                            </div>

                            <div className="rounded-lg border bg-white p-4">
                                <h2 className="text-sm font-medium text-gray-500">New enrollments (7 days)</h2>
                                <p className="mt-2 text-2xl font-semibold">
                                    {adminData.optional?.newEnrollments7d ?? 0}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {!loading && !error && role === 'Teacher' && teacherData && (
                    <div className="space-y-6">
                        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                            <div className="rounded-lg border bg-white p-4">
                                <h2 className="text-sm font-medium text-gray-500">My courses</h2>
                                <p className="mt-2 text-2xl font-semibold">
                                    {teacherData.myCourses}
                                </p>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-lg font-semibold mb-2">Course summary</h2>
                            {teacherData.courseSummary.length === 0 ? (
                                <p className="text-sm text-gray-600">No courses yet.</p>
                            ) : (
                                <div className="overflow-x-auto rounded-lg border bg-white">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-gray-50 text-left">
                                            <tr>
                                                <th className="px-3 py-2 font-medium text-gray-600">Course</th>
                                                <th className="px-3 py-2 font-medium text-gray-600">Enrolled</th>
                                                <th className="px-3 py-2 font-medium text-gray-600">Quiz avg</th>
                                                <th className="px-3 py-2 font-medium text-gray-600">Assignment avg</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {teacherData.courseSummary.map((c) => (
                                                <tr key={c.courseId} className="border-t">
                                                    <td className="px-3 py-2">{c.title || c.courseId}</td>
                                                    <td className="px-3 py-2">{c.enrolled}</td>
                                                    <td className="px-3 py-2">
                                                        {c.quizAvgScore.toFixed(1)}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {c.assignmentAvgGrade.toFixed(1)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        <div>
                            <h2 className="text-lg font-semibold mb-2">Recent submissions</h2>
                            {teacherData.recentSubmissions.length === 0 ? (
                                <p className="text-sm text-gray-600">No recent submissions.</p>
                            ) : (
                                <ul className="space-y-2 text-sm">
                                    {teacherData.recentSubmissions.map((s) => (
                                        <li
                                            key={s.id}
                                            className="rounded-md border bg-white px-3 py-2 flex justify-between gap-4"
                                        >
                                            <div className="flex-1">
                                                <div className="font-medium">Submission {s.id}</div>
                                                <div className="text-xs text-gray-500">
                                                    Assignment: {s.assignmentId ?? 'N/A'}
                                                </div>
                                            </div>
                                            <div className="text-right text-xs text-gray-500">
                                                {s.createdAt && (
                                                    <span>
                                                        {new Date(s.createdAt).toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}

                {!loading && !error && role === 'Student' && studentData && (
                    <div className="space-y-6">
                        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                            <div className="rounded-lg border bg-white p-4">
                                <h2 className="text-sm font-medium text-gray-500">My courses</h2>
                                <p className="mt-2 text-2xl font-semibold">
                                    {studentData.myCourses}
                                </p>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-lg font-semibold mb-2">Course progress</h2>
                            {studentData.courseSummary.length === 0 ? (
                                <p className="text-sm text-gray-600">You are not enrolled in any courses yet.</p>
                            ) : (
                                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                                    {studentData.courseSummary.map((c) => {
                                        const videoText =
                                            c.totalVideos === 0
                                                ? 'No videos in this course'
                                                : `${c.videosCompleted}/${c.totalVideos} videos watched`;

                                        const progressPercent =
                                            c.totalVideos === 0 ? 0 : Math.round((c.videosCompleted / c.totalVideos) * 100);

                                        return (
                                            <div
                                                key={c.courseId}
                                                className="rounded-xl border bg-white p-4 shadow-sm flex flex-col gap-2"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <div className="text-sm font-semibold text-gray-900">
                                                            {c.title || c.courseId}
                                                        </div>
                                                        <div className="mt-1 text-sm text-gray-500">
                                                            Quiz avg: {c.quizAvgScore.toFixed(1)} · Assignment avg:{' '}
                                                            {c.assignmentAvgGrade.toFixed(1)}
                                                        </div>
                                                    </div>
                                                    {c.allVideosWatched && c.totalVideos > 0 && (
                                                        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                                                            All videos watched
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="mt-2 space-y-1">
                                                    <div className="flex justify-between text-sm text-gray-500">
                                                        <span>Video progress</span>
                                                        {c.totalVideos > 0 && <span>{progressPercent}%</span>}
                                                    </div>
                                                    {c.totalVideos > 0 ? (
                                                        <>
                                                            <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                                                                <div
                                                                    className="h-full rounded-full bg-blue-500 transition-all"
                                                                    style={{ width: `${progressPercent}%` }}
                                                                />
                                                            </div>
                                                            <div className="text-xs text-gray-500">{videoText}</div>
                                                        </>
                                                    ) : (
                                                        <div className="text-xs text-gray-500">{videoText}</div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}