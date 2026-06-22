import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Link2, Shield, RefreshCw, UserPlus } from 'lucide-react';
import AuthCard from '../components/AuthCard';
import { initUser } from '../store';

function generateSecurityCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityCode, setSecurityCode] = useState(generateSecurityCode);
  const [enteredCode, setEnteredCode] = useState('');

  const refreshCode = useCallback(() => {
    setSecurityCode(generateSecurityCode());
    setEnteredCode('');
  }, []);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();

    if (enteredCode.toUpperCase() !== securityCode) {
      alert(t('register.securityCode') + ' hatalı!');
      return;
    }
    if (password !== confirmPassword) {
      alert('Şifreler eşleşmiyor!');
      return;
    }
    if (email.toLowerCase() === 'admin@corevest.com') {
      navigate('/admin');
      return;
    }

    // Create new user: VIP 0, $5 balance
    initUser(email, referralCode || undefined);
    navigate('/home');
  };

  return (
    <AuthCard>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-white mb-1">{t('register.title')}</h1>
        <p className="text-sm" style={{ color: '#8fa5b8' }}>{t('register.subtitle')}</p>
      </div>

      <form onSubmit={handleRegister}>
        {/* Email */}
        <div className="mb-3">
          <label className="label-text block mb-2">{t('register.email')}</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#FFD700' }} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('register.emailPlaceholder')}
              className="glass-input pl-10"
              style={{ minHeight: '46px' }}
              required
            />
          </div>
        </div>

        {/* Referral Code - optional */}
        <div className="mb-3">
          <label className="label-text block mb-2">
            {t('register.referralCode')}
            <span className="ml-1 font-normal" style={{ color: '#5a6a7a' }}>(opsiyonel)</span>
          </label>
          <div className="relative">
            <Link2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#FFD700' }} />
            <input
              type="text"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              placeholder="CVXXXXX"
              className="glass-input pl-10"
              style={{ minHeight: '46px' }}
            />
          </div>
        </div>

        {/* Password */}
        <div className="mb-3">
          <label className="label-text block mb-2">{t('register.password')}</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#FFD700' }} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="glass-input pl-10"
              style={{ minHeight: '46px' }}
              required
            />
          </div>
        </div>

        {/* Confirm Password */}
        <div className="mb-4">
          <label className="label-text block mb-2">{t('register.confirmPassword')}</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#FFD700' }} />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="glass-input pl-10"
              style={{ minHeight: '46px' }}
              required
            />
          </div>
        </div>

        {/* Security Code */}
        <div className="mb-5" style={{
          background: 'rgba(255,215,0,0.04)',
          border: '1px dashed rgba(255,215,0,0.2)',
          borderRadius: '16px',
          padding: '14px',
        }}>
          <div className="flex items-center gap-2 mb-3">
            <Shield size={14} style={{ color: '#FFD700' }} />
            <span className="text-xs font-bold" style={{ color: '#FFD700' }}>{t('register.securityCode')}</span>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <div
              className="flex-1 text-center font-extrabold text-lg tracking-[0.2em]"
              style={{
                background: 'rgba(255,215,0,0.08)',
                border: '1px dashed rgba(255,215,0,0.25)',
                borderRadius: '12px',
                padding: '10px',
                color: '#FFD700',
              }}
            >
              {securityCode}
            </div>
            <button
              type="button"
              onClick={refreshCode}
              className="btn-secondary"
              style={{ minHeight: '46px', width: '46px', padding: 0 }}
              title={t('register.refreshCode')}
            >
              <RefreshCw size={16} />
            </button>
          </div>

          <label className="label-text block mb-2">{t('register.enterCode')}</label>
          <input
            type="text"
            value={enteredCode}
            onChange={(e) => setEnteredCode(e.target.value.toUpperCase())}
            className="glass-input text-center font-bold tracking-[0.15em]"
            style={{ minHeight: '46px', fontSize: '1.1rem' }}
            maxLength={6}
            required
          />
        </div>

        <button type="submit" className="btn-primary mb-4">
          <UserPlus size={18} />
          {t('register.registerButton')}
        </button>

        <p className="text-center text-sm" style={{ color: '#8fa5b8' }}>
          {t('register.hasAccount')}{' '}
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="font-semibold underline-offset-2 hover:underline"
            style={{ color: '#FFD700', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {t('register.loginLink')}
          </button>
        </p>
      </form>
    </AuthCard>
  );
}
