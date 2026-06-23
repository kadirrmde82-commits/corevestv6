import { Navigate, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Quantify from './pages/Quantify';
import Referral from './pages/Referral';
import Account from './pages/Account';
import Admin from './pages/Admin';
import FAQ from './pages/FAQ';
import { trpc } from '@/providers/trpc';

function UserRoute({ children }: { children: React.ReactNode }) {
  return localStorage.getItem('corevest_token')
    ? children
    : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
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
  );
}
