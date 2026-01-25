import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { AppProviders } from './app/AppProviders';
import { AppShell } from './App';

describe('Post-install onboarding', () => {
  beforeEach(() => {
    // Ensure onboarding is not marked complete
    localStorage.removeItem('onboarding-completed');
  });

  it('shows onboarding after appinstalled and persists completion', async () => {
    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

    // Dispatch appinstalled to trigger onboarding
    window.dispatchEvent(new Event('appinstalled'));

    const dialog = await screen.findByRole('dialog', {
      name: /welcome to oscar analyzer/i,
    });
    expect(dialog).toBeInTheDocument();

    const gotItBtn = screen.getByRole('button', { name: /got it/i });
    await userEvent.click(gotItBtn);

    // Completion should persist to localStorage
    expect(localStorage.getItem('onboarding-completed')).toBe('true');
  });
});
