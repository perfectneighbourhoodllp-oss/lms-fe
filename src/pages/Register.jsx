import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({ defaultValues: { role: 'sales' } });

  const onSubmit = async (data) => {
    try {
      setError('');
      await registerUser(data);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="card w-full max-w-sm">
        <div className="p-6 border-b border-gray-100 text-center">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm mx-auto mb-3">
            RE
          </div>
          <h1 className="text-lg font-bold text-gray-900">Create Account</h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-3">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="label">Full Name *</label>
            <input className="input" placeholder="Jane Smith" {...register('name', { required: true })} />
          </div>
          <div>
            <label className="label">Email *</label>
            <input type="email" className="input" placeholder="you@example.com" {...register('email', { required: true })} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" placeholder="+91 98765 43210" {...register('phone')} />
          </div>
          <div>
            <label className="label">Password *</label>
            <input type="password" className="input" placeholder="Min 6 chars" {...register('password', { required: true, minLength: 6 })} />
          </div>

          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? 'Creating...' : 'Create Account'}
          </button>
        </form>

        <div className="px-5 pb-5 text-center">
          <p className="text-xs text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
