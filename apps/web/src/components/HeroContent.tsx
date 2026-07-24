import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function HeroContent() {
  const [title, setTitle] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    navigate(`/predict?title=${encodeURIComponent(title)}`);
  };

  return (
    <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12 text-center -translate-y-[20%]">
      <h1
        className="text-5xl md:text-6xl lg:text-7xl text-white mb-8 tracking-tight whitespace-nowrap"
        style={{ fontFamily: "'Instrument Serif', serif" }}
      >
        你的内容会爆吗？
      </h1>
      <div className="max-w-xl w-full space-y-4">
        <form className="liquid-glass rounded-full pl-6 pr-2 py-2 flex items-center gap-3" onSubmit={handleSubmit}>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="输入你的内容标题"
            className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/40 text-base py-1"
          />
          <button type="submit" className="bg-white rounded-full p-3 text-black hover:bg-white/90 transition-colors">
            <ArrowRight size={20} />
          </button>
        </form>
        <p className="text-white text-sm leading-relaxed px-4">
          先问 1000 个 persona，再决定要不要发布——小红书 / 抖音 / B站 流量预测 co-pilot
        </p>
        <Link to="/about" className="liquid-glass rounded-full px-8 py-3 text-white text-sm font-medium hover:bg-white/5 transition-colors inline-block">
          关于我们
        </Link>
      </div>
    </div>
  );
}
