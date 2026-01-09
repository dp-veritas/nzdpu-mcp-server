/**
 * Advanced GHG Accounting Knowledge Base
 * 
 * Topics covered:
 * 1. Double Counting Prevention
 * 2. Reporting Frameworks
 * 3. Emission Factor Sources
 * 4. Base Years & Recalculation
 * 
 * Sources: NZDPU Core Data Model, Data Governance Framework, GHG Protocol
 */

// ==================== DOUBLE COUNTING PREVENTION ====================

export interface DoubleCoutingRule {
  rule: string;
  explanation: string;
  correctApproach: string;
  examples?: string[];
}

export interface CategoryOverlap {
  categories: [number | string, number | string];
  explanation: string;
  resolution: string;
}

export const doubleCounting = {
  scope2: {
    rule: 'Never sum Scope 2 Location-Based and Market-Based emissions',
    explanation: 
      'Location-based and market-based Scope 2 represent the SAME electricity consumption ' +
      'measured using different methodologies. Location-based uses grid-average emission factors, ' +
      'while market-based uses contractual instruments (RECs, PPAs). Summing them would count ' +
      'the same electricity twice.',
    correctApproach: 
      'Report both values separately. Compare only within the same methodology ' +
      '(LB to LB, or MB to MB). For total emissions reporting, use one or the other, not both.',
    examples: [
      'WRONG: Total Scope 2 = 50,000 (LB) + 10,000 (MB) = 60,000 tCO₂e',
      'CORRECT: Report Scope 2 LB: 50,000 tCO₂e AND Scope 2 MB: 10,000 tCO₂e separately',
      'For combined Scope 1+2 totals, choose one methodology consistently'
    ]
  },
  
  scope3CategoryOverlaps: [
    {
      categories: ['Category 3', 'Scope 1/2'] as [string, string],
      explanation: 
        'Category 3 (Fuel- and Energy-Related Activities) includes upstream emissions from ' +
        'purchased fuels and electricity, plus transmission & distribution losses. These are ' +
        'distinct from direct combustion (Scope 1) and purchased electricity (Scope 2).',
      resolution: 
        'No double counting if properly classified. Cat 3 = well-to-tank emissions + T&D losses. ' +
        'Scope 1 = combustion emissions. Scope 2 = generation emissions.'
    },
    {
      categories: ['Category 4', 'Category 9'] as [string, string],
      explanation: 
        'Category 4 (Upstream Transportation) covers inbound logistics of purchased products. ' +
        'Category 9 (Downstream Transportation) covers outbound logistics of sold products. ' +
        'The boundary is the reporting company.',
      resolution: 
        'Ensure clear handoff point. Products purchased = Cat 4. Products sold = Cat 9. ' +
        'Internal transfers between facilities are typically Scope 1 or 3 depending on vehicle ownership.'
    },
    {
      categories: ['Category 8', 'Category 13'] as [string, string],
      explanation: 
        'Category 8 (Upstream Leased Assets) covers assets leased BY the company. ' +
        'Category 13 (Downstream Leased Assets) covers assets leased TO others. ' +
        'Double counting occurs if lease classification is inconsistent.',
      resolution: 
        'Apply consistent organizational boundary approach. Under operational control, ' +
        'lessor reports Cat 13; lessee reports Cat 8. Cannot both claim Scope 1/2 for same asset.'
    },
    {
      categories: ['Category 1', 'Category 2'] as [string, string],
      explanation: 
        'Category 1 (Purchased Goods & Services) covers operational purchases. ' +
        'Category 2 (Capital Goods) covers capital purchases. The distinction is accounting treatment.',
      resolution: 
        'Follow financial accounting classifications. Expensed items = Cat 1. ' +
        'Capitalized/depreciated items = Cat 2. Do not report same purchase in both.'
    },
    {
      categories: ['Category 11', 'Category 12'] as [string, string],
      explanation: 
        'Category 11 (Use of Sold Products) covers emissions during product use phase. ' +
        'Category 12 (End-of-Life Treatment) covers disposal emissions. ' +
        'These are sequential lifecycle stages, not overlapping.',
      resolution: 
        'Cat 11 ends when product is discarded. Cat 12 begins at disposal. ' +
        'For fuel products, Cat 11 = combustion by end user. Cat 12 typically minimal.'
    }
  ],
  
  valueChainBoundaries: {
    issue: 
      'One company\'s Scope 3 emissions overlap with another company\'s Scope 1 or 2. ' +
      'For example, a retailer\'s Category 1 (purchased goods) includes a manufacturer\'s Scope 1.',
    guidance: 
      'This overlap is INTENTIONAL and not considered double counting at the entity level. ' +
      'Each company reports emissions from its own perspective. The GHG Protocol explicitly ' +
      'allows this to ensure all value chain emissions are visible to each participant.',
    comparabilityNote: 
      'When aggregating emissions across multiple companies (e.g., portfolio), ' +
      'adjustments may be needed to avoid double counting. PCAF provides guidance for financed emissions.'
  },
  
  totalEmissionsCalculation: {
    correct: 'Scope 1 + Scope 2 (choose LB or MB, not both) + Scope 3 Total',
    incorrect: [
      'Scope 1 + Scope 2 LB + Scope 2 MB + Scope 3 (double counts Scope 2)',
      'Scope 1 + Scope 2 + sum of all Scope 3 categories when categories overlap'
    ],
    recommendation: 
      'For reporting total emissions, use Scope 2 Location-Based unless the purpose ' +
      'specifically requires market-based (e.g., tracking renewable energy impact).'
  }
};

// ==================== REPORTING FRAMEWORKS ====================

export interface FrameworkInfo {
  name: string;
  fullName: string;
  type: 'mandatory' | 'voluntary' | 'sector-specific';
  jurisdiction: string;
  ghgScope: string;
  ghgProtocolAlignment: string;
  keyRequirements: string[];
  effectiveDate?: string;
  notes?: string;
}

export const reportingFrameworks: Record<string, FrameworkInfo> = {
  // Mandatory Frameworks
  'IFRS S2': {
    name: 'IFRS S2',
    fullName: 'IFRS S2 Climate-related Disclosures',
    type: 'mandatory',
    jurisdiction: 'Global (ISSB - jurisdiction-dependent adoption)',
    ghgScope: 'Scope 1, 2, and 3 for material categories',
    ghgProtocolAlignment: 'Required - must follow GHG Protocol Corporate Standard',
    keyRequirements: [
      'Absolute gross GHG emissions (Scope 1, 2, 3)',
      'Scope 2 using location-based approach; market-based if material',
      'Scope 3 for all material categories',
      'Climate-related transition and physical risks',
      'Climate resilience scenario analysis'
    ],
    effectiveDate: 'Annual periods beginning on or after 1 January 2024',
    notes: 'Consolidates TCFD recommendations. Adoption varies by jurisdiction (UK, Canada, Japan, Singapore, etc.)'
  },
  
  'ESRS E1': {
    name: 'ESRS E1',
    fullName: 'European Sustainability Reporting Standards - Climate Change',
    type: 'mandatory',
    jurisdiction: 'European Union (CSRD)',
    ghgScope: 'Scope 1, 2, and 3 with detailed category breakdown',
    ghgProtocolAlignment: 'Required - aligned with GHG Protocol',
    keyRequirements: [
      'Gross Scope 1, 2, 3 GHG emissions',
      'Scope 2 both location-based and market-based',
      'All 15 Scope 3 categories (material ones in detail)',
      'GHG intensity per net revenue',
      'GHG emission reduction targets',
      'Prior period error restatement required'
    ],
    effectiveDate: 'FY 2024 for large companies; phased for others',
    notes: 'Part of EU CSRD. Requires double materiality assessment. Links to EU Taxonomy.'
  },
  
  'SEC Climate': {
    name: 'SEC Climate Rules',
    fullName: 'SEC Climate-Related Disclosure Rules',
    type: 'mandatory',
    jurisdiction: 'United States',
    ghgScope: 'Scope 1 and 2 required; Scope 3 if material or in targets',
    ghgProtocolAlignment: 'Required - must use GHG Protocol',
    keyRequirements: [
      'Scope 1 and 2 emissions (phased attestation)',
      'Scope 3 only if material or included in targets',
      'Climate risk disclosure in Form 10-K',
      'Board oversight and governance',
      'Transition plan if disclosed'
    ],
    effectiveDate: 'Phased 2025-2027 (currently partially stayed)',
    notes: 'Subject to legal challenges. Scope 3 requirements less stringent than ISSB/ESRS.'
  },
  
  // Voluntary Frameworks
  'CDP': {
    name: 'CDP',
    fullName: 'CDP Climate Change Questionnaire',
    type: 'voluntary',
    jurisdiction: 'Global',
    ghgScope: 'Scope 1, 2, and all 15 Scope 3 categories',
    ghgProtocolAlignment: 'Aligned - questions reference GHG Protocol',
    keyRequirements: [
      'Organization profile and governance',
      'Risks and opportunities assessment',
      'Scope 1, 2 (LB and MB), and Scope 3 emissions',
      'Methodology and verification status per scope',
      'Emissions targets and progress',
      'Carbon pricing and climate-related projects'
    ],
    notes: 'Investor-requested disclosure. Scores A to D-. Data used by NZDPU as primary source.'
  },
  
  'GRI 305': {
    name: 'GRI 305',
    fullName: 'GRI 305: Emissions 2016',
    type: 'voluntary',
    jurisdiction: 'Global',
    ghgScope: 'Scope 1, 2 (LB and MB), Scope 3, and other significant emissions',
    ghgProtocolAlignment: 'References GHG Protocol for methodology',
    keyRequirements: [
      'GRI 305-1: Direct (Scope 1) GHG emissions',
      'GRI 305-2: Energy indirect (Scope 2) GHG emissions',
      'GRI 305-3: Other indirect (Scope 3) GHG emissions',
      'GRI 305-4: GHG emissions intensity',
      'GRI 305-5: Reduction of GHG emissions',
      'Base year, gases included, emission factors, consolidation approach'
    ],
    notes: 'Part of GRI Universal Standards. Often used alongside SASB for sustainability reports.'
  },
  
  'TCFD': {
    name: 'TCFD',
    fullName: 'Task Force on Climate-related Financial Disclosures',
    type: 'voluntary',
    jurisdiction: 'Global',
    ghgScope: 'Scope 1, 2, and material Scope 3',
    ghgProtocolAlignment: 'Recommends GHG Protocol',
    keyRequirements: [
      'Governance: Board and management oversight',
      'Strategy: Climate risks, opportunities, scenario analysis',
      'Risk Management: Identification, assessment, management processes',
      'Metrics & Targets: GHG emissions, climate-related metrics, targets'
    ],
    notes: 'Foundational framework. Being superseded by ISSB but remains widely referenced.'
  },
  
  'SBTi': {
    name: 'SBTi',
    fullName: 'Science Based Targets initiative',
    type: 'voluntary',
    jurisdiction: 'Global',
    ghgScope: 'Scope 1, 2 required; Scope 3 if >40% of total',
    ghgProtocolAlignment: 'Required - must use GHG Protocol',
    keyRequirements: [
      'Near-term targets (5-10 years) aligned to 1.5°C',
      'Long-term/net-zero targets for 2050',
      'Scope 3 included if >40% of total emissions',
      'Annual progress reporting',
      'Recalculation policy for base year'
    ],
    notes: 'Validates corporate emissions reduction targets. Increasingly required by investors.'
  },
  
  // Sector-Specific / Financed Emissions
  'PCAF': {
    name: 'PCAF',
    fullName: 'Partnership for Carbon Accounting Financials',
    type: 'sector-specific',
    jurisdiction: 'Global (Financial Sector)',
    ghgScope: 'Financed emissions (Scope 3 Category 15)',
    ghgProtocolAlignment: 'Built on GHG Protocol Scope 3 Category 15',
    keyRequirements: [
      'Financed emissions for AUM and lending portfolios',
      'Data quality score (1-5, where 1 is highest quality)',
      'Asset class-specific methodologies',
      'Coverage disclosure (% of portfolio measured)',
      'Attribution based on financing share'
    ],
    notes: 'Standard for financial institutions. NZDPU Core Data Model aligns with PCAF data quality scoring.'
  }
};

// ==================== EMISSION FACTOR SOURCES ====================

export interface EmissionFactorTier {
  tier: number;
  name: string;
  description: string;
  quality: 'HIGH' | 'MEDIUM' | 'LOW';
  typicalUse: string;
  limitations: string;
}

export interface EmissionFactorDatabase {
  name: string;
  publisher: string;
  jurisdiction: string;
  updateFrequency: string;
  coverage: string;
  url?: string;
  notes?: string;
}

export const emissionFactorHierarchy: EmissionFactorTier[] = [
  {
    tier: 1,
    name: 'Primary / Supplier-Specific Data',
    description: 
      'Direct emissions data from specific suppliers, products, or activities. ' +
      'Measured or calculated at the source with actual activity data.',
    quality: 'HIGH',
    typicalUse: 'Material Scope 3 categories, key suppliers, high-impact activities',
    limitations: 'Requires supplier engagement. Data collection intensive.'
  },
  {
    tier: 2,
    name: 'Product-Level Factors (LCA Databases)',
    description: 
      'Emission factors derived from life cycle assessments of specific products or materials. ' +
      'Examples: ecoinvent, GaBi, GREET.',
    quality: 'HIGH',
    typicalUse: 'Category 1 (purchased goods), Category 11 (use of sold products)',
    limitations: 'Database licenses can be costly. Requires product-level data.'
  },
  {
    tier: 3,
    name: 'Industry-Average Factors',
    description: 
      'Sector or industry average emission factors from government or industry bodies. ' +
      'Examples: DEFRA, EPA, IPCC defaults.',
    quality: 'MEDIUM',
    typicalUse: 'Screening assessments, less material categories, fallback when Tier 1-2 unavailable',
    limitations: 'May not reflect specific supply chain characteristics. Updated annually.'
  },
  {
    tier: 4,
    name: 'Spend-Based / EEIO Factors',
    description: 
      'Economic input-output emission factors based on monetary spend. ' +
      'Converts $ spent to emissions using sector averages.',
    quality: 'LOW',
    typicalUse: 'Initial screening, non-material categories, when no activity data available',
    limitations: 
      'Lowest accuracy. Does not capture supplier-specific actions. ' +
      'Inflation and currency effects distort trends.'
  }
];

export const majorEmissionFactorDatabases: Record<string, EmissionFactorDatabase> = {
  'DEFRA': {
    name: 'UK Government GHG Conversion Factors',
    publisher: 'UK Department for Environment, Food & Rural Affairs',
    jurisdiction: 'UK (used globally)',
    updateFrequency: 'Annual (typically June)',
    coverage: 
      'Comprehensive: fuels, electricity, transport, freight, waste, water, materials, ' +
      'refrigerants, business travel, hotel stays',
    url: 'https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting',
    notes: 'Most widely used international emission factor set. Free to access.'
  },
  
  'EPA': {
    name: 'US EPA Emission Factors Hub',
    publisher: 'US Environmental Protection Agency',
    jurisdiction: 'United States',
    updateFrequency: 'Varies by category (eGRID annual)',
    coverage: 
      'Electricity (eGRID), stationary combustion, mobile sources, waste, refrigerants',
    url: 'https://www.epa.gov/climateleadership/ghg-emission-factors-hub',
    notes: 'Essential for US operations. eGRID provides subregional electricity factors.'
  },
  
  'IEA': {
    name: 'IEA Emission Factors',
    publisher: 'International Energy Agency',
    jurisdiction: 'Global (country-specific)',
    updateFrequency: 'Annual',
    coverage: 'Electricity and heat generation by country',
    notes: 'Gold standard for country-level electricity emission factors.'
  },
  
  'ecoinvent': {
    name: 'ecoinvent Database',
    publisher: 'ecoinvent Association',
    jurisdiction: 'Global',
    updateFrequency: 'Major versions every 2-3 years',
    coverage: 
      'Over 18,000 LCA datasets covering agriculture, energy, transport, materials, ' +
      'chemicals, construction, electronics, waste treatment',
    notes: 'Industry-leading LCA database. Commercial license required.'
  },
  
  'GaBi': {
    name: 'GaBi Databases',
    publisher: 'Sphera (formerly thinkstep)',
    jurisdiction: 'Global',
    updateFrequency: 'Continuous updates',
    coverage: 
      'Comprehensive LCA datasets for energy, transport, metals, plastics, chemicals, ' +
      'electronics, buildings',
    notes: 'Commercial LCA tool and database. Used for product carbon footprints.'
  },
  
  'IPCC': {
    name: 'IPCC Emission Factor Database',
    publisher: 'Intergovernmental Panel on Climate Change',
    jurisdiction: 'Global (default factors)',
    updateFrequency: 'Per IPCC Assessment Report cycle',
    coverage: 
      'Default emission factors for national GHG inventories: energy, industrial processes, ' +
      'agriculture, LULUCF, waste',
    url: 'https://www.ipcc-nggip.iges.or.jp/EFDB/',
    notes: 'Tier 1 defaults. Use when country-specific factors unavailable.'
  },
  
  'GLEC': {
    name: 'GLEC Framework',
    publisher: 'Smart Freight Centre',
    jurisdiction: 'Global',
    updateFrequency: 'Periodic revisions',
    coverage: 'Logistics and freight transport (road, rail, sea, air, warehousing)',
    notes: 'ISO 14083 aligned. Best practice for transport emissions (Cat 4, 9).'
  },
  
  'EXIOBASE': {
    name: 'EXIOBASE',
    publisher: 'EU-funded research consortium',
    jurisdiction: 'Global (49 regions)',
    updateFrequency: 'Periodic',
    coverage: 'Multi-regional input-output database for spend-based calculations',
    notes: 'Academic/research focused. Useful for Scope 3 screening.'
  }
};

export const nzdpuEmissionFactorContext = {
  priority: 
    'NZDPU prioritizes reported (disclosed) data over third-party estimated, predicted, ' +
    'observed, or modeled data, consistent with the CDSC White Paper recommendations.',
  
  transparencyRequirement: 
    'For sources that combine reported with estimated data (especially Scope 3), ' +
    'NZDPU provides transparency into source methodology, including clear labels for ' +
    'data containing estimates and the type of estimation used.',
  
  qualityIndicators: 
    'NZDPU Core Data Model includes methodology fields per scope and category to help ' +
    'users assess data quality and comparability.',
  
  pcafAlignment: 
    'For financed emissions (Category 15), NZDPU aligns with PCAF data quality scoring ' +
    '(1-5 scale) to indicate the certainty of reported emissions.'
};

// ==================== BASE YEARS & RECALCULATION ====================

export interface RecalculationTrigger {
  trigger: string;
  description: string;
  ghgProtocolGuidance: string;
}

export const baseYearRecalculation = {
  purpose: {
    definition: 
      'A base year is the historical reference point against which a company measures ' +
      'and tracks changes in GHG emissions over time.',
    importance: [
      'Enables meaningful year-over-year trend analysis',
      'Required for setting and tracking reduction targets',
      'Provides consistent benchmark for performance assessment',
      'Required by SBTi, ISSB, ESRS for target validation'
    ],
    selection: 
      'Choose a year with reliable, verifiable data that represents typical operations. ' +
      'Many companies use the earliest year with complete Scope 1, 2, and material Scope 3 data.'
  },
  
  recalculationTriggers: [
    {
      trigger: 'Structural changes',
      description: 'Mergers, acquisitions, divestitures, outsourcing, or insourcing',
      ghgProtocolGuidance: 
        'Recalculate base year if the change would have affected emissions by more than ' +
        'the significance threshold (typically 5-10% of total emissions).'
    },
    {
      trigger: 'Methodology changes',
      description: 'Changes to calculation methodology, emission factors, or activity data',
      ghgProtocolGuidance: 
        'Recalculate if the change significantly improves accuracy or reflects ' +
        'updated scientific understanding (e.g., new GWP values).'
    },
    {
      trigger: 'Error corrections',
      description: 'Discovery of significant errors in historical data',
      ghgProtocolGuidance: 
        'Recalculate base year to correct material errors. Document the nature and impact.'
    },
    {
      trigger: 'Category boundary changes',
      description: 'Inclusion of previously excluded Scope 3 categories or activities',
      ghgProtocolGuidance: 
        'Recalculate if material categories are added to the inventory boundary.'
    },
    {
      trigger: 'Organic growth/decline',
      description: 'Significant changes in production, facilities, or operations',
      ghgProtocolGuidance: 
        'Organic growth generally does NOT trigger recalculation. ' +
        'Performance should reflect actual operational changes.'
    }
  ] as RecalculationTrigger[],
  
  significanceThreshold: {
    common: '5% of total base year emissions',
    range: '1-10% depending on company policy',
    guidance: 
      'Establish and document a clear threshold in your recalculation policy. ' +
      'Apply consistently across all triggers.'
  },
  
  nzdpuHandling: {
    currentBehavior: 
      'NZDPU processes restatements only if the reporting period and organizational ' +
      'boundary are the same as the original disclosure. Changes outside these parameters ' +
      'are not automatically reconciled.',
    limitation: 
      'Current system cannot fully handle multiple years of disclosure from the same ' +
      'company with restated historical values. Front-end and back-end enhancements planned.',
    cdpContext: 
      'CDP does not process edits to disclosures once the disclosure window has closed. ' +
      'Corrections are included in the following year\'s disclosure (up to 1 year time lag).',
    futureDisclosures: 
      'IFRS S2 and ESRS E1 both require companies to restate comparative amounts for ' +
      'prior period material errors unless impracticable.'
  },
  
  esrsRequirement: {
    standard: 'ESRS E1',
    requirement: 
      'An undertaking shall correct material prior period errors by restating the ' +
      'comparative amounts for the prior period(s) disclosed, unless it is impracticable.',
    note: 'No comment on timeliness of update - expectation is annual restatement if needed.'
  },
  
  comparabilityImpact: {
    issue: 
      'When companies do not restate base years after structural changes, year-over-year ' +
      'trends become misleading. A decrease might reflect a divestiture, not decarbonization.',
    mitigation: [
      'Request information on base year recalculation policy',
      'Check for disclosed structural changes that may not be reflected in trends',
      'Compare same-year emissions rather than trend lines when recalculation status is unclear',
      'Use intensity metrics (per revenue, per unit) which partially normalize for size changes'
    ]
  },
  
  bestPractices: [
    'Document a clear base year recalculation policy with specific thresholds',
    'Apply recalculation policy consistently across all years',
    'Disclose when base year has been recalculated and why',
    'Provide both original and restated figures for transparency',
    'Obtain third-party verification of restated base year',
    'Align recalculation policy with target-setting frameworks (SBTi requires recalculation)'
  ]
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Explain double counting rules for a specific context
 */
export function explainDoubleCounting(context: 'scope2' | 'scope3' | 'value_chain' | 'totals'): string {
  switch (context) {
    case 'scope2':
      return formatDoubleCounting(doubleCounting.scope2);
    case 'scope3':
      return formatScope3Overlaps(doubleCounting.scope3CategoryOverlaps);
    case 'value_chain':
      return formatValueChainBoundaries(doubleCounting.valueChainBoundaries);
    case 'totals':
      return formatTotalCalculation(doubleCounting.totalEmissionsCalculation);
    default:
      return 'Unknown context. Available: scope2, scope3, value_chain, totals';
  }
}

function formatDoubleCounting(rule: typeof doubleCounting.scope2): string {
  let output = `## ${rule.rule}\n\n`;
  output += `**Explanation:** ${rule.explanation}\n\n`;
  output += `**Correct Approach:** ${rule.correctApproach}\n\n`;
  if (rule.examples) {
    output += `**Examples:**\n`;
    rule.examples.forEach(ex => output += `- ${ex}\n`);
  }
  return output;
}

function formatScope3Overlaps(overlaps: CategoryOverlap[]): string {
  let output = '## Scope 3 Category Overlaps\n\n';
  for (const overlap of overlaps) {
    output += `### ${overlap.categories[0]} ↔ ${overlap.categories[1]}\n`;
    output += `**Potential Overlap:** ${overlap.explanation}\n`;
    output += `**Resolution:** ${overlap.resolution}\n\n`;
  }
  return output;
}

function formatValueChainBoundaries(info: typeof doubleCounting.valueChainBoundaries): string {
  let output = '## Value Chain Boundaries\n\n';
  output += `**Issue:** ${info.issue}\n\n`;
  output += `**Guidance:** ${info.guidance}\n\n`;
  output += `**Comparability Note:** ${info.comparabilityNote}\n`;
  return output;
}

function formatTotalCalculation(info: typeof doubleCounting.totalEmissionsCalculation): string {
  let output = '## Calculating Total Emissions\n\n';
  output += `**Correct Formula:** ${info.correct}\n\n`;
  output += `**Common Mistakes:**\n`;
  info.incorrect.forEach(err => output += `- ❌ ${err}\n`);
  output += `\n**Recommendation:** ${info.recommendation}\n`;
  return output;
}

/**
 * Get information about a specific reporting framework
 */
export function getFrameworkInfo(frameworkKey: string): string {
  const framework = reportingFrameworks[frameworkKey];
  if (!framework) {
    const available = Object.keys(reportingFrameworks).join(', ');
    return `Framework "${frameworkKey}" not found. Available: ${available}`;
  }
  
  let output = `# ${framework.fullName}\n\n`;
  output += `**Type:** ${framework.type}\n`;
  output += `**Jurisdiction:** ${framework.jurisdiction}\n`;
  output += `**GHG Scope:** ${framework.ghgScope}\n`;
  output += `**GHG Protocol Alignment:** ${framework.ghgProtocolAlignment}\n\n`;
  
  output += `## Key Requirements\n`;
  framework.keyRequirements.forEach(req => output += `- ${req}\n`);
  
  if (framework.effectiveDate) {
    output += `\n**Effective Date:** ${framework.effectiveDate}\n`;
  }
  if (framework.notes) {
    output += `\n**Notes:** ${framework.notes}\n`;
  }
  
  return output;
}

/**
 * List all available reporting frameworks
 */
export function listFrameworks(): { name: string; type: string; jurisdiction: string }[] {
  return Object.values(reportingFrameworks).map(f => ({
    name: f.name,
    type: f.type,
    jurisdiction: f.jurisdiction
  }));
}

/**
 * Get emission factor guidance for a specific tier or database
 */
export function getEmissionFactorGuidance(tierOrDatabase: number | string): string {
  if (typeof tierOrDatabase === 'number') {
    const tier = emissionFactorHierarchy.find(t => t.tier === tierOrDatabase);
    if (!tier) {
      return `Tier ${tierOrDatabase} not found. Available tiers: 1-4`;
    }
    
    let output = `# Emission Factor Tier ${tier.tier}: ${tier.name}\n\n`;
    output += `**Quality Level:** ${tier.quality}\n\n`;
    output += `**Description:** ${tier.description}\n\n`;
    output += `**Typical Use:** ${tier.typicalUse}\n\n`;
    output += `**Limitations:** ${tier.limitations}\n`;
    return output;
  } else {
    const db = majorEmissionFactorDatabases[tierOrDatabase];
    if (!db) {
      const available = Object.keys(majorEmissionFactorDatabases).join(', ');
      return `Database "${tierOrDatabase}" not found. Available: ${available}`;
    }
    
    let output = `# ${db.name}\n\n`;
    output += `**Publisher:** ${db.publisher}\n`;
    output += `**Jurisdiction:** ${db.jurisdiction}\n`;
    output += `**Update Frequency:** ${db.updateFrequency}\n`;
    output += `**Coverage:** ${db.coverage}\n`;
    if (db.url) output += `**URL:** ${db.url}\n`;
    if (db.notes) output += `**Notes:** ${db.notes}\n`;
    return output;
  }
}

/**
 * Explain the emission factor quality hierarchy
 */
export function explainEmissionFactorHierarchy(): string {
  let output = '# Emission Factor Quality Hierarchy\n\n';
  output += 'Higher tiers indicate better data quality and accuracy.\n\n';
  
  for (const tier of emissionFactorHierarchy) {
    output += `## Tier ${tier.tier}: ${tier.name} (${tier.quality})\n`;
    output += `${tier.description}\n`;
    output += `- **Use for:** ${tier.typicalUse}\n`;
    output += `- **Limitations:** ${tier.limitations}\n\n`;
  }
  
  output += '---\n';
  output += `**NZDPU Context:** ${nzdpuEmissionFactorContext.priority}\n`;
  return output;
}

/**
 * Explain base year and recalculation concepts
 */
export function explainBaseYearRecalculation(): string {
  const by = baseYearRecalculation;
  
  let output = '# Base Year & Recalculation Policy\n\n';
  output += `## Definition\n${by.purpose.definition}\n\n`;
  
  output += `## Why It Matters\n`;
  by.purpose.importance.forEach(i => output += `- ${i}\n`);
  output += `\n**Selection Guidance:** ${by.purpose.selection}\n\n`;
  
  output += `## Recalculation Triggers\n\n`;
  for (const trigger of by.recalculationTriggers) {
    output += `### ${trigger.trigger}\n`;
    output += `${trigger.description}\n`;
    output += `**GHG Protocol Guidance:** ${trigger.ghgProtocolGuidance}\n\n`;
  }
  
  output += `## Significance Threshold\n`;
  output += `- **Common:** ${by.significanceThreshold.common}\n`;
  output += `- **Range:** ${by.significanceThreshold.range}\n`;
  output += `- ${by.significanceThreshold.guidance}\n\n`;
  
  output += `## Best Practices\n`;
  by.bestPractices.forEach(bp => output += `- ${bp}\n`);
  
  return output;
}

/**
 * List all available advanced topics
 */
export function listAdvancedTopics(): string[] {
  return [
    'double_counting',
    'double_counting_scope2',
    'double_counting_scope3',
    'double_counting_value_chain',
    'reporting_frameworks',
    'framework_IFRS_S2',
    'framework_ESRS_E1',
    'framework_SEC',
    'framework_CDP',
    'framework_GRI',
    'framework_TCFD',
    'framework_SBTi',
    'framework_PCAF',
    'emission_factors',
    'emission_factor_tier_1',
    'emission_factor_tier_2',
    'emission_factor_tier_3',
    'emission_factor_tier_4',
    'emission_factor_DEFRA',
    'emission_factor_EPA',
    'emission_factor_ecoinvent',
    'emission_factor_IPCC',
    'base_year',
    'recalculation'
  ];
}

// ==================== FRAMEWORK INDEXES ====================

/**
 * Pre-built index: Jurisdiction -> Framework names
 * Enables O(1) lookup for "What frameworks apply in X jurisdiction?"
 */
export const FRAMEWORKS_BY_JURISDICTION: Record<string, string[]> = (() => {
  const index: Record<string, string[]> = {};

  for (const [key, framework] of Object.entries(reportingFrameworks)) {
    const jurisdiction = framework.jurisdiction;

    // Handle multi-jurisdiction frameworks
    if (jurisdiction.includes('Global')) {
      if (!index['Global']) index['Global'] = [];
      index['Global'].push(key);
    }
    if (jurisdiction.includes('EU') || jurisdiction.includes('European')) {
      if (!index['EU']) index['EU'] = [];
      index['EU'].push(key);
    }
    if (jurisdiction.includes('United States') || jurisdiction.includes('US')) {
      if (!index['US']) index['US'] = [];
      index['US'].push(key);
    }
    if (jurisdiction.includes('UK')) {
      if (!index['UK']) index['UK'] = [];
      index['UK'].push(key);
    }
    if (jurisdiction.includes('Financial')) {
      if (!index['Financial Sector']) index['Financial Sector'] = [];
      index['Financial Sector'].push(key);
    }
  }

  return index;
})();

/**
 * Pre-built index: Type -> Framework names
 * Enables O(1) lookup for "What mandatory/voluntary frameworks exist?"
 */
export const FRAMEWORKS_BY_TYPE: Record<string, string[]> = (() => {
  const index: Record<string, string[]> = {
    mandatory: [],
    voluntary: [],
    'sector-specific': []
  };

  for (const [key, framework] of Object.entries(reportingFrameworks)) {
    index[framework.type].push(key);
  }

  return index;
})();

/**
 * Get frameworks by jurisdiction
 */
export function getFrameworksByJurisdiction(jurisdiction: string): FrameworkInfo[] {
  const keys = FRAMEWORKS_BY_JURISDICTION[jurisdiction] || [];
  return keys.map(key => reportingFrameworks[key]).filter(Boolean);
}

/**
 * Get frameworks by type
 */
export function getFrameworksByType(type: 'mandatory' | 'voluntary' | 'sector-specific'): FrameworkInfo[] {
  const keys = FRAMEWORKS_BY_TYPE[type] || [];
  return keys.map(key => reportingFrameworks[key]).filter(Boolean);
}

/**
 * Get framework summary for quick reference
 */
export function getFrameworksSummary(): string {
  const mandatory = FRAMEWORKS_BY_TYPE['mandatory'].length;
  const voluntary = FRAMEWORKS_BY_TYPE['voluntary'].length;
  const sector = FRAMEWORKS_BY_TYPE['sector-specific'].length;
  const total = mandatory + voluntary + sector;

  return `${total} frameworks: ${mandatory} mandatory (${FRAMEWORKS_BY_TYPE['mandatory'].join(', ')}), ` +
    `${voluntary} voluntary (${FRAMEWORKS_BY_TYPE['voluntary'].join(', ')}), ` +
    `${sector} sector-specific (${FRAMEWORKS_BY_TYPE['sector-specific'].join(', ')})`;
}

/**
 * List available jurisdictions
 */
export function listAvailableJurisdictions(): string[] {
  return Object.keys(FRAMEWORKS_BY_JURISDICTION);
}
