import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Dropzone, MAX_UPLOAD_BYTES } from './Dropzone';

describe('Dropzone', () => {
  it('validates file type before accepting a file', () => {
    const onFile = vi.fn();
    const onError = vi.fn();
    render(<Dropzone file={null} onFile={onFile} onError={onError} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const badFile = new File(['<script>'], 'evil.svg', { type: 'image/svg+xml' });
    // fireEvent bypasses the native accept filter so the handler must reject it.
    fireEvent.change(input, { target: { files: [badFile] } });

    expect(onFile).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('Unsupported format'));
  });

  it('validates file size', async () => {
    const onFile = vi.fn();
    const onError = vi.fn();
    render(<Dropzone file={null} onFile={onFile} onError={onError} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const bigFile = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], 'big.jpg', {
      type: 'image/jpeg',
    });
    await userEvent.upload(input, bigFile);

    expect(onFile).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('the limit is'));
  });

  it('accepts a valid image', async () => {
    const onFile = vi.fn();
    const onError = vi.fn();
    render(<Dropzone file={null} onFile={onFile} onError={onError} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const goodFile = new File([new Uint8Array(128)], 'road.jpg', { type: 'image/jpeg' });
    await userEvent.upload(input, goodFile);

    expect(onError).not.toHaveBeenCalled();
    expect(onFile).toHaveBeenCalledWith(goodFile);
  });

  it('shows the selected file and allows removal', async () => {
    const onFile = vi.fn();
    const file = new File([new Uint8Array(64)], 'road.png', { type: 'image/png' });
    render(<Dropzone file={file} onFile={onFile} onError={vi.fn()} />);

    expect(screen.getByText('road.png')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /remove selected image/i }));
    expect(onFile).toHaveBeenCalledWith(null);
  });
});
