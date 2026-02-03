import { useAuth } from './hooks/useAuth';
import { AuthPage } from './components/AuthPage';
import { Dashboard } from './components/Dashboard';

function App() {
  const { user, isAuthenticated, login, signup, logout, error, isLoading } = useAuth();

  // Show loading spinner during initial auth check
  if (isLoading && !user) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show auth page if not logged in
  if (!isAuthenticated || !user) {
    return (
      <AuthPage
        onLogin={login}
        onSignup={signup}
        error={error}
        isLoading={isLoading}
      />
    );
  }

  // Show dashboard when authenticated
  return <Dashboard user={user} onLogout={logout} />;
}

export default App;
