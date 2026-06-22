import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { LogIn, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import AuthCard from '../components/AuthCard';
import { trpc } from '@/providers/trpc';

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const loginMutation = trpc.localAuth.login.useMutation({
    onSuccess: (data) => {
      // Save token to localStorage for tRPC header auth
      localStorage.setItem('corevest_token', data.token);
      localStorage.setItem('corevest_role', data.user.role);
      // Route based on role
      if (data.user.role === 'admin') {
        window.location.href = '/#/admin';
      } else {
        window.location.href = '/#/home';
      }
    },
    onError: (err) => {
      setError(err.message || 'Giriş başarısız. E-posta veya şifre hatali.');
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    // All users (including admin) login via tRPC
    loginMutation.mutate({ email, password });
  };

  return (
    <AuthCard>
      <div className="mb-6 text-center">
        <div
          className="mx-auto mb-4 grid place-items-center rounded-full"
          style={{
            width: '64px',
            height: '64px',
            background: 'linear-gradient(135deg, #FFD70020, #FFA50020)',
            border: '2px solid rgba(255,215,0,0.2)',
          }}
        >
          <LogIn size={28} style={{ color: '#FFD700' }} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">{t('login.title')}</h1>
        <p className="text-sm" style={{ color: '#8fa5b8' }}>
          {t('login.subtitle')}
        </p>
      </div>

      {error && (
        <div
          className="mb-4 p-3 rounded-xl flex items-center gap-2"
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
          }}
        >
          <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
          <p className="text-xs" style={{ color: '#ef4444' }}>
            {error}
          </p>
        </div>
      )}

      <form onSubmit={handleLogin}>
        <div className="mb-4">
          <label className="label-text block mb-2">{t('login.email')}</label>
          <div className="relative">
            <Mail
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2"
              style={{ color: '#FFD700' }}
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('login.emailPlaceholder')}
              className="glass-input pl-10"
              style={{ minHeight: '46px' }}
              required
            />
          </div>
        </div>

        <div className="mb-5">
          <label className="label-text block mb-2">{t('login.password')}</label>
          <div className="relative">
            <Lock
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2"
              style={{ color: '#FFD700' }}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('login.passwordPlaceholder')}
              className="glass-input pl-10"
              style={{ minHeight: '46px' }}
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn-primary mb-4 w-full"
          disabled={loginMutation.isPending}
          style={{ opacity: loginMutation.isPending ? 0.6 : 1 }}
        >
          {loginMutation.isPending ? (
            'Giriş Yapiliyor...'
          ) : (
            <>
              <ArrowRight size={18} />
              {t('login.loginButton')}
            </>
          )}
        </button>
      </form>

      <p className="text-center text-sm" style={{ color: '#8fa5b8' }}>
        {t('login.noAccount')}{' '}
        <button
          type="button"
          onClick={() => navigate('/register')}
          className="font-semibold underline-offset-2 hover:underline"
          style={{
            color: '#FFD700',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {t('login.registerLink')}
        </button>
      </p>
    </AuthCard>
  );
}
