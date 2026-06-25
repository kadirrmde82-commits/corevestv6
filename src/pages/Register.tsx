import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Mail,
  Lock,
  Link2,
  Shield,
  RefreshCw,
  ArrowRight,
  AlertCircle,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react';
import AuthCard from '../components/AuthCard';
import { trpc } from '@/providers/trpc';

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
  const [searchParams] = useSearchParams();

  // Pre-fill referral code from URL (?ref=CVXXXX)
  const refFromUrl = searchParams.get('ref') || '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [referralCode, setReferralCode] = useState(refFromUrl);
  const [securityCode, setSecurityCode] = useState(generateSecurityCode);
  const [enteredCode, setEnteredCode] = useState('');
  const [error, setError] = useState('');

  const refreshCode = useCallback(() => {
    setSecurityCode(generateSecurityCode());
    setEnteredCode('');
  }, []);

  const registerMutation = trpc.localAuth.register.useMutation({
    onSuccess: (data) => {
      // Save token
      localStorage.setItem('corevest_token', data.token);
      localStorage.setItem('corevest_role', 'user');
      // Save referral code if provided (for Home.tsx to process)
      if (referralCode) {
        localStorage.setItem('corevest_ref_by', referralCode.toUpperCase());
      }
      // Refresh page to apply auth state
      window.location.href = '/#/home';
    },
    onError: (err) => {
      setError(err.message || 'Kayıt başarısız. Lutfen tekrar deneyin.');
    },
  });

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (enteredCode.toUpperCase() !== securityCode) {
      setError(t('register.invalidSecurityCode') || 'Güvenlik kodu hatalı!');
      return;
    }
    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor!');
      return;
    }
    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.');
      return;
    }

    registerMutation.mutate({
      email,
      password,
      name: email.split('@')[0],
    });
  };

  return (
    <AuthCard>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-white mb-1">
          {t('register.title')}
        </h1>
        <p className="text-sm" style={{ color: '#8fa5b8' }}>
          {t('register.subtitle')}
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

      {registerMutation.isSuccess && (
        <div
          className="mb-4 p-3 rounded-xl flex items-center gap-2"
          style={{
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.2)',
          }}
        >
          <Check size={16} style={{ color: '#10b981', flexShrink: 0 }} />
          <p className="text-xs" style={{ color: '#10b981' }}>
            Kayıt başarılı! Yönlendiriliyorsunuz...
          </p>
        </div>
      )}

      <form onSubmit={handleRegister}>
        {/* Email */}
        <div className="mb-3">
          <label className="label-text block mb-2">{t('register.email')}</label>
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
            <span className="ml-1 font-normal" style={{ color: '#5a6a7a' }}>
              (opsiyonel)
            </span>
          </label>
          <div className="relative">
            <Link2
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2"
              style={{ color: '#FFD700' }}
            />
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
          <label className="label-text block mb-2">
            {t('register.password')}
          </label>
          <div className="relative">
            <Lock
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2"
              style={{ color: '#FFD700' }}
            />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="En az 6 karakter"
              className="glass-input pl-10 pr-11"
              style={{ minHeight: '46px' }}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 grid place-items-center"
              style={{ width: '30px', height: '30px', color: '#8fa5b8' }}
              aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div className="mb-4">
          <label className="label-text block mb-2">
            {t('register.confirmPassword')}
          </label>
          <div className="relative">
            <Lock
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2"
              style={{ color: '#FFD700' }}
            />
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Şifreyi tekrar girin"
              className="glass-input pl-10 pr-11"
              style={{ minHeight: '46px' }}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 grid place-items-center"
              style={{ width: '30px', height: '30px', color: '#8fa5b8' }}
              aria-label={showConfirmPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
            >
              {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        {/* Security Code */}
        <div
          className="mb-5"
          style={{
            background: 'rgba(255,215,0,0.04)',
            border: '1px dashed rgba(255,215,0,0.2)',
            borderRadius: '16px',
            padding: '14px',
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Shield size={14} style={{ color: '#FFD700' }} />
            <span className="text-xs font-bold" style={{ color: '#FFD700' }}>
              {t('register.securityCode')}
            </span>
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

          <label className="label-text block mb-2">
            {t('register.enterCode')}
          </label>
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

        <button
          type="submit"
          className="btn-primary mb-4 w-full"
          disabled={registerMutation.isPending}
          style={{ opacity: registerMutation.isPending ? 0.6 : 1 }}
        >
          {registerMutation.isPending ? (
            'Kayıt Yapılıyor...'
          ) : (
            <>
              <ArrowRight size={18} />
              {t('register.registerButton')}
            </>
          )}
        </button>
      </form>

      <p className="text-center text-sm" style={{ color: '#8fa5b8' }}>
        {t('register.hasAccount')}{' '}
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="font-semibold underline-offset-2 hover:underline"
          style={{
            color: '#FFD700',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {t('register.loginLink')}
        </button>
      </p>
    </AuthCard>
  );
}
