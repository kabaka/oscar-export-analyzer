import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { MobileNav } from './MobileNav';

describe('MobileNav', () => {
  const mockSections = [
    { id: 'overview', label: 'Overview' },
    { id: 'usage-patterns', label: 'Usage Patterns' },
    { id: 'ahi-trends', label: 'AHI Trends' },
  ];

  const mockOnNavigate = vi.fn();

  it('renders hamburger toggle button', () => {
    render(
      <MobileNav
        sections={mockSections}
        activeSectionId="overview"
        onNavigate={mockOnNavigate}
      />,
    );

    const toggleButton = screen.getByRole('button', {
      name: 'Toggle navigation menu',
    });
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    expect(toggleButton).toHaveAttribute('aria-controls', 'mobile-nav-menu');
  });

  it('does not render drawer initially', () => {
    render(
      <MobileNav
        sections={mockSections}
        activeSectionId="overview"
        onNavigate={mockOnNavigate}
      />,
    );

    const drawer = screen.queryByRole('navigation', {
      name: 'Table of Contents',
    });
    expect(drawer).not.toBeInTheDocument();
  });

  it('opens drawer when hamburger is clicked', async () => {
    const user = userEvent.setup();
    render(
      <MobileNav
        sections={mockSections}
        activeSectionId="overview"
        onNavigate={mockOnNavigate}
      />,
    );

    const toggleButton = screen.getByRole('button', {
      name: 'Toggle navigation menu',
    });
    await user.click(toggleButton);

    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

    const drawer = screen.getByRole('navigation', {
      name: 'Table of Contents',
    });
    expect(drawer).toBeInTheDocument();
    expect(drawer).toHaveAttribute('id', 'mobile-nav-menu');
  });

  it('renders all section links in drawer', async () => {
    const user = userEvent.setup();
    render(
      <MobileNav
        sections={mockSections}
        activeSectionId="overview"
        onNavigate={mockOnNavigate}
      />,
    );

    const toggleButton = screen.getByRole('button', {
      name: 'Toggle navigation menu',
    });
    await user.click(toggleButton);

    expect(screen.getByRole('link', { name: 'Overview' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Usage Patterns' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'AHI Trends' }),
    ).toBeInTheDocument();
  });

  it('highlights active section', async () => {
    const user = userEvent.setup();
    render(
      <MobileNav
        sections={mockSections}
        activeSectionId="usage-patterns"
        onNavigate={mockOnNavigate}
      />,
    );

    const toggleButton = screen.getByRole('button', {
      name: 'Toggle navigation menu',
    });
    await user.click(toggleButton);

    const activeLink = screen.getByRole('link', { name: 'Usage Patterns' });
    expect(activeLink).toHaveClass('active');
  });

  it('calls onNavigate and closes drawer when section link is clicked', async () => {
    const user = userEvent.setup();
    render(
      <MobileNav
        sections={mockSections}
        activeSectionId="overview"
        onNavigate={mockOnNavigate}
      />,
    );

    const toggleButton = screen.getByRole('button', {
      name: 'Toggle navigation menu',
    });
    await user.click(toggleButton);

    const ahiLink = screen.getByRole('link', { name: 'AHI Trends' });
    await user.click(ahiLink);

    expect(mockOnNavigate).toHaveBeenCalledWith('ahi-trends');
    expect(mockOnNavigate).toHaveBeenCalledTimes(1);

    // Drawer should be closed
    const drawer = screen.queryByRole('navigation', {
      name: 'Table of Contents',
    });
    expect(drawer).not.toBeInTheDocument();
  });

  it('closes drawer when backdrop is clicked', async () => {
    const user = userEvent.setup();
    render(
      <MobileNav
        sections={mockSections}
        activeSectionId="overview"
        onNavigate={mockOnNavigate}
      />,
    );

    const toggleButton = screen.getByRole('button', {
      name: 'Toggle navigation menu',
    });
    await user.click(toggleButton);

    const backdrop = document.querySelector('.mobile-nav-backdrop');
    expect(backdrop).toBeInTheDocument();

    await user.click(backdrop);

    const drawer = screen.queryByRole('navigation', {
      name: 'Table of Contents',
    });
    expect(drawer).not.toBeInTheDocument();
  });

  it('generates correct href for section links', async () => {
    const user = userEvent.setup();
    render(
      <MobileNav
        sections={mockSections}
        activeSectionId="overview"
        onNavigate={mockOnNavigate}
      />,
    );

    const toggleButton = screen.getByRole('button', {
      name: 'Toggle navigation menu',
    });
    await user.click(toggleButton);

    const overviewLink = screen.getByRole('link', { name: 'Overview' });
    expect(overviewLink).toHaveAttribute('href', '#overview');

    const usageLink = screen.getByRole('link', { name: 'Usage Patterns' });
    expect(usageLink).toHaveAttribute('href', '#usage-patterns');
  });

  it('renders backdrop with correct aria attributes', async () => {
    const user = userEvent.setup();
    render(
      <MobileNav
        sections={mockSections}
        activeSectionId="overview"
        onNavigate={mockOnNavigate}
      />,
    );

    const toggleButton = screen.getByRole('button', {
      name: 'Toggle navigation menu',
    });
    await user.click(toggleButton);

    const backdrop = document.querySelector('.mobile-nav-backdrop');
    expect(backdrop).toHaveAttribute('aria-hidden', 'true');
  });

  it('toggles drawer open and closed on multiple clicks', async () => {
    const user = userEvent.setup();
    render(
      <MobileNav
        sections={mockSections}
        activeSectionId="overview"
        onNavigate={mockOnNavigate}
      />,
    );

    const toggleButton = screen.getByRole('button', {
      name: 'Toggle navigation menu',
    });

    // Open
    await user.click(toggleButton);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('navigation', { name: 'Table of Contents' }),
    ).toBeInTheDocument();

    // Close
    await user.click(toggleButton);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('navigation', { name: 'Table of Contents' }),
    ).not.toBeInTheDocument();

    // Open again
    await user.click(toggleButton);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('navigation', { name: 'Table of Contents' }),
    ).toBeInTheDocument();
  });
});
