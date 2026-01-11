/**
 * Year-to-year comparison functions
 * FIX-H2: Addresses Limitation L6.1 and L6.2 from testing
 */

import { getDatabase } from './schema.js';
import type { EmissionsRow } from './queries.js';

export interface YearComparisonResult {
  nz_id: number;
  company_name: string;
  year1: number;
  year2: number;
  yearsApart: number;

  // Scope 1
  scope1_year1: number | null;
  scope1_year2: number | null;
  scope1_delta: number | null;
  scope1_percent_change: number | null;

  // Scope 2 Location-Based
  scope2_lb_year1: number | null;
  scope2_lb_year2: number | null;
  scope2_lb_delta: number | null;
  scope2_lb_percent_change: number | null;

  // Scope 2 Market-Based
  scope2_mb_year1: number | null;
  scope2_mb_year2: number | null;
  scope2_mb_delta: number | null;
  scope2_mb_percent_change: number | null;

  // Scope 3
  scope3_year1: number | null;
  scope3_year2: number | null;
  scope3_delta: number | null;
  scope3_percent_change: number | null;

  // CAGR (if years apart > 1)
  scope1_cagr: number | null;
  scope2_lb_cagr: number | null;
  scope2_mb_cagr: number | null;
  scope3_cagr: number | null;

  // Methodology changes
  boundary_year1: string | null;
  boundary_year2: string | null;
  boundary_changed: boolean;
  verification_year1: string | null;
  verification_year2: string | null;
  verification_changed: boolean;
}

/**
 * Calculate CAGR (Compound Annual Growth Rate)
 * Formula: CAGR = (endValue / beginValue) ^ (1 / yearsApart) - 1
 */
function calculateCAGR(
  beginValue: number | null,
  endValue: number | null,
  yearsApart: number
): number | null {
  if (!beginValue || !endValue || beginValue <= 0 || yearsApart <= 1) {
    return null;
  }

  const cagr = Math.pow(endValue / beginValue, 1 / yearsApart) - 1;
  return cagr * 100; // Return as percentage
}

/**
 * Calculate percent change
 * Formula: ((newValue - oldValue) / oldValue) * 100
 */
function calculatePercentChange(
  oldValue: number | null,
  newValue: number | null
): number | null {
  if (oldValue === null || newValue === null || oldValue === 0) {
    return null;
  }

  return ((newValue - oldValue) / oldValue) * 100;
}

/**
 * Compare emissions between two years for a single company
 */
export function compareYears(
  nzId: number,
  year1: number,
  year2: number
): YearComparisonResult | null {
  const db = getDatabase();

  // Get company info
  const company = db
    .prepare('SELECT company_name FROM companies WHERE nz_id = ?')
    .get(nzId) as { company_name: string } | undefined;

  if (!company) {
    return null;
  }

  // Get emissions for both years
  const emissions1 = db
    .prepare('SELECT * FROM emissions WHERE nz_id = ? AND year = ?')
    .get(nzId, year1) as EmissionsRow | undefined;

  const emissions2 = db
    .prepare('SELECT * FROM emissions WHERE nz_id = ? AND year = ?')
    .get(nzId, year2) as EmissionsRow | undefined;

  if (!emissions1 || !emissions2) {
    return null;
  }

  const yearsApart = Math.abs(year2 - year1);

  // Calculate deltas and percent changes for each scope
  const scope1_delta =
    emissions1.scope1 !== null && emissions2.scope1 !== null
      ? emissions2.scope1 - emissions1.scope1
      : null;

  const scope2_lb_delta =
    emissions1.scope2_lb !== null && emissions2.scope2_lb !== null
      ? emissions2.scope2_lb - emissions1.scope2_lb
      : null;

  const scope2_mb_delta =
    emissions1.scope2_mb !== null && emissions2.scope2_mb !== null
      ? emissions2.scope2_mb - emissions1.scope2_mb
      : null;

  const scope3_delta =
    emissions1.scope3_total !== null && emissions2.scope3_total !== null
      ? emissions2.scope3_total - emissions1.scope3_total
      : null;

  return {
    nz_id: nzId,
    company_name: company.company_name,
    year1,
    year2,
    yearsApart,

    // Scope 1
    scope1_year1: emissions1.scope1,
    scope1_year2: emissions2.scope1,
    scope1_delta,
    scope1_percent_change: calculatePercentChange(emissions1.scope1, emissions2.scope1),
    scope1_cagr: calculateCAGR(emissions1.scope1, emissions2.scope1, yearsApart),

    // Scope 2 Location-Based
    scope2_lb_year1: emissions1.scope2_lb,
    scope2_lb_year2: emissions2.scope2_lb,
    scope2_lb_delta,
    scope2_lb_percent_change: calculatePercentChange(
      emissions1.scope2_lb,
      emissions2.scope2_lb
    ),
    scope2_lb_cagr: calculateCAGR(emissions1.scope2_lb, emissions2.scope2_lb, yearsApart),

    // Scope 2 Market-Based
    scope2_mb_year1: emissions1.scope2_mb,
    scope2_mb_year2: emissions2.scope2_mb,
    scope2_mb_delta,
    scope2_mb_percent_change: calculatePercentChange(
      emissions1.scope2_mb,
      emissions2.scope2_mb
    ),
    scope2_mb_cagr: calculateCAGR(emissions1.scope2_mb, emissions2.scope2_mb, yearsApart),

    // Scope 3
    scope3_year1: emissions1.scope3_total,
    scope3_year2: emissions2.scope3_total,
    scope3_delta,
    scope3_percent_change: calculatePercentChange(
      emissions1.scope3_total,
      emissions2.scope3_total
    ),
    scope3_cagr: calculateCAGR(emissions1.scope3_total, emissions2.scope3_total, yearsApart),

    // Methodology changes
    boundary_year1: emissions1.organizational_boundary,
    boundary_year2: emissions2.organizational_boundary,
    boundary_changed: emissions1.organizational_boundary !== emissions2.organizational_boundary,
    verification_year1: emissions1.verification_status,
    verification_year2: emissions2.verification_status,
    verification_changed: emissions1.verification_status !== emissions2.verification_status,
  };
}

/**
 * Get time series of emissions for a company across all years
 * Returns year-over-year changes for trending
 */
export interface TimeSeriesPoint {
  year: number;
  scope1: number | null;
  scope2_lb: number | null;
  scope2_mb: number | null;
  scope3: number | null;
  boundary: string | null;
  verification: string | null;
}

export function getTimeSeries(nzId: number): TimeSeriesPoint[] {
  const db = getDatabase();

  const results = db
    .prepare(
      `
    SELECT
      year,
      scope1,
      scope2_lb,
      scope2_mb,
      scope3_total as scope3,
      organizational_boundary as boundary,
      verification_status as verification
    FROM emissions
    WHERE nz_id = ?
    ORDER BY year ASC
  `
    )
    .all(nzId) as TimeSeriesPoint[];

  return results;
}
