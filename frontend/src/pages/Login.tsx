import { useForm } from 'react-hook-form';
import { login } from '../api/auth';
import { useAuthStore } from '../store/auth';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

type Form = { tenantId: string; username: string; password: string };

export default function Login() {
  const { register, handleSubmit } = useForm<Form>({ defaultValues: { tenantId: '', username: '', password: '' } });
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (values: Form) => {
    setError(null); setLoading(true);
    try {
      const res = await login(values);
      setAuth({
        tenantId: res.user.tenantId,
        sessionToken: res.sessionToken,
        role: res.user.role,
        user: res.user,
      });
      navigate('/courses', { replace: true });
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
  <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center">
    <div className="w-full max-w-md mx-auto px-6">
      <div className="bg-white shadow-sm border rounded-xl p-6">
        <h1 className="text-3xl font-bold mb-6">Login</h1>
        {error && <div className="mb-3 text-red-600 text-sm">{error}</div>}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Tenant ID</label>
            <input className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" {...register('tenantId', { required: true })} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Username</label>
            <input className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" {...register('username', { required: true })} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input type="password" className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" {...register('password', { required: true })} />
          </div>

          <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 transition text-white py-2 rounded-lg font-medium">
            {loading ? 'Signing in...' : 'Login'}
          </button>
        </form>

        <div className="text-sm flex gap-3 justify-between mt-4">
          <a className="text-blue-600 hover:underline" href="/signup/admin">Admin signup</a>
          <a className="text-blue-600 hover:underline" href="/signup">User signup</a>
        </div>
      </div>
    </div>
  </div>
);
}