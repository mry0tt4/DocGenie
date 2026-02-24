import React, { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for stored auth token
    const token = localStorage.getItem('docgenie_token')
    if (token) {
      // In a real app, validate token with backend
      setUser({ token })
    }
    setLoading(false)
  }, [])

  const login = async (password) => {
    // Check for custom password in localStorage, fallback to 'admin'
    const storedPassword = localStorage.getItem('docgenie_admin_pass') || 'admin'
    
    if (password === storedPassword) {
      const token = btoa(password)
      localStorage.setItem('docgenie_token', token)
      setUser({ token })
      return { success: true }
    }
    return { success: false, error: 'Invalid password' }
  }

  const logout = () => {
    localStorage.removeItem('docgenie_token')
    setUser(null)
  }

  const isAuthenticated = !!user

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
