import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';

const TIERS = [
  {
    name: '试用',
    price: '¥0',
    period: '/ 永久',
    desc: '看看 qizai 适合不适合你',
    features: ['每天 3 次预测', '单平台测试', '基础报告'],
    cta: '免费开始',
    href: '/predict',
    highlight: false,
  },
  {
    name: '个人创作者',
    price: '¥29',
    period: '/ 月',
    desc: '认真做内容的独立创作者',
    features: ['无限预测', '3 平台同测', '完整报告 + 决策依据', '历史报告存档 90 天（即将上线）'],
    cta: '开始体验',
    href: '/predict',
    highlight: true,
  },
  {
    name: '团队',
    price: '¥299',
    period: '/ 月',
    desc: 'MCN / 内容工作室',
    features: ['个人版全部功能', '5 个子账号', '历史报告永久存档（即将上线）', 'REST API 接入（即将上线）', '优先客服'],
    cta: '联系销售',
    href: 'mailto:hi@qizai.app',
    highlight: false,
  },
] as const;

export default function Pricing() {
  return (
    <div className="relative z-10 max-w-6xl mx-auto px-6 py-16 text-white">
      <h1
        className="text-5xl md:text-6xl font-bold mb-6 text-center"
        style={{ fontFamily: "'Instrument Serif', serif" }}
      >
        定价
      </h1>
      <p className="text-white/80 text-lg leading-relaxed mb-12 text-center max-w-2xl mx-auto">
        不收智商税——按真实使用量定价，该有的功能都给，不藏着掖着。
      </p>
      <div className="grid md:grid-cols-3 gap-6">
        {TIERS.map((tier) => {
          const isMailto = tier.href.startsWith('mailto:');
          const TierButton = (
            <span
              className={`w-full inline-block text-center rounded-full py-3 text-sm font-medium transition-colors ${
                tier.highlight
                  ? 'bg-white text-black hover:bg-white/90'
                  : 'liquid-glass text-white hover:bg-white/5'
              }`}
            >
              {tier.cta}
            </span>
          );
          return (
            <div
              key={tier.name}
              className={`liquid-glass rounded-2xl p-8 ${tier.highlight ? 'ring-2 ring-white/30' : ''}`}
            >
              <h2 className="text-2xl font-semibold mb-2">
                {tier.name}
                {tier.highlight && (
                  <span className="sr-only"> 推荐方案</span>
                )}
              </h2>
              <p className="text-white/60 text-sm mb-4">{tier.desc}</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">{tier.price}</span>
                <span className="text-white/60 text-sm ml-1">{tier.period}</span>
              </div>
              <ul role="list" className="space-y-2 mb-8">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check size={16} className="mt-0.5 flex-shrink-0 text-white/80" aria-hidden="true" />
                    <span className="text-white/80">{f}</span>
                  </li>
                ))}
              </ul>
              {isMailto ? (
                <a href={tier.href} className="block">
                  {TierButton}
                </a>
              ) : (
                <Link to={tier.href} className="block">
                  {TierButton}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
