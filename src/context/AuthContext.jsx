import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';
import { initPush, teardownPush } from '../utils/push';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/auth/me')
        .then((res) => setUser(res.data))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Register this device for push notifications once a user is logged in
  // (no-op on web; only runs inside the native mobile app).
  useEffect(() => {
    if (user) initPush();
  }, [user]);

  /**
   * Step 1 of admin login. Returns:
   *   • { requiresOtp: true, email } — caller must follow up with verifyOtp()
   *   • user object — non-admin: token already set
   */
  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    if (data.requiresOtp) {
      // Admin path — token NOT issued yet. Caller renders the OTP screen.
      return { requiresOtp: true, email: data.email, message: data.message };
    }
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data.user;
  };

  /** Step 2 of admin login — submits the 6-digit code, receives JWT. */
  const verifyOtp = async (email, otp) => {
    const { data } = await api.post('/auth/verify-otp', { email, otp });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data.user;
  };

  const resendOtp = async (email) => {
    const { data } = await api.post('/auth/resend-otp', { email });
    return data;
  };

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    teardownPush(); // unregister this device's push token (best-effort)
    localStorage.removeItem('token');
    setUser(null);
  };

  // Merge partial updates into the current user object (e.g. availability toggle)
  const updateUser = (patch) => {
    setUser((u) => (u ? { ...u, ...patch } : u));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, verifyOtp, resendOtp, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
