import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || './data/docgenie.db';

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db = null;

export const initDb = async () => {
  db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });
  
  // Enable WAL mode
  await db.run('PRAGMA journal_mode = WAL');
  
  return db;
};

export const getDb = () => {
  if (!db) throw new Error('Database not initialized');
  return db;
};

// Run migrations
export const runMigrations = async () => {
  const database = await initDb();
  
  console.log('Running migrations...');
  
  // Documents table
  await database.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      path TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      html TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      git_sha TEXT,
      last_synced_at DATETIME
    )
  `);
  
  // Embeddings table
  await database.exec(`
    CREATE TABLE IF NOT EXISTS embeddings (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      embedding TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    )
  `);
  
  // Links table
  await database.exec(`
    CREATE TABLE IF NOT EXISTS links (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      target_id TEXT,
      target_path TEXT NOT NULL,
      link_text TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (source_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (target_id) REFERENCES documents(id) ON DELETE SET NULL
    )
  `);
  
  // API routes table
  await database.exec(`
    CREATE TABLE IF NOT EXISTS api_routes (
      id TEXT PRIMARY KEY,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      description TEXT,
      parameters TEXT,
      responses TEXT,
      source_file TEXT,
      line_number INTEGER,
      doc_id TEXT,
      last_detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(method, path)
    )
  `);
  
  // Settings table
  await database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Users table
  await database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Insert default settings
  await database.run(`
    INSERT OR IGNORE INTO settings (key, value) VALUES 
      ('repo_path', './docs'),
      ('openai_api_key', ''),
      ('site_name', 'DocGenie'),
      ('auto_sync_enabled', 'true'),
      ('api_doc_enabled', 'true'),
      ('project_code_path', ''),
      ('logo_url', '')
  `);
  
  // Add category column to documents if it doesn't exist
  try {
    const columns = await database.all(`PRAGMA table_info(documents)`);
    const hasCategory = columns.some(col => col.name === 'category');
    if (!hasCategory) {
      await database.exec(`ALTER TABLE documents ADD COLUMN category TEXT DEFAULT 'uncategorized'`);
    }
    const hasSubcategory = columns.some(col => col.name === 'subcategory');
    if (!hasSubcategory) {
      await database.exec(`ALTER TABLE documents ADD COLUMN subcategory TEXT DEFAULT ''`);
    }
  } catch (err) {
    console.log('Category column migration skipped (may already exist)');
  }
  
  console.log('Migrations complete!');
};

// Document operations
export const documents = {
  getAll: async () => {
    const db = getDb();
    return db.all('SELECT * FROM documents ORDER BY updated_at DESC');
  },
  
  getById: async (id) => {
    const db = getDb();
    return db.get('SELECT * FROM documents WHERE id = ?', id);
  },
  
  getByPath: async (path) => {
    const db = getDb();
    return db.get('SELECT * FROM documents WHERE path = ?', path);
  },
  
  create: async (id, docPath, title, content, html, gitSha) => {
    const db = getDb();
    return db.run(
      `INSERT INTO documents (id, path, title, content, html, git_sha, last_synced_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [id, docPath, title, content, html, gitSha]
    );
  },
  
  update: async (id, title, content, html, gitSha) => {
    const db = getDb();
    return db.run(
      `UPDATE documents 
       SET title = ?, content = ?, html = ?, git_sha = ?, updated_at = datetime('now'), last_synced_at = datetime('now')
       WHERE id = ?`,
      [title, content, html, gitSha, id]
    );
  },
  
  delete: async (id) => {
    const db = getDb();
    return db.run('DELETE FROM documents WHERE id = ?', id);
  },
  
  search: async (query) => {
    const db = getDb();
    const searchTerm = `%${query}%`;
    return db.all(
      `SELECT * FROM documents 
       WHERE title LIKE ? OR content LIKE ?
       ORDER BY updated_at DESC`,
      [searchTerm, searchTerm]
    );
  },
  
  updateCategory: async (id, category, subcategory = '') => {
    const db = getDb();
    return db.run(
      `UPDATE documents SET category = ?, subcategory = ?, updated_at = datetime('now') WHERE id = ?`,
      [category, subcategory, id]
    );
  },
  
  getByCategory: async (category) => {
    const db = getDb();
    return db.all(
      `SELECT * FROM documents WHERE category = ? ORDER BY subcategory, updated_at DESC`,
      [category]
    );
  },
  
  getCategories: async () => {
    const db = getDb();
    return db.all(
      `SELECT DISTINCT category, COUNT(*) as count FROM documents GROUP BY category ORDER BY category`
    );
  },
  
  getSubcategories: async (category) => {
    const db = getDb();
    return db.all(
      `SELECT DISTINCT subcategory, COUNT(*) as count FROM documents WHERE category = ? AND subcategory != '' GROUP BY subcategory ORDER BY subcategory`,
      [category]
    );
  },
  
  getCategorized: async () => {
    const db = getDb();
    return db.all(
      `SELECT id, title, path, category, subcategory FROM documents WHERE category IS NOT NULL ORDER BY category, subcategory, title`
    );
  }
};

// Link operations
export const links = {
  getForDocument: async (docId) => {
    const db = getDb();
    return db.all(`
      SELECT l.*, d.title as target_title 
      FROM links l
      LEFT JOIN documents d ON l.target_id = d.id
      WHERE l.source_id = ?
    `, docId);
  },
  
  getBacklinks: async (docId) => {
    const db = getDb();
    return db.all(`
      SELECT l.*, d.title as source_title, d.path as source_path
      FROM links l
      JOIN documents d ON l.source_id = d.id
      WHERE l.target_id = ?
    `, docId);
  },
  
  create: async (id, sourceId, targetId, targetPath, linkText) => {
    const db = getDb();
    return db.run(
      `INSERT INTO links (id, source_id, target_id, target_path, link_text)
       VALUES (?, ?, ?, ?, ?)`,
      [id, sourceId, targetId, targetPath, linkText]
    );
  },
  
  deleteForDocument: async (docId) => {
    const db = getDb();
    return db.run('DELETE FROM links WHERE source_id = ?', docId);
  }
};

// Settings operations
export const settings = {
  get: async (key) => {
    const db = getDb();
    const row = await db.get('SELECT value FROM settings WHERE key = ?', key);
    return row ? row.value : null;
  },
  
  getAll: async () => {
    const db = getDb();
    return db.all('SELECT * FROM settings');
  },
  
  set: async (key, value) => {
    const db = getDb();
    return db.run(
      `INSERT INTO settings (key, value, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [key, value]
    );
  }
};

// API Routes operations
export const apiRoutes = {
  getAll: async () => {
    const db = getDb();
    return db.all('SELECT * FROM api_routes ORDER BY path');
  },
  
  getById: async (id) => {
    const db = getDb();
    return db.get('SELECT * FROM api_routes WHERE id = ?', id);
  },
  
  createOrUpdate: async (id, method, path, description, parameters, responses, sourceFile, lineNumber, docId) => {
    const db = getDb();
    return db.run(
      `INSERT INTO api_routes (id, method, path, description, parameters, responses, source_file, line_number, doc_id, last_detected_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(method, path) DO UPDATE SET
        description = excluded.description,
        parameters = excluded.parameters,
        responses = excluded.responses,
        source_file = excluded.source_file,
        line_number = excluded.line_number,
        doc_id = excluded.doc_id,
        last_detected_at = datetime('now')`,
      [id, method, path, description, parameters, responses, sourceFile, lineNumber, docId]
    );
  },
  
  delete: async (id) => {
    const db = getDb();
    return db.run('DELETE FROM api_routes WHERE id = ?', id);
  }
};

// Embeddings operations
export const embeddings = {
  getForDocument: async (docId) => {
    const db = getDb();
    return db.all('SELECT * FROM embeddings WHERE document_id = ? ORDER BY chunk_index', docId);
  },
  
  create: async (id, docId, chunkIndex, chunkText, embedding) => {
    const db = getDb();
    return db.run(
      `INSERT INTO embeddings (id, document_id, chunk_index, chunk_text, embedding)
       VALUES (?, ?, ?, ?, ?)`,
      [id, docId, chunkIndex, chunkText, embedding]
    );
  },
  
  deleteForDocument: async (docId) => {
    const db = getDb();
    return db.run('DELETE FROM embeddings WHERE document_id = ?', docId);
  },
  
  getAllWithEmbeddings: async () => {
    const db = getDb();
    return db.all('SELECT * FROM embeddings WHERE embedding IS NOT NULL');
  }
};
