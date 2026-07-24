import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFound from '../../src/pages/NotFound';

describe('NotFound', () => {
  it('renders H1 "404"', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: '404' })).toBeInTheDocument();
  });
});
