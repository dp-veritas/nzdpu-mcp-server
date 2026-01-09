/**
 * Shared Disclaimers and Gating Content
 *
 * Consolidates frequently-used disclaimers to avoid duplication
 * and ensure consistent messaging across tools.
 */

/**
 * Disclaimer for benchmark and comparison operations
 * Used by: nzdpu_benchmark (single and compare modes)
 */
export const BENCHMARK_DISCLAIMER = `
## Important Comparison Limitations

Emissions comparisons across companies have inherent limitations:
- Different organizational boundaries (operational vs equity share)
- Different Scope 3 methodologies and coverage
- Different reporting years and base years
- Verification status varies

Use benchmarks for directional insights, not precise rankings.
`.trim();

/**
 * Brief version for inline use
 */
export const BENCHMARK_DISCLAIMER_BRIEF = `Emissions data may not be directly comparable due to different boundaries, methodologies, and reporting years. Use for directional insights only.`;

/**
 * Disclaimer for ranking operations (top emitters, etc.)
 * Used by: nzdpu_analyze (top_emitters mode)
 */
export const RANKING_DISCLAIMER = `
## Ranking Caveats

These rankings reflect reported values which may not be directly comparable.
High emissions don't necessarily indicate poor performance - company size,
sector, and value chain position all affect absolute emissions.
`.trim();

/**
 * Brief version for inline use
 */
export const RANKING_DISCLAIMER_BRIEF = `Rankings reflect reported values only. High emissions may indicate company size, not poor performance.`;

/**
 * Disclaimer for Scope 3 data quality
 */
export const SCOPE3_DATA_QUALITY_DISCLAIMER = `
## Scope 3 Data Quality Note

Scope 3 emissions are often estimated using:
- Spend-based calculations (lowest accuracy)
- Industry-average emission factors
- Supplier surveys (when available)

Data quality varies significantly across companies and categories.
Compare Scope 3 values with caution.
`.trim();

/**
 * Disclaimer for cross-year comparisons
 */
export const CROSS_YEAR_DISCLAIMER = `
## Cross-Year Comparison Note

Year-over-year comparisons may be affected by:
- Methodology changes
- Boundary changes (M&A, divestitures)
- Improved data quality
- Recalculation of base years

Check for disclosed restatements before drawing conclusions.
`.trim();

/**
 * Helper function to format disclaimer with optional prefix
 */
export function formatDisclaimer(disclaimer: string, prefix?: string): string {
  if (prefix) {
    return `${prefix}\n\n${disclaimer}`;
  }
  return disclaimer;
}

/**
 * Common error messages
 */
export const ERROR_MESSAGES = {
  companyNotFound: (nzId: number) =>
    `Company with nz_id ${nzId} not found in database.`,
  emissionsNotFound: (nzId: number, year?: number) =>
    year
      ? `No emissions data found for company ${nzId} in year ${year}.`
      : `No emissions data found for company ${nzId}.`,
  invalidScope: (scope: string) =>
    `Invalid scope "${scope}". Use: scope1, scope2_lb, scope2_mb, or scope3.`,
  scope2MethodologyMismatch: `Cannot compare Scope 2 emissions: One uses location-based methodology while the other uses market-based.`,
};
