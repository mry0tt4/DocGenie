import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const Dashboard = () => {
  const [stats, setStats] = useState({ documents: 0, apiRoutes: 0 })
  const [recentDocs, setRecentDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [docTypes, setDocTypes] = useState([])
  const [generating, setGenerating] = useState(null)
  const [generateSuccess, setGenerateSuccess] = useState(null)
  const [hasProjectPath, setHasProjectPath] = useState(false)

  useEffect(() => {
    fetchData()
    fetchDocTypes()
    checkProjectPath()
  }, [])

  const fetchData = async () => {
    try {
      const [docsRes, routesRes] = await Promise.all([
        fetch('/api/documents'),
        fetch('/api/routes')
      ])
      
      const docs = await docsRes.json()
      const routes = await routesRes.json()
      
      setStats({ documents: docs.length, apiRoutes: routes.length })
      setRecentDocs(docs.slice(0, 5))
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchDocTypes = async () => {
    try {
      const res = await fetch('/api/generate/types')
      const data = await res.json()
      setDocTypes(data)
    } catch (err) {
      console.error('Failed to fetch doc types:', err)
    }
  }

  const checkProjectPath = async () => {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      const pathSetting = data.find(s => s.key === 'project_code_path')
      setHasProjectPath(pathSetting && pathSetting.value && pathSetting.value.trim().length > 0)
    } catch {}
  }

  const handleGenerate = async (type) => {
    setGenerating(type)
    setGenerateSuccess(null)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      })
      const data = await res.json()
      if (data.success) {
        setGenerateSuccess(type)
        fetchData() // Refresh docs list
        setTimeout(() => setGenerateSuccess(null), 3000)
      }
    } catch (err) {
      console.error('Generation failed:', err)
      alert('Failed to generate document')
    } finally {
      setGenerating(null)
    }
  }

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>Loading...</div>
  }

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <h1>Dashboard</h1>
        <p style={{ color: '#666', marginTop: '0.5rem' }}>Your knowledge platform.</p>
      </div>

      <div className="stats-grid">
        <div className="card">
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ff6b00' }}>{stats.documents}</div>
          <div style={{ fontSize: '0.875rem', color: '#888', marginTop: '0.25rem' }}>Documents</div>
        </div>
        
        <div className="card">
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ff6b00' }}>{stats.apiRoutes}</div>
          <div style={{ fontSize: '0.875rem', color: '#888', marginTop: '0.25rem' }}>API Routes</div>
        </div>
        
        <div className="card">
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ff6b00' }}>∞</div>
          <div style={{ fontSize: '0.875rem', color: '#888', marginTop: '0.25rem' }}>Git History</div>
        </div>
        
        <div className="card">
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ff6b00' }}>100%</div>
          <div style={{ fontSize: '0.875rem', color: '#888', marginTop: '0.25rem' }}>Yours</div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: '1fr' }}>
        {/* AI Document Generator */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.125rem' }}>Generate Documentation</h2>
              <p style={{ fontSize: '0.8125rem', color: '#666', marginTop: '0.25rem' }}>AI reads your codebase and generates docs from it</p>
            </div>
          </div>
          
          {!hasProjectPath && (
            <div style={{
              padding: '0.75rem 1rem',
              background: 'rgba(255, 107, 0, 0.08)',
              border: '1px solid rgba(255, 107, 0, 0.2)',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontSize: '0.8125rem',
              color: '#ccc'
            }}>
              ⚠️ Set your <Link to="/admin/settings" style={{ color: '#ff6b00', fontWeight: 500 }}>Project Code Path</Link> in Settings so the AI can read your actual codebase. Without it, generated docs will be generic.
            </div>
          )}
          
          <div style={{
            display: 'grid',
            gap: '0.75rem',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))'
          }}>
            {docTypes.map(dt => (
              <button
                key={dt.id}
                onClick={() => handleGenerate(dt.id)}
                disabled={generating !== null}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '1rem',
                  background: generating === dt.id ? 'rgba(255, 107, 0, 0.1)' : '#1a1a1a',
                  border: generateSuccess === dt.id ? '1px solid #22c55e' : '1px solid #2a2a2a',
                  borderRadius: '8px',
                  cursor: generating !== null ? 'wait' : 'pointer',
                  textAlign: 'left',
                  color: '#fff',
                  width: '100%',
                  opacity: generating !== null && generating !== dt.id ? 0.5 : 1
                }}
              >
                <span style={{ fontSize: '1.5rem', flexShrink: 0, lineHeight: 1 }}>{dt.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                    {generating === dt.id ? 'Generating...' : generateSuccess === dt.id ? '✓ Created!' : dt.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>{dt.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Documents */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.125rem' }}>Recent Documents</h2>
            <Link to="/admin/docs" className="btn btn-secondary">View All</Link>
          </div>
          
          {recentDocs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
              <p>No documents yet.</p>
              <Link to="/admin/docs/new" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                Create First Document
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {recentDocs.map(doc => (
                <Link
                  key={doc.id}
                  to={`/admin/docs/${doc.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    color: 'inherit'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="truncate" style={{ fontWeight: 500 }}>{doc.title}</div>
                    <div style={{ fontSize: '0.75rem', color: '#666' }}>
                      {new Date(doc.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Quick Actions</h2>
          
          <div className="quick-actions-grid">
            <Link to="/admin/docs/new" className="quick-action-btn">
              <div style={{ fontWeight: 500 }}>New Document</div>
              <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>Create a new page</div>
            </Link>
            
            <button
              onClick={() => {
                const evt = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })
                window.dispatchEvent(evt)
              }}
              className="quick-action-btn"
              style={{ width: '100%', textAlign: 'left' }}
            >
              <div style={{ fontWeight: 500 }}>Search</div>
              <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>⌘K to find anything</div>
            </button>
            
            <Link to="/admin/api-docs" className="quick-action-btn">
              <div style={{ fontWeight: 500 }}>API Docs</div>
              <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>View endpoints</div>
            </Link>
            
            <button 
              onClick={() => fetch('/api/routes/scan', { method: 'POST' })}
              className="quick-action-btn"
              style={{ width: '100%', textAlign: 'left' }}
            >
              <div style={{ fontWeight: 500 }}>Scan API</div>
              <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>Auto-detect routes</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
