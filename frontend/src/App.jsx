import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import PublicDocsLayout from './components/PublicDocsLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DocumentList from './pages/DocumentList'
import DocumentView from './pages/DocumentView'
import DocumentEdit from './pages/DocumentEdit'
import ApiDocs from './pages/ApiDocs'
import Settings from './pages/Settings'
import PublicDocsHome from './pages/PublicDocsHome'
import PublicDocView from './pages/PublicDocView'
import './App.css'

// Protected route wrapper
const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth()
  
  if (loading) {
    return <div className="loading-screen"><div className="loading-logo">DocGenie</div></div>
  }
  
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}

// Public route
const PublicRoute = () => {
  const { loading } = useAuth()
  
  if (loading) {
    return <div className="loading-screen"><div className="loading-logo">DocGenie</div></div>
  }
  
  return <Outlet />
}

function App() {
  const [settings, setSettings] = useState({})
  const [repoName, setRepoName] = useState('DocGenie')

  useEffect(() => {
    fetchSettings()
    fetchRepoName()
  }, [])

  // Update document title when site_name changes
  useEffect(() => {
    if (settings.site_name) {
      document.title = settings.site_name
    } else if (repoName) {
      document.title = repoName
    }
  }, [settings.site_name, repoName])

  const fetchRepoName = async () => {
    try {
      const res = await fetch('/api/repo/name')
      const data = await res.json()
      if (data.name) {
        setRepoName(data.name)
      }
    } catch (err) {
      console.error('Failed to fetch repo name:', err)
    }
  }

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      const settingsMap = {}
      data.forEach(s => settingsMap[s.key] = s.value)
      setSettings(settingsMap)
    } catch (err) {
      console.error('Failed to fetch settings:', err)
    }
  }

  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Documentation Routes — default landing page */}
          <Route element={<PublicRoute />}>
            <Route path="/" element={
              <PublicDocsLayout settings={settings} repoName={repoName}>
                <PublicDocsHome />
              </PublicDocsLayout>
            } />
            <Route path="/doc/:id" element={
              <PublicDocsLayout settings={settings} repoName={repoName}>
                <PublicDocView />
              </PublicDocsLayout>
            } />
          </Route>

          {/* Login */}
          <Route path="/login" element={<Login />} />
          
          {/* Admin/Dashboard Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout settings={settings} repoName={repoName} />}>
              <Route path="/admin" element={<Dashboard />} />
              <Route path="/admin/docs" element={<DocumentList />} />
              <Route path="/admin/docs/new" element={<DocumentEdit />} />
              <Route path="/admin/docs/:id" element={<DocumentView />} />
              <Route path="/admin/docs/:id/edit" element={<DocumentEdit />} />
              <Route path="/admin/api-docs" element={<ApiDocs />} />
              <Route path="/admin/settings" element={<Settings settings={settings} onUpdate={fetchSettings} />} />
            </Route>
          </Route>

          {/* Legacy redirects */}
          <Route path="/docs/public" element={<Navigate to="/" replace />} />
          <Route path="/docs/public/:id" element={<Navigate to="/doc/:id" replace />} />
          <Route path="/api-docs" element={<Navigate to="/admin/api-docs" replace />} />
          <Route path="/settings" element={<Navigate to="/admin/settings" replace />} />
          <Route path="/docs" element={<Navigate to="/admin/docs" replace />} />
          <Route path="/search" element={<Navigate to="/admin" replace />} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
