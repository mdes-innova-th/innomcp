'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faLock, faEye, faEyeSlash, faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { notify } = useToast();

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [capsLock, setCapsLock] = useState(false);

  // Detect Caps Lock on keypress in the password field. Pure event-based;
  // doesn't fire if the user enables Caps Lock without typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typeof e.getModifierState !== 'function') return;
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' && (target as HTMLInputElement).type === 'password') {
        setCapsLock(e.getModifierState('CapsLock'));
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  }, []);

  // Friendly Thai error messages keyed by backend error string.
  const localizeError = (raw: string): string => {
    const m = raw.toLowerCase();
    if (m.includes('invalid') || m.includes('credentials')) return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
    if (m.includes('locked') || m.includes('disabled')) return 'บัญชีถูกล็อก กรุณาติดต่อผู้ดูแลระบบ';
    if (m.includes('rate') || m.includes('too many')) return 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่';
    if (m.includes('network') || m.includes('fetch') || m.includes('failed to')) {
      return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบเครือข่ายหรือลองใหม่อีกครั้ง';
    }
    return raw || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const backendHost = process.env.NEXT_PUBLIC_NODE_HOST || 'http://localhost:3015';
      const response = await fetch(`${backendHost}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
        credentials: 'include' // Important for cookies
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Update auth context
      await login(data.data);

      notify('ยินดีต้อนรับกลับ — เข้าสู่ระบบสำเร็จ', 'success', 2500);
      router.push('/');
    } catch (err) {
      const friendly = localizeError(err instanceof Error ? err.message : String(err));
      setError(friendly);
    } finally {
      setLoading(false);
    }
  };

  const handleThaiIdLogin = () => {
    // TODO: Implement Thai ID OAuth flow
    notify('การเข้าสู่ระบบด้วย Thai ID จะเปิดให้ใช้ในเร็วๆ นี้', 'info', 3500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Logo & Title */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-white text-2xl font-bold">IM</span>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            ยินดีต้อนรับกลับ
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            เข้าสู่ระบบเพื่อเริ่มใช้งาน InnoMCP
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Test Credentials Hint — dev/test only, never render in production */}
            {process.env.NODE_ENV !== "production" && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
                  🔑 Test Credentials
                </p>
                <div className="space-y-1 text-xs text-blue-700 dark:text-blue-400 font-mono">
                  <p><strong>Admin:</strong> admin@example.local / &lt;REDACTED_PASSWORD&gt;</p>
                  <p><strong>User:</strong> user@example.local / &lt;REDACTED_PASSWORD&gt;</p>
                  <p><strong>Officer:</strong> officer@example.local / &lt;REDACTED_PASSWORD&gt;</p>
                </div>
              </div>
            )}

            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                อีเมล
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FontAwesomeIcon icon={faEnvelope} className="text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           placeholder-gray-400 dark:placeholder-gray-500
                           focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                           transition-colors"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                รหัสผ่าน
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FontAwesomeIcon icon={faLock} className="text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="block w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           placeholder-gray-400 dark:placeholder-gray-500
                           focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                           transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                </button>
              </div>
              {capsLock && (
                <p
                  data-testid="capslock-warning"
                  className="mt-1.5 flex items-center gap-1.5 text-[12px] text-amber-600 dark:text-amber-300"
                >
                  <span aria-hidden="true">⇪</span>
                  <span>Caps Lock เปิดอยู่</span>
                </p>
              )}
            </div>

            {/* Forgot Password Link */}
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <Link
                  href="/forgot-password"
                  className="font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  ลืมรหัสผ่าน?
                </Link>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              data-testid="login-submit-btn"
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg
                       text-white font-medium bg-gradient-to-r from-primary to-secondary
                       hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary
                       disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              {loading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                  กำลังเข้าสู่ระบบ…
                </>
              ) : (
                'เข้าสู่ระบบ'
              )}
            </button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">หรือเข้าสู่ระบบด้วย</span>
              </div>
            </div>

            {/* Thai ID Login Button */}
            <button
              type="button"
              onClick={handleThaiIdLogin}
              className="w-full flex justify-center items-center py-3 px-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                       text-gray-700 dark:text-gray-300 font-medium bg-white dark:bg-gray-700
                       hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
              </svg>
              เข้าสู่ระบบด้วย Thai ID
            </button>
          </form>

          {/* Sign Up Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              ยังไม่มีบัญชี?{' '}
              <Link
                href="/register"
                className="font-medium text-primary hover:text-primary/80 transition-colors"
              >
                สมัครสมาชิก
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
