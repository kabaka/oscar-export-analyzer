/**
 * Re-exports theme helpers from DataContext so consumers can import from the hooks directory.
 *
 * @returns {{ theme: string, setTheme: (next: string) => void }} Theme state and setter.
 */
export { useTheme, THEMES } from '../context/DataContext';
