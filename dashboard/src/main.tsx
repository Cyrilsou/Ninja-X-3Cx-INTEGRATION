import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

const App = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">3CX-Ninja Dashboard</h1>
        <p className="text-gray-600">Interface en cours de construction...</p>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)