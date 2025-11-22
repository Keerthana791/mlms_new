import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';
import { getCourse, type Course } from '@/api/courses';
import {
    listQuizzes,
    createQuiz,
    deleteQuiz,
    publishQuiz,
    closeQuiz,
    type Quiz,
} from '@/api/quizzes';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function CourseQuizzes() {
    const { courseId } = useParams<{ courseId: string }>();
    const navigate = useNavigate();
    const { role } = useAuthStore();

    const [course, setCourse] = useState<Course | null>(null);
    const [courseLoading, setCourseLoading] = useState(true);
    const [courseError, setCourseError] = useState<string | null>(null);

    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [quizLoading, setQuizLoading] = useState(true);
    const [quizError, setQuizError] = useState<string | null>(null);

    const [createOpen, setCreateOpen] = useState(false);
    const [createTitle, setCreateTitle] = useState('');
    const [createDescription, setCreateDescription] = useState('');
    const [createDurationMinutes, setCreateDurationMinutes] = useState<number | ''>('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

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

    // load quizzes
    useEffect(() => {
        if (!courseId) return;
        setQuizLoading(true);
        listQuizzes(courseId)
            .then((data) => {
                setQuizzes(data);
                setQuizError(null);
            })
            .catch((e: any) => {
                setQuizError(e?.response?.data?.error || 'Failed to load quizzes');
            })
            .finally(() => setQuizLoading(false));
    }, [courseId]);

    const refreshQuizzes = async () => {
        if (!courseId) return;
        setQuizLoading(true);
        try {
            const data = await listQuizzes(courseId);
            setQuizzes(data);
            setQuizError(null);
        } catch (e: any) {
            setQuizError(e?.response?.data?.error || 'Failed to load quizzes');
        } finally {
            setQuizLoading(false);
        }
    };

    const handleCreateQuiz = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!courseId) return;
        if (!createTitle.trim()) {
            setCreateError('Title is required');
            return;
        }
        setCreating(true);
        setCreateError(null);
        try {
            await createQuiz(courseId, {
                title: createTitle.trim(),
                description: createDescription.trim() || undefined,
                durationMinutes:
                    createDurationMinutes === '' ? undefined : Number(createDurationMinutes),
            });
            setCreateTitle('');
            setCreateDescription('');
            setCreateDurationMinutes('');
            setCreateOpen(false);
            await refreshQuizzes();
        } catch (e: any) {
            setCreateError(e?.response?.data?.error || 'Failed to create quiz');
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteQuiz = async (quizId: string) => {
        if (!courseId) return;
        if (!window.confirm('Delete this quiz and all attempts? This cannot be undone.')) return;
        try {
            await deleteQuiz(courseId, quizId, true); // use force=true
            await refreshQuizzes();
        } catch (e: any) {
            setQuizError(e?.response?.data?.error || 'Failed to delete quiz');
        }
    };

    const handlePublish = async (quizId: string) => {
        if (!courseId) return;
        try {
            await publishQuiz(courseId, quizId);
            await refreshQuizzes();
        } catch (e: any) {
            setQuizError(e?.response?.data?.error || 'Failed to publish quiz');
        }
    };

    const handleClose = async (quizId: string) => {
        if (!courseId) return;
        try {
            await closeQuiz(courseId, quizId);
            await refreshQuizzes();
        } catch (e: any) {
            setQuizError(e?.response?.data?.error || 'Failed to close quiz');
        }
    };

    const isTeacherOrAdmin = role === 'Teacher' || role === 'Admin';

    const visibleQuizzes =
        role === 'Student'
            ? quizzes.filter((q) => q.isPublished)
            : quizzes;

    return (
        <AppLayout>
            <div className="max-w-5xl mx-auto space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            {course?.title || 'Quizzes'}
                        </h1>
                        {course && (
                            <p className="text-sm text-gray-500 mt-1">
                                Quizzes for this course
                            </p>
                        )}
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/quizzes')}
                    >
                        Back to quizzes
                    </Button>
                </div>

                {courseError && (
                    <div className="text-sm text-red-600">{courseError}</div>
                )}

                {isTeacherOrAdmin && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Create quiz</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                                <DialogTrigger asChild>
                                    <Button size="sm">New quiz</Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>New quiz</DialogTitle>
                                    </DialogHeader>

                                    {createError && (
                                        <div className="mb-2 text-xs text-red-600">
                                            {createError}
                                        </div>
                                    )}

                                    <form className="space-y-3" onSubmit={handleCreateQuiz}>
                                        <div className="space-y-1">
                                            <Label htmlFor="quiz-title">Title</Label>
                                            <input
                                                id="quiz-title"
                                                className="w-full border rounded px-2 py-1 text-sm"
                                                value={createTitle}
                                                onChange={(e) => setCreateTitle(e.target.value)}
                                                required
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <Label htmlFor="quiz-desc">Description</Label>
                                            <Textarea
                                                id="quiz-desc"
                                                value={createDescription}
                                                onChange={(e) => setCreateDescription(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="quiz-duration">Duration (minutes)</Label>
                                            <input
                                                id="quiz-duration"
                                                type="number"
                                                min={1}
                                                className="w-full border rounded px-2 py-1 text-sm"
                                                value={createDurationMinutes}
                                                onChange={(e) => {
                                                    const v = e.target.value;
                                                    setCreateDurationMinutes(v === '' ? '' : Number(v));
                                                }}
                                                placeholder="e.g. 30"
                                            />
                                            <p className="text-xs text-gray-500">
                                                How long students have to finish once they start the quiz.
                                            </p>
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

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Quizzes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {quizLoading && (
                            <div className="text-sm text-gray-500">Loading…</div>
                        )}
                        {quizError && (
                            <div className="text-sm text-red-600">{quizError}</div>
                        )}
                        {!quizLoading && !quizError && visibleQuizzes.length === 0 && (
                            <div className="text-sm text-gray-500">
                                No quizzes yet.
                            </div>
                        )}
                        {!quizLoading && !quizError && visibleQuizzes.length > 0 && (
                            <div className="divide-y border rounded-md bg-white">
                                {visibleQuizzes.map((q) => (
                                    <div
                                        key={q.id}
                                        className="flex items-center justify-between px-4 py-3"
                                    >
                                        <div className="space-y-1">
                                            <div className="font-medium text-sm">{q.title}</div>
                                            {q.description && (
                                                <div className="text-xs text-gray-500 line-clamp-2">
                                                    {q.description}
                                                </div>
                                            )}
                                            <div className="text-xs text-gray-500">
                                                Status: {q.isPublished ? 'published' : 'unpublished'}
                                            </div>
                                            {typeof q.durationMinutes === 'number' && (
    <div className="text-xs text-gray-500">
      Duration: {q.durationMinutes} minute(s)
    </div>
  )}
                                        </div>
                                        

                                        <div className="flex items-center gap-2">
                                            {role === 'Student' && (
                                                <Button
                                                    size="sm"
                                                    onClick={() =>
                                                        navigate(`/quizzes/${courseId}/${q.id}/attempt`)
                                                    }
                                                    disabled={!q.isPublished}
                                                >
                                                    Start quiz
                                                </Button>
                                            )}

                                            {isTeacherOrAdmin && (
                                                <>
                                                    {!q.isPublished && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handlePublish(q.id)}
                                                        >
                                                            Publish
                                                        </Button>
                                                    )}
                                                    {q.isPublished && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleClose(q.id)}
                                                        >
                                                            Close
                                                        </Button>
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() => handleDeleteQuiz(q.id)}
                                                    >
                                                        Delete
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => navigate(`/quizzes/${courseId}/${q.id}/questions`)}
                                                    >
                                                        Manage questions
                                                    </Button>
                                                </>
                                            )}
                                        </div>
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