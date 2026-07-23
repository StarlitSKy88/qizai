/**
 * 社交平台品牌 SVG 常量
 * v0.13.B.2: 品牌 SVG 上线（spec §五.2）
 *
 * - 单文件作为单一事实源（spec §四）
 * - label: Chinese platform name; aria-label 用此值
 * - localSvgPath: Vite 自动 serve public/ 路径
 * - cdnSvgUrl: build-time 拉取源（scripts/fetch-social-svgs.sh 解析此字段）
 *
 * ADR-004: simple-icons has NO douyin slug (verified HTTP 404 on 2026-07-23);
 * tiktok used as visual stand-in. Swap path: replace tiktok entry with future
 * douyin CDN URL once simple-icons accepts the contribution.
 */
export interface SocialPlatform {
  readonly id: 'xiaohongshu' | 'tiktok' | 'bilibili';
  readonly label: string;
  readonly localSvgPath: string;
  readonly cdnSvgUrl: string;
}

export const SOCIALS: readonly SocialPlatform[] = [
  {
    id: 'xiaohongshu',
    label: '小红书',
    localSvgPath: '/socials/xiaohongshu.svg',
    cdnSvgUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/xiaohongshu.svg',
  },
  {
    id: 'tiktok', // 抖音 stand-in (ADR-004); same ByteDance family
    label: '抖音',
    localSvgPath: '/socials/tiktok.svg',
    cdnSvgUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/tiktok.svg',
  },
  {
    id: 'bilibili',
    label: 'B站',
    localSvgPath: '/socials/bilibili.svg',
    cdnSvgUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/bilibili.svg',
  },
] as const;
