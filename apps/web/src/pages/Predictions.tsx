/**
 * apps/web/src/pages/Predictions.tsx
 *
 * History list at `/predictions`. Renders the current user's last 50
 * reports as click-through cards linking to /report/:id. The API caps the
 * list at 50 server-side (apps/api/src/routes/report.ts), so we just
 * iterate the response 1:1.
 *
 * 401 → bounce to /login. The server returns 401 when the JWT in
 * localStorage is missing/expired, so this is also the path for an
 * already-logged-in user whose token quietly expired.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { History, ChevronRight, FileText } from 'lucide-react';
import { listReports, type ReportSummary } from '../api/predictions';

function statusLabel(status: string): string {
  switch (status) {
    case 'done':
      return '已完成';
    case 'streaming':
      return '生成中';
    case 'error':
      return '生成失败';
    default:
      return status;
  }
}

function formatTime(epochSeconds: number): string {
  // Render in local time as YYYY-MM-DD HH:mm. The server returns
  // created_at / completed_at as Unix-seconds (D1 INTEGER convention),
  // so we multiply by 1000 to feed Date.
  const d = new Date(epochSeconds * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Predictions() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<ReportSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listReports()
      .then((list) => {
        if (cancelled) return;
        setReports(list);
      })
      .catch((err: { status?: number }) => {
        if (cancelled) return;
        if (err?.status === 401) {
          // Defensive redirect — the server rejected the JWT, so the
          // user is effectively logged out. Send them to /login and let
          // them come back to /predictions after re-auth.
          navigate('/login?redirect=/predictions');
          return;
        }
        setError('加载失败，请稍后重试');
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-16 text-white">
        <h1
          className="text-4xl md:text-5xl font-bold mb-6"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          历史预测
        </h1>
        <p className="text-white/70">{error}</p>
      </div>
    );
  }

  if (reports === null) {
    return (
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-16 text-white">
        <p className="text-white/60">加载中…</p>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-16 text-white">
        <h1
          className="text-4xl md:text-5xl font-bold mb-6"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          历史预测
        </h1>
        <div className="liquid-glass rounded-2xl p-8 text-center">
          <History size={32} className="mx-auto mb-3 text-white/60" aria-hidden="true" />
          <p className="text-white/70 mb-6">还没有任何预测报告</p>
          <Link
            to="/predict"
            className="inline-block bg-white text-black rounded-full px-6 py-2 font-medium hover:bg-white/90 transition-colors"
          >
            发起一次预测
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 max-w-4xl mx-auto px-6 py-16 text-white">
      <h1
        className="text-4xl md:text-5xl font-bold mb-2"
        style={{ fontFamily: "'Instrument Serif', serif" }}
      >
        历史预测
      </h1>
      <p className="text-white/60 mb-10">最近 {reports.length} 条预测</p>
      <ul className="space-y-3">
        {reports.map((r) => (
          <li key={r.id}>
            <Link
              to={`/report/${r.id}`}
              className="liquid-glass rounded-2xl p-5 flex items-center gap-4 hover:bg-white/5 transition-colors block"
            >
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/10 shrink-0">
                <FileText size={20} className="text-white/80" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-base font-medium truncate">{r.title}</div>
                <div className="text-white/50 text-xs mt-1 flex items-center gap-3">
                  <span>{statusLabel(r.status)}</span>
                  <span>{formatTime(r.created_at)}</span>
                </div>
              </div>
              <ChevronRight size={18} className="text-white/40 shrink-0" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
