import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import PasswordInput from '../components/PasswordInput';

const RESEND_COOLDOWN_S = 60;

/* ─── OTP screen ──────────────────────────────────────────── */
function OtpScreen({ email, message, onSuccess, onBack }) {
  const { verifyOtp, resendOtp } = useAuth();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState(message || '');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);
  const inputRef = useRef(null);

  // Auto-focus the OTP input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Resend cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleVerify = async (e) => {
    e?.preventDefault();
    if (otp.length !== 6) {
      setError('Enter the 6-digit code');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const user = await verifyOtp(email, otp);
      onSuccess(user);
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed');
      setOtp('');
      inputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError('');
    try {
      const data = await resendOtp(email);
      setInfo(data.message || 'A new code has been sent to your email.');
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend code');
    } finally {
      setResending(false);
    }
  };

  // Auto-submit when 6 digits typed
  useEffect(() => {
    if (otp.length === 6 && !submitting) {
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  return (
    <form onSubmit={handleVerify} className="p-5 space-y-3">
      <div className="text-center mb-2">
        <div className="text-3xl mb-2">🔐</div>
        <p className="text-sm font-semibold text-gray-800">Enter verification code</p>
        <p className="text-xs text-gray-500 mt-1">
          Sent to <span className="font-medium text-gray-700">{email}</span>
        </p>
      </div>

      {info && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-lg px-3 py-2">
          {info}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          className="input text-center text-2xl font-mono tracking-[0.5em] py-3"
          placeholder="••••••"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          disabled={submitting}
        />
        <p className="text-[11px] text-gray-400 mt-1.5 text-center">
          6-digit code · expires in 10 minutes
        </p>
      </div>

      <button
        type="submit"
        disabled={submitting || otp.length !== 6}
        className="btn-primary w-full"
      >
        {submitting ? 'Verifying...' : 'Verify & Sign In'}
      </button>

      <div className="flex items-center justify-between text-xs pt-1">
        <button
          type="button"
          onClick={onBack}
          className="text-gray-500 hover:text-gray-700"
        >
          ← Back to login
        </button>
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || resending}
          className="text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-default"
        >
          {resending
            ? 'Sending...'
            : cooldown > 0
              ? `Resend code in ${cooldown}s`
              : 'Resend code'}
        </button>
      </div>
    </form>
  );
}

/* ─── Login page ──────────────────────────────────────────── */
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [otpStep, setOtpStep] = useState(null); // { email, message } when in OTP step
  const { register, handleSubmit, formState: { isSubmitting } } = useForm();

  const onSubmit = async ({ email, password }) => {
    try {
      setError('');
      const result = await login(email, password);
      if (result?.requiresOtp) {
        setOtpStep({ email: result.email, message: result.message });
        return;
      }
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
          <p className="text-xs text-gray-500 mt-1">
            {otpStep ? 'Two-factor verification' : 'Sign in to continue'}
          </p>
        </div>

        {otpStep ? (
          <OtpScreen
            email={otpStep.email}
            message={otpStep.message}
            onSuccess={() => navigate('/')}
            onBack={() => setOtpStep(null)}
          />
        ) : (
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

            <p className="text-[11px] text-gray-400 text-center pt-1">
              🔒 Admin accounts require an email verification code
            </p>

            {/* Demo credentials */}
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-0.5">
              <p className="font-semibold text-gray-600 mb-1">Demo accounts (after seeding):</p>
              <p>admin@recrm.com / password123</p>
              <p>manager@recrm.com / password123</p>
              <p>raj@recrm.com / password123</p>
            </div>
          </form>
        )}

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
