import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button';
import { SeverityBadge } from './Badge';

describe('Button', () => {
  it('renders and handles clicks', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Run analysis</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Run analysis' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled while loading and blocks clicks', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Saving
      </Button>,
    );
    const button = screen.getByRole('button', { name: /saving/i });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('exposes accessible status while loading', () => {
    render(<Button loading>Analysing</Button>);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders without a status indicator when idle', () => {
    render(<Button>Ready</Button>);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ready' })).toBeInTheDocument();
  });
});

describe('SeverityBadge', () => {
  it('renders severity labels', () => {
    render(<SeverityBadge severity="high" />);
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('renders an em dash for missing severity', () => {
    render(<SeverityBadge severity={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
