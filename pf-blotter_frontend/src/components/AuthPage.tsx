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
          <p className="text-gray-400 mb-6">FIX Protocol Order Management System Simulator</p>
          
          {/* Project Description */}
          <div className="max-w-2xl mx-auto bg-dark-800/50 rounded-lg p-5 border border-dark-600 text-left">
            <h3 className="text-sm font-semibold text-neon-cyan mb-3">What is this?</h3>
            <p className="text-gray-300 text-sm leading-relaxed mb-4">
              A full-stack trading system simulator built to demonstrate quantitative development skills. 
              The backend implements the <strong className="text-white">FIX 4.4 protocol</strong>—the same 
              messaging standard used by investment banks, hedge funds, and exchanges worldwide for 
              electronic order routing.
            </p>
            
            <h3 className="text-sm font-semibold text-neon-cyan mb-3">Key Technical Features</h3>
            <div className="grid grid-cols-2 gap-3 text-xs text-gray-400 mb-4">
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-neon-cyan rounded-full mt-1.5 flex-shrink-0"></span>
                <span><strong className="text-gray-300">C++20 Backend</strong> — QuickFIX engine, WebSocket/SSE streaming, reader-writer locks</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-neon-green rounded-full mt-1.5 flex-shrink-0"></span>
                <span><strong className="text-gray-300">React Frontend</strong> — TypeScript, Web Workers for heavy computation</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-neon-yellow rounded-full mt-1.5 flex-shrink-0"></span>
                <span><strong className="text-gray-300">Algo Trading</strong> — VWAP, TWAP, Bollinger, RSI, Pairs Trading strategies</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-neon-red rounded-full mt-1.5 flex-shrink-0"></span>
                <span><strong className="text-gray-300">Quant Tools</strong> — Black-Scholes, Monte Carlo VaR, Portfolio Optimization</span>
              </div>
            </div>
            
            <p className="text-gray-500 text-xs">
              Built as a portfolio project demonstrating infrastructure used in quantitative finance. 
              View the <a href="https://github.com/mdeadwiler/pf-blotter-fix" target="_blank" rel="noopener noreferrer" className="text-neon-cyan hover:underline">source code on GitHub</a> for 
              implementation details.
            </p>
          </div>
          
          {/* Important Disclaimer */}
          <div className="max-w-2xl mx-auto mt-4 bg-neon-yellow/10 rounded-lg p-4 border border-neon-yellow/30">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-neon-yellow flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="text-left">
                <p className="text-neon-yellow font-semibold text-sm mb-1">Educational Simulation Only</p>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>• <strong className="text-gray-300">All prices are synthetic</strong> — generated via random walk, not connected to real markets</li>
                  <li>• <strong className="text-gray-300">No real money</strong> — this is a demonstration of trading system architecture</li>
                  <li>• <strong className="text-gray-300">Not financial advice</strong> — strategy results are for learning purposes only</li>
                  <li>• <strong className="text-gray-300">Mock authentication</strong> — credentials are stored locally in your browser</li>
                </ul>
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

            <p className="text-xs text-gray-500 mt-4 text-center">
              Demo credentials: any email/password combination works
            </p>
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
        <div className="text-center mt-8 space-y-3">
          <p className="text-gray-500 text-sm">
            Built with C++20, QuickFIX, React & TypeScript
          </p>
          
          {/* Social Links */}
          <div className="flex items-center justify-center gap-4">
            <a 
              href="https://github.com/mdeadwiler" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-2 px-3 py-1.5 bg-dark-800 border border-dark-600 rounded-md text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              <span className="text-sm">GitHub</span>
            </a>
            <a 
              href="https://www.linkedin.com/in/marquisedeadwiler/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-2 px-3 py-1.5 bg-dark-800 border border-dark-600 rounded-md text-gray-400 hover:text-[#0A66C2] hover:border-[#0A66C2]/50 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              <span className="text-sm">LinkedIn</span>
            </a>
          </div>
          
          <p className="text-gray-600 text-xs">
            <a href="https://github.com/mdeadwiler/pf-blotter-fix" target="_blank" rel="noopener noreferrer" className="hover:text-neon-cyan transition-colors">
              View Source Code
            </a>
            {' • '}
            <a href="https://github.com/mdeadwiler/pf-blotter-fix/blob/main/TECHNICAL.md" target="_blank" rel="noopener noreferrer" className="hover:text-neon-cyan transition-colors">
              Technical Documentation
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
