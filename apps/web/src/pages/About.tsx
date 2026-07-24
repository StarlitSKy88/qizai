import { Users, Target, Mail } from 'lucide-react';

export default function About() {
  return (
    <div className="relative z-10 max-w-4xl mx-auto px-6 py-16 text-white">
      <h1
        className="text-5xl md:text-6xl font-bold mb-6"
        style={{ fontFamily: "'Instrument Serif', serif" }}
      >
        关于 qizai
      </h1>
      <p className="text-white/80 text-lg leading-relaxed mb-12">
        qizai（骑仔）是给个人内容创作者的流量预测 co-pilot。
        我们相信创作不该赌运气——在按下「发布」之前，
        先问 1000 个真实 persona 帮你投票。
      </p>
      <div className="space-y-8">
        <section>
          <div className="flex items-center gap-3 mb-3">
            <Target size={24} className="text-white/90" aria-hidden="true" />
            <h2 className="text-2xl font-semibold">愿景</h2>
          </div>
          <p className="text-white/70 leading-relaxed pl-9">
            让每个认真创作的个体都能用上原本只属于大公司的流量预判工具。
            不做内容农场，只做更聪明的发布前决策。
          </p>
        </section>
        <section>
          <div className="flex items-center gap-3 mb-3">
            <Users size={24} className="text-white/90" aria-hidden="true" />
            <h2 className="text-2xl font-semibold">团队</h2>
          </div>
          <p className="text-white/70 leading-relaxed pl-9">
            创始团队来自内容创作 + 算法工程交叉背景。
            我们自己也是重度创作者——qizai 的每个功能都从「我自己用得着吗」出发。
          </p>
        </section>
        <section>
          <div className="flex items-center gap-3 mb-3">
            <Mail size={24} className="text-white/90" aria-hidden="true" />
            <h2 className="text-2xl font-semibold">联系我们</h2>
          </div>
          <p className="text-white/70 leading-relaxed pl-9">
            邮件 <a href="mailto:hi@qizai.app" className="underline hover:text-white">hi@qizai.app</a>，
            或小红书 / 抖音 / B站 搜索「qizai 骑仔」找到我们。
          </p>
        </section>
      </div>
    </div>
  );
}
