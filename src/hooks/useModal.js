import { useCallback, useState } from 'react';

/**
 * Simple modal/dialog open/close state management.
 *
 * Generic hook for managing boolean open/close state with memoized callbacks.
 * Useful for modals, dropdowns, and other toggle-able UI elements.
 *
 * @param {boolean} [initial=false] - Initial open state
 * @returns {Object} Modal state and handlers:
 *   - isOpen (boolean): Whether modal is currently open
 *   - open (Function): Open modal: () => void
 *   - close (Function): Close modal: () => void
 *
 * @example
 * const { isOpen, open, close } = useModal(false);
 * return (
 *   <>
 *     <button onClick={open}>Open</button>
 *     {isOpen && <Modal onClose={close}>Content</Modal>}
 *   </>
 * );
 */
export function useModal(initial = false) {
  const [isOpen, setIsOpen] = useState(initial);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return { isOpen, open, close };
}
