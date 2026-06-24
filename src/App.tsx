import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Routes, Route } from 'react-router-dom';
import { trpc } from '@/providers/trpc';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Home = lazy(() => import('./pages/Home'));
const Quantify = lazy(() => import('./pages/Quantify'));
const Referral = lazy(() => import('./pages/Referral'));
const Account = lazy(() => import('./pages/Account'));
const Admin = lazy(() => import('./pages/Admin'));
const FAQ = lazy(() => import('./pages/FAQ'));

function PageLoader() {
  return (
    <div className="page-bg min-h-screen grid place-items-center px-4">
      <div className="glass-card text-center max-w-xs">
        <div className="mx-auto mb-3 rounded-full animate-pulse" style={{ width: 42, height: 42, background: 'rgba(255,215,0,0.16)' }} />
        <p className="text-sm font-bold text-white">Yükleniyor...</p>
      </div>
    </div>
  );
}

function UserRoute({ children }: { children: ReactNode }) {
  return localStorage.getItem('corevest_token')
    ? children
    : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: ReactNode }) {
  return localStorage.getItem('corevest_token') && localStorage.getItem('corevest_role') === 'admin'
    ? children
    : <Navigate to="/login" replace />;
}

export default function App() {
  const isAdmin = localStorage.getItem('corevest_role') === 'admin';
  const { data: maintenance } = trpc.adminSystem.publicMaintenance.useQuery(undefined, {
    refetchInterval: 30000,
    retry: false,
  });

  if (maintenance?.enabled && !isAdmin) {
    return (
      <div className="page-bg min-h-screen grid place-items-center px-4">
        <div className="glass-card text-center max-w-md">
          <h1 className="text-2xl font-bold text-white mb-2">Bakım Modu</h1>
          <p className="text-sm" style={{ color: '#8fa5b8' }}>
            Corevest kısa süreli bakımda. Lütfen biraz sonra tekrar deneyin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/home" element={<UserRoute><Home /></UserRoute>} />
        <Route path="/quantify" element={<UserRoute><Quantify /></UserRoute>} />
        <Route path="/referral" element={<UserRoute><Referral /></UserRoute>} />
        <Route path="/faq" element={<UserRoute><FAQ /></UserRoute>} />
        <Route path="/account" element={<UserRoute><Account /></UserRoute>} />
        <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
