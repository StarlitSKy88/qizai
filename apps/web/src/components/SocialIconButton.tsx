import { useState } from 'react';
import { Globe } from 'lucide-react';
import type { SocialPlatform } from '../constants/socials';

interface Props {
  readonly platform: SocialPlatform;
}

/**
 * 单社交平台按钮（spec §五.3）
 * - 初始：渲染 <img src={localSvgPath}> + onError fallback
 * - fallback 后：渲染 lucide <Globe size={20}>
 * - aria-label 保留在 <button> 上（spec §六.1 Test 6 + a11y best practice）
 * - Tailwind 完全 verbatim 复制 v0.13.A button 样式（spec §三 verbatim carry）
 */
export function SocialIconButton({ platform }: Props) {
  const [fallback, setFallback] = useState(false);

  return (
    <button
      aria-label={platform.label}
      className="liquid-glass rounded-full p-4 text-white/80 hover:text-white hover:bg-white/5 transition-all"
    >
      {fallback ? (
        <Globe size={20} aria-hidden="true" />
      ) : (
        <img
          src={platform.localSvgPath}
          alt="" /* aria-label provided by parent <button> */
          width={20}
          height={20}
          onError={() => {
            console.warn(`[socials] ${platform.id} local SVG failed; falling back to Globe`);
            setFallback(true);
          }}
        />
      )}
    </button>
  );
}
