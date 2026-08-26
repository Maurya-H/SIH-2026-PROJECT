import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMapEvents } from 'react-leaflet'
import axios from 'axios'
import 'leaflet/dist/leaflet.css'

const DEFAULT_CENTER = [26.8467, 80.9462] // Lucknow — change to your demo location

function PolygonDrawer({ points, setPoints }) {
  useMapEvents({
    click(e) {
      setPoints([...points, [e.latlng.lat, e.latlng.lng]])
    },
  })
  return points.length > 0 ? <Polygon positions={points} pathOptions={{ color: 'red' }} /> : null
}

function OfficerDashboard() {
  const [incidents, setIncidents] = useState([])
  const [polygonPoints, setPolygonPoints] = useState([])
  const [ipiResult, setIpiResult] = useState(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    fetchIncidents()
  }, [])

  const fetchIncidents = async () => {
    try {
      const res = await axios.get('http://localhost:8000/incidents/')
      setIncidents(res.data)
    } catch (err) {
      setStatus('Failed to load incidents — is the backend running?')
    }
  }

  const clearPolygon = () => {
    setPolygonPoints([])
    setIpiResult(null)
  }

  const calculateScore = async () => {
    if (polygonPoints.length < 3) {
      setStatus('Draw at least 3 points to form a polygon')
      return
    }
    // Backend expects [lng, lat] pairs, closed polygon
    const coords = polygonPoints.map(([lat, lng]) => [lng, lat])
    coords.push(coords[0]) // close the polygon

    try {
      const res = await axios.post('http://localhost:8000/analytics/zone-score', {
        coordinates: coords,
      })
      setIpiResult(res.data)
      setStatus('')
    } catch (err) {
      setStatus('Failed to calculate score')
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="bg-white shadow p-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Officer Dashboard</h2>
        <div className="flex gap-2">
          <button
            onClick={calculateScore}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Calculate IPI Score
          </button>
          <button
            onClick={clearPolygon}
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            Clear Polygon
          </button>
        </div>
      </div>

      {status && <p className="text-center text-sm text-red-600 p-2">{status}</p>}

      {ipiResult && (
        <div className="bg-white m-4 p-4 rounded-xl shadow flex flex-wrap gap-6">
          <div>
            <p className="text-sm text-gray-500">Total Incidents in Zone</p>
            <p className="text-2xl font-bold">{ipiResult.total_incidents}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">IPI Score</p>
            <p className="text-2xl font-bold text-red-600">{ipiResult.ipi_score}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Breakdown</p>
            <p className="text-sm">
              {Object.entries(ipiResult.category_breakdown)
                .map(([cat, count]) => `${cat}: ${count}`)
                .join(', ') || 'None'}
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 m-4 rounded-xl overflow-hidden shadow" style={{ minHeight: '500px' }}>
        <MapContainer center={DEFAULT_CENTER} zoom={14} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
          />

          {incidents.map((incident) => (
            <Marker key={incident.id} position={[incident.latitude, incident.longitude]}>
              <Popup>
                <strong>{incident.category}</strong>
                <br />
                {incident.description}
                <br />
                Status: {incident.status}
              </Popup>
            </Marker>
          ))}

          <PolygonDrawer points={polygonPoints} setPoints={setPolygonPoints} />
        </MapContainer>
      </div>

      <p className="text-xs text-gray-400 text-center pb-2">
        Click on the map to draw a polygon (min 3 points), then click "Calculate IPI Score"
      </p>
    </div>
  )
}

export default OfficerDashboard