/**
 * ADR: v0.13.B.3 threshold amendment
 * ----------------------------------
 * 原 spec §Q5: HERO_VIDEO_MAX_SIZE = 10MB (10485760)
 * 真实 CloudFront 视频: 20MB (20971520)
 * 修订: HERO_VIDEO_MAX_SIZE = 25MB (26214400) — 保留 5MB 安全冗余
 * 修订日期: 2026-07-24
 * 决策者: 昴君
 * 触发条件: Task 1 implementer 实测 fetch-video.sh 真实下载，文件大小 20MB > 10MB threshold
 * 后续: v0.14+ 转码为 H.264 baseline < 10MB 后恢复原阈值
 */

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
/** 硬阈值（fail）：25MB（v0.13.B.3 spec §Q5 修订：原 10MB，真实视频 20MB 调整为 25MB） */
export const HERO_VIDEO_MAX_SIZE = 25 * 1024 * 1024;
