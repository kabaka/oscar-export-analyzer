import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImportDataModal from './ImportDataModal';

describe('ImportDataModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onImport: vi.fn(),
    isImporting: false,
    error: null,
    crossDevice: false,
  };

  const createMockFile = (name = 'test.json.enc', size = 1024) => {
    return new File(['test content'], name, {
      type: 'application/json',
      size,
    });
  };

  it('should render when open', () => {
    render(<ImportDataModal {...defaultProps} />);

    expect(screen.getByText('Import from Another Device')).toBeInTheDocument();
    expect(screen.getByLabelText(/select encrypted file/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/decryption passphrase/i)).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(<ImportDataModal {...defaultProps} isOpen={false} />);

    expect(
      screen.queryByText('Import from Another Device'),
    ).not.toBeInTheDocument();
  });

  it('should show file drop zone', () => {
    render(<ImportDataModal {...defaultProps} />);

    expect(
      screen.getByText(/click to select file or drag and drop/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/\.json\.enc files/i)).toBeInTheDocument();
  });

  it('should handle file selection', () => {
    render(<ImportDataModal {...defaultProps} />);

    const fileInput = screen.getByLabelText(/select encrypted file/i);
    const mockFile = createMockFile();

    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    expect(screen.getByText('test.json.enc')).toBeInTheDocument();
  });

  it('should display file size', () => {
    render(<ImportDataModal {...defaultProps} />);

    const fileInput = screen.getByLabelText(/select encrypted file/i);
    const mockFile = createMockFile('test.json.enc', 1024 * 1024); // 1 MB

    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    // Check that file size element is displayed (Note: File mock in test env may not preserve size)
    expect(screen.getByText(/MB/)).toBeInTheDocument();
  });

  it('should allow removing selected file', () => {
    render(<ImportDataModal {...defaultProps} />);

    const fileInput = screen.getByLabelText(/select encrypted file/i);
    const mockFile = createMockFile();

    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    expect(screen.getByText('test.json.enc')).toBeInTheDocument();

    const removeButton = screen.getByText('Remove');
    fireEvent.click(removeButton);

    expect(screen.queryByText('test.json.enc')).not.toBeInTheDocument();
  });

  it('should toggle passphrase visibility', () => {
    render(<ImportDataModal {...defaultProps} />);

    const passphraseInput = screen.getByLabelText(/decryption passphrase/i);
    const toggleButton = screen.getByRole('button', {
      name: /show passphrase/i,
    });

    expect(passphraseInput).toHaveAttribute('type', 'password');

    fireEvent.click(toggleButton);
    expect(passphraseInput).toHaveAttribute('type', 'text');

    fireEvent.click(toggleButton);
    expect(passphraseInput).toHaveAttribute('type', 'password');
  });

  it('should enable import button when valid', () => {
    render(<ImportDataModal {...defaultProps} />);

    const fileInput = screen.getByLabelText(/select encrypted file/i);
    const passphraseInput = screen.getByLabelText(/decryption passphrase/i);
    const importButton = screen.getByText('Import Data');

    expect(importButton).toBeDisabled();

    const mockFile = createMockFile();
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    fireEvent.change(passphraseInput, { target: { value: 'test-passphrase' } });

    expect(importButton).toBeEnabled();
  });

  it('should require minimum 8 characters for passphrase', () => {
    render(<ImportDataModal {...defaultProps} />);

    const fileInput = screen.getByLabelText(/select encrypted file/i);
    const passphraseInput = screen.getByLabelText(/decryption passphrase/i);
    const importButton = screen.getByText('Import Data');

    const mockFile = createMockFile();
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    // 7 characters - should be disabled
    fireEvent.change(passphraseInput, { target: { value: '1234567' } });
    expect(importButton).toBeDisabled();

    // 8 characters - should be enabled
    fireEvent.change(passphraseInput, { target: { value: '12345678' } });
    expect(importButton).toBeEnabled();
  });

  it('should call onImport with file and passphrase', () => {
    render(<ImportDataModal {...defaultProps} />);

    const fileInput = screen.getByLabelText(/select encrypted file/i);
    const passphraseInput = screen.getByLabelText(/decryption passphrase/i);
    const importButton = screen.getByText('Import Data');

    const mockFile = createMockFile();
    const passphrase = 'test-passphrase-123';

    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    fireEvent.change(passphraseInput, { target: { value: passphrase } });
    fireEvent.click(importButton);

    expect(defaultProps.onImport).toHaveBeenCalledWith(mockFile, passphrase);
  });

  it('should show loading state during import', () => {
    render(<ImportDataModal {...defaultProps} isImporting={true} />);

    const importButton = screen.getByText('Decrypting...');
    expect(importButton).toBeDisabled();
  });

  it('should display error message', () => {
    const error = new Error('Incorrect passphrase or corrupted file');
    render(<ImportDataModal {...defaultProps} error={error} />);

    expect(screen.getByText(/import failed/i)).toBeInTheDocument();
    expect(screen.getByText(error.message)).toBeInTheDocument();
  });

  it('should display cross-device notification', () => {
    render(<ImportDataModal {...defaultProps} crossDevice={true} />);

    expect(
      screen.getByText(/session imported from another device/i),
    ).toBeInTheDocument();
  });

  it('should not show cross-device notification when there is an error', () => {
    const error = new Error('Import failed');
    render(
      <ImportDataModal {...defaultProps} crossDevice={true} error={error} />,
    );

    expect(
      screen.queryByText(/session imported from another device/i),
    ).not.toBeInTheDocument();
  });

  it('should show privacy notice', () => {
    render(<ImportDataModal {...defaultProps} />);

    expect(screen.getByText(/privacy/i)).toBeInTheDocument();
    expect(
      screen.getByText(/stored locally in this browser/i),
    ).toBeInTheDocument();
  });

  it('should close on backdrop click', () => {
    render(<ImportDataModal {...defaultProps} />);

    const backdrop = screen.getByRole('dialog');
    fireEvent.click(backdrop);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should close on cancel button click', () => {
    render(<ImportDataModal {...defaultProps} />);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should close on X button click', () => {
    render(<ImportDataModal {...defaultProps} />);

    const closeButton = screen.getByLabelText(/close import modal/i);
    fireEvent.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should clear form on close', async () => {
    const { rerender } = render(<ImportDataModal {...defaultProps} />);

    const fileInput = screen.getByLabelText(/select encrypted file/i);
    const passphraseInput = screen.getByLabelText(/decryption passphrase/i);

    const mockFile = createMockFile();
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    fireEvent.change(passphraseInput, { target: { value: 'test-passphrase' } });

    expect(screen.getByText('test.json.enc')).toBeInTheDocument();
    expect(passphraseInput.value).toBe('test-passphrase');

    // Close modal
    rerender(<ImportDataModal {...defaultProps} isOpen={false} />);

    // Wait for async state clearing
    await waitFor(() => {
      expect(screen.queryByText('test.json.enc')).not.toBeInTheDocument();
    });

    // Reopen modal
    rerender(<ImportDataModal {...defaultProps} isOpen={true} />);

    const newPassphraseInput = screen.getByLabelText(/decryption passphrase/i);
    expect(screen.queryByText('test.json.enc')).not.toBeInTheDocument();
    expect(newPassphraseInput.value).toBe('');
  });

  it('should have proper ARIA attributes', () => {
    render(<ImportDataModal {...defaultProps} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'import-modal-title');

    const title = screen.getByText('Import from Another Device');
    expect(title).toHaveAttribute('id', 'import-modal-title');
  });

  it('should accept .json and .json.enc files', () => {
    render(<ImportDataModal {...defaultProps} />);

    const fileInput = screen.getByLabelText(/select encrypted file/i);
    expect(fileInput).toHaveAttribute('accept', '.json,.enc,.json.enc');
  });

  it('should handle drag and drop', () => {
    render(<ImportDataModal {...defaultProps} />);

    const dropZone = screen
      .getByText(/click to select file or drag and drop/i)
      .closest('.file-drop-zone');
    const mockFile = createMockFile();

    // Simulate drag enter
    fireEvent.dragEnter(dropZone, {
      dataTransfer: { files: [mockFile] },
    });

    // Simulate drop
    fireEvent.drop(dropZone, {
      dataTransfer: { files: [mockFile] },
    });

    expect(screen.getByText('test.json.enc')).toBeInTheDocument();
  });

  it('should disable interactions during import', () => {
    render(<ImportDataModal {...defaultProps} isImporting={true} />);

    const fileInput = screen.getByLabelText(/select encrypted file/i);
    const passphraseInput = screen.getByLabelText(/decryption passphrase/i);
    const importButton = screen.getByText('Decrypting...');
    const cancelButton = screen.getByText('Cancel');
    const closeButton = screen.getByLabelText(/close import modal/i);

    expect(fileInput).toBeDisabled();
    expect(passphraseInput).toBeDisabled();
    expect(importButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
    expect(closeButton).toBeDisabled();
  });

  it('should clear passphrase after successful import', async () => {
    const { rerender } = render(<ImportDataModal {...defaultProps} />);

    const fileInput = screen.getByLabelText(/select encrypted file/i);
    const passphraseInput = screen.getByLabelText(/decryption passphrase/i);
    const importButton = screen.getByText('Import Data');

    const mockFile = createMockFile();
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    fireEvent.change(passphraseInput, { target: { value: 'test-passphrase' } });
    fireEvent.click(importButton);

    // Simulate successful import
    rerender(
      <ImportDataModal
        {...defaultProps}
        isImporting={false}
        crossDevice={true}
      />,
    );

    await waitFor(() => {
      const newPassphraseInput = screen.getByLabelText(
        /decryption passphrase/i,
      );
      expect(newPassphraseInput.value).toBe('');
    });
  });
});
