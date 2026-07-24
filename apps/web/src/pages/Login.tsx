import { useState, FormEvent } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { login } from '../api/auth';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/predict';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
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
        登录
      </h1>
      <p className="text-white/70 text-center mb-8">
        登录后即可预测你的内容会爆吗？
      </p>

      <form className="liquid-glass rounded-2xl p-6 space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label htmlFor="login-email" className="block text-sm text-white/80">
            邮箱
          </label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-white/40 outline-none focus:border-white/30"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="login-password" className="block text-sm text-white/80">
            密码
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
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
          <LogIn size={18} aria-hidden="true" />
          {submitting ? '登录中…' : '登录'}
        </button>

        <p className="text-white/70 text-sm text-center">
          没有账号？
          <Link to="/signup" className="underline hover:text-white ml-1">
            注册
          </Link>
        </p>
      </form>
    </div>
  );
}