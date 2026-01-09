import Database from 'better-sqlite3';
import path from 'path';
import { existsSync } from 'fs';

// Database file path - find relative to this module's location
// In production, data/nzdpu.db is adjacent to dist/
function findDatabasePath(): string {
  // Try various locations
  const candidates = [
    path.join(process.cwd(), 'data', 'nzdpu.db'),  // CWD/data
    path.join(__dirname, '..', '..', 'data', 'nzdpu.db'),  // module/../data
    path.join(__dirname, '..', 'data', 'nzdpu.db'),  // module/data
  ];
  
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  
  // Default to CWD/data (for creating new database)
  return path.join(process.cwd(), 'data', 'nzdpu.db');
}

export const DB_PATH = findDatabasePath();

// SQL schema for the database
export const SCHEMA = `
-- Companies table: One row per unique company
CREATE TABLE IF NOT EXISTS companies (
  nz_id INTEGER PRIMARY KEY,
  company_name TEXT NOT NULL,
  jurisdiction TEXT,
  sics_sector TEXT,
  sics_sub_sector TEXT,
  sics_industry TEXT,
  lei TEXT,
  latest_reported_year INTEGER,
  source TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Emissions table: One row per company-year disclosure
CREATE TABLE IF NOT EXISTS emissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nz_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  scope1 REAL,
  scope1_methodology TEXT,
  scope2_lb REAL,
  scope2_mb REAL,
  scope2_lb_methodology TEXT,
  scope2_mb_methodology TEXT,
  scope3_total REAL,
  scope3_cat_1 REAL,
  scope3_cat_2 REAL,
  scope3_cat_3 REAL,
  scope3_cat_4 REAL,
  scope3_cat_5 REAL,
  scope3_cat_6 REAL,
  scope3_cat_7 REAL,
  scope3_cat_8 REAL,
  scope3_cat_9 REAL,
  scope3_cat_10 REAL,
  scope3_cat_11 REAL,
  scope3_cat_12 REAL,
  scope3_cat_13 REAL,
  scope3_cat_14 REAL,
  scope3_cat_15 REAL,
  -- Scope 3 methodology per category (method type + relevancy)
  scope3_cat_1_method TEXT,
  scope3_cat_1_relevancy TEXT,
  scope3_cat_2_method TEXT,
  scope3_cat_2_relevancy TEXT,
  scope3_cat_3_method TEXT,
  scope3_cat_3_relevancy TEXT,
  scope3_cat_4_method TEXT,
  scope3_cat_4_relevancy TEXT,
  scope3_cat_5_method TEXT,
  scope3_cat_5_relevancy TEXT,
  scope3_cat_6_method TEXT,
  scope3_cat_6_relevancy TEXT,
  scope3_cat_7_method TEXT,
  scope3_cat_7_relevancy TEXT,
  scope3_cat_8_method TEXT,
  scope3_cat_8_relevancy TEXT,
  scope3_cat_9_method TEXT,
  scope3_cat_9_relevancy TEXT,
  scope3_cat_10_method TEXT,
  scope3_cat_10_relevancy TEXT,
  scope3_cat_11_method TEXT,
  scope3_cat_11_relevancy TEXT,
  scope3_cat_12_method TEXT,
  scope3_cat_12_relevancy TEXT,
  scope3_cat_13_method TEXT,
  scope3_cat_13_relevancy TEXT,
  scope3_cat_14_method TEXT,
  scope3_cat_14_relevancy TEXT,
  scope3_cat_15_method TEXT,
  scope3_cat_15_relevancy TEXT,
  organizational_boundary TEXT,
  verification_status TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(nz_id, year),
  FOREIGN KEY (nz_id) REFERENCES companies(nz_id)
);

-- Indexes for fast queries
-- Company lookup indexes
CREATE INDEX IF NOT EXISTS idx_companies_jurisdiction ON companies(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_companies_sector ON companies(sics_sector);
CREATE INDEX IF NOT EXISTS idx_companies_sub_sector ON companies(sics_sub_sector);
CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(sics_industry);
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(company_name);

-- OPTIMIZED: Composite indexes for peer group filtering (jurisdiction + sector)
CREATE INDEX IF NOT EXISTS idx_companies_jurisdiction_sector ON companies(jurisdiction, sics_sector);
CREATE INDEX IF NOT EXISTS idx_companies_sector_jurisdiction ON companies(sics_sector, jurisdiction);

-- Emissions lookup indexes
CREATE INDEX IF NOT EXISTS idx_emissions_nz_id ON emissions(nz_id);
CREATE INDEX IF NOT EXISTS idx_emissions_year ON emissions(year);

-- OPTIMIZED: Composite index for bulk queries (nz_id + year for latest emissions lookup)
CREATE INDEX IF NOT EXISTS idx_emissions_nz_id_year ON emissions(nz_id, year DESC);

-- Scope-specific indexes (kept for top emitter queries)
CREATE INDEX IF NOT EXISTS idx_emissions_scope1 ON emissions(scope1);
CREATE INDEX IF NOT EXISTS idx_emissions_scope2_lb ON emissions(scope2_lb);
CREATE INDEX IF NOT EXISTS idx_emissions_scope2_mb ON emissions(scope2_mb);
CREATE INDEX IF NOT EXISTS idx_emissions_scope3_total ON emissions(scope3_total);
CREATE INDEX IF NOT EXISTS idx_emissions_scope3_cat_1 ON emissions(scope3_cat_1);
CREATE INDEX IF NOT EXISTS idx_emissions_scope3_cat_5 ON emissions(scope3_cat_5);
CREATE INDEX IF NOT EXISTS idx_emissions_scope3_cat_11 ON emissions(scope3_cat_11);

-- Metadata table for tracking database info
CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`;

// Initialize database with schema
export function initializeDatabase(dbPath: string = DB_PATH): Database.Database {
  const db = new Database(dbPath);
  
  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = 10000');
  db.pragma('temp_store = MEMORY');
  
  // Execute schema
  db.exec(SCHEMA);
  
  return db;
}

// Get database connection (for queries)
let dbInstance: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH, { readonly: true });

    // OPTIMIZED: Pragmas for read-heavy workload
    dbInstance.pragma('cache_size = 20000'); // 80 MB cache (was 40 MB)
    dbInstance.pragma('temp_store = MEMORY'); // In-memory temp tables
    dbInstance.pragma('mmap_size = 268435456'); // 256 MB memory-mapped I/O
    dbInstance.pragma('query_only = ON'); // Enforce read-only mode
  }
  return dbInstance;
}

// Close database connection
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

