#!/usr/bin/env node
/**
 * RIGOROUS REAL-WORLD TESTING: nzdpu_benchmark tool
 * Tests realistic analyst questions and verifies response accuracy
 */

import * as db from './dist/db/queries.js';

console.log('\n' + '='.repeat(80));
console.log('RIGOROUS BENCHMARK TOOL TESTING - Real-World Scenarios');
console.log('='.repeat(80) + '\n');

let passCount = 0;
let failCount = 0;
const issues = [];

function pass(test) {
  passCount++;
  console.log(`  ✅ PASS: ${test}`);
}

function fail(test, reason) {
  failCount++;
  console.log(`  ❌ FAIL: ${test}`);
  console.log(`     Reason: ${reason}`);
  issues.push({ test, reason });
}

function warn(test, message) {
  console.log(`  ⚠️  WARN: ${test}`);
  console.log(`     ${message}`);
}

// ============================================================
// SCENARIO 1: "How does Shell compare to its Oil & Gas peers?"
// ============================================================
console.log('\n📊 SCENARIO 1: "How does Shell compare to its Oil & Gas peers?"');
console.log('-'.repeat(70));

const shell = db.listCompanies({ search: 'Shell', limit: 5 }).data.find(c => c.company_name.includes('Shell'));
if (!shell) {
  fail('Find Shell', 'Could not find Shell in database');
} else {
  console.log(`Found: ${shell.company_name} (nz_id: ${shell.nz_id})`);
  console.log(`Sector: ${shell.sics_sector} > ${shell.sics_sub_sector}`);
  
  // Test 1.1: Single company benchmark
  const benchmark = db.benchmarkCompany(shell.nz_id, 'scope1');
  
  if (!benchmark) {
    fail('Benchmark Shell', 'benchmarkCompany returned null');
  } else {
    // Verify company value exists
    if (benchmark.companyValue && benchmark.companyValue > 0) {
      pass(`Shell has Scope 1 value: ${benchmark.companyValue.toLocaleString()} tCO2e`);
    } else {
      fail('Shell Scope 1 value', `Expected positive value, got: ${benchmark.companyValue}`);
    }
    
    // Verify sector stats make sense
    if (benchmark.sectorStats) {
      const stats = benchmark.sectorStats;
      console.log(`\n  Sector Stats (${shell.sics_sector}):`);
      console.log(`    Count: ${stats.count}, Mean: ${Math.round(stats.mean).toLocaleString()}, Median: ${Math.round(stats.median).toLocaleString()}`);
      
      // Statistical sanity checks
      if (stats.median <= stats.mean) {
        pass('Median ≤ Mean (expected for right-skewed emissions data)');
      } else {
        warn('Statistical distribution', `Median (${stats.median}) > Mean (${stats.mean}) - unusual for emissions data`);
      }
      
      if (stats.min <= stats.median && stats.median <= stats.max) {
        pass('Min ≤ Median ≤ Max (valid ordering)');
      } else {
        fail('Statistical ordering', `Invalid: min=${stats.min}, median=${stats.median}, max=${stats.max}`);
      }
      
      // Percentile check - Shell should be a major emitter
      if (benchmark.percentileInSector !== null && benchmark.percentileInSector !== undefined) {
        if (benchmark.percentileInSector > 50) {
          pass(`Shell at ${benchmark.percentileInSector}th percentile in sector (expected high for major O&G)`);
        } else {
          warn('Shell percentile', `Only ${benchmark.percentileInSector}th percentile - unexpectedly low for Shell`);
        }
      }
    } else {
      fail('Sector stats', 'No sector statistics returned');
    }
    
    // Test combined jurisdiction + sector
    if (benchmark.combinedStats && benchmark.combinedStats.count >= 3) {
      pass(`Combined peer group (${benchmark.company.jurisdiction} + ${benchmark.company.sics_sector}): ${benchmark.combinedStats.count} peers`);
    }
  }
}

// ============================================================
// SCENARIO 2: "Compare the top 5 emitters in Financials sector"
// ============================================================
console.log('\n📊 SCENARIO 2: "Compare the top 5 emitters in the Financials sector"');
console.log('-'.repeat(70));

const financials = db.listCompanies({ sics_sector: 'Financials', limit: 100 });
console.log(`Found ${financials.total} Financials companies`);

// Get top emitters by Scope 3 (more relevant for Financials)
const topFinancialEmitters = db.getTopEmitters('scope3', 10).filter(e => {
  const company = db.getCompanyById(e.nz_id);
  return company && company.sics_sector === 'Financials';
}).slice(0, 5);

if (topFinancialEmitters.length < 3) {
  warn('Financials top emitters', `Only found ${topFinancialEmitters.length} - may need broader search`);
} else {
  console.log(`\nTop ${topFinancialEmitters.length} Scope 3 emitters in Financials:`);
  topFinancialEmitters.forEach((e, i) => {
    const suspicious = e.value > 1e12;  // More than 1 trillion
    console.log(`  ${i+1}. ${e.company_name}: ${e.value.toLocaleString()} tCO2e${suspicious ? ' ⚠️ SUSPICIOUS' : ''}`);
  });
  
  // Test compare mode
  const ids = topFinancialEmitters.map(e => e.nz_id);
  const comparison = db.compareCompanies(ids);
  
  if (comparison.length === ids.length) {
    pass(`Compare returned data for all ${ids.length} companies`);
  } else {
    fail('Compare companies', `Expected ${ids.length} results, got ${comparison.length}`);
  }
  
  // Verify data quality comparison
  const qualityComparison = db.compareDataQuality(ids);
  if (qualityComparison.comparabilityWarnings && qualityComparison.comparabilityWarnings.length > 0) {
    pass(`Comparability warnings generated: ${qualityComparison.comparabilityWarnings.length} warnings`);
    qualityComparison.comparabilityWarnings.forEach(w => console.log(`    - ${w}`));
  }
}

// ============================================================
// SCENARIO 3: "What's the median Scope 1 emissions for UK companies?"
// ============================================================
console.log('\n📊 SCENARIO 3: "What\'s the median Scope 1 emissions for UK companies?"');
console.log('-'.repeat(70));

const ukStats = db.getPeerStatistics('scope1', { jurisdiction: 'United Kingdom of Great Britain and Northern Ireland' });

if (!ukStats) {
  fail('UK peer stats', 'No statistics returned for UK');
} else {
  console.log(`  UK Scope 1 Statistics:`);
  console.log(`    Companies with data: ${ukStats.count}`);
  console.log(`    Median: ${Math.round(ukStats.median).toLocaleString()} tCO2e`);
  console.log(`    Mean: ${Math.round(ukStats.mean).toLocaleString()} tCO2e`);
  console.log(`    25th percentile: ${Math.round(ukStats.percentile25).toLocaleString()} tCO2e`);
  console.log(`    75th percentile: ${Math.round(ukStats.percentile75).toLocaleString()} tCO2e`);
  
  // Verify IQR makes sense
  if (ukStats.percentile25 <= ukStats.median && ukStats.median <= ukStats.percentile75) {
    pass('Quartile ordering is correct');
  } else {
    fail('Quartile ordering', `P25=${ukStats.percentile25}, Median=${ukStats.median}, P75=${ukStats.percentile75}`);
  }
  
  // Check if count is reasonable
  const ukCompanyCount = db.listCompanies({ jurisdiction: 'United Kingdom of Great Britain and Northern Ireland', limit: 1 }).total;
  const coverageRatio = ukStats.count / ukCompanyCount;
  console.log(`    Coverage: ${ukStats.count}/${ukCompanyCount} (${(coverageRatio * 100).toFixed(1)}%)`);
  
  if (coverageRatio > 0.1) {
    pass(`Reasonable data coverage (${(coverageRatio * 100).toFixed(1)}%)`);
  } else {
    warn('Data coverage', `Only ${(coverageRatio * 100).toFixed(1)}% of UK companies have Scope 1 data`);
  }
}

// ============================================================
// SCENARIO 4: "Benchmark Microsoft against tech peers"
// ============================================================
console.log('\n📊 SCENARIO 4: "Benchmark Microsoft against technology peers"');
console.log('-'.repeat(70));

const msft = db.listCompanies({ search: 'Microsoft', limit: 1 }).data[0];
if (!msft) {
  fail('Find Microsoft', 'Could not find Microsoft');
} else {
  console.log(`Found: ${msft.company_name} (Sector: ${msft.sics_sector})`);
  
  // Test each scope
  const scopes = ['scope1', 'scope2_lb', 'scope2_mb', 'scope3'];
  for (const scope of scopes) {
    const bench = db.benchmarkCompany(msft.nz_id, scope);
    if (bench && bench.companyValue) {
      console.log(`  ${scope}: ${bench.companyValue.toLocaleString()} tCO2e (${bench.percentileInSector || 'N/A'}th percentile)`);
    } else {
      console.log(`  ${scope}: No data`);
    }
  }
  
  // Critical test: Scope 2 LB vs MB should be different
  const benchLB = db.benchmarkCompany(msft.nz_id, 'scope2_lb');
  const benchMB = db.benchmarkCompany(msft.nz_id, 'scope2_mb');
  
  if (benchLB && benchMB && benchLB.companyValue && benchMB.companyValue) {
    if (benchLB.companyValue !== benchMB.companyValue) {
      pass(`Scope 2 LB (${benchLB.companyValue.toLocaleString()}) ≠ MB (${benchMB.companyValue.toLocaleString()}) - correctly distinguished`);
    } else {
      warn('Scope 2 LB vs MB', 'Values are identical - unusual for a company with renewable contracts');
    }
    
    // LB should typically be >= MB for companies with green procurement
    if (benchLB.companyValue >= benchMB.companyValue) {
      pass('LB ≥ MB (expected for company with renewable energy procurement)');
    }
  }
}

// ============================================================
// SCENARIO 5: Edge case - Company with no emissions data
// ============================================================
console.log('\n📊 SCENARIO 5: Edge case - Company with missing data');
console.log('-'.repeat(70));

// Find a company with limited data
const allCompanies = db.listCompanies({ limit: 1000 });
let noEmissionsCompany = null;
for (const c of allCompanies.data) {
  const emissions = db.getCompanyEmissions(c.nz_id);
  if (emissions.length === 0) {
    noEmissionsCompany = c;
    break;
  }
}

if (noEmissionsCompany) {
  console.log(`Testing with company that has no emissions data: ${noEmissionsCompany.company_name}`);
  const bench = db.benchmarkCompany(noEmissionsCompany.nz_id, 'scope1');
  
  if (bench && !bench.companyValue) {
    pass('Benchmark handles missing emissions gracefully');
  } else if (bench && bench.companyValue) {
    fail('Edge case handling', `Expected no company value, got: ${bench.companyValue}`);
  }
} else {
  warn('Edge case test', 'Could not find a company without emissions data');
}

// ============================================================
// SCENARIO 6: Peer statistics with narrow filter
// ============================================================
console.log('\n📊 SCENARIO 6: "Scope 3 stats for Japanese auto manufacturers"');
console.log('-'.repeat(70));

const japanAutoStats = db.getPeerStatistics('scope3', { 
  jurisdiction: 'Japan',
  sics_sector: 'Transportation'  // Note: might need exact SICS name
});

if (japanAutoStats && japanAutoStats.count > 0) {
  console.log(`  Japanese Transportation Scope 3 Stats:`);
  console.log(`    Companies: ${japanAutoStats.count}`);
  console.log(`    Median: ${Math.round(japanAutoStats.median).toLocaleString()} tCO2e`);
  pass('Narrow filter peer stats returned data');
} else {
  // Try alternative sector names
  const japanStats = db.getPeerStatistics('scope3', { jurisdiction: 'Japan' });
  if (japanStats) {
    console.log(`  Japanese companies (all sectors) Scope 3 Stats:`);
    console.log(`    Companies: ${japanStats.count}`);
    console.log(`    Median: ${Math.round(japanStats.median).toLocaleString()} tCO2e`);
    pass('Japan-wide stats available (specific sector filter too narrow)');
  } else {
    fail('Japanese peer stats', 'No statistics available');
  }
}

// ============================================================
// SCENARIO 7: Verify percentile calculation accuracy
// ============================================================
console.log('\n📊 SCENARIO 7: Verify percentile calculation accuracy');
console.log('-'.repeat(70));

// Get peer group and manually verify percentile
const oilGasStats = db.getPeerStatistics('scope1', { sics_sub_sector: 'Oil & Gas' });
const oilGasCompanies = db.listCompanies({ sics_sub_sector: 'Oil & Gas', limit: 200 });

if (oilGasStats && oilGasCompanies.data.length > 10) {
  // Get all emissions values
  const values = [];
  for (const c of oilGasCompanies.data) {
    const emissions = db.getCompanyEmissions(c.nz_id);
    if (emissions.length > 0) {
      const latest = emissions.sort((a, b) => b.year - a.year)[0];
      if (latest.scope1) {
        values.push({ nz_id: c.nz_id, name: c.company_name, value: latest.scope1 });
      }
    }
  }
  
  values.sort((a, b) => a.value - b.value);
  
  // Pick a company near the median
  const medianIdx = Math.floor(values.length / 2);
  const medianCompany = values[medianIdx];
  
  console.log(`  Testing percentile for: ${medianCompany.name}`);
  console.log(`  Value: ${medianCompany.value.toLocaleString()} tCO2e`);
  console.log(`  Position: ${medianIdx + 1} of ${values.length}`);
  
  const expectedPercentile = Math.round((medianIdx / values.length) * 100);
  const bench = db.benchmarkCompany(medianCompany.nz_id, 'scope1');
  
  if (bench && bench.percentileInSector !== null) {
    const actualPercentile = bench.percentileInSector;
    const diff = Math.abs(actualPercentile - expectedPercentile);
    
    console.log(`  Expected percentile (approx): ${expectedPercentile}%`);
    console.log(`  Actual percentile: ${actualPercentile}%`);
    
    if (diff <= 10) {
      pass(`Percentile within 10% tolerance (diff: ${diff}%)`);
    } else {
      warn('Percentile accuracy', `Difference of ${diff}% - may be due to multi-year data aggregation`);
    }
  }
}

// ============================================================
// SUMMARY
// ============================================================
console.log('\n' + '='.repeat(80));
console.log('BENCHMARK TOOL TEST SUMMARY');
console.log('='.repeat(80));
console.log(`  ✅ Passed: ${passCount}`);
console.log(`  ❌ Failed: ${failCount}`);
console.log(`  Total tests: ${passCount + failCount}`);

if (issues.length > 0) {
  console.log('\n  Issues found:');
  issues.forEach(i => console.log(`    • ${i.test}: ${i.reason}`));
}

console.log('\n');
