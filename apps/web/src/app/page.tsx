import Link from 'next/link';

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold text-center">qizai 骑仔</h1>
      <p className="mt-4 text-center text-gray-600">
        中文 AI 内容流量预测工具
      </p>
      <div className="mt-8 text-center">
        <Link
          href="/upload"
          className="inline-block bg-pink-600 text-white px-6 py-3 rounded-lg hover:bg-pink-700"
        >
          开始预测
        </Link>
      </div>
    </main>
  );
}
