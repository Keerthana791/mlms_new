import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import Login from '../pages/Login';
import SignupAdmin from '../pages/SignupAdmin';
import Signup from '../pages/Signup';
import Courses from '../pages/Courses';
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
      { path: '/courses', element: <Courses /> },
      // add more protected routes here
    ],
  },
  { path: '*', element: <Navigate to="/login" replace /> },
]);