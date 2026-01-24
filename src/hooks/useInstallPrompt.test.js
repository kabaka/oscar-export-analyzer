import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInstallPrompt } from './useInstallPrompt';

describe('useInstallPrompt', () => {
  let mockMatchMedia;
  let eventListeners;

  beforeEach(() => {
    eventListeners = {};

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

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with null installPrompt and not installed', () => {
    const { result } = renderHook(() => useInstallPrompt());

    expect(result.current.installPrompt).toBeNull();
    expect(result.current.isInstalled).toBe(false);
    expect(typeof result.current.promptInstall).toBe('function');
  });

  it('should detect standalone mode (already installed)', () => {
    mockMatchMedia.mockReturnValue({
      matches: true,
      media: '(display-mode: standalone)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const { result } = renderHook(() => useInstallPrompt());

    expect(result.current.isInstalled).toBe(true);
  });

  it('should detect iOS standalone mode', () => {
    window.navigator.standalone = true;

    const { result } = renderHook(() => useInstallPrompt());

    expect(result.current.isInstalled).toBe(true);

    delete window.navigator.standalone;
  });

  it('should capture beforeinstallprompt event', () => {
    const { result } = renderHook(() => useInstallPrompt());

    const mockEvent = {
      preventDefault: vi.fn(),
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    };

    act(() => {
      eventListeners.beforeinstallprompt(mockEvent);
    });

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(result.current.installPrompt).toBe(mockEvent);
  });

  it('should handle appinstalled event', () => {
    const { result } = renderHook(() => useInstallPrompt());

    // First set a prompt
    const mockEvent = {
      preventDefault: vi.fn(),
      prompt: vi.fn(),
    };

    act(() => {
      eventListeners.beforeinstallprompt(mockEvent);
    });

    expect(result.current.installPrompt).toBe(mockEvent);

    // Then trigger appinstalled
    act(() => {
      eventListeners.appinstalled();
    });

    expect(result.current.isInstalled).toBe(true);
    expect(result.current.installPrompt).toBeNull();
  });

  it('should trigger browser install prompt', async () => {
    const { result } = renderHook(() => useInstallPrompt());

    const mockEvent = {
      preventDefault: vi.fn(),
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    };

    act(() => {
      eventListeners.beforeinstallprompt(mockEvent);
    });

    let installResult;
    await act(async () => {
      installResult = await result.current.promptInstall();
    });

    expect(mockEvent.prompt).toHaveBeenCalled();
    expect(installResult).toEqual({ outcome: 'accepted' });
    expect(result.current.installPrompt).toBeNull();
  });

  it('should return no-prompt outcome if no install prompt available', async () => {
    const { result } = renderHook(() => useInstallPrompt());

    let installResult;
    await act(async () => {
      installResult = await result.current.promptInstall();
    });

    expect(installResult).toEqual({ outcome: 'no-prompt' });
  });

  it('should handle user dismissing install prompt', async () => {
    const { result } = renderHook(() => useInstallPrompt());

    const mockEvent = {
      preventDefault: vi.fn(),
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    };

    act(() => {
      eventListeners.beforeinstallprompt(mockEvent);
    });

    let installResult;
    await act(async () => {
      installResult = await result.current.promptInstall();
    });

    expect(installResult).toEqual({ outcome: 'dismissed' });
    expect(result.current.installPrompt).toBeNull();
  });

  it('should clean up event listeners on unmount', () => {
    const { unmount } = renderHook(() => useInstallPrompt());

    unmount();

    expect(window.removeEventListener).toHaveBeenCalledWith(
      'beforeinstallprompt',
      expect.any(Function),
    );
    expect(window.removeEventListener).toHaveBeenCalledWith(
      'appinstalled',
      expect.any(Function),
    );
  });
});
