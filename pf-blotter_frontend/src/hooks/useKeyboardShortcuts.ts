import { useEffect, useCallback } from 'react';

interface Shortcuts {
  onNewOrder?: () => void;
  onEscape?: () => void;
  onToggleSound?: () => void;
  onToggleTheme?: () => void;
}

export function useKeyboardShortcuts(shortcuts: Shortcuts) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger if user is typing in an input
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      // Only allow Escape in inputs
      if (e.key === 'Escape' && shortcuts.onEscape) {
        shortcuts.onEscape();
        (target as HTMLInputElement).blur();
      }
      return;
    }

    switch (e.key.toLowerCase()) {
      case 'n':
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          shortcuts.onNewOrder?.();
        }
        break;
      case 'escape':
        shortcuts.onEscape?.();
        break;
      case 's':
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          shortcuts.onToggleSound?.();
        }
        break;
      case 't':
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          shortcuts.onToggleTheme?.();
        }
        break;
    }
  }, [shortcuts]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
