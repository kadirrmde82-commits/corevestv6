import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import AuthCard from '../components/AuthCard';
import { getUser, initUser, seedAdminDemoData } from '../store';

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    // Admin login
    if (email.toLowerCase() === 'admin@corevest.com' && password === '159753852qwe') {
      seedAdminDemoData();
      sessionStorage.setItem('corevest_admin', 'true');
      navigate('/admin');
      return;
    }

    // Demo kullanıcıları yalnızca bu tarayıcıda saklanır.
    const user = getUser();
    if (!user || user.email.toLowerCase() !== email.toLowerCase()) initUser(email);
    navigate('/home');
  };

  return (
    <AuthCard>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-white mb-1">{t('login.title')}</h1>
        <p className="text-sm" style={{ color: '#8fa5b8' }}>{t('login.subtitle')}</p>
      </div>

      <form onSubmit={handleLogin}>
        <div className="mb-4">
          <label className="label-text block mb-2">{t('login.email')}</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#FFD700' }} />
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
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#FFD700' }} />
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

        <button type="submit" className="btn-primary mb-4">
          <ArrowRight size={18} />
          {t('login.loginButton')}
        </button>

        <p className="text-center text-sm" style={{ color: '#8fa5b8' }}>
          {t('login.noAccount')}{' '}
          <button
            type="button"
            onClick={() => navigate('/register')}
            className="font-semibold underline-offset-2 hover:underline"
            style={{ color: '#FFD700', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {t('login.registerLink')}
          </button>
        </p>
      </form>
    </AuthCard>
  );
}
