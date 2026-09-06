import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import * as h3 from 'h3-js'
import api from '../api'
import 'leaflet/dist/leaflet.css'

const LUCKNOW_CENTER = [26.8467, 80.9462]
const DEFAULT_ZOOM = 12

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

const STATUS_META = {
  pending: { label: 'Pending', color: '#F59E0B', bg: '#FEF3C7', next: 'in_progress', nextLabel: 'Mark In Progress' },
  in_progress: { label: 'In Progress', color: '#2563EB', bg: '#DBEAFE', next: 'resolved', nextLabel: 'Mark Resolved' },
  resolved: { label: 'Resolved', color: '#16A34A', bg: '#DCFCE7', next: null, nextLabel: null },
}

const getStatusMeta = (status) => STATUS_META[status] || { label: status || 'Unknown', color: '#6B7280', bg: '#F3F4F6', next: null, nextLabel: null }

// H3 cell area at resolution 8 (~km²), used for rough zone-size estimates in the UI.
const H3_RES8_CELL_AREA_KM2 = 0.73

// Number of cells in a k-ring disk: 1 + 3k(k+1)
const cellsInDisk = (k) => 1 + 3 * k * (k + 1)

// Brush presets for the "Draw Zone" tool. `k` is the h3 gridDisk radius.
const BRUSH_OPTIONS = [
  { id: 'small', label: 'S', k: 0 },
  { id: 'medium', label: 'M', k: 1 },
  { id: 'large', label: 'L', k: 2 },
]

// Universal H3 compatibility wrappers
const getH3Cell = (lat, lng, res = 8) => {
  if (typeof h3.latlngToCell === 'function') return h3.latlngToCell(lat, lng, res)
  if (typeof h3.geoToH3 === 'function') return h3.geoToH3(lat, lng, res)
  return null
}

const getH3Disk = (cell, k = 1) => {
  if (typeof h3.gridDisk === 'function') return h3.gridDisk(cell, k)
  if (typeof h3.kRing === 'function') return h3.kRing(cell, k)
  return [cell]
}

const getH3Boundary = (cell) => {
  if (typeof h3.cellToBoundary === 'function') return h3.cellToBoundary(cell)
  if (typeof h3.h3ToGeoBoundary === 'function') return h3.h3ToGeoBoundary(cell)
  return []
}

// Strict [lat, lng] boundary array formatting for Leaflet
const getH3BoundaryFormatted = (cell) => {
  try {
    const boundary = getH3Boundary(cell)
    if (!boundary || !boundary.length) return []
    return boundary.map((coord) => {
      const [first, second] = coord
      return Math.abs(first) <= 90 ? [first, second] : [second, first]
    })
  } catch (err) {
    console.error('H3 boundary formatting error:', err)
    return []
  }
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

// Click-to-paint hex zone tool. A click adds the brush-sized disk of cells
// under the cursor to the zone, or removes it if those cells are already
// fully selected (additive/subtractive painting). Mouse movement drives a
// live preview of what the next click will do.
function HexZoneClickTool({ active, brushK, onToggleShape, onHoverCellChange }) {
  const lastHoverRef = useRef(null)

  const map = useMapEvents({
    click(e) {
      if (!active) return
      try {
        const cell = getH3Cell(e.latlng.lat, e.latlng.lng, 8)
        if (!cell) return
        const hexes = getH3Disk(cell, brushK)
        onToggleShape(hexes, [e.latlng.lat, e.latlng.lng])
      } catch (err) {
        console.error('Error placing hex zone:', err)
      }
    },
    mousemove(e) {
      if (!active) return
      const cell = getH3Cell(e.latlng.lat, e.latlng.lng, 8)
      if (!cell || cell === lastHoverRef.current) return
      lastHoverRef.current = cell
      onHoverCellChange(cell)
    },
    mouseout() {
      if (!active) return
      lastHoverRef.current = null
      onHoverCellChange(null)
    },
  })

  // Cursor styling switch
  useEffect(() => {
    if (!map) return
    const container = map.getContainer()
    if (active) {
      container.style.cursor = 'crosshair'
    } else {
      container.style.cursor = ''
    }
  }, [active, map])

  // Clear any stale hover preview the moment this tool becomes inactive.
  useEffect(() => {
    if (!active) {
      lastHoverRef.current = null
      onHoverCellChange(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return null
}

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

function H3Overlay({ hexCells, justPlaced }) {
  if (!hexCells || hexCells.length === 0) return null

  return hexCells.map((cell) => {
    const positions = getH3BoundaryFormatted(cell)
    if (!positions || positions.length === 0) return null

    return (
      <Polygon
        key={`placed-${cell}`}
        positions={positions}
        pathOptions={{
          color: '#DC2626',
          weight: 1.5,
          fillColor: '#EF4444',
          fillOpacity: justPlaced ? 0.7 : 0.35,
          interactive: false, // Disables pointer events on polygons to prevent click interception
        }}
      />
    )
  })
}

// Live preview of what the next click will do: amber dashed = will add these
// cells, red dashed = these cells are already selected and will be removed.
function HoverPreviewOverlay({ cells, willRemove }) {
  if (!cells || cells.length === 0) return null
  const color = willRemove ? '#DC2626' : '#F59E0B'

  return cells.map((cell) => {
    const positions = getH3BoundaryFormatted(cell)
    if (!positions || positions.length === 0) return null

    return (
      <Polygon
        key={`hover-${cell}`}
        positions={positions}
        pathOptions={{
          color,
          weight: 1,
          dashArray: '3, 3',
          fillColor: color,
          fillOpacity: 0.12,
          interactive: false,
        }}
      />
    )
  })
}

function IncidentReportsPanel({ incidents, selectedId, onSelect, onAdvanceStatus, updatingId }) {
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

  const [selectionMode, setSelectionMode] = useState('drag')
  const [centerPoint, setCenterPoint] = useState(null)
  const [polygonPoints, setPolygonPoints] = useState([])
  const [hexCells, setHexCells] = useState([])
  const [justPlaced, setJustPlaced] = useState(false)

  // Brush size for the click-to-paint drawing tool, plus undo history and
  // the cell currently under the cursor (for the live preview).
  const [brushK, setBrushK] = useState(1)
  const [history, setHistory] = useState([])
  const [hoverCell, setHoverCell] = useState(null)

  const [ipiResult, setIpiResult] = useState(null)
  const [affectedCount, setAffectedCount] = useState(null)
  const [loadingAffected, setLoadingAffected] = useState(false)
  const [status, setStatus] = useState('')

  const [selectedIncidentId, setSelectedIncidentId] = useState(null)
  const [updatingIncidentId, setUpdatingIncidentId] = useState(null)

  const [nagarPalikas, setNagarPalikas] = useState([])
  const [selectedNagarPalika, setSelectedNagarPalika] = useState('')
  const [loadingPalikas, setLoadingPalikas] = useState(true)

  const [showSmsModal, setShowSmsModal] = useState(false)
  const [smsMessage, setSmsMessage] = useState('EMERGENCY ALERT: Severe incident reported in your area. Please stay safe and clear roads.')
  const [sendingSms, setSendingSms] = useState(false)
  const [smsResult, setSmsResult] = useState(null)

  const nagarPalikaCenter = nagarPalikas.find((np) => np.name === selectedNagarPalika)?.center
  const selectedIncident = incidents.find((i) => i.id === selectedIncidentId)
  const mapFocus = selectedIncident
    ? { center: [selectedIncident.latitude, selectedIncident.longitude], zoom: 17 }
    : nagarPalikaCenter
    ? { center: nagarPalikaCenter, zoom: 14 }
    : { center: LUCKNOW_CENTER, zoom: DEFAULT_ZOOM }

  // Fast membership checks for toggle logic + hover preview coloring.
  const hexSet = useMemo(() => new Set(hexCells), [hexCells])

  const hoverCells = useMemo(() => {
    if (!hoverCell || selectionMode !== 'drag') return []
    return getH3Disk(hoverCell, brushK)
  }, [hoverCell, brushK, selectionMode])

  const hoverWillRemove = useMemo(
    () => hoverCells.length > 0 && hoverCells.every((c) => hexSet.has(c)),
    [hoverCells, hexSet]
  )

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
    setLoadingPalikas(true)
    api
      .get('/municipalities', { params: { district: 'Lucknow' } })
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
    setHistory([])
    setHoverCell(null)
    setIpiResult(null)
    setAffectedCount(null)
    setSmsResult(null)
    setStatus('')
  }

  const fetchAffectedCount = async (cells) => {
    if (!cells || cells.length === 0) {
      setAffectedCount(null)
      return
    }
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

  const selectDragMode = () => {
    clearZone()
    setSelectionMode('drag')
  }

  const selectFreeform = () => {
    clearZone()
    setSelectionMode('polygon')
  }

  // Additive/subtractive painting: if the clicked brush disk is already
  // fully selected, remove it; otherwise add it to the current zone.
  const handleToggleShape = (hexes, point) => {
    const nextSet = new Set(hexCells)
    const allPresent = hexes.every((h) => nextSet.has(h))

    if (allPresent) {
      hexes.forEach((h) => nextSet.delete(h))
    } else {
      hexes.forEach((h) => nextSet.add(h))
    }

    const next = Array.from(nextSet)

    setHistory((prev) => [...prev, hexCells])
    setHexCells(next)
    setCenterPoint(point)
    setStatus('')
    setJustPlaced(true)
    setTimeout(() => setJustPlaced(false), 350)
    fetchAffectedCount(next)
  }

  const undoLastAction = () => {
    setHistory((prev) => {
      if (prev.length === 0) return prev
      const lastState = prev[prev.length - 1]
      setHexCells(lastState)
      fetchAffectedCount(lastState)
      return prev.slice(0, -1)
    })
  }

  const calculateScore = async () => {
    let coords = []

    if (selectionMode === 'drag') {
      if (hexCells.length === 0) {
        setStatus('Click on the map to draw a zone first')
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

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700 text-xs">
              <button
                onClick={selectDragMode}
                title="Click on the map to paint a hexagonal alert zone"
                className={`px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                  selectionMode === 'drag' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                🎯 Draw Zone
              </button>
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

            {selectionMode === 'drag' && (
              <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700 text-xs">
                <span className="text-slate-400 px-1.5 hidden sm:inline">Brush</span>
                {BRUSH_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setBrushK(opt.k)}
                    title={`${cellsInDisk(opt.k)} cells (~${(cellsInDisk(opt.k) * H3_RES8_CELL_AREA_KM2).toFixed(1)} km²)`}
                    className={`w-7 h-7 rounded-md font-bold transition-colors ${
                      brushK === opt.k ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

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
            {selectionMode === 'drag' && (
              <button
                onClick={undoLastAction}
                disabled={history.length === 0}
                title="Undo last zone edit"
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-xs rounded-lg transition-colors"
              >
                ↺ Undo
              </button>
            )}
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

      <div className="max-w-[1600px] mx-auto w-full mt-3 px-4 flex items-center justify-between text-xs text-slate-500">
        <span>
          Showing <strong className="text-slate-700">{incidents.length}</strong> incident
          {incidents.length === 1 ? '' : 's'}
          {selectedNagarPalika ? ` in ${selectedNagarPalika}` : ' in Lucknow'}
        </span>
        <div className="flex items-center gap-2">
          {hexCells.length > 0 && (
            <span className="bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full font-semibold">
              Placed Hazard Zone: {hexCells.length} cells (~{(hexCells.length * H3_RES8_CELL_AREA_KM2).toFixed(1)} km²)
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
                  ✓ Sent to {smsResult.residents_found || 0} local residents
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 max-w-[1600px] mx-auto w-full mt-3 mb-4 px-4 flex flex-col md:flex-row gap-4">
        <IncidentReportsPanel
          incidents={incidents}
          selectedId={selectedIncidentId}
          onSelect={handleSelectIncident}
          onAdvanceStatus={advanceIncidentStatus}
          updatingId={updatingIncidentId}
        />

        <div className="flex-1 min-w-0">
          <div className="rounded-2xl overflow-hidden shadow-sm border border-slate-200" style={{ minHeight: '540px' }}>
            <MapContainer center={LUCKNOW_CENTER} zoom={DEFAULT_ZOOM} style={{ height: '100%', width: '100%', minHeight: '540px' }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
              {incidents.map((incident) => (
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
                  </Popup>
                </Marker>
              ))}

              <HexZoneClickTool
                active={selectionMode === 'drag'}
                brushK={brushK}
                onToggleShape={handleToggleShape}
                onHoverCellChange={setHoverCell}
              />

              <PolygonDrawer
                active={selectionMode === 'polygon'}
                points={polygonPoints}
                setPoints={setPolygonPoints}
              />

              {centerPoint && (
                <Marker position={centerPoint} icon={coloredIcon('#DC2626')} />
              )}

              <HoverPreviewOverlay cells={hoverCells} willRemove={hoverWillRemove} />
              <H3Overlay hexCells={hexCells} justPlaced={justPlaced} />

              <MapRecenter focus={mapFocus} />
            </MapContainer>
          </div>
          <p className="text-xs text-slate-400 text-center mt-2">
            {selectionMode === 'drag'
              ? '🎯 Click to add hex cells to your zone — click an already-selected area to remove it. Use the brush size buttons to paint bigger or smaller patches.'
              : '✏️ Advanced mode: click at least 3 points on the map to draw a custom irregular boundary.'}
          </p>
        </div>
      </div>

      {showSmsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-100">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <span className="text-2xl">🚨</span>
              <h3 className="text-lg font-bold text-slate-900">Broadcast Citizen Emergency Alert</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              This will send an instant SMS warning to registered citizens living inside the <strong>{hexCells.length} targeted hexagonal cells</strong> (~{(hexCells.length * H3_RES8_CELL_AREA_KM2).toFixed(1)} km²)
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