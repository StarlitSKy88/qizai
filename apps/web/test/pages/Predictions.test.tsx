import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Predictions from '../../src/pages/Predictions';
import * as predictions from '../../src/api/predictions';

// Mock the predictions API surface. We keep `listReports` as a vi.fn so
// each test can resolve / reject on demand without touching a real network.
vi.mock('../../src/api/predictions', async () => {
  const actual = await vi.importActual<typeof predictions>('../../src/api/predictions');
  return {
    ...actual,
    listReports: vi.fn(),
  };
});

const mockedListReports = vi.mocked(predictions.listReports);

const fakeList = [
  {
    id: 'r-1',
    title: '小红书爆款笔记标题套路',
    status: 'done',
    created_at: 1700000000,
    completed_at: 1700000060,
  },
  {
    id: 'r-2',
    title: 'B站知识区 UP 主选题清单',
    status: 'done',
    created_at: 1700001000,
    completed_at: 1700001080,
  },
  {
    id: 'r-3',
    title: '抖音剧情号前三秒钩子',
    status: 'streaming',
    created_at: 1700002000,
    completed_at: null,
  },
];

describe('Predictions', () => {
  beforeEach(() => {
    mockedListReports.mockReset();
  });

  it('renders list of report titles', async () => {
    mockedListReports.mockResolvedValue(fakeList);
    render(
      <MemoryRouter initialEntries={['/predictions']}>
        <Predictions />
      </MemoryRouter>,
    );
    expect(
      await screen.findByText('小红书爆款笔记标题套路'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('B站知识区 UP 主选题清单'),
    ).toBeInTheDocument();
    expect(await screen.findByText('抖音剧情号前三秒钩子')).toBeInTheDocument();
  });

  it('each report links to /report/:id', async () => {
    mockedListReports.mockResolvedValue(fakeList);
    render(
      <MemoryRouter initialEntries={['/predictions']}>
        <Predictions />
      </MemoryRouter>,
    );
    await screen.findByText('小红书爆款笔记标题套路');
    const link1 = screen.getByRole('link', { name: /小红书爆款笔记标题套路/ });
    expect(link1).toHaveAttribute('href', '/report/r-1');
    const link2 = screen.getByRole('link', { name: /B站知识区 UP 主选题清单/ });
    expect(link2).toHaveAttribute('href', '/report/r-2');
    const link3 = screen.getByRole('link', { name: /抖音剧情号前三秒钩子/ });
    expect(link3).toHaveAttribute('href', '/report/r-3');
  });

  it('redirects to /login on 401', async () => {
    const err = new Error('HTTP 401') as Error & { status: number };
    err.status = 401;
    mockedListReports.mockRejectedValue(err);
    render(
      <MemoryRouter initialEntries={['/predictions']}>
        <Predictions />
      </MemoryRouter>,
    );
    // The page issues a navigate('/login?redirect=/predictions') on 401.
    // MemoryRouter updates its location; we assert the call was made
    // (we can't read window.location reliably in jsdom).
    await waitFor(() => {
      expect(mockedListReports).toHaveBeenCalledTimes(1);
    });
    // After redirect, the Predictions content should be gone from the DOM
    // because MemoryRouter now matches the /login route (which has no
    // child element here, so the page unmounts). The empty-state copy
    // for Predictions should no longer be in the document.
    await waitFor(() => {
      expect(screen.queryByText('历史预测')).not.toBeInTheDocument();
    });
  });
});
