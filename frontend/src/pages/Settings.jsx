import React, { useState, useEffect, useRef } from 'react'

const Settings = ({ settings, onUpdate }) => {
  const [formData, setFormData] = useState({
    site_name: settings.site_name || 'DocGenie',
    repo_path: settings.repo_path || './docs',
    project_code_path: settings.project_code_path || '',
    openai_api_key: '',
    auto_sync_enabled: settings.auto_sync_enabled === 'true',
    api_doc_enabled: settings.api_doc_enabled === 'true'
  })

  const [logoPreview, setLogoPreview] = useState(settings.logo_url || '')
  const [logoFile, setLogoFile] = useState(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const fileInputRef = useRef(null)

  // Sync form state when settings prop changes (e.g. after fetch)
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      site_name: settings.site_name || 'DocGenie',
      repo_path: settings.repo_path || './docs',
      project_code_path: settings.project_code_path || '',
      auto_sync_enabled: settings.auto_sync_enabled === 'true',
      api_doc_enabled: settings.api_doc_enabled === 'true',
      // Don't overwrite API key input — it's masked as *** from server
    }))
    setLogoPreview(settings.logo_url || '')
  }, [settings])

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  const handleChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleLogoSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    // Validate
    const allowed = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) {
      alert('Please select a valid image (PNG, JPG, SVG, WebP, or GIF)')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be smaller than 2MB')
      return
    }
    
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const handleLogoUpload = async () => {
    if (!logoFile) return
    setUploadingLogo(true)
    
    try {
      const form = new FormData()
      form.append('logo', logoFile)
      
      const res = await fetch('/api/settings/logo', {
        method: 'POST',
        body: form
      })
      const data = await res.json()
      
      if (data.success) {
        setLogoFile(null)
        setLogoPreview(data.url)
        onUpdate()
      } else {
        alert('Failed to upload logo')
      }
    } catch (err) {
      console.error('Logo upload failed:', err)
      alert('Failed to upload logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleLogoRemove = async () => {
    try {
      await fetch('/api/settings/logo', { method: 'DELETE' })
      setLogoFile(null)
      setLogoPreview('')
      onUpdate()
    } catch (err) {
      console.error('Failed to remove logo:', err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      const updates = [
        { key: 'site_name', value: formData.site_name },
        { key: 'repo_path', value: formData.repo_path },
        { key: 'project_code_path', value: formData.project_code_path },
        { key: 'auto_sync_enabled', value: String(formData.auto_sync_enabled) },
        { key: 'api_doc_enabled', value: String(formData.api_doc_enabled) }
      ]
      
      if (formData.openai_api_key !== '') {
        updates.push({ key: 'openai_api_key', value: formData.openai_api_key })
      }
      
      await Promise.all(
        updates.map(u => 
          fetch(`/api/settings/${u.key}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: u.value })
          })
        )
      )
      
      // Upload logo if one was selected
      if (logoFile) {
        await handleLogoUpload()
      }
      
      setSaved(true)
      onUpdate()
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Failed to save settings:', err)
      alert('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }

    if (passwordData.newPassword.length < 4) {
      setPasswordError('Password must be at least 4 characters')
      return
    }

    const currentStored = localStorage.getItem('docgenie_admin_pass') || 'admin'
    
    if (passwordData.currentPassword !== currentStored) {
      setPasswordError('Current password is incorrect')
      return
    }

    localStorage.setItem('docgenie_admin_pass', passwordData.newPassword)
    setPasswordSuccess('Password changed successfully!')
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
  }

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <h1>Settings</h1>
        <p style={{ color: '#666', marginTop: '0.5rem' }}>Configure your DocGenie instance</p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Unified Settings Panel */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: 'rgba(255, 107, 0, 0.1)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem'
            }}>⚙️</div>
            <div>
              <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Configuration</h2>
              <p style={{ fontSize: '0.875rem', color: '#666', margin: 0 }}>General and AI settings</p>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gap: '2rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))'
          }}>
            {/* Left Column - General */}
            <div>
              <h3 style={{ fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', marginBottom: '1rem' }}>General</h3>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: '#aaa' }}>Site Name</label>
                <input
                  type="text"
                  value={formData.site_name}
                  onChange={(e) => handleChange('site_name', e.target.value)}
                  style={{ background: '#1a1a1a' }}
                />
                <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>Appears in the sidebar, public site header, and browser tab</p>
              </div>

              {/* Logo Upload */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: '#aaa' }}>Site Logo</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {/* Preview */}
                  <div style={{
                    width: '48px',
                    height: '48px',
                    background: '#1a1a1a',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #2a2a2a',
                    overflow: 'hidden',
                    flexShrink: 0
                  }}>
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#ff6b00', fontSize: '0.875rem' }}>LD</span>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
                        onChange={handleLogoSelect}
                        style={{ display: 'none' }}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          padding: '0.375rem 0.75rem',
                          background: '#1a1a1a',
                          border: '1px solid #2a2a2a',
                          borderRadius: '6px',
                          color: '#ccc',
                          cursor: 'pointer',
                          fontSize: '0.8125rem'
                        }}
                      >
                        {logoPreview ? 'Change' : 'Upload'}
                      </button>
                      
                      {logoFile && (
                        <button
                          type="button"
                          onClick={handleLogoUpload}
                          disabled={uploadingLogo}
                          style={{
                            padding: '0.375rem 0.75rem',
                            background: '#ff6b00',
                            border: 'none',
                            borderRadius: '6px',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '0.8125rem'
                          }}
                        >
                          {uploadingLogo ? 'Uploading...' : 'Save Logo'}
                        </button>
                      )}
                      
                      {logoPreview && !logoFile && (
                        <button
                          type="button"
                          onClick={handleLogoRemove}
                          style={{
                            padding: '0.375rem 0.75rem',
                            background: 'transparent',
                            border: '1px solid #3a2020',
                            borderRadius: '6px',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: '0.8125rem'
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#666', margin: 0 }}>
                      PNG, JPG, SVG, or WebP · Max 2MB
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: '#aaa' }}>Documentation Repository Path</label>
                <input
                  type="text"
                  value={formData.repo_path}
                  onChange={(e) => handleChange('repo_path', e.target.value)}
                  placeholder="./docs"
                  style={{ background: '#1a1a1a' }}
                />
                <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>Where markdown documentation files are stored</p>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: '#aaa' }}>Project Code Path</label>
                <input
                  type="text"
                  value={formData.project_code_path}
                  onChange={(e) => handleChange('project_code_path', e.target.value)}
                  placeholder="/path/to/your/project"
                  style={{ background: '#1a1a1a' }}
                />
                <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>Path to your project's source code for API route scanning</p>
              </div>
            </div>

            {/* Right Column - AI */}
            <div>
              <h3 style={{ fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', marginBottom: '1rem' }}>AI Features</h3>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: '#aaa' }}>OpenAI API Key</label>
                <input
                  type="password"
                  value={formData.openai_api_key}
                  onChange={(e) => handleChange('openai_api_key', e.target.value)}
                  placeholder={settings.openai_api_key === '***' ? '••••••••  (key saved)' : 'sk-...'}
                  style={{ background: '#1a1a1a' }}
                />
                <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                  {settings.openai_api_key === '***' 
                    ? '✓ API key is saved. Enter a new key to replace it.' 
                    : 'Required for AI search & API docs'}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', padding: '0.75rem', background: '#1a1a1a', borderRadius: '8px' }}>
                  <input
                    type="checkbox"
                    checked={formData.auto_sync_enabled}
                    onChange={(e) => handleChange('auto_sync_enabled', e.target.checked)}
                    style={{ width: '18px', height: '18px', marginTop: '2px', flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontSize: '0.875rem' }}>Auto-sync with git</div>
                    <div style={{ fontSize: '0.75rem', color: '#666' }}>Watch files for changes</div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', padding: '0.75rem', background: '#1a1a1a', borderRadius: '8px' }}>
                  <input
                    type="checkbox"
                    checked={formData.api_doc_enabled}
                    onChange={(e) => handleChange('api_doc_enabled', e.target.checked)}
                    style={{ width: '18px', height: '18px', marginTop: '2px', flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontSize: '0.875rem' }}>Auto-generate API docs</div>
                    <div style={{ fontSize: '0.75rem', color: '#666' }}>Scan project code path for routes</div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: '1px', background: '#2a2a2a', margin: '1.5rem 0' }}></div>

          {/* Save Button - Integrated at bottom */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            
            {saved && (
              <span style={{ color: '#22c55e', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>✓</span> Saved successfully!
              </span>
            )}
          </div>
        </div>
      </form>

      {/* Bottom Row - Security + About */}
      <form onSubmit={handlePasswordChange}>
        <div style={{
          display: 'grid',
          gap: '1.5rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))'
        }}>
          
          {/* Password Change Card */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                background: 'rgba(34, 197, 94, 0.1)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem'
              }}>🔒</div>
              <div>
                <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Security</h2>
                <p style={{ fontSize: '0.875rem', color: '#666', margin: 0 }}>Change admin password</p>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: '#aaa' }}>Current Password</label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                style={{ background: '#1a1a1a' }}
                required
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: '#aaa' }}>New Password</label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                style={{ background: '#1a1a1a' }}
                required
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: '#aaa' }}>Confirm New Password</label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                style={{ background: '#1a1a1a' }}
                required
              />
            </div>

            {passwordError && (
              <div style={{ color: '#ef4444', fontSize: '0.875rem', marginBottom: '1rem' }}>{passwordError}</div>
            )}

            {passwordSuccess && (
              <div style={{ color: '#22c55e', fontSize: '0.875rem', marginBottom: '1rem' }}>{passwordSuccess}</div>
            )}

            <button type="submit" className="btn btn-primary">
              Update Password
            </button>
          </div>

          {/* About Card */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                background: 'rgba(59, 130, 246, 0.1)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem'
              }}>📚</div>
              <div>
                <h2 style={{ fontSize: '1.125rem', margin: 0 }}>About</h2>
                <p style={{ fontSize: '0.875rem', color: '#666', margin: 0 }}>DocGenie info</p>
              </div>
            </div>

            <p style={{ color: '#888', lineHeight: '1.7', marginBottom: '1.5rem' }}>
              DocGenie is an AI-powered documentation platform that automatically generates
              and maintains your docs from your codebase.
            </p>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(2, 1fr)', 
              gap: '1rem'
            }}>
              <div style={{ background: '#1a1a1a', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ff6b00' }}>1.0</div>
                <div style={{ fontSize: '0.75rem', color: '#666' }}>Version</div>
              </div>
              
              <div style={{ background: '#1a1a1a', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ff6b00' }}>React</div>
                <div style={{ fontSize: '0.75rem', color: '#666' }}>Frontend</div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

export default Settings
