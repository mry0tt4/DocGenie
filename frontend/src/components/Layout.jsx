import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import CommandPalette from './CommandPalette'

const Layout = ({ settings, repoName }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  
  // Use settings.site_name, then repoName, then fallback to 'DocGenie'
  const siteName = settings.site_name || repoName || 'DocGenie'

  // Global keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const isActive = (path) => {
    if (path === '/admin') return location.pathname === '/admin'
    return location.pathname.startsWith(path)
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      await fetch('/api/sync', { method: 'POST' })
      window.location.reload()
    } catch (err) {
      console.error('Sync failed:', err)
    } finally {
      setSyncing(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navItems = [
    { path: '/admin', label: 'Dashboard' },
    { path: '/admin/docs', label: 'Documents' },
    { path: '/admin/api-docs', label: 'API Docs' },
    { path: '/admin/settings', label: 'Settings' },
  ]

  const logoUrl = settings.logo_url
  const isMac = typeof navigator !== 'undefined' && navigator.platform?.includes('Mac')

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0a0a' }}>
      {/* Command Palette */}
      <CommandPalette isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 99
          }}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        width: '260px',
        background: '#111',
        borderRight: '1px solid #2a2a2a',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        height: '100vh',
        zIndex: 100,
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s ease'
      }}>
        <style>{`
          @media (min-width: 1024px) {
            aside { transform: translateX(0) !important; }
          }
        `}</style>
        
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #2a2a2a' }}>
          <Link to="/admin" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#ff6b00',
            textDecoration: 'none'
          }}>
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt="Logo" 
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  objectFit: 'contain'
                }}
              />
            ) : (
              <div style={{
                width: '32px',
                height: '32px',
                background: '#ff6b00',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'monospace',
                fontWeight: 700,
                color: 'white',
                flexShrink: 0
              }}>LD</div>
            )}
            <span>{siteName}</span>
          </Link>
        </div>

        <nav style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#666',
              padding: '0 0.75rem',
              marginBottom: '0.5rem'
            }}>Navigation</div>
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                style={{
                  display: 'block',
                  padding: '0.625rem 0.75rem',
                  borderRadius: '8px',
                  color: isActive(item.path) ? '#ff6b00' : '#888',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  background: isActive(item.path) ? 'rgba(255, 107, 0, 0.1)' : 'transparent',
                  marginBottom: '0.25rem'
                }}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div>
            <div style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#666',
              padding: '0 0.75rem',
              marginBottom: '0.5rem'
            }}>Actions</div>
            <Link
              to="/admin/docs/new"
              onClick={() => setSidebarOpen(false)}
              style={{
                display: 'block',
                padding: '0.625rem 0.75rem',
                borderRadius: '8px',
                color: '#888',
                textDecoration: 'none',
                fontSize: '0.875rem'
              }}
            >
              + New Document
            </Link>
            <Link
              to="/"
              onClick={() => setSidebarOpen(false)}
              style={{
                display: 'block',
                padding: '0.625rem 0.75rem',
                borderRadius: '8px',
                color: '#888',
                textDecoration: 'none',
                fontSize: '0.875rem'
              }}
            >
              ↗ View Public Site
            </Link>
          </div>
        </nav>

        <div style={{ padding: '1rem', borderTop: '1px solid #2a2a2a' }}>
          <button 
            onClick={handleSync}
            disabled={syncing}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'transparent',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              color: '#fff',
              cursor: 'pointer',
              marginBottom: '0.5rem',
              fontSize: '0.875rem'
            }}
          >
            {syncing ? 'Syncing...' : 'Sync Repository'}
          </button>
          
          <button 
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'transparent',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-wrapper" style={{ 
        flex: 1, 
        marginLeft: '0',
        minHeight: '100vh',
        background: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <style>{`
          @media (min-width: 1024px) {
            .main-wrapper { margin-left: 260px !important; }
          }
        `}</style>
        
        <header style={{
          height: '52px',
          background: '#111',
          borderBottom: '1px solid #2a2a2a',
          display: 'flex',
          alignItems: 'center',
          padding: '0 1rem',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          flexShrink: 0,
          gap: '0.75rem'
        }}>
          {/* Hamburger — mobile only */}
          <button 
            onClick={() => setSidebarOpen(true)}
            className="hamburger-btn"
            style={{
              padding: '0.375rem',
              background: 'transparent',
              border: '1px solid #2a2a2a',
              borderRadius: '6px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '1.125rem',
              lineHeight: 1,
              minHeight: '34px',
              minWidth: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            ☰
          </button>

          {/* Search bar — left side, takes available space */}
          <button
            onClick={() => setSearchOpen(true)}
            style={{
              flex: 1,
              maxWidth: '420px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.75rem',
              background: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              color: '#666',
              cursor: 'pointer',
              fontSize: '0.875rem',
              minHeight: '36px'
            }}
          >
            <span style={{ fontSize: '0.8125rem' }}>🔍</span>
            <span style={{ flex: 1, textAlign: 'left' }}>Search...</span>
            <kbd style={{
              padding: '0.125rem 0.375rem',
              background: '#222',
              border: '1px solid #333',
              borderRadius: '4px',
              fontSize: '0.6875rem',
              fontFamily: 'monospace',
              color: '#555',
              flexShrink: 0
            }}>{isMac ? '⌘K' : 'Ctrl+K'}</kbd>
          </button>

          {/* Spacer pushes "New" to the right */}
          <div style={{ flex: 1 }} />

          {/* New button — right side */}
          <Link to="/admin/docs/new" style={{
            padding: '0.375rem 0.625rem',
            background: '#ff6b00',
            color: 'white',
            borderRadius: '6px',
            textDecoration: 'none',
            fontWeight: 500,
            fontSize: '0.8125rem',
            minHeight: '34px',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0
          }}>
            + New
          </Link>
        </header>

        <main style={{ 
          flex: 1,
          background: '#0a0a0a'
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout
