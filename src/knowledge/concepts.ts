// GHG Accounting Concepts Knowledge Base

export interface GHGConcept {
  name: string;
  definition: string;
  useCase: string;
  limitations?: string;
  comparability?: string;
  examples?: string[];
  relatedConcepts?: string[];
}

export const ghgConcepts: Record<string, GHGConcept> = {
  scope1: {
    name: 'Scope 1 Emissions',
    definition: 'Direct GHG emissions from sources owned or controlled by the reporting company. These include emissions from combustion in owned or controlled boilers, furnaces, vehicles, and emissions from chemical production in owned or controlled process equipment.',
    useCase: 'Measures emissions that a company has direct operational control over and can reduce through operational changes.',
    limitations: 'Does not capture upstream or downstream value chain emissions.',
    comparability: 'Generally comparable across companies when using the same organizational boundary approach (operational control, financial control, or equity share).',
    examples: [
      'Fuel combustion in company-owned vehicles',
      'On-site power generation',
      'Fugitive emissions from refrigerants',
      'Process emissions from manufacturing'
    ],
    relatedConcepts: ['organizational_boundary', 'operational_control', 'direct_emissions']
  },

  scope2_location_based: {
    name: 'Scope 2 Location-Based Method',
    definition: 'Quantifies Scope 2 emissions based on average emission factors for the grid where electricity consumption occurs. It reflects the average emissions intensity of grids on which energy consumption occurs, using grid-average emission factors.',
    useCase: 'Best for understanding the actual physical emissions associated with electricity consumption in a specific location. Useful for regional comparisons and understanding grid impact.',
    limitations: 'Does not account for renewable energy purchases, power purchase agreements (PPAs), or other contractual instruments that may change the emissions profile.',
    comparability: 'Can ONLY be compared with other location-based figures. Never compare location-based to market-based emissions.',
    examples: [
      'A company in Germany uses the German grid emission factor regardless of their energy contracts',
      'All electricity consumption multiplied by local grid emission factor'
    ],
    relatedConcepts: ['scope2_market_based', 'grid_emission_factor', 'residual_mix']
  },

  scope2_market_based: {
    name: 'Scope 2 Market-Based Method',
    definition: 'Quantifies Scope 2 emissions based on emissions from the specific electricity sources a company has chosen through contractual instruments. These include energy attribute certificates (RECs, GOs), direct contracts (PPAs), and supplier-specific emission factors.',
    useCase: 'Best for evaluating energy procurement decisions, tracking progress on renewable energy goals, and understanding the impact of energy purchasing strategies.',
    limitations: 'Requires proper documentation of contractual instruments. Quality of instruments (additionality, vintage) affects the validity of claims.',
    comparability: 'Can ONLY be compared with other market-based figures. Never compare market-based to location-based emissions.',
    examples: [
      'A company with 100% renewable energy certificates reports zero or near-zero market-based emissions',
      'PPA with a solar farm allows company to claim those specific emissions',
      'Supplier-specific emission factor from utility provider'
    ],
    relatedConcepts: ['scope2_location_based', 'renewable_energy_certificate', 'ppa', 'residual_mix']
  },

  scope3_overview: {
    name: 'Scope 3 Emissions',
    definition: 'All indirect emissions (not included in Scope 2) that occur in the value chain of the reporting company, including both upstream and downstream emissions across 15 categories.',
    useCase: 'Provides a comprehensive view of a company\'s climate impact across its entire value chain. Often represents the largest source of emissions for many companies.',
    limitations: 'Data quality varies significantly. Relies heavily on estimates, industry averages, and spend-based calculations. Primary data from suppliers is ideal but often unavailable.',
    comparability: 'Compare only within the same category. Methodology differences significantly impact comparability.',
    examples: [
      'Purchased goods and services (Category 1)',
      'Business travel (Category 6)',
      'Use of sold products (Category 11)'
    ],
    relatedConcepts: ['upstream_emissions', 'downstream_emissions', 'value_chain', 'primary_data', 'secondary_data']
  },

  organizational_boundary: {
    name: 'Organizational Boundary',
    definition: 'Defines which operations, facilities, and entities are included in a company\'s GHG inventory. Three approaches exist: equity share, financial control, and operational control.',
    useCase: 'Establishes the scope of what emissions the company reports. Critical for understanding what is and isn\'t included in reported figures.',
    limitations: 'Different approaches can lead to significantly different reported emissions for the same company, especially for complex corporate structures.',
    comparability: 'Companies using different organizational boundary approaches may not be directly comparable. Always check boundary approach before comparing.',
    examples: [
      'Operational control: Include all facilities where company has authority to implement operating policies',
      'Financial control: Include all facilities where company has ability to direct financial and operating policies',
      'Equity share: Include emissions proportional to ownership stake'
    ],
    relatedConcepts: ['scope1', 'operational_control', 'financial_control', 'equity_share']
  },

  primary_data: {
    name: 'Primary Data',
    definition: 'Data from specific activities within a company\'s value chain. For Scope 3, this means data collected directly from suppliers, customers, or other value chain partners.',
    useCase: 'Provides the most accurate representation of actual emissions. Preferred for material Scope 3 categories.',
    limitations: 'Often difficult and resource-intensive to collect. May require significant supplier engagement.',
    comparability: 'Companies using primary data generally have higher quality emissions estimates than those using secondary data.',
    examples: [
      'Supplier-provided emissions data for purchased goods',
      'Actual fuel consumption from logistics partners',
      'Direct measurement of waste treatment emissions'
    ],
    relatedConcepts: ['secondary_data', 'scope3_overview', 'supplier_engagement']
  },

  secondary_data: {
    name: 'Secondary Data',
    definition: 'Data that is not from specific activities within a company\'s value chain. Includes industry-average data, financial data (spend-based), proxy data, and published emission factors.',
    useCase: 'Useful for screening, initial estimates, and categories where primary data is unavailable. Common starting point for Scope 3 accounting.',
    limitations: 'Less accurate than primary data. Industry averages may not reflect specific supply chain characteristics.',
    comparability: 'Companies using different secondary data sources may have varying accuracy levels.',
    examples: [
      'Spend-based emissions using EEIO factors',
      'Industry-average emission factors from databases',
      'Distance-based calculations using average transport emission factors'
    ],
    relatedConcepts: ['primary_data', 'emission_factor', 'spend_based_method']
  },

  assurance_limited: {
    name: 'Limited Assurance',
    definition: 'A moderate level of assurance where the practitioner provides a negative form of conclusion (e.g., "nothing has come to our attention that causes us to believe the data is materially misstated").',
    useCase: 'Provides stakeholders with confidence that data has been reviewed by an independent party, though with less rigor than reasonable assurance.',
    limitations: 'Less rigorous than reasonable assurance. Procedures are more limited in scope.',
    comparability: 'Verified data (even limited assurance) is generally more reliable than unverified data.',
    examples: [
      'Review of calculation methodologies',
      'Sample testing of data inputs',
      'Analytical procedures on reported data'
    ],
    relatedConcepts: ['assurance_reasonable', 'verification', 'third_party_review']
  },

  assurance_reasonable: {
    name: 'Reasonable Assurance',
    definition: 'A high level of assurance where the practitioner provides a positive form of conclusion (e.g., "in our opinion, the data is fairly presented in all material respects").',
    useCase: 'Provides the highest level of confidence in reported data. Often required by regulations or investor expectations.',
    limitations: 'More expensive and time-consuming than limited assurance. Not yet common for most GHG disclosures.',
    comparability: 'Data with reasonable assurance is the gold standard for comparability and reliability.',
    examples: [
      'Comprehensive testing of controls',
      'Detailed substantive procedures',
      'Similar rigor to financial audit'
    ],
    relatedConcepts: ['assurance_limited', 'verification', 'financial_audit']
  },

  ghg_protocol: {
    name: 'GHG Protocol',
    definition: 'The world\'s most widely used greenhouse gas accounting standards. Developed by WRI and WBCSD, it provides comprehensive frameworks for measuring and managing GHG emissions.',
    useCase: 'Foundation for most corporate GHG accounting. Required or referenced by most reporting frameworks and regulations.',
    limitations: 'While comprehensive, implementation varies. Some aspects require interpretation.',
    comparability: 'Companies following GHG Protocol are generally more comparable, though methodology choices within the protocol can differ.',
    examples: [
      'Corporate Accounting and Reporting Standard',
      'Scope 2 Guidance',
      'Corporate Value Chain (Scope 3) Standard',
      'Product Life Cycle Standard'
    ],
    relatedConcepts: ['scope1', 'scope2_location_based', 'scope2_market_based', 'scope3_overview']
  }
};

// Scope 3 Category Definitions
export const scope3Categories: Record<number, GHGConcept> = {
  1: {
    name: 'Category 1: Purchased Goods and Services',
    definition: 'Emissions from the production of goods and services purchased by the reporting company.',
    useCase: 'Often the largest Scope 3 category for service companies and retailers.',
    limitations: 'Highly dependent on supplier data availability. Spend-based methods are less accurate.',
    comparability: 'Compare only within category. Methodology (spend-based vs supplier-specific) significantly affects results.',
    examples: ['Raw materials', 'Office supplies', 'Professional services', 'Cloud computing services']
  },
  2: {
    name: 'Category 2: Capital Goods',
    definition: 'Emissions from the production of capital goods purchased by the reporting company.',
    useCase: 'Important for capital-intensive industries.',
    limitations: 'Often amortized differently than financial accounting. Data availability is challenging.',
    examples: ['Machinery', 'Buildings', 'Vehicles', 'IT equipment']
  },
  3: {
    name: 'Category 3: Fuel and Energy-Related Activities',
    definition: 'Emissions from fuel and energy not included in Scope 1 or 2, including upstream emissions of purchased fuels and T&D losses.',
    useCase: 'Completes the picture of energy-related emissions beyond direct consumption.',
    examples: ['Upstream emissions of purchased fuels', 'Transmission and distribution losses', 'Generation of purchased electricity sold to end users']
  },
  4: {
    name: 'Category 4: Upstream Transportation and Distribution',
    definition: 'Emissions from transportation and distribution of products purchased by the reporting company.',
    useCase: 'Critical for companies with complex supply chains.',
    examples: ['Inbound logistics', 'Third-party warehousing', 'Supplier deliveries']
  },
  5: {
    name: 'Category 5: Waste Generated in Operations',
    definition: 'Emissions from disposal and treatment of waste generated in the reporting company\'s operations.',
    useCase: 'Important for manufacturing and retail operations.',
    examples: ['Landfill disposal', 'Recycling processes', 'Wastewater treatment', 'Incineration']
  },
  6: {
    name: 'Category 6: Business Travel',
    definition: 'Emissions from transportation of employees for business-related activities.',
    useCase: 'Often well-tracked due to expense reporting systems.',
    examples: ['Air travel', 'Rail travel', 'Hotel stays', 'Rental cars']
  },
  7: {
    name: 'Category 7: Employee Commuting',
    definition: 'Emissions from transportation of employees between their homes and worksites.',
    useCase: 'Can be significant for large employers.',
    examples: ['Car commuting', 'Public transit', 'Remote work (home office emissions)']
  },
  8: {
    name: 'Category 8: Upstream Leased Assets',
    definition: 'Emissions from operation of assets leased by the reporting company.',
    useCase: 'Depends on organizational boundary approach and lease structure.',
    examples: ['Leased buildings', 'Leased vehicles', 'Leased equipment']
  },
  9: {
    name: 'Category 9: Downstream Transportation and Distribution',
    definition: 'Emissions from transportation and distribution of products sold by the reporting company.',
    useCase: 'Important for product companies.',
    examples: ['Outbound logistics', 'Retail distribution', 'Last-mile delivery']
  },
  10: {
    name: 'Category 10: Processing of Sold Products',
    definition: 'Emissions from processing of intermediate products sold by the reporting company.',
    useCase: 'Relevant for companies selling intermediate goods.',
    examples: ['Further manufacturing of components', 'Assembly operations', 'Chemical processing']
  },
  11: {
    name: 'Category 11: Use of Sold Products',
    definition: 'Emissions from the use of goods and services sold by the reporting company.',
    useCase: 'Often the largest category for energy-using products (vehicles, appliances).',
    limitations: 'Requires assumptions about product lifetime and usage patterns.',
    examples: ['Fuel consumption of vehicles sold', 'Energy use of appliances', 'Combustion of fuels sold']
  },
  12: {
    name: 'Category 12: End-of-Life Treatment of Sold Products',
    definition: 'Emissions from waste disposal and treatment of products sold by the reporting company.',
    useCase: 'Important for product stewardship.',
    examples: ['Landfill disposal of products', 'Recycling of products', 'Incineration']
  },
  13: {
    name: 'Category 13: Downstream Leased Assets',
    definition: 'Emissions from operation of assets owned by the reporting company and leased to others.',
    useCase: 'Relevant for real estate and equipment leasing companies.',
    examples: ['Leased buildings', 'Leased vehicles', 'Leased equipment']
  },
  14: {
    name: 'Category 14: Franchises',
    definition: 'Emissions from operation of franchises.',
    useCase: 'Critical for franchise businesses.',
    examples: ['Franchise restaurant operations', 'Franchise retail operations']
  },
  15: {
    name: 'Category 15: Investments',
    definition: 'Emissions from the reporting company\'s investments.',
    useCase: 'Major category for financial institutions.',
    limitations: 'Methodologies still evolving, especially for complex financial instruments.',
    examples: ['Equity investments', 'Debt investments', 'Project finance', 'Managed investments']
  }
};

// Helper function to get concept explanation
export function explainConcept(conceptKey: string): string {
  const concept = ghgConcepts[conceptKey];
  if (!concept) {
    // Check if it's a Scope 3 category
    const categoryMatch = conceptKey.match(/scope3_category_?(\d+)/i);
    if (categoryMatch) {
      const categoryNum = parseInt(categoryMatch[1]);
      const category = scope3Categories[categoryNum];
      if (category) {
        return formatConceptExplanation(category);
      }
    }
    return `Concept "${conceptKey}" not found. Available concepts: ${Object.keys(ghgConcepts).join(', ')}`;
  }
  return formatConceptExplanation(concept);
}

function formatConceptExplanation(concept: GHGConcept): string {
  let explanation = `**${concept.name}**\n\n`;
  explanation += `**Definition:** ${concept.definition}\n\n`;
  explanation += `**Use Case:** ${concept.useCase}\n\n`;
  
  if (concept.limitations) {
    explanation += `**Limitations:** ${concept.limitations}\n\n`;
  }
  
  if (concept.comparability) {
    explanation += `**Comparability:** ${concept.comparability}\n\n`;
  }
  
  if (concept.examples && concept.examples.length > 0) {
    explanation += `**Examples:**\n${concept.examples.map(e => `• ${e}`).join('\n')}\n\n`;
  }
  
  if (concept.relatedConcepts && concept.relatedConcepts.length > 0) {
    explanation += `**Related Concepts:** ${concept.relatedConcepts.join(', ')}`;
  }
  
  return explanation;
}

// List all available concepts
export function listAvailableConcepts(): string[] {
  const concepts = Object.keys(ghgConcepts);
  const categories = Object.keys(scope3Categories).map(k => `scope3_category_${k}`);

  // Advanced topics from advanced.ts
  const advancedTopics = [
    'double_counting',
    'frameworks',
    'emission_factors',
    'base_year',
    'advanced'
  ];

  return [...concepts, ...categories, ...advancedTopics];
}

// ==================== RELATED CONCEPT EXPANSION ====================

/**
 * Explain a concept with brief summaries of related concepts
 * Enables Claude to traverse knowledge graph in a single query
 */
export function explainConceptWithRelated(conceptKey: string, maxRelated: number = 3): string {
  const concept = ghgConcepts[conceptKey];
  if (!concept) {
    // Check if it's a Scope 3 category
    const categoryMatch = conceptKey.match(/scope3_category_?(\d+)/i);
    if (categoryMatch) {
      const categoryNum = parseInt(categoryMatch[1]);
      const category = scope3Categories[categoryNum];
      if (category) {
        return formatConceptWithRelated(category, maxRelated);
      }
    }
    return `Concept "${conceptKey}" not found. Available concepts: ${Object.keys(ghgConcepts).join(', ')}`;
  }
  return formatConceptWithRelated(concept, maxRelated);
}

function formatConceptWithRelated(concept: GHGConcept, maxRelated: number): string {
  let output = formatConceptExplanation(concept);

  if (concept.relatedConcepts && concept.relatedConcepts.length > 0) {
    output += '\n---\n\n### Related Concepts\n\n';

    const relatedToShow = concept.relatedConcepts.slice(0, maxRelated);
    for (const relatedKey of relatedToShow) {
      const relatedConcept = ghgConcepts[relatedKey];
      if (relatedConcept) {
        // Truncate definition to ~100 chars
        const briefDef = relatedConcept.definition.length > 100
          ? relatedConcept.definition.slice(0, 100) + '...'
          : relatedConcept.definition;
        output += `**${relatedConcept.name}**: ${briefDef}\n\n`;
      }
    }

    if (concept.relatedConcepts.length > maxRelated) {
      const remaining = concept.relatedConcepts.slice(maxRelated).join(', ');
      output += `*Also related: ${remaining}*\n`;
    }
  }

  return output;
}

/**
 * Get a brief summary of a concept (1-2 sentences)
 */
export function getConceptSummary(conceptKey: string): string {
  const concept = ghgConcepts[conceptKey];
  if (!concept) {
    // Check Scope 3 categories
    const categoryMatch = conceptKey.match(/scope3_category_?(\d+)/i);
    if (categoryMatch) {
      const categoryNum = parseInt(categoryMatch[1]);
      const category = scope3Categories[categoryNum];
      if (category) {
        return `${category.name}: ${category.definition.slice(0, 150)}...`;
      }
    }
    return `Concept "${conceptKey}" not found.`;
  }

  // Return name + truncated definition
  const briefDef = concept.definition.length > 150
    ? concept.definition.slice(0, 150) + '...'
    : concept.definition;
  return `${concept.name}: ${briefDef}`;
}

/**
 * Get all concepts that reference a given concept
 */
export function getConceptsReferencingThis(conceptKey: string): string[] {
  const referencing: string[] = [];

  for (const [key, concept] of Object.entries(ghgConcepts)) {
    if (concept.relatedConcepts?.includes(conceptKey)) {
      referencing.push(key);
    }
  }

  return referencing;
}

