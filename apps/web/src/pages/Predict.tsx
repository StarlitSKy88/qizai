import { useState, FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Sparkles, AlertCircle } from 'lucide-react';
import { apiFetch, consumeSse } from '../api/client';

export default function Predict() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTitle = searchParams.get('title') ?? '';
  const [title, setTitle] = useState(initialTitle);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim() || submitting) return;

    // Defensive auth gate: a logged-out user can still hit /predict via
    // the marketing nav. Bounce them to /login with a deep-link return
    // before we burn a quota slot.
    if (!localStorage.getItem('qizai_jwt')) {
      navigate('/login?redirect=/predict');
      return;
    }

    setErrorMessage(null);
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/predict/stream', {
        method: 'POST',
        body: JSON.stringify({
          content: { title },
          platforms: ['xhs', 'tiktok', 'bilibili'],
        }),
      });
      if (!res.ok) {
        // H3: parse the server's code and branch on it. The pre-charge
        // (C2) and cancel-handler (H2) mean these are now distinct UX
        // paths — 402 needs the upgrade CTA, 401 needs the login bounce,
        // 400 CONTENT_TOO_LONG shows the length warning.
        let errBody: { code?: string; message?: string } = {};
        try {
          errBody = (await res.json()) as { code?: string; message?: string };
        } catch {
          // Body was not JSON; fall through to generic branch.
        }
        const code = errBody.code;
        const message = errBody.message;
        if (code === 'QUOTA_EXHAUSTED') {
          setErrorMessage(`${message ?? '本月配额已用完'} → 升级 ¥29 套餐`);
        } else if (code === 'AUTH_REQUIRED' || code === 'AUTH_FAILED') {
          navigate('/login?redirect=/predict');
          return;
        } else if (code === 'CONTENT_TOO_LONG' || code === 'INVALID_INPUT') {
          setErrorMessage(message ?? '请求内容有误');
        } else if (code === 'DB_NOT_CONFIGURED') {
          setErrorMessage('服务暂未就绪，请稍后重试');
        } else {
          setErrorMessage(message ?? `请求失败 (HTTP ${res.status})`);
        }
        return;
      }
      if (!res.body) {
        setErrorMessage('请求失败，请稍后重试');
        return;
      }
      const reader = res.body.getReader();
      await consumeSse(reader, (event) => {
        if (event.type === 'error') {
          // Server-side LLM providers all failed; surface the message so
          // the user sees a clear reason instead of a silent return.
          // Cast to { message?: string } since SSE `data` is typed as any.
          const msg =
            (event.data && typeof event.data === 'object' && (event.data as { message?: string }).message) ||
            'AI 临时不可用，请稍后重试';
          setErrorMessage(msg);
        } else if (event.type === 'complete' && event.data?.report_id) {
          navigate(`/report/${event.data.report_id}`);
        }
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative z-10 max-w-4xl mx-auto px-6 py-16 text-white">
      <h1
        className="text-5xl md:text-6xl font-bold mb-6 text-center"
        style={{ fontFamily: "'Instrument Serif', serif" }}
      >
        预测你的内容会爆吗？
      </h1>
      <p className="text-white/80 text-lg text-center mb-12 leading-relaxed">
        粘贴标题、简介或正文，让 1000 个 persona 帮你投票决定要不要发布。 小红书 / 抖音 / B站 一键预测，给你可执行的发布建议。
      </p>

      {errorMessage && (
        <div
          role="alert"
          className="max-w-xl mx-auto mb-6 liquid-glass rounded-2xl p-4 flex items-start gap-3 border border-red-400/40"
        >
          <AlertCircle size={20} className="text-red-300 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-white/90 text-sm leading-relaxed">{errorMessage}</p>
        </div>
      )}

      <form className="max-w-xl mx-auto mb-16" onSubmit={handleSubmit}>
        <div className="liquid-glass rounded-full pl-6 pr-2 py-2 flex items-center gap-3">
          <label htmlFor="predict-title" className="sr-only">
            内容标题或正文
          </label>
          <input
            id="predict-title"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="输入你的内容标题"
            className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/40 text-base py-1"
          />
          <button
            type="submit"
            disabled={submitting}
            className="bg-white rounded-full p-3 text-black hover:bg-white/90 transition-colors disabled:opacity-50"
          >
            <ArrowRight size={20} />
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="liquid-glass rounded-2xl p-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/10 mb-4">
            <Sparkles size={24} className="text-white" aria-hidden="true" />
          </div>
          <h3 className="text-xl font-semibold mb-2">几分钟拿到投票</h3>
          <p className="text-white/70 text-sm leading-relaxed">
            1000 个 persona 并行投票，不打扰你写稿
          </p>
        </div>

        <div className="liquid-glass rounded-2xl p-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/10 mb-4">
            <Sparkles size={24} className="text-white" aria-hidden="true" />
          </div>
          <h3 className="text-xl font-semibold mb-2">3 平台同测</h3>
          <p className="text-white/70 text-sm leading-relaxed">
            小红书 / 抖音 / B站 一键同跑，对比预测流量
          </p>
        </div>

        <div className="liquid-glass rounded-2xl p-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/10 mb-4">
            <Sparkles size={24} className="text-white" aria-hidden="true" />
          </div>
          <h3 className="text-xl font-semibold mb-2">可解释报告</h3>
          <p className="text-white/70 text-sm leading-relaxed">
            每个预测附「为什么爆 / 为什么凉」决策依据
          </p>
        </div>
      </div>
    </div>
  );
}