import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import chokidar from 'chokidar';
import { v4 as uuidv4 } from 'uuid';
import { apiRoutes, documents, settings } from '../db/index.js';
import { detectApiRoutes, generateApiDocWithTitle } from './ai.js';
import { getRepoPath, saveDocument } from './git.js';

// Common API file patterns
const API_PATTERNS = [
  '**/routes/**/*.{js,ts,py}',
  '**/api/**/*.{js,ts,py}',
  '**/controllers/**/*.{js,ts,py}',
  '**/src/**/*route*.{js,ts,py}',
  '**/src/**/*api*.{js,ts,py}',
  '**/pages/api/**/*.{js,ts}', // Next.js
  '**/app/api/**/*.{js,ts}', // Next.js App Router
  '**/server/**/*.{js,ts,py}',
  '**/backend/**/*.{js,ts,py}',
  '**/routers/**/*.py', // FastAPI routers
  '**/*_router.py', // FastAPI router files
  '**/endpoints/**/*.py', // FastAPI endpoints
];

// Parse Python/FastAPI routes without AI
const parsePythonRoutes = (content, filePath) => {
  const routes = [];
  const lines = content.split('\n');
  
  // Match FastAPI router decorators
  // @router.get("/path")
  // @router.post("/path")
  // @app.get("/path")
  // @api_router.include_router(router, prefix="/users")
  
  const methodRegex = /@(router|app|api)\.?(get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/i;
  const prefixRegex = /prefix\s*=\s*["']([^"']+)["']/i;
  const includeRouterRegex = /include_router\s*\(\s*(\w+).*prefix\s*=\s*["']([^"']+)["']/i;
  
  let currentPrefix = '';
  let routerPrefixes = {};
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // Check for include_router with prefix
    const includeMatch = line.match(includeRouterRegex);
    if (includeMatch) {
      const routerName = includeMatch[1];
      const prefix = includeMatch[2];
      routerPrefixes[routerName] = prefix;
    }
    
    // Check for method decorators
    const methodMatch = line.match(methodRegex);
    if (methodMatch) {
      const method = methodMatch[2].toUpperCase();
      let routePath = methodMatch[3];
      
      // Combine with prefix if available
      if (currentPrefix && !routePath.startsWith('/')) {
        routePath = currentPrefix + '/' + routePath;
      } else if (currentPrefix && routePath.startsWith('/')) {
        routePath = currentPrefix + routePath;
      }
      
      // Get description from next line's docstring or function name
      let description = '';
      for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
        const nextLine = lines[j].trim();
        if (nextLine.startsWith('"""') || nextLine.startsWith("'''")) {
          description = nextLine.replace(/["']/g, '').trim();
          break;
        }
        if (nextLine.startsWith('def ')) {
          const funcMatch = nextLine.match(/def\s+(\w+)/);
          if (funcMatch) {
            description = funcMatch[1].replace(/_/g, ' ');
          }
          break;
        }
      }
      
      routes.push({
        method,
        path: routePath,
        description,
        sourceFile: filePath,
        lineNumber: lineNum
      });
    }
  }
  
  return routes;
};

// Parse JavaScript/Express routes without AI
const parseJavaScriptRoutes = (content, filePath) => {
  const routes = [];
  const lines = content.split('\n');
  
  // Match Express router methods
  // router.get("/path", ...)
  // app.get("/path", ...)
  // router.route("/path").get(...)
  const methodRegex = /(router|app|express\.Router)\.(get|post|put|delete|patch)\s*\(\s*["'`]([^"'`]+)["'`]/i;
  const routeRegex = /route\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/i;
  
  let currentRoute = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // Check for route() definition
    const routeMatch = line.match(routeRegex);
    if (routeMatch) {
      currentRoute = routeMatch[1];
    }
    
    // Check for method decorators
    const methodMatch = line.match(methodRegex);
    if (methodMatch) {
      const method = methodMatch[2].toUpperCase();
      let routePath = methodMatch[3];
      
      // If we have a current route from route(), combine them
      if (currentRoute && !routePath.startsWith('/')) {
        // This might be a chained .get() after .route()
        routePath = currentRoute;
      }
      
      // Get description from comment above or function name
      let description = '';
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        const prevLine = lines[j].trim();
        if (prevLine.startsWith('//') || prevLine.startsWith('*') || prevLine.startsWith('/*')) {
          description = prevLine.replace(/^(\/\/|\*|\/\*)\s*/, '').trim();
          if (description) break;
        }
        if (prevLine && !prevLine.startsWith('//') && !prevLine.startsWith('*') && !prevLine.startsWith('/*')) {
          break;
        }
      }
      
      routes.push({
        method,
        path: routePath,
        description,
        sourceFile: filePath,
        lineNumber: lineNum
      });
    }
  }
  
  return routes;
};

// Scan for API files
const scanApiFiles = async (projectPath) => {
  const allFiles = [];
  
  for (const pattern of API_PATTERNS) {
    const files = await glob(pattern, { 
      cwd: projectPath, 
      absolute: true,
      ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/venv/**', '**/__pycache__/**', '**/tests/**']
    });
    allFiles.push(...files);
  }
  
  return [...new Set(allFiles)]; // Remove duplicates
};

// Read file contents
const readFiles = async (filePaths) => {
  const files = [];
  
  for (const filePath of filePaths) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      files.push({
        path: filePath,
        content
      });
    } catch (err) {
      console.error(`Failed to read ${filePath}:`, err.message);
    }
  }
  
  return files;
};

// Main scan function
export const scanAndUpdateApiDocs = async (projectPath = null) => {
  let scanPath = projectPath;
  if (!scanPath) {
    // Try project_code_path setting first, fall back to repo path
    const codePath = await settings.get('project_code_path');
    scanPath = (codePath && codePath.trim()) ? codePath.trim() : getRepoPath();
  }
  console.log(`Scanning for API routes in ${scanPath}...`);
  
  // Scan for API files
  const apiFiles = await scanApiFiles(scanPath);
  console.log(`Found ${apiFiles.length} potential API files`);
  
  if (apiFiles.length === 0) {
    return { scanned: 0, routes: 0 };
  }
  
  // Read file contents
  const files = await readFiles(apiFiles);
  
  // Detect routes - use AI if available, otherwise use regex parsers
  let routes = [];
  
  // Try AI first if available
  try {
    const aiRoutes = await detectApiRoutes(files);
    routes = aiRoutes;
  } catch (err) {
    console.log('AI detection not available, using regex parser');
    
    // Fallback: use regex parsers for each file type
    for (const file of files) {
      if (file.path.endsWith('.py')) {
        const pyRoutes = parsePythonRoutes(file.content, file.path);
        routes.push(...pyRoutes);
      } else if (file.path.endsWith('.js') || file.path.endsWith('.ts')) {
        const jsRoutes = parseJavaScriptRoutes(file.content, file.path);
        routes.push(...jsRoutes);
      }
    }
  }
  
  console.log(`Detected ${routes.length} API routes`);
  
  // Update database
  for (const route of routes) {
    const id = uuidv4();
    const parameters = JSON.stringify(route.parameters || []);
    const responses = JSON.stringify(route.responses || []);
    
    // Check if there's already a doc for this route
    const existingRoutes = await apiRoutes.getAll();
    const existing = existingRoutes.find(r => 
      r.method === route.method && r.path === route.path
    );
    
    let docId = existing?.doc_id;
    
    // Generate documentation if enabled and AI is available
    const apiDocEnabled = await settings.get('api_doc_enabled');
    if (apiDocEnabled === 'true') {
      try {
        const sourceFile = files.find(f => f.path === route.sourceFile);
        if (sourceFile) {
          const existingDoc = docId ? await documents.getById(docId) : null;
          const { title, content: docContent } = await generateApiDocWithTitle(
            sourceFile.content,
            route.sourceFile,
            route.method,
            route.path,
            existingDoc?.content
          );
          
          // Save documentation with human-readable title
          const docPath = `api/${route.method.toLowerCase()}_${route.path.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
          const savedDoc = await saveDocument(docPath, docContent, {
            title: title,
            api_route: true,
            method: route.method,
            path: route.path
          });
          
          docId = savedDoc.id;
        }
      } catch (err) {
        console.log('AI doc generation not available');
      }
    }
    
    await apiRoutes.createOrUpdate(
      id,
      route.method,
      route.path,
      route.description,
      parameters,
      responses,
      route.sourceFile,
      route.lineNumber || 0,
      docId
    );
  }
  
  return { scanned: files.length, routes: routes.length };
};

// Get API documentation as OpenAPI spec
export const generateOpenApiSpec = async () => {
  const routes = await apiRoutes.getAll();
  
  const paths = {};
  
  for (const route of routes) {
    if (!paths[route.path]) {
      paths[route.path] = {};
    }
    
    const method = route.method.toLowerCase();
    paths[route.path][method] = {
      summary: route.description,
      parameters: JSON.parse(route.parameters || '[]'),
      responses: JSON.parse(route.responses || '{}')
    };
  }
  
  return {
    openapi: '3.0.0',
    info: {
      title: await settings.get('site_name') || 'API Documentation',
      version: '1.0.0'
    },
    paths
  };
};

// Watch API files for changes
let watcher = null;

export const startApiWatcher = (projectPath = null, onChange) => {
  if (watcher) {
    watcher.close();
  }
  
  const watchPath = projectPath || getRepoPath();
  
  watcher = chokidar.watch(API_PATTERNS, {
    cwd: watchPath,
    ignoreInitial: true,
    persistent: true,
    ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/venv/**', '**/__pycache__/**']
  });
  
  let debounceTimer = null;
  
  watcher.on('change', async (filePath) => {
    console.log(`API file changed: ${filePath}`);
    
    // Debounce to avoid multiple scans
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const result = await scanAndUpdateApiDocs(watchPath);
      if (onChange) {
        onChange(result);
      }
    }, 5000); // Wait 5 seconds after last change
  });
  
  console.log('API watcher started');
};

export const stopApiWatcher = () => {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
};
