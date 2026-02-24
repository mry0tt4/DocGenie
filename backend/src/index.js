import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';

import { initDb, runMigrations, documents, links, settings, apiRoutes, embeddings } from './db/index.js';
import { initOpenAI, semanticSearch, generateDocumentEmbeddings, generateKnowledgeDoc, categorizeDocument, categorizeDocuments } from './services/ai.js';
import { initRepo, syncRepo, saveDocument, deleteDocument, startWatcher, stopWatcher, getRepoPath, getRepoName } from './services/git.js';
import { scanAndUpdateApiDocs, generateOpenApiSpec, startApiWatcher, stopApiWatcher } from './services/apiDocs.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer config for logo upload
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo${ext}`);
  }
});
const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/gif'];
    cb(null, allowed.includes(file.mimetype));
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (logos etc)
app.use('/uploads', express.static(uploadsDir));

// Initialize services
let repoPath = null;

const initialize = async () => {
  // Init Database and run migrations
  await runMigrations();
  
  // Init OpenAI
  const openaiKey = process.env.OPENAI_API_KEY || await settings.get('openai_api_key');
  initOpenAI(openaiKey);
  
  // Init Git repo
  repoPath = await initRepo(process.env.REPO_PATH);
  console.log(`Git repo initialized at: ${repoPath}`);
  
  // Initial sync
  await syncRepo();
  
  // Start file watcher
  startWatcher((doc) => {
    console.log(`Document updated: ${doc.title}`);
  });
  
  // Start API watcher if enabled
  const apiDocEnabled = await settings.get('api_doc_enabled');
  if (apiDocEnabled === 'true') {
    startApiWatcher(null, (result) => {
      console.log(`API scan complete: ${result.routes} routes found`);
    });
  }
};

// ===== DOCUMENTS API =====

// Get all documents
app.get('/api/documents', async (req, res) => {
  const docs = await documents.getAll();
  res.json(docs);
});

// Get all categorized documents (for sidebar) - must be before :id route
app.get('/api/documents/categorized', async (req, res) => {
  try {
    const docs = await documents.getCategorized();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single document
app.get('/api/documents/:id', async (req, res) => {
  const doc = await documents.getById(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }
  
  // Get links
  const outgoing = await links.getForDocument(doc.id);
  const incoming = await links.getBacklinks(doc.id);
  
  res.json({
    ...doc,
    links: { outgoing, incoming }
  });
});

// Create/update document
app.post('/api/documents', async (req, res) => {
  const { path: docPath, content, frontmatter } = req.body;
  
  if (!docPath || !content) {
    return res.status(400).json({ error: 'Path and content are required' });
  }
  
  try {
    const doc = await saveDocument(docPath, content, frontmatter);
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update document
app.put('/api/documents/:id', async (req, res) => {
  const doc = await documents.getById(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }
  
  const { content, frontmatter } = req.body;
  
  try {
    const updated = await saveDocument(doc.path, content, frontmatter);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete document
app.delete('/api/documents/:id', async (req, res) => {
  try {
    const success = await deleteDocument(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search documents
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'Query required' });
  }
  
  const results = await documents.search(q);
  res.json(results);
});

// Semantic search
app.get('/api/search/semantic', async (req, res) => {
  const { q, limit } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'Query required' });
  }
  
  try {
    const results = await semanticSearch(q, parseInt(limit) || 10);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== CATEGORIES API =====

// Get all categories with counts
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await documents.getCategories();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get subcategories for a category
app.get('/api/categories/:category/subcategories', async (req, res) => {
  try {
    const subcategories = await documents.getSubcategories(req.params.category);
    res.json(subcategories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get documents by category
app.get('/api/categories/:category', async (req, res) => {
  try {
    const docs = await documents.getByCategory(req.params.category);
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Categorize a single document
app.post('/api/documents/:id/categorize', async (req, res) => {
  try {
    const doc = await documents.getById(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    const { category, subcategory } = await categorizeDocument(doc.title, doc.content);
    await documents.updateCategory(doc.id, category, subcategory);
    res.json({ id: doc.id, category, subcategory });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Categorize all uncategorized documents
app.post('/api/documents/categorize-all', async (req, res) => {
  try {
    const allDocs = await documents.getAll();
    const uncategorized = allDocs.filter(d => !d.category || d.category === 'uncategorized');
    
    if (uncategorized.length === 0) {
      return res.json({ message: 'No uncategorized documents found', categorized: 0 });
    }
    
    const results = await categorizeDocuments(uncategorized);
    
    for (const result of results) {
      await documents.updateCategory(result.id, result.category, result.subcategory);
    }
    
    res.json({ message: `Categorized ${results.length} documents`, categorized: results.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== SETTINGS API =====

// Get all settings
app.get('/api/settings', async (req, res) => {
  const allSettings = await settings.getAll();
  // Remove sensitive data
  const safeSettings = allSettings.map(s => ({
    ...s,
    value: s.key.includes('key') || s.key.includes('secret') 
      ? '***' 
      : s.value
  }));
  res.json(safeSettings);
});

// Update setting
app.put('/api/settings/:key', async (req, res) => {
  const { value } = req.body;
  await settings.set(req.params.key, value);
  
  // Re-initialize OpenAI if API key was updated
  if (req.params.key === 'openai_api_key' && value) {
    const result = initOpenAI(value);
    console.log(result ? 'OpenAI re-initialized with new key' : 'Failed to init OpenAI');
  }
  
  // Re-initialize repo if repo_path was updated
  if (req.params.key === 'repo_path' && value) {
    try {
      stopWatcher();
      stopApiWatcher();
      repoPath = await initRepo(value);
      console.log(`Repo re-initialized at: ${repoPath}`);
      await syncRepo();
      startWatcher((doc) => {
        console.log(`Document updated: ${doc.title}`);
      });
      const apiDocEnabled = await settings.get('api_doc_enabled');
      if (apiDocEnabled === 'true') {
        startApiWatcher(null, (result) => {
          console.log(`API scan complete: ${result.routes} routes found`);
        });
      }
    } catch (err) {
      console.error('Failed to re-initialize repo:', err.message);
    }
  }
  
  res.json({ success: true });
});

// Upload logo
app.post('/api/settings/logo', logoUpload.single('logo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No valid image file provided' });
  }
  
  // Delete old logo files (different extensions)
  const exts = ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif'];
  for (const ext of exts) {
    const oldPath = path.join(uploadsDir, `logo${ext}`);
    if (oldPath !== req.file.path && fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }
  
  const logoUrl = `/uploads/${req.file.filename}`;
  await settings.set('logo_url', logoUrl);
  res.json({ success: true, url: logoUrl });
});

// Delete logo
app.delete('/api/settings/logo', async (req, res) => {
  const exts = ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif'];
  for (const ext of exts) {
    const logoPath = path.join(uploadsDir, `logo${ext}`);
    if (fs.existsSync(logoPath)) {
      fs.unlinkSync(logoPath);
    }
  }
  await settings.set('logo_url', '');
  res.json({ success: true });
});

// ===== GIT API =====

// Sync repository
app.post('/api/sync', async (req, res) => {
  try {
    const count = await syncRepo();
    res.json({ synced: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get repo status
app.get('/api/repo', (req, res) => {
  res.json({ path: repoPath });
});

// Get repo name (from git remote or folder)
app.get('/api/repo/name', async (req, res) => {
  try {
    const name = await getRepoName();
    res.json({ name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== API ROUTES DOCS =====

// Get all API routes
app.get('/api/routes', async (req, res) => {
  const routes = await apiRoutes.getAll();
  res.json(routes);
});

// Scan for API routes
app.post('/api/routes/scan', async (req, res) => {
  try {
    const result = await scanAndUpdateApiDocs(req.body.projectPath);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get OpenAPI spec
app.get('/api/openapi.json', async (req, res) => {
  const spec = await generateOpenApiSpec();
  res.json(spec);
});

// ===== GENERATE DOCS =====

// Generate a knowledge document (Quick Start, Overview, etc.)
app.post('/api/generate', async (req, res) => {
  const { type, projectName, extraInfo } = req.body;
  
  if (!type) {
    return res.status(400).json({ error: 'Document type is required. Options: quick-start, overview, authentication, changelog, deployment, contributing' });
  }
  
  try {
    const siteName = await settings.get('site_name') || 'My Project';
    
    // Get the project code path — this is the actual codebase to document
    const projectCodePath = await settings.get('project_code_path');
    
    const { title, content } = await generateKnowledgeDoc(type, {
      projectName: projectName || siteName,
      projectPath: projectCodePath && projectCodePath.trim() ? projectCodePath.trim() : null,
      extraInfo
    });
    
    // Save as a document
    const docPath = `guides/${type}.md`;
    const savedDoc = await saveDocument(docPath, content, { title });
    
    res.json({ success: true, document: savedDoc, title, content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List available document types
app.get('/api/generate/types', (req, res) => {
  res.json([
    { id: 'quick-start', name: 'Quick Start Guide', description: 'Get developers up and running in minutes', icon: '🚀' },
    { id: 'overview', name: 'Project Overview', description: 'Architecture, tech stack, and key concepts', icon: '📖' },
    { id: 'authentication', name: 'Authentication Guide', description: 'Auth flows, tokens, and security', icon: '🔐' },
    { id: 'deployment', name: 'Deployment Guide', description: 'Server setup, Docker, and CI/CD', icon: '🚢' },
    { id: 'changelog', name: 'Changelog', description: 'Version history and release notes', icon: '📋' },
    { id: 'contributing', name: 'Contributing Guide', description: 'How to contribute to the project', icon: '🤝' }
  ]);
});

// ===== HEALTH =====

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', repo: repoPath });
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  await initialize();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...');
  stopWatcher();
  stopApiWatcher();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Shutting down...');
  stopWatcher();
  stopApiWatcher();
  process.exit(0);
});

export default app;
