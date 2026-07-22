import { Globe } from 'lucide-react';

export default function NavBar() {
  const toast = (msg: string) => () => console.log(msg);

  return (
    <nav className="relative z-20 px-6 py-6">
      <div className="liquid-glass rounded-full px-6 py-3 flex items-center justify-between max-w-5xl mx-auto">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <Globe size={24} className="text-white" />
            <span className="text-white font-semibold text-lg">qizai</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-white/80 hover:text-white transition-colors text-sm font-medium">
              功能
            </a>
            <a href="#pricing" className="text-white/80 hover:text-white transition-colors text-sm font-medium">
              定价
            </a>
            <a href="#about" className="text-white/80 hover:text-white transition-colors text-sm font-medium">
              关于
            </a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={toast('敬请期待 /predict')}
            className="text-white text-sm font-medium"
          >
            开始预测
          </button>
          <button
            onClick={toast('敬请期待 登录')}
            className="liquid-glass rounded-full px-6 py-2 text-white text-sm font-medium hover:bg-white/5 transition-colors"
          >
            登录
          </button>
        </div>
      </div>
    </nav>
  );
}
