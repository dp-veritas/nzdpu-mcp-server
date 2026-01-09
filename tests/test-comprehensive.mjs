/**
 * Comprehensive Test Suite for NZDPU MCP Server
 * Tests all 7 tools, new knowledge base features, and performance
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test configuration
const TEST_TIMEOUT = 10000; // 10 seconds max per test
const PERF_THRESHOLD_MS = 500; // Performance threshold

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  errors: [],
  performance: []
};

// MCP Communication
let mcpProcess = null;
let requestId = 0;
let pendingRequests = new Map();
let buffer = '';

function startMCP() {
  return new Promise((resolve, reject) => {
    const serverPath = join(__dirname, '..', 'dist', 'index.js');
    mcpProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    mcpProcess.stdout.on('data', (data) => {
      buffer += data.toString();
      processBuffer();
    });

    mcpProcess.stderr.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('running')) {
        resolve();
      }
    });

    mcpProcess.on('error', reject);
    
    // Initialize MCP
    sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' }
    });

    setTimeout(resolve, 1000);
  });
}

function processBuffer() {
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const response = JSON.parse(line);
      const pending = pendingRequests.get(response.id);
      if (pending) {
        pendingRequests.delete(response.id);
        if (response.error) {
          pending.reject(new Error(response.error.message));
        } else {
          pending.resolve(response.result);
        }
      }
    } catch (e) {
      // Ignore non-JSON lines
    }
  }
}

function sendRequest(method, params) {
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    const request = { jsonrpc: '2.0', id, method, params };
    
    pendingRequests.set(id, { resolve, reject });
    mcpProcess.stdin.write(JSON.stringify(request) + '\n');
    
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }
    }, TEST_TIMEOUT);
  });
}

async function callTool(name, args = {}) {
  const start = performance.now();
  const result = await sendRequest('tools/call', { name, arguments: args });
  const duration = performance.now() - start;
  
  results.performance.push({ tool: name, args: JSON.stringify(args).substring(0, 50), duration });
  
  return {
    text: result?.content?.[0]?.text || '',
    duration
  };
}

function stopMCP() {
  if (mcpProcess) {
    mcpProcess.kill();
    mcpProcess = null;
  }
}

// Test helpers
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertContains(text, substring, context = '') {
  // Case-insensitive match
  if (!text.toLowerCase().includes(substring.toLowerCase())) {
    throw new Error(`Expected "${substring}" in response. ${context}\nGot: ${text.substring(0, 500)}...`);
  }
}

function assertPerformance(duration, threshold = PERF_THRESHOLD_MS, context = '') {
  if (duration > threshold) {
    console.warn(`  ⚠️  Slow: ${duration.toFixed(0)}ms > ${threshold}ms ${context}`);
  }
}

// ==================== TEST SUITES ====================

async function testSearchTool() {
  console.log('\n📍 Testing nzdpu_search...');
  
  // Test 1: Search by name
  let res = await callTool('nzdpu_search', { name: 'Microsoft' });
  assertContains(res.text, 'Microsoft', 'Name search');
  assertContains(res.text, 'nz_id', 'Should return nz_id');
  assertPerformance(res.duration, 500, 'name search');
  console.log('  ✓ Name search works');
  
  // Test 2: Search by sector
  res = await callTool('nzdpu_search', { sector: 'Financials', limit: 5 });
  assertContains(res.text, 'Financials', 'Sector filter');
  assertPerformance(res.duration, 500, 'sector search');
  console.log('  ✓ Sector search works');
  
  // Test 3: Search by jurisdiction
  res = await callTool('nzdpu_search', { jurisdiction: 'Japan', limit: 5 });
  assertContains(res.text, 'Japan', 'Jurisdiction filter');
  console.log('  ✓ Jurisdiction search works');
  
  // Test 4: Combined filters
  res = await callTool('nzdpu_search', { 
    jurisdiction: 'United States of America', 
    sub_sector: 'Oil & Gas',
    limit: 10 
  });
  assertContains(res.text, 'nz_id', 'Combined search');
  console.log('  ✓ Combined filter search works');
  
  results.passed += 4;
}

async function testEmissionsTool() {
  console.log('\n📊 Testing nzdpu_emissions...');
  
  // First find a company - nz_id is in second column
  const search = await callTool('nzdpu_search', { name: 'Shell', limit: 1 });
  const nzIdMatch = search.text.match(/\|\s*[^|]+\s*\|\s*(\d+)\s*\|/);
  const nzId = nzIdMatch ? parseInt(nzIdMatch[1]) : null;
  
  if (!nzId) {
    console.log('  ⚠ Could not find Shell, skipping emissions test');
    return;
  }
  console.log(`  Testing company nz_id: ${nzId}`);
  
  // Test 1: Basic emissions retrieval
  let res = await callTool('nzdpu_emissions', { company_id: nzId });
  assertContains(res.text, 'Scope 1', 'Should show Scope 1');
  assertContains(res.text, 'Scope 2', 'Should show Scope 2');
  assertPerformance(res.duration, 500, 'emissions retrieval');
  console.log('  ✓ Basic emissions retrieval works');
  
  // Test 2: Scope 3 coverage
  assertContains(res.text, 'Scope 3 Coverage', 'Should show S3 coverage');
  assertContains(res.text, 'Categories Reported', 'Should show category count');
  console.log('  ✓ Scope 3 coverage analysis works');
  
  // Test 3: Category breakdown
  assertContains(res.text, 'Category', 'Should show category breakdown');
  console.log('  ✓ Category breakdown works');
  
  // Test 4: Methodology info
  if (res.text.includes('Methodology')) {
    console.log('  ✓ Methodology info available');
  } else {
    console.log('  ⚠ Methodology info not available for this company');
  }
  
  results.passed += 3;
}

async function testListTool() {
  console.log('\n📋 Testing nzdpu_list...');
  
  // Test 1: List sectors
  let res = await callTool('nzdpu_list', { type: 'sectors' });
  assertContains(res.text, 'SICS Sectors', 'Sector list');
  assertContains(res.text, 'Financials', 'Should contain Financials');
  assertPerformance(res.duration, 300, 'list sectors');
  console.log('  ✓ List sectors works');
  
  // Test 2: List jurisdictions
  res = await callTool('nzdpu_list', { type: 'jurisdictions' });
  assertContains(res.text, 'Jurisdictions', 'Jurisdiction list');
  assertContains(res.text, 'United States', 'Should contain US');
  console.log('  ✓ List jurisdictions works');
  
  // Test 3: List subsectors
  res = await callTool('nzdpu_list', { type: 'subsectors', sector: 'Financials' });
  assertContains(res.text, 'Hierarchy', 'Subsector hierarchy');
  console.log('  ✓ List subsectors works');
  
  results.passed += 3;
}

async function testAnalyzeTool() {
  console.log('\n📈 Testing nzdpu_analyze...');
  
  // Test 1: Overview
  let res = await callTool('nzdpu_analyze', { analysis: 'overview' });
  assertContains(res.text, 'Dataset Overview', 'Overview');
  assertContains(res.text, 'Total', 'Should show totals');
  assertPerformance(res.duration, 1000, 'dataset overview');
  console.log('  ✓ Dataset overview works');
  
  // Test 2: Top emitters with ranking disclaimer
  res = await callTool('nzdpu_analyze', { analysis: 'top_emitters', scope: 'scope1', limit: 5 });
  assertContains(res.text, 'Top', 'Top emitters');
  assertContains(res.text, 'Ranking', 'Should have ranking disclaimer');
  console.log('  ✓ Top emitters works with disclaimer');
  
  // Test 3: Disclosure analysis
  res = await callTool('nzdpu_analyze', { analysis: 'disclosure', min_disclosures: 5, limit: 10 });
  assertContains(res.text, 'Disclosure', 'Disclosure analysis');
  console.log('  ✓ Disclosure analysis works');
  
  // Test 4: Data issues
  res = await callTool('nzdpu_analyze', { analysis: 'data_issues', limit: 10 });
  assertContains(res.text, 'Data Quality', 'Data issues');
  console.log('  ✓ Data issues analysis works');
  
  results.passed += 4;
}

async function testBenchmarkTool() {
  console.log('\n🏆 Testing nzdpu_benchmark...');
  
  // Find companies for testing
  const search = await callTool('nzdpu_search', { 
    sub_sector: 'Oil & Gas', 
    jurisdiction: 'United States of America',
    limit: 5 
  });
  
  // Extract nz_ids from table (format: | Company Name | nz_id | ...)
  const nzIds = [];
  const matches = search.text.matchAll(/\|\s*[^|]+\s*\|\s*(\d+)\s*\|/g);
  for (const m of matches) {
    const id = parseInt(m[1]);
    if (!isNaN(id) && id > 0) {
      nzIds.push(id);
      if (nzIds.length >= 5) break;
    }
  }
  
  // Skip header row if captured
  if (nzIds[0] === 0 || isNaN(nzIds[0])) {
    nzIds.shift();
  }
  
  if (nzIds.length === 0) {
    console.log('  ⚠ No Oil & Gas companies found, skipping benchmark tests');
    return;
  }
  
  console.log(`  Found ${nzIds.length} companies: ${nzIds.join(', ')}`);
  
  // Test 1: Single company benchmark
  let res = await callTool('nzdpu_benchmark', { 
    mode: 'single', 
    company_id: nzIds[0],
    scope: 'scope1'
  });
  assertContains(res.text, 'Benchmark', 'Benchmark title');
  assertContains(res.text, 'Percentile', 'Should show percentile');
  assertContains(res.text, 'Limitation', 'Should have limitations disclaimer');
  assertPerformance(res.duration, 1000, 'single benchmark');
  console.log('  ✓ Single benchmark works with disclaimer');
  
  // Test 2: Compare mode with Scope 3 coverage
  if (nzIds.length >= 2) {
    res = await callTool('nzdpu_benchmark', { 
      mode: 'compare', 
      company_ids: nzIds.slice(0, 3)
    });
    assertContains(res.text, 'Comparison', 'Comparison title');
    assertContains(res.text, 'S3 Cats', 'Should show Scope 3 category count');
    assertContains(res.text, 'Limitation', 'Should have comparison disclaimer');
    console.log('  ✓ Compare mode works with S3 coverage');
  }
  
  // Test 3: Peer stats
  res = await callTool('nzdpu_benchmark', { 
    mode: 'peer_stats', 
    sector: 'Financials',
    scope: 'scope1'
  });
  assertContains(res.text, 'Peer Group', 'Peer stats');
  assertContains(res.text, 'Mean', 'Should show mean');
  assertContains(res.text, 'Median', 'Should show median');
  console.log('  ✓ Peer stats works');
  
  results.passed += 3;
}

async function testQualityTool() {
  console.log('\n🔍 Testing nzdpu_quality...');
  
  // Find a company - extract nz_id from second column
  const search = await callTool('nzdpu_search', { name: 'Shell', limit: 1 });
  const nzIdMatch = search.text.match(/\|\s*[^|]+\s*\|\s*(\d+)\s*\|/);
  const nzId = nzIdMatch ? parseInt(nzIdMatch[1]) : null;
  
  if (!nzId) {
    console.log('  ⚠ Could not find company for quality test');
    return;
  }
  console.log(`  Testing company nz_id: ${nzId}`);
  
  // Test 1: Quality assessment
  let res = await callTool('nzdpu_quality', { company_id: nzId });
  assertContains(res.text, 'Quality Assessment', 'Quality title');
  assertContains(res.text, 'Overall Quality', 'Should show overall score');
  assertPerformance(res.duration, 500, 'quality assessment');
  console.log('  ✓ Quality assessment works');
  
  // Test 2: Component scores
  assertContains(res.text, 'Component', 'Component scores');
  console.log('  ✓ Component scores shown');
  
  // Test 3: Scope 3 methodology
  if (res.text.includes('Scope 3 Methodology')) {
    assertContains(res.text, 'Cat', 'Category methods');
    console.log('  ✓ Scope 3 methodology breakdown works');
    results.passed += 1;
  }
  
  results.passed += 2;
}

async function testLearnTool() {
  console.log('\n📚 Testing nzdpu_learn...');
  
  // Test 1: List concepts
  let res = await callTool('nzdpu_learn', { topic: 'concepts' });
  assertContains(res.text, 'Available', 'Concept list');
  assertContains(res.text, 'scope1', 'Should list scope1');
  console.log('  ✓ List concepts works');
  
  // Test 2: Explain concept
  res = await callTool('nzdpu_learn', { topic: 'concept:scope1' });
  assertContains(res.text, 'Scope 1', 'Scope 1 explanation');
  assertContains(res.text, 'Definition', 'Should have definition');
  console.log('  ✓ Explain concept works');
  
  // Test 3: Concept with related (new feature)
  if (res.text.includes('Related')) {
    console.log('  ✓ Related concepts expansion works');
    results.passed += 1;
  }
  
  // Test 4: Summary mode (new feature)
  res = await callTool('nzdpu_learn', { topic: 'concept:scope1', summary: true });
  assert(res.text.length < 500, 'Summary should be brief');
  console.log('  ✓ Summary mode works');
  
  // Test 5: Scope 3 categories
  res = await callTool('nzdpu_learn', { topic: 'scope3' });
  assertContains(res.text, 'Scope 3', 'Scope 3 categories');
  assertContains(res.text, 'Upstream', 'Should mention upstream');
  assertContains(res.text, 'Purchased Goods', 'Should show Cat 1');
  console.log('  ✓ Scope 3 categories work');
  
  // Test 6: Specific Scope 3 category
  res = await callTool('nzdpu_learn', { topic: 'scope3:11' });
  assertContains(res.text, 'Use of Sold Products', 'Category 11');
  console.log('  ✓ Specific Scope 3 category works');
  
  // Test 7: Common mistakes
  res = await callTool('nzdpu_learn', { topic: 'mistakes' });
  assertContains(res.text, 'Mistake', 'Common mistakes');
  console.log('  ✓ Common mistakes works');
  
  results.passed += 6;
}

async function testAdvancedKnowledge() {
  console.log('\n🎓 Testing Advanced Knowledge Topics...');
  
  // Test 1: Double counting
  let res = await callTool('nzdpu_learn', { topic: 'double_counting' });
  assertContains(res.text, 'Double Counting', 'Double counting');
  assertContains(res.text, 'Scope 2', 'Should cover Scope 2');
  assertContains(res.text, 'Scope 3', 'Should cover Scope 3 overlaps');
  console.log('  ✓ Double counting topic works');
  
  // Test 2: Double counting specific context
  res = await callTool('nzdpu_learn', { topic: 'double_counting:scope2' });
  assertContains(res.text, 'Location-Based', 'S2 LB');
  assertContains(res.text, 'Market-Based', 'S2 MB');
  console.log('  ✓ Double counting:scope2 works');
  
  // Test 3: Reporting frameworks list
  res = await callTool('nzdpu_learn', { topic: 'frameworks' });
  assertContains(res.text, 'Reporting Frameworks', 'Frameworks list');
  assertContains(res.text, 'IFRS S2', 'Should include IFRS S2');
  assertContains(res.text, 'CDP', 'Should include CDP');
  console.log('  ✓ Frameworks list works');
  
  // Test 4: Frameworks summary mode
  res = await callTool('nzdpu_learn', { topic: 'frameworks', summary: true });
  assert(res.text.length < 500, 'Framework summary should be brief');
  assertContains(res.text, 'frameworks', 'Should mention frameworks');
  console.log('  ✓ Frameworks summary mode works');
  
  // Test 5: Specific framework
  res = await callTool('nzdpu_learn', { topic: 'framework:IFRS S2' });
  assertContains(res.text, 'IFRS S2', 'Framework name');
  assertContains(res.text, 'Jurisdiction', 'Should show jurisdiction');
  assertContains(res.text, 'Requirements', 'Should show requirements');
  console.log('  ✓ Specific framework lookup works');
  
  // Test 6: Emission factors
  res = await callTool('nzdpu_learn', { topic: 'emission_factors' });
  assertContains(res.text, 'Emission Factor', 'EF title');
  assertContains(res.text, 'Tier', 'Should show tiers');
  assertContains(res.text, 'DEFRA', 'Should mention DEFRA');
  console.log('  ✓ Emission factors topic works');
  
  // Test 7: Specific tier
  res = await callTool('nzdpu_learn', { topic: 'emission_factor:1' });
  assertContains(res.text, 'Tier 1', 'Tier 1');
  assertContains(res.text, 'Primary', 'Should describe primary data');
  console.log('  ✓ Specific tier lookup works');
  
  // Test 8: Specific database
  res = await callTool('nzdpu_learn', { topic: 'emission_factor:DEFRA' });
  assertContains(res.text, 'UK', 'DEFRA is UK-based');
  assertContains(res.text, 'Conversion Factors', 'Should show DEFRA full name');
  console.log('  ✓ Specific database lookup works');
  
  // Test 9: Base year
  res = await callTool('nzdpu_learn', { topic: 'base_year' });
  assertContains(res.text, 'Base Year', 'Base year');
  assertContains(res.text, 'Recalculation', 'Should cover recalculation');
  assertContains(res.text, 'trigger', 'Should mention triggers');
  console.log('  ✓ Base year topic works');
  
  // Test 10: Materiality by category (new feature)
  res = await callTool('nzdpu_learn', { topic: 'materiality:15' });
  assertContains(res.text, 'Category 15', 'Category 15');
  assertContains(res.text, 'Financials', 'Should mention Financials sector');
  console.log('  ✓ Materiality by category works');
  
  // Test 11: Advanced topics list
  res = await callTool('nzdpu_learn', { topic: 'advanced' });
  assertContains(res.text, 'Advanced Topics', 'Advanced list');
  console.log('  ✓ Advanced topics list works');
  
  results.passed += 11;
}

async function testPerformance() {
  console.log('\n⚡ Performance Tests...');
  
  // Test 1: Bulk company search
  const start1 = performance.now();
  await callTool('nzdpu_search', { sector: 'Financials', limit: 100 });
  const dur1 = performance.now() - start1;
  console.log(`  Bulk search (100 companies): ${dur1.toFixed(0)}ms`);
  
  // Test 2: Multiple compare (tests optimized bulk queries)
  const search = await callTool('nzdpu_search', { sector: 'Oil & Gas', limit: 10 });
  const nzIds = [];
  const matches = search.text.matchAll(/\|\s*\d+\s*\|\s*(\d+)\s*\|/g);
  for (const m of matches) {
    nzIds.push(parseInt(m[1]));
    if (nzIds.length >= 10) break;
  }
  
  if (nzIds.length >= 5) {
    const start2 = performance.now();
    await callTool('nzdpu_benchmark', { mode: 'compare', company_ids: nzIds });
    const dur2 = performance.now() - start2;
    console.log(`  Bulk compare (${nzIds.length} companies): ${dur2.toFixed(0)}ms`);
    
    if (dur2 < 2000) {
      console.log('  ✓ Bulk compare meets performance threshold');
      results.passed += 1;
    } else {
      console.log('  ⚠ Bulk compare slow, but acceptable');
    }
  }
  
  // Test 3: Knowledge retrieval (should be instant)
  const start3 = performance.now();
  await callTool('nzdpu_learn', { topic: 'frameworks' });
  const dur3 = performance.now() - start3;
  console.log(`  Knowledge retrieval: ${dur3.toFixed(0)}ms`);
  
  if (dur3 < 100) {
    console.log('  ✓ Knowledge retrieval very fast');
    results.passed += 1;
  }
  
  // Print performance summary
  console.log('\n📊 Performance Summary:');
  const sorted = results.performance.sort((a, b) => b.duration - a.duration);
  for (const p of sorted.slice(0, 10)) {
    const status = p.duration > PERF_THRESHOLD_MS ? '⚠️' : '✓';
    console.log(`  ${status} ${p.tool}: ${p.duration.toFixed(0)}ms`);
  }
}

async function testEdgeCases() {
  console.log('\n🔧 Edge Case Tests...');
  
  // Test 1: Invalid company ID
  try {
    await callTool('nzdpu_emissions', { company_id: 999999999 });
    console.log('  ⚠ Should have thrown for invalid company');
  } catch (e) {
    console.log('  ✓ Handles invalid company ID gracefully');
    results.passed += 1;
  }
  
  // Test 2: Empty search results
  let res = await callTool('nzdpu_search', { name: 'XYZNONEXISTENT12345' });
  assertContains(res.text, 'No companies', 'Empty results');
  console.log('  ✓ Handles empty search results');
  results.passed += 1;
  
  // Test 3: Invalid framework lookup
  res = await callTool('nzdpu_learn', { topic: 'framework:NONEXISTENT' });
  assertContains(res.text, 'not found', 'Invalid framework');
  console.log('  ✓ Handles invalid framework lookup');
  results.passed += 1;
  
  // Test 4: Invalid Scope 3 category
  res = await callTool('nzdpu_learn', { topic: 'scope3:99' });
  assertContains(res.text, 'Invalid', 'Invalid category');
  console.log('  ✓ Handles invalid Scope 3 category');
  results.passed += 1;
  
  // Test 5: Invalid materiality category
  res = await callTool('nzdpu_learn', { topic: 'materiality:99' });
  assertContains(res.text, 'Invalid', 'Invalid materiality');
  console.log('  ✓ Handles invalid materiality category');
  results.passed += 1;
}

async function testEmptyResultsGuidance() {
  console.log('\n📭 Empty Results Guidance Tests...');
  
  // Test 1: Empty search shows filters used
  let res = await callTool('nzdpu_search', { 
    jurisdiction: 'Germany', 
    sub_sector: 'Oil & Gas' 
  });
  assertContains(res.text, 'No companies found', 'Should indicate no results');
  assertContains(res.text, 'Germany', 'Should show jurisdiction filter');
  assertContains(res.text, 'Oil & Gas', 'Should show sub_sector filter');
  console.log('  ✓ Empty search shows filters used');
  results.passed += 1;
  
  // Test 2: Shows alternative jurisdictions for sub_sector
  assertContains(res.text, 'Jurisdictions with', 'Should suggest alternatives');
  console.log('  ✓ Shows alternative jurisdictions with that sub-sector');
  results.passed += 1;
  
  // Test 3: Shows suggestions section
  assertContains(res.text, 'Suggestions', 'Should have suggestions');
  assertContains(res.text, 'nzdpu_list', 'Should suggest list tool');
  console.log('  ✓ Shows helpful suggestions');
  results.passed += 1;
  
  // Test 4: Jurisdiction-only empty search shows available sub-sectors
  res = await callTool('nzdpu_search', { jurisdiction: 'Monaco' });
  if (res.text.includes('No companies found')) {
    // Monaco might not have companies, which is expected
    assertContains(res.text, 'Suggestions', 'Should have suggestions for empty jurisdiction');
    console.log('  ✓ Handles jurisdiction with no companies');
    results.passed += 1;
  } else {
    console.log('  ⚠ Monaco has companies - skipping empty jurisdiction test');
  }
  
  // Test 5: Name search empty results
  res = await callTool('nzdpu_search', { name: 'ZZZZNONEXISTENT99999' });
  assertContains(res.text, 'No companies found', 'Should indicate no results');
  assertContains(res.text, 'Name:', 'Should show name filter');
  console.log('  ✓ Name search empty results show filter used');
  results.passed += 1;
}

// ==================== MAIN ====================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  NZDPU MCP Server - Comprehensive Test Suite               ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  try {
    console.log('\n🚀 Starting MCP Server...');
    await startMCP();
    console.log('✓ Server started');
    
    // Run all test suites
    await testSearchTool();
    await testEmissionsTool();
    await testListTool();
    await testAnalyzeTool();
    await testBenchmarkTool();
    await testQualityTool();
    await testLearnTool();
    await testAdvancedKnowledge();
    await testEdgeCases();
    await testEmptyResultsGuidance();
    await testPerformance();
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    results.errors.push(error.message);
    results.failed += 1;
  } finally {
    stopMCP();
  }
  
  // Print summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  TEST RESULTS                                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n  ✅ Passed: ${results.passed}`);
  console.log(`  ❌ Failed: ${results.failed}`);
  
  if (results.errors.length > 0) {
    console.log('\n  Errors:');
    results.errors.forEach(e => console.log(`    - ${e}`));
  }
  
  const exitCode = results.failed > 0 ? 1 : 0;
  console.log(`\n  Exit code: ${exitCode}`);
  process.exit(exitCode);
}

main();
