/**
 * apps/web/src/components/QuotaBadge.tsx
 *
 * v0.15.0 — NavBar quota badge.
 *   Renders `used / limit` text + colored state:
 *     - gray  when used >= limit
 *     - red   when remaining <= 5
 *     - white otherwise
 *   Polls /api/users/me every 30s; renders nothing when logged out.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMe, type MeResponse } from '../api/billing';

export default function QuotaBadge() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchMe = async () => {
      try {
        const data = await getMe();
        if (!cancelled) setMe(data);
      } catch {
        if (!cancelled) setHidden(true);
      }
    };
    fetchMe();
    const id = setInterval(fetchMe, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (hidden || !me) return null;
  const remaining = me.quota_limit - me.quota_used;
  const exhausted = me.quota_used >= me.quota_limit;
  const low = !exhausted && remaining <= 5;
  const colorClass = exhausted
    ? 'text-gray-400'
    : low
      ? 'text-red-300'
      : 'text-white/80';
  return (
    <Link
      to="/pricing"
      className={`text-sm ${colorClass} hover:text-white transition-colors`}
      aria-label="配额"
    >
      {me.quota_used} / {me.quota_limit}
    </Link>
  );
}