import { useState } from 'react'
import axios from 'axios'

const CATEGORIES = ['waterlogging', 'pothole', 'fallen_tree', 'other']

function CitizenForm() {
  const [category, setCategory] = useState(CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState(null)
  const [status, setStatus] = useState('')

  const getLocation = () => {
    if (!navigator.geolocation) {
      setStatus('Geolocation not supported by your browser')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setStatus('Location captured ✅')
      },
      () => setStatus('Could not get location — allow permission and try again')
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!location) {
      setStatus('Please capture your location first')
      return
    }
    try {
      await axios.post('http://localhost:8000/incidents/', {
        category,
        description,
        photo_url: '', // TODO: wire up real photo upload
        latitude: location.lat,
        longitude: location.lng,
        reported_by: 'citizen_demo',
      })
      setStatus('Incident reported successfully! 🎉')
      setDescription('')
      setLocation(null)
    } catch (err) {
      setStatus('Failed to submit. Is the backend running?')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white shadow-md rounded-xl p-6 w-full max-w-md flex flex-col gap-4"
      >
        <h2 className="text-xl font-bold">Report an Issue</h2>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border rounded-lg p-2"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat.replace('_', ' ')}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border rounded-lg p-2"
            rows={3}
            placeholder="Briefly describe the issue..."
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Location</span>
          <button
            type="button"
            onClick={getLocation}
            className="border rounded-lg p-2 bg-gray-100 hover:bg-gray-200"
          >
            📍 Capture My Location
          </button>
          {location && (
            <p className="text-xs text-gray-500">
              Lat: {location.lat.toFixed(5)}, Lng: {location.lng.toFixed(5)}
            </p>
          )}
        </div>

        {/* TODO (F1): Add real photo upload input here — this is where
            the AI classifier gets triggered once photo_url is real */}

        <button
          type="submit"
          className="bg-blue-600 text-white rounded-lg p-2 hover:bg-blue-700"
        >
          Submit Report
        </button>

        {status && <p className="text-sm text-center text-gray-700">{status}</p>}
      </form>
    </div>
  )
}

export default CitizenForm