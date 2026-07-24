import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Report from '../../src/pages/Report';
import * as predictions from '../../src/api/predictions';

// Mock the predictions API surface. We keep `getReport` as a vi.fn so each
// test can resolve / reject on demand without touching a real network.
vi.mock('../../src/api/predictions', async () => {
  const actual = await vi.importActual<typeof predictions>('../../src/api/predictions');
  return {
    ...actual,
    getReport: vi.fn(),
  };
});

const mockedGetReport = vi.mocked(predictions.getReport);

const fakeReport = {
  id: 'r-1',
  title: '如何用 AI 写小红书爆款',
  status: 'done',
  report: { decision: '建议发布：标题命中「痛点 + 数字」公式，3 平台预估互动率均高于均值。' },
  evidence: {
    xhs_ctr: 0.124,
    tiktok_save_rate: 0.087,
    bilibili_completion: 0.61,
    key_personas: ['一线城市 25-30 内容创作者', '重效率工具党'],
  },
  created_at: 1700000000,
  completed_at: 1700000060,
};

function renderAt(id: string) {
  // MemoryRouter with a Route definition is required so useParams<{id}>
  // resolves the path param under test, not undefined.
  return render(
    <MemoryRouter initialEntries={[`/report/${id}`]}>
      <Routes>
        <Route path="/report/:id" element={<Report />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Report', () => {
  beforeEach(() => {
    mockedGetReport.mockReset();
  });

  it('renders title from report data', async () => {
    mockedGetReport.mockResolvedValue(fakeReport);
    renderAt('r-1');
    const heading = await screen.findByRole('heading', { level: 1, name: '如何用 AI 写小红书爆款' });
    expect(heading).toBeInTheDocument();
  });

  it('shows status badge "已完成" for done reports', async () => {
    mockedGetReport.mockResolvedValue(fakeReport);
    renderAt('r-1');
    expect(await screen.findByText('已完成')).toBeInTheDocument();
  });

  it('shows decision text from report payload', async () => {
    mockedGetReport.mockResolvedValue(fakeReport);
    renderAt('r-1');
    expect(
      await screen.findByText(/建议发布：标题命中「痛点 \+ 数字」公式/),
    ).toBeInTheDocument();
  });

  it('shows "报告不存在" on 404', async () => {
    const err = new Error('HTTP 404') as Error & { status: number };
    err.status = 404;
    mockedGetReport.mockRejectedValue(err);
    renderAt('r-missing');
    const heading = await screen.findByRole('heading', { level: 1, name: '报告不存在' });
    expect(heading).toBeInTheDocument();
    await waitFor(() => {
      expect(mockedGetReport).toHaveBeenCalledWith('r-missing');
    });
  });

  // H4: 403 (report belongs to a different user) must reuse the
  // "报告不存在" UX for parity — the user should not learn whether the
  // reportId exists for someone else. This was previously falling into
  // the "其他错误" branch and silently leaving the page on "加载中…".
  it('shows "报告不存在" on 403', async () => {
    const err = new Error('HTTP 403') as Error & { status: number };
    err.status = 403;
    mockedGetReport.mockRejectedValue(err);
    renderAt('r-foreign');
    const heading = await screen.findByRole('heading', { level: 1, name: '报告不存在' });
    expect(heading).toBeInTheDocument();
  });

  it('calls getReport with id from useParams', async () => {
    mockedGetReport.mockResolvedValue(fakeReport);
    renderAt('r-xyz');
    await waitFor(() => {
      expect(mockedGetReport).toHaveBeenCalledTimes(1);
    });
    expect(mockedGetReport).toHaveBeenCalledWith('r-xyz');
  });
});
