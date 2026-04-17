import React from 'react';
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
import Team from './pages/Team';
import MetaWebhook from './pages/MetaWebhook';
import ActivityLogs from './pages/ActivityLogs';
import AgentPerformance from './pages/AgentPerformance';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

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
              <Route path="leads" element={<Leads />} />
              <Route path="projects" element={<Projects />} />
              <Route path="team" element={<Team />} />
              <Route path="meta-webhook" element={<MetaWebhook />} />
              <Route path="activity-logs" element={<ActivityLogs />} />
              <Route path="agents" element={<AgentPerformance />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: { fontSize: '13px', borderRadius: '8px' },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
