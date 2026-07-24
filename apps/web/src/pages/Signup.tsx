import { useState, FormEvent } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { signup } from '../api/auth';
import { safeRedirect } from '../utils/safeRedirect';

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = safeRedirect(searchParams.get('redirect'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setSubmitting(true);
    try {
      await signup(email, password);
      navigate(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative z-10 max-w-md mx-auto px-6 py-16 text-white">
      <h1
        className="text-4xl md:text-5xl font-bold mb-6 text-center"
        style={{ fontFamily: "'Instrument Serif', serif" }}
      >
        注册
      </h1>
      <p className="text-white/70 text-center mb-8">
        创建账号，开启你的内容预测之旅。
      </p>

      <form className="liquid-glass rounded-2xl p-6 space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label htmlFor="signup-email" className="block text-sm text-white/80">
            邮箱
          </label>
          <input
            id="signup-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-white/40 outline-none focus:border-white/30"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="signup-password" className="block text-sm text-white/80">
            密码
          </label>
          <input
            id="signup-password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-white/40 outline-none focus:border-white/30"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="signup-confirm" className="block text-sm text-white/80">
            确认密码
          </label>
          <input
            id="signup-confirm"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-white/40 outline-none focus:border-white/30"
          />
        </div>

        {error ? (
          <div role="alert" className="text-red-300 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-white text-black rounded-lg px-4 py-2 font-medium hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <UserPlus size={18} aria-hidden="true" />
          {submitting ? '注册中…' : '注册'}
        </button>

        <p className="text-white/70 text-sm text-center">
          已有账号？
          <Link to={`/login?redirect=${encodeURIComponent(redirect)}`} className="underline hover:text-white ml-1">
            登录
          </Link>
        </p>
      </form>
    </div>
  );
}