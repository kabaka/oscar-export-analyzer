import { useAppContext } from '../app/AppProviders';

/**
 * Granular hook providing direct access to clustering parameters and results.
 *
 * Reduces prop drilling by allowing components to directly access cluster
 * state from context instead of receiving props from App.jsx.
 *
 * @returns {Object} Clustering state and operations:
 *   - clusterParams: Object - Current clustering algorithm parameters
 *   - onClusterParamChange: (updates: Object) => void - Update clustering parameters
 *   - apneaClusters: Array - Computed apnea clusters from analytics processing
 *
 * @example
 * function ApneaClusterAnalysis() {
 *   const { clusterParams, onClusterParamChange, apneaClusters } = useClusterParams();
 *
 *   return (
 *     <div>
 *       <p>Found {apneaClusters.length} clusters</p>
 *       <input
 *         type="number"
 *         value={clusterParams.gapSec}
 *         onChange={(e) => onClusterParamChange({ gapSec: Number(e.target.value) })}
 *       />
 *     </div>
 *   );
 * }
 */
export function useClusterParams() {
  const { clusterParams, onClusterParamChange, apneaClusters } =
    useAppContext();

  return {
    clusterParams,
    onClusterParamChange,
    apneaClusters,
  };
}
