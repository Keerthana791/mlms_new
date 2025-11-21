import AdminUsers from '../pages/AdminUsers';
import AdminAnalyticsCourses from '../pages/AdminAnalyticsCourses';
import StudentCourseQuizAnalytics from '../pages/StudentCourseQuizAnalytics';
import StudentCourseAssignmentAnalytics from '../pages/StudentCourseAssignmentAnalytics';
import CourseQuizAnalytics from '../pages/CourseQuizAnalytics';
import CourseAssignmentAnalytics from '../pages/CourseAssignmentAnalytics';
import { Dashboard } from '@/pages/Dashboard';
import NotificationsPage from '@/pages/Notifications';
import QuizAttemptPage from '../pages/QuizAttempt';
import Quizzes from '../pages/Quizzes';
import CourseQuizzes from '../pages/CourseQuizzes';
import QuizQuestions from '../pages/QuizQuestions';
import AssignmentSubmissions from '../pages/AssignmentSubmissions';
import Assignments from '../pages/Assignments';
import CourseAssignments from '../pages/CourseAssignments';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import Login from '../pages/Login';
import SignupAdmin from '../pages/SignupAdmin';
import Signup from '../pages/Signup';
import Courses from '../pages/Courses';
import CourseDetail from '../pages/CourseDetail';
import { useAuthStore } from '../store/auth';
import { useEffect } from 'react';

function RequireAuth() {
  const { sessionToken, hydrate } = useAuthStore();
  useEffect(() => { hydrate(); }, [hydrate]);
  if (!sessionToken) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '/login', element: <Login /> },
  { path: '/signup/admin', element: <SignupAdmin /> },
  { path: '/signup', element: <Signup /> },

  {
    element: <RequireAuth />,
    children: [
      { path: '/dashboard', element: <Dashboard /> },
      { path: '/courses', element: <Courses /> },
      { path: '/courses/:id', element: <CourseDetail /> },
      { path: '/assignments', element: <Assignments /> },
      { path: '/assignments/:courseId', element: <CourseAssignments /> },
      {
        path: '/assignments/:courseId/:assignmentId/submissions',
        element: <AssignmentSubmissions />,
      },
      { path: '/quizzes', element: <Quizzes /> },
      { path: '/quizzes/:courseId', element: <CourseQuizzes /> },
      { path: '/quizzes/:courseId/:quizId/questions', element: <QuizQuestions /> },
      { path: '/quizzes/:courseId/:quizId/attempt', element: <QuizAttemptPage /> },
      { path: '/notifications', element: <NotificationsPage /> },
      { path: '/analytics/courses/:courseId/quizzes', element: <CourseQuizAnalytics /> },
      { path: '/analytics/courses/:courseId/assignments', element: <CourseAssignmentAnalytics /> },
      { path: '/me/analytics/courses/:courseId/quizzes', element: <StudentCourseQuizAnalytics /> },
      { path: '/me/analytics/courses/:courseId/assignments', element: <StudentCourseAssignmentAnalytics /> },
      { path: '/analytics/courses', element: <AdminAnalyticsCourses /> },
      { path: '/admin/users', element: <AdminUsers /> },
      // later: other protected routes
    ],
  },
  { path: '*', element: <Navigate to="/login" replace /> },
]);