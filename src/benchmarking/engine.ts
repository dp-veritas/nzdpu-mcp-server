// Benchmarking Engine

import {
  Company,
  EmissionsData,
  PeerGroupStats,
  PeerGroupComparison,
  BenchmarkResult,
  CompanyProfile,
  ComparabilityWarning,
  Scope2Methodology,
} from '../types/index.js';
import { getClient } from '../api/client.js';
import { checkScope2Comparability } from '../knowledge/comparability.js';

// Calculate statistics for a peer group
export function calculatePeerStats(values: number[]): PeerGroupStats {
  if (values.length === 0) {
    return {
      count: 0,
      mean: 0,
      median: 0,
      stdDev: 0,
      min: 0,
      max: 0,
      percentile25: 0,
      percentile75: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  // Mean
  const mean = values.reduce((sum, v) => sum + v, 0) / n;

  // Median
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];

  // Standard deviation
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  // Percentiles
  const percentile25 = sorted[Math.floor(n * 0.25)];
  const percentile75 = sorted[Math.floor(n * 0.75)];

  return {
    count: n,
    mean,
    median,
    stdDev,
    min: sorted[0],
    max: sorted[n - 1],
    percentile25,
    percentile75,
  };
}

// Calculate percentile rank
export function calculatePercentileRank(value: number, values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const belowCount = sorted.filter(v => v < value).length;
  const equalCount = sorted.filter(v => v === value).length;
  return ((belowCount + 0.5 * equalCount) / sorted.length) * 100;
}

// Extract emission value based on scope
export function getEmissionValue(
  emissions: EmissionsData,
  scope: 'scope1' | 'scope2_lb' | 'scope2_mb' | 'scope3'
): number | undefined {
  switch (scope) {
    case 'scope1':
      return emissions.scope1_emissions;
    case 'scope2_lb':
      return emissions.scope2_location_based;
    case 'scope2_mb':
      return emissions.scope2_market_based;
    case 'scope3':
      return emissions.scope3_total;
    default:
      return undefined;
  }
}

// Create peer group comparison
export function createPeerComparison(
  peerGroupName: string,
  companyValue: number,
  peerValues: number[],
  methodology?: string
): PeerGroupComparison {
  const stats = calculatePeerStats(peerValues);
  const percentileRank = calculatePercentileRank(companyValue, peerValues);

  return {
    peerGroupName,
    peerCount: peerValues.length,
    companyValue,
    percentileRank,
    stats,
    methodology,
  };
}

// Filter emissions by Scope 2 methodology
export function filterByScope2Methodology(
  emissionsMap: Map<number, EmissionsData[]>,
  methodology: Scope2Methodology
): Map<number, number> {
  const result = new Map<number, number>();
  
  for (const [companyId, emissions] of emissionsMap) {
    if (emissions.length > 0) {
      const latest = emissions[0]; // Assuming sorted by year descending
      const value = methodology === 'location_based' 
        ? latest.scope2_location_based 
        : latest.scope2_market_based;
      
      if (value !== undefined && value !== null) {
        result.set(companyId, value);
      }
    }
  }
  
  return result;
}

// Main benchmarking function
export async function benchmarkCompany(
  companyId: number,
  scope: 'scope1' | 'scope2_lb' | 'scope2_mb' | 'scope3',
  year?: number
): Promise<BenchmarkResult> {
  const client = getClient();
  const warnings: ComparabilityWarning[] = [];
  const methodologyNotes: string[] = [];

  // Get company profile
  const companyProfile = await client.getCompany(companyId);
  
  // Get company emissions
  const companyEmissions = await client.getCompanyEmissions(companyId, year);
  if (companyEmissions.length === 0) {
    throw new Error(`No emissions data found for company ${companyId}`);
  }
  
  const latestEmissions = companyEmissions[0];
  const emissionsYear = latestEmissions.year;
  const companyValue = getEmissionValue(latestEmissions, scope);
  
  if (companyValue === undefined) {
    throw new Error(`No ${scope} data found for company ${companyId}`);
  }

  // Add methodology notes for Scope 2
  if (scope === 'scope2_lb') {
    methodologyNotes.push('Benchmarking using Scope 2 location-based methodology only.');
    methodologyNotes.push('All peer companies in this comparison also report location-based Scope 2.');
    if (latestEmissions.scope2_lb_methodology) {
      methodologyNotes.push(`Company methodology: ${latestEmissions.scope2_lb_methodology}`);
    }
  } else if (scope === 'scope2_mb') {
    methodologyNotes.push('Benchmarking using Scope 2 market-based methodology only.');
    methodologyNotes.push('All peer companies in this comparison also report market-based Scope 2.');
    if (latestEmissions.scope2_mb_methodology) {
      methodologyNotes.push(`Company methodology: ${latestEmissions.scope2_mb_methodology}`);
    }
  }

  // Initialize result
  const result: BenchmarkResult = {
    company: companyProfile,
    emissionsYear,
    scope,
    methodologyNotes,
    comparabilityWarnings: warnings,
  };

  // Get peer groups
  const { jurisdiction, sics_sector } = companyProfile;

  // Jurisdiction benchmark
  if (jurisdiction) {
    try {
      const jurisdictionPeers = await client.getCompaniesByJurisdiction(jurisdiction);
      const peerEmissions = await client.getBatchEmissions(
        jurisdictionPeers.map(c => c.nz_id).filter(id => id !== companyId),
        emissionsYear
      );
      
      const peerValues = extractPeerValues(peerEmissions, scope);
      
      if (peerValues.length > 0) {
        result.jurisdictionBenchmark = createPeerComparison(
          `${jurisdiction} Companies`,
          companyValue,
          peerValues
        );
      }
    } catch (error) {
      methodologyNotes.push(`Could not retrieve jurisdiction peers: ${error}`);
    }
  }

  // Sector benchmark
  if (sics_sector) {
    try {
      const sectorPeers = await client.getCompaniesBySector(sics_sector);
      const peerEmissions = await client.getBatchEmissions(
        sectorPeers.map(c => c.nz_id).filter(id => id !== companyId),
        emissionsYear
      );
      
      const peerValues = extractPeerValues(peerEmissions, scope);
      
      if (peerValues.length > 0) {
        result.sectorBenchmark = createPeerComparison(
          `${sics_sector} Sector`,
          companyValue,
          peerValues
        );
      }
    } catch (error) {
      methodologyNotes.push(`Could not retrieve sector peers: ${error}`);
    }
  }

  // Intersection benchmark (jurisdiction + sector)
  if (jurisdiction && sics_sector) {
    try {
      const intersectionPeers = await client.getCompaniesBySectorAndJurisdiction(
        sics_sector,
        jurisdiction
      );
      
      // Only create intersection benchmark if there are enough peers
      const otherPeers = intersectionPeers.filter(c => c.nz_id !== companyId);
      
      if (otherPeers.length >= 3) {
        const peerEmissions = await client.getBatchEmissions(
          otherPeers.map(c => c.nz_id),
          emissionsYear
        );
        
        const peerValues = extractPeerValues(peerEmissions, scope);
        
        if (peerValues.length >= 3) {
          result.intersectionBenchmark = createPeerComparison(
            `${jurisdiction} ${sics_sector} Companies`,
            companyValue,
            peerValues
          );
        } else {
          methodologyNotes.push(`Only ${peerValues.length} peers found in ${jurisdiction} ${sics_sector}. Minimum 3 required for intersection benchmark.`);
        }
      } else {
        methodologyNotes.push(`Only ${otherPeers.length} peers found in ${jurisdiction} ${sics_sector}. Intersection benchmark not available.`);
      }
    } catch (error) {
      methodologyNotes.push(`Could not retrieve intersection peers: ${error}`);
    }
  }

  return result;
}

// Extract peer values from emissions map
function extractPeerValues(
  emissionsMap: Map<number, EmissionsData[]>,
  scope: 'scope1' | 'scope2_lb' | 'scope2_mb' | 'scope3'
): number[] {
  const values: number[] = [];
  
  for (const [, emissions] of emissionsMap) {
    if (emissions.length > 0) {
      const value = getEmissionValue(emissions[0], scope);
      if (value !== undefined && value !== null && value > 0) {
        values.push(value);
      }
    }
  }
  
  return values;
}

// Format benchmark result as readable text
export function formatBenchmarkResult(result: BenchmarkResult): string {
  let output = `# Benchmark Results for ${result.company.company_name}\n\n`;
  output += `**Year:** ${result.emissionsYear}\n`;
  output += `**Scope:** ${formatScope(result.scope)}\n`;
  
  if (result.company.jurisdiction) {
    output += `**Jurisdiction:** ${result.company.jurisdiction}\n`;
  }
  if (result.company.sics_sector) {
    output += `**Sector:** ${result.company.sics_sector}\n`;
  }
  
  output += '\n---\n\n';

  // Jurisdiction benchmark
  if (result.jurisdictionBenchmark) {
    output += formatPeerComparison(result.jurisdictionBenchmark, 'Jurisdiction');
  }

  // Sector benchmark
  if (result.sectorBenchmark) {
    output += formatPeerComparison(result.sectorBenchmark, 'Sector');
  }

  // Intersection benchmark
  if (result.intersectionBenchmark) {
    output += formatPeerComparison(result.intersectionBenchmark, 'Jurisdiction + Sector');
  }

  // Methodology notes
  if (result.methodologyNotes.length > 0) {
    output += '## Methodology Notes\n\n';
    result.methodologyNotes.forEach(note => {
      output += `• ${note}\n`;
    });
    output += '\n';
  }

  // Comparability warnings
  if (result.comparabilityWarnings.length > 0) {
    output += '## ⚠️ Comparability Warnings\n\n';
    result.comparabilityWarnings.forEach(warning => {
      output += `**${warning.severity.toUpperCase()}:** ${warning.message}\n`;
      if (warning.suggestion) {
        output += `*Suggestion:* ${warning.suggestion}\n`;
      }
      output += '\n';
    });
  }

  return output;
}

function formatScope(scope: string): string {
  switch (scope) {
    case 'scope1': return 'Scope 1';
    case 'scope2_lb': return 'Scope 2 (Location-Based)';
    case 'scope2_mb': return 'Scope 2 (Market-Based)';
    case 'scope3': return 'Scope 3';
    default: return scope;
  }
}

function formatPeerComparison(comparison: PeerGroupComparison, type: string): string {
  let output = `## ${type} Benchmark: ${comparison.peerGroupName}\n\n`;
  
  output += `**Your Value:** ${comparison.companyValue.toLocaleString()} tCO₂e\n`;
  output += `**Percentile Rank:** ${comparison.percentileRank.toFixed(1)}th percentile\n`;
  output += `**Peer Count:** ${comparison.peerCount} companies\n\n`;
  
  output += `**Peer Group Statistics:**\n`;
  output += `• Mean: ${comparison.stats.mean.toLocaleString()} tCO₂e\n`;
  output += `• Median: ${comparison.stats.median.toLocaleString()} tCO₂e\n`;
  output += `• Std Dev: ${comparison.stats.stdDev.toLocaleString()} tCO₂e\n`;
  output += `• Range: ${comparison.stats.min.toLocaleString()} - ${comparison.stats.max.toLocaleString()} tCO₂e\n`;
  output += `• 25th-75th Percentile: ${comparison.stats.percentile25.toLocaleString()} - ${comparison.stats.percentile75.toLocaleString()} tCO₂e\n\n`;
  
  // Interpretation
  const percentile = comparison.percentileRank;
  let interpretation = '';
  if (percentile <= 25) {
    interpretation = '✅ **Lower quartile** - Among the lowest emitters in this peer group.';
  } else if (percentile <= 50) {
    interpretation = '📊 **Below median** - Lower than average emissions for this peer group.';
  } else if (percentile <= 75) {
    interpretation = '📊 **Above median** - Higher than average emissions for this peer group.';
  } else {
    interpretation = '⚠️ **Upper quartile** - Among the highest emitters in this peer group.';
  }
  output += interpretation + '\n\n';
  
  return output;
}

// Quick peer statistics without full benchmark
export async function getPeerStatistics(
  jurisdiction?: string,
  sicsSector?: string,
  scope: 'scope1' | 'scope2_lb' | 'scope2_mb' | 'scope3' = 'scope1',
  year?: number
): Promise<{ stats: PeerGroupStats; peerCount: number; scope: string; filters: string[] }> {
  const client = getClient();
  const filters: string[] = [];
  
  let peers: Company[] = [];
  
  if (jurisdiction && sicsSector) {
    peers = await client.getCompaniesBySectorAndJurisdiction(sicsSector, jurisdiction);
    filters.push(`Jurisdiction: ${jurisdiction}`, `Sector: ${sicsSector}`);
  } else if (jurisdiction) {
    peers = await client.getCompaniesByJurisdiction(jurisdiction);
    filters.push(`Jurisdiction: ${jurisdiction}`);
  } else if (sicsSector) {
    peers = await client.getCompaniesBySector(sicsSector);
    filters.push(`Sector: ${sicsSector}`);
  } else {
    throw new Error('At least one of jurisdiction or sicsSector must be provided');
  }
  
  if (peers.length === 0) {
    return {
      stats: calculatePeerStats([]),
      peerCount: 0,
      scope: formatScope(scope),
      filters,
    };
  }
  
  const peerEmissions = await client.getBatchEmissions(
    peers.map(c => c.nz_id),
    year
  );
  
  const peerValues = extractPeerValues(peerEmissions, scope);
  
  return {
    stats: calculatePeerStats(peerValues),
    peerCount: peerValues.length,
    scope: formatScope(scope),
    filters,
  };
}

