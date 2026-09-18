import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

export default function ProtectedRoute({
  children,
  adminOnly = false,
}) {
  const location = useLocation()
  const { token, user } = useAuthStore()

  if (!token || !user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    )
  }

  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/scanner" replace />
  }

  return children
}