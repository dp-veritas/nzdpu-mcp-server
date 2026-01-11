#!/usr/bin/env node

import * as db from '../dist/db/queries.js';

console.log('Checking available sub-sectors related to Oil & Gas...\n');

// Get sub-sectors in Extractives & Minerals Processing sector
const extractivesSubSectors = db.listSubSectors('Extractives & Minerals Processing');

console.log('Sub-sectors in Extractives & Minerals Processing:');
console.log(`Found ${extractivesSubSectors.length} sub-sectors\n`);

extractivesSubSectors.forEach(ss => {
  console.log(`- "${ss.sub_sector}" (${ss.count} companies)`);
  console.log(`  Industry: ${ss.industry || 'N/A'}`);
  console.log();
});

// Get all sub-sectors to find Oil & Gas
console.log('\n--- All sub-sectors containing "Oil" or "Gas" ---\n');
const allSubSectors = db.listSubSectors();
const oilGasSubSectors = allSubSectors.filter(ss =>
  ss.sub_sector && (
    ss.sub_sector.toLowerCase().includes('oil') ||
    ss.sub_sector.toLowerCase().includes('gas')
  )
);

oilGasSubSectors.forEach(ss => {
  console.log(`- "${ss.sub_sector}" (${ss.count} companies)`);
  console.log(`  Sector: ${ss.sector}`);
  console.log();
});
