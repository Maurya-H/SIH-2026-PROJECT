import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import * as h3 from 'h3-js'
import api from '../api'
import 'leaflet/dist/leaflet.css'

const DEFAULT_CENTER = [26.955, 81.096]

const DISTRICTS = [
  { name: 'Lucknow', center: [26.8467, 80.9462] },
  { name: 'Kanpur Nagar', center: [26.4499, 80.3319] },
  { name: 'Varanasi', center: [25.3176, 82.9739] },
  { name: 'Prayagraj', center: [25.4358, 81.8463] },
  { name: 'Agra', center: [27.1767, 78.0081] },
  { name: 'Gorakhpur', center: [26.7606, 83.3732] },
]

const NAGAR_PALIKA_FALLBACK = {
  Lucknow: [
    { name: 'Lucknow Nagar Nigam', center: [26.8467, 80.9462] },
    { name: 'Bakshi Ka Talab', center: [26.98333, 80.88333] },
    { name: 'Banthra', center: [26.693327, 80.834622] },
    { name: 'Amethi', center: [26.76, 81.15] },
  ],
  'Kanpur Nagar': [
    { name: 'Kanpur Nagar Nigam', center: [26.4499, 80.3319] },
    { name: 'Ghatampur', center: [26.17, 80.17] },
    { name: 'Bilhaur', center: [26.85, 80.08] },
    { name: 'Shivrajpur', center: [26.85722, 79.115] },
    { name: 'Bithoor', center: [26.6127, 80.2719] },
  ],
  Varanasi: [
    { name: 'Varanasi Nagar Nigam', center: [25.3176, 82.9739] },
    { name: 'Ramnagar', center: [25.28, 83.03] },
    { name: 'Gangapur', center: [25.459835, 82.878195] },
  ],
  Prayagraj: [
    { name: 'Prayagraj Nagar Nigam', center: [25.4358, 81.8463] },
    { name: 'Sirsa', center: [25.28, 82.08] },
    { name: 'Lalgopalganj', center: [25.65, 81.617] },
    { name: 'Phulpur', center: [25.55, 82.1] },
    { name: 'Shankargarh', center: [25.183, 81.617] },
    { name: 'Koraon', center: [25.008, 82.068] },
    { name: 'Handia', center: [25.38, 82.18] },
    { name: 'Bharatganj', center: [25.11972, 82.27389] },
    { name: 'Mauaima', center: [25.7, 81.917] },
  ],
  Agra: [
    { name: 'Agra Nagar Nigam', center: [27.1767, 78.0081] },
    { name: 'Fatehpur Sikri', center: [27.091, 77.661] },
    { name: 'Shamsabad', center: [27.02, 78.13] },
    { name: 'Etmadpur', center: [27.235, 78.198] },
    { name: 'Bah', center: [26.52, 78.35] },
    { name: 'Achhnera', center: [27.18, 77.77] },
    { name: 'Pinahat', center: [26.88, 78.38] },
    { name: 'Fatehabad', center: [27.1, 78.19] },
    { name: 'Kirawali', center: [27.15, 77.78] },
    { name: 'Kheragarh', center: [26.933, 77.817] },
    { name: 'Jagner', center: [26.86293, 77.60167] },
  ],
  Gorakhpur: [
    { name: 'Gorakhpur Nagar Nigam', center: [26.7606, 83.3732] },
    { name: 'Bansgaon', center: [26.567, 83.35] },
    { name: 'Pipiganj', center: [26.93111, 83.29889] },
    { name: 'Pipraich', center: [26.83, 83.53] },
    { name: 'Gola Bazar', center: [26.34722, 83.35417] },
    { name: 'Mundera Bazar', center: [26.649, 83.594] },
    { name: 'Sahjanwa', center: [26.7636, 83.2161] },
    { name: 'Barhalganj', center: [26.283, 83.5] },
    { name: 'Campierganj', center: [27.0290, 83.2668] },
  ],
}

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

// Stamp shapes offered in the toolbar. Centralized so the buttons, the
// active-state check, and the label all come from one place.
const STAMP_SHAPES = [
  { rings: 0, icon: '🔷', label: '1 Hex' },
  { rings: 1, icon: '🐝', label: '7-Hex Honeycomb' },
  { rings: 2, icon: '🌐', label: '19-Hex Cluster' },
]

// Universal H3 compatibility wrappers (supports h3-js v3 & v4)
const getH3Cell = (lat, lng, res = 8) => {
  if (typeof h3.latlngToCell === 'function') return h3.latlngToCell(lat, lng, res)
  if (typeof h3.geoToH3 === 'function') return h3.geoToH3(lat, lng, res)
  return null
}

const getH3Disk = (cell, k) => {
  if (typeof h3.gridDisk === 'function') return h3.gridDisk(cell, k)
  if (typeof h3.kRing === 'function') return h3.kRing(cell, k)
  return [cell]
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

// Live Shape Stamp Tool (Hover preview + single click placement).
// Preview is now outline-only (no fill) so it can never be mistaken for
// a placed zone, which is filled solid.
function ShapeStampTool({ active, kRings, onPlaceShape }) {
  const [previewHexes, setPreviewHexes] = useState([])

  useMapEvents({
    mousemove(e) {
      if (!active) return
      try {
        const cell = getH3Cell(e.latlng.lat, e.latlng.lng, 8)
        if (cell) setPreviewHexes(getH3Disk(cell, kRings))
      } catch (err) {
        console.error('Hover preview error:', err)
      }
    },
    click(e) {
      if (!active) return
      try {
        const cell = getH3Cell(e.latlng.lat, e.latlng.lng, 8)
        if (cell) onPlaceShape(getH3Disk(cell, kRings), [e.latlng.lat, e.latlng.lng])
      } catch (err) {
        console.error('Shape placement error:', err)
      }
    },
  })

  if (!active || previewHexes.length === 0) return null

  return previewHexes.map((cell) => (
    <Polygon
      key={`preview-${cell}`}
      positions={getH3Boundary(cell)}
      pathOptions={{
        color: '#F59E0B',
        weight: 2,
        fillOpacity: 0,
        dashArray: '4, 4',
      }}
    />
  ))
}

// Multi-click polygon drawer (Advanced / freeform mode)
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
// fill opacity right after a stamp click so placement is unmistakable.
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

  // Selection Modes: 'stamp' (honeycomb shape picker) vs 'polygon' (advanced free drawing)
  const [selectionMode, setSelectionMode] = useState('stamp')
  const [kRings, setKRings] = useState(1) // 0 = 1 Hex, 1 = 7-Hex Honeycomb, 2 = 19-Hex Cluster
  const [centerPoint, setCenterPoint] = useState(null)
  const [polygonPoints, setPolygonPoints] = useState([])
  const [hexCells, setHexCells] = useState([])
  const [justPlaced, setJustPlaced] = useState(false)

  const [ipiResult, setIpiResult] = useState(null)
  const [affectedCount, setAffectedCount] = useState(null)
  const [loadingAffected, setLoadingAffected] = useState(false)
  const [status, setStatus] = useState('')

  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [nagarPalikas, setNagarPalikas] = useState([])
  const [selectedNagarPalika, setSelectedNagarPalika] = useState('')
  const [loadingPalikas, setLoadingPalikas] = useState(false)

  // Emergency SMS Broadcast States
  const [showSmsModal, setShowSmsModal] = useState(false)
  const [smsMessage, setSmsMessage] = useState('EMERGENCY ALERT: Severe incident reported in your area. Please stay safe and clear roads.')
  const [sendingSms, setSendingSms] = useState(false)
  const [smsResult, setSmsResult] = useState(null)

  const districtCenter = DISTRICTS.find((d) => d.name === selectedDistrict)?.center
  const nagarPalikaCenter = nagarPalikas.find((np) => np.name === selectedNagarPalika)?.center
  const mapFocus = nagarPalikaCenter
    ? { center: nagarPalikaCenter, zoom: 14 }
    : districtCenter
    ? { center: districtCenter, zoom: 12 }
    : null

  // Auto-calculate H3 hexes in "Advanced" (freeform polygon) mode
  useEffect(() => {
    if (selectionMode === 'polygon' && polygonPoints.length >= 3) {
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
    } else if (selectionMode === 'polygon') {
      setHexCells([])
    }
  }, [polygonPoints, selectionMode])

  useEffect(() => {
    fetchIncidents()
  }, [selectedDistrict, selectedNagarPalika]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchIncidents = async () => {
    try {
      const focus = nagarPalikaCenter
        ? { center: nagarPalikaCenter, radiusKm: 6 }
        : districtCenter
        ? { center: districtCenter, radiusKm: 25 }
        : null

      const params = focus
        ? { near_lat: focus.center[0], near_lng: focus.center[1], radius_km: focus.radiusKm }
        : {}

      const res = await api.get('/incidents/', { params })
      setIncidents(res.data)
    } catch (err) {
      setStatus('Failed to load incidents — is the backend running?')
    }
  }

  useEffect(() => {
    setSelectedNagarPalika('')
    if (!selectedDistrict) {
      setNagarPalikas([])
      return
    }
    setLoadingPalikas(true)
    api
      .get('/municipalities', { params: { district: selectedDistrict } })
      .then((res) => setNagarPalikas(res.data || []))
      .catch(() => {
        const fallback = NAGAR_PALIKA_FALLBACK[selectedDistrict] || []
        setNagarPalikas(fallback)
        if (fallback.length === 0) {
          setStatus(`No nagar palika list available yet for ${selectedDistrict}.`)
        }
      })
      .finally(() => setLoadingPalikas(false))
  }, [selectedDistrict])

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
  // Mirrors the geospatial lookup /alert/hex-warning already does when it
  // reports residents_found — just called earlier, before you commit to
  // sending anything.
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

  // Single entry point for choosing a stamp shape. Always clears any
  // leftover freeform/older stamp state first, so switching tools never
  // leaves stale hexes behind.
  const selectStamp = (rings) => {
    clearZone()
    setSelectionMode('stamp')
    setKRings(rings)
  }

  const selectFreeform = () => {
    clearZone()
    setSelectionMode('polygon')
  }

  const handlePlaceShape = (placedHexes, point) => {
    setHexCells(placedHexes)
    setCenterPoint(point)
    setStatus('')
    // brief "just placed" flash for unmistakable confirmation
    setJustPlaced(true)
    setTimeout(() => setJustPlaced(false), 350)
    fetchAffectedCount(placedHexes)
  }

  const calculateScore = async () => {
    let coords = []

    if (selectionMode === 'stamp') {
      if (hexCells.length === 0) {
        setStatus('Click on the map to stamp a hex shape first')
        return
      }
      try {
        const multiPoly = h3.cellsToMultiPolygon(hexCells, true)
        const outerRing = multiPoly[0][0]
        coords = outerRing.map(([lat, lng]) => [lng, lat])
      } catch (e) {
        setStatus('Could not compute zone boundary')
        return
      }
    } else {
      if (polygonPoints.length < 3) {
        setStatus('Click at least 3 points to form a polygon zone')
        return
      }
      coords = polygonPoints.map(([lat, lng]) => [lng, lat])
    }

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

  const handleBroadcastSms = async () => {
    if (hexCells.length === 0) return
    setSendingSms(true)
    try {
      const res = await api.post('/alert/hex-warning', {
        h3_cells: hexCells,
        message: smsMessage,
      })
      setSmsResult(res.data)
      setShowSmsModal(false)
    } catch (err) {
      setStatus('Failed to dispatch emergency SMS warning.')
    } finally {
      setSendingSms(false)
    }
  }

  const stampButtonClass = (rings) =>
    `px-2.5 py-1.5 rounded-md font-medium transition-colors ${
      selectionMode === 'stamp' && kRings === rings ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-300 hover:text-white'
    }`

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
            <span className="text-lg font-semibold tracking-tight">CivicTrack</span>
            <span className="text-slate-400 text-sm ml-2">Officer Dashboard</span>
          </div>

          {/* Shape Selector Bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700 text-xs">
              {STAMP_SHAPES.map((shape) => (
                <button
                  key={shape.rings}
                  onClick={() => selectStamp(shape.rings)}
                  className={stampButtonClass(shape.rings)}
                >
                  {shape.icon} {shape.label}
                </button>
              ))}
              <span className="w-px h-4 bg-slate-600 mx-1" />
              <button
                onClick={selectFreeform}
                title="Draw a custom irregular boundary point by point"
                className={`px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                  selectionMode === 'polygon' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                ✏️ Advanced: Custom Shape
              </button>
            </div>

            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 text-white border border-slate-700 focus:outline-none"
            >
              <option value="">All districts</option>
              {DISTRICTS.map((d) => (
                <option key={d.name} value={d.name}>{d.name}</option>
              ))}
            </select>

            <select
              value={selectedNagarPalika}
              onChange={(e) => setSelectedNagarPalika(e.target.value)}
              disabled={!selectedDistrict || loadingPalikas}
              className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 text-white border border-slate-700 focus:outline-none disabled:opacity-50"
            >
              <option value="">
                {loadingPalikas ? 'Loading...' : selectedDistrict ? 'All nagar palikas' : 'Select a district'}
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
              onClick={clearZone}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      </header>

      {status && <p className="text-center text-xs font-semibold text-red-600 bg-red-50 py-1.5">{status}</p>}

      <div className="max-w-7xl mx-auto w-full mt-3 px-4 flex items-center justify-between text-xs text-slate-500">
        <span>
          Showing <strong className="text-slate-700">{incidents.length}</strong> incident
          {incidents.length === 1 ? '' : 's'}
          {selectedDistrict ? ` in ${selectedNagarPalika || selectedDistrict}` : ''}
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
        <div className="max-w-7xl mx-auto w-full mt-3 px-4">
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
                  ✓ Sent to {smsResult.residents_found || 0} local residents
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Map Section */}
      <div className="flex-1 max-w-7xl mx-auto w-full mt-3 mb-4 px-4">
        <div className="rounded-2xl overflow-hidden shadow-sm border border-slate-200" style={{ minHeight: '540px' }}>
          <MapContainer center={DEFAULT_CENTER} zoom={15} style={{ height: '100%', width: '100%', minHeight: '540px' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />
            {incidents.map((incident) => (
              <Marker
                key={incident.id}
                position={[incident.latitude, incident.longitude]}
                icon={coloredIcon(CATEGORY_COLORS[incident.category] || '#9CA3AF')}
              >
                <Popup>
                  <strong className="capitalize">{incident.category.replace('_', ' ')}</strong>
                  <br />
                  {incident.description}
                  <br />
                  Status: {incident.status}
                </Popup>
              </Marker>
            ))}

            {/* Shape Stamp Tool (outline-only hover preview + single click placement) */}
            <ShapeStampTool
              active={selectionMode === 'stamp'}
              kRings={kRings}
              onPlaceShape={handlePlaceShape}
            />

            {/* Advanced: Custom Shape drawer */}
            <PolygonDrawer
              active={selectionMode === 'polygon'}
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
          {selectionMode === 'stamp'
            ? '🎯 Move your mouse over the map to preview the shape (outline only), then click once to stamp it in place.'
            : '✏️ Advanced mode: click at least 3 points on the map to draw a custom irregular boundary.'}
        </p>
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
    </div>
  )
}

export default OfficerMapDashboard