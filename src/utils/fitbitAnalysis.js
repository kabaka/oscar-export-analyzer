/**
 * OSCAR-Fitbit Integration Analysis Functions
 *
 * Comprehensive analysis pipeline demonstrating the full integration of OSCAR CPAP data
 * with Fitbit physiological metrics. Provides medical professionals with statistical
 * insights into therapy effectiveness and personalized treatment optimization.
 *
 * @module utils/fitbitAnalysis
 */

import { createNightlyRecord } from './fitbitModels.js';
import { alignOscarFitbitNights, imputeMissingValues } from './fitbitSync.js';
import {
  computeOscarFitbitCorrelations,
  spearmanCorrelation,
  crossCorrelation,
} from './fitbitCorrelation.js';
import { pearson, quantile, QUARTILE_MEDIAN } from './stats.js';

/**
 * Main analysis pipeline for OSCAR-Fitbit integration.
 * Orchestrates data alignment, validation, correlation analysis, and medical insights.
 *
 * @param {Object[]} oscarSummaryData - Parsed OSCAR summary CSV data
 * @param {Object[]} fitbitNightlyData - Fitbit nightly physiological data
 * @param {Object} options - Analysis configuration
 * @returns {Object} Comprehensive analysis results
 */
export function analyzeOscarFitbitIntegration(
  oscarSummaryData,
  fitbitNightlyData,
  options = {},
) {
  const {
    imputationMethod = 'regression',
    minNightsRequired = 7,
    enableAdvancedAnalysis = true,
  } = options;

  console.log('Starting OSCAR-Fitbit integration analysis...');

  // Step 1: Temporal alignment and validation
  console.log('Aligning OSCAR and Fitbit datasets...');
  const alignment = alignOscarFitbitNights(oscarSummaryData, fitbitNightlyData);

  if (alignment.aligned.length < minNightsRequired) {
    return {
      success: false,
      error: `Insufficient aligned nights (${alignment.aligned.length} < ${minNightsRequired})`,
      alignment: alignment.statistics,
    };
  }

  console.log(
    `Successfully aligned ${alignment.aligned.length} nights (${(alignment.statistics.matchRate * 100).toFixed(1)}% match rate)`,
  );

  // Step 2: Create unified nightly records
  const unifiedRecords = alignment.aligned.map(
    ({ oscar, fitbit, sleepDate, validation }) =>
      createNightlyRecord({
        date: sleepDate,
        oscar: normalizeOscarRecord(oscar),
        fitbit: fitbit.fitbit, // Extract from wrapper
        dataQuality: {
          oscarDataComplete: validation.oscarComplete,
          fitbitDataComplete: validation.fitbitComplete,
          overlapHours: validation.overlapHours,
          timeDifference: validation.timeDifference,
          excluded: !validation.valid,
          excludeReason: validation.valid ? null : validation.errors.join('; '),
        },
      }),
  );

  // Step 3: Data quality assessment
  console.log('Validating data quality...');
  const qualityAssessment = assessDataQuality(unifiedRecords);

  // Step 4: Handle missing data through imputation
  let analysisRecords = unifiedRecords.filter((r) => !r.dataQuality.excluded);
  if (qualityAssessment.missingDataRate > 0.1) {
    // >10% missing data
    console.log(
      `Applying ${imputationMethod} imputation for missing values...`,
    );
    analysisRecords = imputeMissingValues(analysisRecords, imputationMethod);
  }

  // Step 5: Core correlation analysis
  console.log('Computing OSCAR-Fitbit correlations...');
  const correlationAnalysis = computeOscarFitbitCorrelations(analysisRecords);

  // Step 6: Advanced statistical analysis
  let advancedAnalysis = null;
  if (enableAdvancedAnalysis && analysisRecords.length >= 14) {
    console.log('Performing advanced time-series analysis...');
    advancedAnalysis = performAdvancedAnalysis(analysisRecords);
  }

  // Step 7: Clinical insights and recommendations
  const clinicalInsights = generateClinicalInsights(
    correlationAnalysis,
    advancedAnalysis,
    qualityAssessment,
  );

  console.log('OSCAR-Fitbit analysis complete!');

  return {
    success: true,
    analysisDate: new Date().toISOString(),

    // Data overview
    dataOverview: {
      totalNights: unifiedRecords.length,
      analysisNights: analysisRecords.length,
      matchRate: alignment.statistics.matchRate,
      dataQuality: qualityAssessment,
      excludedNights: unifiedRecords.filter((r) => r.dataQuality.excluded)
        .length,
    },

    // Core results
    correlations: correlationAnalysis,
    advancedAnalysis,
    clinicalInsights,

    // Raw data for further analysis
    alignedRecords: analysisRecords,
    alignmentStatistics: alignment.statistics,
    unmatchedData: alignment.unmatched,
  };
}

/**
 * Performs therapy effectiveness analysis comparing OSCAR and Fitbit outcomes.
 *
 * @param {Object[]} records - Unified nightly records
 * @returns {Object} Therapy effectiveness metrics
 */
export function analyzeTherapyEffectiveness(records) {
  const effectivenessMetrics = {};

  // Extract key therapeutic variables
  const ahiValues = records
    .map((r) => r.oscar.ahi)
    .filter((v) => Number.isFinite(v));
  const usageHours = records
    .map((r) => r.oscar.usage.totalMinutes / 60)
    .filter((v) => Number.isFinite(v));
  const epapValues = records
    .map((r) => r.oscar.pressures.epap)
    .filter((v) => Number.isFinite(v));

  // Extract key physiological outcomes
  const hrvValues = records
    .map((r) => r.fitbit.heartRate.hrv.rmssd)
    .filter((v) => Number.isFinite(v));
  const sleepEfficiency = records
    .map((r) => r.fitbit.sleepStages.sleepEfficiency)
    .filter((v) => Number.isFinite(v));
  const minSpO2Values = records
    .map((r) => r.fitbit.oxygenSaturation.minPercent)
    .filter((v) => Number.isFinite(v));

  // 1. AHI Control Analysis
  if (ahiValues.length > 0) {
    effectivenessMetrics.ahiControl = {
      median: quantile(ahiValues, QUARTILE_MEDIAN),
      controlledNights: ahiValues.filter((ahi) => ahi < 5).length,
      controlRate: ahiValues.filter((ahi) => ahi < 5).length / ahiValues.length,
      severeNights: ahiValues.filter((ahi) => ahi > 30).length,
      improvementTrend: computeLinearTrend(ahiValues),
    };
  }

  // 2. Physiological Response Analysis
  if (hrvValues.length > 0 && ahiValues.length > 0) {
    const ahiHrvCorr = spearmanCorrelation(ahiValues, hrvValues);
    effectivenessMetrics.physiologicalResponse = {
      ahiHrvCorrelation: ahiHrvCorr.correlation,
      significantResponse: ahiHrvCorr.pValue < 0.05,
      hrvImprovement: computeLinearTrend(hrvValues),
      medianHrv: quantile(hrvValues, QUARTILE_MEDIAN),
    };
  }

  // 3. Sleep Quality Impact
  if (sleepEfficiency.length > 0 && usageHours.length > 0) {
    const usageEfficiencyCorr = spearmanCorrelation(
      usageHours,
      sleepEfficiency,
    );
    effectivenessMetrics.sleepQuality = {
      usageEfficiencyCorrelation: usageEfficiencyCorr.correlation,
      significantImprovement: usageEfficiencyCorr.pValue < 0.05,
      medianEfficiency: quantile(sleepEfficiency, QUARTILE_MEDIAN),
      optimalEfficiencyNights: sleepEfficiency.filter((eff) => eff > 85).length,
    };
  }

  // 4. Oxygenation Assessment
  if (minSpO2Values.length > 0 && epapValues.length > 0) {
    const epapSpO2Corr = spearmanCorrelation(epapValues, minSpO2Values);
    effectivenessMetrics.oxygenation = {
      epapSpO2Correlation: epapSpO2Corr.correlation,
      pressureBenefit: epapSpO2Corr.pValue < 0.05,
      medianMinSpO2: quantile(minSpO2Values, QUARTILE_MEDIAN),
      hypoxemicNights: minSpO2Values.filter((spo2) => spo2 < 90).length,
    };
  }

  // 5. Overall Therapy Score
  const therapyScore = computeTherapyEffectivenessScore(effectivenessMetrics);
  effectivenessMetrics.overallScore = therapyScore;

  return effectivenessMetrics;
}

/**
 * Generates personalized treatment recommendations based on integrated analysis.
 *
 * @param {Object} correlationResults - Correlation analysis results
 * @param {Object} effectivenessResults - Therapy effectiveness results
 * @returns {Object[]} Array of clinical recommendations
 */
export function generateTreatmentRecommendations(
  correlationResults,
  effectivenessResults,
) {
  const recommendations = [];

  // Pressure optimization recommendations
  if (effectivenessResults.oxygenation?.epapSpO2Correlation > 0.3) {
    recommendations.push({
      category: 'pressure_optimization',
      priority: 'high',
      recommendation: 'EPAP increase may improve oxygenation',
      evidence: `Strong correlation between EPAP and SpO2 (ρ=${effectivenessResults.oxygenation.epapSpO2Correlation.toFixed(2)})`,
      action: 'Consider gradual EPAP titration under medical supervision',
    });
  }

  // Adherence optimization
  if (effectivenessResults.sleepQuality?.usageEfficiencyCorrelation > 0.4) {
    recommendations.push({
      category: 'adherence',
      priority: 'medium',
      recommendation: 'Increased usage correlates with better sleep quality',
      evidence: `Usage-efficiency correlation: ρ=${effectivenessResults.sleepQuality.usageEfficiencyCorrelation.toFixed(2)}`,
      action: 'Focus on adherence improvement strategies (comfort, education)',
    });
  }

  // AHI control recommendations
  if (effectivenessResults.ahiControl?.controlRate < 0.7) {
    // <70% of nights controlled
    const medianAhi = effectivenessResults.ahiControl?.median;
    recommendations.push({
      category: 'ahi_control',
      priority: 'high',
      recommendation: `AHI control suboptimal (${(effectivenessResults.ahiControl.controlRate * 100).toFixed(0)}% of nights <5 events/hr)`,
      evidence: `Median AHI: ${medianAhi != null && Number.isFinite(medianAhi) ? medianAhi.toFixed(1) : 'N/A'} events/hr`,
      action: 'Review pressure settings, mask fit, and treatment algorithm',
    });
  }

  // Physiological response monitoring
  if (effectivenessResults.physiologicalResponse?.significantResponse) {
    const correlation =
      effectivenessResults.physiologicalResponse.ahiHrvCorrelation;
    if (correlation < -0.3) {
      recommendations.push({
        category: 'monitoring',
        priority: 'low',
        recommendation:
          'Strong AHI-HRV relationship detected - continue monitoring',
        evidence: `AHI negatively correlates with HRV (ρ=${correlation.toFixed(2)})`,
        action: 'Track HRV trends as therapy effectiveness indicator',
      });
    }
  }

  // Hypoxemia management
  if (effectivenessResults.oxygenation?.hypoxemicNights > 0) {
    const hypoxemicRate =
      effectivenessResults.oxygenation.hypoxemicNights /
      correlationResults.sampleSize;
    recommendations.push({
      category: 'oxygenation',
      priority: 'high',
      recommendation: `Frequent hypoxemia detected (${(hypoxemicRate * 100).toFixed(0)}% of nights)`,
      evidence: `Median minimum SpO2: ${effectivenessResults.oxygenation.medianMinSpO2.toFixed(1)}%`,
      action: 'Consider oxygen supplementation or advanced PAP modes',
    });
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
}

// Helper functions

function normalizeOscarRecord(oscarRow) {
  return {
    ahi: parseFloat(oscarRow.AHI) || NaN,
    centralAhi: parseFloat(oscarRow['Central AHI']) || NaN,
    obstructiveAhi: parseFloat(oscarRow['Obstructive AHI']) || NaN,
    hypopneaAhi: parseFloat(oscarRow['Hypopnea AHI']) || NaN,

    pressures: {
      epap: parseFloat(oscarRow['Median EPAP']) || NaN,
      ipap: parseFloat(oscarRow['Median IPAP']) || NaN,
      meanPressure: parseFloat(oscarRow['Mean Pressure']) || NaN,
      maxPressure: parseFloat(oscarRow['Max Pressure']) || NaN,
    },

    usage: {
      totalMinutes: parseFloat(oscarRow['Total Time']) * 60 || NaN, // Convert hours to minutes
      leakPercent: parseFloat(oscarRow['Leak Rate Median']) || NaN,
    },

    events: [], // Would be populated from details data if available
  };
}

function assessDataQuality(records) {
  const totalRecords = records.length;
  const validRecords = records.filter((r) => !r.dataQuality.excluded);

  let missingFields = 0;
  let totalFields = 0;

  records.forEach((record) => {
    const requiredFields = [
      record.oscar.ahi,
      record.oscar.usage.totalMinutes,
      record.fitbit.heartRate.avgSleepBpm,
      record.fitbit.sleepStages.totalSleepMinutes,
    ];

    totalFields += requiredFields.length;
    missingFields += requiredFields.filter(
      (field) => !Number.isFinite(field),
    ).length;
  });

  return {
    totalRecords,
    validRecords: validRecords.length,
    excludedRecords: totalRecords - validRecords.length,
    missingDataRate: missingFields / totalFields,
    qualityScore: validRecords.length / totalRecords,
  };
}

function performAdvancedAnalysis(records) {
  const analysis = {};

  // Extract time series for advanced analysis
  const ahiSeries = records
    .map((r) => r.oscar.ahi)
    .filter((v) => Number.isFinite(v));
  const hrvSeries = records
    .map((r) => r.fitbit.heartRate.hrv.rmssd)
    .filter((v) => Number.isFinite(v));

  // Cross-correlation analysis for lag detection
  if (ahiSeries.length >= 14 && hrvSeries.length >= 14) {
    const ccfResult = crossCorrelation(ahiSeries, hrvSeries, { maxLag: 7 });
    analysis.lagAnalysis = {
      optimalLag: ccfResult.peak.lag,
      peakCorrelation: ccfResult.peak.correlation,
      isSignificant: ccfResult.isSignificant,
      interpretation: interpretLagAnalysis(
        ccfResult.peak.lag,
        ccfResult.peak.correlation,
      ),
    };
  }

  // Trend analysis
  analysis.trends = {
    ahiTrend: computeLinearTrend(ahiSeries),
    hrvTrend: computeLinearTrend(hrvSeries),
  };

  return analysis;
}

function generateClinicalInsights(
  correlationResults,
  advancedAnalysis,
  qualityAssessment,
) {
  const insights = [];

  // Data quality insights
  if (qualityAssessment.qualityScore < 0.8) {
    insights.push({
      type: 'data_quality',
      severity: 'warning',
      message: `Data quality score: ${(qualityAssessment.qualityScore * 100).toFixed(0)}% - consider improving data collection consistency`,
    });
  }

  // Correlation insights
  Object.entries(correlationResults.correlations).forEach(([, result]) => {
    if (result.pValue < 0.01 && Math.abs(result.correlation) > 0.4) {
      insights.push({
        type: 'correlation',
        severity: 'info',
        message: `Strong ${result.expected} correlation detected: ${result.clinical}`,
        statistical: `ρ=${result.correlation.toFixed(2)}, p=${result.pValue.toExponential(2)}`,
      });
    }
  });

  // Advanced analysis insights
  if (advancedAnalysis?.lagAnalysis?.isSignificant) {
    insights.push({
      type: 'temporal',
      severity: 'info',
      message: advancedAnalysis.lagAnalysis.interpretation,
    });
  }

  return insights;
}

function computeLinearTrend(values) {
  if (values.length < 3) return { slope: NaN, trend: 'insufficient_data' };

  const n = values.length;
  const x = Array.from({ length: n }, (_, i) => i);

  const correlation = pearson(x, values);
  const slope =
    correlation * (standardDeviation(values) / standardDeviation(x));

  let trend = 'stable';
  if (slope > 0.1) trend = 'improving';
  else if (slope < -0.1) trend = 'worsening';

  return { slope, trend, correlation };
}

function standardDeviation(values) {
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + (val - mean) ** 2, 0) /
    (values.length - 1);
  return Math.sqrt(variance);
}

function computeTherapyEffectivenessScore(metrics) {
  let score = 0;
  let components = 0;

  // AHI control component (0-25 points)
  if (metrics.ahiControl) {
    score += metrics.ahiControl.controlRate * 25;
    components++;
  }

  // Physiological response component (0-25 points)
  if (
    metrics.physiologicalResponse &&
    metrics.physiologicalResponse.significantResponse
  ) {
    score += Math.abs(metrics.physiologicalResponse.ahiHrvCorrelation) * 25;
    components++;
  }

  // Sleep quality component (0-25 points)
  if (metrics.sleepQuality) {
    score += Math.min((metrics.sleepQuality.medianEfficiency / 85) * 25, 25);
    components++;
  }

  // Oxygenation component (0-25 points)
  if (metrics.oxygenation) {
    const oxyScore = Math.min(
      ((metrics.oxygenation.medianMinSpO2 - 85) / 10) * 25,
      25,
    );
    score += Math.max(oxyScore, 0);
    components++;
  }

  return components > 0 ? (score / components) * (components / 4) : 0; // Normalize and weight by completeness
}

function interpretLagAnalysis(lag, correlation) {
  if (Math.abs(correlation) < 0.3) {
    return 'No significant temporal relationship detected between AHI and HRV';
  }

  if (lag === 0) {
    return 'AHI and HRV show immediate same-night relationship';
  } else if (lag > 0) {
    return `HRV changes lead AHI changes by ${lag} night(s) - physiological adaptation precedes therapy response`;
  } else {
    return `AHI changes lead HRV changes by ${Math.abs(lag)} night(s) - therapy affects physiology with ${Math.abs(lag)}-night delay`;
  }
}
