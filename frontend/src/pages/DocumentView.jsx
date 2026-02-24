import React, { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'

const DocumentView = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [doc, setDoc] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDocument()
  }, [id])

  const fetchDocument = async () => {
    try {
      const res = await fetch(`/api/documents/${id}`)
      if (!res.ok) throw new Error('Document not found')
      const data = await res.json()
      setDoc(data)
    } catch (err) {
      console.error('Failed to fetch document:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this document?')) return
    
    try {
      await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      navigate('/admin/docs')
    } catch (err) {
      console.error('Failed to delete document:', err)
    }
  }

  if (loading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        Loading...
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="page-container">
        <h1>Document not found</h1>
        <Link to="/admin/docs" className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Back to Documents
        </Link>
      </div>
    )
  }

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/admin/docs" style={{ color: '#888', textDecoration: 'none', fontSize: '0.875rem' }}>
          ← Back to documents
        </Link>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ 
          padding: '1rem', 
          borderBottom: '1px solid #2a2a2a',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <h1 style={{ margin: 0 }}>{doc.title}</h1>
          
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link to={`/admin/docs/${id}/edit`} className="btn btn-secondary">
              Edit
            </Link>
            <button onClick={handleDelete} className="btn btn-danger">
              Delete
            </button>
          </div>
        </div>

        <div style={{ padding: '1.5rem', lineHeight: '1.8' }}>
          {/* Simple markdown rendering - just show raw for now */}
          <pre style={{ 
            background: '#1a1a1a', 
            padding: '1rem', 
            borderRadius: '8px',
            overflow: 'auto',
            fontSize: '0.875rem'
          }}>
            {doc.content}
          </pre>
        </div>

        <div style={{ 
          padding: '1rem', 
          background: '#1a1a1a',
          borderTop: '1px solid #2a2a2a',
          fontSize: '0.875rem',
          color: '#666'
        }}>
          Path: {doc.path} • Updated: {new Date(doc.updated_at).toLocaleString()}
        </div>
      </div>
    </div>
  )
}

export default DocumentView
