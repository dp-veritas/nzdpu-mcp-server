#!/usr/bin/env node
/**
 * Test harness for NZDPU MCP Server - Knowledge/Educational capabilities
 */

import { 
  explainConcept, 
  listAvailableConcepts, 
  ghgConcepts,
  scope3Categories 
} from './dist/knowledge/concepts.js';

import { commonMistakes } from './dist/knowledge/comparability.js';

console.log('\n' + '='.repeat(70));
console.log('NZDPU MCP SERVER - KNOWLEDGE MODULE TESTS');
console.log('='.repeat(70) + '\n');

// Test 1: List available concepts
console.log('📚 TEST 1: nzdpu_learn - List available concepts');
console.log('-'.repeat(50));
const concepts = listAvailableConcepts();
console.log(`Available concepts: ${concepts.length}`);
concepts.forEach(c => console.log(`  • ${c}`));
console.log();

// Test 2: Explain a concept
console.log('📚 TEST 2: nzdpu_learn - Explain "scope1"');
console.log('-'.repeat(50));
const scope1Explanation = explainConcept('scope1');
console.log(scope1Explanation.substring(0, 500) + '...');
console.log();

// Test 3: Explain organizational_boundary
console.log('📚 TEST 3: nzdpu_learn - Explain "organizational_boundary"');
console.log('-'.repeat(50));
const boundaryExplanation = explainConcept('organizational_boundary');
console.log(boundaryExplanation.substring(0, 500) + '...');
console.log();

// Test 4: Scope 3 categories
console.log('📚 TEST 4: nzdpu_learn - Scope 3 categories overview');
console.log('-'.repeat(50));
console.log('All 15 Scope 3 categories:\n');
console.log('UPSTREAM (1-8):');
for (let i = 1; i <= 8; i++) {
  const cat = scope3Categories[i];
  console.log(`  ${i}. ${cat.name.replace(`Category ${i}: `, '')}`);
}
console.log('\nDOWNSTREAM (9-15):');
for (let i = 9; i <= 15; i++) {
  const cat = scope3Categories[i];
  console.log(`  ${i}. ${cat.name.replace(`Category ${i}: `, '')}`);
}
console.log();

// Test 5: Individual Scope 3 category detail
console.log('📚 TEST 5: nzdpu_learn - Scope 3 Category 11 details');
console.log('-'.repeat(50));
const cat11 = scope3Categories[11];
console.log(`Name: ${cat11.name}`);
console.log(`Definition: ${cat11.definition}`);
console.log(`Use Case: ${cat11.useCase}`);
if (cat11.examples) {
  console.log(`Examples:`);
  cat11.examples.forEach(e => console.log(`  • ${e}`));
}
console.log();

// Test 6: Common mistakes
console.log('📚 TEST 6: nzdpu_learn - Common mistakes in GHG analysis');
console.log('-'.repeat(50));
console.log(`Total common mistakes documented: ${commonMistakes.length}\n`);
commonMistakes.slice(0, 3).forEach((m, i) => {
  console.log(`${i + 1}. ${m.mistake}`);
  console.log(`   Why wrong: ${m.explanation.substring(0, 100)}...`);
  console.log(`   Fix: ${m.correction.substring(0, 100)}...`);
  console.log();
});
console.log();

// Test 7: GHG Concepts detail
console.log('📚 TEST 7: GHG Concepts structure');
console.log('-'.repeat(50));
const conceptKeys = Object.keys(ghgConcepts);
console.log(`Total GHG concepts defined: ${conceptKeys.length}`);
conceptKeys.slice(0, 5).forEach(key => {
  const c = ghgConcepts[key];
  console.log(`\n  ${key}:`);
  console.log(`    Name: ${c.name}`);
  console.log(`    Definition: ${c.definition.substring(0, 80)}...`);
});
console.log();

console.log('='.repeat(70));
console.log('KNOWLEDGE MODULE TESTS COMPLETED');
console.log('='.repeat(70) + '\n');
