import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FileText, ArrowRight, BookOpen } from 'lucide-react'

const PublicDocsHome = () => {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDocs()
  }, [])

  const fetchDocs = async () => {
    try {
      const res = await fetch('/api/documents')
      const data = await res.json()
      setDocs(data)
    } catch (err) {
      console.error('Failed to fetch docs:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="public-docs-home">
      <header className="public-docs-hero">
        <BookOpen size={48} className="public-docs-hero-icon" />
        <h1>Documentation</h1>
        <p>Browse our guides, API references, and tutorials.</p>
      </header>

      {loading ? (
        <div className="animate-pulse">Loading documents...</div>
      ) : docs.length === 0 ? (
        <div className="public-docs-empty">
          <FileText size={48} />
          <p>No documentation yet.</p>
        </div>
      ) : (
        <div className="public-docs-grid">
          {docs.map(doc => (
            <Link
              key={doc.id}
              to={`/doc/${doc.id}`}
              className="public-docs-card"
            >
              <div className="public-docs-card-header">
                <FileText size={20} />
                <ArrowRight size={16} />
              </div>
              <h3>{doc.title}</h3>
              <p>
                Last updated {new Date(doc.updated_at).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default PublicDocsHome
