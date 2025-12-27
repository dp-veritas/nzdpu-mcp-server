/**
 * Sector-Specific Materiality for Scope 3 Categories
 * 
 * Defines which Scope 3 categories are material for each sector,
 * based on industry characteristics and GHG Protocol guidance.
 */

export interface SectorMateriality {
  categories: number[];       // Material category numbers (ordered by importance)
  reasoning: string;          // Why these categories are material
  recommendedMethods: Record<number, string[]>;  // Recommended methodologies per category
}

/**
 * Scope 3 category names for reference
 */
export const SCOPE3_CATEGORY_NAMES: Record<number, string> = {
  1: 'Purchased Goods and Services',
  2: 'Capital Goods',
  3: 'Fuel- and Energy-Related Activities',
  4: 'Upstream Transportation and Distribution',
  5: 'Waste Generated in Operations',
  6: 'Business Travel',
  7: 'Employee Commuting',
  8: 'Upstream Leased Assets',
  9: 'Downstream Transportation and Distribution',
  10: 'Processing of Sold Products',
  11: 'Use of Sold Products',
  12: 'End-of-Life Treatment of Sold Products',
  13: 'Downstream Leased Assets',
  14: 'Franchises',
  15: 'Investments',
};

/**
 * Sector-specific material categories
 * Based on GHG Protocol, CDP guidance, and sector analysis
 */
export const MATERIAL_CATEGORIES: Record<string, SectorMateriality> = {
  // ENERGY SECTOR
  'Oil & Gas': {
    categories: [11, 10, 9, 3, 1],
    reasoning: 'Downstream combustion of sold products (Cat 11) dominates emissions profile. Processing (Cat 10) and transportation (Cat 9) are also significant. Fuel & energy activities (Cat 3) covers well-to-tank emissions.',
    recommendedMethods: {
      11: ['Fuel-based method'],
      10: ['Hybrid method', 'Site-specific method'],
      9: ['Distance-based method', 'Fuel-based method'],
      3: ['Fuel-based method', 'Supplier-specific method'],
      1: ['Hybrid method', 'Supplier-specific method'],
    }
  },
  'Coal Operations': {
    categories: [11, 10, 3, 9],
    reasoning: 'Combustion of coal by end users (Cat 11) is the largest source. Processing and fuel-related activities are secondary.',
    recommendedMethods: {
      11: ['Fuel-based method'],
      10: ['Site-specific method'],
      3: ['Fuel-based method'],
      9: ['Distance-based method'],
    }
  },
  
  // EXTRACTIVES & MINERALS PROCESSING
  'Metals & Mining': {
    categories: [1, 3, 10, 11, 4],
    reasoning: 'Purchased goods (Cat 1) for mining operations. Fuel & energy (Cat 3) significant for power-intensive processing. Processing and downstream use material for processed metals.',
    recommendedMethods: {
      1: ['Supplier-specific method', 'Hybrid method'],
      3: ['Fuel-based method'],
      10: ['Site-specific method'],
      11: ['Average-data method'],
      4: ['Distance-based method'],
    }
  },
  'Construction Materials': {
    categories: [1, 3, 11, 4, 12],
    reasoning: 'Raw materials (Cat 1) and energy (Cat 3) are primary inputs. Use of products (Cat 11) and end-of-life (Cat 12) material for building products.',
    recommendedMethods: {
      1: ['Supplier-specific method', 'Hybrid method'],
      3: ['Fuel-based method'],
      11: ['Average-data method'],
      4: ['Distance-based method'],
      12: ['Waste-type-specific method'],
    }
  },
  
  // FINANCIALS
  'Financials': {
    categories: [15, 1, 6, 7],
    reasoning: 'Financed emissions (Cat 15) are the dominant source for financial institutions. Business operations (Cat 1, 6, 7) are secondary.',
    recommendedMethods: {
      15: ['Investment-specific method'],
      1: ['Spend-based method'],
      6: ['Distance-based method', 'Spend-based method'],
      7: ['Average-data method'],
    }
  },
  'Commercial Banks': {
    categories: [15, 1, 6],
    reasoning: 'Lending portfolio emissions (Cat 15) dominate. Operational emissions secondary.',
    recommendedMethods: {
      15: ['Investment-specific method'],
      1: ['Spend-based method'],
      6: ['Distance-based method'],
    }
  },
  'Insurance': {
    categories: [15, 1, 6],
    reasoning: 'Investment portfolio emissions (Cat 15) are primary. Underwriting emissions harder to measure.',
    recommendedMethods: {
      15: ['Investment-specific method'],
      1: ['Spend-based method'],
      6: ['Distance-based method'],
    }
  },
  'Asset Management & Custody Activities': {
    categories: [15, 6, 1],
    reasoning: 'Assets under management (Cat 15) are the overwhelming majority of emissions.',
    recommendedMethods: {
      15: ['Investment-specific method'],
      6: ['Distance-based method'],
      1: ['Spend-based method'],
    }
  },
  
  // TRANSPORTATION
  'Transportation': {
    categories: [3, 11, 1, 4, 9],
    reasoning: 'Fuel & energy (Cat 3) for fleet operations. Use of sold products (Cat 11) for vehicle manufacturers. Logistics companies focus on Cat 4/9.',
    recommendedMethods: {
      3: ['Fuel-based method'],
      11: ['Fuel-based method'],
      1: ['Supplier-specific method'],
      4: ['Distance-based method', 'Fuel-based method'],
      9: ['Distance-based method', 'Fuel-based method'],
    }
  },
  'Automobiles': {
    categories: [11, 1, 3, 12],
    reasoning: 'Vehicle use phase (Cat 11) dominates total lifecycle emissions. Purchased components (Cat 1) significant. End-of-life (Cat 12) increasingly important.',
    recommendedMethods: {
      11: ['Fuel-based method'],
      1: ['Supplier-specific method', 'Hybrid method'],
      3: ['Fuel-based method'],
      12: ['Waste-type-specific method'],
    }
  },
  'Airlines': {
    categories: [3, 1, 4],
    reasoning: 'Jet fuel upstream emissions (Cat 3) are primary Scope 3 source. Aircraft purchasing (Cat 1) and freight (Cat 4) secondary.',
    recommendedMethods: {
      3: ['Fuel-based method', 'Supplier-specific method'],
      1: ['Hybrid method'],
      4: ['Distance-based method'],
    }
  },
  
  // CONSUMER GOODS
  'Food & Beverage': {
    categories: [1, 4, 5, 12, 11],
    reasoning: 'Agricultural inputs (Cat 1) dominate for food companies. Transportation (Cat 4), packaging waste (Cat 5), and product end-of-life (Cat 12) also material.',
    recommendedMethods: {
      1: ['Supplier-specific method', 'Hybrid method'],
      4: ['Distance-based method'],
      5: ['Waste-type-specific method'],
      12: ['Waste-type-specific method'],
      11: ['Average-data method'],
    }
  },
  'Apparel, Accessories & Footwear': {
    categories: [1, 4, 12, 5],
    reasoning: 'Raw materials and manufacturing (Cat 1) are primary. Logistics (Cat 4) and end-of-life (Cat 12) significant for fast fashion.',
    recommendedMethods: {
      1: ['Supplier-specific method', 'Hybrid method'],
      4: ['Distance-based method'],
      12: ['Waste-type-specific method'],
      5: ['Waste-type-specific method'],
    }
  },
  'Household & Personal Products': {
    categories: [1, 11, 12, 4],
    reasoning: 'Product ingredients (Cat 1), consumer use (Cat 11), and disposal (Cat 12) form the main emissions.',
    recommendedMethods: {
      1: ['Supplier-specific method', 'Hybrid method'],
      11: ['Average-data method'],
      12: ['Waste-type-specific method'],
      4: ['Distance-based method'],
    }
  },
  
  // TECHNOLOGY & COMMUNICATIONS
  'Technology & Communications': {
    categories: [1, 2, 11, 4],
    reasoning: 'Purchased goods/components (Cat 1), capital equipment (Cat 2), and product use (Cat 11) are key. Data centers heavily weight Cat 2.',
    recommendedMethods: {
      1: ['Supplier-specific method', 'Hybrid method'],
      2: ['Supplier-specific method', 'Spend-based method'],
      11: ['Average-data method'],
      4: ['Distance-based method'],
    }
  },
  'Hardware': {
    categories: [1, 11, 12, 4],
    reasoning: 'Component manufacturing (Cat 1), product use phase (Cat 11), and e-waste (Cat 12) are material.',
    recommendedMethods: {
      1: ['Supplier-specific method', 'Hybrid method'],
      11: ['Average-data method'],
      12: ['Waste-type-specific method'],
      4: ['Distance-based method'],
    }
  },
  'Software & IT Services': {
    categories: [1, 2, 6, 7],
    reasoning: 'Cloud infrastructure (Cat 2) and business operations (Cat 1, 6, 7) dominate for asset-light software companies.',
    recommendedMethods: {
      1: ['Spend-based method'],
      2: ['Supplier-specific method'],
      6: ['Distance-based method'],
      7: ['Average-data method'],
    }
  },
  
  // HEALTH CARE
  'Health Care': {
    categories: [1, 4, 5, 2],
    reasoning: 'Purchased medical supplies and pharmaceuticals (Cat 1), logistics (Cat 4), and medical waste (Cat 5) are primary.',
    recommendedMethods: {
      1: ['Supplier-specific method', 'Spend-based method'],
      4: ['Distance-based method'],
      5: ['Waste-type-specific method'],
      2: ['Spend-based method'],
    }
  },
  'Biotechnology & Pharmaceuticals': {
    categories: [1, 4, 11, 12],
    reasoning: 'API and raw materials (Cat 1), cold chain logistics (Cat 4), and product end-of-life (Cat 12) are key.',
    recommendedMethods: {
      1: ['Supplier-specific method', 'Hybrid method'],
      4: ['Distance-based method'],
      11: ['Average-data method'],
      12: ['Waste-type-specific method'],
    }
  },
  
  // SERVICES
  'Services': {
    categories: [1, 6, 7, 8],
    reasoning: 'Professional services primarily generate emissions through purchased services (Cat 1), travel (Cat 6, 7), and leased offices (Cat 8).',
    recommendedMethods: {
      1: ['Spend-based method'],
      6: ['Distance-based method', 'Spend-based method'],
      7: ['Average-data method'],
      8: ['Asset-specific method', 'Lessor-specific method'],
    }
  },
  'Hospitality & Recreation': {
    categories: [1, 3, 5, 6],
    reasoning: 'Food and supplies (Cat 1), energy (Cat 3), waste (Cat 5), and guest travel (Cat 6) are material.',
    recommendedMethods: {
      1: ['Supplier-specific method', 'Spend-based method'],
      3: ['Fuel-based method'],
      5: ['Waste-type-specific method'],
      6: ['Distance-based method'],
    }
  },
  
  // INFRASTRUCTURE
  'Infrastructure': {
    categories: [1, 2, 3, 4],
    reasoning: 'Construction materials (Cat 1), capital equipment (Cat 2), energy (Cat 3), and transport (Cat 4) drive infrastructure emissions.',
    recommendedMethods: {
      1: ['Supplier-specific method', 'Hybrid method'],
      2: ['Spend-based method'],
      3: ['Fuel-based method'],
      4: ['Distance-based method'],
    }
  },
  'Electric Utilities & Power Generators': {
    categories: [3, 1, 11],
    reasoning: 'Fuel supply chain (Cat 3) is primary. For electricity retailers, sold electricity use (Cat 11) may be material.',
    recommendedMethods: {
      3: ['Fuel-based method', 'Supplier-specific method'],
      1: ['Supplier-specific method'],
      11: ['Average-data method'],
    }
  },
  
  // RESOURCE TRANSFORMATION
  'Resource Transformation': {
    categories: [1, 3, 10, 11, 4],
    reasoning: 'Raw materials (Cat 1), energy (Cat 3), processing (Cat 10), and product use (Cat 11) span the value chain.',
    recommendedMethods: {
      1: ['Supplier-specific method', 'Hybrid method'],
      3: ['Fuel-based method'],
      10: ['Site-specific method'],
      11: ['Average-data method'],
      4: ['Distance-based method'],
    }
  },
  'Chemicals': {
    categories: [1, 3, 10, 11, 12],
    reasoning: 'Feedstocks (Cat 1), energy (Cat 3), downstream processing (Cat 10), and product lifecycle (Cat 11, 12) are material.',
    recommendedMethods: {
      1: ['Supplier-specific method', 'Hybrid method'],
      3: ['Fuel-based method'],
      10: ['Site-specific method'],
      11: ['Average-data method'],
      12: ['Waste-type-specific method'],
    }
  },
  
  // REAL ESTATE
  'Real Estate': {
    categories: [13, 1, 2, 3],
    reasoning: 'Tenant emissions in leased assets (Cat 13) dominate. Construction (Cat 1, 2) and building energy (Cat 3) also material.',
    recommendedMethods: {
      13: ['Asset-specific method', 'Lessor-specific method'],
      1: ['Supplier-specific method', 'Spend-based method'],
      2: ['Spend-based method'],
      3: ['Fuel-based method'],
    }
  },
};

/**
 * Get material categories for a given sector/sub-sector
 */
export function getMaterialCategories(sector: string, subSector?: string): SectorMateriality {
  // Try sub-sector first, then sector
  if (subSector && MATERIAL_CATEGORIES[subSector]) {
    return MATERIAL_CATEGORIES[subSector];
  }
  if (MATERIAL_CATEGORIES[sector]) {
    return MATERIAL_CATEGORIES[sector];
  }
  
  // Default materiality if sector not found
  return {
    categories: [1, 2, 3, 11],
    reasoning: 'Default material categories based on common emission sources. Sector-specific analysis recommended.',
    recommendedMethods: {
      1: ['Hybrid method', 'Spend-based method'],
      2: ['Spend-based method'],
      3: ['Fuel-based method'],
      11: ['Average-data method'],
    }
  };
}

/**
 * Check if a category is material for a given sector
 */
export function isCategoryMaterial(sector: string, categoryNumber: number, subSector?: string): boolean {
  const materiality = getMaterialCategories(sector, subSector);
  return materiality.categories.includes(categoryNumber);
}

/**
 * Get recommended methodology for a category within a sector
 */
export function getRecommendedMethods(sector: string, categoryNumber: number, subSector?: string): string[] {
  const materiality = getMaterialCategories(sector, subSector);
  return materiality.recommendedMethods[categoryNumber] || ['Hybrid method', 'Spend-based method'];
}

/**
 * Check if a methodology is appropriate for a category in a sector
 */
export function isMethodologyAppropriate(
  sector: string, 
  categoryNumber: number, 
  methodology: string | null,
  subSector?: string
): 'appropriate' | 'acceptable' | 'limited' | 'unknown' {
  if (!methodology) return 'unknown';
  
  const recommended = getRecommendedMethods(sector, categoryNumber, subSector);
  
  if (recommended.includes(methodology)) {
    return 'appropriate';
  }
  
  // PRIMARY tier methods are generally acceptable even if not specifically recommended
  const primaryMethods = [
    'Supplier-specific method',
    'Hybrid method',
    'Asset-specific method',
    'Fuel-based method',
    'Site-specific method',
    'Lessor-specific method',
    'Lessee-specific method',
    'Franchise-specific method',
    'Investment-specific method',
  ];
  
  if (primaryMethods.includes(methodology)) {
    return 'acceptable';
  }
  
  // MODELED methods are limited but usable
  return 'limited';
}

