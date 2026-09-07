import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import * as h3 from 'h3-js'
import api from '../api'
import 'leaflet/dist/leaflet.css'

const LUCKNOW_CENTER = [26.8467, 80.9462]
const DEFAULT_ZOOM = 12

// Fallback list used only if the backend's /municipalities endpoint
// doesn't respond. Scoped to Lucknow only.
const LUCKNOW_NAGAR_PALIKA_FALLBACK = [
  { name: 'Lucknow Nagar Nigam', center: [26.8467, 80.9462] },
  { name: 'Bakshi Ka Talab', center: [26.98333, 80.88333] },
  { name: 'Banthra', center: [26.693327, 80.834622] },
  { name: 'Amethi', center: [26.76, 81.15] },
]

const CATEGORY_COLORS = {
  waterlogging: '#3B82F6',
  pothole: '#F97316',
  fallen_tree: '#16A34A',
  road_blockage: '#EAB308',
  pipe_burst: '#06B6D4',
  fire: '#DC2626',
  other: '#9CA3AF',
}

const CATEGORY_WEIGHTS = {
  fire: 5.0,
  fallen_tree: 4.0,
  pipe_burst: 3.5,
  waterlogging: 3.0,
  road_blockage: 2.5,
  pothole: 2.0,
  other: 1.0,
}

// Status workflow for incident reports. `next`/`nextLabel` drive the
// single action button shown per card — adjust the status strings here
// if your backend uses different values (e.g. 'in-progress' vs 'in_progress').
const STATUS_META = {
  pending: { label: 'Pending', color: '#F59E0B', bg: '#FEF3C7', next: 'in_progress', nextLabel: 'Mark In Progress' },
  in_progress: { label: 'In Progress', color: '#2563EB', bg: '#DBEAFE', next: 'resolved', nextLabel: 'Mark Resolved' },
  resolved: { label: 'Resolved', color: '#16A34A', bg: '#DCFCE7', next: null, nextLabel: null },
}

const getStatusMeta = (status) => STATUS_META[status] || { label: status || 'Unknown', color: '#6B7280', bg: '#F3F4F6', next: null, nextLabel: null }

// Styling for the (simulated) AI photo verification verdict submitted
// alongside the citizen's report, if any.
const AI_VERDICT_META = {
  match: { icon: '✅', color: '#15803D', bg: '#DCFCE7', label: 'AI: Match' },
  unclear: { icon: '⚠️', color: '#B45309', bg: '#FEF3C7', label: 'AI: Unclear' },
  mismatch: { icon: '⚠️', color: '#B91C1C', bg: '#FEE2E2', label: 'AI: Mismatch' },
}

const getH3Boundary = (cell) => {
  if (typeof h3.cellToBoundary === 'function') return h3.cellToBoundary(cell)
  if (typeof h3.h3ToGeoBoundary === 'function') return h3.h3ToGeoBoundary(cell)
  return []
}

const polygonToH3Cells = (coords, res = 8) => {
  if (typeof h3.polygonToCells === 'function') return h3.polygonToCells(coords, res)
  if (typeof h3.polyfill === 'function') return h3.polyfill(coords, res)
  return []
}

function coloredIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,0.15)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

// Multi-click polygon drawer (Advanced / freeform mode) — the only zone
// drawing tool now. Click at least 3 points on the map to outline a
// custom hazard zone boundary.
function PolygonDrawer({ active, points, setPoints }) {
  useMapEvents({
    click(e) {
      if (!active) return
      setPoints([...points, [e.latlng.lat, e.latlng.lng]])
    },
  })
  return active && points.length > 0 ? (
    <Polygon positions={points} pathOptions={{ color: '#F59E0B', weight: 2, dashArray: '4, 4' }} />
  ) : null
}

// Placed H3 Hexagonal Grid Overlay. `justPlaced` briefly boosts the
// fill opacity right after placement so it's unmistakable.
function H3Overlay({ hexCells, justPlaced }) {
  if (!hexCells || hexCells.length === 0) return null

  return hexCells.map((cell) => (
    <Polygon
      key={cell}
      positions={getH3Boundary(cell)}
      pathOptions={{
        color: '#DC2626',
        weight: 1.5,
        fillColor: '#EF4444',
        fillOpacity: justPlaced ? 0.7 : 0.35,
      }}
      className="h3-cell-transition"
    />
  ))
}

// Side panel listing incident reports next to the map. Officers can click
// a card to pan/select it on the map, and advance its status one step
// at a time (pending → in_progress → resolved) via the action button.
function IncidentReportsPanel({ incidents, selectedId, onSelect, onAdvanceStatus, updatingId, onViewPhoto }) {
  return (
    <div className="w-full md:w-[340px] shrink-0 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col" style={{ minHeight: '540px', maxHeight: '540px' }}>
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">Incident Reports</h3>
        <span className="text-[11px] text-slate-400 font-medium">{incidents.length} total</span>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {incidents.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-8 px-4">No incident reports for this area yet.</p>
        )}

        {incidents.map((incident) => {
          const meta = getStatusMeta(incident.status)
          const isSelected = incident.id === selectedId
          const isUpdating = incident.id === updatingId

          return (
            <div
              key={incident.id}
              onClick={() => onSelect(incident)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onSelect(incident)
              }}
              className={`w-full text-left px-4 py-3 transition-colors cursor-pointer ${isSelected ? 'bg-amber-50' : 'hover:bg-slate-50'}`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[incident.category] || '#9CA3AF' }}
                  />
                  <span className="text-xs font-semibold text-slate-800 capitalize truncate">
                    {(incident.category || 'other').replace('_', ' ')}
                  </span>
                </div>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                  style={{ color: meta.color, backgroundColor: meta.bg }}
                >
                  {meta.label}
                </span>
              </div>

              <p className="text-xs text-slate-500 line-clamp-2 mb-2">{incident.description}</p>

              {incident.ai_verdict && AI_VERDICT_META[incident.ai_verdict] && (
                <div
                  title={incident.ai_message || ''}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2"
                  style={{
                    color: AI_VERDICT_META[incident.ai_verdict].color,
                    backgroundColor: AI_VERDICT_META[incident.ai_verdict].bg,
                  }}
                >
                  <span>{AI_VERDICT_META[incident.ai_verdict].icon}</span>
                  {AI_VERDICT_META[incident.ai_verdict].label}
                </div>
              )}

              {incident.photo_url && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onViewPhoto(incident.photo_url)
                  }}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 transition-colors mb-2 mr-2"
                >
                  📷 View Photo
                </button>
              )}

              {meta.next && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onAdvanceStatus(incident.id, meta.next)
                  }}
                  disabled={isUpdating}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-50 transition-colors"
                >
                  {isUpdating ? 'Updating…' : meta.nextLabel}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MapRecenter({ focus }) {
  const map = useMapEvents({})
  const key = focus ? `${focus.center[0]},${focus.center[1]},${focus.zoom}` : null
  useEffect(() => {
    if (focus) map.setView(focus.center, focus.zoom)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function OfficerMapDashboard() {
  const [incidents, setIncidents] = useState([])

  // Once a citizen confirms an issue is actually resolved, it's fully
  // closed — no reason to keep it on the officer's active map/list.
  const activeIncidents = incidents.filter((i) => !i.citizen_confirmed)

  const [centerPoint, setCenterPoint] = useState(null)
  const [polygonPoints, setPolygonPoints] = useState([])
  const [hexCells, setHexCells] = useState([])
  const [justPlaced, setJustPlaced] = useState(false)

  const [ipiResult, setIpiResult] = useState(null)
  const [affectedCount, setAffectedCount] = useState(null)
  const [loadingAffected, setLoadingAffected] = useState(false)
  const [status, setStatus] = useState('')

  // Incident Reports side panel selection + status-update tracking
  const [selectedIncidentId, setSelectedIncidentId] = useState(null)
  const [updatingIncidentId, setUpdatingIncidentId] = useState(null)
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState(null)

  // Scoped to Lucknow only — no more district selector.
  const [nagarPalikas, setNagarPalikas] = useState([])
  const [selectedNagarPalika, setSelectedNagarPalika] = useState('')
  const [loadingPalikas, setLoadingPalikas] = useState(true)

  // Emergency SMS Broadcast States
  const [showSmsModal, setShowSmsModal] = useState(false)
  const [smsMessage, setSmsMessage] = useState('EMERGENCY ALERT: Severe incident reported in your area. Please stay safe and clear roads.')
  const [sendingSms, setSendingSms] = useState(false)
  const [smsResult, setSmsResult] = useState(null)

  const nagarPalikaCenter = nagarPalikas.find((np) => np.name === selectedNagarPalika)?.center
  const selectedIncident = activeIncidents.find((i) => i.id === selectedIncidentId)
  const mapFocus = selectedIncident
    ? { center: [selectedIncident.latitude, selectedIncident.longitude], zoom: 17 }
    : nagarPalikaCenter
    ? { center: nagarPalikaCenter, zoom: 14 }
    : { center: LUCKNOW_CENTER, zoom: DEFAULT_ZOOM }

  // Auto-calculate H3 hexes as the officer places polygon points
  useEffect(() => {
    if (polygonPoints.length >= 3) {
      try {
        const closedPoints = [...polygonPoints]
        if (
          closedPoints[0][0] !== closedPoints[closedPoints.length - 1][0] ||
          closedPoints[0][1] !== closedPoints[closedPoints.length - 1][1]
        ) {
          closedPoints.push(closedPoints[0])
        }
        const cells = polygonToH3Cells(closedPoints, 8)
        setHexCells(cells)
        fetchAffectedCount(cells)
      } catch (err) {
        console.error('Polygon calculation error:', err)
      }
    } else {
      setHexCells([])
    }
  }, [polygonPoints])

  // Load Lucknow's nagar palikas once on mount.
  useEffect(() => {
    setLoadingPalikas(true)
    api
      .get('/municipalities/', { params: { district: 'Lucknow' } })
      .then((res) => setNagarPalikas(res.data?.length ? res.data : LUCKNOW_NAGAR_PALIKA_FALLBACK))
      .catch(() => {
        setNagarPalikas(LUCKNOW_NAGAR_PALIKA_FALLBACK)
        setStatus('Using offline nagar palika list — backend /municipalities unreachable.')
      })
      .finally(() => setLoadingPalikas(false))
  }, [])

  useEffect(() => {
    fetchIncidents()
  }, [selectedNagarPalika]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchIncidents = async () => {
    try {
      const focus = nagarPalikaCenter
        ? { center: nagarPalikaCenter, radiusKm: 6 }
        : { center: LUCKNOW_CENTER, radiusKm: 25 }

      const params = { near_lat: focus.center[0], near_lng: focus.center[1], radius_km: focus.radiusKm }

      const res = await api.get('/incidents/', { params })
      setIncidents(res.data)
    } catch (err) {
      setStatus('Failed to load incidents — is the backend running?')
    }
  }

  // Advance an incident's status one step (pending → in_progress → resolved).
  const advanceIncidentStatus = async (incidentId, nextStatus) => {
    setUpdatingIncidentId(incidentId)
    try {
      await api.patch(`/incidents/${incidentId}`, { status: nextStatus })
      setIncidents((prev) =>
        prev.map((inc) => (inc.id === incidentId ? { ...inc, status: nextStatus } : inc))
      )
    } catch (err) {
      setStatus('Failed to update incident status.')
    } finally {
      setUpdatingIncidentId(null)
    }
  }

  const handleSelectIncident = (incident) => {
    setSelectedIncidentId((prev) => (prev === incident.id ? null : incident.id))
  }

  const clearZone = () => {
    setCenterPoint(null)
    setPolygonPoints([])
    setHexCells([])
    setIpiResult(null)
    setAffectedCount(null)
    setSmsResult(null)
    setStatus('')
  }

  // Estimate how many registered residents fall inside the current zone.
  const fetchAffectedCount = async (cells) => {
    if (!cells || cells.length === 0) return
    setLoadingAffected(true)
    try {
      const res = await api.post('/analytics/zone-residents', { h3_cells: cells })
      setAffectedCount(res.data?.count ?? null)
    } catch (err) {
      setAffectedCount(null)
    } finally {
      setLoadingAffected(false)
    }
  }

  // Reset the polygon drawing so a new zone can be started clean.
  const resetDrawing = () => {
    clearZone()
  }

  const calculateScore = async () => {
    if (polygonPoints.length < 3) {
      setStatus('Click at least 3 points to form a polygon zone')
      return
    }
    let coords = polygonPoints.map(([lat, lng]) => [lng, lat])

    if (coords.length > 0 && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
      coords.push(coords[0])
    }

    try {
      const res = await api.post('/analytics/zone-score', { coordinates: coords })
      setIpiResult(res.data)
      setStatus('')
    } catch (err) {
      setStatus('Failed to calculate score')
    }
  }

  // Simulated for the prototype — no SMS/FCM backend wired up yet.
  // Swap this back to a real `api.post('/alert/hex-warning', {...})` call
  // once that route exists on the backend.
  const handleBroadcastSms = async () => {
    if (hexCells.length === 0) return
    setSendingSms(true)
    try {
      // Fake network delay + a plausible resident count so the demo flow
      // (button -> "sending..." -> success message) feels real end-to-end.
      await new Promise((resolve) => setTimeout(resolve, 700))
      const simulatedResidents = affectedCount ?? hexCells.length * 120
      setSmsResult({ residents_found: simulatedResidents, simulated: true })
      setShowSmsModal(false)
    } catch (err) {
      setStatus('Failed to dispatch emergency SMS warning.')
    } finally {
      setSendingSms(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
            <span className="text-lg font-semibold tracking-tight">CivicTrack</span>
            <span className="text-slate-400 text-sm ml-2">Officer Dashboard · Lucknow</span>
          </div>

          {/* Zone Tools */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300">
              ✏️ Click points on the map to draw a hazard zone
            </span>

            <select
              value={selectedNagarPalika}
              onChange={(e) => setSelectedNagarPalika(e.target.value)}
              disabled={loadingPalikas}
              className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 text-white border border-slate-700 focus:outline-none disabled:opacity-50"
            >
              <option value="">
                {loadingPalikas ? 'Loading nagar palikas...' : 'All Lucknow nagar palikas'}
              </option>
              {nagarPalikas.map((np) => (
                <option key={np.name} value={np.name}>{np.name}</option>
              ))}
            </select>

            <button
              onClick={calculateScore}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
            >
              Calculate IPI
            </button>
            <button
              onClick={resetDrawing}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      </header>

      {status && <p className="text-center text-xs font-semibold text-red-600 bg-red-50 py-1.5">{status}</p>}

      <div className="max-w-[1600px] mx-auto w-full mt-3 px-4 flex items-center justify-between text-xs text-slate-500">
        <span>
          Showing <strong className="text-slate-700">{activeIncidents.length}</strong> incident
          {activeIncidents.length === 1 ? '' : 's'}
          {selectedNagarPalika ? ` in ${selectedNagarPalika}` : ' in Lucknow'}
        </span>
        <div className="flex items-center gap-2">
          {hexCells.length > 0 && (
            <span className="bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full font-semibold">
              Placed Hazard Zone: {hexCells.length} cells (~{(hexCells.length * 0.73).toFixed(1)} km²)
            </span>
          )}
          {hexCells.length > 0 && (
            <span className="bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full font-semibold">
              {loadingAffected
                ? 'Estimating affected residents…'
                : affectedCount !== null
                ? `~${affectedCount} residents in zone`
                : 'Resident count unavailable'}
            </span>
          )}
        </div>
      </div>

      {ipiResult && (
        <div className="max-w-[1600px] mx-auto w-full mt-3 px-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-wrap justify-between items-center gap-6">
            <div className="flex flex-wrap gap-8">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400 font-medium">Total Incidents</p>
                <p className="text-2xl font-bold text-slate-900">{ipiResult.total_incidents}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400 font-medium">IPI Score</p>
                <p className="text-2xl font-bold" style={{ color: ipiResult.priority_color }}>
                  {ipiResult.ipi_score} <span className="text-xs font-normal text-slate-400">/ 100</span>
                </p>
                <p className="text-xs font-bold" style={{ color: ipiResult.priority_color }}>
                  {ipiResult.priority_label} Priority
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Severity Breakdown</p>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(ipiResult.category_breakdown)
                    .sort(([catA], [catB]) => (CATEGORY_WEIGHTS[catB] || 1) - (CATEGORY_WEIGHTS[catA] || 1))
                    .map(([cat, count]) => (
                      <div key={cat} className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: CATEGORY_COLORS[cat] || '#9CA3AF' }}
                        />
                        <span className="capitalize font-medium">{cat.replace('_', ' ')}</span>
                        <span className="text-slate-400 font-semibold">×{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <button
                onClick={() => setShowSmsModal(true)}
                disabled={hexCells.length === 0}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center gap-2 transition-all"
              >
                <span>🚨</span> Broadcast SMS Alert
              </button>
              {smsResult && (
                <p className="text-[11px] text-emerald-600 font-semibold">
                  ✓ Sent to {smsResult.residents_found || 0} local residents{smsResult.simulated ? ' (simulated)' : ''}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Incident Reports + Map Section */}
      <div className="flex-1 max-w-[1600px] mx-auto w-full mt-3 mb-4 px-4 flex flex-col md:flex-row gap-4">
        <IncidentReportsPanel
          incidents={activeIncidents}
          selectedId={selectedIncidentId}
          onSelect={handleSelectIncident}
          onAdvanceStatus={advanceIncidentStatus}
          updatingId={updatingIncidentId}
          onViewPhoto={setViewingPhotoUrl}
        />

        <div className="flex-1 min-w-0">
          <div className="rounded-2xl overflow-hidden shadow-sm border border-slate-200" style={{ minHeight: '540px' }}>
            <MapContainer center={LUCKNOW_CENTER} zoom={DEFAULT_ZOOM} style={{ height: '100%', width: '100%', minHeight: '540px' }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
              {activeIncidents.map((incident) => (
                <Marker
                  key={incident.id}
                  position={[incident.latitude, incident.longitude]}
                  icon={coloredIcon(CATEGORY_COLORS[incident.category] || '#9CA3AF')}
                  eventHandlers={{ click: () => handleSelectIncident(incident) }}
                >
                  <Popup>
                    <strong className="capitalize">{incident.category.replace('_', ' ')}</strong>
                    <br />
                    {incident.description}
                    <br />
                    Status: {getStatusMeta(incident.status).label}
                    {incident.ai_verdict && AI_VERDICT_META[incident.ai_verdict] && (
                      <>
                        <br />
                        {AI_VERDICT_META[incident.ai_verdict].icon} {AI_VERDICT_META[incident.ai_verdict].label}
                      </>
                    )}
                  </Popup>
                </Marker>
              ))}

              {/* Click points on the map to draw a custom hazard zone boundary */}
              <PolygonDrawer
                active={true}
                points={polygonPoints}
                setPoints={setPolygonPoints}
              />

              {/* Center Epicenter Marker */}
              {centerPoint && (
                <Marker position={centerPoint} icon={coloredIcon('#DC2626')} />
              )}

              {/* Placed H3 Hexagonal Grid Overlay */}
              <H3Overlay hexCells={hexCells} justPlaced={justPlaced} />

              <MapRecenter focus={mapFocus} />
            </MapContainer>
          </div>
          <p className="text-xs text-slate-400 text-center mt-2">
            ✏️ Click at least 3 points on the map to draw a hazard zone boundary. Click "Clear" to start over.
          </p>
        </div>
      </div>

      {/* Emergency Alert Modal */}
      {showSmsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-100">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <span className="text-2xl">🚨</span>
              <h3 className="text-lg font-bold text-slate-900">Broadcast Citizen Emergency Alert</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              This will send an instant SMS warning to registered citizens living inside the <strong>{hexCells.length} targeted hexagonal cells</strong> (~{(hexCells.length * 0.73).toFixed(1)} km²)
              {affectedCount !== null && (
                <> — an estimated <strong>{affectedCount} residents</strong>.</>
              )}
            </p>

            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Alert Message</label>
            <textarea
              rows={3}
              value={smsMessage}
              onChange={(e) => setSmsMessage(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-red-500 mb-4 text-slate-800"
            />

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowSmsModal(false)}
                className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleBroadcastSms}
                disabled={sendingSms}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-medium text-xs rounded-xl disabled:opacity-50 transition-colors"
              >
                {sendingSms ? 'Dispatching...' : 'Confirm & Send SMS'}
              </button>
            </div>
          </div>
        </div>
        
      )}

      {/* Photo Viewer Modal */}
      {viewingPhotoUrl && (
        <div
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          onClick={() => setViewingPhotoUrl(null)}
        >
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setViewingPhotoUrl(null)}
              className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white text-slate-800 shadow-lg hover:bg-slate-100 transition-colors"
              title="Close"
            >
              ✕
            </button>
            <img
              src={viewingPhotoUrl}
              alt="Incident report"
              className="w-full max-h-[80vh] object-contain rounded-xl shadow-2xl bg-white"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default OfficerMapDashboard