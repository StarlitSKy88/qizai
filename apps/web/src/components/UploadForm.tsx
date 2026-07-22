'use client';
import { useState } from 'react';

export function UploadForm() {
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');

  const canSubmit = title.length > 0;

  return (
    <form className="space-y-4">
      <div>
        <label htmlFor="title" className="block text-sm font-medium">
          标题
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 block w-full border rounded px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="tags" className="block text-sm font-medium">
          标签（逗号分隔）
        </label>
        <input
          id="tags"
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="mt-1 block w-full border rounded px-3 py-2"
        />
      </div>
      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full bg-pink-600 text-white py-2 rounded disabled:bg-gray-400"
      >
        预测内容流量
      </button>
    </form>
  );
}
