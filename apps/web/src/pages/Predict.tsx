import { useState, FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function Predict() {
  const [searchParams] = useSearchParams();
  const initialTitle = searchParams.get('title') ?? '';
  const [title, setTitle] = useState(initialTitle);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('Predict title:', title);
  };

  return (
    <div className="relative z-10 max-w-4xl mx-auto px-6 py-16 text-white">
      <h1
        className="text-5xl md:text-6xl font-bold mb-6 text-center"
        style={{ fontFamily: "'Instrument Serif', serif" }}
      >
        预测你的内容会爆吗？
      </h1>
      <p className="text-white/80 text-lg text-center mb-12 leading-relaxed">
        粘贴标题、简介或正文，让 1000 个 persona 帮你投票决定要不要发布。 小红书 / 抖音 / B站 一键预测，给你可执行的发布建议。
      </p>

      <form className="max-w-xl mx-auto mb-16" onSubmit={handleSubmit}>
        <div className="liquid-glass rounded-full pl-6 pr-2 py-2 flex items-center gap-3">
          <label htmlFor="predict-title" className="sr-only">
            内容标题或正文
          </label>
          <input
            id="predict-title"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="输入你的内容标题"
            className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/40 text-base py-1"
          />
          <button
            type="submit"
            className="bg-white rounded-full p-3 text-black hover:bg-white/90 transition-colors"
          >
            <ArrowRight size={20} />
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="liquid-glass rounded-2xl p-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/10 mb-4">
            <Sparkles size={24} className="text-white" aria-hidden="true" />
          </div>
          <h3 className="text-xl font-semibold mb-2">几分钟拿到投票</h3>
          <p className="text-white/70 text-sm leading-relaxed">
            1000 个 persona 并行投票，不打扰你写稿
          </p>
        </div>

        <div className="liquid-glass rounded-2xl p-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/10 mb-4">
            <Sparkles size={24} className="text-white" aria-hidden="true" />
          </div>
          <h3 className="text-xl font-semibold mb-2">3 平台同测</h3>
          <p className="text-white/70 text-sm leading-relaxed">
            小红书 / 抖音 / B站 一键同跑，对比预测流量
          </p>
        </div>

        <div className="liquid-glass rounded-2xl p-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/10 mb-4">
            <Sparkles size={24} className="text-white" aria-hidden="true" />
          </div>
          <h3 className="text-xl font-semibold mb-2">可解释报告</h3>
          <p className="text-white/70 text-sm leading-relaxed">
            每个预测附「为什么爆 / 为什么凉」决策依据
          </p>
        </div>
      </div>
    </div>
  );
}
