# Accessibility Conformance

ChipRatio is committed to providing an accessible poker chip distribution calculator for all players, regardless of technology or ability.

## Conformance Target

This project targets **WCAG 2.2 Level AA** conformance across all pages and views.

## Key Accessibility Features

- **Keyboard Navigation & Focus Management**:
  - All interactive elements (segmented mode pickers, number counters, quick-pick pills, chip set selectors, color pickers, and copy buttons) are operable using keyboard navigation alone.
  - No keyboard traps exist. Interactive overlays (such as the chip color swatch picker) support `Escape` dismissal and cycle focus within the menu.
  - High-contrast visible focus indicators (`:focus-visible`) with at least 3:1 contrast against backgrounds in all five color themes.
  - Skip links to primary content are available on all routes.

- **Color & Contrast**:
  - Text and essential interactive elements meet or exceed the 4.5:1 contrast ratio requirement against their backgrounds across all themes (Felt, Midnight, Ivory, Rose, Neon).
  - Chip denominations use distinct values and text labels in addition to color indicators to ensure color is not the only visual means of conveying information (WCAG 1.4.1).

- **Label in Name**:
  - Accessible names for controls (including the theme toggle button and swatch buttons) include their visual label strings (WCAG 2.5.3).

- **Reflow & Responsive Design**:
  - Layouts reflow seamlessly down to 320px width without horizontal scrolling or loss of functionality (WCAG 1.4.10).
  - Long URLs and text wrap appropriately to preserve responsive boundaries.

- **Screen Reader Support & Live Announcements**:
  - Status updates and calculation results use appropriate ARIA live regions (`aria-live="polite"` / `role="status"`) to announce calculation adjustments or validation messages.
  - Form controls include explicit programmatic labels and input modes (`inputmode="numeric"`, `inputmode="decimal"`).

- **Reduced Motion**:
  - Respects the `prefers-reduced-motion` user preference by disabling transitions and smooth scrolling when requested.

## Evaluation & Testing

Conformance was evaluated using:
- Automated testing via `axe-core` covering WCAG 2.0, 2.1, and 2.2 AA rule sets across multiple viewports (1440×900, 390×844, 320×800) on all routes.
- Manual keyboard testing and focus order verification.
- Mobile viewport reflow testing at 320px width.

## Feedback & Barrier Reporting

If you encounter an accessibility barrier or have a suggestion for improving the accessibility of ChipRatio, please submit an issue at:
https://github.com/KarthikSubramanian07/ChipRatio/issues
