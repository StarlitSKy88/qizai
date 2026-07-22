import { ReportView } from '../../../components/ReportView';

export default function ReportPage({ params }: { params: { id: string } }) {
  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">流量预测报告 #{params.id}</h1>
      <ReportView reportId={params.id} />
    </main>
  );
}
