import React, { useState } from 'react'
import { Link } from 'react-router-dom'

const Search = () => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('text')

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query.trim()) return
    
    setLoading(true)
    try {
      const endpoint = activeTab === 'semantic' 
        ? `/api/search/semantic?q=${encodeURIComponent(query)}`
        : `/api/search?q=${encodeURIComponent(query)}`
      
      const res = await fetch(endpoint)
      const data = await res.json()
      setResults(data)
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <h1>Search</h1>
        <p style={{ color: '#666', marginTop: '0.5rem' }}>Find documents by keyword or semantic meaning</p>
      </div>

      <form onSubmit={handleSearch} style={{ marginBottom: '2rem' }}>
        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="Search your knowledge base..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ fontSize: '1.125rem', padding: '1rem 1.5rem' }}
          />
        </div>

        <div style={{ 
          display: 'flex', 
          gap: '0.5rem', 
          marginBottom: '1.5rem',
          borderBottom: '1px solid #2a2a2a',
          paddingBottom: '0.5rem'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('text')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'text' ? 'rgba(255, 107, 0, 0.1)' : 'transparent',
              color: activeTab === 'text' ? '#ff6b00' : '#888',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            Text Search
          </button>
          
          <button
            type="button"
            onClick={() => setActiveTab('semantic')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'semantic' ? 'rgba(255, 107, 0, 0.1)' : 'transparent',
              color: activeTab === 'semantic' ? '#ff6b00' : '#888',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            AI Search
          </button>
        </div>

        <button type="submit" className="btn btn-primary">
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {results.length > 0 && (
        <div style={{ marginBottom: '1rem', color: '#666', fontSize: '0.875rem' }}>
          Found {results.length} result{results.length !== 1 ? 's' : ''}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {results.map((result) => (
          <Link
            key={result.id}
            to={`/docs/${result.document_id || result.id}`}
            className="card"
            style={{ 
              display: 'block',
              padding: '1rem',
              textDecoration: 'none',
              color: 'inherit'
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{result.title || 'Untitled'}</div>
            <div style={{ fontSize: '0.875rem', color: '#888', lineHeight: '1.5' }}>
              {(result.chunk_text || result.content || '').slice(0, 150)}...
            </div>
            <div style={{ 
              display: 'flex', 
              gap: '1rem', 
              marginTop: '0.5rem',
              fontSize: '0.75rem',
              color: '#666',
              fontFamily: 'monospace'
            }}>
              <span>{result.path || 'Unknown'}</span>
              {result.similarity && (
                <span style={{ color: '#ff6b00' }}>
                  {Math.round(result.similarity * 100)}% match
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default Search
