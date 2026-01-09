#!/usr/bin/env node
/**
 * RIGOROUS REAL-WORLD TESTING: nzdpu_quality tool
 * Tests realistic analyst questions about data quality and verifies accuracy
 */

import * as db from './dist/db/queries.js';

console.log('\n' + '='.repeat(80));
console.log('RIGOROUS QUALITY TOOL TESTING - Real-World Scenarios');
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
// SCENARIO 1: "Is Shell's emissions data reliable?"
// ============================================================
console.log('\n🔍 SCENARIO 1: "Is Shell\'s emissions data reliable?"');
console.log('-'.repeat(70));

const shell = db.listCompanies({ search: 'Shell PLC', limit: 1 }).data[0];
if (!shell) {
  fail('Find Shell', 'Could not find Shell');
} else {
  const quality = db.getCompanyQualityAssessment(shell.nz_id);
  
  if (!quality.assessment) {
    fail('Shell quality assessment', 'No assessment returned');
  } else {
    const a = quality.assessment;
    console.log(`\n  Company: ${quality.companyInfo.company_name}`);
    console.log(`  Year: ${a.year}`);
    console.log(`  Overall Score: ${a.overallScore}`);
    console.log(`  Boundary: ${a.boundaryType} (${a.boundaryScore})`);
    console.log(`  Verification: ${a.verificationType || 'None'} (${a.verificationScore})`);
    
    // Test: Major O&G companies should have HIGH quality data
    if (a.overallScore === 'HIGH') {
      pass('Shell has HIGH quality score (expected for major O&G)');
    } else {
      warn('Shell quality', `Expected HIGH, got ${a.overallScore}`);
    }
    
    // Test: Should use standard boundary
    if (a.boundaryIsStandard) {
      pass('Shell uses standard organizational boundary');
    } else {
      fail('Shell boundary', `Non-standard boundary: ${a.boundaryType}`);
    }
    
    // Test: Should have verification for major company
    if (a.verificationScore === 'HIGH' || a.verificationScore === 'MEDIUM') {
      pass(`Shell has third-party verification (${a.verificationType})`);
    } else {
      warn('Shell verification', 'Major O&G company lacks verification');
    }
    
    // Test: Scope 3 methodology breakdown
    let hasScope3Data = false;
    let primaryDataCount = 0;
    let modeledDataCount = 0;
    
    console.log('\n  Scope 3 Methodology by Category:');
    for (let cat = 1; cat <= 15; cat++) {
      const s3 = a.scope3MethodQuality[cat];
      if (s3.value && s3.value > 0) {
        hasScope3Data = true;
        if (s3.methodTier === 'PRIMARY') primaryDataCount++;
        if (s3.methodTier === 'MODELED') modeledDataCount++;
        console.log(`    Cat ${cat}: ${s3.value.toLocaleString()} tCO2e - ${s3.methodTier} (${s3.method || 'unknown'})`);
      }
    }
    
    if (hasScope3Data) {
      pass('Shell has Scope 3 category data');
      console.log(`\n  Summary: ${primaryDataCount} PRIMARY, ${modeledDataCount} MODELED categories`);
    } else {
      fail('Shell Scope 3', 'No Scope 3 category data found');
    }
  }
}

// ============================================================
// SCENARIO 2: "Can I compare these two companies' emissions?"
// ============================================================
console.log('\n🔍 SCENARIO 2: "Can I compare these two companies\' emissions?"');
console.log('-'.repeat(70));

// Get two companies from the same sector
const oilGasCompanies = db.listCompanies({ sics_sub_sector: 'Oil & Gas', limit: 10 });
if (oilGasCompanies.data.length < 2) {
  fail('Find comparison companies', 'Not enough Oil & Gas companies');
} else {
  const company1 = oilGasCompanies.data[0];
  const company2 = oilGasCompanies.data[1];
  
  console.log(`\n  Comparing: ${company1.company_name} vs ${company2.company_name}`);
  
  const q1 = db.getCompanyQualityAssessment(company1.nz_id);
  const q2 = db.getCompanyQualityAssessment(company2.nz_id);
  
  if (q1.assessment && q2.assessment) {
    console.log(`\n  ${company1.company_name}:`);
    console.log(`    Boundary: ${q1.assessment.boundaryType}`);
    console.log(`    Overall: ${q1.assessment.overallScore}`);
    
    console.log(`\n  ${company2.company_name}:`);
    console.log(`    Boundary: ${q2.assessment.boundaryType}`);
    console.log(`    Overall: ${q2.assessment.overallScore}`);
    
    // Test compareDataQuality function
    const comparison = db.compareDataQuality([company1.nz_id, company2.nz_id]);
    
    // Check if warnings are generated for different boundaries
    const boundary1 = q1.assessment.boundaryType;
    const boundary2 = q2.assessment.boundaryType;
    
    if (boundary1 !== boundary2) {
      if (comparison.comparabilityWarnings.some(w => w.toLowerCase().includes('boundary'))) {
        pass('Correctly warns about different organizational boundaries');
      } else {
        fail('Boundary warning', 'Different boundaries but no warning generated');
      }
    } else {
      pass('Same organizational boundaries - comparable');
    }
    
    // Check methodology warnings
    if (comparison.comparabilityWarnings.length > 0) {
      console.log('\n  Comparability Warnings:');
      comparison.comparabilityWarnings.forEach(w => console.log(`    • ${w}`));
    }
  }
}

// ============================================================
// SCENARIO 3: "Has this company's methodology changed over time?"
// ============================================================
console.log('\n🔍 SCENARIO 3: "Has the methodology changed over time?"');
console.log('-'.repeat(70));

// Find a company with multiple years of data
const longHistoryCompanies = db.getCompaniesWithMinDisclosures(4, 50);
let foundMethodologyChange = false;

for (const c of longHistoryCompanies.slice(0, 20)) {
  const quality = db.getCompanyQualityAssessment(c.nz_id);
  
  if (quality.methodologyChanges && quality.methodologyChanges.length > 0) {
    console.log(`\n  Company: ${c.company_name} (${c.disclosure_count} years of data)`);
    console.log('  Methodology Changes Detected:');
    
    quality.methodologyChanges.forEach(mc => {
      console.log(`\n    Year ${mc.year}:`);
      mc.changes.forEach(change => {
        console.log(`      ${change.scope}: "${change.previousMethod || 'None'}" → "${change.currentMethod || 'None'}"`);
      });
    });
    
    pass('Methodology change tracking works');
    foundMethodologyChange = true;
    break;
  }
}

if (!foundMethodologyChange) {
  warn('Methodology changes', 'No companies with methodology changes found in sample');
}

// ============================================================
// SCENARIO 4: "What methodology did Company X use for Scope 3?"
// ============================================================
console.log('\n🔍 SCENARIO 4: "What methodology was used for Scope 3 Category 11?"');
console.log('-'.repeat(70));

// Category 11 = Use of Sold Products - most relevant for energy/auto companies
const energyCompanies = db.listCompanies({ sics_sub_sector: 'Oil & Gas', limit: 20 });

let foundCat11 = false;
for (const c of energyCompanies.data) {
  const quality = db.getCompanyQualityAssessment(c.nz_id);
  
  if (quality.assessment) {
    const cat11 = quality.assessment.scope3MethodQuality[11];
    if (cat11.value && cat11.value > 0) {
      console.log(`\n  Company: ${c.company_name}`);
      console.log(`  Category 11 (Use of Sold Products):`);
      console.log(`    Value: ${cat11.value.toLocaleString()} tCO2e`);
      console.log(`    Method: ${cat11.method || 'Not disclosed'}`);
      console.log(`    Tier: ${cat11.methodTier}`);
      console.log(`    Relevancy: ${cat11.relevancy || 'Not specified'}`);
      
      // For O&G, Cat 11 should typically be the largest category
      const allCatValues = Object.values(quality.assessment.scope3MethodQuality)
        .filter(c => c.value && c.value > 0)
        .map(c => c.value);
      
      const maxCatValue = Math.max(...allCatValues);
      
      if (cat11.value === maxCatValue) {
        pass('Category 11 is largest Scope 3 category (expected for O&G)');
      } else {
        warn('Category 11', `Not the largest category - largest is ${maxCatValue.toLocaleString()}`);
      }
      
      foundCat11 = true;
      break;
    }
  }
}

if (!foundCat11) {
  warn('Category 11 data', 'No O&G company with Category 11 data found');
}

// ============================================================
// SCENARIO 5: "Are there data quality warnings I should know about?"
// ============================================================
console.log('\n🔍 SCENARIO 5: "What data quality warnings should I know about?"');
console.log('-'.repeat(70));

// Find companies with warnings
let warningTypes = new Set();
let companiesWithWarnings = 0;

const sampleCompanies = db.listCompanies({ limit: 100 });
for (const c of sampleCompanies.data) {
  const quality = db.getCompanyQualityAssessment(c.nz_id);
  
  if (quality.assessment && quality.assessment.warnings.length > 0) {
    companiesWithWarnings++;
    quality.assessment.warnings.forEach(w => {
      // Categorize warnings
      if (w.includes('verification')) warningTypes.add('verification');
      if (w.includes('boundary')) warningTypes.add('boundary');
      if (w.includes('Scope 3')) warningTypes.add('scope3_methodology');
      if (w.includes('Methodology change')) warningTypes.add('methodology_changes');
    });
  }
}

console.log(`\n  Companies with warnings: ${companiesWithWarnings}/${sampleCompanies.data.length} (${(companiesWithWarnings/sampleCompanies.data.length*100).toFixed(0)}%)`);
console.log('  Warning types found:');
warningTypes.forEach(t => console.log(`    • ${t}`));

if (warningTypes.size >= 2) {
  pass('Multiple warning types detected');
} else {
  warn('Warning diversity', `Only ${warningTypes.size} warning type(s) found`);
}

// ============================================================
// SCENARIO 6: Edge case - Company with minimal disclosure
// ============================================================
console.log('\n🔍 SCENARIO 6: Edge case - Company with minimal disclosure');
console.log('-'.repeat(70));

// Find a company with only 1 year of data
const minimalCompanies = db.listCompanies({ limit: 500 });
for (const c of minimalCompanies.data) {
  const emissions = db.getCompanyEmissions(c.nz_id);
  if (emissions.length === 1) {
    console.log(`\n  Testing: ${c.company_name} (1 year of data only)`);
    
    const quality = db.getCompanyQualityAssessment(c.nz_id);
    if (quality.assessment) {
      console.log(`  Overall Score: ${quality.assessment.overallScore}`);
      console.log(`  Year: ${quality.assessment.year}`);
      
      // Should not have methodology change warnings (only 1 year)
      const hasMethodChange = quality.methodologyChanges.length > 0;
      if (!hasMethodChange) {
        pass('No methodology change warnings for single-year company');
      } else {
        fail('Edge case', 'Methodology changes shown for company with only 1 year');
      }
      break;
    }
  }
}

// ============================================================
// SCENARIO 7: Verify boundary score mapping
// ============================================================
console.log('\n🔍 SCENARIO 7: Verify boundary type to score mapping');
console.log('-'.repeat(70));

const boundaryMapping = {
  'Operational control': 'HIGH',
  'Financial control': 'HIGH',
  'Equity share': 'MEDIUM',
  'Company-defined': 'LOW'
};

let boundaryTestPassed = true;
const boundaryResults = {};

for (const c of db.listCompanies({ limit: 200 }).data) {
  const quality = db.getCompanyQualityAssessment(c.nz_id);
  if (quality.assessment && quality.assessment.boundaryType) {
    const bt = quality.assessment.boundaryType;
    const score = quality.assessment.boundaryScore;
    
    if (!boundaryResults[bt]) {
      boundaryResults[bt] = score;
      console.log(`  "${bt}" → ${score}`);
      
      const expected = boundaryMapping[bt];
      if (expected && score !== expected) {
        fail('Boundary mapping', `"${bt}" mapped to ${score}, expected ${expected}`);
        boundaryTestPassed = false;
      }
    }
  }
}

if (boundaryTestPassed && Object.keys(boundaryResults).length > 0) {
  pass('Boundary type scoring is consistent');
}

// ============================================================
// SCENARIO 8: Scope 3 methodology tier classification
// ============================================================
console.log('\n🔍 SCENARIO 8: Scope 3 methodology tier classification accuracy');
console.log('-'.repeat(70));

const primaryMethods = ['Supplier-specific', 'Hybrid', 'Asset-specific', 'Site-specific'];
const modeledMethods = ['Spend-based', 'Average-data', 'Distance-based', 'Average data', 'Spend based'];

let tierMismatch = false;
const methodToTierMap = {};

for (const c of db.listCompanies({ limit: 100 }).data) {
  const quality = db.getCompanyQualityAssessment(c.nz_id);
  if (quality.assessment) {
    for (let cat = 1; cat <= 15; cat++) {
      const s3 = quality.assessment.scope3MethodQuality[cat];
      if (s3.method && s3.methodTier) {
        const method = s3.method;
        const tier = s3.methodTier;
        
        if (!methodToTierMap[method]) {
          methodToTierMap[method] = tier;
          
          // Verify classification
          const isPrimary = primaryMethods.some(m => method.toLowerCase().includes(m.toLowerCase()));
          const isModeled = modeledMethods.some(m => method.toLowerCase().includes(m.toLowerCase()));
          
          if (isPrimary && tier !== 'PRIMARY') {
            console.log(`  ⚠️ "${method}" classified as ${tier}, expected PRIMARY`);
            tierMismatch = true;
          } else if (isModeled && tier !== 'MODELED') {
            console.log(`  ⚠️ "${method}" classified as ${tier}, expected MODELED`);
            tierMismatch = true;
          }
        }
      }
    }
  }
}

console.log('\n  Methods found and their tiers:');
Object.entries(methodToTierMap).slice(0, 10).forEach(([method, tier]) => {
  console.log(`    "${method}" → ${tier}`);
});

if (!tierMismatch) {
  pass('Scope 3 methodology tier classification appears correct');
} else {
  warn('Tier classification', 'Some method/tier mismatches found');
}

// ============================================================
// SUMMARY
// ============================================================
console.log('\n' + '='.repeat(80));
console.log('QUALITY TOOL TEST SUMMARY');
console.log('='.repeat(80));
console.log(`  ✅ Passed: ${passCount}`);
console.log(`  ❌ Failed: ${failCount}`);
console.log(`  Total tests: ${passCount + failCount}`);

if (issues.length > 0) {
  console.log('\n  Issues found:');
  issues.forEach(i => console.log(`    • ${i.test}: ${i.reason}`));
}

console.log('\n');
