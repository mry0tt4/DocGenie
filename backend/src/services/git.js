import simpleGit from 'simple-git';
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';
import { marked } from 'marked';
import { v4 as uuidv4 } from 'uuid';
import { documents, links, settings, initDb } from '../db/index.js';
import { generateDocumentEmbeddings, generateTitle } from './ai.js';
import chokidar from 'chokidar';

let git = null;
let repoPath = null;
let watcher = null;

// Get repository name from path or git remote
export const getRepoName = async () => {
  if (!repoPath) return 'DocGenie';
  
  // Try to get remote URL
  try {
    const remotes = await git.getRemotes(true);
    if (remotes && remotes.length > 0) {
      const origin = remotes.find(r => r.name === 'origin') || remotes[0];
      const url = origin.refs.fetch || origin.refs.push;
      if (url) {
        // Extract repo name from URL
        // e.g., https://github.com/user/repo.git -> repo
        // or git@github.com:user/repo.git -> repo
        const match = url.match(/\/([^\/]+?)(\.git)?$/);
        if (match) {
          return match[1].replace(/\.git$/, '');
        }
      }
    }
  } catch (err) {
    // Not a git repo or no remotes
  }
  
  // Fallback to folder name
  return path.basename(repoPath);
};

// Initialize git repository
export const initRepo = async (customPath) => {
  repoPath = customPath || await settings.get('repo_path') || './docs';
  
  // Ensure repo directory exists
  try {
    await fs.access(repoPath);
  } catch {
    await fs.mkdir(repoPath, { recursive: true });
  }
  
  git = simpleGit(repoPath);
  
  // Check if git repo exists
  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    await git.init();
    console.log(`Initialized git repo at ${repoPath}`);
  }
  
  return repoPath;
};

// Get git instance
export const getGit = () => git;

// Get repo path
export const getRepoPath = () => repoPath;

// Parse wiki links from content
const extractWikiLinks = (content) => {
  const linkRegex = /\[\[([^\]]+)\]\]/g;
  const links = [];
  let match;
  
  while ((match = linkRegex.exec(content)) !== null) {
    const linkText = match[1];
    // Support [[Page Title]] or [[Page Title|Display Text]]
    const [target, display] = linkText.split('|').map(s => s.trim());
    links.push({
      targetPath: target,
      linkText: display || target
    });
  }
  
  return links;
};

// Convert wiki links to HTML
const processWikiLinks = (content, docMap) => {
  return content.replace(/\[\[([^\]]+)\]\]/g, (match, linkText) => {
    const [target, display] = linkText.split('|').map(s => s.trim());
    const targetDoc = docMap.get(target.toLowerCase());
    
    if (targetDoc) {
      return `<a href="/docs/${targetDoc.id}" class="wiki-link">${display || target}</a>`;
    } else {
      return `<a href="/docs/new?title=${encodeURIComponent(target)}" class="wiki-link missing">${display || target}</a>`;
    }
  });
};

// Sync single file to database
const syncFile = async (filePath, docMap) => {
  const relativePath = path.relative(repoPath, filePath);
  
  // Only process markdown files
  if (!filePath.endsWith('.md')) return null;
  
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = matter(content);
    
    // Get git info
    let gitSha = null;
    try {
      const log = await git.log({ file: relativePath, n: 1 });
      gitSha = log.latest ? log.latest.hash : null;
    } catch {
      gitSha = null;
    }
    
    // Generate or use existing title
    let title = parsed.data.title;
    if (!title) {
      // Try first heading
      const headingMatch = parsed.content.match(/^#\s+(.+)$/m);
      title = headingMatch ? headingMatch[1] : await generateTitle(parsed.content);
    }
    
    // Process wiki links
    const processedContent = processWikiLinks(parsed.content, docMap);
    const html = marked.parse(processedContent);
    
    // Check if document exists
    let doc = await documents.getByPath(relativePath);
    
    if (doc) {
      // Update existing
      await documents.update(doc.id, title, parsed.content, html, gitSha);
      doc = await documents.getById(doc.id);
    } else {
      // Create new
      const id = uuidv4();
      await documents.create(id, relativePath, title, parsed.content, html, gitSha);
      doc = await documents.getById(id);
    }
    
    // Update links
    await links.deleteForDocument(doc.id);
    const wikiLinks = extractWikiLinks(parsed.content);
    for (const link of wikiLinks) {
      const targetDoc = docMap.get(link.targetPath.toLowerCase());
      await links.create(
        uuidv4(),
        doc.id,
        targetDoc ? targetDoc.id : null,
        link.targetPath,
        link.linkText
      );
    }
    
    // Generate embeddings (async, don't wait)
    generateDocumentEmbeddings(doc.id, parsed.content).catch(console.error);
    
    return doc;
  } catch (err) {
    console.error(`Failed to sync ${filePath}:`, err.message);
    return null;
  }
};

// Full sync of repository
export const syncRepo = async () => {
  console.log('Starting repo sync...');
  await initDb();
  
  // Get all markdown files
  const files = await glob('**/*.md', { cwd: repoPath, absolute: true });
  
  // First pass: create/update documents and build map
  const docMap = new Map();
  for (const file of files) {
    const relativePath = path.relative(repoPath, file);
    const content = await fs.readFile(file, 'utf-8');
    const parsed = matter(content);
    const title = parsed.data.title || parsed.content.match(/^#\s+(.+)$/m)?.[1] || 'Untitled';
    
    let doc = await documents.getByPath(relativePath);
    if (!doc) {
      const id = uuidv4();
      await documents.create(id, relativePath, title, content, '', null);
      doc = await documents.getById(id);
    }
    
    docMap.set(title.toLowerCase(), doc);
    docMap.set(relativePath.replace('.md', '').toLowerCase(), doc);
  }
  
  // Second pass: process content with link resolution
  for (const file of files) {
    await syncFile(file, docMap);
  }
  
  console.log(`Synced ${files.length} documents`);
  return files.length;
};

// Save document to file and db
export const saveDocument = async (docPath, content, frontmatter = {}) => {
  const fullPath = path.join(repoPath, docPath);
  
  // Ensure directory exists
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  
  // Build content with frontmatter
  const fileContent = matter.stringify(content, frontmatter);
  
  // Write to file
  await fs.writeFile(fullPath, fileContent, 'utf-8');
  
  // Commit to git
  try {
    await git.add(docPath);
    await git.commit(`Update ${docPath}`);
  } catch (err) {
    console.log('Git commit skipped:', err.message);
  }
  
  // Sync to database
  const docMap = new Map();
  const relativePath = docPath;
  const parsed = matter(content);
  const title = frontmatter.title || parsed.content.match(/^#\s+(.+)$/m)?.[1] || 'Untitled';
  
  let doc = await documents.getByPath(relativePath);
  if (!doc) {
    const id = uuidv4();
    await documents.create(id, relativePath, title, content, '', null);
    doc = await documents.getById(id);
  }
  docMap.set(title.toLowerCase(), doc);
  
  const updatedDoc = await syncFile(fullPath, docMap);
  return updatedDoc;
};

// Delete document
export const deleteDocument = async (docId) => {
  const doc = await documents.getById(docId);
  if (!doc) return false;
  
  // Delete file
  const fullPath = path.join(repoPath, doc.path);
  try {
    await fs.unlink(fullPath);
    await git.rm(doc.path);
    await git.commit(`Delete ${doc.path}`);
  } catch (err) {
    console.error('Git delete error:', err.message);
  }
  
  // Delete from db
  await documents.delete(docId);
  return true;
};

// Start file watcher
export const startWatcher = (onChange) => {
  if (watcher) {
    watcher.close();
  }
  
  watcher = chokidar.watch('**/*.md', {
    cwd: repoPath,
    ignoreInitial: true,
    persistent: true
  });
  
  watcher.on('change', async (filePath) => {
    console.log(`File changed: ${filePath}`);
    const docMap = new Map();
    const doc = await syncFile(path.join(repoPath, filePath), docMap);
    if (doc && onChange) {
      onChange(doc);
    }
  });
  
  watcher.on('add', async (filePath) => {
    console.log(`File added: ${filePath}`);
    const docMap = new Map();
    const doc = await syncFile(path.join(repoPath, filePath), docMap);
    if (doc && onChange) {
      onChange(doc);
    }
  });
  
  console.log('File watcher started');
};

// Stop file watcher
export const stopWatcher = () => {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
};
