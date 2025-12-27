#!/usr/bin/env node
/**
 * Build Database Script
 * 
 * Fetches all company and emissions data from the NZDPU API
 * and populates a local SQLite database for instant queries.
 * 
 * Usage: npm run build-db
 * 
 * This takes approximately 10-15 minutes to complete.
 */

import axios, { AxiosInstance } from 'axios';
import Database from 'better-sqlite3';
import path from 'path';
import { mkdirSync, existsSync } from 'fs';
import { initializeDatabase } from '../db/schema.js';

// Database path - CWD/data/nzdpu.db
const DB_PATH = path.join(process.cwd(), 'data', 'nzdpu.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}
const API_KEY = process.env.NZDPU_API_KEY;
const BASE_URL = 'https://nzdpu.com/wis';

if (!API_KEY) {
  console.error('❌ Error: NZDPU_API_KEY environment variable is required.');
  console.error('   Get a free API key at: https://nzdpu.com/sign-up');
  console.error('   Then run: export NZDPU_API_KEY=your_key_here');
  process.exit(1);
}

// Progress indicator
function progress(current: number, total: number, label: string): void {
  const pct = Math.round((current / total) * 100);
  const bar = '█'.repeat(Math.round(pct / 2)) + '░'.repeat(50 - Math.round(pct / 2));
  process.stdout.write(`\r${label}: [${bar}] ${pct}% (${current}/${total})`);
}

// Create API client
function createApiClient(): AxiosInstance {
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });
}

// Fetch all companies
async function fetchAllCompanies(client: AxiosInstance): Promise<any[]> {
  console.log('\n📥 Fetching all companies from NZDPU API...');
  
  const allCompanies: any[] = [];
  let start = 0;
  const batchSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const response = await client.get('/coverage/companies', {
      params: { limit: batchSize, start }
    });
    
    const items = response.data.items || [];
    const total = response.data.total || 0;
    
    allCompanies.push(...items);
    progress(allCompanies.length, total, 'Companies');
    
    hasMore = items.length === batchSize && allCompanies.length < total;
    start += batchSize;
    
    // Safety limit
    if (start > 100000) break;
  }
  
  console.log(`\n✓ Fetched ${allCompanies.length} companies`);
  return allCompanies;
}

// Extract Scope 3 methodology type from method_dict array
function extractScope3MethodType(values: any, category: number): string | null {
  const methodDict = values[`s3_ghgp_c${category}_emissions_method_dict`];
  if (methodDict && Array.isArray(methodDict) && methodDict.length > 0) {
    const methodType = methodDict[0][`s3_ghgp_c${category}_emissions_method_type`];
    if (methodType && methodType !== '—') {
      return methodType;
    }
  }
  return null;
}

// Extract Scope 3 relevancy for a category
function extractScope3Relevancy(values: any, category: number): string | null {
  const relevancy = values[`s3_ghgp_c${category}_emissions_relevancy`];
  if (relevancy && relevancy !== '—') {
    return relevancy;
  }
  return null;
}

// Fetch emissions for a single company
async function fetchCompanyEmissions(
  client: AxiosInstance,
  nzId: number,
  years: number[]
): Promise<any[]> {
  const emissions: any[] = [];
  
  for (const year of years) {
    try {
      const response = await client.get(`/coverage/companies/${nzId}/disclosure-details`, {
        params: { year },
        timeout: 10000,
      });
      
      if (response.data?.values) {
        const values = response.data.values;
        
        // Build the emissions record with all fields including S3 methodology per category
        const record: any = {
          nz_id: nzId,
          year,
          scope1: parseFloat(values.total_s1_emissions_ghg) || null,
          scope1_methodology: values.s1_emissions_method || null,
          scope2_lb: parseFloat(values.total_s2_lb_emissions_ghg) || null,
          scope2_mb: parseFloat(values.total_s2_mb_emissions_ghg) || null,
          scope2_lb_methodology: values.s2_lb_emissions_method || null,
          scope2_mb_methodology: values.s2_mb_emissions_method || null,
          scope3_total: parseFloat(values.total_s3_emissions_ghg) || null,
          scope3_cat_1: parseFloat(values.total_s3_ghgp_c1_emissions_ghg) || null,
          scope3_cat_2: parseFloat(values.total_s3_ghgp_c2_emissions_ghg) || null,
          scope3_cat_3: parseFloat(values.total_s3_ghgp_c3_emissions_ghg) || null,
          scope3_cat_4: parseFloat(values.total_s3_ghgp_c4_emissions_ghg) || null,
          scope3_cat_5: parseFloat(values.total_s3_ghgp_c5_emissions_ghg) || null,
          scope3_cat_6: parseFloat(values.total_s3_ghgp_c6_emissions_ghg) || null,
          scope3_cat_7: parseFloat(values.total_s3_ghgp_c7_emissions_ghg) || null,
          scope3_cat_8: parseFloat(values.total_s3_ghgp_c8_emissions_ghg) || null,
          scope3_cat_9: parseFloat(values.total_s3_ghgp_c9_emissions_ghg) || null,
          scope3_cat_10: parseFloat(values.total_s3_ghgp_c10_emissions_ghg) || null,
          scope3_cat_11: parseFloat(values.total_s3_ghgp_c11_emissions_ghg) || null,
          scope3_cat_12: parseFloat(values.total_s3_ghgp_c12_emissions_ghg) || null,
          scope3_cat_13: parseFloat(values.total_s3_ghgp_c13_emissions_ghg) || null,
          scope3_cat_14: parseFloat(values.total_s3_ghgp_c14_emissions_ghg) || null,
          scope3_cat_15: parseFloat(values.total_s3_ghgp_c15_emissions_ghg) || null,
          organizational_boundary: values.org_boundary || null,
          verification_status: extractVerificationStatus(values),
        };
        
        // Extract Scope 3 methodology and relevancy for each category (1-15)
        for (let cat = 1; cat <= 15; cat++) {
          record[`scope3_cat_${cat}_method`] = extractScope3MethodType(values, cat);
          record[`scope3_cat_${cat}_relevancy`] = extractScope3Relevancy(values, cat);
        }
        
        emissions.push(record);
      }
    } catch (error) {
      // No data for this year - skip silently
    }
  }
  
  return emissions;
}

function extractVerificationStatus(values: any): string | null {
  const verifDict = values.verif_emissions_dict;
  if (verifDict && Array.isArray(verifDict) && verifDict.length > 0) {
    const verif = verifDict[0];
    if (verif.verif_emissions_level_of_assurance && verif.verif_emissions_level_of_assurance !== '—') {
      return verif.verif_emissions_level_of_assurance;
    }
  }
  return null;
}

// Insert companies into database
function insertCompanies(db: Database.Database, companies: any[]): void {
  console.log('\n💾 Inserting companies into database...');
  
  const insert = db.prepare(`
    INSERT OR REPLACE INTO companies 
    (nz_id, company_name, jurisdiction, sics_sector, sics_sub_sector, sics_industry, lei, latest_reported_year, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertMany = db.transaction((items: any[]) => {
    for (const c of items) {
      insert.run(
        c.nz_id,
        c.company_name,
        c.jurisdiction || null,
        c.sics_sector || null,
        c.sics_sub_sector || null,
        c.sics_industry || null,
        c.lei || null,
        c.latest_reported_year || null,
        c.source || 'CDP'
      );
    }
  });
  
  insertMany(companies);
  console.log(`✓ Inserted ${companies.length} companies`);
}

// Insert emissions into database
function insertEmissions(db: Database.Database, emissions: any[]): void {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO emissions 
    (nz_id, year, scope1, scope1_methodology, scope2_lb, scope2_mb, 
     scope2_lb_methodology, scope2_mb_methodology, scope3_total,
     scope3_cat_1, scope3_cat_2, scope3_cat_3, scope3_cat_4, scope3_cat_5,
     scope3_cat_6, scope3_cat_7, scope3_cat_8, scope3_cat_9, scope3_cat_10,
     scope3_cat_11, scope3_cat_12, scope3_cat_13, scope3_cat_14, scope3_cat_15,
     scope3_cat_1_method, scope3_cat_1_relevancy,
     scope3_cat_2_method, scope3_cat_2_relevancy,
     scope3_cat_3_method, scope3_cat_3_relevancy,
     scope3_cat_4_method, scope3_cat_4_relevancy,
     scope3_cat_5_method, scope3_cat_5_relevancy,
     scope3_cat_6_method, scope3_cat_6_relevancy,
     scope3_cat_7_method, scope3_cat_7_relevancy,
     scope3_cat_8_method, scope3_cat_8_relevancy,
     scope3_cat_9_method, scope3_cat_9_relevancy,
     scope3_cat_10_method, scope3_cat_10_relevancy,
     scope3_cat_11_method, scope3_cat_11_relevancy,
     scope3_cat_12_method, scope3_cat_12_relevancy,
     scope3_cat_13_method, scope3_cat_13_relevancy,
     scope3_cat_14_method, scope3_cat_14_relevancy,
     scope3_cat_15_method, scope3_cat_15_relevancy,
     organizational_boundary, verification_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  for (const e of emissions) {
    insert.run(
      e.nz_id, e.year, e.scope1, e.scope1_methodology,
      e.scope2_lb, e.scope2_mb, e.scope2_lb_methodology, e.scope2_mb_methodology,
      e.scope3_total,
      e.scope3_cat_1, e.scope3_cat_2, e.scope3_cat_3, e.scope3_cat_4, e.scope3_cat_5,
      e.scope3_cat_6, e.scope3_cat_7, e.scope3_cat_8, e.scope3_cat_9, e.scope3_cat_10,
      e.scope3_cat_11, e.scope3_cat_12, e.scope3_cat_13, e.scope3_cat_14, e.scope3_cat_15,
      e.scope3_cat_1_method, e.scope3_cat_1_relevancy,
      e.scope3_cat_2_method, e.scope3_cat_2_relevancy,
      e.scope3_cat_3_method, e.scope3_cat_3_relevancy,
      e.scope3_cat_4_method, e.scope3_cat_4_relevancy,
      e.scope3_cat_5_method, e.scope3_cat_5_relevancy,
      e.scope3_cat_6_method, e.scope3_cat_6_relevancy,
      e.scope3_cat_7_method, e.scope3_cat_7_relevancy,
      e.scope3_cat_8_method, e.scope3_cat_8_relevancy,
      e.scope3_cat_9_method, e.scope3_cat_9_relevancy,
      e.scope3_cat_10_method, e.scope3_cat_10_relevancy,
      e.scope3_cat_11_method, e.scope3_cat_11_relevancy,
      e.scope3_cat_12_method, e.scope3_cat_12_relevancy,
      e.scope3_cat_13_method, e.scope3_cat_13_relevancy,
      e.scope3_cat_14_method, e.scope3_cat_14_relevancy,
      e.scope3_cat_15_method, e.scope3_cat_15_relevancy,
      e.organizational_boundary, e.verification_status
    );
  }
}

// Main build function
async function buildDatabase(): Promise<void> {
  console.log('🚀 NZDPU Database Builder');
  console.log('========================\n');
  console.log(`Database path: ${DB_PATH}`);
  console.log(`API endpoint: ${BASE_URL}`);
  
  const startTime = Date.now();
  
  // Initialize database
  console.log('\n📁 Initializing database...');
  const db = initializeDatabase(DB_PATH);
  console.log('✓ Database initialized');
  
  // Create API client
  const client = createApiClient();
  
  // Fetch all companies
  const companies = await fetchAllCompanies(client);
  
  // Insert companies
  insertCompanies(db, companies);
  
  // Fetch and insert emissions for each company
  console.log('\n📥 Fetching emissions data for all companies...');
  console.log('   (This will take approximately 10-15 minutes)\n');
  
  const years = [2023, 2022, 2021, 2020, 2019, 2018];
  const batchSize = 50; // Process 50 companies at a time
  let processedCompanies = 0;
  let totalEmissions = 0;
  
  for (let i = 0; i < companies.length; i += batchSize) {
    const batch = companies.slice(i, i + batchSize);
    
    // Fetch emissions for batch in parallel
    const batchPromises = batch.map(company => 
      fetchCompanyEmissions(client, company.nz_id, years)
    );
    
    const batchResults = await Promise.all(batchPromises);
    
    // Insert all emissions from this batch
    const allEmissions = batchResults.flat();
    if (allEmissions.length > 0) {
      const insertBatch = db.transaction((emissions: any[]) => {
        insertEmissions(db, emissions);
      });
      insertBatch(allEmissions);
      totalEmissions += allEmissions.length;
    }
    
    processedCompanies += batch.length;
    progress(processedCompanies, companies.length, 'Emissions  ');
  }
  
  console.log(`\n✓ Inserted ${totalEmissions} emissions records`);
  
  // Update metadata
  console.log('\n📝 Updating metadata...');
  db.prepare(`INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)`).run('build_date', new Date().toISOString());
  db.prepare(`INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)`).run('company_count', String(companies.length));
  db.prepare(`INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)`).run('emissions_count', String(totalEmissions));
  db.prepare(`INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)`).run('source', 'NZDPU API');
  
  // Optimize database
  console.log('🔧 Optimizing database...');
  db.exec('ANALYZE');
  db.exec('VACUUM');
  
  // Close database
  db.close();
  
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  
  console.log('\n✅ Database build complete!');
  console.log('========================');
  console.log(`   Companies: ${companies.length.toLocaleString()}`);
  console.log(`   Emissions records: ${totalEmissions.toLocaleString()}`);
  console.log(`   Time elapsed: ${elapsed} minutes`);
  console.log(`   Database file: ${DB_PATH}`);
}

// Run the build
buildDatabase().catch(error => {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
});

