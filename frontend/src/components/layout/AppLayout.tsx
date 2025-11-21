import { Link, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';


type Props = { children: ReactNode };

export function AppLayout({ children }: Props) {
  const { user, role, tenantId, logout } = useAuthStore();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 flex">
      {/* Sidebar */}
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-white">
        <div className="h-14 flex items-center px-4 border-b font-semibold">
          MLMS
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1 text-sm">
          <div className="font-semibold text-xs text-gray-500 px-2 mb-1">
            Navigation
          </div>
          <Link
            to="/dashboard"
            className={`flex items-center gap-2 px-2 py-2 rounded-md ${location.pathname.startsWith('/dashboard')
              ? 'bg-gray-100 text-gray-900'
              : 'text-gray-700 hover:bg-gray-100'
              }`}
          >
            <span>Dashboard</span>
          </Link>
          <Link
            to="/courses"
            className={`flex items-center gap-2 px-2 py-2 rounded-md ${location.pathname.startsWith('/courses')
              ? 'bg-gray-100 text-gray-900'
              : 'text-gray-700 hover:bg-gray-100'
              }`}
          >
            <span>Courses</span>
          </Link>

          <Link
            to="/assignments"
            className="flex items-center gap-2 px-2 py-2 rounded-md text-gray-700 hover:bg-gray-100"
          >
            <span>Assignments</span>
          </Link>
          <Link
            to="/quizzes"
            className="flex items-center gap-2 px-2 py-2 rounded-md text-gray-700 hover:bg-gray-100"
          >
            <span>Quizzes</span>
          </Link>
          <Link
            to="/notifications"
            className={`block px-3 py-2 text-sm ${location.pathname.startsWith('/notifications')
                ? 'bg-gray-100 font-medium'
                : 'text-gray-700 hover:bg-gray-50'
              }`}
          >
          Notifications
          </Link>

          {role === 'Admin' && (
            <Link
              to="/admin/users"
              className="flex items-center gap-2 px-2 py-2 rounded-md text-gray-700 hover:bg-gray-100"
            >
              Manage users
            </Link>
          )}
        </nav>
        <div className="border-t px-4 py-3 text-xs text-gray-500">
          Tenant <b>{tenantId}</b>
          <br />
          User <b>{user?.username}</b> ({role})
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col">
        {/* Top navbar */}
        <header className="h-14 border-b bg-white flex items-center justify-between px-4">
          <div className="font-semibold md:hidden">MLMS</div>
          <div className="flex-1" />
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span className="hidden sm:inline">
              {tenantId} – {user?.username} ({role})
            </span>
            <Button variant="outline" size="sm" onClick={logout}>
              Logout
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}