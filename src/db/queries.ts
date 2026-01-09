import { getDatabase } from './schema.js';

// ==================== TYPES ====================

export interface CompanyRow {
  nz_id: number;
  company_name: string;
  jurisdiction: string | null;
  sics_sector: string | null;
  sics_sub_sector: string | null;
  sics_industry: string | null;
  lei: string | null;
  latest_reported_year: number | null;
}

export interface EmissionsRow {
  id: number;
  nz_id: number;
  year: number;
  scope1: number | null;
  scope1_methodology: string | null;
  scope2_lb: number | null;
  scope2_mb: number | null;
  scope2_lb_methodology: string | null;
  scope2_mb_methodology: string | null;
  scope3_total: number | null;
  scope3_cat_1: number | null;
  scope3_cat_2: number | null;
  scope3_cat_3: number | null;
  scope3_cat_4: number | null;
  scope3_cat_5: number | null;
  scope3_cat_6: number | null;
  scope3_cat_7: number | null;
  scope3_cat_8: number | null;
  scope3_cat_9: number | null;
  scope3_cat_10: number | null;
  scope3_cat_11: number | null;
  scope3_cat_12: number | null;
  scope3_cat_13: number | null;
  scope3_cat_14: number | null;
  scope3_cat_15: number | null;
  // Scope 3 methodology per category
  scope3_cat_1_method: string | null;
  scope3_cat_1_relevancy: string | null;
  scope3_cat_2_method: string | null;
  scope3_cat_2_relevancy: string | null;
  scope3_cat_3_method: string | null;
  scope3_cat_3_relevancy: string | null;
  scope3_cat_4_method: string | null;
  scope3_cat_4_relevancy: string | null;
  scope3_cat_5_method: string | null;
  scope3_cat_5_relevancy: string | null;
  scope3_cat_6_method: string | null;
  scope3_cat_6_relevancy: string | null;
  scope3_cat_7_method: string | null;
  scope3_cat_7_relevancy: string | null;
  scope3_cat_8_method: string | null;
  scope3_cat_8_relevancy: string | null;
  scope3_cat_9_method: string | null;
  scope3_cat_9_relevancy: string | null;
  scope3_cat_10_method: string | null;
  scope3_cat_10_relevancy: string | null;
  scope3_cat_11_method: string | null;
  scope3_cat_11_relevancy: string | null;
  scope3_cat_12_method: string | null;
  scope3_cat_12_relevancy: string | null;
  scope3_cat_13_method: string | null;
  scope3_cat_13_relevancy: string | null;
  scope3_cat_14_method: string | null;
  scope3_cat_14_relevancy: string | null;
  scope3_cat_15_method: string | null;
  scope3_cat_15_relevancy: string | null;
  organizational_boundary: string | null;
  verification_status: string | null;
}

export interface TopEmitter {
  nz_id: number;
  company_name: string;
  value: number;
  year: number;
  jurisdiction: string | null;
  sics_sector: string | null;
}

export interface DatasetStats {
  totalCompanies: number;
  totalEmissionsRecords: number;
  companiesByDisclosureCount: Record<number, number>;
  companiesBySector: Record<string, number>;
  companiesByJurisdiction: Record<string, number>;
  yearCoverage: Record<number, number>;
}

// ==================== QUERY FUNCTIONS ====================

/**
 * Get total count of unique companies
 */
export function getCompanyCount(): number {
  const db = getDatabase();
  const result = db.prepare('SELECT COUNT(*) as count FROM companies').get() as { count: number };
  return result.count;
}

/**
 * Get total count of emissions records
 */
export function getEmissionsRecordCount(): number {
  const db = getDatabase();
  const result = db.prepare('SELECT COUNT(*) as count FROM emissions').get() as { count: number };
  return result.count;
}

/**
 * Get comprehensive dataset statistics
 */
export function getDatasetStats(): DatasetStats {
  const db = getDatabase();
  
  // Total companies
  const totalCompanies = (db.prepare('SELECT COUNT(*) as count FROM companies').get() as { count: number }).count;
  
  // Total emissions records
  const totalEmissionsRecords = (db.prepare('SELECT COUNT(*) as count FROM emissions').get() as { count: number }).count;
  
  // Companies by disclosure count (how many years each company has disclosed)
  const disclosureCounts = db.prepare(`
    SELECT disclosure_count, COUNT(*) as company_count
    FROM (
      SELECT nz_id, COUNT(*) as disclosure_count
      FROM emissions
      GROUP BY nz_id
    )
    GROUP BY disclosure_count
    ORDER BY disclosure_count
  `).all() as { disclosure_count: number; company_count: number }[];
  
  const companiesByDisclosureCount: Record<number, number> = {};
  for (const row of disclosureCounts) {
    companiesByDisclosureCount[row.disclosure_count] = row.company_count;
  }
  
  // Companies by sector
  const sectorCounts = db.prepare(`
    SELECT sics_sector, COUNT(*) as count
    FROM companies
    WHERE sics_sector IS NOT NULL
    GROUP BY sics_sector
    ORDER BY count DESC
  `).all() as { sics_sector: string; count: number }[];
  
  const companiesBySector: Record<string, number> = {};
  for (const row of sectorCounts) {
    companiesBySector[row.sics_sector] = row.count;
  }
  
  // Companies by jurisdiction
  const jurisdictionCounts = db.prepare(`
    SELECT jurisdiction, COUNT(*) as count
    FROM companies
    WHERE jurisdiction IS NOT NULL
    GROUP BY jurisdiction
    ORDER BY count DESC
  `).all() as { jurisdiction: string; count: number }[];
  
  const companiesByJurisdiction: Record<string, number> = {};
  for (const row of jurisdictionCounts) {
    companiesByJurisdiction[row.jurisdiction] = row.count;
  }
  
  // Year coverage
  const yearCounts = db.prepare(`
    SELECT year, COUNT(*) as count
    FROM emissions
    GROUP BY year
    ORDER BY year DESC
  `).all() as { year: number; count: number }[];
  
  const yearCoverage: Record<number, number> = {};
  for (const row of yearCounts) {
    yearCoverage[row.year] = row.count;
  }
  
  return {
    totalCompanies,
    totalEmissionsRecords,
    companiesByDisclosureCount,
    companiesBySector,
    companiesByJurisdiction,
    yearCoverage,
  };
}

/**
 * Get top N emitters for a specific scope
 */
export function getTopEmitters(
  scope: 'scope1' | 'scope2_lb' | 'scope2_mb' | 'scope3' | `scope3_cat_${number}`,
  limit: number = 10,
  year?: number
): TopEmitter[] {
  const db = getDatabase();
  
  // Map scope to column name
  let column: string;
  if (scope === 'scope1') column = 'scope1';
  else if (scope === 'scope2_lb') column = 'scope2_lb';
  else if (scope === 'scope2_mb') column = 'scope2_mb';
  else if (scope === 'scope3') column = 'scope3_total';
  else if (scope.startsWith('scope3_cat_')) {
    const catNum = scope.replace('scope3_cat_', '');
    column = `scope3_cat_${catNum}`;
  } else {
    column = 'scope1';
  }
  
  let query = `
    SELECT 
      e.nz_id,
      c.company_name,
      e.${column} as value,
      e.year,
      c.jurisdiction,
      c.sics_sector
    FROM emissions e
    JOIN companies c ON e.nz_id = c.nz_id
    WHERE e.${column} IS NOT NULL AND e.${column} > 0
  `;
  
  const params: (number | undefined)[] = [];
  if (year) {
    query += ' AND e.year = ?';
    params.push(year);
  }
  
  query += ` ORDER BY e.${column} DESC LIMIT ?`;
  params.push(limit);
  
  return db.prepare(query).all(...params) as TopEmitter[];
}

/**
 * Get companies with at least N disclosure years
 */
export function getCompaniesWithMinDisclosures(
  minDisclosures: number,
  limit: number = 100
): { nz_id: number; company_name: string; disclosure_count: number; years: string }[] {
  const db = getDatabase();
  
  return db.prepare(`
    SELECT 
      c.nz_id,
      c.company_name,
      COUNT(e.year) as disclosure_count,
      GROUP_CONCAT(e.year) as years
    FROM companies c
    JOIN emissions e ON c.nz_id = e.nz_id
    GROUP BY c.nz_id
    HAVING COUNT(e.year) >= ?
    ORDER BY disclosure_count DESC
    LIMIT ?
  `).all(minDisclosures, limit) as { nz_id: number; company_name: string; disclosure_count: number; years: string }[];
}

/**
 * Search companies by name
 */
export function searchCompanies(
  searchTerm: string,
  limit: number = 20
): CompanyRow[] {
  const db = getDatabase();
  
  return db.prepare(`
    SELECT * FROM companies
    WHERE company_name LIKE ?
    ORDER BY company_name
    LIMIT ?
  `).all(`%${searchTerm}%`, limit) as CompanyRow[];
}

/**
 * Get company by nz_id
 */
export function getCompanyById(nzId: number): CompanyRow | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM companies WHERE nz_id = ?').get(nzId) as CompanyRow | undefined;
}

/**
 * Get company by LEI (Legal Entity Identifier)
 */
export function getCompanyByLei(lei: string): CompanyRow | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM companies WHERE lei = ?').get(lei) as CompanyRow | undefined;
}

/**
 * Get emissions for a company
 */
export function getCompanyEmissions(nzId: number, year?: number): EmissionsRow[] {
  const db = getDatabase();
  
  if (year) {
    return db.prepare('SELECT * FROM emissions WHERE nz_id = ? AND year = ?').all(nzId, year) as EmissionsRow[];
  }
  return db.prepare('SELECT * FROM emissions WHERE nz_id = ? ORDER BY year DESC').all(nzId) as EmissionsRow[];
}

/**
 * List companies with filters
 */
export function listCompanies(filters: {
  search?: string;
  jurisdiction?: string;
  sics_sector?: string;
  sics_sub_sector?: string;
  sics_industry?: string;
  limit?: number;
  offset?: number;
}): { data: CompanyRow[]; total: number } {
  const db = getDatabase();
  
  let whereClause = '1=1';
  const params: unknown[] = [];
  
  if (filters.search) {
    whereClause += ' AND company_name LIKE ?';
    params.push(`%${filters.search}%`);
  }
  if (filters.jurisdiction) {
    whereClause += ' AND LOWER(jurisdiction) = LOWER(?)';
    params.push(filters.jurisdiction);
  }
  if (filters.sics_sector) {
    whereClause += ' AND LOWER(sics_sector) = LOWER(?)';
    params.push(filters.sics_sector);
  }
  if (filters.sics_sub_sector) {
    whereClause += ' AND LOWER(sics_sub_sector) = LOWER(?)';
    params.push(filters.sics_sub_sector);
  }
  if (filters.sics_industry) {
    whereClause += ' AND LOWER(sics_industry) LIKE LOWER(?)';
    params.push(`%${filters.sics_industry}%`);
  }
  
  // Get total count
  const countResult = db.prepare(`SELECT COUNT(*) as count FROM companies WHERE ${whereClause}`).get(...params) as { count: number };
  
  // Get data with pagination
  const limit = filters.limit || 20;
  const offset = filters.offset || 0;
  const data = db.prepare(`
    SELECT * FROM companies 
    WHERE ${whereClause}
    ORDER BY company_name
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as CompanyRow[];
  
  return { data, total: countResult.count };
}

/**
 * List available sectors
 */
export function listSectors(): { sector: string; count: number }[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT sics_sector as sector, COUNT(*) as count
    FROM companies
    WHERE sics_sector IS NOT NULL
    GROUP BY sics_sector
    ORDER BY count DESC
  `).all() as { sector: string; count: number }[];
}

/**
 * List available jurisdictions
 */
export function listJurisdictions(): { jurisdiction: string; count: number }[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT jurisdiction, COUNT(*) as count
    FROM companies
    WHERE jurisdiction IS NOT NULL
    GROUP BY jurisdiction
    ORDER BY count DESC
  `).all() as { jurisdiction: string; count: number }[];
}

/**
 * List sub-sectors with hierarchy
 */
export function listSubSectors(sectorFilter?: string): { sector: string; sub_sector: string; industry: string; count: number }[] {
  const db = getDatabase();
  
  let query = `
    SELECT 
      sics_sector as sector,
      sics_sub_sector as sub_sector,
      sics_industry as industry,
      COUNT(*) as count
    FROM companies
    WHERE sics_sub_sector IS NOT NULL
  `;
  
  const params: string[] = [];
  if (sectorFilter) {
    query += ' AND LOWER(sics_sector) LIKE LOWER(?)';
    params.push(`%${sectorFilter}%`);
  }
  
  query += `
    GROUP BY sics_sector, sics_sub_sector, sics_industry
    ORDER BY sics_sector, sics_sub_sector, sics_industry
  `;
  
  return db.prepare(query).all(...params) as { sector: string; sub_sector: string; industry: string; count: number }[];
}

/**
 * Get peer statistics for benchmarking
 */
export function getPeerStatistics(
  scope: 'scope1' | 'scope2_lb' | 'scope2_mb' | 'scope3',
  filters: { jurisdiction?: string; sics_sector?: string; year?: number }
): {
  count: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
  percentile25: number;
  percentile75: number;
} | null {
  const db = getDatabase();
  
  // Map scope to column
  const column = scope === 'scope3' ? 'scope3_total' : scope;
  
  let whereClause = `e.${column} IS NOT NULL AND e.${column} > 0`;
  const params: unknown[] = [];
  
  if (filters.jurisdiction) {
    whereClause += ' AND LOWER(c.jurisdiction) = LOWER(?)';
    params.push(filters.jurisdiction);
  }
  if (filters.sics_sector) {
    whereClause += ' AND LOWER(c.sics_sector) = LOWER(?)';
    params.push(filters.sics_sector);
  }
  if (filters.year) {
    whereClause += ' AND e.year = ?';
    params.push(filters.year);
  }
  
  // Get all values for statistical calculations
  const values = db.prepare(`
    SELECT e.${column} as value
    FROM emissions e
    JOIN companies c ON e.nz_id = c.nz_id
    WHERE ${whereClause}
    ORDER BY e.${column}
  `).all(...params) as { value: number }[];
  
  if (values.length === 0) return null;
  
  const nums = values.map(v => v.value);
  const count = nums.length;
  const sum = nums.reduce((a, b) => a + b, 0);
  const mean = sum / count;
  const min = nums[0];
  const max = nums[count - 1];
  
  // Median
  const mid = Math.floor(count / 2);
  const median = count % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
  
  // Percentiles
  const p25Idx = Math.floor(count * 0.25);
  const p75Idx = Math.floor(count * 0.75);
  const percentile25 = nums[p25Idx];
  const percentile75 = nums[p75Idx];
  
  // Standard deviation
  const variance = nums.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / count;
  const stdDev = Math.sqrt(variance);
  
  return { count, mean, median, min, max, stdDev, percentile25, percentile75 };
}

/**
 * Benchmark a company against peers
 */
export function benchmarkCompany(
  nzId: number,
  scope: 'scope1' | 'scope2_lb' | 'scope2_mb' | 'scope3',
  year?: number
): {
  company: CompanyRow;
  companyValue: number | null;
  companyYear: number;
  jurisdictionStats: ReturnType<typeof getPeerStatistics>;
  sectorStats: ReturnType<typeof getPeerStatistics>;
  combinedStats: ReturnType<typeof getPeerStatistics>;
  percentileInJurisdiction: number | null;
  percentileInSector: number | null;
  percentileInCombined: number | null;
} | null {
  const db = getDatabase();
  
  // Get company info
  const company = getCompanyById(nzId);
  if (!company) return null;
  
  // Get company's emissions
  const column = scope === 'scope3' ? 'scope3_total' : scope;
  let emissionsQuery = `SELECT ${column} as value, year FROM emissions WHERE nz_id = ?`;
  const emissionsParams: unknown[] = [nzId];
  
  if (year) {
    emissionsQuery += ' AND year = ?';
    emissionsParams.push(year);
  } else {
    emissionsQuery += ' ORDER BY year DESC LIMIT 1';
  }
  
  const emissionsResult = db.prepare(emissionsQuery).get(...emissionsParams) as { value: number | null; year: number } | undefined;
  const companyValue = emissionsResult?.value ?? null;
  const companyYear = emissionsResult?.year ?? company.latest_reported_year ?? 2022;
  
  // Get peer statistics
  const jurisdictionStats = company.jurisdiction 
    ? getPeerStatistics(scope, { jurisdiction: company.jurisdiction, year: companyYear })
    : null;
  
  const sectorStats = company.sics_sector
    ? getPeerStatistics(scope, { sics_sector: company.sics_sector, year: companyYear })
    : null;
  
  const combinedStats = (company.jurisdiction && company.sics_sector)
    ? getPeerStatistics(scope, { jurisdiction: company.jurisdiction, sics_sector: company.sics_sector, year: companyYear })
    : null;
  
  // Calculate percentiles
  const calcPercentile = (value: number | null, stats: ReturnType<typeof getPeerStatistics>): number | null => {
    if (!value || !stats) return null;
    
    // Count how many values are below this one
    const column = scope === 'scope3' ? 'scope3_total' : scope;
    // Simple approximation using the stats
    if (value <= stats.min) return 0;
    if (value >= stats.max) return 100;
    
    // Linear interpolation estimate
    const range = stats.max - stats.min;
    const position = value - stats.min;
    return Math.round((position / range) * 100);
  };
  
  return {
    company,
    companyValue,
    companyYear,
    jurisdictionStats,
    sectorStats,
    combinedStats,
    percentileInJurisdiction: calcPercentile(companyValue, jurisdictionStats),
    percentileInSector: calcPercentile(companyValue, sectorStats),
    percentileInCombined: calcPercentile(companyValue, combinedStats),
  };
}

/**
 * Validate emissions data - find potential data quality issues
 */
export function findDataQualityIssues(limit: number = 50): {
  nz_id: number;
  company_name: string;
  year: number;
  scope: string;
  value: number;
  issue: string;
}[] {
  const db = getDatabase();
  
  const issues: {
    nz_id: number;
    company_name: string;
    year: number;
    scope: string;
    value: number;
    issue: string;
  }[] = [];
  
  // Find values > 1 billion (potential unit errors)
  const billionPlus = db.prepare(`
    SELECT 
      e.nz_id, c.company_name, e.year,
      'scope1' as scope, e.scope1 as value
    FROM emissions e
    JOIN companies c ON e.nz_id = c.nz_id
    WHERE e.scope1 > 1000000000
    UNION ALL
    SELECT 
      e.nz_id, c.company_name, e.year,
      'scope3_total' as scope, e.scope3_total as value
    FROM emissions e
    JOIN companies c ON e.nz_id = c.nz_id
    WHERE e.scope3_total > 1000000000
    ORDER BY value DESC
    LIMIT ?
  `).all(limit) as { nz_id: number; company_name: string; year: number; scope: string; value: number }[];
  
  for (const row of billionPlus) {
    issues.push({
      ...row,
      issue: 'Value > 1 billion tCO2e - possible unit error (kg reported as tonnes)',
    });
  }
  
  return issues;
}

/**
 * Compare multiple companies
 */
export function compareCompanies(
  nzIds: number[],
  year?: number
): {
  company: CompanyRow;
  emissions: EmissionsRow | null;
}[] {
  const db = getDatabase();
  
  const results: { company: CompanyRow; emissions: EmissionsRow | null }[] = [];
  
  for (const nzId of nzIds) {
    const company = getCompanyById(nzId);
    if (!company) continue;
    
    let emissions: EmissionsRow | null = null;
    if (year) {
      const e = db.prepare('SELECT * FROM emissions WHERE nz_id = ? AND year = ?').get(nzId, year) as EmissionsRow | undefined;
      emissions = e || null;
    } else {
      const e = db.prepare('SELECT * FROM emissions WHERE nz_id = ? ORDER BY year DESC LIMIT 1').get(nzId) as EmissionsRow | undefined;
      emissions = e || null;
    }
    
    results.push({ company, emissions });
  }
  
  return results;
}

/**
 * Get database metadata
 */
export function getDatabaseMetadata(): Record<string, string> {
  const db = getDatabase();
  const rows = db.prepare('SELECT key, value FROM metadata').all() as { key: string; value: string }[];
  const metadata: Record<string, string> = {};
  for (const row of rows) {
    metadata[row.key] = row.value;
  }
  return metadata;
}

// ==================== DATA QUALITY ASSESSMENT ====================

import { 
  QualityScore, 
  MethodQualityTier, 
  SCOPE3_METHOD_QUALITY, 
  EnhancedDataQualityAssessment 
} from '../types/index.js';

/**
 * Standard organizational boundaries (GHG Protocol compliant)
 */
const STANDARD_BOUNDARIES = ['Operational control', 'Financial control', 'Equity share'];

/**
 * Assess boundary quality
 */
function assessBoundaryQuality(boundary: string | null): { score: QualityScore; isStandard: boolean } {
  if (!boundary) {
    return { score: 'LOW', isStandard: false };
  }
  
  // Exact match to standard boundaries
  if (STANDARD_BOUNDARIES.includes(boundary)) {
    return { score: 'HIGH', isStandard: true };
  }
  
  // Check for common variations
  const boundaryLower = boundary.toLowerCase();
  if (boundaryLower.includes('operational') || boundaryLower.includes('financial')) {
    return { score: 'HIGH', isStandard: true };
  }
  if (boundaryLower.includes('equity')) {
    return { score: 'MEDIUM', isStandard: true };
  }
  
  // Non-standard boundary (e.g., "Company-defined")
  return { score: 'LOW', isStandard: false };
}

/**
 * Assess verification quality
 */
function assessVerificationQuality(verification: string | null): QualityScore {
  if (!verification) {
    return 'LOW';
  }
  
  const verificationLower = verification.toLowerCase();
  
  if (verificationLower.includes('reasonable')) {
    return 'HIGH';
  }
  if (verificationLower.includes('limited')) {
    return 'MEDIUM';
  }
  
  // Any other verification is better than none
  return 'MEDIUM';
}

/**
 * Assess Scope 1/2 methodology quality
 */
function assessS12MethodologyQuality(methodology: string | null): QualityScore {
  if (!methodology) {
    return 'LOW';
  }
  
  const methodLower = methodology.toLowerCase();
  
  // HIGH quality indicators
  if (
    methodLower.includes('ghg protocol') ||
    methodLower.includes('iso 14064') ||
    methodLower.includes('api compendium') ||
    methodLower.includes('ipieca')
  ) {
    return 'HIGH';
  }
  
  // MEDIUM quality - industry or regional standards
  if (
    methodLower.includes('eu ets') ||
    methodLower.includes('epa') ||
    methodLower.includes('defra') ||
    methodLower.includes('ipcc')
  ) {
    return 'MEDIUM';
  }
  
  // Any methodology is better than none
  return 'MEDIUM';
}

/**
 * Get method quality tier for Scope 3
 */
function getScope3MethodTier(method: string | null): MethodQualityTier {
  if (!method || method === '—') {
    return 'UNKNOWN';
  }
  return SCOPE3_METHOD_QUALITY[method] || 'UNKNOWN';
}

/**
 * Assess overall data quality for a company's emissions record
 */
export function assessDataQuality(emissions: EmissionsRow, sector?: string): EnhancedDataQualityAssessment {
  const warnings: string[] = [];
  
  // Boundary assessment
  const { score: boundaryScore, isStandard: boundaryIsStandard } = assessBoundaryQuality(emissions.organizational_boundary);
  if (!boundaryIsStandard && emissions.organizational_boundary) {
    warnings.push(`Non-standard organizational boundary "${emissions.organizational_boundary}" - may limit comparability with peers`);
  }
  
  // Verification assessment
  const verificationScore = assessVerificationQuality(emissions.verification_status);
  if (verificationScore === 'LOW') {
    warnings.push('No third-party verification - data reliability uncertain');
  } else if (verificationScore === 'MEDIUM' && emissions.verification_status?.toLowerCase().includes('limited')) {
    warnings.push('Limited assurance verification - lower scrutiny than reasonable assurance');
  }
  
  // Scope 1/2 methodology assessment
  const scope1MethodologyScore = assessS12MethodologyQuality(emissions.scope1_methodology);
  const scope2LBMethodologyScore = assessS12MethodologyQuality(emissions.scope2_lb_methodology);
  const scope2MBMethodologyScore = assessS12MethodologyQuality(emissions.scope2_mb_methodology);
  
  // Scope 3 methodology quality per category
  const scope3MethodQuality: Record<number, {
    method: string | null;
    methodTier: MethodQualityTier;
    relevancy: string | null;
    value: number | null;
  }> = {};
  
  for (let cat = 1; cat <= 15; cat++) {
    const methodKey = `scope3_cat_${cat}_method` as keyof EmissionsRow;
    const relevancyKey = `scope3_cat_${cat}_relevancy` as keyof EmissionsRow;
    const valueKey = `scope3_cat_${cat}` as keyof EmissionsRow;
    
    const method = emissions[methodKey] as string | null;
    const relevancy = emissions[relevancyKey] as string | null;
    const value = emissions[valueKey] as number | null;
    const methodTier = getScope3MethodTier(method);
    
    scope3MethodQuality[cat] = {
      method,
      methodTier,
      relevancy,
      value,
    };
    
    // Add warnings for material categories with modeled/unknown methodology
    if (value && value > 0) {
      if (methodTier === 'UNKNOWN') {
        warnings.push(`Scope 3 Category ${cat}: No methodology disclosed for ${formatNumber(value)} tCO2e`);
      } else if (methodTier === 'MODELED' && value > 1000000) {
        warnings.push(`Scope 3 Category ${cat}: Uses modeled methodology (${method}) for significant emissions (${formatNumber(value)} tCO2e)`);
      }
    }
  }
  
  // Calculate overall score
  const overallScore = calculateOverallScore(boundaryScore, verificationScore, scope1MethodologyScore);
  
  return {
    nz_id: emissions.nz_id,
    year: emissions.year,
    boundaryScore,
    boundaryType: emissions.organizational_boundary,
    boundaryIsStandard,
    verificationScore,
    verificationType: emissions.verification_status,
    scope1MethodologyScore,
    scope2LBMethodologyScore,
    scope2MBMethodologyScore,
    scope3MethodQuality,
    overallScore,
    warnings,
    methodologyConsistent: true, // Set in detectMethodologyChanges
    methodologyChanges: [],
  };
}

/**
 * Format number with commas for readability
 */
function formatNumber(num: number): string {
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toFixed(0);
}

/**
 * Calculate overall quality score from components
 */
function calculateOverallScore(
  boundaryScore: QualityScore,
  verificationScore: QualityScore,
  methodologyScore: QualityScore
): QualityScore {
  const scores = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  const total = scores[boundaryScore] + scores[verificationScore] + scores[methodologyScore];
  const avg = total / 3;
  
  if (avg >= 2.5) return 'HIGH';
  if (avg >= 1.5) return 'MEDIUM';
  return 'LOW';
}

/**
 * Detect methodology changes between years for a company
 */
export function detectMethodologyChanges(nzId: number): {
  year: number;
  changes: { scope: string; previousMethod: string | null; currentMethod: string | null }[];
}[] {
  const emissions = getCompanyEmissions(nzId);
  
  if (emissions.length < 2) {
    return [];
  }
  
  // Sort by year ascending
  const sorted = [...emissions].sort((a, b) => a.year - b.year);
  const changes: { year: number; changes: { scope: string; previousMethod: string | null; currentMethod: string | null }[] }[] = [];
  
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const yearChanges: { scope: string; previousMethod: string | null; currentMethod: string | null }[] = [];
    
    // Check Scope 1 methodology
    if (prev.scope1_methodology !== curr.scope1_methodology) {
      yearChanges.push({
        scope: 'Scope 1',
        previousMethod: prev.scope1_methodology,
        currentMethod: curr.scope1_methodology,
      });
    }
    
    // Check Scope 2 LB methodology
    if (prev.scope2_lb_methodology !== curr.scope2_lb_methodology) {
      yearChanges.push({
        scope: 'Scope 2 Location-Based',
        previousMethod: prev.scope2_lb_methodology,
        currentMethod: curr.scope2_lb_methodology,
      });
    }
    
    // Check Scope 2 MB methodology
    if (prev.scope2_mb_methodology !== curr.scope2_mb_methodology) {
      yearChanges.push({
        scope: 'Scope 2 Market-Based',
        previousMethod: prev.scope2_mb_methodology,
        currentMethod: curr.scope2_mb_methodology,
      });
    }
    
    // Check Scope 3 category methodologies
    for (let cat = 1; cat <= 15; cat++) {
      const prevKey = `scope3_cat_${cat}_method` as keyof EmissionsRow;
      const currKey = `scope3_cat_${cat}_method` as keyof EmissionsRow;
      
      const prevMethod = prev[prevKey] as string | null;
      const currMethod = curr[currKey] as string | null;
      
      if (prevMethod !== currMethod && (prevMethod || currMethod)) {
        yearChanges.push({
          scope: `Scope 3 Category ${cat}`,
          previousMethod: prevMethod,
          currentMethod: currMethod,
        });
      }
    }
    
    // Check organizational boundary
    if (prev.organizational_boundary !== curr.organizational_boundary) {
      yearChanges.push({
        scope: 'Organizational Boundary',
        previousMethod: prev.organizational_boundary,
        currentMethod: curr.organizational_boundary,
      });
    }
    
    if (yearChanges.length > 0) {
      changes.push({ year: curr.year, changes: yearChanges });
    }
  }
  
  return changes;
}

/**
 * Get full quality assessment for a company including methodology changes
 */
export function getCompanyQualityAssessment(nzId: number, year?: number): {
  assessment: EnhancedDataQualityAssessment | null;
  methodologyChanges: ReturnType<typeof detectMethodologyChanges>;
  companyInfo: CompanyRow | null;
} {
  const company = getCompanyById(nzId);
  const emissions = getCompanyEmissions(nzId, year);
  const methodologyChanges = detectMethodologyChanges(nzId);
  
  if (!emissions || emissions.length === 0) {
    return {
      assessment: null,
      methodologyChanges,
      companyInfo: company || null,
    };
  }
  
  // Use most recent year if not specified
  const targetEmissions = emissions[0];
  const assessment = assessDataQuality(targetEmissions, company?.sics_sector || undefined);
  
  // Update methodology consistency based on changes
  const hasMethodologyChanges = methodologyChanges.length > 0;
  assessment.methodologyConsistent = !hasMethodologyChanges;
  if (hasMethodologyChanges) {
    assessment.methodologyChanges = methodologyChanges.flatMap(mc => 
      mc.changes.map(c => `${mc.year}: ${c.scope} changed from "${c.previousMethod || 'none'}" to "${c.currentMethod || 'none'}"`)
    );
    assessment.warnings.push(`Methodology changes detected across ${methodologyChanges.length} year(s) - year-over-year comparisons may be affected`);
  }
  
  return {
    assessment,
    methodologyChanges,
    companyInfo: company || null,
  };
}

// ==================== SCOPE 3 COVERAGE HELPERS ====================

/**
 * Scope 3 category names for display
 */
const SCOPE3_CATEGORY_NAMES: Record<number, string> = {
  1: 'Purchased Goods & Services',
  2: 'Capital Goods',
  3: 'Fuel & Energy Activities',
  4: 'Upstream Transportation',
  5: 'Waste Generated',
  6: 'Business Travel',
  7: 'Employee Commuting',
  8: 'Upstream Leased Assets',
  9: 'Downstream Transportation',
  10: 'Processing of Sold Products',
  11: 'Use of Sold Products',
  12: 'End-of-Life Treatment',
  13: 'Downstream Leased Assets',
  14: 'Franchises',
  15: 'Investments',
};

export { SCOPE3_CATEGORY_NAMES };

/**
 * Scope 3 coverage summary for a single emissions record
 */
export interface Scope3CoverageSummary {
  categoriesReported: number;
  categoriesWithData: number[];
  categoriesWithoutData: number[];
  totalValue: number | null;
  categoryValues: Record<number, number>;
  dominantCategory: {
    num: number;
    name: string;
    value: number;
    percent: number;
  } | null;
  coverageNote: string;
}

/**
 * Get Scope 3 coverage summary for an emissions record
 */
export function getScope3CoverageSummary(emissions: EmissionsRow): Scope3CoverageSummary {
  const categoryValues: Record<number, number> = {};
  const categoriesWithData: number[] = [];
  const categoriesWithoutData: number[] = [];
  
  let maxCategory = { num: 0, value: 0 };
  
  for (let i = 1; i <= 15; i++) {
    const val = (emissions as any)[`scope3_cat_${i}`] as number | null;
    if (val && val > 0) {
      categoryValues[i] = val;
      categoriesWithData.push(i);
      if (val > maxCategory.value) {
        maxCategory = { num: i, value: val };
      }
    } else {
      categoriesWithoutData.push(i);
    }
  }
  
  const totalValue = emissions.scope3_total;
  
  // Calculate dominant category
  let dominantCategory: Scope3CoverageSummary['dominantCategory'] = null;
  if (maxCategory.num > 0 && totalValue && totalValue > 0) {
    const percent = (maxCategory.value / totalValue) * 100;
    dominantCategory = {
      num: maxCategory.num,
      name: SCOPE3_CATEGORY_NAMES[maxCategory.num],
      value: maxCategory.value,
      percent,
    };
  }
  
  // Generate coverage note
  let coverageNote = `${categoriesWithData.length} of 15 categories reported`;
  if (dominantCategory && dominantCategory.percent > 50) {
    coverageNote += `. Cat ${dominantCategory.num} (${dominantCategory.name}) = ${dominantCategory.percent.toFixed(0)}% of total`;
  }
  
  return {
    categoriesReported: categoriesWithData.length,
    categoriesWithData,
    categoriesWithoutData,
    totalValue,
    categoryValues,
    dominantCategory,
    coverageNote,
  };
}

/**
 * Format a number for display (e.g., 1.5M, 200K)
 */
export function formatCompactNumber(num: number): string {
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(0)}K`;
  return num.toFixed(0);
}

/**
 * Compare quality between companies for comparability warnings
 */
export function compareDataQuality(
  nzIds: number[],
  year?: number
): {
  companies: { nzId: number; name: string; assessment: EnhancedDataQualityAssessment | null }[];
  comparabilityWarnings: string[];
} {
  const companies: { nzId: number; name: string; assessment: EnhancedDataQualityAssessment | null }[] = [];
  const comparabilityWarnings: string[] = [];
  
  const boundaries: Set<string> = new Set();
  const verifications: Set<string> = new Set();
  
  for (const nzId of nzIds) {
    const { assessment, companyInfo } = getCompanyQualityAssessment(nzId, year);
    companies.push({
      nzId,
      name: companyInfo?.company_name || `Company ${nzId}`,
      assessment,
    });
    
    if (assessment?.boundaryType) {
      boundaries.add(assessment.boundaryType);
    }
    if (assessment?.verificationType) {
      verifications.add(assessment.verificationType);
    }
  }
  
  // Check for boundary differences
  if (boundaries.size > 1) {
    comparabilityWarnings.push(
      `Organizational boundaries differ: ${Array.from(boundaries).join(', ')}. Direct comparison may be limited.`
    );
  }
  
  // Check for verification level differences
  if (verifications.size > 1) {
    const hasReasonable = Array.from(verifications).some(v => v.toLowerCase().includes('reasonable'));
    const hasLimited = Array.from(verifications).some(v => v.toLowerCase().includes('limited'));
    const hasNone = companies.some(c => !c.assessment?.verificationType);
    
    if (hasReasonable && (hasLimited || hasNone)) {
      comparabilityWarnings.push(
        'Verification levels differ. Companies with reasonable assurance have higher data scrutiny than those with limited or no assurance.'
      );
    }
  }
  
  // Check for companies with non-standard boundaries
  const nonStandard = companies.filter(c => c.assessment && !c.assessment.boundaryIsStandard);
  if (nonStandard.length > 0) {
    comparabilityWarnings.push(
      `Non-standard boundaries detected for: ${nonStandard.map(c => c.name).join(', ')}. Year-over-year changes may reflect asset sales/acquisitions rather than operational improvements.`
    );
  }
  
  return { companies, comparabilityWarnings };
}

/**
 * Extended comparison with Scope 3 coverage analysis
 * Returns companies with emissions and detailed Scope 3 breakdown
 */
export function compareCompaniesWithScope3(
  nzIds: number[],
  year?: number
): {
  companies: {
    company: CompanyRow;
    emissions: EmissionsRow | null;
    scope3Coverage: Scope3CoverageSummary | null;
  }[];
  scope3VarianceWarning: string | null;
  comparabilityWarnings: string[];
} {
  const db = getDatabase();
  const companies: {
    company: CompanyRow;
    emissions: EmissionsRow | null;
    scope3Coverage: Scope3CoverageSummary | null;
  }[] = [];
  
  const comparabilityWarnings: string[] = [];
  const scope3Totals: number[] = [];
  
  for (const nzId of nzIds) {
    const company = getCompanyById(nzId);
    if (!company) continue;
    
    let emissions: EmissionsRow | null = null;
    let scope3Coverage: Scope3CoverageSummary | null = null;
    
    if (year) {
      const e = db.prepare('SELECT * FROM emissions WHERE nz_id = ? AND year = ?').get(nzId, year) as EmissionsRow | undefined;
      emissions = e || null;
    } else {
      const e = db.prepare('SELECT * FROM emissions WHERE nz_id = ? ORDER BY year DESC LIMIT 1').get(nzId) as EmissionsRow | undefined;
      emissions = e || null;
    }
    
    if (emissions) {
      scope3Coverage = getScope3CoverageSummary(emissions);
      if (emissions.scope3_total && emissions.scope3_total > 0) {
        scope3Totals.push(emissions.scope3_total);
      }
    }
    
    companies.push({ company, emissions, scope3Coverage });
  }
  
  // Pattern-based warning: Detect large Scope 3 variance (>10x)
  let scope3VarianceWarning: string | null = null;
  if (scope3Totals.length >= 2) {
    const max = Math.max(...scope3Totals);
    const min = Math.min(...scope3Totals);
    if (min > 0 && max / min > 10) {
      scope3VarianceWarning = 
        `Scope 3 totals vary by more than 10x (${formatCompactNumber(min)} to ${formatCompactNumber(max)} tCO₂e). ` +
        `This often indicates different category coverage or fundamentally different business models. ` +
        `Review each company's Scope 3 breakdown before drawing conclusions.`;
      comparabilityWarnings.push(scope3VarianceWarning);
    }
  }
  
  // Check for very different category counts
  const categoryCounts = companies
    .filter(c => c.scope3Coverage)
    .map(c => c.scope3Coverage!.categoriesReported);
  
  if (categoryCounts.length >= 2) {
    const maxCats = Math.max(...categoryCounts);
    const minCats = Math.min(...categoryCounts);
    if (maxCats - minCats >= 5) {
      comparabilityWarnings.push(
        `Scope 3 category coverage varies significantly (${minCats} to ${maxCats} categories reported). ` +
        `Companies reporting more categories will naturally show higher totals.`
      );
    }
  }
  
  return { companies, scope3VarianceWarning, comparabilityWarnings };
}
