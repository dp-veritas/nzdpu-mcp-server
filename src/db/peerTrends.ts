/**
 * Time-series peer analytics
 * FIX-H3: Addresses Limitation L6.3 and L6.4 from testing
 */

import { getDatabase } from './schema.js';

export interface PeerTrendDataPoint {
  year: number;
  count: number; // Number of companies with data this year
  mean: number;
  median: number;
  min: number;
  max: number;
  percentile25: number;
  percentile75: number;
}

export interface PeerTrendResult {
  filters: {
    scope: string;
    jurisdiction?: string;
    sics_sector?: string;
    sics_sub_sector?: string;
  };
  yearRange: {
    start: number;
    end: number;
    totalYears: number;
  };
  dataPoints: PeerTrendDataPoint[];

  // Overall trend analysis
  overallTrendDirection: 'increasing' | 'decreasing' | 'stable' | 'insufficient_data';
  meanChange: number | null; // Absolute change from first to last year
  meanChangePercent: number | null; // Percent change in mean
  averageAnnualChange: number | null; // Average year-over-year change
  averageAnnualGrowthRate: number | null; // CAGR for mean values
}

/**
 * Get time-series trend for a peer group across multiple years
 */
export function getPeerTrend(
  scope: 'scope1' | 'scope2_lb' | 'scope2_mb' | 'scope3',
  filters: {
    jurisdiction?: string;
    sics_sector?: string;
    sics_sub_sector?: string;
  },
  startYear?: number,
  endYear?: number
): PeerTrendResult {
  const db = getDatabase();

  // Map scope to column
  const column = scope === 'scope3' ? 'scope3_total' : scope;

  // Build WHERE clause
  let whereClause = `e.${column} IS NOT NULL AND e.${column} > 0`;
  const params: (string | number)[] = [];

  if (filters.jurisdiction) {
    whereClause += ' AND LOWER(c.jurisdiction) = LOWER(?)';
    params.push(filters.jurisdiction);
  }
  if (filters.sics_sector) {
    whereClause += ' AND LOWER(c.sics_sector) = LOWER(?)';
    params.push(filters.sics_sector);
  }
  if (filters.sics_sub_sector) {
    whereClause += ' AND LOWER(c.sics_sub_sector) = LOWER(?)';
    params.push(filters.sics_sub_sector);
  }

  // Determine year range if not specified
  if (!startYear || !endYear) {
    const yearRangeQuery = `
      SELECT MIN(e.year) as min_year, MAX(e.year) as max_year
      FROM emissions e
      JOIN companies c ON e.nz_id = c.nz_id
      WHERE ${whereClause}
    `;
    const yearRange = db.prepare(yearRangeQuery).get(...params) as { min_year: number; max_year: number } | undefined;

    if (!yearRange) {
      return createEmptyTrendResult(scope, filters, startYear || 0, endYear || 0);
    }

    startYear = startYear || yearRange.min_year;
    endYear = endYear || yearRange.max_year;
  }

  // Get statistics for each year
  const dataPoints: PeerTrendDataPoint[] = [];

  for (let year = startYear; year <= endYear; year++) {
    const yearWhereClause = `${whereClause} AND e.year = ?`;
    const yearParams = [...params, year];

    // Get all values for this year
    const valuesQuery = `
      SELECT e.${column} as value
      FROM emissions e
      JOIN companies c ON e.nz_id = c.nz_id
      WHERE ${yearWhereClause}
      ORDER BY e.${column}
    `;

    const values = db.prepare(valuesQuery).all(...yearParams) as { value: number }[];

    if (values.length === 0) {
      continue; // Skip years with no data
    }

    const sortedValues = values.map(v => v.value).sort((a, b) => a - b);
    const count = sortedValues.length;
    const sum = sortedValues.reduce((a, b) => a + b, 0);
    const mean = sum / count;

    // Calculate median
    const midpoint = Math.floor(count / 2);
    const median = count % 2 === 0
      ? (sortedValues[midpoint - 1] + sortedValues[midpoint]) / 2
      : sortedValues[midpoint];

    // Calculate percentiles
    const p25Index = Math.floor(count * 0.25);
    const p75Index = Math.floor(count * 0.75);

    dataPoints.push({
      year,
      count,
      mean,
      median,
      min: sortedValues[0],
      max: sortedValues[count - 1],
      percentile25: sortedValues[p25Index],
      percentile75: sortedValues[p75Index],
    });
  }

  // Analyze overall trend
  const analysis = analyzeTrend(dataPoints);

  return {
    filters: {
      scope,
      jurisdiction: filters.jurisdiction,
      sics_sector: filters.sics_sector,
      sics_sub_sector: filters.sics_sub_sector,
    },
    yearRange: {
      start: startYear,
      end: endYear,
      totalYears: endYear - startYear + 1,
    },
    dataPoints,
    ...analysis,
  };
}

/**
 * Analyze trend direction and calculate summary statistics
 */
function analyzeTrend(dataPoints: PeerTrendDataPoint[]): {
  overallTrendDirection: 'increasing' | 'decreasing' | 'stable' | 'insufficient_data';
  meanChange: number | null;
  meanChangePercent: number | null;
  averageAnnualChange: number | null;
  averageAnnualGrowthRate: number | null;
} {
  if (dataPoints.length < 2) {
    return {
      overallTrendDirection: 'insufficient_data',
      meanChange: null,
      meanChangePercent: null,
      averageAnnualChange: null,
      averageAnnualGrowthRate: null,
    };
  }

  const firstPoint = dataPoints[0];
  const lastPoint = dataPoints[dataPoints.length - 1];
  const yearsApart = lastPoint.year - firstPoint.year;

  // Calculate mean change
  const meanChange = lastPoint.mean - firstPoint.mean;
  const meanChangePercent = (meanChange / firstPoint.mean) * 100;

  // Calculate average annual change (simple average of year-over-year changes)
  let totalYoYChange = 0;
  let yoyCount = 0;

  for (let i = 1; i < dataPoints.length; i++) {
    const change = dataPoints[i].mean - dataPoints[i - 1].mean;
    totalYoYChange += change;
    yoyCount++;
  }

  const averageAnnualChange = yoyCount > 0 ? totalYoYChange / yoyCount : null;

  // Calculate CAGR (Compound Annual Growth Rate)
  const averageAnnualGrowthRate =
    yearsApart > 0 && firstPoint.mean > 0
      ? (Math.pow(lastPoint.mean / firstPoint.mean, 1 / yearsApart) - 1) * 100
      : null;

  // Determine trend direction (using simple threshold)
  let overallTrendDirection: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (Math.abs(meanChangePercent) > 5) {
    // More than 5% change is considered a trend
    overallTrendDirection = meanChangePercent > 0 ? 'increasing' : 'decreasing';
  }

  return {
    overallTrendDirection,
    meanChange,
    meanChangePercent,
    averageAnnualChange,
    averageAnnualGrowthRate,
  };
}

/**
 * Create empty result when no data found
 */
function createEmptyTrendResult(
  scope: string,
  filters: {
    jurisdiction?: string;
    sics_sector?: string;
    sics_sub_sector?: string;
  },
  startYear: number,
  endYear: number
): PeerTrendResult {
  return {
    filters: {
      scope,
      ...filters,
    },
    yearRange: {
      start: startYear,
      end: endYear,
      totalYears: endYear - startYear + 1,
    },
    dataPoints: [],
    overallTrendDirection: 'insufficient_data',
    meanChange: null,
    meanChangePercent: null,
    averageAnnualChange: null,
    averageAnnualGrowthRate: null,
  };
}
