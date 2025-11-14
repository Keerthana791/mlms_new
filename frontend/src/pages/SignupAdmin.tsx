import { useForm } from 'react-hook-form';
import { signup } from '../api/auth';
import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';

type Form = {
  tenantId: string;
  tenantSecret: string;
  username: string;
  email: string;
  password: string;
};

export default function SignupAdmin() {
  const { register, handleSubmit } = useForm<Form>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (v: Form) => {
    setError(null); setLoading(true);
    try {
      await signup({ ...v, role: 'Admin' });
      navigate('/login', { replace: true });
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-sm space-y-4 border p-6 rounded">
        <h1 className="text-2xl font-semibold">Admin signup</h1>
        {error && <div className="text-red-600 text-sm">{error}</div>}

        <div>
          <label className="block text-sm mb-1">Tenant ID</label>
          <input className="w-full border rounded px-3 py-2" {...register('tenantId', { required: true })} />
        </div>
        <div>
          <label className="block text-sm mb-1">Tenant Secret</label>
          <input className="w-full border rounded px-3 py-2" {...register('tenantSecret', { required: true })} />
        </div>
        <div>
          <label className="block text-sm mb-1">Username</label>
          <input className="w-full border rounded px-3 py-2" {...register('username', { required: true })} />
        </div>
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input type="email" className="w-full border rounded px-3 py-2" {...register('email', { required: true })} />
        </div>
        <div>
          <label className="block text-sm mb-1">Password</label>
          <input type="password" className="w-full border rounded px-3 py-2" {...register('password', { required: true, minLength: 4 })} />
        </div>

        <button disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded">
          {loading ? 'Creating...' : 'Create Admin'}
        </button>

        <div className="text-sm">
          Already have an account? <Link className="text-blue-600" to="/login">Login</Link>
        </div>
      </form>
    </div>
  );
}