// Comparability Rules and Validation

import { 
  ComparabilityCheck, 
  ComparabilityWarning, 
  EmissionsData,
  Scope2Methodology 
} from '../types/index.js';

// Scope 2 Comparability Rules
export const scope2ComparabilityRules = {
  locationBased: {
    canCompareWith: ['location_based'] as Scope2Methodology[],
    explanation: 'Location-based Scope 2 emissions reflect grid-average emission factors for the geographic location where electricity is consumed. They represent the physical emissions from electricity generation regardless of any contractual arrangements.',
    whyNotComparable: 'Location-based and market-based methodologies measure fundamentally different things. Location-based measures grid impact; market-based measures procurement decisions. Comparing them would be like comparing apples to oranges.',
  },
  marketBased: {
    canCompareWith: ['market_based'] as Scope2Methodology[],
    explanation: 'Market-based Scope 2 emissions reflect emissions from electricity that companies have purposefully chosen through contractual instruments such as RECs, PPAs, or supplier-specific emission factors.',
    whyNotComparable: 'A company with low market-based emissions may have achieved this through renewable energy procurement rather than operational efficiency. This doesn\'t mean they have lower grid impact than a company with higher location-based emissions.',
  },
};

// Check if two Scope 2 methodologies can be compared
export function checkScope2Comparability(
  methodology1: Scope2Methodology,
  methodology2: Scope2Methodology
): ComparabilityCheck {
  const isComparable = methodology1 === methodology2;
  
  if (isComparable) {
    return {
      isComparable: true,
      warnings: [],
      explanation: `Both companies use ${methodology1 === 'location_based' ? 'location-based' : 'market-based'} methodology. These figures are directly comparable.`,
    };
  }

  const warning: ComparabilityWarning = {
    type: 'scope2_mismatch',
    severity: 'error',
    message: `Cannot compare Scope 2 emissions: One uses location-based methodology while the other uses market-based.`,
    educationalContext: getScope2MismatchEducation(),
    suggestion: 'Request the same methodology type for both companies to make a valid comparison.',
  };

  return {
    isComparable: false,
    warnings: [warning],
    explanation: 'These Scope 2 figures cannot be directly compared due to methodology differences.',
    suggestion: 'To compare these companies fairly, request either location-based or market-based figures for both.',
  };
}

// Educational explanation for Scope 2 methodology mismatch
function getScope2MismatchEducation(): string {
  return `
**Why Location-Based and Market-Based Scope 2 Cannot Be Compared**

The GHG Protocol requires companies to report Scope 2 using two methods that answer different questions:

**Location-Based Method:**
• Uses grid-average emission factors
• Reflects physical emissions from local electricity generation
• Answers: "What is the actual grid impact of our electricity consumption?"
• A company's location-based emissions depend on the carbon intensity of local grids

**Market-Based Method:**
• Uses emission factors from contractual instruments (RECs, PPAs, green tariffs)
• Reflects emissions based on energy procurement decisions
• Answers: "What are the emissions from the specific electricity sources we've chosen?"
• A company can reduce market-based emissions by purchasing renewable energy certificates

**Key Insight:**
A company with HIGH location-based but LOW market-based emissions is successfully procuring clean energy but operating in a carbon-intensive grid. Conversely, a company with LOW location-based emissions might simply operate in a clean grid without any renewable procurement efforts.

**Valid Comparisons:**
• Compare location-based to location-based: Understand relative grid impact
• Compare market-based to market-based: Understand procurement strategy effectiveness
• Never mix methodologies: Results would be meaningless
`;
}

// Check general emissions comparability
export function checkEmissionsComparability(
  emissions1: EmissionsData,
  emissions2: EmissionsData
): ComparabilityCheck {
  const warnings: ComparabilityWarning[] = [];
  let isComparable = true;

  // Check year alignment
  if (emissions1.year !== emissions2.year) {
    warnings.push({
      type: 'year_mismatch',
      severity: 'warning',
      message: `Different reporting years: ${emissions1.year} vs ${emissions2.year}`,
      educationalContext: 'Emissions can vary significantly year-over-year due to operational changes, economic conditions, and methodology updates. Same-year comparisons are more meaningful.',
      suggestion: 'If possible, compare data from the same reporting year.',
    });
    // Year mismatch is a warning, not a blocker
  }

  // Check organizational boundary alignment
  if (emissions1.organizational_boundary !== emissions2.organizational_boundary) {
    if (emissions1.organizational_boundary && emissions2.organizational_boundary) {
      warnings.push({
        type: 'boundary_mismatch',
        severity: 'warning',
        message: `Different organizational boundaries: ${emissions1.organizational_boundary} vs ${emissions2.organizational_boundary}`,
        educationalContext: 'Different organizational boundary approaches (operational control, financial control, equity share) can lead to different reported emissions for similar operations. This affects which facilities and subsidiaries are included.',
        suggestion: 'Consider this when interpreting results. Companies using operational control typically report emissions from operations they can directly influence.',
      });
    }
  }

  // Check Scope 1 methodology alignment
  if (emissions1.scope1_methodology && emissions2.scope1_methodology) {
    if (emissions1.scope1_methodology !== emissions2.scope1_methodology) {
      warnings.push({
        type: 'methodology_mismatch',
        severity: 'info',
        message: `Different Scope 1 methodologies: ${emissions1.scope1_methodology} vs ${emissions2.scope1_methodology}`,
        educationalContext: 'While different methodologies can still produce comparable results, variations in emission factors and calculation approaches may introduce some uncertainty.',
      });
    }
  }

  // Check Scope 2 methodology - this is critical
  const hasScope2LB1 = emissions1.scope2_location_based !== undefined;
  const hasScope2MB1 = emissions1.scope2_market_based !== undefined;
  const hasScope2LB2 = emissions2.scope2_location_based !== undefined;
  const hasScope2MB2 = emissions2.scope2_market_based !== undefined;

  // Determine what types of Scope 2 comparison are possible
  const scope2Comparison = {
    canCompareLB: hasScope2LB1 && hasScope2LB2,
    canCompareMB: hasScope2MB1 && hasScope2MB2,
    mixedComparison: (hasScope2LB1 && !hasScope2LB2 && hasScope2MB2) || 
                     (hasScope2MB1 && !hasScope2MB2 && hasScope2LB2),
  };

  if (scope2Comparison.mixedComparison) {
    warnings.push({
      type: 'scope2_mismatch',
      severity: 'error',
      message: 'Scope 2 methodology mismatch detected',
      educationalContext: getScope2MismatchEducation(),
      suggestion: 'Request the same Scope 2 methodology type for both companies.',
    });
    isComparable = false;
  }

  return {
    isComparable,
    warnings,
    explanation: generateComparabilityExplanation(warnings, isComparable),
    suggestion: isComparable ? undefined : 'Address the errors above before comparing these emissions figures.',
  };
}

// Generate human-readable explanation
function generateComparabilityExplanation(
  warnings: ComparabilityWarning[], 
  isComparable: boolean
): string {
  if (warnings.length === 0) {
    return 'These emissions figures are directly comparable with no significant methodology differences.';
  }

  const errors = warnings.filter(w => w.severity === 'error');
  const warningsOnly = warnings.filter(w => w.severity === 'warning');
  const infos = warnings.filter(w => w.severity === 'info');

  let explanation = '';

  if (!isComparable) {
    explanation += '⛔ **COMPARISON NOT VALID**\n\n';
    explanation += 'The following critical issues prevent direct comparison:\n';
    errors.forEach(e => {
      explanation += `• ${e.message}\n`;
    });
    explanation += '\n';
  } else if (warningsOnly.length > 0) {
    explanation += '⚠️ **COMPARISON POSSIBLE WITH CAVEATS**\n\n';
    explanation += 'Consider the following when interpreting results:\n';
    warningsOnly.forEach(w => {
      explanation += `• ${w.message}\n`;
    });
    explanation += '\n';
  }

  if (infos.length > 0 && isComparable) {
    explanation += '📝 **Notes:**\n';
    infos.forEach(i => {
      explanation += `• ${i.message}\n`;
    });
  }

  return explanation;
}

// Validate comparison request
export function validateComparisonRequest(
  companyIds: number[],
  scope: 'scope1' | 'scope2_lb' | 'scope2_mb' | 'scope2' | 'scope3' | 'total',
  emissionsData: Map<number, EmissionsData>
): ComparabilityCheck {
  const warnings: ComparabilityWarning[] = [];
  
  // Check if we have data for all companies
  const missingData = companyIds.filter(id => !emissionsData.has(id));
  if (missingData.length > 0) {
    warnings.push({
      type: 'data_quality',
      severity: 'error',
      message: `Missing emissions data for companies: ${missingData.join(', ')}`,
      educationalContext: 'Comparison requires emissions data for all specified companies.',
    });
    return {
      isComparable: false,
      warnings,
      explanation: 'Cannot compare: missing data for some companies.',
    };
  }

  // For Scope 2, validate methodology consistency
  if (scope === 'scope2') {
    warnings.push({
      type: 'scope2_mismatch',
      severity: 'warning',
      message: 'Generic "scope2" comparison requested. Please specify "scope2_lb" (location-based) or "scope2_mb" (market-based) for accurate comparison.',
      educationalContext: getScope2MismatchEducation(),
      suggestion: 'Use scope2_lb or scope2_mb to ensure comparing like with like.',
    });
  }

  if (scope === 'scope2_lb' || scope === 'scope2_mb') {
    const emissions = Array.from(emissionsData.values());
    const field = scope === 'scope2_lb' ? 'scope2_location_based' : 'scope2_market_based';
    
    const missingMethodology = emissions.filter(e => e[field] === undefined || e[field] === null);
    if (missingMethodology.length > 0) {
      const otherField = scope === 'scope2_lb' ? 'scope2_market_based' : 'scope2_location_based';
      const hasOther = missingMethodology.filter(e => e[otherField] !== undefined && e[otherField] !== null);
      
      if (hasOther.length > 0) {
        warnings.push({
          type: 'scope2_mismatch',
          severity: 'error',
          message: `Some companies only report ${scope === 'scope2_lb' ? 'market-based' : 'location-based'} Scope 2, not ${scope === 'scope2_lb' ? 'location-based' : 'market-based'}.`,
          educationalContext: getScope2MismatchEducation(),
          suggestion: `Request ${scope === 'scope2_lb' ? 'market-based' : 'location-based'} comparison instead, or exclude companies without ${scope === 'scope2_lb' ? 'location-based' : 'market-based'} data.`,
        });
        return {
          isComparable: false,
          warnings,
          explanation: 'Scope 2 methodology mismatch prevents comparison.',
        };
      }
    }
  }

  return {
    isComparable: warnings.filter(w => w.severity === 'error').length === 0,
    warnings,
    explanation: warnings.length === 0 ? 'Comparison is valid.' : 'Comparison possible with noted caveats.',
  };
}

// Common comparison mistakes to warn about
export const commonMistakes = [
  {
    mistake: 'Comparing location-based to market-based Scope 2',
    explanation: 'These methodologies measure different things and cannot be directly compared.',
    correction: 'Always compare location-based to location-based, or market-based to market-based.',
  },
  {
    mistake: 'Comparing Scope 3 across different categories',
    explanation: 'Each Scope 3 category represents different value chain activities with different methodologies.',
    correction: 'Compare only within the same Scope 3 category (e.g., Category 1 to Category 1).',
  },
  {
    mistake: 'Comparing companies with different organizational boundaries',
    explanation: 'Operational control vs financial control can significantly change what emissions are reported.',
    correction: 'Note the organizational boundary approach and consider its impact on reported figures.',
  },
  {
    mistake: 'Comparing absolute emissions without considering company size',
    explanation: 'A larger company will naturally have higher absolute emissions.',
    correction: 'Use intensity metrics (emissions per revenue, per employee, per unit produced) for fairer comparison.',
  },
  {
    mistake: 'Comparing emissions across different years without adjustments',
    explanation: 'Economic conditions, acquisitions, and methodology changes affect year-over-year comparability.',
    correction: 'Prefer same-year comparisons or adjust for known changes.',
  },
];

