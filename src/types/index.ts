// NZDPU API Response Types

export interface Company {
  id: number;           // Internal ID
  nz_id: number;        // NZDPU company ID (use this for API calls)
  company_name: string;
  alias?: string;       // Alternative company name/alias
  lei?: string;
  lei_source?: string;
  jurisdiction?: string;
  jurisdiction_source?: string;
  sics_sector?: string;
  sics_sub_sector?: string;
  sics_industry?: string;
  sics_source?: string;
  source?: string;
  latest_reported_year?: number;
  company_type?: string;
  active?: boolean;
}

export interface CompanyProfile extends Company {
  isin?: string;
  ticker?: string;
  website?: string;
  employee_count?: number;
  revenue?: number;
  revenue_currency?: string;
}

// Alias for cleaner code
export type CompanyId = number;

export interface EmissionsData {
  company_id: number;
  year: number;
  scope1_emissions?: number;
  scope1_methodology?: string;
  scope2_location_based?: number;
  scope2_market_based?: number;
  scope2_lb_methodology?: string;
  scope2_mb_methodology?: string;
  scope3_total?: number;
  scope3_categories?: Scope3Category[];
  organizational_boundary?: string;
  verification_status?: string;
}

export interface Scope3Category {
  category_number: number;
  category_name: string;
  emissions?: number;
  methodology?: string;
  relevancy?: string;
  exclusion_reason?: string;
}

export interface EmissionsTarget {
  company_id: number;
  target_type: string;
  target_year: number;
  base_year: number;
  target_scope: string;
  target_percentage?: number;
  target_absolute?: number;
  sbti_status?: string;
}

export interface DisclosureDetails {
  company_id: number;
  year: number;
  data_source: string;
  submission_date?: string;
  verification_type?: string;
  verification_standard?: string;
  organizational_boundary?: string;
  reporting_boundary?: string;
}

export interface SicsSector {
  sector_code: string;
  sector_name: string;
  company_count: number;
}

export interface Jurisdiction {
  jurisdiction_code: string;
  jurisdiction_name: string;
  company_count: number;
}

// Benchmarking Types

export interface PeerGroupStats {
  count: number;
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  percentile25: number;
  percentile75: number;
}

export interface PeerGroupComparison {
  peerGroupName: string;
  peerCount: number;
  companyValue: number;
  percentileRank: number;
  stats: PeerGroupStats;
  methodology?: string;
}

export interface BenchmarkResult {
  company: CompanyProfile;
  emissionsYear: number;
  scope: 'scope1' | 'scope2_lb' | 'scope2_mb' | 'scope3';
  jurisdictionBenchmark?: PeerGroupComparison;
  sectorBenchmark?: PeerGroupComparison;
  intersectionBenchmark?: PeerGroupComparison;
  methodologyNotes: string[];
  comparabilityWarnings: ComparabilityWarning[];
}

// Comparability Types

export type Scope2Methodology = 'location_based' | 'market_based';

export interface ComparabilityWarning {
  type: 'scope2_mismatch' | 'methodology_mismatch' | 'boundary_mismatch' | 'year_mismatch' | 'data_quality';
  severity: 'error' | 'warning' | 'info';
  message: string;
  educationalContext: string;
  suggestion?: string;
}

export interface ComparabilityCheck {
  isComparable: boolean;
  warnings: ComparabilityWarning[];
  explanation: string;
  suggestion?: string;
}

// Data Quality Types

export type QualityScore = 'HIGH' | 'MEDIUM' | 'LOW';
export type MethodQualityTier = 'PRIMARY' | 'MODELED' | 'UNKNOWN';

/**
 * Scope 3 methodology quality classification
 * PRIMARY = supplier-specific, hybrid, asset-specific, fuel-based (uses primary data)
 * MODELED = spend-based, average-data, distance-based (uses estimates/proxies)
 */
export const SCOPE3_METHOD_QUALITY: Record<string, MethodQualityTier> = {
  'Supplier-specific method': 'PRIMARY',
  'Hybrid method': 'PRIMARY',
  'Asset-specific method': 'PRIMARY',
  'Fuel-based method': 'PRIMARY',
  'Average-data method': 'MODELED',
  'Spend-based method': 'MODELED',
  'Distance-based method': 'MODELED',
  'Waste-type-specific method': 'MODELED',
  'Site-specific method': 'PRIMARY',
  'Average product method': 'MODELED',
  'Lessor-specific method': 'PRIMARY',
  'Lessee-specific method': 'PRIMARY',
  'Franchise-specific method': 'PRIMARY',
  'Investment-specific method': 'PRIMARY',
};

/**
 * Enhanced data quality assessment including methodology, boundary, and verification
 */
export interface EnhancedDataQualityAssessment {
  nz_id: number;
  year: number;
  
  // Organizational boundary assessment
  boundaryScore: QualityScore;
  boundaryType: string | null;
  boundaryIsStandard: boolean;
  
  // Verification assessment
  verificationScore: QualityScore;
  verificationType: string | null;
  
  // Scope 1/2 methodology assessment
  scope1MethodologyScore: QualityScore;
  scope2LBMethodologyScore: QualityScore;
  scope2MBMethodologyScore: QualityScore;
  
  // Scope 3 per-category methodology quality
  scope3MethodQuality: Record<number, {
    method: string | null;
    methodTier: MethodQualityTier;
    relevancy: string | null;
    value: number | null;
  }>;
  
  // Overall score (weighted)
  overallScore: QualityScore;
  
  // Comparability warnings
  warnings: string[];
  
  // Methodology consistency (compared to prior year)
  methodologyConsistent: boolean;
  methodologyChanges: string[];
}

/**
 * Legacy DataQualityAssessment - preserved for backward compatibility
 */
export interface DataQualityAssessment {
  company_id: number;
  year: number;
  overallScore: 'high' | 'medium' | 'low';
  scope1Quality: ScopeQuality;
  scope2Quality: Scope2Quality;
  scope3Quality: Scope3Quality;
  recommendations: string[];
}

export interface ScopeQuality {
  hasData: boolean;
  methodology?: string;
  methodologyQuality: 'high' | 'medium' | 'low' | 'unknown';
  isVerified: boolean;
  verificationLevel?: string;
  dataCompleteness: number; // 0-100
  notes: string[];
}

export interface Scope2Quality extends ScopeQuality {
  hasLocationBased: boolean;
  hasMarketBased: boolean;
  lbMethodology?: string;
  mbMethodology?: string;
}

export interface Scope3Quality {
  hasData: boolean;
  categoriesReported: number;
  categoriesRelevant: number;
  primaryDataPercentage: number;
  categoryAssessments: Scope3CategoryAssessment[];
  notes: string[];
}

export interface Scope3CategoryAssessment {
  categoryNumber: number;
  categoryName: string;
  hasData: boolean;
  methodology?: string;
  methodologySuitability: 'appropriate' | 'acceptable' | 'limited' | 'unknown';
  usesPrimaryData: boolean;
  isRelevantForSector: boolean;
  notes: string[];
}

// API Response Wrappers

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

