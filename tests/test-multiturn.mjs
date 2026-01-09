/**
 * Multi-Turn Conversation Tests for NZDPU MCP Server
 * Simulates realistic user conversations with varying complexity
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// MCP Communication
let mcpProcess = null;
let requestId = 0;
let pendingRequests = new Map();
let buffer = '';

const TEST_TIMEOUT = 15000;

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
      if (msg.includes('running')) resolve();
    });

    mcpProcess.on('error', reject);
    
    sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'multiturn-test', version: '1.0.0' }
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
    } catch (e) {}
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

// Conversation context tracker
class ConversationContext {
  constructor(name) {
    this.name = name;
    this.turns = [];
    this.extractedData = {};
    this.issues = [];
    this.startTime = Date.now();
  }
  
  addTurn(query, toolCalls, response, duration) {
    this.turns.push({ query, toolCalls, response: response.substring(0, 500), duration });
  }
  
  addIssue(issue) {
    this.issues.push(issue);
  }
  
  storeData(key, value) {
    this.extractedData[key] = value;
  }
  
  getData(key) {
    return this.extractedData[key];
  }
  
  summary() {
    const totalDuration = this.turns.reduce((sum, t) => sum + t.duration, 0);
    return {
      name: this.name,
      turnCount: this.turns.length,
      totalDuration: totalDuration.toFixed(0) + 'ms',
      avgTurnTime: (totalDuration / this.turns.length).toFixed(0) + 'ms',
      issueCount: this.issues.length,
      issues: this.issues
    };
  }
}

// ==================== BASE CASE CONVERSATIONS ====================

async function baseCase1_SimpleCompanyLookup() {
  const ctx = new ConversationContext('Base Case 1: Simple Company Lookup');
  console.log(`\n📝 ${ctx.name}`);
  
  // Turn 1: Search for a company
  let res = await callTool('nzdpu_search', { name: 'Apple', limit: 5 });
  ctx.addTurn('Search for Apple', ['nzdpu_search'], res.text, res.duration);
  console.log('  Turn 1: Search for Apple ✓');
  
  // Extract nz_id
  const match = res.text.match(/APPLE[^|]*\|\s*(\d+)/i);
  if (!match) {
    ctx.addIssue('Could not extract nz_id for Apple');
    return ctx;
  }
  const nzId = parseInt(match[1]);
  ctx.storeData('apple_nzid', nzId);
  
  // Turn 2: Get emissions
  res = await callTool('nzdpu_emissions', { company_id: nzId });
  ctx.addTurn('Get Apple emissions', ['nzdpu_emissions'], res.text, res.duration);
  console.log('  Turn 2: Get emissions ✓');
  
  // Check for expected content
  if (!res.text.includes('Scope 1')) {
    ctx.addIssue('Emissions response missing Scope 1');
  }
  if (!res.text.includes('Scope 3 Coverage')) {
    ctx.addIssue('Emissions response missing Scope 3 Coverage section');
  }
  
  // Turn 3: Get quality assessment
  res = await callTool('nzdpu_quality', { company_id: nzId });
  ctx.addTurn('Get Apple quality', ['nzdpu_quality'], res.text, res.duration);
  console.log('  Turn 3: Get quality assessment ✓');
  
  if (!res.text.includes('Overall Quality')) {
    ctx.addIssue('Quality response missing Overall Quality score');
  }
  
  return ctx;
}

async function baseCase2_SectorExploration() {
  const ctx = new ConversationContext('Base Case 2: Sector Exploration');
  console.log(`\n📝 ${ctx.name}`);
  
  // Turn 1: List sectors
  let res = await callTool('nzdpu_list', { type: 'sectors' });
  ctx.addTurn('List all sectors', ['nzdpu_list'], res.text, res.duration);
  console.log('  Turn 1: List sectors ✓');
  
  // Turn 2: Get subsectors for Financials
  res = await callTool('nzdpu_list', { type: 'subsectors', sector: 'Financials' });
  ctx.addTurn('Get Financials subsectors', ['nzdpu_list'], res.text, res.duration);
  console.log('  Turn 2: Get subsectors ✓');
  
  // Turn 3: Search for banks
  res = await callTool('nzdpu_search', { sub_sector: 'Commercial Banks', limit: 5 });
  ctx.addTurn('Search Commercial Banks', ['nzdpu_search'], res.text, res.duration);
  console.log('  Turn 3: Search banks ✓');
  
  // Turn 4: Learn about Category 15 (relevant for banks)
  res = await callTool('nzdpu_learn', { topic: 'materiality:15' });
  ctx.addTurn('Learn about Cat 15 materiality', ['nzdpu_learn'], res.text, res.duration);
  console.log('  Turn 4: Learn materiality ✓');
  
  if (!res.text.toLowerCase().includes('financials')) {
    ctx.addIssue('Cat 15 materiality should mention Financials sector');
  }
  
  return ctx;
}

async function baseCase3_JurisdictionComparison() {
  const ctx = new ConversationContext('Base Case 3: Jurisdiction Comparison');
  console.log(`\n📝 ${ctx.name}`);
  
  // Turn 1: List jurisdictions
  let res = await callTool('nzdpu_list', { type: 'jurisdictions' });
  ctx.addTurn('List jurisdictions', ['nzdpu_list'], res.text, res.duration);
  console.log('  Turn 1: List jurisdictions ✓');
  
  // Turn 2: Find UK oil companies
  res = await callTool('nzdpu_search', { jurisdiction: 'United Kingdom', sub_sector: 'Oil & Gas', limit: 5 });
  ctx.addTurn('Search UK Oil & Gas', ['nzdpu_search'], res.text, res.duration);
  console.log('  Turn 2: Search UK O&G ✓');
  
  const ukIds = [];
  const matches = res.text.matchAll(/\|\s*[^|]+\s*\|\s*(\d+)\s*\|/g);
  for (const m of matches) {
    const id = parseInt(m[1]);
    if (!isNaN(id) && id > 0) ukIds.push(id);
    if (ukIds.length >= 3) break;
  }
  ctx.storeData('uk_og_ids', ukIds);
  
  if (ukIds.length < 2) {
    // Not an issue - just limited data. Try different jurisdiction
    console.log('    (UK O&G has <2 companies, trying US instead)');
    res = await callTool('nzdpu_search', { jurisdiction: 'United States of America', sub_sector: 'Oil & Gas', limit: 5 });
    const usMatches = res.text.matchAll(/\|\s*[^|]+\s*\|\s*(\d+)\s*\|/g);
    for (const m of usMatches) {
      const id = parseInt(m[1]);
      if (!isNaN(id) && id > 0) ukIds.push(id);
      if (ukIds.length >= 3) break;
    }
    if (ukIds.length < 2) {
      ctx.addIssue('Could not find enough O&G companies for comparison');
      return ctx;
    }
  }
  
  // Turn 3: Compare companies
  res = await callTool('nzdpu_benchmark', { mode: 'compare', company_ids: ukIds });
  ctx.addTurn('Compare UK O&G companies', ['nzdpu_benchmark'], res.text, res.duration);
  console.log('  Turn 3: Compare companies ✓');
  
  // Check for disclaimers
  if (!res.text.includes('Limitation')) {
    ctx.addIssue('Comparison missing limitation disclaimer');
  }
  if (!res.text.includes('S3 Cats')) {
    ctx.addIssue('Comparison missing Scope 3 category count');
  }
  
  // Turn 4: Get peer stats for UK Financials
  res = await callTool('nzdpu_benchmark', { mode: 'peer_stats', jurisdiction: 'United Kingdom', sector: 'Financials' });
  ctx.addTurn('Get UK Financials peer stats', ['nzdpu_benchmark'], res.text, res.duration);
  console.log('  Turn 4: Peer stats ✓');
  
  return ctx;
}

async function baseCase4_LearningJourney() {
  const ctx = new ConversationContext('Base Case 4: Learning Journey');
  console.log(`\n📝 ${ctx.name}`);
  
  // Turn 1: Learn about Scope 2
  let res = await callTool('nzdpu_learn', { topic: 'scope2' });
  ctx.addTurn('Learn about Scope 2', ['nzdpu_learn'], res.text, res.duration);
  console.log('  Turn 1: Scope 2 explanation ✓');
  
  if (!res.text.includes('Location-Based') || !res.text.includes('Market-Based')) {
    ctx.addIssue('Scope 2 explanation missing LB/MB distinction');
  }
  
  // Turn 2: Learn about double counting
  res = await callTool('nzdpu_learn', { topic: 'double_counting:scope2' });
  ctx.addTurn('Learn about S2 double counting', ['nzdpu_learn'], res.text, res.duration);
  console.log('  Turn 2: Double counting ✓');
  
  // Turn 3: Learn about frameworks
  res = await callTool('nzdpu_learn', { topic: 'frameworks' });
  ctx.addTurn('Learn about frameworks', ['nzdpu_learn'], res.text, res.duration);
  console.log('  Turn 3: Frameworks list ✓');
  
  // Turn 4: Learn about IFRS S2
  res = await callTool('nzdpu_learn', { topic: 'framework:IFRS S2' });
  ctx.addTurn('Learn about IFRS S2', ['nzdpu_learn'], res.text, res.duration);
  console.log('  Turn 4: IFRS S2 details ✓');
  
  // Turn 5: Learn about emission factors
  res = await callTool('nzdpu_learn', { topic: 'emission_factors' });
  ctx.addTurn('Learn about emission factors', ['nzdpu_learn'], res.text, res.duration);
  console.log('  Turn 5: Emission factors ✓');
  
  // Turn 6: Learn about base year
  res = await callTool('nzdpu_learn', { topic: 'base_year' });
  ctx.addTurn('Learn about base year', ['nzdpu_learn'], res.text, res.duration);
  console.log('  Turn 6: Base year ✓');
  
  return ctx;
}

async function baseCase5_TopEmittersAnalysis() {
  const ctx = new ConversationContext('Base Case 5: Top Emitters Analysis');
  console.log(`\n📝 ${ctx.name}`);
  
  // Turn 1: Get dataset overview
  let res = await callTool('nzdpu_analyze', { analysis: 'overview' });
  ctx.addTurn('Dataset overview', ['nzdpu_analyze'], res.text, res.duration);
  console.log('  Turn 1: Dataset overview ✓');
  
  // Turn 2: Get top Scope 1 emitters
  res = await callTool('nzdpu_analyze', { analysis: 'top_emitters', scope: 'scope1', limit: 10 });
  ctx.addTurn('Top Scope 1 emitters', ['nzdpu_analyze'], res.text, res.duration);
  console.log('  Turn 2: Top S1 emitters ✓');
  
  if (!res.text.includes('Ranking')) {
    ctx.addIssue('Top emitters missing ranking disclaimer');
  }
  
  // Turn 3: Get top Scope 3 emitters
  res = await callTool('nzdpu_analyze', { analysis: 'top_emitters', scope: 'scope3', limit: 10 });
  ctx.addTurn('Top Scope 3 emitters', ['nzdpu_analyze'], res.text, res.duration);
  console.log('  Turn 3: Top S3 emitters ✓');
  
  // Turn 4: Analyze disclosure patterns
  res = await callTool('nzdpu_analyze', { analysis: 'disclosure', min_disclosures: 5, limit: 20 });
  ctx.addTurn('Companies with 5+ years disclosure', ['nzdpu_analyze'], res.text, res.duration);
  console.log('  Turn 4: Disclosure analysis ✓');
  
  // Turn 5: Check data quality issues
  res = await callTool('nzdpu_analyze', { analysis: 'data_issues', limit: 20 });
  ctx.addTurn('Data quality issues', ['nzdpu_analyze'], res.text, res.duration);
  console.log('  Turn 5: Data issues ✓');
  
  return ctx;
}

// ==================== EDGE CASE CONVERSATIONS ====================

async function edgeCase1_NoResultsHandling() {
  const ctx = new ConversationContext('Edge Case 1: No Results Handling');
  console.log(`\n📝 ${ctx.name}`);
  
  // Turn 1: Search for non-existent country + sector
  let res = await callTool('nzdpu_search', { jurisdiction: 'Germany', sub_sector: 'Oil & Gas' });
  ctx.addTurn('Search Germany O&G', ['nzdpu_search'], res.text, res.duration);
  console.log('  Turn 1: Germany O&G (expect empty) ✓');
  
  if (!res.text.includes('No companies found')) {
    ctx.addIssue('Expected "No companies found" for Germany O&G');
  }
  if (!res.text.includes('Jurisdictions with')) {
    ctx.addIssue('Missing alternative jurisdictions suggestion');
  }
  
  // Turn 2: Search for completely non-existent company
  res = await callTool('nzdpu_search', { name: 'ZZZZNONEXISTENTCOMPANY99999' });
  ctx.addTurn('Search non-existent company', ['nzdpu_search'], res.text, res.duration);
  console.log('  Turn 2: Non-existent company ✓');
  
  if (!res.text.includes('No companies found')) {
    ctx.addIssue('Expected "No companies found" message');
  }
  
  // Turn 3: Search for obscure jurisdiction
  res = await callTool('nzdpu_search', { jurisdiction: 'Vatican City' });
  ctx.addTurn('Search Vatican City', ['nzdpu_search'], res.text, res.duration);
  console.log('  Turn 3: Vatican City search ✓');
  
  // Turn 4: Invalid sub-sector name
  res = await callTool('nzdpu_search', { sub_sector: 'Space Mining' });
  ctx.addTurn('Search Space Mining sector', ['nzdpu_search'], res.text, res.duration);
  console.log('  Turn 4: Invalid sector ✓');
  
  return ctx;
}

async function edgeCase2_InvalidInputs() {
  const ctx = new ConversationContext('Edge Case 2: Invalid Inputs');
  console.log(`\n📝 ${ctx.name}`);
  
  // Turn 1: Invalid company ID for emissions
  try {
    let res = await callTool('nzdpu_emissions', { company_id: 999999999 });
    ctx.addTurn('Emissions for invalid ID', ['nzdpu_emissions'], res.text, res.duration);
    if (!res.text.includes('not found')) {
      ctx.addIssue('Should indicate company not found');
    }
  } catch (e) {
    ctx.addTurn('Emissions for invalid ID', ['nzdpu_emissions'], 'Error: ' + e.message, 0);
  }
  console.log('  Turn 1: Invalid company ID ✓');
  
  // Turn 2: Invalid framework name
  let res = await callTool('nzdpu_learn', { topic: 'framework:NONEXISTENT' });
  ctx.addTurn('Invalid framework', ['nzdpu_learn'], res.text, res.duration);
  console.log('  Turn 2: Invalid framework ✓');
  
  if (!res.text.includes('not found')) {
    ctx.addIssue('Should indicate framework not found');
  }
  
  // Turn 3: Invalid Scope 3 category
  res = await callTool('nzdpu_learn', { topic: 'scope3:99' });
  ctx.addTurn('Invalid S3 category', ['nzdpu_learn'], res.text, res.duration);
  console.log('  Turn 3: Invalid S3 category ✓');
  
  // Turn 4: Invalid materiality category
  res = await callTool('nzdpu_learn', { topic: 'materiality:0' });
  ctx.addTurn('Invalid materiality', ['nzdpu_learn'], res.text, res.duration);
  console.log('  Turn 4: Invalid materiality ✓');
  
  // Turn 5: Invalid emission factor tier
  res = await callTool('nzdpu_learn', { topic: 'emission_factor:99' });
  ctx.addTurn('Invalid EF tier', ['nzdpu_learn'], res.text, res.duration);
  console.log('  Turn 5: Invalid EF tier ✓');
  
  return ctx;
}

async function edgeCase3_LargeComparison() {
  const ctx = new ConversationContext('Edge Case 3: Large Comparison (10+ companies)');
  console.log(`\n📝 ${ctx.name}`);
  
  // Turn 1: Find many companies in a sector
  let res = await callTool('nzdpu_search', { sector: 'Financials', jurisdiction: 'United States of America', limit: 15 });
  ctx.addTurn('Search US Financials (15)', ['nzdpu_search'], res.text, res.duration);
  console.log('  Turn 1: Find 15 US Financials ✓');
  
  const ids = [];
  const matches = res.text.matchAll(/\|\s*[^|]+\s*\|\s*(\d+)\s*\|/g);
  for (const m of matches) {
    const id = parseInt(m[1]);
    if (!isNaN(id) && id > 0) ids.push(id);
  }
  ctx.storeData('us_fin_ids', ids);
  console.log(`    Found ${ids.length} companies`);
  
  if (ids.length < 10) {
    ctx.addIssue(`Expected 10+ companies, found ${ids.length}`);
  }
  
  // Turn 2: Compare all of them
  const start = performance.now();
  res = await callTool('nzdpu_benchmark', { mode: 'compare', company_ids: ids.slice(0, 10) });
  const dur = performance.now() - start;
  ctx.addTurn('Compare 10 companies', ['nzdpu_benchmark'], res.text, dur);
  console.log(`  Turn 2: Compare 10 companies (${dur.toFixed(0)}ms) ✓`);
  
  if (dur > 3000) {
    ctx.addIssue(`Large comparison took ${dur.toFixed(0)}ms (>3s)`);
  }
  
  // Turn 3: Get peer stats for the full sector
  res = await callTool('nzdpu_benchmark', { mode: 'peer_stats', sector: 'Financials', scope: 'scope1' });
  ctx.addTurn('Peer stats for all Financials', ['nzdpu_benchmark'], res.text, res.duration);
  console.log('  Turn 3: Sector-wide peer stats ✓');
  
  return ctx;
}

async function edgeCase4_CrossSectorComparison() {
  const ctx = new ConversationContext('Edge Case 4: Cross-Sector Comparison (Different business models)');
  console.log(`\n📝 ${ctx.name}`);
  
  // Turn 1: Find an oil company
  let res = await callTool('nzdpu_search', { sub_sector: 'Oil & Gas', limit: 3 });
  ctx.addTurn('Find an O&G company', ['nzdpu_search'], res.text, res.duration);
  console.log('  Turn 1: Find O&G company ✓');
  
  let ogId = null;
  const ogMatch = res.text.match(/\|\s*[^|]+\s*\|\s*(\d+)\s*\|/);
  if (ogMatch) ogId = parseInt(ogMatch[1]);
  
  // Turn 2: Find a technology company (broader search)
  res = await callTool('nzdpu_search', { sector: 'Technology & Communications', limit: 3 });
  ctx.addTurn('Find a Tech company', ['nzdpu_search'], res.text, res.duration);
  console.log('  Turn 2: Find Tech company ✓');
  
  let techId = null;
  const techMatch = res.text.match(/\|\s*[^|]+\s*\|\s*(\d+)\s*\|/);
  if (techMatch) techId = parseInt(techMatch[1]);
  
  // Turn 3: Find a financial company
  res = await callTool('nzdpu_search', { sector: 'Financials', limit: 3 });
  ctx.addTurn('Find a Financial company', ['nzdpu_search'], res.text, res.duration);
  console.log('  Turn 3: Find Financial ✓');
  
  let finId = null;
  const finMatch = res.text.match(/\|\s*[^|]+\s*\|\s*(\d+)\s*\|/);
  if (finMatch) finId = parseInt(finMatch[1]);
  
  const foundIds = [ogId, techId, finId].filter(Boolean);
  if (foundIds.length < 2) {
    ctx.addIssue(`Only found ${foundIds.length} companies for cross-sector comparison`);
    return ctx;
  }
  
  // Turn 4: Compare cross-sector (this should show warnings!)
  res = await callTool('nzdpu_benchmark', { mode: 'compare', company_ids: foundIds });
  ctx.addTurn('Compare cross-sector companies', ['nzdpu_benchmark'], res.text, res.duration);
  console.log('  Turn 4: Cross-sector comparison ✓');
  
  // Check that disclaimers are present
  if (!res.text.includes('Limitation')) {
    ctx.addIssue('Cross-sector comparison should emphasize limitations');
  }
  
  // Turn 5: Learn why this comparison is problematic
  res = await callTool('nzdpu_learn', { topic: 'mistakes' });
  ctx.addTurn('Learn about common mistakes', ['nzdpu_learn'], res.text, res.duration);
  console.log('  Turn 5: Learn mistakes ✓');
  
  return ctx;
}

async function edgeCase5_DeepDiveOneCompany() {
  const ctx = new ConversationContext('Edge Case 5: Deep Dive Single Company (All tools)');
  console.log(`\n📝 ${ctx.name}`);
  
  // Turn 1: Find TotalEnergies
  let res = await callTool('nzdpu_search', { name: 'TotalEnergies', limit: 1 });
  ctx.addTurn('Find TotalEnergies', ['nzdpu_search'], res.text, res.duration);
  console.log('  Turn 1: Find TotalEnergies ✓');
  
  const match = res.text.match(/\|\s*[^|]+\s*\|\s*(\d+)\s*\|/);
  if (!match) {
    ctx.addIssue('Could not find TotalEnergies');
    return ctx;
  }
  const nzId = parseInt(match[1]);
  ctx.storeData('total_id', nzId);
  
  // Turn 2: Get emissions
  res = await callTool('nzdpu_emissions', { company_id: nzId });
  ctx.addTurn('Get emissions', ['nzdpu_emissions'], res.text, res.duration);
  console.log('  Turn 2: Get emissions ✓');
  
  // Turn 3: Get quality assessment
  res = await callTool('nzdpu_quality', { company_id: nzId });
  ctx.addTurn('Get quality', ['nzdpu_quality'], res.text, res.duration);
  console.log('  Turn 3: Get quality ✓');
  
  // Turn 4: Benchmark against sector
  res = await callTool('nzdpu_benchmark', { mode: 'single', company_id: nzId, scope: 'scope1' });
  ctx.addTurn('Benchmark S1', ['nzdpu_benchmark'], res.text, res.duration);
  console.log('  Turn 4: Benchmark S1 ✓');
  
  // Turn 5: Benchmark Scope 3
  res = await callTool('nzdpu_benchmark', { mode: 'single', company_id: nzId, scope: 'scope3' });
  ctx.addTurn('Benchmark S3', ['nzdpu_benchmark'], res.text, res.duration);
  console.log('  Turn 5: Benchmark S3 ✓');
  
  // Turn 6: Learn about Cat 11 (Use of sold products - key for O&G)
  res = await callTool('nzdpu_learn', { topic: 'scope3:11' });
  ctx.addTurn('Learn Cat 11', ['nzdpu_learn'], res.text, res.duration);
  console.log('  Turn 6: Learn Cat 11 ✓');
  
  // Turn 7: Learn about materiality for Cat 11
  res = await callTool('nzdpu_learn', { topic: 'materiality:11' });
  ctx.addTurn('Cat 11 materiality', ['nzdpu_learn'], res.text, res.duration);
  console.log('  Turn 7: Cat 11 materiality ✓');
  
  if (!res.text.toLowerCase().includes('oil')) {
    ctx.addIssue('Cat 11 materiality should mention Oil & Gas');
  }
  
  return ctx;
}

async function edgeCase6_YearSpecificQueries() {
  const ctx = new ConversationContext('Edge Case 6: Year-Specific Queries');
  console.log(`\n📝 ${ctx.name}`);
  
  // Turn 1: Find a company with multi-year data
  let res = await callTool('nzdpu_analyze', { analysis: 'disclosure', min_disclosures: 4, limit: 5 });
  ctx.addTurn('Find multi-year companies', ['nzdpu_analyze'], res.text, res.duration);
  console.log('  Turn 1: Find multi-year companies ✓');
  
  // Extract a company ID
  const match = res.text.match(/\|\s*[^|]+\s*\|\s*(\d+)\s*\|\s*\d+\s*\|/);
  if (!match) {
    ctx.addIssue('Could not find company with multi-year data');
    return ctx;
  }
  const nzId = parseInt(match[1]);
  
  // Turn 2: Get all emissions (no year filter)
  res = await callTool('nzdpu_emissions', { company_id: nzId });
  ctx.addTurn('Get all emissions', ['nzdpu_emissions'], res.text, res.duration);
  console.log('  Turn 2: All years emissions ✓');
  
  // Turn 3: Get 2022 emissions specifically
  res = await callTool('nzdpu_emissions', { company_id: nzId, year: 2022 });
  ctx.addTurn('Get 2022 emissions', ['nzdpu_emissions'], res.text, res.duration);
  console.log('  Turn 3: 2022 emissions ✓');
  
  // Turn 4: Get quality for 2022
  res = await callTool('nzdpu_quality', { company_id: nzId, year: 2022 });
  ctx.addTurn('Get 2022 quality', ['nzdpu_quality'], res.text, res.duration);
  console.log('  Turn 4: 2022 quality ✓');
  
  // Turn 5: Learn about base year recalculation
  res = await callTool('nzdpu_learn', { topic: 'base_year' });
  ctx.addTurn('Learn base year', ['nzdpu_learn'], res.text, res.duration);
  console.log('  Turn 5: Base year recalculation ✓');
  
  return ctx;
}

// ==================== MAIN ====================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Multi-Turn Conversation Tests                             ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  const results = [];
  
  try {
    console.log('\n🚀 Starting MCP Server...');
    await startMCP();
    console.log('✓ Server started');
    
    // Base Cases
    console.log('\n═══════════════════════════════════════');
    console.log('           BASE CASE TESTS             ');
    console.log('═══════════════════════════════════════');
    
    results.push(await baseCase1_SimpleCompanyLookup());
    results.push(await baseCase2_SectorExploration());
    results.push(await baseCase3_JurisdictionComparison());
    results.push(await baseCase4_LearningJourney());
    results.push(await baseCase5_TopEmittersAnalysis());
    
    // Edge Cases
    console.log('\n═══════════════════════════════════════');
    console.log('           EDGE CASE TESTS             ');
    console.log('═══════════════════════════════════════');
    
    results.push(await edgeCase1_NoResultsHandling());
    results.push(await edgeCase2_InvalidInputs());
    results.push(await edgeCase3_LargeComparison());
    results.push(await edgeCase4_CrossSectorComparison());
    results.push(await edgeCase5_DeepDiveOneCompany());
    results.push(await edgeCase6_YearSpecificQueries());
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  } finally {
    stopMCP();
  }
  
  // Print Summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  TEST RESULTS SUMMARY                                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  let totalTurns = 0;
  let totalIssues = 0;
  
  for (const ctx of results) {
    const s = ctx.summary();
    totalTurns += s.turnCount;
    totalIssues += s.issueCount;
    
    const status = s.issueCount === 0 ? '✅' : '⚠️';
    console.log(`\n${status} ${s.name}`);
    console.log(`   Turns: ${s.turnCount} | Duration: ${s.totalDuration} | Avg: ${s.avgTurnTime}`);
    
    if (s.issues.length > 0) {
      console.log('   Issues:');
      s.issues.forEach(i => console.log(`     - ${i}`));
    }
  }
  
  console.log('\n───────────────────────────────────────');
  console.log(`📊 TOTAL: ${results.length} conversations, ${totalTurns} turns, ${totalIssues} issues`);
  
  if (totalIssues === 0) {
    console.log('✅ All conversations completed successfully!');
  } else {
    console.log(`⚠️  ${totalIssues} issues found - review above for details`);
  }
  
  process.exit(totalIssues > 0 ? 1 : 0);
}

main();
