import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="relative z-10 max-w-2xl mx-auto px-6 py-32 text-white text-center">
      <h1
        className="text-6xl font-bold mb-4"
        style={{ fontFamily: "'Instrument Serif', serif" }}
      >
        404
      </h1>
      <p className="text-white/70 text-lg mb-8">这个页面不存在——回到首页继续探索 qizai</p>
      <Link
        to="/"
        className="inline-block liquid-glass rounded-full px-8 py-3 text-white text-sm hover:bg-white/5"
      >
        回到首页
      </Link>
    </div>
  );
}
