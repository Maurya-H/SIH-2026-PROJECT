import { useState, useRef, useEffect } from 'react'
import api from '../api'

const CATEGORIES = [
  { value: 'waterlogging', label: 'Waterlogging', color: 'bg-blue-500' },
  { value: 'pothole', label: 'Dangerous Pothole', color: 'bg-orange-500' },
  { value: 'fallen_tree', label: 'Fallen Tree', color: 'bg-green-600' },
  { value: 'road_blockage', label: 'Road Blockage', color: 'bg-yellow-500' },
  { value: 'pipe_burst', label: 'Pipe Burst', color: 'bg-cyan-500' },
  { value: 'fire', label: 'Fire', color: 'bg-red-600' },
  { value: 'other', label: 'Other', color: 'bg-gray-400' },
]

// Kept in sync with the Officer Dashboard's status workflow.
// Adjust these keys if your backend uses different status strings.
const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
]

const STATUS_META = {
  pending: { label: 'Pending', color: '#B45309', bg: '#FEF3C7' },
  in_progress: { label: 'In Progress', color: '#1D4ED8', bg: '#DBEAFE' },
  resolved: { label: 'Resolved', color: '#15803D', bg: '#DCFCE7' },
}

const getStatusMeta = (status) => STATUS_META[status] || { label: status || 'Unknown', color: '#4B5563', bg: '#F3F4F6' }

// Used only as the `reported_by` value when a citizen submits a new
// report — swap this out once real citizen accounts/auth exist.
const CITIZEN_ID = 'citizen_demo'

// "All Reports" tab: a public tracker of every issue reported in the
// area, filterable by status (Pending / In Progress / Resolved).
function AllReportsView({ refreshKey }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    fetchAllReports()
  }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAllReports = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/incidents/')
      setReports(res.data || [])
    } catch (err) {
      setError('Could not load reports — is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  const filteredReports = statusFilter === 'all' ? reports : reports.filter((r) => r.status === statusFilter)

  const countFor = (statusValue) =>
    statusValue === 'all' ? reports.length : reports.filter((r) => r.status === statusValue).length

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-lg font-bold text-slate-900">All Reports</h2>
        <button
          onClick={fetchAllReports}
          className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit mb-5 text-xs">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              statusFilter === tab.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label} <span className="text-slate-400">({countFor(tab.value)})</span>
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-slate-400 text-center py-8">Loading your reports…</p>}
      {!loading && error && <p className="text-sm text-red-600 text-center py-8">{error}</p>}

      {!loading && !error && filteredReports.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-8">
          {statusFilter === 'all' ? 'No issues reported yet.' : `No ${STATUS_TABS.find(t => t.value === statusFilter)?.label.toLowerCase()} reports.`}
        </p>
      )}

      {!loading && !error && filteredReports.length > 0 && (
        <div className="flex flex-col divide-y divide-slate-100">
          {filteredReports.map((report) => {
            const meta = getStatusMeta(report.status)
            const category = CATEGORIES.find((c) => c.value === report.category)
            return (
              <div key={report.id} className="py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${category?.color || 'bg-gray-400'}`} />
                    <span className="text-sm font-semibold text-slate-800 capitalize">
                      {(category?.label || report.category || 'Other')}
                    </span>
                  </div>
                  {report.description && (
                    <p className="text-xs text-slate-500 line-clamp-2">{report.description}</p>
                  )}
                  {report.created_at && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      Submitted {new Date(report.created_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <span
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0"
                  style={{ color: meta.color, backgroundColor: meta.bg }}
                >
                  {meta.label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ReportIncidentPage() {
  const [view, setView] = useState('report') // 'report' | 'all_reports'

  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [photoPreview, setPhotoPreview] = useState(null)
  const [location, setLocation] = useState(null)
  const [status, setStatus] = useState(null) // { type: 'success'|'error', text }
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef(null)

  // Bumped after a successful submission so "My Reports" refetches and
  // shows the new report immediately if the citizen switches tabs.
  const [reportsRefreshKey, setReportsRefreshKey] = useState(0)

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(reader.result)
    reader.readAsDataURL(file)
  }

  const handleRemovePhoto = () => {
    setPhotoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setStatus({ type: 'error', text: 'Geolocation not supported by your browser' })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setStatus(null)
      },
      () => setStatus({ type: 'error', text: 'Could not detect location — check permissions' })
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!category) {
      setStatus({ type: 'error', text: 'Select an incident type' })
      return
    }
    if (!location) {
      setStatus({ type: 'error', text: 'Detect your location before submitting' })
      return
    }
    setSubmitting(true)
    try {
      await api.post('/incidents/', {
        category,
        description,
        photo_url: photoPreview || '',
        latitude: location.lat,
        longitude: location.lng,
        reported_by: CITIZEN_ID,
      })
      setStatus({ type: 'success', text: 'Report submitted. Thank you for helping your community.' })
      setCategory('')
      setDescription('')
      setPhotoPreview(null)
      setLocation(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setReportsRefreshKey((k) => k + 1)
    } catch (err) {
      setStatus({ type: 'error', text: 'Could not submit report — is the backend running?' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
            <span className="text-lg font-semibold tracking-tight">CivicTrack</span>
          </div>
          <nav className="flex gap-6 text-sm text-slate-300">
            <button
              onClick={() => setView('report')}
              className={view === 'report' ? 'text-white font-medium' : 'hover:text-white transition-colors'}
            >
              Report Incident
            </button>
            <button
              onClick={() => setView('all_reports')}
              className={view === 'all_reports' ? 'text-white font-medium' : 'hover:text-white transition-colors'}
            >
              All Reports
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        {view === 'report' ? (
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Report a local incident</h1>
              <p className="text-slate-500 mt-1 text-sm">
                Help your community stay safe — reports go straight to your local officer's dashboard.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-6">
              {/* Category */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700">Incident type</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="border border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                >
                  <option value="">Select incident type</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
                {category && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                    <span className={`w-2 h-2 rounded-full ${CATEGORIES.find(c => c.value === category)?.color}`} />
                    Marked on the map with this color
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Briefly describe what's happening..."
                  className="border border-slate-300 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>

              {/* Photo upload */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700">Upload photo</label>
                <div className="flex items-center gap-4">
                  <label className="cursor-pointer border border-dashed border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-500 hover:border-amber-500 hover:text-amber-600 transition-colors">
                    📷 Choose photo
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </label>
                  {photoPreview && (
                    <div className="relative">
                      <img src={photoPreview} alt="Preview" className="h-14 w-14 object-cover rounded-lg border border-slate-200" />
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        title="Remove photo"
                        className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center rounded-full bg-slate-800 hover:bg-red-600 text-white text-xs leading-none shadow-sm transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Location */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700">Your location</label>
                <button
                  type="button"
                  onClick={detectLocation}
                  className="flex items-center gap-2 border border-slate-300 rounded-xl px-4 py-3 text-sm hover:bg-slate-50 transition-colors w-fit"
                >
                  📍 {location ? 'Location detected' : 'Detect location'}
                </button>
                {location && (
                  <p className="text-xs text-slate-400">
                    Lat: {location.lat.toFixed(5)}, Lng: {location.lng.toFixed(5)}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-medium rounded-xl py-3 transition-colors"
              >
                {submitting ? 'Submitting...' : 'Submit report'}
              </button>

              {status && (
                <p className={`text-sm text-center ${status.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                  {status.text}
                </p>
              )}
            </form>
          </>
        ) : (
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">All Issue Reports</h1>
              <p className="text-slate-500 mt-1 text-sm">
                Track the status of issues reported across the community — pending, in progress, or resolved.
              </p>
            </div>
            <AllReportsView refreshKey={reportsRefreshKey} />
          </>
        )}
      </main>
    </div>
  )
}

export default ReportIncidentPage