import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'qizai 骑仔 - 中文 AI 内容流量预测',
  description: '小红书 / 抖音 / B站创作者的 1000+ persona 模拟预测工具',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50">{children}</body>
    </html>
  );
}
