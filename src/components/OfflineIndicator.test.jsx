import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { OfflineIndicator } from './OfflineIndicator';

describe('OfflineIndicator', () => {
  let mockMatchMedia;
  let eventListeners;

  beforeEach(() => {
    eventListeners = {};

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });

    // Mock window.matchMedia
    mockMatchMedia = vi.fn((query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    window.matchMedia = mockMatchMedia;

    // Mock window.addEventListener
    window.addEventListener = vi.fn((event, handler) => {
      eventListeners[event] = handler;
    });

    window.removeEventListener = vi.fn();
  });

  it('should not render if not in standalone mode', () => {
    mockMatchMedia.mockReturnValue({
      matches: false,
      media: '(display-mode: standalone)',
    });

    const { container } = render(<OfflineIndicator />);

    expect(container).toBeEmptyDOMElement();
  });

  it('should render if in standalone mode', () => {
    mockMatchMedia.mockReturnValue({
      matches: true,
      media: '(display-mode: standalone)',
    });

    render(<OfflineIndicator />);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should show online state by default', () => {
    mockMatchMedia.mockReturnValue({ matches: true });
    Object.defineProperty(navigator, 'onLine', { value: true });

    render(<OfflineIndicator />);

    const indicator = screen.getByRole('status');
    expect(indicator).toHaveTextContent('📡');
    expect(indicator).toHaveAttribute('title', 'App ready — works offline');
    expect(indicator).not.toHaveClass('offline');
  });

  it('should show offline state when navigator.onLine is false', () => {
    mockMatchMedia.mockReturnValue({ matches: true });
    Object.defineProperty(navigator, 'onLine', { value: false });

    render(<OfflineIndicator />);

    const indicator = screen.getByRole('status');
    expect(indicator).toHaveTextContent('✈️');
    expect(indicator).toHaveAttribute(
      'title',
      'Offline mode — analysis still works',
    );
    expect(indicator).toHaveClass('offline');
  });

  it('should update to offline when offline event fires', async () => {
    mockMatchMedia.mockReturnValue({ matches: true });
    Object.defineProperty(navigator, 'onLine', { value: true });

    render(<OfflineIndicator />);

    const indicator = screen.getByRole('status');
    expect(indicator).toHaveTextContent('📡');

    // Trigger offline event
    Object.defineProperty(navigator, 'onLine', { value: false });
    eventListeners.offline();

    await waitFor(() => {
      expect(indicator).toHaveTextContent('✈️');
    });
    expect(indicator).toHaveClass('offline');
  });

  it('should update to online when online event fires', async () => {
    mockMatchMedia.mockReturnValue({ matches: true });
    Object.defineProperty(navigator, 'onLine', { value: false });

    render(<OfflineIndicator />);

    const indicator = screen.getByRole('status');
    expect(indicator).toHaveTextContent('✈️');

    // Trigger online event
    Object.defineProperty(navigator, 'onLine', { value: true });
    eventListeners.online();

    await waitFor(() => {
      expect(indicator).toHaveTextContent('📡');
    });
    expect(indicator).not.toHaveClass('offline');
  });

  it('should have proper ARIA attributes', () => {
    mockMatchMedia.mockReturnValue({ matches: true });

    render(<OfflineIndicator />);

    const indicator = screen.getByRole('status');
    expect(indicator).toHaveAttribute('aria-live', 'polite');
  });

  it('should show screen reader announcement only when offline', () => {
    mockMatchMedia.mockReturnValue({ matches: true });
    Object.defineProperty(navigator, 'onLine', { value: false });

    render(<OfflineIndicator />);

    expect(
      screen.getByText(/Network unavailable\. Analysis continues normally\./i),
    ).toBeInTheDocument();
  });

  it('should not show screen reader announcement when online', () => {
    mockMatchMedia.mockReturnValue({ matches: true });
    Object.defineProperty(navigator, 'onLine', { value: true });

    render(<OfflineIndicator />);

    expect(
      screen.queryByText(
        /Network unavailable\. Analysis continues normally\./i,
      ),
    ).not.toBeInTheDocument();
  });

  it('should clean up event listeners on unmount', () => {
    mockMatchMedia.mockReturnValue({ matches: true });

    const { unmount } = render(<OfflineIndicator />);

    unmount();

    expect(window.removeEventListener).toHaveBeenCalledWith(
      'online',
      expect.any(Function),
    );
    expect(window.removeEventListener).toHaveBeenCalledWith(
      'offline',
      expect.any(Function),
    );
  });
});
