import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import PasswordInput from '../components/PasswordInput';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { isSubmitting } } = useForm();

  const onSubmit = async ({ email, password }) => {
    try {
      setError('');
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed — check credentials');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="card w-full max-w-sm">
        <div className="p-6 border-b border-gray-100 text-center">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm mx-auto mb-3">
            PNH
          </div>
          <h1 className="text-lg font-bold text-gray-900">PNH Lead Management System</h1>
          <p className="text-xs text-gray-500 mt-1">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-3">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              placeholder="you@example.com"
              {...register('email', { required: true })}
            />
          </div>

          <div>
            <label className="label">Password</label>
            <PasswordInput
              className="input"
              placeholder="••••••••"
              {...register('password', { required: true })}
            />
          </div>

          <button type="submit" disabled={isSubmitting} className="btn-primary w-full mt-1">
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>

          {/* Demo credentials */}
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-0.5">
            <p className="font-semibold text-gray-600 mb-1">Demo accounts (after seeding):</p>
            <p>admin@recrm.com / password123</p>
            <p>manager@recrm.com / password123</p>
            <p>raj@recrm.com / password123</p>
          </div>
        </form>

        <div className="px-5 pb-5 text-center">
          {/* <p className="text-xs text-gray-500">
            No account?{' '}
            <Link to="/register" className="text-blue-600 hover:underline font-medium">
              Register
            </Link>
          </p> */}
        </div>
      </div>
    </div>
  );
}
