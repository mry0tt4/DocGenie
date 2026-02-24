import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const DocumentEdit = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [path, setPath] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!!id)

  useEffect(() => {
    if (id) {
      fetchDocument()
    } else {
      setPath('new-document.md')
      setLoading(false)
    }
  }, [id])

  const fetchDocument = async () => {
    try {
      const res = await fetch(`/api/documents/${id}`)
      const data = await res.json()
      setTitle(data.title)
      setContent(data.content)
      setPath(data.path)
    } catch (err) {
      console.error('Failed to fetch document:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!title || !content || !path) return
    
    setSaving(true)
    try {
      const payload = {
        path: path.startsWith('/') ? path.slice(1) : path,
        content,
        frontmatter: { title }
      }
      
      const url = id ? `/api/documents/${id}` : '/api/documents'
      const method = id ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      const data = await res.json()
      navigate(`/admin/docs/${data.id || id}`)
    } catch (err) {
      console.error('Failed to save document:', err)
      alert('Failed to save: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        Loading...
      </div>
    )
  }

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <h1>{id ? 'Edit Document' : 'New Document'}</h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <input
            type="text"
            placeholder="Document Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ 
              fontSize: '1.25rem', 
              fontWeight: 600,
              background: 'transparent',
              border: 'none',
              borderBottom: '2px solid #2a2a2a',
              borderRadius: 0,
              padding: '0.5rem 0'
            }}
          />
        </div>

        <div>
          <input
            type="text"
            placeholder="File path (e.g., docs/guide.md)"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            disabled={!!id}
          />
        </div>

        <div className="editor-grid">
          <div className="card">
            <div style={{ 
              padding: '0.75rem 1rem', 
              background: '#1a1a1a',
              borderBottom: '1px solid #2a2a2a',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#666'
            }}>
              Markdown
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="# Start writing...&#10;&#10;Use [[Wiki Links]] to connect documents."
              style={{ 
                width: '100%',
                minHeight: '400px',
                background: 'transparent',
                border: 'none',
                padding: '1rem',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                resize: 'vertical'
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button 
            onClick={handleSave} 
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Document'}
          </button>
          
          <button 
            onClick={() => navigate(id ? `/admin/docs/${id}` : '/admin/docs')}
            className="btn btn-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default DocumentEdit
