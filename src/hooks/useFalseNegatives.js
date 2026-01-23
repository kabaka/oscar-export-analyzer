import { useAppContext } from '../app/AppProviders';

/**
 * Granular hook providing direct access to false negative detection state.
 *
 * Reduces prop drilling by allowing components to directly access false negative
 * state from context instead of receiving props from App.jsx.
 *
 * @returns {Object} False negative state and operations:
 *   - falseNegatives: Array - Detected false negative clusters
 *   - fnPreset: string - Current detection preset ('strict', 'balanced', 'lenient')
 *   - setFnPreset: (preset: string) => void - Change detection preset
 *
 * @example
 * function FalseNegativesAnalysis() {
 *   const { falseNegatives, fnPreset, setFnPreset } = useFalseNegatives();
 *
 *   return (
 *     <div>
 *       <p>Found {falseNegatives.length} potential false negatives</p>
 *       <select value={fnPreset} onChange={(e) => setFnPreset(e.target.value)}>
 *         <option value="strict">Strict</option>
 *         <option value="balanced">Balanced</option>
 *         <option value="lenient">Lenient</option>
 *       </select>
 *     </div>
 *   );
 * }
 */
export function useFalseNegatives() {
  const { falseNegatives, fnPreset, setFnPreset } = useAppContext();

  return {
    falseNegatives,
    fnPreset,
    setFnPreset,
  };
}
