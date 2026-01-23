import { useAppContext } from '../app/AppProviders';

/**
 * Granular hook providing direct access to range comparison state.
 *
 * Reduces prop drilling by allowing components to directly access comparison
 * range state from context instead of receiving props from App.jsx.
 *
 * @returns {Object} Range comparison state and operations:
 *   - rangeA: { start: Date | null, end: Date | null } - First comparison range
 *   - setRangeA: (range) => void - Update first comparison range
 *   - rangeB: { start: Date | null, end: Date | null } - Second comparison range
 *   - setRangeB: (range) => void - Update second comparison range
 *
 * @example
 * function RangeComparisonsSection() {
 *   const { rangeA, setRangeA, rangeB, setRangeB } = useRangeComparisons();
 *
 *   return (
 *     <div>
 *       <input
 *         type="date"
 *         onChange={(e) => setRangeA(prev => ({ ...prev, start: new Date(e.target.value) }))}
 *       />
 *       <RangeComparisons rangeA={rangeA} rangeB={rangeB} />
 *     </div>
 *   );
 * }
 */
export function useRangeComparisons() {
  const { rangeA, setRangeA, rangeB, setRangeB } = useAppContext();

  return {
    rangeA,
    setRangeA,
    rangeB,
    setRangeB,
  };
}
