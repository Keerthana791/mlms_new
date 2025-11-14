import { useAuthStore } from '../store/auth';

export default function Courses() {
  const { user, role, tenantId, logout } = useAuthStore();
  return (
    <div className="p-6 space-y-3">
      <h1 className="text-2xl font-semibold">Courses</h1>
      <div className="text-sm text-gray-600">
        Logged in as <b>{user?.username}</b> ({role}) on tenant <b>{tenantId}</b>
      </div>
      <button className="px-3 py-2 bg-gray-800 text-white rounded" onClick={logout}>Logout</button>
      <div className="mt-6 text-gray-700">
        Replace this with your real course list soon.
      </div>
    </div>
  );
}