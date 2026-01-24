import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ExportDataModal from './ExportDataModal';

describe('ExportDataModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onExport: vi.fn(),
    isExporting: false,
    error: null,
  };

  it('should render when open', () => {
    render(<ExportDataModal {...defaultProps} />);

    expect(screen.getByText('Export for Another Device')).toBeInTheDocument();
    expect(screen.getByLabelText(/encryption passphrase/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm passphrase/i)).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(<ExportDataModal {...defaultProps} isOpen={false} />);

    expect(
      screen.queryByText('Export for Another Device'),
    ).not.toBeInTheDocument();
  });

  it('should show privacy warning', () => {
    render(<ExportDataModal {...defaultProps} />);

    expect(screen.getByText(/privacy notice/i)).toBeInTheDocument();
    expect(
      screen.getByText(/contains your CPAP health data/i),
    ).toBeInTheDocument();
  });

  it('should toggle passphrase visibility', () => {
    render(<ExportDataModal {...defaultProps} />);

    const passphraseInput = screen.getByLabelText(/encryption passphrase/i);
    const toggleButton = screen.getAllByRole('button', {
      name: /show passphrase/i,
    })[0];

    expect(passphraseInput).toHaveAttribute('type', 'password');

    fireEvent.click(toggleButton);
    expect(passphraseInput).toHaveAttribute('type', 'text');

    fireEvent.click(toggleButton);
    expect(passphraseInput).toHaveAttribute('type', 'password');
  });

  it('should display passphrase strength meter', async () => {
    render(<ExportDataModal {...defaultProps} />);

    const passphraseInput = screen.getByLabelText(/encryption passphrase/i);

    // Weak passphrase
    fireEvent.change(passphraseInput, { target: { value: '12345678' } });
    await waitFor(() => {
      expect(screen.getByText('weak')).toBeInTheDocument();
    });

    // Moderate passphrase
    fireEvent.change(passphraseInput, { target: { value: 'Password123' } });
    await waitFor(() => {
      expect(screen.getByText('moderate')).toBeInTheDocument();
    });

    // Strong passphrase
    fireEvent.change(passphraseInput, {
      target: { value: 'MyStr0ng!Passw0rd' },
    });
    await waitFor(() => {
      expect(screen.getByText('strong')).toBeInTheDocument();
    });
  });

  it('should show suggestions for weak passphrase', async () => {
    render(<ExportDataModal {...defaultProps} />);

    const passphraseInput = screen.getByLabelText(/encryption passphrase/i);
    fireEvent.change(passphraseInput, { target: { value: 'weakpass' } });

    await waitFor(() => {
      expect(screen.getByText(/12\+ characters/i)).toBeInTheDocument();
      expect(screen.getByText(/uppercase letters/i)).toBeInTheDocument();
      expect(screen.getByText(/numbers/i)).toBeInTheDocument();
      expect(screen.getByText(/symbols/i)).toBeInTheDocument();
    });
  });

  it('should validate passphrase confirmation', async () => {
    render(<ExportDataModal {...defaultProps} />);

    const passphraseInput = screen.getByLabelText(/encryption passphrase/i);
    const confirmInput = screen.getByLabelText(/confirm passphrase/i);
    const exportButton = screen.getByText('Download Encrypted File');

    fireEvent.change(passphraseInput, {
      target: { value: 'strong-passphrase' },
    });
    fireEvent.change(confirmInput, {
      target: { value: 'different-passphrase' },
    });

    // Try to export with mismatched passphrases
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(screen.getByText(/passphrases do not match/i)).toBeInTheDocument();
    });

    expect(defaultProps.onExport).not.toHaveBeenCalled();
  });

  it('should enable export button when valid', async () => {
    render(<ExportDataModal {...defaultProps} />);

    const passphraseInput = screen.getByLabelText(/encryption passphrase/i);
    const confirmInput = screen.getByLabelText(/confirm passphrase/i);
    const exportButton = screen.getByText('Download Encrypted File');

    expect(exportButton).toBeDisabled();

    fireEvent.change(passphraseInput, {
      target: { value: 'strong-passphrase-123' },
    });
    fireEvent.change(confirmInput, {
      target: { value: 'strong-passphrase-123' },
    });

    await waitFor(() => {
      expect(exportButton).toBeEnabled();
    });
  });

  it('should call onExport with passphrase when valid', async () => {
    render(<ExportDataModal {...defaultProps} />);

    const passphrase = 'strong-passphrase-123';
    const passphraseInput = screen.getByLabelText(/encryption passphrase/i);
    const confirmInput = screen.getByLabelText(/confirm passphrase/i);
    const exportButton = screen.getByText('Download Encrypted File');

    fireEvent.change(passphraseInput, { target: { value: passphrase } });
    fireEvent.change(confirmInput, { target: { value: passphrase } });

    await waitFor(() => {
      expect(exportButton).toBeEnabled();
    });

    fireEvent.click(exportButton);

    expect(defaultProps.onExport).toHaveBeenCalledWith(passphrase);
  });

  it('should show loading state during export', () => {
    render(<ExportDataModal {...defaultProps} isExporting={true} />);

    const exportButton = screen.getByText('Encrypting...');
    expect(exportButton).toBeDisabled();
  });

  it('should display error message', () => {
    const error = new Error('Export failed for testing');
    render(<ExportDataModal {...defaultProps} error={error} />);

    // Multiple alerts exist (privacy warning + error), check for error text
    expect(screen.getByText(/export failed for testing/i)).toBeInTheDocument();
  });

  it('should close on backdrop click', () => {
    render(<ExportDataModal {...defaultProps} />);

    const backdrop = screen.getByRole('dialog');
    fireEvent.click(backdrop);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should close on cancel button click', () => {
    render(<ExportDataModal {...defaultProps} />);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should close on X button click', () => {
    render(<ExportDataModal {...defaultProps} />);

    const closeButton = screen.getByLabelText(/close export modal/i);
    fireEvent.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should clear passphrase on close', async () => {
    const { rerender } = render(<ExportDataModal {...defaultProps} />);

    const passphraseInput = screen.getByLabelText(/encryption passphrase/i);
    const confirmInput = screen.getByLabelText(/confirm passphrase/i);

    fireEvent.change(passphraseInput, { target: { value: 'test-passphrase' } });
    fireEvent.change(confirmInput, { target: { value: 'test-passphrase' } });

    expect(passphraseInput.value).toBe('test-passphrase');
    expect(confirmInput.value).toBe('test-passphrase');

    // Close modal
    rerender(<ExportDataModal {...defaultProps} isOpen={false} />);

    // Reopen modal
    rerender(<ExportDataModal {...defaultProps} isOpen={true} />);

    // Wait for new inputs to be rendered and check they're empty
    await waitFor(() => {
      const newPassphraseInput = screen.getByLabelText(
        /encryption passphrase/i,
      );
      expect(newPassphraseInput.value).toBe('');
    });

    const newConfirmInput = screen.getByLabelText(/confirm passphrase/i);
    expect(newConfirmInput.value).toBe('');
  });

  it('should show transfer methods accordion', () => {
    render(<ExportDataModal {...defaultProps} />);

    const summary = screen.getByText(/how to transfer the file safely/i);
    expect(summary).toBeInTheDocument();

    // Click to expand
    fireEvent.click(summary);

    expect(screen.getByText(/AirDrop/i)).toBeInTheDocument();
    expect(screen.getByText(/USB Drive/i)).toBeInTheDocument();
    expect(screen.getByText(/Email/i)).toBeInTheDocument();
    expect(screen.getByText(/Cloud Storage/i)).toBeInTheDocument();
  });

  it('should have proper ARIA attributes', () => {
    render(<ExportDataModal {...defaultProps} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'export-modal-title');

    const title = screen.getByText('Export for Another Device');
    expect(title).toHaveAttribute('id', 'export-modal-title');
  });

  it('should prevent export with weak passphrase', async () => {
    render(<ExportDataModal {...defaultProps} />);

    const passphraseInput = screen.getByLabelText(/encryption passphrase/i);
    const confirmInput = screen.getByLabelText(/confirm passphrase/i);
    const exportButton = screen.getByText('Download Encrypted File');

    // Enter weak passphrase
    fireEvent.change(passphraseInput, { target: { value: 'weak' } });
    fireEvent.change(confirmInput, { target: { value: 'weak' } });

    await waitFor(() => {
      expect(exportButton).toBeDisabled();
    });
  });

  it('should require minimum 8 characters', async () => {
    render(<ExportDataModal {...defaultProps} />);

    const passphraseInput = screen.getByLabelText(/encryption passphrase/i);
    const confirmInput = screen.getByLabelText(/confirm passphrase/i);
    const exportButton = screen.getByText('Download Encrypted File');

    // Enter 7 characters
    fireEvent.change(passphraseInput, { target: { value: '1234567' } });
    fireEvent.change(confirmInput, { target: { value: '1234567' } });

    await waitFor(() => {
      expect(exportButton).toBeDisabled();
    });

    // Enter 8 characters
    fireEvent.change(passphraseInput, { target: { value: '12345678' } });
    fireEvent.change(confirmInput, { target: { value: '12345678' } });

    await waitFor(() => {
      expect(exportButton).toBeEnabled();
    });
  });
});
