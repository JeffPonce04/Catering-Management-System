import { Navigate, useLocation } from 'react-router-dom';
import { FaSpinner } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { getDefaultRouteForUser, getUserRoles, hasAllowedRole } from '../../utils/roleRoutes';

const LoadingScreen = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    minHeight: '100vh',
    background: '#f5f8ff',
    color: '#0f172a',
    fontWeight: 600,
  }}>
    <FaSpinner className="cms-spinner" />
    <span>Loading...</span>
  </div>
);

const ForbiddenScreen = ({ user }) => {
  const roleText = getUserRoles(user).join(', ') || 'unknown role';

  return (
    <div style={{
      minHeight: '70vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: '#f5f8ff',
    }}>
      <div style={{
        width: 'min(520px, 100%)',
        padding: 28,
        borderRadius: 18,
        background: '#ffffff',
        boxShadow: '0 18px 45px rgba(15, 23, 42, 0.08)',
        border: '1px solid #e5e7eb',
        textAlign: 'center',
      }}>
        <h2 style={{ margin: '0 0 10px', color: '#0f172a' }}>Access restricted</h2>
        <p style={{ margin: 0, color: '#64748b', lineHeight: 1.6 }}>
          Your account is logged in as <strong>{roleText}</strong>, but this page is limited to another role.
          This screen is shown instead of redirecting back to login, so the app will not enter a blank-page loop.
        </p>
      </div>
    </div>
  );
};

const ProtectedRoute = ({ children, allowedRoles = [], redirectUnauthorized = false }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!hasAllowedRole(user, allowedRoles)) {
    const fallbackPath = getDefaultRouteForUser(user);

    // Never redirect an authenticated user to /login for role mismatch.
    // That was causing: dashboard -> login -> dashboard -> login -> Maximum update depth exceeded.
    if (redirectUnauthorized && fallbackPath !== location.pathname) {
      return <Navigate to={fallbackPath} replace />;
    }

    return <ForbiddenScreen user={user} />;
  }

  return children;
};

export default ProtectedRoute;
