import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  Company,
  CompanyProfile,
  EmissionsData,
  EmissionsTarget,
  Scope3Category,
  SicsSector,
  Jurisdiction,
  PaginatedResponse,
  APIError,
} from '../types/index.js';

const BASE_URL = 'https://nzdpu.com/wis';

// Custom URL param serializer that uses %20 for spaces (API requirement)
function serializeParams(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  }
  // URLSearchParams uses + for spaces, but the API needs %20
  return searchParams.toString().replace(/\+/g, '%20');
}

// ===== FIX 4: In-memory cache with TTL =====
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  
  set<T>(key: string, data: T, ttlMs: number = 300000): void { // Default 5 min TTL
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }
  
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }
}

// ===== FIX 2: Case normalization utilities =====
function toTitleCase(str: string): string {
  return str.toLowerCase().split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

function normalizeJurisdiction(jurisdiction: string): string {
  // Common country name variations - expand to cover more aliases
  const mappings: Record<string, string> = {
    'usa': 'United States of America',
    'us': 'United States of America',
    'united states': 'United States of America',
    'united states of america': 'United States of America',
    'america': 'United States of America',
    'uk': 'United Kingdom of Great Britain and Northern Ireland',
    'united kingdom': 'United Kingdom of Great Britain and Northern Ireland',
    'great britain': 'United Kingdom of Great Britain and Northern Ireland',
    'britain': 'United Kingdom of Great Britain and Northern Ireland',
    'england': 'United Kingdom of Great Britain and Northern Ireland',
    'uae': 'United Arab Emirates',
    'korea': 'Republic of Korea',
    'south korea': 'Republic of Korea',
  };
  
  const lower = jurisdiction.toLowerCase().trim();
  if (mappings[lower]) {
    return mappings[lower];
  }
  
  // Apply title case for standard country names
  return toTitleCase(jurisdiction);
}

export class NZDPUClient {
  private client: AxiosInstance;
  private apiKey: string;
  private cache: SimpleCache;
  private allCompaniesCache: Company[] | null = null;
  private allCompaniesCacheTime: number = 0;
  private readonly COMPANIES_CACHE_TTL = 600000; // 10 minutes

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.cache = new SimpleCache();
    this.client = axios.create({
      baseURL: BASE_URL,
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
      paramsSerializer: {
        serialize: serializeParams,
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const apiError: APIError = {
          code: error.code || 'UNKNOWN_ERROR',
          message: error.message,
          details: error.response?.data as Record<string, unknown> | undefined,
        };
        throw apiError;
      }
    );
  }

  // ===== FIX 3: Load all UNIQUE companies into cache =====
  private async ensureAllCompaniesLoaded(): Promise<Company[]> {
    const now = Date.now();
    if (this.allCompaniesCache && (now - this.allCompaniesCacheTime) < this.COMPANIES_CACHE_TTL) {
      return this.allCompaniesCache;
    }
    
    // Fetch all company records in batches
    // CRITICAL: API uses "start" not "offset" for pagination
    const allRecords: Company[] = [];
    let start = 0;
    const batchSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const response = await this.client.get('/coverage/companies', {
        params: { limit: batchSize, start }
      });
      const items = response.data.items || [];
      allRecords.push(...items);
      
      // Check if we've received all items based on API's total
      const total = response.data.total || 0;
      hasMore = items.length === batchSize && (start + items.length) < total;
      start += batchSize;
      
      // Safety limit to prevent infinite loops
      if (start > 100000) break;
    }
    
    // ===== CRITICAL FIX: Deduplicate by nz_id =====
    // API returns multiple records per company (one per reporting year)
    // Keep only unique companies, preferring the most recent record
    const companyMap = new Map<number, Company>();
    for (const record of allRecords) {
      const existing = companyMap.get(record.nz_id);
      if (!existing) {
        companyMap.set(record.nz_id, record);
      } else {
        // Keep the one with the later latest_reported_year
        if ((record.latest_reported_year || 0) > (existing.latest_reported_year || 0)) {
          companyMap.set(record.nz_id, record);
        }
      }
    }
    
    this.allCompaniesCache = Array.from(companyMap.values());
    this.allCompaniesCacheTime = now;
    
    // Only log on initial load, not cache hits
    if (allRecords.length > 0) {
      console.error(`[NZDPU] Loaded ${allRecords.length} records, deduplicated to ${this.allCompaniesCache.length} unique companies`);
    }
    
    return this.allCompaniesCache;
  }
  
  // ===== NEW: Load ALL company-year records (not deduplicated) for analytics =====
  private allRecordsCache: Company[] | null = null;
  private allRecordsCacheTime: number = 0;
  
  async getAllCompanyYearRecords(): Promise<Company[]> {
    const now = Date.now();
    if (this.allRecordsCache && (now - this.allRecordsCacheTime) < this.COMPANIES_CACHE_TTL) {
      return this.allRecordsCache;
    }
    
    // Fetch all company-year records in batches
    // CRITICAL: API uses "start" not "offset" for pagination
    const allRecords: Company[] = [];
    let start = 0;
    const batchSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const response = await this.client.get('/coverage/companies', {
        params: { limit: batchSize, start }
      });
      const items = response.data.items || [];
      allRecords.push(...items);
      
      const total = response.data.total || 0;
      hasMore = items.length === batchSize && (start + items.length) < total;
      start += batchSize;
      
      if (start > 100000) break;
    }
    
    this.allRecordsCache = allRecords;
    this.allRecordsCacheTime = now;
    
    return allRecords;
  }
  
  // ===== NEW: Get unique companies count =====
  async getUniqueCompanyCount(): Promise<number> {
    const companies = await this.ensureAllCompaniesLoaded();
    return companies.length;
  }
  
  // ===== NEW: Get companies with disclosure count =====
  // NOTE: This requires probing each year's disclosure-details endpoint per company
  // which is expensive (up to 6 API calls per company). Use with reasonable sample size.
  async getCompaniesWithDisclosureCount(
    minDisclosures: number, 
    sampleSize: number = 500,
    progressCallback?: (processed: number, total: number) => void
  ): Promise<{ count: number; companies: { nz_id: number; name: string; disclosures: number; years: number[] }[]; sampleInfo: string }> {
    const allCompanies = await this.ensureAllCompaniesLoaded();
    
    // For efficiency, we sample if the dataset is large
    const companies = sampleSize < allCompanies.length 
      ? this.sampleCompanies(allCompanies, sampleSize)
      : allCompanies;
    
    const isSample = companies.length < allCompanies.length;
    const yearsToCheck = [2023, 2022, 2021, 2020, 2019, 2018];
    
    const results: { nz_id: number; name: string; disclosures: number; years: number[] }[] = [];
    let processed = 0;
    
    // Process in batches
    const batchSize = 20;
    for (let i = 0; i < companies.length; i += batchSize) {
      const batch = companies.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (company) => {
        const years: number[] = [];
        for (const year of yearsToCheck) {
          try {
            await this.client.get(`/coverage/companies/${company.nz_id}/disclosure-details`, {
              params: { year },
              timeout: 5000,
            });
            years.push(year);
          } catch {
            // No data for this year
          }
        }
        return { nz_id: company.nz_id, name: company.company_name, disclosures: years.length, years };
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      processed += batch.length;
      if (progressCallback) {
        progressCallback(processed, companies.length);
      }
    }
    
    // Filter by minimum disclosures
    const qualifying = results.filter(r => r.disclosures >= minDisclosures);
    qualifying.sort((a, b) => b.disclosures - a.disclosures);
    
    const sampleInfo = isSample 
      ? `Based on sample of ${companies.length} companies out of ${allCompanies.length} total. Extrapolated count: ~${Math.round(qualifying.length * (allCompanies.length / companies.length))}`
      : `Full dataset scan of ${allCompanies.length} companies`;
    
    return { 
      count: qualifying.length, 
      companies: qualifying,
      sampleInfo 
    };
  }
  
  // Helper to sample companies representatively
  private sampleCompanies(companies: Company[], size: number): Company[] {
    if (companies.length <= size) return companies;
    
    // Random sampling
    const shuffled = [...companies].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, size);
  }

  // Company endpoints

  async listCompanies(params?: {
    search?: string;
    jurisdiction?: string;
    sics_sector?: string;
    sics_sub_sector?: string;  // Client-side filtering (API doesn't support this)
    sics_industry?: string;    // Client-side filtering (API doesn't support this)
    limit?: number;
    offset?: number;
    order_by?: string;
    order?: 'ASC' | 'DESC';
  }): Promise<PaginatedResponse<Company>> {
    // Extract client-side filters
    const { sics_sub_sector, sics_industry, search, ...apiParams } = params || {};
    
    // ===== FIX 2: Normalize jurisdiction case =====
    if (apiParams.jurisdiction) {
      apiParams.jurisdiction = normalizeJurisdiction(apiParams.jurisdiction);
    }
    
    // ===== FIX 1: Encode sector names properly =====
    // The API has issues with certain characters. We handle this in the params.
    if (apiParams.sics_sector) {
      // Axios should handle encoding, but some sector names cause issues
      // We'll try the original first, then fallback to client-side filtering
    }
    
    // If we need client-side filtering, fetch from cache
    const needsClientFilter = sics_sub_sector || sics_industry || search;
    
    let items: Company[];
    
    if (needsClientFilter) {
      // ===== FIX 3 & 6: Use cached company list for reliable filtering =====
      items = await this.ensureAllCompaniesLoaded();
      
      // Apply server-side equivalent filters on cached data
      if (apiParams.jurisdiction) {
        items = items.filter(c => c.jurisdiction === apiParams.jurisdiction);
      }
      if (apiParams.sics_sector) {
        items = items.filter(c => c.sics_sector === apiParams.sics_sector);
      }
    } else {
      // Check cache first for simple queries
      const cacheKey = `companies:${JSON.stringify(apiParams)}`;
      const cached = this.cache.get<Company[]>(cacheKey);
      if (cached) {
        items = cached;
      } else {
        try {
          const fetchLimit = apiParams.limit || 100;
          const response = await this.client.get('/coverage/companies', { 
            params: { ...apiParams, limit: fetchLimit } 
          });
          items = response.data.items || response.data.companies || (Array.isArray(response.data) ? response.data : []);
          
          // Cache the result
          this.cache.set(cacheKey, items);
        } catch (error) {
          // ===== FIX 1: Fallback for URL encoding issues =====
          // If API fails (e.g., with special chars in sector), use cached full list
          items = await this.ensureAllCompaniesLoaded();
          if (apiParams.jurisdiction) {
            items = items.filter(c => c.jurisdiction === apiParams.jurisdiction);
          }
          if (apiParams.sics_sector) {
            items = items.filter(c => c.sics_sector?.toLowerCase() === apiParams.sics_sector?.toLowerCase());
          }
        }
      }
    }
    
    // ===== FIX 6: Improved search - client-side name filtering =====
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      items = items.filter(c => 
        c.company_name?.toLowerCase().includes(searchLower) ||
        c.alias?.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply client-side filtering for sub_sector and industry
    if (sics_sub_sector) {
      items = items.filter((c: Company) => 
        c.sics_sub_sector?.toLowerCase() === sics_sub_sector.toLowerCase()
      );
    }
    if (sics_industry) {
      items = items.filter((c: Company) => 
        c.sics_industry?.toLowerCase().includes(sics_industry.toLowerCase())
      );
    }
    
    // Apply limit and offset after filtering
    const requestedLimit = params?.limit || 100;
    const requestedOffset = params?.offset || 0;
    const totalFiltered = items.length;
    const paginatedItems = items.slice(requestedOffset, requestedOffset + requestedLimit);
    
    return {
      data: paginatedItems,
      total: totalFiltered,
      page: Math.floor(requestedOffset / requestedLimit) + 1,
      limit: requestedLimit,
      hasMore: (requestedOffset + requestedLimit) < totalFiltered,
    };
  }
  
  // ===== FIX 7: Deduplicated sub-sector listing =====
  async listSubSectors(): Promise<{ sub_sector: string; industry: string; sector: string; count: number }[]> {
    const items = await this.ensureAllCompaniesLoaded();
    
    // Count unique combinations - using Map for deduplication
    const counts = new Map<string, { sub_sector: string; industry: string; sector: string; count: number }>();
    
    for (const company of items) {
      if (company.sics_sub_sector && company.sics_sub_sector !== 'Information Not Available') {
        // Use sub_sector as the primary key for deduplication
        const key = `${company.sics_sector}|${company.sics_sub_sector}|${company.sics_industry || 'Unknown'}`;
        const existing = counts.get(key);
        if (existing) {
          existing.count++;
        } else {
          counts.set(key, {
            sector: company.sics_sector || 'Unknown',
            sub_sector: company.sics_sub_sector,
            industry: company.sics_industry || 'Unknown',
            count: 1
          });
        }
      }
    }
    
    // Sort and return
    return Array.from(counts.values())
      .sort((a, b) => a.sector.localeCompare(b.sector) || a.sub_sector.localeCompare(b.sub_sector));
  }

  // ===== FIX 3: Improved company lookup =====
  async getCompany(companyId: number): Promise<CompanyProfile> {
    // Check emissions cache for company info
    const emissionsCacheKey = `company:${companyId}`;
    const cachedCompany = this.cache.get<CompanyProfile>(emissionsCacheKey);
    if (cachedCompany) {
      return cachedCompany;
    }
    
    // Search in full company list (cached)
    const allCompanies = await this.ensureAllCompaniesLoaded();
    const company = allCompanies.find(c => c.nz_id === companyId);
    
    if (company) {
      this.cache.set(emissionsCacheKey, company as CompanyProfile, 600000); // 10 min cache
      return company as CompanyProfile;
    }
    
    // If still not found, try the disclosure endpoint directly as it returns company info
    try {
      // Get latest year from 2023 downwards
      for (const year of [2023, 2022, 2021, 2020]) {
        try {
          const response = await this.client.get(`/coverage/companies/${companyId}/disclosure-details`, { 
            params: { year } 
          });
          if (response.data && response.data.name) {
            const companyProfile: CompanyProfile = {
              nz_id: companyId,
              company_name: response.data.name,
              lei: response.data.lei || null,
              jurisdiction: response.data.values?.jurisdiction || null,
              sics_sector: null,
              sics_sub_sector: null,
              sics_industry: null,
              latest_reported_year: year,
              source: 'CDP',
              active: true,
            } as unknown as CompanyProfile;
            
            this.cache.set(emissionsCacheKey, companyProfile, 600000);
            return companyProfile;
          }
        } catch {
          continue; // Try next year
        }
      }
    } catch {
      // Fall through to error
    }
    
    throw new Error(`Company with nz_id ${companyId} not found`);
  }

  // ===== FIX 6: Improved search =====
  async searchCompanies(searchTerm: string, limit: number = 10): Promise<Company[]> {
    // Handle empty search term
    const searchLower = searchTerm.toLowerCase().trim();
    if (!searchLower) {
      return [];
    }
    
    // Use client-side filtering for reliable search
    const allCompanies = await this.ensureAllCompaniesLoaded();
    
    const matched = allCompanies.filter(c => 
      c.company_name?.toLowerCase().includes(searchLower) ||
      c.alias?.toLowerCase().includes(searchLower)
    );
    
    // Sort by relevance (exact matches first, then starts-with, then contains)
    matched.sort((a, b) => {
      const aName = a.company_name?.toLowerCase() || '';
      const bName = b.company_name?.toLowerCase() || '';
      
      const aExact = aName === searchLower ? 0 : 1;
      const bExact = bName === searchLower ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      
      const aStarts = aName.startsWith(searchLower) ? 0 : 1;
      const bStarts = bName.startsWith(searchLower) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      
      return aName.localeCompare(bName);
    });
    
    return matched.slice(0, limit);
  }

  // Disclosure details - main endpoint for emissions data
  async getDisclosureDetails(companyId: number, year: number): Promise<Record<string, unknown>> {
    const cacheKey = `disclosure:${companyId}:${year}`;
    const cached = this.cache.get<Record<string, unknown>>(cacheKey);
    if (cached) {
      return cached;
    }
    
    const response = await this.client.get(`/coverage/companies/${companyId}/disclosure-details`, { 
      params: { year } 
    });
    const data = response.data;
    
    // Data is nested under 'values' key
    let result: Record<string, unknown>;
    if (data.values && typeof data.values === 'object') {
      result = data.values as Record<string, unknown>;
    } else {
      result = data;
    }
    
    this.cache.set(cacheKey, result, 300000); // 5 min cache
    return result;
  }

  // Emissions endpoints - extracted from disclosure details
  async getCompanyEmissions(companyId: number, year?: number): Promise<EmissionsData[]> {
    // First get company to find latest reported year if not specified
    const company = await this.getCompany(companyId);
    const reportingYear = year || company.latest_reported_year || 2021;
    
    // Check cache
    const cacheKey = `emissions:${companyId}:${reportingYear}`;
    const cached = this.cache.get<EmissionsData[]>(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      const details = await this.getDisclosureDetails(companyId, reportingYear);
      
      // Extract emissions data from the disclosure details
      const emissions: EmissionsData = {
        company_id: companyId,
        year: reportingYear,
        scope1_emissions: parseEmissionValue(details['total_s1_emissions_ghg']),
        scope1_methodology: details['s1_emissions_method'] as string | undefined,
        scope2_location_based: parseEmissionValue(details['total_s2_lb_emissions_ghg']),
        scope2_market_based: parseEmissionValue(details['total_s2_mb_emissions_ghg']),
        scope2_lb_methodology: details['s2_lb_emissions_method'] as string | undefined,
        scope2_mb_methodology: details['s2_mb_emissions_method'] as string | undefined,
        scope3_total: parseEmissionValue(details['total_s3_emissions_ghg']),
        organizational_boundary: details['org_boundary'] as string | undefined,
        verification_status: getVerificationStatus(details),
        scope3_categories: extractScope3Categories(details),
      };
      
      const result = [emissions];
      this.cache.set(cacheKey, result, 300000); // 5 min cache
      return result;
    } catch (error) {
      // Return empty if no data found
      return [];
    }
  }

  async getCompanyTargets(companyId: number): Promise<EmissionsTarget[]> {
    // Get latest year's disclosure details to extract targets
    const company = await this.getCompany(companyId);
    const year = company.latest_reported_year || 2021;
    
    try {
      const details = await this.getDisclosureDetails(companyId, year);
      return extractTargets(details, companyId);
    } catch (error) {
      return [];
    }
  }

  // Lookup endpoints

  async listSectors(): Promise<SicsSector[]> {
    const cacheKey = 'sectors';
    const cached = this.cache.get<SicsSector[]>(cacheKey);
    if (cached) {
      return cached;
    }
    
    const response = await this.client.get('/coverage/companies/sics-sector');
    const data = response.data;
    
    // API returns { sics_sector: { "Sector Name": count, ... } }
    let result: SicsSector[];
    if (data.sics_sector && typeof data.sics_sector === 'object') {
      result = Object.entries(data.sics_sector).map(([name, count]) => ({
        sector_code: name,
        sector_name: name,
        company_count: count as number,
      }));
    } else {
      // Fallback for direct array format
      result = Array.isArray(data) ? data : [];
    }
    
    this.cache.set(cacheKey, result, 600000); // 10 min cache
    return result;
  }

  async listJurisdictions(): Promise<Jurisdiction[]> {
    const cacheKey = 'jurisdictions';
    const cached = this.cache.get<Jurisdiction[]>(cacheKey);
    if (cached) {
      return cached;
    }
    
    const response = await this.client.get('/coverage/companies/jurisdictions');
    const data = response.data;
    
    // API returns { jurisdictions: { "Country Name": "ISO Code", ... } }
    let result: Jurisdiction[];
    if (data.jurisdictions && typeof data.jurisdictions === 'object') {
      result = Object.entries(data.jurisdictions).map(([name, code]) => ({
        jurisdiction_code: code as string,
        jurisdiction_name: name,
        company_count: 0, // Count not provided in this format
      }));
    } else {
      // Fallback for direct array format
      result = Array.isArray(data) ? data : [];
    }
    
    this.cache.set(cacheKey, result, 600000); // 10 min cache
    return result;
  }

  // Bulk data for benchmarking - with caching

  async getCompaniesBySector(sectorCode: string, limit: number = 1000): Promise<Company[]> {
    const cacheKey = `companies_sector:${sectorCode}:${limit}`;
    const cached = this.cache.get<Company[]>(cacheKey);
    if (cached) {
      return cached;
    }
    
    const response = await this.listCompanies({
      sics_sector: sectorCode,
      limit,
    });
    
    this.cache.set(cacheKey, response.data, 300000); // 5 min cache
    return response.data;
  }

  async getCompaniesByJurisdiction(jurisdiction: string, limit: number = 1000): Promise<Company[]> {
    const cacheKey = `companies_jurisdiction:${jurisdiction}:${limit}`;
    const cached = this.cache.get<Company[]>(cacheKey);
    if (cached) {
      return cached;
    }
    
    const response = await this.listCompanies({
      jurisdiction,
      limit,
    });
    
    this.cache.set(cacheKey, response.data, 300000); // 5 min cache
    return response.data;
  }

  async getCompaniesBySectorAndJurisdiction(
    sectorCode: string,
    jurisdiction: string,
    limit: number = 1000
  ): Promise<Company[]> {
    const cacheKey = `companies_sector_juris:${sectorCode}:${jurisdiction}:${limit}`;
    const cached = this.cache.get<Company[]>(cacheKey);
    if (cached) {
      return cached;
    }
    
    const response = await this.listCompanies({
      sics_sector: sectorCode,
      jurisdiction,
      limit,
    });
    
    this.cache.set(cacheKey, response.data, 300000); // 5 min cache
    return response.data;
  }

  // ===== FIX 5: Improved batch emissions with higher concurrency =====
  async getBatchEmissions(companyIds: number[], year?: number, progressCallback?: (processed: number, total: number) => void): Promise<Map<number, EmissionsData[]>> {
    const results = new Map<number, EmissionsData[]>();
    
    // Check cache first for each ID
    const uncachedIds: number[] = [];
    for (const id of companyIds) {
      const cacheKey = `emissions:${id}:${year || 'latest'}`;
      const cached = this.cache.get<EmissionsData[]>(cacheKey);
      if (cached) {
        results.set(id, cached);
      } else {
        uncachedIds.push(id);
      }
    }
    
    // Process uncached IDs in parallel batches with INCREASED concurrency
    const batchSize = 50; // Increased from 15 to 50 for much better performance
    let processed = results.size;
    
    for (let i = 0; i < uncachedIds.length; i += batchSize) {
      const batch = uncachedIds.slice(i, i + batchSize);
      const promises = batch.map(id => 
        this.getCompanyEmissions(id, year).catch(() => [] as EmissionsData[])
      );
      const batchResults = await Promise.all(promises);
      
      batch.forEach((id, index) => {
        results.set(id, batchResults[index]);
      });
      
      processed += batch.length;
      if (progressCallback) {
        progressCallback(processed, companyIds.length);
      }
    }
    
    return results;
  }
  
  // ===== NEW: Get top emitters across FULL dataset =====
  async getTopEmitters(params: {
    scope: 'scope1' | 'scope2_lb' | 'scope2_mb' | 'scope3' | `scope3_cat_${number}`;
    limit?: number;
    year?: number;
    progressCallback?: (processed: number, total: number) => void;
  }): Promise<{
    emitters: { nz_id: number; name: string; value: number; year: number; jurisdiction?: string; sector?: string }[];
    totalScanned: number;
    validValues: number;
  }> {
    const { scope, limit = 10, year, progressCallback } = params;
    
    // Get ALL company-year records for full dataset coverage
    const allRecords = await this.getAllCompanyYearRecords();
    
    // If specific year requested, filter records
    const records = year 
      ? allRecords.filter(r => r.latest_reported_year === year)
      : allRecords;
    
    // Deduplicate by nz_id (keep most recent year per company)
    const uniqueCompanies = new Map<number, Company>();
    for (const record of records) {
      const existing = uniqueCompanies.get(record.nz_id);
      if (!existing || (record.latest_reported_year || 0) > (existing.latest_reported_year || 0)) {
        uniqueCompanies.set(record.nz_id, record);
      }
    }
    
    const companies = Array.from(uniqueCompanies.values());
    const companyIds = companies.map(c => c.nz_id);
    
    // Fetch emissions for ALL companies
    const emissionsMap = await this.getBatchEmissions(companyIds, year, progressCallback);
    
    // Extract the requested scope value
    const emitterData: { nz_id: number; name: string; value: number; year: number; jurisdiction?: string; sector?: string }[] = [];
    let validValues = 0;
    
    for (const company of companies) {
      const emissions = emissionsMap.get(company.nz_id);
      if (!emissions || emissions.length === 0) continue;
      
      const e = emissions[0];
      let value: number | undefined;
      
      if (scope === 'scope1') {
        value = e.scope1_emissions;
      } else if (scope === 'scope2_lb') {
        value = e.scope2_location_based;
      } else if (scope === 'scope2_mb') {
        value = e.scope2_market_based;
      } else if (scope === 'scope3') {
        value = e.scope3_total;
      } else if (scope.startsWith('scope3_cat_')) {
        const catNum = parseInt(scope.replace('scope3_cat_', ''));
        const cat = e.scope3_categories?.find(c => c.category_number === catNum);
        value = cat?.emissions;
      }
      
      if (value !== undefined && value > 0) {
        validValues++;
        emitterData.push({
          nz_id: company.nz_id,
          name: company.company_name,
          value,
          year: e.year,
          jurisdiction: company.jurisdiction,
          sector: company.sics_sector,
        });
      }
    }
    
    // Sort by value descending and take top N
    emitterData.sort((a, b) => b.value - a.value);
    
    return {
      emitters: emitterData.slice(0, limit),
      totalScanned: companies.length,
      validValues,
    };
  }
  
  // ===== NEW: Validate emissions data with SME rules =====
  validateEmissionsValue(value: number, scope: string, company?: Company, emissions?: EmissionsData): {
    valid: boolean;
    warnings: string[];
    severity: 'info' | 'warning' | 'error';
  } {
    const warnings: string[] = [];
    let severity: 'info' | 'warning' | 'error' = 'info';
    
    // Rule 1: Unit error detection (>1 billion tCO2e is highly suspicious)
    if (value > 1000000000) {
      warnings.push(`Extremely high value (${value.toExponential(2)} tCO2e) - possible unit error (kg reported as tonnes)`);
      severity = 'error';
    } else if (value > 100000000) {
      warnings.push(`Very high value (${value.toExponential(2)} tCO2e) - verify accuracy`);
      severity = 'warning';
    }
    
    // Rule 2: Suspiciously round numbers
    const str = String(value);
    if (/^[1-9]0{8,}$/.test(str)) {
      warnings.push('Suspiciously round number - may be an estimate or placeholder');
      severity = severity === 'error' ? 'error' : 'warning';
    }
    
    // Rule 3: Scope 3 category vs total check
    if (scope.startsWith('scope3_cat_') && emissions?.scope3_total) {
      if (value > emissions.scope3_total) {
        warnings.push('Category emissions exceed total Scope 3 (impossible)');
        severity = 'error';
      }
    }
    
    // Rule 4: Negative values (should not exist)
    if (value < 0) {
      warnings.push('Negative emissions value (invalid)');
      severity = 'error';
    }
    
    return {
      valid: severity !== 'error',
      warnings,
      severity,
    };
  }
  
  // ===== NEW: Get dataset statistics =====
  async getDatasetStats(): Promise<{
    totalUniqueCompanies: number;
    totalCompanyYearRecords: number;
    companiesByDisclosureCount: Record<number, number>;
    companiesBySector: Record<string, number>;
    companiesByJurisdiction: Record<string, number>;
    yearCoverage: Record<number, number>;
  }> {
    const allRecords = await this.getAllCompanyYearRecords();
    const uniqueCompanies = await this.ensureAllCompaniesLoaded();
    
    // Count disclosures per company
    const disclosureCounts = new Map<number, number>();
    for (const record of allRecords) {
      disclosureCounts.set(record.nz_id, (disclosureCounts.get(record.nz_id) || 0) + 1);
    }
    
    // Group companies by disclosure count
    const companiesByDisclosureCount: Record<number, number> = {};
    for (const count of disclosureCounts.values()) {
      companiesByDisclosureCount[count] = (companiesByDisclosureCount[count] || 0) + 1;
    }
    
    // Count by sector
    const companiesBySector: Record<string, number> = {};
    for (const company of uniqueCompanies) {
      const sector = company.sics_sector || 'Unknown';
      companiesBySector[sector] = (companiesBySector[sector] || 0) + 1;
    }
    
    // Count by jurisdiction
    const companiesByJurisdiction: Record<string, number> = {};
    for (const company of uniqueCompanies) {
      const jurisdiction = company.jurisdiction || 'Unknown';
      companiesByJurisdiction[jurisdiction] = (companiesByJurisdiction[jurisdiction] || 0) + 1;
    }
    
    // Count by year
    const yearCoverage: Record<number, number> = {};
    for (const record of allRecords) {
      const year = record.latest_reported_year || 0;
      yearCoverage[year] = (yearCoverage[year] || 0) + 1;
    }
    
    return {
      totalUniqueCompanies: uniqueCompanies.length,
      totalCompanyYearRecords: allRecords.length,
      companiesByDisclosureCount,
      companiesBySector,
      companiesByJurisdiction,
      yearCoverage,
    };
  }
  
  // Utility: Clear cache
  clearCache(): void {
    this.cache.clear();
    this.allCompaniesCache = null;
    this.allCompaniesCacheTime = 0;
    this.allRecordsCache = null;
    this.allRecordsCacheTime = 0;
  }
  
  // Utility: Get cache stats
  getCacheStats(): { 
    companiesLoaded: boolean; 
    companiesCount: number; 
    recordsCount: number;
    cacheAge: number;
  } {
    return {
      companiesLoaded: this.allCompaniesCache !== null,
      companiesCount: this.allCompaniesCache?.length || 0,
      recordsCount: this.allRecordsCache?.length || 0,
      cacheAge: this.allCompaniesCache ? Date.now() - this.allCompaniesCacheTime : 0,
    };
  }
}

// Helper functions to parse disclosure data

function parseEmissionValue(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '—' || value === '') {
    return undefined;
  }
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  return isNaN(num) ? undefined : num;
}

function getVerificationStatus(details: Record<string, unknown>): string | undefined {
  const verifDict = details['verif_emissions_dict'] as Array<Record<string, unknown>> | undefined;
  if (verifDict && verifDict.length > 0) {
    const verif = verifDict[0];
    if (verif['verif_emissions_level_of_assurance'] && verif['verif_emissions_level_of_assurance'] !== '—') {
      return verif['verif_emissions_level_of_assurance'] as string;
    }
  }
  return undefined;
}

function extractScope3Categories(details: Record<string, unknown>): Scope3Category[] {
  const categories: Scope3Category[] = [];
  
  const categoryNames: Record<number, string> = {
    1: 'Purchased goods and services',
    2: 'Capital goods',
    3: 'Fuel and energy-related activities',
    4: 'Upstream transportation and distribution',
    5: 'Waste generated in operations',
    6: 'Business travel',
    7: 'Employee commuting',
    8: 'Upstream leased assets',
    9: 'Downstream transportation and distribution',
    10: 'Processing of sold products',
    11: 'Use of sold products',
    12: 'End-of-life treatment of sold products',
    13: 'Downstream leased assets',
    14: 'Franchises',
    15: 'Investments',
  };
  
  for (let i = 1; i <= 15; i++) {
    const emissions = parseEmissionValue(details[`total_s3_ghgp_c${i}_emissions_ghg`]);
    const relevancy = details[`s3_ghgp_c${i}_emissions_relevancy`] as string | undefined;
    
    if (emissions !== undefined || (relevancy && relevancy !== '—')) {
      categories.push({
        category_number: i,
        category_name: categoryNames[i],
        emissions,
        relevancy: relevancy !== '—' ? relevancy : undefined,
      });
    }
  }
  
  return categories;
}

function extractTargets(details: Record<string, unknown>, companyId: number): EmissionsTarget[] {
  const targets: EmissionsTarget[] = [];
  
  // Extract absolute targets
  const absTargets = details['tgt_abs_dict'] as Array<Record<string, unknown>> | undefined;
  if (absTargets) {
    for (const target of absTargets) {
      if (target['tgt_abs_id'] && target['tgt_abs_id'] !== '—') {
        targets.push({
          company_id: companyId,
          target_type: 'absolute',
          target_year: target['tgt_abs_target_year'] as number,
          base_year: target['tgt_abs_base_year'] as number,
          target_scope: target['tgt_abs_cvg_scope'] as string || '',
          target_percentage: parseEmissionValue(target['tgt_abs_target_year_total_perc_reduction']),
          sbti_status: target['tgt_abs_ambition'] as string | undefined,
        });
      }
    }
  }
  
  // Extract intensity targets
  const intTargets = details['tgt_int_dict'] as Array<Record<string, unknown>> | undefined;
  if (intTargets) {
    for (const target of intTargets) {
      if (target['tgt_int_id'] && target['tgt_int_id'] !== '—') {
        targets.push({
          company_id: companyId,
          target_type: 'intensity',
          target_year: target['tgt_int_target_year'] as number,
          base_year: target['tgt_int_base_year'] as number,
          target_scope: target['tgt_int_cvg_scope'] as string || '',
          target_percentage: parseEmissionValue(target['tgt_int_target_year_total_int_perc_reduction']),
          sbti_status: target['tgt_int_ambition'] as string | undefined,
        });
      }
    }
  }
  
  return targets;
}

// Singleton instance management
let clientInstance: NZDPUClient | null = null;

export function initializeClient(apiKey: string): NZDPUClient {
  clientInstance = new NZDPUClient(apiKey);
  return clientInstance;
}

export function getClient(): NZDPUClient {
  if (!clientInstance) {
    throw new Error('NZDPU client not initialized. Call initializeClient first.');
  }
  return clientInstance;
}
