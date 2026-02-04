import { useState, FormEvent } from 'react';

interface AuthPageProps {
  onLogin: (email: string, password: string) => Promise<boolean>;
  onSignup: (email: string, password: string, name: string) => Promise<boolean>;
  error: string | null;
  isLoading: boolean;
}

export function AuthPage({ onLogin, onSignup, error, isLoading }: AuthPageProps) {
  // Sign In form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Sign Up form state
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');
  const [signupError, setSignupError] = useState<string | null>(null);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return;
    await onLogin(loginEmail, loginPassword);
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setSignupError(null);

    if (!signupName || !signupEmail || !signupPassword) {
      setSignupError('All fields are required');
      return;
    }

    if (signupPassword !== signupConfirm) {
      setSignupError('Passwords do not match');
      return;
    }

    if (signupName.trim().length < 3) {
      setSignupError('Name must be at least 3 characters');
      return;
    }

    if (signupPassword.length < 8) {
      setSignupError('Password must be at least 8 characters');
      return;
    }

    const success = await onSignup(signupEmail, signupPassword, signupName);
    if (success) {
      // Clear form on success
      setSignupName('');
      setSignupEmail('');
      setSignupPassword('');
      setSignupConfirm('');
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-neon-cyan neon-text mb-2">
            QuantBlotterSim
          </h1>
          <p className="text-gray-400 mb-6">FIX 4.4 Order Gateway Simulator & Live Blotter</p>
          
          <div className="max-w-2xl mx-auto bg-dark-800/50 rounded-lg p-4 border border-dark-600">
            <p className="text-gray-300 text-sm leading-relaxed">
              Ever wondered how Wall Street's trading systems handle orders in real-time? 
              This is your playground. Submit buy/sell orders, watch them fill (or partially fill), 
              track your P&L, and see the order book dance—all powered by the same FIX protocol 
              the pros use.
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-neon-green rounded-full"></span>
                Submit orders
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-neon-cyan rounded-full"></span>
                Watch live fills
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-neon-yellow rounded-full"></span>
                Track positions
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-neon-red rounded-full"></span>
                Cancel anytime
              </span>
            </div>
          </div>
          
          {/* Simulation disclaimer */}
          <div className="max-w-2xl mx-auto mt-4 bg-neon-yellow/10 rounded-lg p-3 border border-neon-yellow/30">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-neon-yellow flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-xs text-gray-400">
                <span className="text-neon-yellow font-medium">Educational Simulator:</span>{' '}
                All prices are <strong className="text-gray-300">simulated</strong> and do not reflect real market data. 
                No real money is involved. This tool is for learning FIX protocol mechanics only—not for actual trading decisions.
              </div>
            </div>
          </div>
        </div>

        {/* Auth containers */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Sign In */}
          <div className="bg-dark-800 rounded-lg p-6 neon-border">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <svg className="w-5 h-5 text-neon-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Sign In
            </h2>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-dark-700 border border-dark-500 rounded-md 
                           text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan
                           transition-colors"
                  placeholder="you@example.com"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Password</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-dark-700 border border-dark-500 rounded-md 
                           text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan
                           transition-colors"
                  placeholder="••••••••"
                  disabled={isLoading}
                />
              </div>

              {error && (
                <p className="text-sm text-neon-red">{error}</p>
              )}

              <button
                type="submit"
                disabled={isLoading || !loginEmail || !loginPassword}
                className="w-full py-2.5 bg-neon-cyan/20 border border-neon-cyan text-neon-cyan 
                         rounded-md font-medium hover:bg-neon-cyan/30 transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>

          {/* Sign Up */}
          <div className="bg-dark-800 rounded-lg p-6 neon-border">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <svg className="w-5 h-5 text-neon-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Create Account
            </h2>

            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name</label>
                <input
                  type="text"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-dark-700 border border-dark-500 rounded-md 
                           text-white placeholder-gray-500 focus:outline-none focus:border-neon-green
                           transition-colors"
                  placeholder="John Doe"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-dark-700 border border-dark-500 rounded-md 
                           text-white placeholder-gray-500 focus:outline-none focus:border-neon-green
                           transition-colors"
                  placeholder="you@example.com"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Password</label>
                <input
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-dark-700 border border-dark-500 rounded-md 
                           text-white placeholder-gray-500 focus:outline-none focus:border-neon-green
                           transition-colors"
                  placeholder="••••••••"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={signupConfirm}
                  onChange={(e) => setSignupConfirm(e.target.value)}
                  className="w-full px-4 py-2.5 bg-dark-700 border border-dark-500 rounded-md 
                           text-white placeholder-gray-500 focus:outline-none focus:border-neon-green
                           transition-colors"
                  placeholder="••••••••"
                  disabled={isLoading}
                />
              </div>

              {(signupError || error) && (
                <p className="text-sm text-neon-red">{signupError || error}</p>
              )}

              <button
                type="submit"
                disabled={isLoading || !signupName || !signupEmail || !signupPassword || !signupConfirm}
                className="w-full py-2.5 bg-neon-green/20 border border-neon-green text-neon-green 
                         rounded-md font-medium hover:bg-neon-green/30 transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-sm mt-8">
          Built with C++, QuickFIX & React • Your data stays in your browser
        </p>
      </div>
    </div>
  );
}
