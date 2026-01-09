#!/usr/bin/env node
/**
 * Test harness for NZDPU MCP Server responses
 * Tests the 7 consolidated tools with various inputs
 */

import * as db from './dist/db/queries.js';

console.log('\n' + '='.repeat(70));
console.log('NZDPU MCP SERVER - RESPONSE CAPABILITY TESTS');
console.log('='.repeat(70) + '\n');

// Test 1: nzdpu_search - Find companies
console.log('📍 TEST 1: nzdpu_search - Find companies by name');
console.log('-'.repeat(50));
const shellSearch = db.listCompanies({ search: 'Shell', limit: 5 });
console.log(`Found ${shellSearch.total} companies matching "Shell" (showing first ${shellSearch.data.length}):`);
shellSearch.data.forEach(c => {
  console.log(`  • ${c.company_name} (nz_id: ${c.nz_id}) - ${c.jurisdiction || 'N/A'}`);
});
console.log();

// Test 2: nzdpu_list - List sectors
console.log('📍 TEST 2: nzdpu_list - List sectors');
console.log('-'.repeat(50));
const sectors = db.listSectors();
console.log(`Total sectors: ${sectors.length}`);
sectors.slice(0, 5).forEach(s => {
  console.log(`  • ${s.sector}: ${s.count} companies`);
});
console.log('  ...');
console.log();

// Test 3: nzdpu_list - List jurisdictions
console.log('📍 TEST 3: nzdpu_list - List jurisdictions (top 10)');
console.log('-'.repeat(50));
const jurisdictions = db.listJurisdictions();
console.log(`Total jurisdictions: ${jurisdictions.length}`);
jurisdictions.slice(0, 10).forEach(j => {
  console.log(`  • ${j.jurisdiction}: ${j.count} companies`);
});
console.log();

// Test 4: nzdpu_analyze - Dataset overview
console.log('📍 TEST 4: nzdpu_analyze - Dataset overview');
console.log('-'.repeat(50));
const stats = db.getDatasetStats();
console.log(`  • Total Unique Companies: ${stats.totalCompanies.toLocaleString()}`);
console.log(`  • Total Emissions Records: ${stats.totalEmissionsRecords.toLocaleString()}`);
console.log(`  • Companies by Disclosure Count:`);
Object.entries(stats.companiesByDisclosureCount)
  .sort(([a], [b]) => parseInt(b) - parseInt(a))
  .slice(0, 5)
  .forEach(([years, count]) => {
    console.log(`    - ${years} year(s): ${count} companies`);
  });
console.log();

// Test 5: nzdpu_emissions - Get company emissions
console.log('📍 TEST 5: nzdpu_emissions - Get emissions for a company');
console.log('-'.repeat(50));
// First find a company
const companies = db.listCompanies({ search: 'Microsoft', limit: 1 });
if (companies.data.length > 0) {
  const company = companies.data[0];
  console.log(`Company: ${company.company_name} (nz_id: ${company.nz_id})`);
  const emissions = db.getCompanyEmissions(company.nz_id);
  if (emissions.length > 0) {
    emissions.sort((a, b) => b.year - a.year);
    console.log(`  Emissions data available for ${emissions.length} year(s):`);
    emissions.slice(0, 3).forEach(e => {
      console.log(`    ${e.year}:`);
      console.log(`      Scope 1: ${e.scope1?.toLocaleString() || 'N/A'} tCO2e`);
      console.log(`      Scope 2 (LB): ${e.scope2_lb?.toLocaleString() || 'N/A'} tCO2e`);
      console.log(`      Scope 2 (MB): ${e.scope2_mb?.toLocaleString() || 'N/A'} tCO2e`);
      console.log(`      Scope 3 Total: ${e.scope3_total?.toLocaleString() || 'N/A'} tCO2e`);
    });
  }
} else {
  console.log('  No Microsoft found, trying BP...');
  const bpSearch = db.listCompanies({ search: 'BP', limit: 1 });
  if (bpSearch.data.length > 0) {
    const bp = bpSearch.data[0];
    console.log(`Company: ${bp.company_name} (nz_id: ${bp.nz_id})`);
    const emissions = db.getCompanyEmissions(bp.nz_id);
    if (emissions.length > 0) {
      console.log(`  Emissions data: ${emissions.length} year(s)`);
    }
  }
}
console.log();

// Test 6: nzdpu_analyze - Top emitters
console.log('📍 TEST 6: nzdpu_analyze - Top 5 Scope 1 emitters');
console.log('-'.repeat(50));
const topEmitters = db.getTopEmitters('scope1', 5);
topEmitters.forEach((e, i) => {
  const warning = e.value > 1000000000 ? ' ⚠️ (possible unit error)' : '';
  console.log(`  ${i + 1}. ${e.company_name}: ${e.value.toLocaleString()} tCO2e (${e.year})${warning}`);
});
console.log();

// Test 7: nzdpu_benchmark - Peer statistics
console.log('📍 TEST 7: nzdpu_benchmark - Peer statistics for Oil & Gas');
console.log('-'.repeat(50));
const peerStats = db.getPeerStatistics('scope1', { sics_sub_sector: 'Oil & Gas' });
if (peerStats) {
  console.log(`  Peer Group: Oil & Gas (Scope 1)`);
  console.log(`  • Companies with data: ${peerStats.count}`);
  console.log(`  • Mean: ${Math.round(peerStats.mean).toLocaleString()} tCO2e`);
  console.log(`  • Median: ${Math.round(peerStats.median).toLocaleString()} tCO2e`);
  console.log(`  • Min: ${Math.round(peerStats.min).toLocaleString()} tCO2e`);
  console.log(`  • Max: ${Math.round(peerStats.max).toLocaleString()} tCO2e`);
  console.log(`  • 25th Percentile: ${Math.round(peerStats.percentile25).toLocaleString()} tCO2e`);
  console.log(`  • 75th Percentile: ${Math.round(peerStats.percentile75).toLocaleString()} tCO2e`);
}
console.log();

// Test 8: nzdpu_quality - Data quality assessment
console.log('📍 TEST 8: nzdpu_quality - Data quality assessment');
console.log('-'.repeat(50));
// Find a company with good data
const qualityCompany = db.listCompanies({ sics_sub_sector: 'Oil & Gas', limit: 1 });
if (qualityCompany.data.length > 0) {
  const c = qualityCompany.data[0];
  console.log(`Company: ${c.company_name} (nz_id: ${c.nz_id})`);
  const quality = db.getCompanyQualityAssessment(c.nz_id);
  if (quality.assessment) {
    const a = quality.assessment;
    console.log(`  Year: ${a.year}`);
    console.log(`  Overall Score: ${a.overallScore}`);
    console.log(`  Boundary Score: ${a.boundaryScore} (${a.boundaryType || 'N/A'})`);
    console.log(`  Verification Score: ${a.verificationScore}`);
    if (a.warnings.length > 0) {
      console.log(`  Warnings:`);
      a.warnings.slice(0, 3).forEach(w => console.log(`    - ${w}`));
    }
  }
}
console.log();

// Test 9: nzdpu_analyze - Data quality issues
console.log('📍 TEST 9: nzdpu_analyze - Data quality issues');
console.log('-'.repeat(50));
const issues = db.findDataQualityIssues(10);
console.log(`Found ${issues.length} potential data issues:`);
issues.slice(0, 5).forEach(issue => {
  console.log(`  • ${issue.company_name}: ${issue.scope} = ${issue.value.toLocaleString()} (${issue.issue})`);
});
console.log();

// Test 10: Search by jurisdiction
console.log('📍 TEST 10: nzdpu_search - Filter by jurisdiction');
console.log('-'.repeat(50));
const ukFinancials = db.listCompanies({ 
  jurisdiction: 'United Kingdom of Great Britain and Northern Ireland',
  sics_sector: 'Financials',
  limit: 5 
});
console.log(`UK Financial companies: ${ukFinancials.total} total (showing first ${ukFinancials.data.length})`);
ukFinancials.data.forEach(c => {
  console.log(`  • ${c.company_name} (${c.sics_sub_sector || 'N/A'})`);
});
console.log();

// Test 11: Companies with long disclosure history
console.log('📍 TEST 11: Companies with 5+ years of disclosure');
console.log('-'.repeat(50));
const longHistory = db.getCompaniesWithMinDisclosures(5, 10);
console.log(`Found ${longHistory.length} companies with 5+ years of data:`);
longHistory.slice(0, 5).forEach(c => {
  console.log(`  • ${c.company_name}: ${c.disclosure_count} years (${c.years})`);
});
console.log();

// Test 12: Compare multiple companies
console.log('📍 TEST 12: nzdpu_benchmark - Compare companies');
console.log('-'.repeat(50));
const oilGasCompanies = db.listCompanies({ sics_sub_sector: 'Oil & Gas', limit: 3 });
if (oilGasCompanies.data.length >= 2) {
  const ids = oilGasCompanies.data.map(c => c.nz_id);
  const comparison = db.compareCompanies(ids);
  console.log('Comparing Oil & Gas companies:');
  comparison.forEach(({ company, emissions }) => {
    console.log(`  ${company.company_name}:`);
    if (emissions) {
      console.log(`    Scope 1: ${emissions.scope1?.toLocaleString() || 'N/A'} tCO2e`);
      console.log(`    Scope 3: ${emissions.scope3_total?.toLocaleString() || 'N/A'} tCO2e`);
    } else {
      console.log('    No emissions data');
    }
  });
}
console.log();

console.log('='.repeat(70));
console.log('ALL TESTS COMPLETED');
console.log('='.repeat(70) + '\n');
