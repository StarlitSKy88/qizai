/**
 * 视频资源常量
 * v0.13.B.3: 视频本地化（从 cloudfront → public/videos/hero.mp4）
 * 此文件记录源 URL，spec/source-of-truth.md 跟踪 source 真实性
 */
export const HERO_VIDEO_SOURCE_URL = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_115001_bcdaa3b4-03de-47e7-ad63-ae3e392c32d4.mp4';

/** 本地化路径（Vite 自动 serve public/） */
export const HERO_VIDEO_LOCAL_URL = '/videos/hero.mp4';

/** 软阈值（warn）：5MB */
export const HERO_VIDEO_WARN_SIZE = 5 * 1024 * 1024;
/** 硬阈值（fail）：10MB */
export const HERO_VIDEO_MAX_SIZE = 10 * 1024 * 1024;
