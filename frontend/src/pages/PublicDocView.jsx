import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import { ChevronLeft, Clock, Calendar } from 'lucide-react'

const PublicDocView = () => {
  const { id } = useParams()
  const [doc, setDoc] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDoc()
  }, [id])

  const fetchDoc = async () => {
    try {
      const res = await fetch(`/api/documents/${id}`)
      if (!res.ok) throw new Error('Not found')
      const data = await res.json()
      setDoc(data)
    } catch (err) {
      console.error('Failed to fetch doc:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="public-doc-view">
        <div className="animate-pulse">Loading...</div>
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="public-doc-view">
        <h1>Document not found</h1>
        <Link to="/" className="btn btn-primary">Back to Docs</Link>
      </div>
    )
  }

  return (
    <article className="public-doc-view">
      <header className="public-doc-header">
        <Link to="/" className="public-doc-back">
          <ChevronLeft size={16} /> All Docs
        </Link>
        
        <h1 className="public-doc-title">{doc.title}</h1>
        
        <div className="public-doc-meta">
          <span>
            <Calendar size={14} />
            {new Date(doc.created_at).toLocaleDateString()}
          </span>
          <span>
            <Clock size={14} />
            Updated {new Date(doc.updated_at).toLocaleDateString()}
          </span>
        </div>
      </header>

      <div className="public-doc-content">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSlug, rehypeHighlight]}
          components={{
            a: ({node, href, children, ...props}) => {
              // Anchor links (#section) — scroll in-page
              if (href && href.startsWith('#')) {
                return (
                  <a
                    href={href}
                    onClick={(e) => {
                      e.preventDefault()
                      const el = document.getElementById(href.slice(1))
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        // Update URL hash without navigation
                        window.history.pushState(null, '', href)
                      }
                    }}
                    {...props}
                  >
                    {children}
                  </a>
                )
              }
              // External links — open in new tab
              return (
                <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                  {children}
                </a>
              )
            }
          }}
        >
          {doc.content || ''}
        </ReactMarkdown>
      </div>
    </article>
  )
}

export default PublicDocView
