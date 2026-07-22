'use client';
import { useEffect, useState } from 'react';

interface Report {
  decision: string;
  metrics: {
    positive_ratio: number;
    negative_ratio: number;
    neutral_ratio: number;
    virality_score: number;
    diversity: number;
  };
  recommendations: string[];
  evidence: Array<{
    source: string;
    description: string;
    confidence: number;
    refs: string[];
  }>;
  generated_at: number;
}

export function ReportView({ reportId }: { reportId: string }) {
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    fetch(`/api/report/${reportId}`)
      .then(res => res.json())
      .then(setReport)
      .catch(() => setReport(null));
  }, [reportId]);

  if (!report) return <div>加载中...</div>;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="text-3xl font-bold mb-4">{report.decision}</div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm text-gray-600">正面比例</div>
          <div className="text-2xl">{(report.metrics.positive_ratio * 100).toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-sm text-gray-600">多样性</div>
          <div className="text-2xl">{(report.metrics.diversity * 100).toFixed(1)}%</div>
        </div>
      </div>
      <div className="mt-6">
        <h3 className="font-bold">优化建议</h3>
        <ul className="list-disc list-inside">
          {report.recommendations.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
