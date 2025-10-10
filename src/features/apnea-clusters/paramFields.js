import { CLUSTER_ALGORITHMS } from '../../utils/clustering';

const SHARED_PARAM_FIELDS = [
  {
    label: 'Min event count',
    key: 'minCount',
    inputProps: { type: 'number', min: 1 },
  },
  {
    label: 'Min total apnea sec',
    key: 'minTotalSec',
    inputProps: { type: 'number', min: 0 },
  },
  {
    label: 'Max cluster sec',
    key: 'maxClusterSec',
    inputProps: { type: 'number', min: 0 },
  },
  {
    label: 'Min density (evt/min)',
    key: 'minDensity',
    inputProps: { type: 'number', step: 0.1, min: 0 },
  },
];

const BRIDGED_PARAM_FIELDS = [
  { label: 'Gap sec', key: 'gapSec', inputProps: { type: 'number', min: 0 } },
  {
    label: 'FLG bridge ≥',
    key: 'bridgeThreshold',
    inputProps: { type: 'number', step: 0.05, min: 0, max: 2 },
  },
  {
    label: 'FLG gap sec',
    key: 'bridgeSec',
    inputProps: { type: 'number', min: 0 },
  },
  {
    label: 'Edge enter ≥',
    key: 'edgeEnter',
    inputProps: { type: 'number', step: 0.05, min: 0, max: 2 },
  },
  {
    label: 'Edge exit ≥',
    key: 'edgeExit',
    inputProps: { type: 'number', step: 0.05, min: 0, max: 2 },
  },
];

const KMEANS_PARAM_FIELDS = [
  {
    label: 'Clusters (k)',
    key: 'k',
    inputProps: { type: 'number', min: 1, step: 1 },
  },
];

const AGGLOMERATIVE_PARAM_FIELDS = [
  {
    label: 'Linkage gap sec',
    key: 'linkageThresholdSec',
    inputProps: { type: 'number', min: 0 },
  },
];

export const PARAM_FIELDS_BY_ALGORITHM = {
  [CLUSTER_ALGORITHMS.BRIDGED]: [
    ...BRIDGED_PARAM_FIELDS,
    ...SHARED_PARAM_FIELDS,
  ],
  [CLUSTER_ALGORITHMS.KMEANS]: [...KMEANS_PARAM_FIELDS, ...SHARED_PARAM_FIELDS],
  [CLUSTER_ALGORITHMS.AGGLOMERATIVE]: [
    ...AGGLOMERATIVE_PARAM_FIELDS,
    ...SHARED_PARAM_FIELDS,
  ],
};
