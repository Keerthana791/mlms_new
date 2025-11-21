import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { createUser, deleteUser, listUsers, type User } from '@/api/users';
type RoleFilter = 'All' | 'Teacher' | 'Student';
type UserCreationRole = 'Teacher' | 'Student';

export default function AdminUsers() {
    const [users, setUsers] = useState<User[]>([]);
    const [roleFilter, setRoleFilter] = useState<RoleFilter>('All');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState<{
        username: string;
        email: string;
        password: string;
        role: UserCreationRole;
    }>({
        username: '',
        email: '',
        password: '',
        role: 'Teacher',
    });
    const [saving, setSaving] = useState(false);

    const loadUsers = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await listUsers(roleFilter === 'All' ? undefined : roleFilter);
            setUsers(data);
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, [roleFilter]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSaving(true);
            setError(null);
            await createUser(form);
            setForm({ username: '', email: '', password: '', role: form.role });
            await loadUsers();
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Failed to create user');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string, role?: string) => {
  // if role is missing or Admin, do nothing
  if (!role || role === 'Admin') return;
  if (!confirm('Are you sure you want to delete this user?')) return;
  try {
    await deleteUser(id);
    await loadUsers();
  } catch (e: any) {
    alert(e?.response?.data?.error || 'Failed to delete user');
  }
};

    return (
        <AppLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-semibold">Manage users</h1>
                    <p className="text-sm text-gray-600">
                        Add or remove teachers and students in this tenant.
                    </p>
                </div>

                {error && <div className="text-sm text-red-600">Error: {error}</div>}

                {/* Add user form */}
                <form onSubmit={handleCreate} className="rounded-lg border bg-white p-4 space-y-3 max-w-md">
                    <h2 className="text-sm font-medium text-gray-700">Add user</h2>
                    <div className="space-y-1 text-sm">
                        <label className="block text-gray-600">Username</label>
                        <input
                            className="w-full rounded border px-2 py-1 text-sm"
                            value={form.username}
                            onChange={(e) => setForm({ ...form, username: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-1 text-sm">
                        <label className="block text-gray-600">Email</label>
                        <input
                            type="email"
                            className="w-full rounded border px-2 py-1 text-sm"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-1 text-sm">
                        <label className="block text-gray-600">Password</label>
                        <input
                            type="password"
                            className="w-full rounded border px-2 py-1 text-sm"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-1 text-sm">
                        <label className="block text-gray-600">Role</label>
                        <select
                            className="w-full rounded border px-2 py-1 text-sm"
                            value={form.role}
                            onChange={(e) => setForm({ ...form, role: e.target.value as UserCreationRole })}
                        >
                            <option value="Teacher">Teacher</option>
                            <option value="Student">Student</option>
                        </select>
                    </div>
                    <button
                        type="submit"
                        disabled={saving}
                        className="mt-2 inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                        {saving ? 'Creating...' : 'Create user'}
                    </button>
                </form>

                {/* Filter + table */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-600">Filter:</span>
                        {['All', 'Teacher', 'Student'].map((r) => (
                            <button
                                key={r}
                                type="button"
                                onClick={() => setRoleFilter(r as any)}
                                className={`rounded-full border px-2 py-0.5 ${roleFilter === r ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'
                                    } text-xs`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div className="text-sm text-gray-600">Loading users...</div>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border bg-white">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 text-left">
                                    <tr>
                                        <th className="px-3 py-2 font-medium text-gray-600">Username</th>
                                        <th className="px-3 py-2 font-medium text-gray-600">Email</th>
                                        <th className="px-3 py-2 font-medium text-gray-600">Role</th>
                                        <th className="px-3 py-2 font-medium text-gray-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((u) => (
                                        <tr key={u.id} className="border-t">
                                            <td className="px-3 py-2">
                                                {u.usernameOnTenant || u.username || u.id}
                                            </td>
                                            <td className="px-3 py-2">{u.email}</td>
                                            <td className="px-3 py-2">{u.role}</td>
                                            <td className="px-3 py-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(u.id, u.role)}
                                                    disabled={u.role === 'Admin'}
                                                    className="text-xs text-red-600 hover:underline disabled:text-gray-300"
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {users.length === 0 && (
                                        <tr>
                                            <td className="px-3 py-3 text-sm text-gray-500" colSpan={4}>
                                                No users found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}