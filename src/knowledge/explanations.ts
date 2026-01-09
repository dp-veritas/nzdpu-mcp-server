/**
 * Shared Explanation Content
 *
 * Consolidates frequently-used explanations to avoid duplication
 * and ensure consistent messaging across tools.
 */

/**
 * Core explanation for Scope 2 location-based vs market-based comparison
 * Used by: comparability.ts, advanced.ts, index.ts (learn tool)
 */
export const SCOPE2_COMPARISON_EXPLANATION = `
**Why Location-Based and Market-Based Scope 2 Cannot Be Compared**

The GHG Protocol requires companies to report Scope 2 using two methods that answer different questions:

**Location-Based Method:**
- Uses grid-average emission factors
- Reflects physical emissions from local electricity generation
- Answers: "What is the actual grid impact of our electricity consumption?"
- A company's location-based emissions depend on the carbon intensity of local grids

**Market-Based Method:**
- Uses emission factors from contractual instruments (RECs, PPAs, green tariffs)
- Reflects emissions based on energy procurement decisions
- Answers: "What are the emissions from the specific electricity sources we've chosen?"
- A company can reduce market-based emissions by purchasing renewable energy certificates

**Key Insight:**
A company with HIGH location-based but LOW market-based emissions is successfully procuring clean energy but operating in a carbon-intensive grid. Conversely, a company with LOW location-based emissions might simply operate in a clean grid without any renewable procurement efforts.

**Valid Comparisons:**
- Compare location-based to location-based: Understand relative grid impact
- Compare market-based to market-based: Understand procurement strategy effectiveness
- Never mix methodologies: Results would be meaningless
`.trim();

/**
 * Brief summary version for quick reference
 */
export const SCOPE2_COMPARISON_SUMMARY = `Location-based uses grid averages (physical emissions); market-based uses contractual instruments (procurement choices). They measure different things and cannot be compared.`;

/**
 * Double counting rule for Scope 2
 */
export const SCOPE2_DOUBLE_COUNTING_RULE = {
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
    'WRONG: Total Scope 2 = 50,000 (LB) + 10,000 (MB) = 60,000 tCO2e',
    'CORRECT: Report Scope 2 LB: 50,000 tCO2e AND Scope 2 MB: 10,000 tCO2e separately',
    'For combined Scope 1+2 totals, choose one methodology consistently'
  ]
};

/**
 * Total emissions calculation guidance
 */
export const TOTAL_EMISSIONS_CALCULATION = {
  correct: 'Scope 1 + Scope 2 (choose LB or MB, not both) + Scope 3 Total',
  incorrect: [
    'Scope 1 + Scope 2 LB + Scope 2 MB + Scope 3 (double counts Scope 2)',
    'Scope 1 + Scope 2 + sum of all Scope 3 categories when categories overlap'
  ],
  recommendation:
    'For reporting total emissions, use Scope 2 Location-Based unless the purpose ' +
    'specifically requires market-based (e.g., tracking renewable energy impact).'
};
