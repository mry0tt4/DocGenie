import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, FileText, Code, ArrowRight } from 'lucide-react'

const CommandPalette = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const debounceRef = useRef(null)

  // Pages for quick navigation
  const pages = [
    { type: 'page', title: 'Dashboard', path: '/admin', icon: '📊' },
    { type: 'page', title: 'Documents', path: '/admin/docs', icon: '📄' },
    { type: 'page', title: 'API Docs', path: '/admin/api-docs', icon: '🔌' },
    { type: 'page', title: 'Settings', path: '/admin/settings', icon: '⚙️' },
    { type: 'page', title: 'New Document', path: '/admin/docs/new', icon: '✏️' },
    { type: 'page', title: 'Public Site', path: '/', icon: '🌐' },
  ]

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
      setQuery('')
      setResults([])
      setSelectedIndex(0)
    }
  }, [isOpen])

  const searchAll = useCallback(async (q) => {
    if (!q.trim()) {
      setResults([])
      return
    }

    setLoading(true)
    try {
      // Search docs + routes in parallel
      const [docsRes, routesRes] = await Promise.all([
        fetch(`/api/search?q=${encodeURIComponent(q)}`),
        fetch('/api/routes')
      ])

      const docs = await docsRes.json()
      const allRoutes = await routesRes.json()

      // Filter pages
      const matchedPages = pages.filter(p =>
        p.title.toLowerCase().includes(q.toLowerCase())
      ).map(p => ({ ...p, id: p.path }))

      // Map docs
      const matchedDocs = (Array.isArray(docs) ? docs : []).slice(0, 8).map(d => ({
        type: 'doc',
        id: d.id,
        title: d.title,
        subtitle: d.path,
        path: `/admin/docs/${d.id}`
      }))

      // Filter routes
      const matchedRoutes = allRoutes
        .filter(r =>
          r.path.toLowerCase().includes(q.toLowerCase()) ||
          (r.description || '').toLowerCase().includes(q.toLowerCase()) ||
          r.method.toLowerCase().includes(q.toLowerCase())
        )
        .slice(0, 5)
        .map(r => ({
          type: 'route',
          id: r.id,
          title: `${r.method} ${r.path}`,
          subtitle: r.description || r.source_file,
          path: '/admin/api-docs'
        }))

      setResults([...matchedPages, ...matchedDocs, ...matchedRoutes])
      setSelectedIndex(0)
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleInputChange = (e) => {
    const val = e.target.value
    setQuery(val)

    // Debounce search
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchAll(val), 200)
  }

  const handleSelect = (item) => {
    onClose()
    navigate(item.path)
  }

  const handleKeyDown = (e) => {
    const items = query.trim() ? results : pages
    
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && items[selectedIndex]) {
      e.preventDefault()
      handleSelect(items[selectedIndex])
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen) return null

  const displayItems = query.trim() ? results : pages

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 9998
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '560px',
        background: '#151515',
        border: '1px solid #2a2a2a',
        borderRadius: '12px',
        zIndex: 9999,
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
      }}>
        {/* Search input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.875rem 1rem',
          borderBottom: '1px solid #2a2a2a'
        }}>
          <Search size={18} style={{ color: '#666', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Search docs, pages, API routes..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: '0.9375rem',
              outline: 'none',
              padding: 0,
              minHeight: 'auto'
            }}
          />
          <kbd style={{
            padding: '0.125rem 0.375rem',
            background: '#222',
            border: '1px solid #333',
            borderRadius: '4px',
            fontSize: '0.6875rem',
            color: '#666',
            fontFamily: 'monospace',
            lineHeight: '1.4'
          }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{
          maxHeight: '320px',
          overflowY: 'auto',
          padding: '0.375rem'
        }}>
          {loading && (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#666', fontSize: '0.875rem' }}>
              Searching...
            </div>
          )}

          {!loading && query.trim() && results.length === 0 && (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#666', fontSize: '0.875rem' }}>
              No results for "{query}"
            </div>
          )}

          {!loading && displayItems.map((item, i) => (
            <button
              key={item.id || item.path}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setSelectedIndex(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                width: '100%',
                padding: '0.625rem 0.75rem',
                background: i === selectedIndex ? 'rgba(255, 107, 0, 0.1)' : 'transparent',
                border: 'none',
                borderRadius: '8px',
                color: i === selectedIndex ? '#ff6b00' : '#ccc',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '0.875rem',
                minHeight: '40px'
              }}
            >
              {/* Icon */}
              <span style={{ flexShrink: 0, width: '20px', textAlign: 'center' }}>
                {item.type === 'page' && (item.icon || '📄')}
                {item.type === 'doc' && <FileText size={16} />}
                {item.type === 'route' && <Code size={16} />}
              </span>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ 
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {item.title}
                </div>
                {item.subtitle && (
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#666',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {item.subtitle}
                  </div>
                )}
              </div>

              {/* Arrow */}
              {i === selectedIndex && (
                <ArrowRight size={14} style={{ flexShrink: 0, opacity: 0.5 }} />
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '0.5rem 1rem',
          borderTop: '1px solid #2a2a2a',
          display: 'flex',
          gap: '1rem',
          fontSize: '0.6875rem',
          color: '#555'
        }}>
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </>
  )
}

export default CommandPalette
