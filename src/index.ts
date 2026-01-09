#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

// Database queries (instant)
import * as db from './db/queries.js';

// Knowledge base (no database needed)
import { 
  explainConcept, 
  listAvailableConcepts, 
  ghgConcepts,
  scope3Categories 
} from './knowledge/concepts.js';
import { 
  commonMistakes 
} from './knowledge/comparability.js';

// ============================================================
// 7 CONSOLIDATED TOOLS
// ============================================================
// 1. nzdpu_search    - Find companies (by name, LEI, sector, jurisdiction)
// 2. nzdpu_emissions - Get emissions data for a company
// 3. nzdpu_list      - List sectors, jurisdictions, or subsectors
// 4. nzdpu_analyze   - Dataset-wide analytics
// 5. nzdpu_benchmark - Compare and benchmark companies
// 6. nzdpu_quality   - Detailed data quality assessment
// 7. nzdpu_learn     - Educational content
// ============================================================

const tools: Tool[] = [
  // ============ 1. SEARCH ============
  {
    name: 'nzdpu_search',
    description: `Search and find companies in the NZDPU database. Use this FIRST to discover companies before getting emissions or benchmarking.

WHEN TO USE:
• Finding companies by name: "Find Microsoft" or "Search for Shell"
• Filtering by location: "Companies in France" or "UK energy companies"
• Filtering by sector: "Oil & Gas companies" or "Financial services firms"
• Looking up by LEI: "Find company with LEI 549300..."

RETURNS: Company profiles with nz_id, name, jurisdiction, SICS classification (sector > sub-sector > industry), and LEI.`,
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Company name to search (partial match supported)' },
        lei: { type: 'string', description: 'Legal Entity Identifier (20-character code)' },
        jurisdiction: { type: 'string', description: 'Country/region (e.g., "France", "United States of America", "Japan")' },
        sector: { type: 'string', description: 'SICS sector (e.g., "Extractives & Minerals Processing", "Financials")' },
        sub_sector: { type: 'string', description: 'SICS sub-sector (e.g., "Oil & Gas", "Commercial Banks")' },
        industry: { type: 'string', description: 'SICS industry (more specific than sub-sector)' },
        limit: { type: 'number', description: 'Max results to return (default: 20)', default: 20 },
      },
    },
  },

  // ============ 2. EMISSIONS ============
  {
    name: 'nzdpu_emissions',
    description: `Get emissions data for a specific company. Returns Scope 1, Scope 2 (both location-based AND market-based), and Scope 3 (all 15 categories).

WHEN TO USE:
• After finding a company with nzdpu_search
• Getting detailed emissions breakdown: "What are BP's emissions?"
• Year-specific queries: "Microsoft's 2022 emissions"

RETURNS: Emissions values, methodologies, organizational boundary, and verification status.

NOTE: Location-based and market-based Scope 2 cannot be compared - they measure different things.`,
    inputSchema: {
      type: 'object',
      properties: {
        company_id: { type: 'number', description: 'The company nz_id (get this from nzdpu_search first)' },
        year: { type: 'number', description: 'Specific reporting year (omit for all available years)' },
      },
      required: ['company_id'],
    },
  },

  // ============ 3. LIST ============
  {
    name: 'nzdpu_list',
    description: `List available classification values in the database. Use to explore what sectors, jurisdictions, or industries exist.

WHEN TO USE:
• Exploring available sectors: "What sectors are in the database?"
• Finding jurisdictions: "What countries are covered?"
• Understanding SICS hierarchy: "What sub-sectors are in Oil & Gas?"

TYPE OPTIONS:
• "sectors" - All SICS sectors with company counts
• "jurisdictions" - All countries/regions with company counts
• "subsectors" - Full SICS hierarchy (sector > sub-sector > industry)`,
    inputSchema: {
      type: 'object',
      properties: {
        type: { 
          type: 'string', 
          enum: ['sectors', 'jurisdictions', 'subsectors'],
          description: 'What to list: sectors, jurisdictions, or subsectors'
        },
        sector: { type: 'string', description: 'For subsectors: filter to a specific sector' },
      },
      required: ['type'],
    },
  },

  // ============ 4. ANALYZE ============
  {
    name: 'nzdpu_analyze',
    description: `Perform analytics across the full 12,497-company dataset. All queries are INSTANT (SQLite-backed).

WHEN TO USE:
• Dataset overview: "How many companies are in the database?"
• Finding top emitters: "Who are the largest Scope 1 emitters?"
• Disclosure patterns: "How many companies have 5+ years of data?"
• Data quality audit: "Find potential data errors"

ANALYSIS OPTIONS:
• "overview" - Total counts, breakdown by sector/jurisdiction/year
• "top_emitters" - Ranked list by any scope (requires 'scope' param)
• "disclosure" - Companies by years of disclosure history
• "data_issues" - Potential quality problems (unit errors, outliers)`,
    inputSchema: {
      type: 'object',
      properties: {
        analysis: { 
          type: 'string', 
          enum: ['overview', 'top_emitters', 'disclosure', 'data_issues'],
          description: 'Type of analysis to perform'
        },
        scope: { 
          type: 'string', 
          enum: ['scope1', 'scope2_lb', 'scope2_mb', 'scope3', 'scope3_cat_1', 'scope3_cat_2', 'scope3_cat_3', 'scope3_cat_4', 'scope3_cat_5', 'scope3_cat_6', 'scope3_cat_7', 'scope3_cat_8', 'scope3_cat_9', 'scope3_cat_10', 'scope3_cat_11', 'scope3_cat_12', 'scope3_cat_13', 'scope3_cat_14', 'scope3_cat_15'],
          description: 'For top_emitters: which scope to rank by' 
        },
        year: { type: 'number', description: 'Filter to specific year (optional)' },
        min_disclosures: { type: 'number', description: 'For disclosure: minimum years of history' },
        limit: { type: 'number', description: 'Max results (default: 20)', default: 20 },
      },
      required: ['analysis'],
    },
  },

  // ============ 5. BENCHMARK ============
  {
    name: 'nzdpu_benchmark',
    description: `Compare and benchmark companies against peers. Includes data quality assessment and comparability warnings.

WHEN TO USE:
• Single company benchmark: "How does Shell compare to its peers?"
• Multi-company comparison: "Compare these 5 oil companies"
• Peer group statistics: "What's the average Scope 1 for UK financials?"

MODE OPTIONS:
• "single" - Benchmark one company vs jurisdiction/sector/combined peers
• "compare" - Side-by-side comparison of multiple companies with quality scores
• "peer_stats" - Aggregate statistics for a filtered peer group

IMPORTANT: For Scope 2, specify scope2_lb (location-based) or scope2_mb (market-based). These cannot be mixed.`,
    inputSchema: {
      type: 'object',
      properties: {
        mode: { 
          type: 'string', 
          enum: ['single', 'compare', 'peer_stats'],
          description: 'Benchmarking mode'
        },
        company_id: { type: 'number', description: 'For single mode: the company nz_id to benchmark' },
        company_ids: { 
          type: 'array', 
          items: { type: 'number' },
          description: 'For compare mode: list of nz_ids to compare' 
        },
        jurisdiction: { type: 'string', description: 'Filter by jurisdiction' },
        sector: { type: 'string', description: 'Filter by SICS sector' },
        sub_sector: { type: 'string', description: 'Filter by SICS sub-sector' },
        scope: { 
          type: 'string', 
          enum: ['scope1', 'scope2_lb', 'scope2_mb', 'scope3'],
          description: 'Which scope to benchmark (default: scope1)',
          default: 'scope1'
        },
        year: { type: 'number', description: 'Specific reporting year (optional)' },
        limit: { type: 'number', description: 'For compare: max companies (default: 20)', default: 20 },
      },
      required: ['mode'],
    },
  },

  // ============ 6. QUALITY ============
  {
    name: 'nzdpu_quality',
    description: `Get detailed data quality assessment for a company's disclosure. Analyzes methodology, boundary, verification, and Scope 3 category methods.

WHEN TO USE:
• Before trusting reported numbers: "Is BP's data reliable?"
• Understanding methodology: "What methods did Shell use for Scope 3?"
• Checking comparability: "Can I compare these two companies?"

RETURNS:
• Overall quality score (HIGH/MEDIUM/LOW)
• Organizational boundary type and score
• Verification/assurance level
• Scope 3 methodology per category (PRIMARY/MODELED/UNKNOWN)
• Year-over-year methodology changes
• Specific quality warnings`,
    inputSchema: {
      type: 'object',
      properties: {
        company_id: { type: 'number', description: 'The company nz_id' },
        year: { type: 'number', description: 'Specific year (omit for latest)' },
      },
      required: ['company_id'],
    },
  },

  // ============ 7. LEARN ============
  {
    name: 'nzdpu_learn',
    description: `Educational content about GHG emissions accounting. Use to understand concepts, methodologies, and why certain comparisons are invalid.

WHEN TO USE:
• Learning concepts: "What is Scope 2?"
• Understanding differences: "Location-based vs market-based Scope 2"
• Scope 3 categories: "Explain all 15 Scope 3 categories"
• Avoiding mistakes: "Common errors in emissions analysis"
• Comparability rules: "Why can't I compare these values?"

TOPIC OPTIONS:
• "concepts" - List all available concept explanations
• "concept:<name>" - Explain specific concept (e.g., "concept:scope1", "concept:organizational_boundary")
• "scope2" - Detailed explanation of Scope 2 (location-based AND market-based)
• "scope3" - All 15 Scope 3 categories explained
• "scope3:<number>" - Specific category (e.g., "scope3:11" for Use of Sold Products)
• "mistakes" - Common errors in GHG data analysis
• "comparability:<type>" - Why certain data can't be compared
  Types: scope2_lb_vs_mb, different_boundaries, different_years, scope3_categories`,
    inputSchema: {
      type: 'object',
      properties: {
        topic: { 
          type: 'string', 
          description: 'Topic to learn about (see description for options)'
        },
      },
      required: ['topic'],
    },
  },
];

// Create server instance
const server = new Server(
  {
    name: 'nzdpu-mcp-server',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // ============ 1. SEARCH ============
      case 'nzdpu_search': {
        const searchName = args?.name as string | undefined;
        const lei = args?.lei as string | undefined;
        const jurisdiction = args?.jurisdiction as string | undefined;
        const sector = args?.sector as string | undefined;
        const subSector = args?.sub_sector as string | undefined;
        const industry = args?.industry as string | undefined;
        const limit = (args?.limit as number) || 20;

        // If LEI provided, search by LEI
        if (lei) {
          const company = db.getCompanyByLei(lei);
          if (!company) {
            return { content: [{ type: 'text', text: `No company found with LEI: ${lei}` }] };
          }
          
          let output = `# Company Found by LEI\n\n`;
          output += `**${company.company_name}** (nz_id: ${company.nz_id})\n`;
          output += `- LEI: ${company.lei}\n`;
          output += `- Jurisdiction: ${company.jurisdiction || 'N/A'}\n`;
          output += `- Sector: ${company.sics_sector || 'N/A'}\n`;
          if (company.sics_sub_sector) output += `- Sub-Sector: ${company.sics_sub_sector}\n`;
          if (company.sics_industry) output += `- Industry: ${company.sics_industry}\n`;
          output += `\n*Use nz_id ${company.nz_id} with other tools.*`;
          
          return { content: [{ type: 'text', text: output }] };
        }

        // Otherwise, search with filters
        const result = db.listCompanies({
          search: searchName,
          jurisdiction,
          sics_sector: sector,
          sics_sub_sector: subSector,
          sics_industry: industry,
          limit,
        });
        
        let output = `# Search Results\n\n`;
        output += `**Found:** ${result.total} companies`;
        if (result.total > limit) output += ` (showing first ${limit})`;
        output += '\n\n';
        
        if (result.data.length === 0) {
          output += '*No companies match the search criteria.*\n';
          output += '\nTry:\n';
          output += '- Using partial name matches\n';
          output += '- Checking jurisdiction spelling (use nzdpu_list type=jurisdictions)\n';
          output += '- Using broader sector filters\n';
        } else {
          output += `| Company | nz_id | Jurisdiction | Sector | Sub-Sector |\n`;
          output += `|---------|-------|--------------|--------|------------|\n`;
          
          result.data.forEach((c) => {
            output += `| ${c.company_name} | ${c.nz_id} | ${c.jurisdiction || '—'} | ${c.sics_sector || '—'} | ${c.sics_sub_sector || '—'} |\n`;
          });
          
          output += `\n*Use the nz_id with nzdpu_emissions, nzdpu_benchmark, or nzdpu_quality tools.*`;
        }
        
        return { content: [{ type: 'text', text: output }] };
      }

      // ============ 2. EMISSIONS ============
      case 'nzdpu_emissions': {
        const companyId = args?.company_id as number;
        if (!companyId) throw new Error('company_id is required. Use nzdpu_search first to find the nz_id.');
        
        const company = db.getCompanyById(companyId);
        if (!company) throw new Error(`Company with nz_id ${companyId} not found`);
        
        const emissions = db.getCompanyEmissions(companyId, args?.year as number | undefined);
        
        let output = `# Emissions Data: ${company.company_name}\n\n`;
        output += `**nz_id:** ${companyId}\n`;
        output += `**Sector:** ${company.sics_sector || 'N/A'}`;
        if (company.sics_sub_sector) output += ` > ${company.sics_sub_sector}`;
        output += `\n**Jurisdiction:** ${company.jurisdiction || 'N/A'}\n\n`;
        
        if (emissions.length === 0) {
          output += '*No emissions data available for this company.*\n';
        } else {
          // Sort by year descending
          emissions.sort((a, b) => b.year - a.year);
          
          output += `## Emissions by Year (tCO₂e)\n\n`;
          output += `| Year | Scope 1 | Scope 2 LB | Scope 2 MB | Scope 3 Total |\n`;
          output += `|------|---------|------------|------------|---------------|\n`;
          
          for (const e of emissions) {
            output += `| ${e.year} | ${e.scope1?.toLocaleString() || '—'} | ${e.scope2_lb?.toLocaleString() || '—'} | ${e.scope2_mb?.toLocaleString() || '—'} | ${e.scope3_total?.toLocaleString() || '—'} |\n`;
          }
          
          // Show latest year's Scope 3 breakdown with coverage summary
          const latest = emissions[0];
          const scope3Coverage = db.getScope3CoverageSummary(latest);
          
          if (scope3Coverage.categoriesReported > 0 || latest.scope3_total) {
            output += `\n## Scope 3 Coverage (${latest.year})\n\n`;
            output += `- **Categories Reported:** ${scope3Coverage.categoriesReported} of 15\n`;
            
            if (scope3Coverage.categoriesWithData.length > 0) {
              output += `- **Reported:** Cat ${scope3Coverage.categoriesWithData.join(', ')}\n`;
            }
            if (scope3Coverage.categoriesWithoutData.length > 0 && scope3Coverage.categoriesReported > 0) {
              output += `- **Not Reported:** Cat ${scope3Coverage.categoriesWithoutData.join(', ')}\n`;
            }
            
            // Highlight dominant category if >50% of total
            if (scope3Coverage.dominantCategory && scope3Coverage.dominantCategory.percent > 50) {
              output += `\n⚠️ **Dominant Category:** Cat ${scope3Coverage.dominantCategory.num} (${scope3Coverage.dominantCategory.name}) = ${scope3Coverage.dominantCategory.percent.toFixed(0)}% of total Scope 3\n`;
            }
            
            output += `\n### Scope 3 Category Breakdown\n\n`;
            output += `| Category | Name | Value (tCO₂e) | % of Total | Method |\n`;
            output += `|----------|------|---------------|------------|--------|\n`;
            
            for (let i = 1; i <= 15; i++) {
              const val = (latest as any)[`scope3_cat_${i}`];
              const method = (latest as any)[`scope3_cat_${i}_method`];
              const catName = db.SCOPE3_CATEGORY_NAMES[i];
              if (val && val > 0) {
                const pct = latest.scope3_total ? ((val / latest.scope3_total) * 100).toFixed(1) : '—';
                output += `| ${i} | ${catName} | ${val.toLocaleString()} | ${pct}% | ${method || '—'} |\n`;
              }
            }
          }
          
          // Methodology info
          if (latest.organizational_boundary || latest.verification_status) {
            output += `\n## Methodology & Quality\n\n`;
            output += `- **Organizational Boundary:** ${latest.organizational_boundary || 'Not specified'}\n`;
            output += `- **Verification:** ${latest.verification_status || 'Not specified'}\n`;
            if (latest.scope1_methodology) output += `- **Scope 1 Method:** ${latest.scope1_methodology}\n`;
            if (latest.scope2_lb_methodology) output += `- **Scope 2 LB Method:** ${latest.scope2_lb_methodology}\n`;
            if (latest.scope2_mb_methodology) output += `- **Scope 2 MB Method:** ${latest.scope2_mb_methodology}\n`;
          }
        }
        
        output += '\n---\n📚 **Note:** Location-based (LB) and market-based (MB) Scope 2 measure different things and cannot be compared.';
        
        return { content: [{ type: 'text', text: output }] };
      }

      // ============ 3. LIST ============
      case 'nzdpu_list': {
        const listType = args?.type as string;
        if (!listType) throw new Error('type is required: sectors, jurisdictions, or subsectors');

        switch (listType) {
          case 'sectors': {
            const sectors = db.listSectors();
            let output = '# SICS Sectors\n\n';
            output += `| Sector | Companies |\n|--------|----------|\n`;
            sectors.forEach(s => {
              output += `| ${s.sector} | ${s.count.toLocaleString()} |\n`;
            });
            output += `\n**Total:** ${sectors.reduce((sum, s) => sum + s.count, 0).toLocaleString()} companies`;
            return { content: [{ type: 'text', text: output }] };
          }
          
          case 'jurisdictions': {
            const jurisdictions = db.listJurisdictions();
            let output = '# Jurisdictions\n\n';
            output += `| Jurisdiction | Companies |\n|--------------|----------|\n`;
            jurisdictions.slice(0, 50).forEach(j => {
              output += `| ${j.jurisdiction} | ${j.count.toLocaleString()} |\n`;
            });
            if (jurisdictions.length > 50) {
              output += `\n*Showing top 50 of ${jurisdictions.length} jurisdictions.*`;
            }
            return { content: [{ type: 'text', text: output }] };
          }
          
          case 'subsectors': {
            const sectorFilter = args?.sector as string | undefined;
            const subSectors = db.listSubSectors(sectorFilter);
            
            let output = '# SICS Classification Hierarchy\n\n';
            output += '*Sector > Sub-Sector > Industry*\n\n';
            
            const bySector = new Map<string, typeof subSectors>();
            for (const item of subSectors) {
              const existing = bySector.get(item.sector) || [];
              existing.push(item);
              bySector.set(item.sector, existing);
            }
            
            for (const [sector, items] of bySector) {
              output += `## ${sector}\n\n`;
              for (const item of items) {
                output += `- **${item.sub_sector}** > ${item.industry} (${item.count} companies)\n`;
              }
              output += '\n';
            }
            
            return { content: [{ type: 'text', text: output }] };
          }
          
          default:
            throw new Error(`Unknown list type: ${listType}. Use: sectors, jurisdictions, or subsectors`);
        }
      }

      // ============ 4. ANALYZE ============
      case 'nzdpu_analyze': {
        const analysis = args?.analysis as string;
        if (!analysis) throw new Error('analysis is required: overview, top_emitters, disclosure, or data_issues');

        switch (analysis) {
          case 'overview': {
            const stats = db.getDatasetStats();
            
            let output = '# NZDPU Dataset Overview\n\n';
            output += `## Summary\n`;
            output += `- **Total Unique Companies:** ${stats.totalCompanies.toLocaleString()}\n`;
            output += `- **Total Emissions Records:** ${stats.totalEmissionsRecords.toLocaleString()}\n\n`;
            
            output += `## Companies by Disclosure History\n`;
            output += `| Years of Data | Companies |\n|---------------|----------|\n`;
            Object.entries(stats.companiesByDisclosureCount)
              .sort(([a], [b]) => parseInt(b) - parseInt(a))
              .forEach(([years, count]) => {
                output += `| ${years} | ${count.toLocaleString()} |\n`;
              });
            
            output += `\n## Top 10 Sectors\n`;
            output += `| Sector | Companies |\n|--------|----------|\n`;
            Object.entries(stats.companiesBySector)
              .slice(0, 10)
              .forEach(([sector, count]) => {
                output += `| ${sector} | ${count.toLocaleString()} |\n`;
              });
            
            output += `\n## Top 10 Jurisdictions\n`;
            output += `| Jurisdiction | Companies |\n|--------------|----------|\n`;
            Object.entries(stats.companiesByJurisdiction)
              .slice(0, 10)
              .forEach(([jurisdiction, count]) => {
                output += `| ${jurisdiction} | ${count.toLocaleString()} |\n`;
              });
            
            return { content: [{ type: 'text', text: output }] };
          }
          
          case 'top_emitters': {
            const scope = args?.scope as string;
            const limit = (args?.limit as number) || 10;
            const year = args?.year as number | undefined;
            
            if (!scope) throw new Error('scope is required for top_emitters analysis');
            
            const emitters = db.getTopEmitters(scope as any, limit, year);
            
            const scopeNames: Record<string, string> = {
              scope1: 'Scope 1',
              scope2_lb: 'Scope 2 (Location-Based)',
              scope2_mb: 'Scope 2 (Market-Based)',
              scope3: 'Scope 3 Total',
            };
            let scopeDisplay = scopeNames[scope] || scope;
            if (scope.startsWith('scope3_cat_')) {
              scopeDisplay = `Scope 3 Category ${scope.replace('scope3_cat_', '')}`;
            }
            
            let output = `# Top ${limit} ${scopeDisplay} Emitters\n\n`;
            if (year) output += `*Year: ${year}*\n\n`;
            
            output += `| Rank | Company | Value (tCO₂e) | Year | Jurisdiction | Sector |\n`;
            output += `|------|---------|---------------|------|--------------|--------|\n`;
            
            emitters.forEach((e, i) => {
              const warning = e.value > 1000000000 ? ' ⚠️' : '';
              output += `| ${i + 1} | ${e.company_name}${warning} | ${e.value.toLocaleString()} | ${e.year} | ${e.jurisdiction || '—'} | ${e.sics_sector || '—'} |\n`;
            });
            
            const suspicious = emitters.filter(e => e.value > 1000000000);
            if (suspicious.length > 0) {
              output += '\n## ⚠️ Data Quality Warnings\n\n';
              output += 'Values > 1 billion tCO₂e may indicate unit errors (kg reported as tonnes).\n';
            }
            
            // Add gating disclaimer for rankings
            output += '\n---\n';
            output += '## ⚠️ Ranking Limitations\n\n';
            output += 'These rankings show **absolute reported emissions** and do not indicate actual environmental performance:\n\n';
            output += '- **Scope 3 coverage varies** - Companies reporting more categories appear higher\n';
            output += '- **Business models differ** - Producers vs services have different profiles\n';
            output += '- **Company size ignored** - Larger companies naturally emit more\n';
            output += '- **Methodology varies** - Different calculation approaches affect totals\n\n';
            output += '📊 Use `nzdpu_emissions` and `nzdpu_quality` to understand each company\'s data before drawing conclusions.\n';
            
            return { content: [{ type: 'text', text: output }] };
          }
          
          case 'disclosure': {
            const minDisclosures = args?.min_disclosures as number | undefined;
            const limit = (args?.limit as number) || 50;
            
            const stats = db.getDatasetStats();
            
            let output = '# Disclosure History Analysis\n\n';
            output += `**Total Unique Companies:** ${stats.totalCompanies.toLocaleString()}\n\n`;
            
            output += `## Distribution by Disclosure Count\n\n`;
            output += `| Years | Companies | % of Total |\n`;
            output += `|-------|-----------|------------|\n`;
            
            Object.entries(stats.companiesByDisclosureCount)
              .sort(([a], [b]) => parseInt(b) - parseInt(a))
              .forEach(([years, count]) => {
                const pct = ((count / stats.totalCompanies) * 100).toFixed(1);
                output += `| ${years} | ${count.toLocaleString()} | ${pct}% |\n`;
              });
            
            if (minDisclosures) {
              const companies = db.getCompaniesWithMinDisclosures(minDisclosures, limit);
              output += `\n## Companies with ${minDisclosures}+ Years of Data\n\n`;
              output += `**Count:** ${companies.length} companies\n\n`;
              
              if (companies.length > 0) {
                output += `| Company | nz_id | Years | Disclosure Years |\n`;
                output += `|---------|-------|-------|------------------|\n`;
                companies.slice(0, limit).forEach(c => {
                  output += `| ${c.company_name} | ${c.nz_id} | ${c.disclosure_count} | ${c.years} |\n`;
                });
              }
            }
            
            return { content: [{ type: 'text', text: output }] };
          }
          
          case 'data_issues': {
            const limit = (args?.limit as number) || 50;
            const issues = db.findDataQualityIssues(limit);
            
            let output = '# Data Quality Report\n\n';
            output += '## Validation Rules Applied\n\n';
            output += '| Rule | Description |\n';
            output += '|------|-------------|\n';
            output += '| Unit Error | Values > 1 billion tCO₂e may be kg reported as tonnes |\n';
            output += '| Round Number | Suspiciously round numbers may be estimates |\n\n';
            
            output += `## Issues Found: ${issues.length}\n\n`;
            
            if (issues.length > 0) {
              output += `| Company | nz_id | Year | Scope | Value | Issue |\n`;
              output += `|---------|-------|------|-------|-------|-------|\n`;
              issues.forEach(issue => {
                output += `| ${issue.company_name} | ${issue.nz_id} | ${issue.year} | ${issue.scope} | ${issue.value.toLocaleString()} | ${issue.issue} |\n`;
              });
            } else {
              output += '*No significant data quality issues found.*\n';
            }
            
            return { content: [{ type: 'text', text: output }] };
          }
          
          default:
            throw new Error(`Unknown analysis: ${analysis}. Use: overview, top_emitters, disclosure, or data_issues`);
        }
      }

      // ============ 5. BENCHMARK ============
      case 'nzdpu_benchmark': {
        const mode = args?.mode as string;
        if (!mode) throw new Error('mode is required: single, compare, or peer_stats');

        switch (mode) {
          case 'single': {
            const companyId = args?.company_id as number;
            const scope = (args?.scope as 'scope1' | 'scope2_lb' | 'scope2_mb' | 'scope3') || 'scope1';
            const year = args?.year as number | undefined;
            
            if (!companyId) throw new Error('company_id is required for single mode');
            
            const result = db.benchmarkCompany(companyId, scope, year);
            if (!result) throw new Error(`Company with nz_id ${companyId} not found`);
            
            const scopeNames: Record<string, string> = {
              scope1: 'Scope 1',
              scope2_lb: 'Scope 2 (Location-Based)',
              scope2_mb: 'Scope 2 (Market-Based)',
              scope3: 'Scope 3 Total',
            };
            
            let output = `# Benchmark: ${result.company.company_name}\n\n`;
            output += `**Scope:** ${scopeNames[scope]}\n`;
            output += `**Year:** ${result.companyYear}\n`;
            output += `**Company Value:** ${result.companyValue?.toLocaleString() || 'N/A'} tCO₂e\n\n`;
            
            if (result.jurisdictionStats) {
              output += `## ${result.company.jurisdiction} Peers\n`;
              output += `- Peer Count: ${result.jurisdictionStats.count}\n`;
              output += `- Mean: ${Math.round(result.jurisdictionStats.mean).toLocaleString()} tCO₂e\n`;
              output += `- Median: ${Math.round(result.jurisdictionStats.median).toLocaleString()} tCO₂e\n`;
              output += `- **Company Percentile: ${result.percentileInJurisdiction}%**\n\n`;
            }
            
            if (result.sectorStats) {
              output += `## ${result.company.sics_sector} Peers\n`;
              output += `- Peer Count: ${result.sectorStats.count}\n`;
              output += `- Mean: ${Math.round(result.sectorStats.mean).toLocaleString()} tCO₂e\n`;
              output += `- Median: ${Math.round(result.sectorStats.median).toLocaleString()} tCO₂e\n`;
              output += `- **Company Percentile: ${result.percentileInSector}%**\n\n`;
            }
            
            if (result.combinedStats && result.combinedStats.count >= 3) {
              output += `## ${result.company.jurisdiction} + ${result.company.sics_sector} Peers\n`;
              output += `- Peer Count: ${result.combinedStats.count}\n`;
              output += `- Mean: ${Math.round(result.combinedStats.mean).toLocaleString()} tCO₂e\n`;
              output += `- Median: ${Math.round(result.combinedStats.median).toLocaleString()} tCO₂e\n`;
              output += `- **Company Percentile: ${result.percentileInCombined}%**\n`;
            }
            
            // Add gating disclaimer for benchmarks
            output += '\n---\n';
            output += '## ⚠️ Benchmark Limitations\n\n';
            output += 'Percentile rankings are based on **absolute emissions** and may not reflect actual performance:\n\n';
            output += '- **Business models vary** within sectors (e.g., services vs production)\n';
            output += '- **Scope 3 coverage differs** - companies report different categories\n';
            output += '- **No size adjustment** - larger companies naturally emit more\n';
            output += '- **Methodology differences** may affect comparability\n\n';
            output += '📊 **For deeper analysis:**\n';
            output += `- Use \`nzdpu_emissions company_id=${companyId}\` to see Scope 3 category coverage\n`;
            output += `- Use \`nzdpu_quality company_id=${companyId}\` to assess data quality\n`;
            
            return { content: [{ type: 'text', text: output }] };
          }
          
          case 'compare': {
            const companyIds = args?.company_ids as number[] | undefined;
            const jurisdiction = args?.jurisdiction as string | undefined;
            const sector = args?.sector as string | undefined;
            const subSector = args?.sub_sector as string | undefined;
            const year = args?.year as number | undefined;
            const limit = (args?.limit as number) || 20;
            
            let nzIds: number[] = [];
            
            if (companyIds && companyIds.length > 0) {
              nzIds = companyIds;
            } else {
              const companies = db.listCompanies({
                jurisdiction,
                sics_sector: sector,
                sics_sub_sector: subSector,
                limit,
              });
              nzIds = companies.data.map(c => c.nz_id);
            }
            
            if (nzIds.length === 0) {
              return { content: [{ type: 'text', text: 'No companies found matching the criteria.' }] };
            }
            
            // Use enhanced comparison with Scope 3 coverage
            const results = db.compareCompaniesWithScope3(nzIds, year);
            const qualityComparison = db.compareDataQuality(nzIds, year);
            
            // Determine years represented
            const yearsSet = new Set(results.companies.map((c: { emissions: db.EmissionsRow | null }) => c.emissions?.year).filter(Boolean));
            const yearsStr = Array.from(yearsSet).sort().reverse().join(', ') || 'N/A';
            
            let output = '# Company Comparison\n\n';
            output += `**Companies Analyzed:** ${results.companies.length}\n`;
            output += `**Reporting Year(s):** ${yearsStr}\n\n`;
            
            // Gating disclaimer at the top
            output += `## ⚠️ Comparison Limitations\n\n`;
            output += `The emissions data below represents **reported figures only**. Direct ranking is not recommended because:\n\n`;
            output += `1. **Scope 3 coverage varies** - Companies report different categories\n`;
            output += `2. **Business models differ** - Not distinguishable in this dataset\n`;
            output += `3. **No intensity metrics** - Revenue/production data not available\n`;
            output += `4. **Methodologies vary** - See quality assessment for each company\n\n`;
            
            // Main emissions table with Scope 3 coverage indicator
            output += `## Emissions Summary (tCO₂e)\n\n`;
            output += `| Company | Scope 1 | S2-LB | S2-MB | Scope 3 | S3 Cats | Year |\n`;
            output += `|---------|---------|-------|-------|---------|---------|------|\n`;
            
            for (const { company, emissions, scope3Coverage } of results.companies) {
              const s1 = emissions?.scope1?.toLocaleString() || '—';
              const s2lb = emissions?.scope2_lb?.toLocaleString() || '—';
              const s2mb = emissions?.scope2_mb?.toLocaleString() || '—';
              const s3 = emissions?.scope3_total?.toLocaleString() || '—';
              const s3Cats = scope3Coverage ? `${scope3Coverage.categoriesReported}/15` : '—';
              const yr = emissions?.year || '—';
              
              output += `| ${company.company_name} | ${s1} | ${s2lb} | ${s2mb} | ${s3} | ${s3Cats} | ${yr} |\n`;
            }
            
            // Scope 3 Category Comparison Table (key categories)
            const keyCategories = [1, 3, 6, 7, 11, 15]; // Most commonly material categories
            const hasAnyCategoryData = results.companies.some((c: { scope3Coverage: db.Scope3CoverageSummary | null }) => 
              c.scope3Coverage && c.scope3Coverage.categoriesReported > 0
            );
            
            if (hasAnyCategoryData) {
              output += `\n## Scope 3 Category Comparison\n\n`;
              output += `*Showing key categories. Use \`nzdpu_emissions\` for full breakdown.*\n\n`;
              
              // Header row
              output += `| Category | ${results.companies.map((c: { company: db.CompanyRow }) => c.company.company_name.substring(0, 15)).join(' | ')} |\n`;
              output += `|----------|${results.companies.map((_: unknown) => '------').join('|')}|\n`;
              
              for (const catNum of keyCategories) {
                const catName = db.SCOPE3_CATEGORY_NAMES[catNum];
                const values = results.companies.map((c: { scope3Coverage: db.Scope3CoverageSummary | null }) => {
                  if (!c.scope3Coverage) return '—';
                  const val = c.scope3Coverage.categoryValues[catNum];
                  return val ? db.formatCompactNumber(val) : '—';
                });
                output += `| ${catNum}. ${catName.substring(0, 20)} | ${values.join(' | ')} |\n`;
              }
              
              // Categories reported row
              const catCounts = results.companies.map((c: { scope3Coverage: db.Scope3CoverageSummary | null }) => 
                c.scope3Coverage ? `${c.scope3Coverage.categoriesReported}/15` : '—'
              );
              output += `| **Categories Reported** | ${catCounts.join(' | ')} |\n`;
              
              // Highlight dominant categories
              type CompanyWithScope3 = { company: db.CompanyRow; scope3Coverage: db.Scope3CoverageSummary | null };
              const dominants = results.companies
                .filter((c: CompanyWithScope3) => c.scope3Coverage?.dominantCategory && c.scope3Coverage.dominantCategory.percent > 50)
                .map((c: CompanyWithScope3) => `${c.company.company_name}: Cat ${c.scope3Coverage!.dominantCategory!.num} = ${c.scope3Coverage!.dominantCategory!.percent.toFixed(0)}%`);
              
              if (dominants.length > 0) {
                output += `\n**Dominant Categories (>50% of S3):**\n`;
                dominants.forEach((d: string) => output += `- ${d}\n`);
              }
            }
            
            // Data Quality Details
            output += '\n## Data Quality\n\n';
            output += `| Company | Boundary | Verification | Quality |\n`;
            output += `|---------|----------|--------------|--------|\n`;
            
            for (const qc of qualityComparison.companies) {
              if (qc.assessment) {
                const a = qc.assessment;
                output += `| ${qc.name} | ${a.boundaryType || '—'} | ${a.verificationType || 'None'} | **${a.overallScore}** |\n`;
              } else {
                output += `| ${qc.name} | — | — | — |\n`;
              }
            }
            
            // Merge all warnings
            const allWarnings = [
              ...results.comparabilityWarnings,
              ...qualityComparison.comparabilityWarnings
            ];
            
            if (allWarnings.length > 0) {
              output += '\n## ⚠️ Comparability Warnings\n\n';
              // Deduplicate warnings
              const uniqueWarnings = [...new Set(allWarnings)];
              for (const warning of uniqueWarnings) {
                output += `- ${warning}\n`;
              }
            }
            
            // Next steps guidance at the bottom
            output += '\n---\n';
            output += '📊 **Next Steps for Meaningful Analysis:**\n';
            output += '- Use `nzdpu_emissions company_id=X` to see full Scope 3 category breakdown\n';
            output += '- Use `nzdpu_quality company_id=X` to assess methodology and verification\n';
            output += '- Use `nzdpu_learn topic=scope3` to understand what each category measures\n';
            output += '\n📚 **Note:** S2-LB (location-based) and S2-MB (market-based) cannot be compared against each other.';
            
            return { content: [{ type: 'text', text: output }] };
          }
          
          case 'peer_stats': {
            const jurisdiction = args?.jurisdiction as string | undefined;
            const sector = args?.sector as string | undefined;
            const scope = (args?.scope as 'scope1' | 'scope2_lb' | 'scope2_mb' | 'scope3') || 'scope1';
            const year = args?.year as number | undefined;
            
            if (!jurisdiction && !sector) {
              throw new Error('At least one of jurisdiction or sector must be provided');
            }
            
            const stats = db.getPeerStatistics(scope, { jurisdiction, sics_sector: sector, year });
            
            if (!stats) {
              return { content: [{ type: 'text', text: 'No data found for the specified filters.' }] };
            }
            
            const scopeNames: Record<string, string> = {
              scope1: 'Scope 1',
              scope2_lb: 'Scope 2 (Location-Based)',
              scope2_mb: 'Scope 2 (Market-Based)',
              scope3: 'Scope 3 Total',
            };
            
            let output = `# Peer Group Statistics\n\n`;
            const filters = [];
            if (jurisdiction) filters.push(`Jurisdiction: ${jurisdiction}`);
            if (sector) filters.push(`Sector: ${sector}`);
            if (year) filters.push(`Year: ${year}`);
            output += `**Filters:** ${filters.join(', ')}\n`;
            output += `**Scope:** ${scopeNames[scope]}\n`;
            output += `**Companies with Data:** ${stats.count}\n\n`;
            
            output += `## Statistics (tCO₂e)\n\n`;
            output += `| Metric | Value |\n|--------|-------|\n`;
            output += `| Mean | ${Math.round(stats.mean).toLocaleString()} |\n`;
            output += `| Median | ${Math.round(stats.median).toLocaleString()} |\n`;
            output += `| Std Dev | ${Math.round(stats.stdDev).toLocaleString()} |\n`;
            output += `| Min | ${Math.round(stats.min).toLocaleString()} |\n`;
            output += `| Max | ${Math.round(stats.max).toLocaleString()} |\n`;
            output += `| 25th Percentile | ${Math.round(stats.percentile25).toLocaleString()} |\n`;
            output += `| 75th Percentile | ${Math.round(stats.percentile75).toLocaleString()} |\n`;
            
            return { content: [{ type: 'text', text: output }] };
          }
          
          default:
            throw new Error(`Unknown benchmark mode: ${mode}. Use: single, compare, or peer_stats`);
        }
      }

      // ============ 6. QUALITY ============
      case 'nzdpu_quality': {
        const companyId = args?.company_id as number;
        const year = args?.year as number | undefined;
        
        if (!companyId) throw new Error('company_id is required');
        
        const result = db.getCompanyQualityAssessment(companyId, year);
        
        if (!result.companyInfo) {
          throw new Error(`Company with nz_id ${companyId} not found`);
        }
        
        let output = `# Data Quality Assessment: ${result.companyInfo.company_name}\n\n`;
        output += `**nz_id:** ${companyId}\n`;
        output += `**Sector:** ${result.companyInfo.sics_sector || 'Unknown'} > ${result.companyInfo.sics_sub_sector || 'N/A'}\n`;
        output += `**Jurisdiction:** ${result.companyInfo.jurisdiction || 'Unknown'}\n\n`;
        
        if (!result.assessment) {
          output += '⚠️ No emissions data available for quality assessment.\n';
          return { content: [{ type: 'text', text: output }] };
        }
        
        const a = result.assessment;
        
        output += `## Overall Quality: **${a.overallScore}**\n\n`;
        output += `*Assessment for Year: ${a.year}*\n\n`;
        
        output += `### Component Scores\n\n`;
        output += `| Component | Score | Details |\n`;
        output += `|-----------|-------|----------|\n`;
        output += `| Organizational Boundary | ${a.boundaryScore} | ${a.boundaryType || 'Not specified'} ${a.boundaryIsStandard ? '✓' : '⚠️'} |\n`;
        output += `| Verification | ${a.verificationScore} | ${a.verificationType || 'None'} |\n`;
        output += `| Scope 1 Methodology | ${a.scope1MethodologyScore} | — |\n`;
        output += `| Scope 2 LB Methodology | ${a.scope2LBMethodologyScore} | — |\n`;
        output += `| Scope 2 MB Methodology | ${a.scope2MBMethodologyScore} | — |\n\n`;
        
        output += `### Scope 3 Methodology by Category\n\n`;
        output += `| Cat | Value (tCO₂e) | Method | Quality | Relevancy |\n`;
        output += `|-----|---------------|--------|---------|----------|\n`;
        
        for (let cat = 1; cat <= 15; cat++) {
          const s3 = a.scope3MethodQuality[cat];
          if (s3.value && s3.value > 0) {
            output += `| ${cat} | ${s3.value.toLocaleString()} | ${s3.method || '—'} | ${s3.methodTier} | ${s3.relevancy || '—'} |\n`;
          }
        }
        
        if (result.methodologyChanges.length > 0) {
          output += `\n### ⚠️ Methodology Changes Over Time\n\n`;
          output += '*Changes affect year-over-year comparability:*\n\n';
          for (const mc of result.methodologyChanges) {
            output += `**${mc.year}:**\n`;
            for (const c of mc.changes) {
              output += `- ${c.scope}: "${c.previousMethod || 'None'}" → "${c.currentMethod || 'None'}"\n`;
            }
            output += '\n';
          }
        }
        
        if (a.warnings.length > 0) {
          output += `\n### 📋 Warnings\n\n`;
          for (const w of a.warnings) {
            output += `- ${w}\n`;
          }
        }
        
        return { content: [{ type: 'text', text: output }] };
      }

      // ============ 7. LEARN ============
      case 'nzdpu_learn': {
        const topic = args?.topic as string;
        if (!topic) throw new Error('topic is required');

        // Handle different topic formats
        if (topic === 'concepts') {
          const concepts = listAvailableConcepts();
          let output = '# Available GHG Concepts\n\n';
          output += 'Use `nzdpu_learn topic=concept:<name>` to learn about any of these:\n\n';
          output += '## Core Concepts\n';
          Object.keys(ghgConcepts).forEach(key => {
            output += `• **${key}**: ${ghgConcepts[key].name}\n`;
          });
          output += '\n## Scope 3 Categories\n';
          output += 'Use `nzdpu_learn topic=scope3` to see all categories, or `topic=scope3:<number>` for specific category.\n';
          return { content: [{ type: 'text', text: output }] };
        }
        
        if (topic.startsWith('concept:')) {
          const conceptName = topic.substring(8);
          const explanation = explainConcept(conceptName);
          return { content: [{ type: 'text', text: explanation }] };
        }
        
        if (topic === 'scope2') {
          let output = `# Scope 2 Emissions: A Complete Guide

## What is Scope 2?

Scope 2 covers **indirect emissions from purchased energy** - electricity, steam, heating, and cooling that a company buys and consumes.

## Two Calculation Methods

### Location-Based (LB)

**Definition:** Uses grid-average emission factors for the location where energy is consumed.

**What it measures:** The physical emissions from the grid that supplies your electricity.

**Use case:**
- Understanding actual grid impact
- Geographic emissions mapping
- When no contractual instruments exist

**Example:** A company in Germany uses 10,000 MWh. German grid factor is 0.4 kg CO₂/kWh.
LB emissions = 10,000 × 0.4 = 4,000 tCO₂e

### Market-Based (MB)

**Definition:** Uses emission factors from contractual instruments (RECs, PPAs, supplier rates).

**What it measures:** The emissions associated with your electricity purchasing decisions.

**Use case:**
- Tracking renewable energy procurement
- Demonstrating progress on green energy targets
- When contractual instruments are available

**Example:** Same company buys RECs for 100% renewable.
MB emissions = 0 tCO₂e (despite same physical consumption)

## Why You Cannot Compare LB to MB

| Scenario | LB | MB |
|----------|----|----|
| Company A (no renewables) | 4,000 | 4,000 |
| Company B (100% RECs) | 4,000 | 0 |

Comparing A's LB (4,000) to B's MB (0) would wrongly suggest B has lower grid impact. Both have identical physical impact.

## Which to Use?

| Goal | Use This |
|------|----------|
| Understand grid impact | Location-Based |
| Track procurement progress | Market-Based |
| Compare companies | Pick ONE method |
| Regulatory reporting | Check requirements |

## Best Practice

Always report BOTH methods and clearly label which you're using. Never mix them in comparisons.`;
          
          return { content: [{ type: 'text', text: output }] };
        }
        
        if (topic === 'scope3') {
          let output = '# Scope 3 Categories\n\n';
          output += 'Scope 3 covers all other indirect emissions in a company\'s value chain.\n\n';
          output += '## Upstream (1-8)\n\n';
          for (let i = 1; i <= 8; i++) {
            output += `**${i}. ${scope3Categories[i].name.replace(`Category ${i}: `, '')}**\n`;
            output += `${scope3Categories[i].definition}\n\n`;
          }
          output += '## Downstream (9-15)\n\n';
          for (let i = 9; i <= 15; i++) {
            output += `**${i}. ${scope3Categories[i].name.replace(`Category ${i}: `, '')}**\n`;
            output += `${scope3Categories[i].definition}\n\n`;
          }
          return { content: [{ type: 'text', text: output }] };
        }
        
        if (topic.startsWith('scope3:')) {
          const catNum = parseInt(topic.substring(7));
          const category = scope3Categories[catNum];
          if (!category) {
            return { content: [{ type: 'text', text: `Invalid category: ${catNum}. Valid: 1-15.` }] };
          }
          
          let output = `# ${category.name}\n\n`;
          output += `**Definition:** ${category.definition}\n\n`;
          output += `**Use Case:** ${category.useCase}\n\n`;
          if (category.examples?.length) {
            output += `**Examples:**\n${category.examples.map(e => `• ${e}`).join('\n')}\n`;
          }
          return { content: [{ type: 'text', text: output }] };
        }
        
        if (topic === 'mistakes') {
          let output = '# Common Mistakes in GHG Data Analysis\n\n';
          commonMistakes.forEach((m, i) => {
            output += `## ${i + 1}. ${m.mistake}\n\n`;
            output += `**Why it's wrong:** ${m.explanation}\n\n`;
            output += `**How to fix:** ${m.correction}\n\n---\n\n`;
          });
          return { content: [{ type: 'text', text: output }] };
        }
        
        if (topic.startsWith('comparability:')) {
          const compType = topic.substring(14);
          
          const explanations: Record<string, string> = {
            'scope2_lb_vs_mb': `
# Why Location-Based and Market-Based Scope 2 Cannot Be Compared

## The Core Difference

**Location-Based**: "What is the physical impact on the local grid?"
- Uses grid-average emission factors
- Cannot be reduced through contracts alone

**Market-Based**: "What are the emissions from our contracted electricity?"
- Uses contractual instrument emission factors
- Can be zero with 100% renewable certificates

## Why Mixing Is Invalid

Company A: LB = 50,000, MB = 50,000 (no renewable procurement)
Company B: LB = 50,000, MB = 0 (100% RECs)

Comparing A's LB to B's MB would wrongly suggest B is "better" when both have identical grid impact.

## Valid Comparisons

✅ LB vs LB: Compare physical grid impact
✅ MB vs MB: Compare procurement strategies
❌ LB vs MB: Meaningless comparison`,
            
            'different_boundaries': `
# Why Different Organizational Boundaries Affect Comparability

## The Three Approaches

1. **Operational Control**: Include operations you control
2. **Financial Control**: Include operations where you direct policy
3. **Equity Share**: Include proportional to ownership %

## Example Impact

A 50% JV owner reports:
- Operational Control: 0 tCO₂e (if no operational control)
- Equity Share: 100,000 tCO₂e (50% of JV's 200,000)

Same company, very different numbers.`,
            
            'different_years': `
# Why Cross-Year Comparisons Require Caution

## What Changes Year-to-Year

- Business growth/contraction
- Methodology updates
- Grid decarbonization
- M&A activity
- Economic conditions

## Best Practice

✅ Same-year comparisons when possible
⚠️ If cross-year needed, acknowledge limitations`,
            
            'scope3_categories': `
# Why Scope 3 Categories Cannot Be Mixed

## Different Relevance by Sector

- Category 11 (Use of sold products): Huge for automakers, zero for banks
- Category 15 (Investments): Dominates for financials

## Different Methodologies

Each category has multiple calculation approaches with varying accuracy.

## Valid Approach

✅ Compare same category across similar companies
❌ Compare different categories`,
          };
          
          const explanation = explanations[compType];
          if (!explanation) {
            return { content: [{ type: 'text', text: `Unknown comparability type: ${compType}. Options: scope2_lb_vs_mb, different_boundaries, different_years, scope3_categories` }] };
          }
          return { content: [{ type: 'text', text: explanation }] };
        }
        
        // Try as a direct concept name
        const explanation = explainConcept(topic);
        return { content: [{ type: 'text', text: explanation }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}. Available tools: nzdpu_search, nzdpu_emissions, nzdpu_list, nzdpu_analyze, nzdpu_benchmark, nzdpu_quality, nzdpu_learn`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('NZDPU MCP Server v2.0 running (7 consolidated tools, SQLite-backed)');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
