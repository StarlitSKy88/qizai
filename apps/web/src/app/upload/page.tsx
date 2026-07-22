import { UploadForm } from '../../components/UploadForm';

export default function UploadPage() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">上传内容</h1>
      <UploadForm />
    </main>
  );
}
