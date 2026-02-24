import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { Search, Menu, X, ChevronLeft, FileText, ChevronDown, ChevronRight } from 'lucide-react'

const CATEGORY_COLORS = {
  'api': '#3b82f6',
  'guide': '#10b981',
  'reference': '#8b5cf6',
  'architecture': '#f59e0b',
  'changelog': '#6b7280',
  'contributing': '#ec4899',
  'general': '#64748b',
  'uncategorized': '#94a3b8'
}

const CATEGORY_LABELS = {
  'api': 'API Reference',
  'guide': 'Guides',
  'reference': 'Reference',
  'architecture': 'Architecture',
  'changelog': 'Changelog',
  'contributing': 'Contributing',
  'general': 'General',
  'uncategorized': 'Uncategorized'
}

const PublicDocsLayout = ({ children, settings = {}, repoName }) => {
  const location = useLocation()
  const [docs, setDocs] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expandedCategories, setExpandedCategories] = useState({})

  useEffect(() => {
    fetchDocs()
  }, [])

  const fetchDocs = async () => {
    try {
      const res = await fetch('/api/documents')
      const data = await res.json()
      setDocs(data)
      // Expand all categories by default
      const categories = [...new Set(data.map(d => d.category || 'uncategorized'))]
      const expanded = {}
      categories.forEach(cat => expanded[cat] = true)
      setExpandedCategories(expanded)
    } catch (err) {
      console.error('Failed to fetch docs:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }))
  }

  // Filter docs by search query
  const filteredDocs = docs.filter(doc => 
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (doc.category || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Group documents by category and subcategory
  const groupedDocs = filteredDocs.reduce((acc, doc) => {
    const cat = doc.category || 'uncategorized'
    const subcat = doc.subcategory || 'other'
    if (!acc[cat]) acc[cat] = {}
    if (!acc[cat][subcat]) acc[cat][subcat] = []
    acc[cat][subcat].push(doc)
    return acc
  }, {})

  const logoUrl = settings.logo_url
  const siteName = settings.site_name || repoName || 'Documentation'

  return (
    <div className="public-docs">
      {/* Header */}
      <header className="public-docs-header">
        <div className="public-docs-header-inner">
          <Link to="/" className="public-docs-logo">
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt="Logo" 
                style={{
                  width: '24px',
                  height: '24px',
                  objectFit: 'contain'
                }}
              />
            ) : (
              <FileText size={24} />
            )}
            <span>{siteName}</span>
          </Link>
          
          <div className="public-docs-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search docs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <button 
            className="public-docs-menu-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      <div className="public-docs-body">
        {/* Sidebar */}
        <aside className={`public-docs-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="public-docs-nav">
            {loading ? (
              <div className="public-docs-loading">Loading...</div>
            ) : filteredDocs.length === 0 ? (
              <div className="public-docs-empty">No documents found</div>
            ) : (
              <nav className="public-docs-nav-list">
                {Object.entries(groupedDocs).map(([category, subcategories]) => (
                  <div key={category} className="docs-category">
                    <button
                      className="docs-category-header"
                      onClick={() => toggleCategory(category)}
                    >
                      <span 
                        className="docs-category-dot"
                        style={{ background: CATEGORY_COLORS[category] || '#64748b' }}
                      />
                      <span className="docs-category-label">
                        {CATEGORY_LABELS[category] || category}
                      </span>
                      {expandedCategories[category] ? (
                        <ChevronDown size={14} className="docs-category-chevron" />
                      ) : (
                        <ChevronRight size={14} className="docs-category-chevron" />
                      )}
                    </button>
                    
                    {expandedCategories[category] && (
                      <div className="docs-category-content">
                        {Object.entries(subcategories).map(([subcategory, subcatDocs]) => (
                          <div key={subcategory} className="docs-subcategory">
                            {subcategory !== 'other' && (
                              <div className="docs-subcategory-label">
                                {subcategory}
                              </div>
                            )}
                            {subcatDocs.map(doc => (
                              <Link
                                key={doc.id}
                                to={`/doc/${doc.id}`}
                                className={`docs-nav-item ${location.pathname === `/doc/${doc.id}` ? 'active' : ''}`}
                                onClick={() => setSidebarOpen(false)}
                              >
                                {doc.title}
                              </Link>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </nav>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="public-docs-main">
          {children}
        </main>
      </div>

      <style>{`
        .docs-category {
          margin-bottom: 0.5rem;
        }
        
        .docs-category-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.5rem 0;
          background: transparent;
          border: none;
          color: #333;
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          text-align: left;
          border-radius: 6px;
          transition: background 0.2s;
        }
        
        .docs-category-header:hover {
          background: #f5f5f5;
        }
        
        .docs-category-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        
        .docs-category-label {
          flex: 1;
        }
        
        .docs-category-chevron {
          color: #999;
          flex-shrink: 0;
        }
        
        .docs-category-content {
          padding-left: 0.5rem;
        }
        
        .docs-subcategory {
          margin-bottom: 0.25rem;
        }
        
        .docs-subcategory-label {
          padding: 0.25rem 0 0.125rem;
          font-size: 0.6875rem;
          color: #888;
          text-transform: capitalize;
          font-weight: 500;
          letter-spacing: 0.05em;
        }
        
        .docs-nav-item {
          display: block;
          padding: 0.375rem 0;
          color: #666;
          text-decoration: none;
          font-size: 0.8125rem;
          border-radius: 4px;
          transition: all 0.2s;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .docs-nav-item:hover {
          color: #ff6b00;
          background: transparent;
        }
        
        .docs-nav-item.active {
          color: #ff6b00;
          background: transparent;
        }
      `}</style>
    </div>
  )
}

export default PublicDocsLayout
