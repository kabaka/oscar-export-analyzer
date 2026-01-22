/* eslint-disable no-magic-numbers -- test-specific AHI values, durations, and cluster parameters */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as ACA from './ApneaClusterAnalysis';
import {
  CLUSTER_ALGORITHMS,
  CLUSTERING_DEFAULTS,
} from '../../utils/clustering';
import { APNEA_CLUSTER_MIN_EVENTS, SECONDS_PER_MINUTE } from '../../constants';
import { DEFAULT_APNEA_CLUSTER_GAP_SEC } from '../../test-utils/testConstants';

const EDGE_ENTER_THRESHOLD = CLUSTERING_DEFAULTS.EDGE_ENTER_THRESHOLD;
const EDGE_EXIT_THRESHOLD =
  EDGE_ENTER_THRESHOLD * CLUSTERING_DEFAULTS.EDGE_EXIT_FRACTION;
const BRIDGE_THRESHOLD = CLUSTERING_DEFAULTS.FLG_BRIDGE_THRESHOLD;
const MAX_CLUSTER_DURATION = 300;

const ApneaClusterAnalysis = ACA.default;

describe('ApneaClusterAnalysis overlay', () => {
  it('shows leak/pressure chart when selecting a cluster', async () => {
    const base = new Date('2021-01-01T00:00:00Z');
    const cluster = {
      start: new Date(base.getTime() + SECONDS_PER_MINUTE * 1000),
      end: new Date(base.getTime() + 2 * SECONDS_PER_MINUTE * 1000),
      durationSec: CLUSTERING_DEFAULTS.MIN_CLUSTER_DURATION_SEC,
      count: APNEA_CLUSTER_MIN_EVENTS,
      severity: 1,
      events: [
        {
          date: new Date(base.getTime() + SECONDS_PER_MINUTE * 1000),
          durationSec: 10,
        },
        { date: new Date(base.getTime() + 80000), durationSec: 10 },
        { date: new Date(base.getTime() + 100000), durationSec: 10 },
      ],
    };
    const details = [
      {
        Event: 'Leak',
        'Data/Duration': 20,
        DateTime: new Date(base.getTime() + 55000).toISOString(),
      },
      {
        Event: 'Pressure',
        'Data/Duration': 8,
        DateTime: new Date(base.getTime() + 70000).toISOString(),
      },
    ];
    const params = {
      algorithm: CLUSTER_ALGORITHMS.BRIDGED,
      gapSec: DEFAULT_APNEA_CLUSTER_GAP_SEC,
      bridgeThreshold: BRIDGE_THRESHOLD,
      bridgeSec: CLUSTERING_DEFAULTS.FLG_CLUSTER_GAP_SEC,
      edgeEnter: EDGE_ENTER_THRESHOLD,
      edgeExit: EDGE_EXIT_THRESHOLD,
      minCount: 1,
      minTotalSec: 0,
      maxClusterSec: MAX_CLUSTER_DURATION,
      minDensity: 0,
    };
    render(
      <ApneaClusterAnalysis
        clusters={[cluster]}
        params={params}
        onParamChange={() => {}}
        details={details}
      />,
    );
    const rows = screen.getAllByRole('row');
    await userEvent.click(rows[1]);
    expect(
      await screen.findByText(/Leak\/Pressure around Cluster/),
    ).toBeInTheDocument();
  });
});

describe('ApneaClusterAnalysis memoization', () => {
  it('exports a memoized component', () => {
    expect(ApneaClusterAnalysis.type).toBe(ACA.ApneaClusterAnalysis);
  });
});

describe('ApneaClusterAnalysis params', () => {
  it('renders parameter inputs and forwards changes', async () => {
    const params = {
      algorithm: CLUSTER_ALGORITHMS.BRIDGED,
      gapSec: DEFAULT_APNEA_CLUSTER_GAP_SEC,
      bridgeThreshold: BRIDGE_THRESHOLD,
      bridgeSec: CLUSTERING_DEFAULTS.FLG_CLUSTER_GAP_SEC,
      edgeEnter: EDGE_ENTER_THRESHOLD,
      edgeExit: EDGE_EXIT_THRESHOLD,
      minCount: 1,
      minTotalSec: 0,
      maxClusterSec: MAX_CLUSTER_DURATION,
      minDensity: 0,
    };
    const onChange = vi.fn();
    render(
      <ApneaClusterAnalysis
        clusters={[]}
        params={params}
        onParamChange={onChange}
        details={[]}
      />,
    );
    const allLabels = ACA.PARAM_FIELDS_BY_ALGORITHM[
      CLUSTER_ALGORITHMS.BRIDGED
    ].map(({ label }) => label);
    allLabels.forEach((label) => {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Algorithm')).toBeInTheDocument();
    const gap = screen.getByLabelText('Gap sec');
    fireEvent.change(gap, { target: { value: '30' } });
    expect(onChange).toHaveBeenLastCalledWith({ gapSec: 30 });
  });

  it('switches visible parameters when algorithm changes', async () => {
    const params = {
      algorithm: CLUSTER_ALGORITHMS.BRIDGED,
      gapSec: DEFAULT_APNEA_CLUSTER_GAP_SEC,
      bridgeThreshold: BRIDGE_THRESHOLD,
      bridgeSec: CLUSTERING_DEFAULTS.FLG_CLUSTER_GAP_SEC,
      edgeEnter: EDGE_ENTER_THRESHOLD,
      edgeExit: EDGE_EXIT_THRESHOLD,
      minCount: 1,
      minTotalSec: 0,
      maxClusterSec: MAX_CLUSTER_DURATION,
      minDensity: 0,
      k: 3,
      linkageThresholdSec: DEFAULT_APNEA_CLUSTER_GAP_SEC,
    };
    const onChange = vi.fn();
    const { rerender } = render(
      <ApneaClusterAnalysis
        clusters={[]}
        params={params}
        onParamChange={onChange}
        details={[]}
      />,
    );
    expect(screen.getByLabelText('Gap sec')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Algorithm'), 'kmeans');
    expect(onChange).toHaveBeenCalledWith({ algorithm: 'kmeans' });
    rerender(
      <ApneaClusterAnalysis
        clusters={[]}
        params={{ ...params, algorithm: CLUSTER_ALGORITHMS.KMEANS }}
        onParamChange={onChange}
        details={[]}
      />,
    );
    expect(screen.queryByLabelText('Gap sec')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Clusters (k)')).toBeInTheDocument();
  });
});
