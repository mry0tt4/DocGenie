import React, { useState, useEffect } from 'react'

const ApiDocs = () => {
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    fetchRoutes()
  }, [])

  const fetchRoutes = async () => {
    try {
      const res = await fetch('/api/routes')
      const data = await res.json()
      setRoutes(data)
    } catch (err) {
      console.error('Failed to fetch routes:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleScan = async () => {
    setScanning(true)
    try {
      await fetch('/api/routes/scan', { method: 'POST' })
      await fetchRoutes()
    } catch (err) {
      console.error('Scan failed:', err)
    } finally {
      setScanning(false)
    }
  }

  const getMethodColor = (method) => {
    const colors = {
      GET: { bg: 'rgba(255, 107, 0, 0.15)', color: '#ff6b00' },
      POST: { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' },
      PUT: { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' },
      DELETE: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }
    }
    return colors[method] || { bg: 'rgba(255, 107, 0, 0.15)', color: '#ff6b00' }
  }

  if (loading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        Loading API routes...
      </div>
    )
  }

  return (
    <div className="page-container animate-fade-in">
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div>
          <h1>API Documentation</h1>
          <p style={{ color: '#666', marginTop: '0.5rem' }}>
            Auto-generated docs from your codebase. {routes.length} route{routes.length !== 1 ? 's' : ''} detected.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <a 
            href="/api/openapi.json" 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            OpenAPI Spec
          </a>
          
          <button 
            className="btn btn-primary"
            onClick={handleScan}
            disabled={scanning}
          >
            {scanning ? 'Scanning...' : 'Scan Codebase'}
          </button>
        </div>
      </div>

      {routes.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>No API routes found</div>
          <p style={{ color: '#666', marginBottom: '1.5rem' }}>Scan your codebase to automatically detect and document API endpoints.</p>
          <button onClick={handleScan} className="btn btn-primary" disabled={scanning}>
            {scanning ? 'Scanning...' : 'Scan Now'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {routes.map(route => {
            const methodStyle = getMethodColor(route.method)
            return (
              <div 
                key={route.id} 
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  padding: '1rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    textTransform: 'uppercase',
                    background: methodStyle.bg,
                    color: methodStyle.color
                  }}>
                    {route.method}
                  </span>
                  
                  <span style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{route.path}</span>
                </div>
                
                <div style={{ fontSize: '0.875rem', color: '#888' }}>{route.description || 'No description'}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ApiDocs
