import { useState } from 'react'
import CitizenForm from './views/CitizenForm.jsx'
import OfficerDashboard from './views/OfficerDashboard.jsx'

function App() {
  const [role, setRole] = useState(null) // null | 'citizen' | 'officer'

  if (!role) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
        <h1 className="text-2xl font-bold">SIH 2026 - Civic Issue Tracker</h1>
        <p className="text-gray-600">Choose your role to continue</p>
        <div className="flex gap-4">
          <button
            onClick={() => setRole('citizen')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            I'm a Citizen
          </button>
          <button
            onClick={() => setRole('officer')}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            I'm an Officer
          </button>
        </div>
      </div>
    )
  }

  return role === 'citizen' ? <CitizenForm /> : <OfficerDashboard />
}

export default App