#!/usr/bin/env node
/**
 * RIGOROUS REAL-WORLD TESTING: nzdpu_learn tool
 * Tests realistic educational queries and verifies accuracy of content
 */

import { 
  explainConcept, 
  listAvailableConcepts, 
  ghgConcepts,
  scope3Categories 
} from './dist/knowledge/concepts.js';

import { commonMistakes } from './dist/knowledge/comparability.js';

console.log('\n' + '='.repeat(80));
console.log('RIGOROUS LEARN TOOL TESTING - Real-World Educational Queries');
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
// SCENARIO 1: "What is Scope 1?" - Basic concept lookup
// ============================================================
console.log('\n📚 SCENARIO 1: "What is Scope 1?"');
console.log('-'.repeat(70));

const scope1 = explainConcept('scope1');

// Verify key GHG Protocol elements are present
const scope1Requirements = [
  { term: 'direct', reason: 'Scope 1 is about DIRECT emissions' },
  { term: 'owned or controlled', reason: 'Must mention ownership/control' },
  { term: 'combustion', reason: 'Common example of Scope 1' }
];

let scope1Passes = 0;
scope1Requirements.forEach(req => {
  if (scope1.toLowerCase().includes(req.term)) {
    pass(`Scope 1 explanation includes "${req.term}"`);
    scope1Passes++;
  } else {
    fail(`Scope 1 content`, `Missing key term: "${req.term}" - ${req.reason}`);
  }
});

// Verify it doesn't include incorrect info
if (scope1.toLowerCase().includes('indirect')) {
  warn('Scope 1 accuracy', 'Contains "indirect" which may confuse users (Scope 1 is direct)');
}

// ============================================================
// SCENARIO 2: "What's the difference between location-based and market-based Scope 2?"
// ============================================================
console.log('\n📚 SCENARIO 2: "Location-based vs Market-based Scope 2"');
console.log('-'.repeat(70));

const lb = explainConcept('scope2_location_based');
const mb = explainConcept('scope2_market_based');

// Location-based requirements
const lbRequirements = ['grid', 'average', 'emission factor'];
const mbRequirements = ['contract', 'renewable', 'REC', 'PPA'];

let lbScore = 0;
lbRequirements.forEach(term => {
  if (lb.toLowerCase().includes(term.toLowerCase())) {
    lbScore++;
  }
});

let mbScore = 0;
mbRequirements.forEach(term => {
  if (mb.toLowerCase().includes(term.toLowerCase())) {
    mbScore++;
  }
});

if (lbScore >= 2) {
  pass(`Location-based explanation mentions ${lbScore}/${lbRequirements.length} key terms`);
} else {
  fail('LB explanation', `Only ${lbScore}/${lbRequirements.length} key terms found`);
}

if (mbScore >= 2) {
  pass(`Market-based explanation mentions ${mbScore}/${mbRequirements.length} key terms`);
} else {
  fail('MB explanation', `Only ${mbScore}/${mbRequirements.length} key terms found`);
}

// Critical: explanations should be different
if (lb === mb) {
  fail('LB vs MB', 'Explanations are identical - should be different!');
} else {
  pass('LB and MB have distinct explanations');
}

// ============================================================
// SCENARIO 3: "Explain Scope 3 Category 11" (Use of Sold Products)
// ============================================================
console.log('\n📚 SCENARIO 3: "Explain Scope 3 Category 11"');
console.log('-'.repeat(70));

const cat11 = scope3Categories[11];

if (!cat11) {
  fail('Category 11', 'Category 11 not found in scope3Categories');
} else {
  console.log(`  Name: ${cat11.name}`);
  console.log(`  Definition: ${cat11.definition}`);
  console.log(`  Use Case: ${cat11.useCase}`);
  
  // Verify correctness - Cat 11 is about downstream product use
  if (cat11.definition.toLowerCase().includes('use') && 
      cat11.definition.toLowerCase().includes('sold')) {
    pass('Category 11 definition is about use of sold products');
  } else {
    fail('Category 11 definition', 'Does not clearly describe use of sold products');
  }
  
  // Should mention it's relevant for energy-using products
  if (cat11.examples && cat11.examples.some(e => 
    e.toLowerCase().includes('vehicle') || 
    e.toLowerCase().includes('energy') ||
    e.toLowerCase().includes('fuel'))) {
    pass('Category 11 includes relevant examples (vehicles/energy/fuel)');
  } else {
    warn('Category 11 examples', 'Missing key examples like vehicles or fuel consumption');
  }
}

// ============================================================
// SCENARIO 4: Verify all 15 Scope 3 categories are complete
// ============================================================
console.log('\n📚 SCENARIO 4: All 15 Scope 3 categories completeness check');
console.log('-'.repeat(70));

const expectedCategories = [
  { num: 1, name: 'Purchased Goods and Services', direction: 'upstream' },
  { num: 2, name: 'Capital Goods', direction: 'upstream' },
  { num: 3, name: 'Fuel and Energy', direction: 'upstream' },
  { num: 4, name: 'Upstream Transportation', direction: 'upstream' },
  { num: 5, name: 'Waste', direction: 'upstream' },
  { num: 6, name: 'Business Travel', direction: 'upstream' },
  { num: 7, name: 'Employee Commuting', direction: 'upstream' },
  { num: 8, name: 'Upstream Leased Assets', direction: 'upstream' },
  { num: 9, name: 'Downstream Transportation', direction: 'downstream' },
  { num: 10, name: 'Processing of Sold Products', direction: 'downstream' },
  { num: 11, name: 'Use of Sold Products', direction: 'downstream' },
  { num: 12, name: 'End-of-Life', direction: 'downstream' },
  { num: 13, name: 'Downstream Leased Assets', direction: 'downstream' },
  { num: 14, name: 'Franchises', direction: 'downstream' },
  { num: 15, name: 'Investments', direction: 'downstream' }
];

let missingCategories = [];
let incompleteCategories = [];

expectedCategories.forEach(expected => {
  const cat = scope3Categories[expected.num];
  
  if (!cat) {
    missingCategories.push(expected.num);
  } else {
    // Check completeness
    if (!cat.name || !cat.definition) {
      incompleteCategories.push({ num: expected.num, missing: !cat.name ? 'name' : 'definition' });
    }
    
    // Verify name roughly matches
    const nameParts = expected.name.toLowerCase().split(' ');
    const nameMatch = nameParts.some(part => cat.name.toLowerCase().includes(part));
    if (!nameMatch) {
      console.log(`  ⚠️ Cat ${expected.num}: Expected "${expected.name}", got "${cat.name}"`);
    }
  }
});

if (missingCategories.length === 0) {
  pass('All 15 Scope 3 categories are defined');
} else {
  fail('Scope 3 categories', `Missing categories: ${missingCategories.join(', ')}`);
}

if (incompleteCategories.length === 0) {
  pass('All categories have name and definition');
} else {
  fail('Category completeness', `Incomplete: ${incompleteCategories.map(c => `Cat ${c.num} missing ${c.missing}`).join(', ')}`);
}

// ============================================================
// SCENARIO 5: "What are common mistakes in GHG analysis?"
// ============================================================
console.log('\n📚 SCENARIO 5: "What are common mistakes in GHG analysis?"');
console.log('-'.repeat(70));

if (!commonMistakes || commonMistakes.length === 0) {
  fail('Common mistakes', 'No common mistakes defined');
} else {
  console.log(`  Found ${commonMistakes.length} common mistakes documented:`);
  
  // Critical mistakes that MUST be included
  const requiredMistakes = [
    'location-based.*market-based|market-based.*location-based|LB.*MB|Scope 2',
    'boundary|organizational',
    'Scope 3|category'
  ];
  
  let foundRequired = 0;
  requiredMistakes.forEach(pattern => {
    const regex = new RegExp(pattern, 'i');
    const found = commonMistakes.some(m => regex.test(m.mistake) || regex.test(m.explanation));
    if (found) {
      foundRequired++;
    } else {
      console.log(`  ⚠️ Missing mistake about: ${pattern}`);
    }
  });
  
  if (foundRequired >= 2) {
    pass(`${foundRequired}/${requiredMistakes.length} critical mistakes documented`);
  } else {
    fail('Critical mistakes', `Only ${foundRequired}/${requiredMistakes.length} critical mistakes found`);
  }
  
  // Verify each mistake has all required fields
  let completeCount = 0;
  commonMistakes.forEach((m, i) => {
    if (m.mistake && m.explanation && m.correction) {
      completeCount++;
    } else {
      console.log(`  ⚠️ Mistake ${i + 1} missing fields`);
    }
  });
  
  if (completeCount === commonMistakes.length) {
    pass('All mistakes have: mistake, explanation, and correction');
  } else {
    fail('Mistake completeness', `${commonMistakes.length - completeCount} mistakes have missing fields`);
  }
  
  // Show the mistakes
  commonMistakes.forEach((m, i) => {
    console.log(`\n  ${i + 1}. ${m.mistake}`);
  });
}

// ============================================================
// SCENARIO 6: "What does organizational boundary mean?"
// ============================================================
console.log('\n📚 SCENARIO 6: "What does organizational boundary mean?"');
console.log('-'.repeat(70));

const boundary = explainConcept('organizational_boundary');

// Must mention the three GHG Protocol approaches
const boundaryApproaches = ['equity', 'financial control', 'operational control'];
let approachesFound = 0;

boundaryApproaches.forEach(approach => {
  if (boundary.toLowerCase().includes(approach)) {
    approachesFound++;
  }
});

if (approachesFound >= 2) {
  pass(`Organizational boundary mentions ${approachesFound}/3 standard approaches`);
} else {
  fail('Boundary approaches', `Only ${approachesFound}/3 approaches mentioned`);
}

// Should explain why it matters
if (boundary.toLowerCase().includes('report') || boundary.toLowerCase().includes('includ')) {
  pass('Explains impact on what emissions are reported/included');
} else {
  warn('Boundary relevance', 'May not clearly explain why boundary choice matters');
}

// ============================================================
// SCENARIO 7: Edge case - Invalid concept lookup
// ============================================================
console.log('\n📚 SCENARIO 7: Edge case - Invalid concept lookup');
console.log('-'.repeat(70));

const invalidConcept = explainConcept('not_a_real_concept');

// Should return something meaningful (error message or suggestion)
if (invalidConcept) {
  console.log(`  Response to invalid concept: "${invalidConcept.substring(0, 100)}..."`);
  
  if (invalidConcept.toLowerCase().includes('not found') || 
      invalidConcept.toLowerCase().includes('unknown') ||
      invalidConcept.toLowerCase().includes('available')) {
    pass('Invalid concept returns helpful error/suggestion');
  } else {
    warn('Invalid concept handling', 'Response may not clearly indicate concept not found');
  }
} else {
  fail('Invalid concept', 'Returns null/undefined instead of error message');
}

// ============================================================
// SCENARIO 8: Verify concept consistency across the system
// ============================================================
console.log('\n📚 SCENARIO 8: Concept consistency check');
console.log('-'.repeat(70));

const availableConcepts = listAvailableConcepts();
const ghgConceptKeys = Object.keys(ghgConcepts);

console.log(`  Available concepts: ${availableConcepts.length}`);
console.log(`  GHG concept definitions: ${ghgConceptKeys.length}`);

// Check that all listed concepts can be explained
let unexplainableConcepts = [];
availableConcepts.forEach(concept => {
  const explanation = explainConcept(concept);
  if (!explanation || explanation.length < 50) {
    unexplainableConcepts.push(concept);
  }
});

if (unexplainableConcepts.length === 0) {
  pass('All listed concepts have substantive explanations');
} else {
  fail('Concept coverage', `Concepts without good explanations: ${unexplainableConcepts.join(', ')}`);
}

// ============================================================
// SCENARIO 9: Technical accuracy - Scope 2 methods
// ============================================================
console.log('\n📚 SCENARIO 9: Technical accuracy of Scope 2 explanation');
console.log('-'.repeat(70));

const scope2LBConcept = ghgConcepts.scope2_location_based;
const scope2MBConcept = ghgConcepts.scope2_market_based;

// Technical accuracy checks
if (scope2LBConcept) {
  console.log('\n  Location-Based Method:');
  console.log(`    Definition: ${scope2LBConcept.definition.substring(0, 150)}...`);
  
  // LB must mention grid emission factors
  if (scope2LBConcept.definition.toLowerCase().includes('grid')) {
    pass('LB correctly mentions grid emission factors');
  } else {
    fail('LB technical accuracy', 'Does not mention grid emission factors');
  }
}

if (scope2MBConcept) {
  console.log('\n  Market-Based Method:');
  console.log(`    Definition: ${scope2MBConcept.definition.substring(0, 150)}...`);
  
  // MB must mention contractual instruments
  const mbKeyTerms = ['contract', 'certificate', 'instrument', 'supplier'];
  const mbHasTerm = mbKeyTerms.some(t => scope2MBConcept.definition.toLowerCase().includes(t));
  
  if (mbHasTerm) {
    pass('MB correctly mentions contractual aspects');
  } else {
    fail('MB technical accuracy', 'Does not mention contractual instruments');
  }
}

// ============================================================
// SCENARIO 10: Verify Scope 3 category numbers match GHG Protocol
// ============================================================
console.log('\n📚 SCENARIO 10: Scope 3 category numbering accuracy');
console.log('-'.repeat(70));

// GHG Protocol official category numbers/names
const ghgProtocolCategories = {
  1: 'Purchased goods and services',
  2: 'Capital goods',
  3: 'Fuel- and energy-related activities',
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
  15: 'Investments'
};

let categoryMatchErrors = [];

Object.entries(ghgProtocolCategories).forEach(([num, officialName]) => {
  const catNum = parseInt(num);
  const ourCat = scope3Categories[catNum];
  
  if (!ourCat) {
    categoryMatchErrors.push(`Cat ${num}: Missing`);
    return;
  }
  
  // Check if our name substantially matches official name
  const officialWords = officialName.toLowerCase().split(/[\s-]+/).filter(w => w.length > 3);
  const ourWords = ourCat.name.toLowerCase();
  
  const matchingWords = officialWords.filter(w => ourWords.includes(w));
  
  if (matchingWords.length < officialWords.length / 2) {
    categoryMatchErrors.push(`Cat ${num}: "${ourCat.name}" vs official "${officialName}"`);
  }
});

if (categoryMatchErrors.length === 0) {
  pass('All Scope 3 categories match GHG Protocol naming');
} else {
  console.log('  Category naming discrepancies:');
  categoryMatchErrors.forEach(e => console.log(`    • ${e}`));
  
  if (categoryMatchErrors.length <= 2) {
    warn('Category naming', `${categoryMatchErrors.length} minor naming differences`);
  } else {
    fail('Category naming', `${categoryMatchErrors.length} categories don't match GHG Protocol`);
  }
}

// ============================================================
// SUMMARY
// ============================================================
console.log('\n' + '='.repeat(80));
console.log('LEARN TOOL TEST SUMMARY');
console.log('='.repeat(80));
console.log(`  ✅ Passed: ${passCount}`);
console.log(`  ❌ Failed: ${failCount}`);
console.log(`  Total tests: ${passCount + failCount}`);

if (issues.length > 0) {
  console.log('\n  Issues found:');
  issues.forEach(i => console.log(`    • ${i.test}: ${i.reason}`));
}

console.log('\n');
