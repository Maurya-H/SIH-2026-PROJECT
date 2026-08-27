import { useState, useRef } from 'react'
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

function ReportIncidentPage() {
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [photoPreview, setPhotoPreview] = useState(null)
  const [location, setLocation] = useState(null)
  const [status, setStatus] = useState(null) // { type: 'success'|'error', text }
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef(null)

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(reader.result)
    reader.readAsDataURL(file)
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
        reported_by: 'citizen_demo',
      })
      setStatus({ type: 'success', text: 'Report submitted. Thank you for helping your community.' })
      setCategory('')
      setDescription('')
      setPhotoPreview(null)
      setLocation(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
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
            <a href="#" className="hover:text-white transition-colors">Home</a>
            <a href="#" className="text-white font-medium">Report Incident</a>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
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
                <img src={photoPreview} alt="Preview" className="h-14 w-14 object-cover rounded-lg border border-slate-200" />
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
      </main>
    </div>
  )
}

export default ReportIncidentPage