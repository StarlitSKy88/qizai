import { Link } from 'react-router-dom';
import { Globe } from 'lucide-react';
import QuotaBadge from './QuotaBadge';

export default function NavBar() {
  return (
    <nav className="relative z-20 px-6 py-6">
      <div className="liquid-glass rounded-full px-6 py-3 flex items-center justify-between max-w-5xl mx-auto">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <Globe size={24} className="text-white" />
            <span className="text-white font-semibold text-lg">qizai</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <Link to="/predict" className="text-white/80 hover:text-white transition-colors text-sm font-medium">
              功能
            </Link>
            <Link to="/pricing" className="text-white/80 hover:text-white transition-colors text-sm font-medium">
              定价
            </Link>
            <Link to="/about" className="text-white/80 hover:text-white transition-colors text-sm font-medium">
              关于
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <QuotaBadge />
          <Link
            to="/predict"
            className="text-white text-sm font-medium"
          >
            开始预测
          </Link>
          <Link
            to="/login"
            className="liquid-glass rounded-full px-6 py-2 text-white text-sm font-medium hover:bg-white/5 transition-colors"
          >
            登录
          </Link>
          <Link
            to="/signup"
            className="liquid-glass rounded-full px-6 py-2 text-white text-sm font-medium hover:bg-white/5 transition-colors"
          >
            注册
          </Link>
        </div>
      </div>
    </nav>
  );
}
