import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { embeddings as embeddingsDb, documents, apiRoutes } from '../db/index.js';

let openai = null;

export const initOpenAI = (apiKey) => {
  if (!apiKey) {
    console.warn('OpenAI API key not set. AI features will be disabled.');
    return false;
  }
  openai = new OpenAI({ apiKey });
  return true;
};

// Chunk text into smaller pieces
const chunkText = (text, maxChunkSize = 1000, overlap = 100) => {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + maxChunkSize;
    
    // Try to end at a sentence or paragraph boundary
    if (end < text.length) {
      const nextPeriod = text.indexOf('. ', end - overlap);
      const nextNewline = text.indexOf('\n\n', end - overlap);
      const nextBreak = Math.min(
        nextPeriod > 0 ? nextPeriod : end,
        nextNewline > 0 ? nextNewline : end
      );
      if (nextBreak > start && nextBreak < end + 200) {
        end = nextBreak + 1;
      }
    }
    
    chunks.push(text.slice(start, end).trim());
    start = end - overlap;
  }
  
  return chunks;
};

// Generate embeddings for document
export const generateDocumentEmbeddings = async (docId, content) => {
  if (!openai) {
    throw new Error('OpenAI not initialized');
  }
  
  // Delete existing embeddings
  await embeddingsDb.deleteForDocument(docId);
  
  // Chunk the content
  const chunks = chunkText(content);
  
  // Generate embeddings for each chunk
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: chunk,
    });
    
    const embedding = Buffer.from(JSON.stringify(response.data[0].embedding));
    
    await embeddingsDb.create(uuidv4(), docId, i, chunk, embedding);
  }
  
  return chunks.length;
};

// Semantic search
export const semanticSearch = async (query, limit = 10) => {
  if (!openai) {
    throw new Error('OpenAI not initialized');
  }
  
  // Generate embedding for query
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });
  
  const queryEmbedding = response.data[0].embedding;
  
  // Get all embeddings
  const allEmbeddings = await embeddingsDb.getAllWithEmbeddings();
  
  // Calculate cosine similarity
  const results = allEmbeddings.map(row => {
    const docEmbedding = JSON.parse(row.embedding.toString());
    const similarity = cosineSimilarity(queryEmbedding, docEmbedding);
    return {
      ...row,
      similarity
    };
  });
  
  // Sort by similarity and return top results
  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
};

// Cosine similarity
const cosineSimilarity = (a, b) => {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

// Generate a human-readable title for an API endpoint
const generateHumanTitle = (method, path, description) => {
  // If AI provided a good description, use it
  if (description && description.length > 5 && !description.match(/^(get|post|put|delete|patch)\s/i)) {
    // Capitalize first letter
    return description.charAt(0).toUpperCase() + description.slice(1);
  }
  
  // Generate from method + path
  const cleanPath = path
    .replace(/^\/api\//, '')
    .replace(/\/:[a-zA-Z_]+/g, '')
    .replace(/\/:id/g, '')
    .replace(/\//g, ' ')
    .replace(/[_-]/g, ' ')
    .trim();
  
  const resource = cleanPath || 'Resource';
  const capitalResource = resource.charAt(0).toUpperCase() + resource.slice(1);
  
  const verbs = {
    'GET': 'Get',
    'POST': 'Create',
    'PUT': 'Update',
    'PATCH': 'Update',
    'DELETE': 'Delete'
  };
  
  const verb = verbs[method] || method;
  
  // Check if path has an ID parameter (single resource vs collection)
  const hasId = path.includes(':id') || path.includes('{id}') || path.match(/\/:[a-zA-Z_]+$/);
  
  if (method === 'GET' && !hasId) {
    return `List ${capitalResource}`;
  }
  
  return `${verb} ${capitalResource}`;
};

// Generate API documentation from code
export const generateApiDoc = async (code, filePath, existingDoc = '') => {
  if (!openai) {
    throw new Error('OpenAI not initialized');
  }
  
  const prompt = `Analyze this API route code and generate documentation in Markdown format that is both human-readable AND machine/agent-parseable.

File: ${filePath}

Code:
\`\`\`
${code}
\`\`\`

${existingDoc ? `Existing documentation (update if needed):\n${existingDoc}\n\n` : ''}
Generate comprehensive markdown documentation following this structure:

## \`METHOD /path\`

**Description:** One-line summary of what this endpoint does.

### Request

- **Method:** \`GET\` | \`POST\` | \`PUT\` | \`DELETE\`
- **Path:** \`/api/example/:id\`
- **Auth Required:** Yes/No
- **Content-Type:** \`application/json\` (if applicable)

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Resource identifier |

#### Query Parameters
(same table format, or "None")

#### Request Body
\`\`\`json
{
  "field": "type — description"
}
\`\`\`

### Response

#### Success (200)
\`\`\`json
{
  "example": "response"
}
\`\`\`

#### Errors
| Code | Description |
|------|-------------|
| 400 | Bad request — missing required fields |
| 404 | Resource not found |

### Example

\`\`\`bash
curl -X GET http://localhost:3001/api/example/123
\`\`\`

---

IMPORTANT FORMATTING RULES:
- Always specify the language after opening code fences (e.g. \`\`\`json, \`\`\`bash, \`\`\`javascript)
- Use consistent table formatting
- Include realistic example request/response payloads based on the actual code
- Document all status codes the endpoint can return
- Use structured, predictable headings so automated tools can parse the docs
- Be precise about types (string, number, boolean, object, array)`;

  const response = await openai.chat.completions.create({
    model: 'gpt-5-mini',
    messages: [
      { role: 'system', content: 'You are a technical documentation writer specializing in API references. Generate documentation that is clear for human developers AND structured enough for AI agents and automated tools to parse. Always use proper code fence language tags (```json, ```bash, etc). Use consistent markdown heading hierarchy and table formats.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
  });
  
  return response.choices[0].message.content;
};

// Generate a document with a human-readable title
export const generateApiDocWithTitle = async (code, filePath, method, routePath, existingDoc = '') => {
  const content = await generateApiDoc(code, filePath, existingDoc);
  
  // Ask AI for a human-friendly title
  let title = `${method} ${routePath}`;
  try {
    const titleResponse = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: 'Generate a short, human-readable title (3-6 words) for this API endpoint documentation. The title should describe what the endpoint does, not just repeat the HTTP method and path. Do NOT include quotes in your response.' },
        { role: 'user', content: `Method: ${method}\nPath: ${routePath}\n\nDocumentation:\n${content.slice(0, 500)}` }
      ],
      temperature: 0.3,
      max_tokens: 30,
    });
    title = titleResponse.choices[0].message.content.trim().replace(/[\"']/g, '');
  } catch (err) {
    // Fallback to generated title
    title = generateHumanTitle(method, routePath, '');
  }
  
  return { title, content };
};

// Detect API routes from code
export const detectApiRoutes = async (files) => {
  if (!openai) {
    throw new Error('OpenAI not initialized');
  }
  
  const routes = [];
  
  for (const file of files) {
    const prompt = `Analyze this code file and extract all API routes/endpoints.

File: ${file.path}

Code:
\`\`\`
${file.content}
\`\`\`

Return a JSON array of routes with this structure:
[
  {
    "method": "GET|POST|PUT|DELETE|PATCH",
    "path": "/api/users/:id",
    "description": "Brief description of what this endpoint does",
    "parameters": [
      { "name": "id", "type": "string", "in": "path", "required": true, "description": "User ID" }
    ],
    "responses": [
      { "code": 200, "description": "Success", "schema": "User object" }
    ],
    "lineNumber": 42
  }
]

Only return valid JSON, no markdown formatting.`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: 'You are a code analyzer. Extract API routes from code and return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
      });
      
      const content = response.choices[0].message.content;
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const fileRoutes = JSON.parse(jsonMatch[0]);
        routes.push(...fileRoutes.map(r => ({ ...r, sourceFile: file.path })));
      }
    } catch (err) {
      console.error(`Failed to analyze ${file.path}:`, err.message);
    }
  }
  
  return routes;
};

// Generate a knowledge document (Quick Start Guide, Overview, etc.)
export const generateKnowledgeDoc = async (type, context = {}) => {
  if (!openai) {
    throw new Error('OpenAI not initialized');
  }
  
  const projectName = context.projectName || 'the project';
  const projectPath = context.projectPath || null;
  
  // ===== Gather context from the ACTUAL project codebase =====
  let codebaseContext = '';
  let readmeContent = '';
  let packageInfo = '';
  let envExample = '';
  let fileTree = '';
  
  if (projectPath) {
    const fsSync = await import('fs');
    const pathMod = await import('path');
    const { glob: globFn } = await import('glob');
    
    // 1. Read README if it exists
    for (const readmeName of ['README.md', 'readme.md', 'README.rst', 'README']) {
      const readmePath = pathMod.default.join(projectPath, readmeName);
      try {
        readmeContent = fsSync.default.readFileSync(readmePath, 'utf-8').slice(0, 3000);
        break;
      } catch {}
    }
    
    // 2. Read package.json / pyproject.toml / requirements.txt
    for (const pkgFile of ['package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod', 'pom.xml']) {
      const pkgPath = pathMod.default.join(projectPath, pkgFile);
      try {
        packageInfo = fsSync.default.readFileSync(pkgPath, 'utf-8').slice(0, 2000);
        break;
      } catch {}
    }
    
    // 3. Read .env.example or .env.sample
    for (const envFile of ['.env.example', '.env.sample', 'env.example', '.env.template']) {
      const envPath = pathMod.default.join(projectPath, envFile);
      try {
        envExample = fsSync.default.readFileSync(envPath, 'utf-8').slice(0, 1500);
        break;
      } catch {}
    }
    
    // 4. Get file tree (top 2 levels)
    try {
      const entries = fsSync.default.readdirSync(projectPath, { withFileTypes: true });
      const tree = [];
      for (const entry of entries) {
        if (['node_modules', '.git', 'dist', 'build', '__pycache__', 'venv', '.venv', '.next'].includes(entry.name)) continue;
        if (entry.isDirectory()) {
          try {
            const subEntries = fsSync.default.readdirSync(pathMod.default.join(projectPath, entry.name));
            const filtered = subEntries.filter(s => !['node_modules', '.git', '__pycache__'].includes(s)).slice(0, 15);
            tree.push(`📁 ${entry.name}/\n${filtered.map(s => `   ${s}`).join('\n')}`);
          } catch {
            tree.push(`📁 ${entry.name}/`);
          }
        } else {
          tree.push(`📄 ${entry.name}`);
        }
      }
      fileTree = tree.join('\n');
    } catch {}
    
    // 5. Read key source files (entry points, configs)
    const keyFiles = ['src/index.js', 'src/index.ts', 'src/app.js', 'src/app.ts', 'src/main.py', 'app.py', 'main.py',
                      'src/server.js', 'src/server.ts', 'index.js', 'index.ts', 'server.js',
                      'docker-compose.yml', 'Dockerfile', 'Makefile'];
    const codeSnippets = [];
    for (const kf of keyFiles) {
      const kfPath = pathMod.default.join(projectPath, kf);
      try {
        const content = fsSync.default.readFileSync(kfPath, 'utf-8');
        codeSnippets.push(`--- ${kf} ---\n${content.slice(0, 1500)}`);
        if (codeSnippets.length >= 3) break;
      } catch {}
    }
    
    codebaseContext = [
      readmeContent ? `## Existing README\n${readmeContent}` : '',
      packageInfo ? `## Package/Project Config\n\`\`\`\n${packageInfo}\n\`\`\`` : '',
      envExample ? `## Environment Variables (.env.example)\n\`\`\`\n${envExample}\n\`\`\`` : '',
      fileTree ? `## File Structure\n\`\`\`\n${fileTree}\n\`\`\`` : '',
      codeSnippets.length ? `## Key Source Files\n${codeSnippets.join('\n\n')}` : '',
    ].filter(Boolean).join('\n\n');
  }
  
  // Also include detected API routes from the database
  const allRoutes = await apiRoutes.getAll();
  const routesContext = allRoutes
    .map(r => `- ${r.method} ${r.path}: ${r.description || 'No description'}`)
    .join('\n');
  
  const fullContext = [
    codebaseContext,
    routesContext ? `## Detected API Routes\n${routesContext}` : '',
    context.extraInfo ? `## Additional Context\n${context.extraInfo}` : ''
  ].filter(Boolean).join('\n\n');
  
  const prompts = {
    'quick-start': {
      system: `You are a technical writer creating a Quick Start guide for ${projectName}. Write in a friendly, approachable tone. Include code examples with proper language tags. The guide should get a developer from zero to running the project in under 5 minutes. Base EVERYTHING on the actual project context provided — do NOT make up features or config that doesn't exist in the codebase.`,
      user: `Generate a Quick Start Guide for ${projectName}.

${fullContext}

Create a comprehensive Quick Start guide with:
1. **Prerequisites** — what you need installed (based on the actual tech stack)
2. **Installation** — step-by-step setup (based on actual package manager and config)
3. **Configuration** — environment variables and settings (based on .env.example)
4. **First Run** — how to start the project (based on actual scripts)
5. **Your First API Call** — a working example using actual endpoints
6. **Next Steps** — what to explore next

Use proper markdown with code blocks (specify language), headers, and callout boxes (> **Note:** ...).
IMPORTANT: Only document what actually exists in the codebase. Do not invent endpoints or configuration.`
    },
    
    'overview': {
      system: `You are a technical writer creating a project overview for ${projectName}. Be concise but comprehensive. Base everything on the actual codebase context provided.`,
      user: `Generate a Project Overview document for ${projectName}.

${fullContext}

Create an overview document with:
1. **What is ${projectName}?** — one-paragraph description based on the actual code
2. **Architecture** — high-level system design based on the file structure and code
3. **Key Concepts** — important terms and domain concepts
4. **Tech Stack** — actual technologies used (from package.json/requirements)
5. **Project Structure** — directory layout (use the actual file tree)
6. **API Overview** — summary of actual endpoints grouped by resource

IMPORTANT: Only describe what actually exists. Do not invent features.`
    },
    
    'authentication': {
      system: `You are a technical writer creating authentication documentation for ${projectName}. Be precise about security details. Base everything on the actual codebase.`,
      user: `Generate an Authentication Guide for ${projectName}.

${fullContext}

Create authentication docs with:
1. **Overview** — how auth actually works in this project (look for JWT, sessions, API keys, OAuth in the code)
2. **Getting Credentials** — how to get API keys / tokens
3. **Making Authenticated Requests** — headers, tokens, examples
4. **Error Handling** — common auth errors and fixes
5. **Security Best Practices**

Include code examples in multiple languages (curl, JavaScript, Python).
IMPORTANT: Base the auth flow on what's actually implemented in the code.`
    },
    
    'changelog': {
      system: 'You are a technical writer creating a changelog template. Use Keep a Changelog format.',
      user: `Generate a Changelog document for ${projectName}.

${fullContext}

Create a well-structured changelog with:
- [Unreleased] section at the top
- An initial 1.0.0 release section with features based on what exists in the codebase
- Categories: Added, Changed, Deprecated, Removed, Fixed, Security
- Follow https://keepachangelog.com/ format`
    },
    
    'deployment': {
      system: `You are a DevOps engineer writing deployment documentation for ${projectName}. Be specific about commands and configuration. Base everything on the actual project setup.`,
      user: `Generate a Deployment Guide for ${projectName}.

${fullContext}

Create deployment docs covering:
1. **Prerequisites** — actual server requirements based on tech stack
2. **Environment Setup** — actual environment variables from .env.example
3. **Docker Deployment** — based on actual Dockerfile/docker-compose if they exist
4. **Manual Deployment** — step-by-step based on actual build/start scripts
5. **Reverse Proxy Setup** — Nginx/Caddy config for this project
6. **SSL/TLS** — HTTPS setup
7. **Monitoring** — health checks (use actual health endpoints if they exist)
8. **Troubleshooting** — common deployment issues for this tech stack

IMPORTANT: Use actual scripts, ports, and config from the codebase.`
    },
    
    'contributing': {
      system: `You are writing a contributing guide for ${projectName}. Be welcoming and clear. Base setup instructions on the actual project.`,
      user: `Generate a Contributing Guide for ${projectName}.

${fullContext}

Create a guide covering:
1. **Getting Started** — actual dev environment setup based on the real project
2. **Code Style** — conventions based on actual linters/formatters in the project
3. **Making Changes** — branching, commits, PRs
4. **Testing** — how to run tests (based on actual test scripts)
5. **Documentation** — how to update docs
6. **Code of Conduct** — basic community guidelines`
    }
  };
  
  const selectedPrompt = prompts[type];
  if (!selectedPrompt) {
    throw new Error(`Unknown document type: ${type}. Available: ${Object.keys(prompts).join(', ')}`);
  }
  
  const response = await openai.chat.completions.create({
    model: 'gpt-5-mini',
    messages: [
      { role: 'system', content: selectedPrompt.system },
      { role: 'user', content: selectedPrompt.user }
    ],
    temperature: 0.4,
    max_tokens: 4000,
  });
  
  const content = response.choices[0].message.content;
  
  // Generate a title
  const titles = {
    'quick-start': `Quick Start Guide — ${projectName}`,
    'overview': `${projectName} Overview`,
    'authentication': `Authentication Guide`,
    'changelog': `Changelog`,
    'deployment': `Deployment Guide`,
    'contributing': `Contributing Guide`
  };
  
  return {
    title: titles[type] || `${type.charAt(0).toUpperCase() + type.slice(1)} Guide`,
    content
  };
};

// Generate title from content
export const generateTitle = async (content) => {
  if (!openai) return 'Untitled';
  
  const prompt = `Generate a short, descriptive title (max 5 words) for this document:\n\n${content.slice(0, 500)}`;
  
  const response = await openai.chat.completions.create({
    model: 'gpt-5-mini',
    messages: [
      { role: 'system', content: 'Generate concise document titles.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    max_tokens: 20,
  });
  
  return response.choices[0].message.content.trim().replace(/[\"']/g, '');
};

// Categorize a document using AI
export const categorizeDocument = async (title, content) => {
  if (!openai) return { category: 'uncategorized', subcategory: '' };
  
  const prompt = `Categorize this documentation document.

CATEGORIES (choose ONE):
- api: API endpoint documentation, request/response specs
- guide: Tutorials, how-to guides, quick starts
- reference: Technical reference, configuration, environment variables
- architecture: System design, architecture decisions, infrastructure
- changelog: Version history, release notes, changelogs
- contributing: Contribution guidelines, development setup
- general: General documentation that doesn't fit other categories

SUBCATEGORIES (choose based on category):
- For "api": Group by resource (e.g., "patients", "users", "auth", "scans", "reports", "triage", "uploads", "medications")
- For "guide": Type of guide (e.g., "quick-start", "installation", "tutorial", "how-to")
- For "reference": Type of reference (e.g., "config", "environment", "schema", "types")
- For "architecture": Aspect of system (e.g., "database", "api", "frontend", "backend", "deployment")
- For others: Leave empty or use a descriptive short label

Document Title: ${title}
Document Content (first 1500 chars):
${content.slice(0, 1500)}

Respond in JSON format only: {"category": "category_name", "subcategory": "subcategory_name"}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: 'You are a documentation categorizer. Respond with valid JSON only, no other text.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 100,
      response_format: { type: 'json_object' }
    });
    
    const result = JSON.parse(response.choices[0].message.content.trim());
    const validCategories = ['api', 'guide', 'reference', 'architecture', 'changelog', 'contributing', 'general'];
    
    return {
      category: validCategories.includes(result.category?.toLowerCase()) ? result.category.toLowerCase() : 'general',
      subcategory: result.subcategory?.toLowerCase() || ''
    };
  } catch (err) {
    console.error('Categorization failed:', err.message);
    return { category: 'uncategorized', subcategory: '' };
  }
};

// Categorize multiple documents in batch
export const categorizeDocuments = async (docs) => {
  const results = [];
  
  for (const doc of docs) {
    const { category, subcategory } = await categorizeDocument(doc.title, doc.content);
    results.push({ id: doc.id, category, subcategory });
    
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
};
