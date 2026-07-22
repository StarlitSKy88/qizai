import { Globe } from 'lucide-react';

const SOCIALS = [
  { label: '小红书', icon: Globe },
  { label: '抖音', icon: Globe },
  { label: 'B站', icon: Globe },
] as const;

export default function SocialFooter() {
  return (
    <div className="relative z-10 flex justify-center gap-4 pb-12">
      {SOCIALS.map(({ label, icon: Icon }) => (
        <button
          key={label}
          aria-label={label}
          className="liquid-glass rounded-full p-4 text-white/80 hover:text-white hover:bg-white/5 transition-all"
        >
          <Icon size={20} />
        </button>
      ))}
    </div>
  );
}
