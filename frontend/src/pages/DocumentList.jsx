import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

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
  'api': 'API',
  'guide': 'Guides',
  'reference': 'Reference',
  'architecture': 'Architecture',
  'changelog': 'Changelog',
  'contributing': 'Contributing',
  'general': 'General',
  'uncategorized': 'Uncategorized'
}

const DocumentList = () => {
  const [documents, setDocuments] = useState([])
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedSubcategory, setSelectedSubcategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const [categorizing, setCategorizing] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchDocuments()
    fetchCategories()
  }, [])

  useEffect(() => {
    if (selectedCategory !== 'all') {
      fetchSubcategories(selectedCategory)
      setSelectedSubcategory('all')
    } else {
      setSubcategories([])
    }
  }, [selectedCategory])

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/documents')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setDocuments(data)
    } catch (err) {
      console.error('Failed to fetch documents:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories')
      if (res.ok) {
        const data = await res.json()
        setCategories(data)
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err)
    }
  }

  const fetchSubcategories = async (category) => {
    try {
      const res = await fetch(`/api/categories/${category}/subcategories`)
      if (res.ok) {
        const data = await res.json()
        setSubcategories(data)
      }
    } catch (err) {
      console.error('Failed to fetch subcategories:', err)
    }
  }

  const handleCategorizeAll = async () => {
    setCategorizing(true)
    try {
      const res = await fetch('/api/documents/categorize-all', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        alert(data.message)
        fetchDocuments()
        fetchCategories()
      }
    } catch (err) {
      console.error('Categorization failed:', err)
    } finally {
      setCategorizing(false)
    }
  }

  const filteredDocuments = documents.filter(d => {
    if (selectedCategory !== 'all' && d.category !== selectedCategory) return false
    if (selectedSubcategory !== 'all' && d.subcategory !== selectedSubcategory) return false
    return true
  })

  // Group documents by subcategory for display
  const groupedDocs = filteredDocuments.reduce((acc, doc) => {
    const subcat = doc.subcategory || 'other'
    if (!acc[subcat]) acc[subcat] = []
    acc[subcat].push(doc)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '4rem 2rem', color: '#666' }}>
        Loading documents...
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-container" style={{ color: '#ef4444', padding: '2rem' }}>
        Error: {error}
      </div>
    )
  }

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Documents</h1>
          <p style={{ color: '#666', marginTop: '0.5rem' }}>
            {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''}
            {selectedCategory !== 'all' && ` in ${CATEGORY_LABELS[selectedCategory] || selectedCategory}`}
          </p>
        </div>
        <button 
          onClick={handleCategorizeAll}
          disabled={categorizing}
          style={{
            padding: '0.5rem 1rem',
            background: categorizing ? '#374151' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: categorizing ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem'
          }}
        >
          {categorizing ? 'Categorizing...' : 'Auto-Categorize All'}
        </button>
      </div>

      {/* Category Filter */}
      {categories.length > 0 && (
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setSelectedCategory('all')}
            style={{
              padding: '0.375rem 0.75rem',
              background: selectedCategory === 'all' ? '#ff6b00' : '#1f2937',
              color: 'white',
              border: 'none',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              cursor: 'pointer'
            }}
          >
            All ({documents.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat.category}
              onClick={() => setSelectedCategory(cat.category)}
              style={{
                padding: '0.375rem 0.75rem',
                background: selectedCategory === cat.category ? (CATEGORY_COLORS[cat.category] || '#64748b') : '#1f2937',
                color: 'white',
                border: 'none',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              {CATEGORY_LABELS[cat.category] || cat.category} ({cat.count})
            </button>
          ))}
        </div>
      )}

      {/* Subcategory Filter */}
      {subcategories.length > 0 && (
        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: '#666', fontSize: '0.75rem' }}>Subcategory:</span>
          <button
            onClick={() => setSelectedSubcategory('all')}
            style={{
              padding: '0.25rem 0.5rem',
              background: selectedSubcategory === 'all' ? '#374151' : '#1f2937',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.6875rem',
              cursor: 'pointer'
            }}
          >
            All
          </button>
          {subcategories.map(sub => (
            <button
              key={sub.subcategory}
              onClick={() => setSelectedSubcategory(sub.subcategory)}
              style={{
                padding: '0.25rem 0.5rem',
                background: selectedSubcategory === sub.subcategory ? '#374151' : '#1f2937',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.6875rem',
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {sub.subcategory} ({sub.count})
            </button>
          ))}
        </div>
      )}

      {filteredDocuments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>No documents found</div>
          <p style={{ color: '#666', marginBottom: '1.5rem' }}>
            {selectedCategory !== 'all' ? 'Try selecting a different category or' : 'Start building your documentation by'} creating your first document.
          </p>
          <Link to="/admin/docs/new" className="btn btn-primary">
            Create Document
          </Link>
        </div>
      ) : (
        <div>
          {Object.entries(groupedDocs).map(([subcategory, docs]) => (
            <div key={subcategory} style={{ marginBottom: '2rem' }}>
              {subcategory !== 'other' && (
                <h3 style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#888',
                  textTransform: 'capitalize',
                  marginBottom: '1rem',
                  paddingBottom: '0.5rem',
                  borderBottom: '1px solid #2a2a2a'
                }}>
                  {subcategory}
                </h3>
              )}
              <div className="responsive-grid">
                {docs.map(doc => (
                  <Link
                    key={doc.id}
                    to={`/admin/docs/${doc.id}`}
                    className="doc-card"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div className="doc-card-title" style={{ flex: 1 }}>{doc.title}</div>
                      <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                        {doc.subcategory && doc.subcategory !== 'other' && (
                          <span style={{
                            padding: '0.125rem 0.375rem',
                            background: '#374151',
                            color: '#aaa',
                            borderRadius: '4px',
                            fontSize: '0.5625rem',
                            textTransform: 'capitalize',
                            fontWeight: 500
                          }}>
                            {doc.subcategory}
                          </span>
                        )}
                        {doc.category && (
                          <span style={{
                            padding: '0.125rem 0.375rem',
                            background: CATEGORY_COLORS[doc.category] || '#64748b',
                            color: 'white',
                            borderRadius: '9999px',
                            fontSize: '0.5625rem',
                            textTransform: 'uppercase',
                            fontWeight: 600
                          }}>
                            {doc.category}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="doc-card-meta">
                      <span>{doc.path}</span>
                      <span style={{ margin: '0 0.5rem' }}>•</span>
                      <span>{new Date(doc.updated_at).toLocaleDateString()}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default DocumentList
