import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Home from './pages/Home'
import EmergencyActive from './pages/EmergencyActive'
import EmergencyResponse from './pages/EmergencyResponse'
import Contacts from './pages/Contacts'
import './App.css'

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('access_token')
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/emergency/:id" element={<ProtectedRoute><EmergencyActive /></ProtectedRoute>} />
        <Route path="/respond/:id" element={<ProtectedRoute><EmergencyResponse /></ProtectedRoute>} />
        <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
      </Routes>
    </Router>
  )
}

export default App






