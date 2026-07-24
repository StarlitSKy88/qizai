/**
 * apps/web/src/pages/Report.tsx
 *
 * Single-report view at `/report/:id`. Renders the decision + evidence pack
 * returned by `GET /api/report/:id`. The SSE stream on /predict lands the
 * user here via `navigate(\`/report/${report_id}\`)` once `complete` fires.
 *
 * Status mapping (mirrors apps/api/src/utils/stream-predictor.ts):
 *   - done       → "已完成"
 *   - streaming  → "生成中"
 *   - error      → "生成失败"
 *   - anything else → 返回的原始 status
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle2, Loader2, AlertCircle, FileText } from 'lucide-react';
import { getReport, type ReportDetail } from '../api/predictions';

function statusLabel(status: string): { label: string; className: string } {
  switch (status) {
    case 'done':
      return { label: '已完成', className: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30' };
    case 'streaming':
      return { label: '生成中', className: 'bg-amber-500/20 text-amber-100 border-amber-400/30' };
    case 'error':
      return { label: '生成失败', className: 'bg-rose-500/20 text-rose-100 border-rose-400/30' };
    default:
      return { label: status, className: 'bg-white/10 text-white/80 border-white/20' };
  }
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'done') return <CheckCircle2 size={16} aria-hidden="true" />;
  if (status === 'streaming') return <Loader2 size={16} className="animate-spin" aria-hidden="true" />;
  if (status === 'error') return <AlertCircle size={16} aria-hidden="true" />;
  return null;
}

function decisionText(report: unknown): string | null {
  if (!report || typeof report !== 'object') return null;
  const r = report as { decision?: unknown };
  if (typeof r.decision === 'string' && r.decision.length > 0) return r.decision;
  return null;
}

function evidenceItems(evidence: unknown): Array<{ label: string; value: string }> {
  if (!evidence || typeof evidence !== 'object') return [];
  const e = evidence as Record<string, unknown>;
  const out: Array<{ label: string; value: string }> = [];
  for (const [k, v] of Object.entries(e)) {
    if (typeof v === 'string') {
      out.push({ label: k, value: v });
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      out.push({ label: k, value: String(v) });
    } else if (Array.isArray(v)) {
      out.push({ label: k, value: v.map((x) => String(x)).join('、') });
    } else if (v && typeof v === 'object') {
      out.push({ label: k, value: JSON.stringify(v) });
    }
  }
  return out;
}

export default function Report() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!id) {
      setLoading(false);
      setNotFound(true);
      return () => {
        cancelled = true;
      };
    }
    setLoading(true);
    setNotFound(false);
    setErrorMessage(null);
    getReport(id)
      .then((d) => {
        if (cancelled) return;
        setData(d);
      })
      .catch((err: { status?: number }) => {
        if (cancelled) return;
        // H4: branch on status instead of treating every non-404 the same.
        // 401 → login bounce. 403 + 404 → "报告不存在" (the user does not
        // own this report; show the same not-found UX for parity). 500+
        // → a recoverable error message so the page does not sit on
        // "加载中…" forever.
        if (err?.status === 401) {
          navigate('/login?redirect=/report/' + id);
          return;
        }
        if (err?.status === 403 || err?.status === 404) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setErrorMessage(`加载失败 (HTTP ${err?.status ?? '网络异常'})`);
        setLoading(false);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (notFound) {
    return (
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-16 text-white">
        <h1
          className="text-4xl md:text-5xl font-bold mb-6"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          报告不存在
        </h1>
        <p className="text-white/70 leading-relaxed mb-8">
          这份报告可能已过期、属于其他用户，或链接拼写有误。
        </p>
        <Link
          to="/predictions"
          className="inline-block liquid-glass rounded-full px-6 py-2 text-white/90 hover:text-white"
        >
          返回历史记录
        </Link>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-16 text-white">
        {errorMessage ? (
          <div
            role="alert"
            className="liquid-glass rounded-2xl p-6 border border-red-400/40 flex items-start gap-3 max-w-xl mx-auto"
          >
            <AlertCircle
              size={20}
              className="text-red-300 flex-shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="flex-1">
              <p className="text-white/90 text-sm leading-relaxed mb-3">{errorMessage}</p>
              <Link
                to="/predictions"
                className="text-sm text-white/80 hover:text-white underline"
              >
                返回历史记录
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-white/60">加载中…</p>
        )}
      </div>
    );
  }

  const badge = statusLabel(data.status);
  const decision = decisionText(data.report);
  const evidence = evidenceItems(data.evidence);

  return (
    <div className="relative z-10 max-w-4xl mx-auto px-6 py-16 text-white">
      <h1
        className="text-4xl md:text-5xl font-bold mb-4"
        style={{ fontFamily: "'Instrument Serif', serif" }}
      >
        {data.title}
      </h1>
      <div
        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm ${badge.className}`}
      >
        <StatusIcon status={data.status} />
        <span>{badge.label}</span>
      </div>

      <section className="liquid-glass rounded-2xl p-6 mt-10">
        <div className="flex items-center gap-2 mb-3">
          <FileText size={18} className="text-white/80" aria-hidden="true" />
          <h2 className="text-xl font-semibold">决策结论</h2>
        </div>
        {decision ? (
          <p className="text-white/85 leading-relaxed whitespace-pre-wrap">{decision}</p>
        ) : (
          <p className="text-white/50 text-sm">暂无结论，报告可能仍在生成。</p>
        )}
      </section>

      {evidence.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold mb-4">证据包</h2>
          <ul className="space-y-3">
            {evidence.map((item) => (
              <li
                key={item.label}
                className="liquid-glass rounded-xl p-4 flex flex-col gap-1"
              >
                <span className="text-white/60 text-xs uppercase tracking-wide">
                  {item.label}
                </span>
                <span className="text-white/90 text-sm break-words">{item.value}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
