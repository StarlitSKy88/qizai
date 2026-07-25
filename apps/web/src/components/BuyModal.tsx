/**
 * apps/web/src/components/BuyModal.tsx
 *
 * v0.15.0 — inline buy modal triggered from Predict.tsx when quota exhausted.
 *   Two tabs: 订阅 (personal_sub ¥29 / team_sub ¥299) + 加量包 (topup_100 ¥9.9)
 *   Click plan → POST /api/checkout/create → render QR + 5s polling + countdown.
 */
import { useEffect, useState } from 'react';
import { X, Smartphone } from 'lucide-react';
import {
  createCheckout,
  pollOrderStatus,
  type CheckoutPlan,
  type CheckoutResponse,
} from '../api/billing';

interface BuyModalProps {
  onClose: () => void;
}

interface Plan {
  plan: CheckoutPlan;
  price: string;
  label: string;
  tab: 'subscription' | 'topup';
}

const PLANS: Plan[] = [
  { plan: 'personal_sub', price: '¥29', label: '个人创作者 / 月', tab: 'subscription' },
  { plan: 'team_sub', price: '¥299', label: '团队 / 月', tab: 'subscription' },
  { plan: 'topup_100', price: '¥9.9', label: '100 次预测', tab: 'topup' },
];

export default function BuyModal({ onClose }: BuyModalProps) {
  const [tab, setTab] = useState<'subscription' | 'topup'>('subscription');
  const [qr, setQr] = useState<CheckoutResponse | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  // Tracks non-pending terminal states so the modal can render a recovery
  // panel instead of leaving the user staring at an expired QR. Set when
  // the polling effect bails on a 'closed' / 'refunded' response or when
  // the local countdown reaches zero without a 'paid' callback.
  const [closedState, setClosedState] = useState<null | 'expired' | 'closed' | 'refunded'>(null);

  // Poll order status every 5s; close on paid.
  useEffect(() => {
    if (!qr) return;
    const interval = setInterval(async () => {
      // Stop polling once the local countdown is up — the server has
      // auto-closed (or is about to) and we shouldn't keep hammering it.
      if (Math.floor(Date.now() / 1000) >= qr.expiresAt) {
        clearInterval(interval);
        setClosedState('expired');
        return;
      }
      try {
        const status = await pollOrderStatus(qr.orderId);
        if (status.status === 'paid') {
          clearInterval(interval);
          onClose();
        } else if (status.status === 'closed') {
          clearInterval(interval);
          setClosedState('closed');
        } else if (status.status === 'refunded') {
          clearInterval(interval);
          setClosedState('refunded');
        }
        // 'pending' keeps polling
      } catch {
        // network blip — keep trying
      }
    }, 5_000);
    return () => clearInterval(interval);
  }, [qr, onClose]);

  // Countdown ticks once per second
  useEffect(() => {
    if (!qr) return;
    const id = setInterval(() => {
      const remaining = qr.expiresAt - Math.floor(Date.now() / 1000);
      setCountdown(Math.max(0, remaining));
      if (remaining <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [qr]);

  const handleSelectPlan = async (plan: CheckoutPlan) => {
    setError(null);
    setClosedState(null);
    try {
      const res = await createCheckout(plan);
      setQr(res);
      setCountdown(res.expiresAt - Math.floor(Date.now() / 1000));
    } catch (err) {
      setError('网络异常，请稍后重试');
    }
  };

  // After a closed/expired/refunded order, let the user re-select a plan
  // without leaving the modal. Resets local order state so handleSelectPlan
  // can mint a fresh order from the same plan picker.
  const handleReselect = () => {
    setQr(null);
    setClosedState(null);
    setCountdown(0);
    setError(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-label="购买套餐"
    >
      <div className="liquid-glass rounded-2xl p-8 max-w-md w-full relative">
        <button
          onClick={onClose}
          aria-label="关闭"
          className="absolute top-4 right-4 text-white/70 hover:text-white"
        >
          <X size={20} />
        </button>
        <h2 className="text-2xl font-bold mb-6 text-white">升级套餐</h2>

        {qr && closedState ? (
          <div className="flex flex-col items-center gap-4" role="status">
            <div className="w-48 h-48 bg-white/10 rounded-lg flex items-center justify-center text-white/70 text-sm">
              {closedState === 'expired' && '订单已超时'}
              {closedState === 'closed' && '订单已关闭'}
              {closedState === 'refunded' && '订单已退款'}
            </div>
            <p className="text-sm text-white/70 text-center">
              请重新选择套餐，生成新的支付订单
            </p>
            <button
              onClick={handleReselect}
              className="w-full bg-white text-black rounded-xl py-3 font-medium hover:bg-white/90 transition-colors"
            >
              重新选择套餐
            </button>
          </div>
        ) : qr ? (
          <div className="flex flex-col items-center gap-4">
            {qr.qrCodeBase64.startsWith('data:image') ? (
              <img src={qr.qrCodeBase64} alt="微信支付二维码" className="w-48 h-48 bg-white rounded-lg" />
            ) : (
              <div className="w-48 h-48 bg-white rounded-lg flex items-center justify-center text-xs text-black p-2 break-all">
                {qr.qrCodeBase64}
              </div>
            )}
            <div className="flex items-center gap-2 text-white/80">
              <Smartphone size={18} />
              <span>请用微信扫一扫</span>
            </div>
            <p className="text-sm text-white/60">
              订单将在 {Math.floor(countdown / 60)} 分 {countdown % 60} 秒后自动关闭
            </p>
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-6 border-b border-white/10" role="tablist">
              <button
                role="tab"
                aria-selected={tab === 'subscription'}
                onClick={() => setTab('subscription')}
                className={`px-4 py-2 text-sm ${tab === 'subscription' ? 'text-white border-b-2 border-white' : 'text-white/60'}`}
              >
                订阅
              </button>
              <button
                role="tab"
                aria-selected={tab === 'topup'}
                onClick={() => setTab('topup')}
                className={`px-4 py-2 text-sm ${tab === 'topup' ? 'text-white border-b-2 border-white' : 'text-white/60'}`}
              >
                加量包
              </button>
            </div>

            <div className="space-y-3">
              {PLANS.filter((p) => p.tab === tab).map((p) => (
                <button
                  key={p.plan}
                  onClick={() => handleSelectPlan(p.plan)}
                  className="w-full liquid-glass rounded-xl p-4 text-left hover:bg-white/10 transition-colors flex justify-between items-center"
                >
                  <span className="text-white">{p.label}</span>
                  <span className="text-xl font-bold text-white">{p.price}</span>
                </button>
              ))}
            </div>
            {error && (
              <p role="alert" className="mt-4 text-sm text-red-300">
                {error}
              </p>
            )}
            <p className="mt-6 text-xs text-white/50 text-center">
              遇到问题？联系 <a href="mailto:support@qizai.app" className="underline">support@qizai.app</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}