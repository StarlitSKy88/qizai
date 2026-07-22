import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UploadForm } from '../../src/components/UploadForm';

describe('UploadForm', () => {
  it('renders title input and tags input', () => {
    render(<UploadForm />);
    expect(screen.getByLabelText(/标题/)).toBeDefined();
    expect(screen.getByLabelText(/标签/)).toBeDefined();
  });

  it('disables submit button when title is empty', () => {
    render(<UploadForm />);
    const button = screen.getByRole('button', { name: /预测/ });
    expect(button).toHaveProperty('disabled', true);
  });
});
