import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import Projects from './pages/Projects';
import Expenses from './pages/Expenses';
import Attendance from './pages/Attendance';
import Team from './pages/Team';
import AgentProfile from './pages/AgentProfile';
import MetaWebhook from './pages/MetaWebhook';
import ActivityLogs from './pages/ActivityLogs';
import SheetSyncLogs from './pages/SheetSyncLogs';
import CapiEvents from './pages/CapiEvents';
import WhatsAppInbox from './pages/WhatsAppInbox';
import AgentPerformance from './pages/AgentPerformance';
import Reports from './pages/Reports';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

// Toasts sit top-right on desktop (conventional), but on mobile that overlaps the
// lead drawer's ✕ close button — so below the `md` breakpoint we move them top-left.
function ResponsiveToaster() {
  const query = '(max-width: 767px)';
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <Toaster
      position={isMobile ? 'top-left' : 'top-right'}
      toastOptions={{
        duration: 3000,
        style: { fontSize: '13px', borderRadius: '8px' },
      }}
    />
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Layout />
                </PrivateRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="leads" element={<Leads leadType="live" />} />
              <Route path="database" element={<Leads leadType="database" />} />
              <Route path="projects" element={<Projects />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="attendance" element={<Attendance />} />
              <Route path="team" element={<Team />} />
              <Route path="team/:id" element={<AgentProfile />} />
              <Route path="meta-webhook" element={<MetaWebhook />} />
              <Route path="activity-logs" element={<ActivityLogs />} />
              <Route path="sheet-sync-logs" element={<SheetSyncLogs />} />
              <Route path="capi-events" element={<CapiEvents />} />
              <Route path="whatsapp-inbox" element={<WhatsAppInbox />} />
              <Route path="agents" element={<AgentPerformance />} />
              <Route path="reports" element={<Reports />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <ResponsiveToaster />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
