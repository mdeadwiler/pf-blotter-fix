import { useState, FormEvent } from 'react';

interface AuthPageProps {
  onLogin: (email: string, password: string) => Promise<boolean>;
  onSignup: (email: string, password: string, name: string) => Promise<boolean>;
  error: string | null;
  isLoading: boolean;
}

export function AuthPage({ onLogin, onSignup, error, isLoading }: AuthPageProps) {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');
  const [signupError, setSignupError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');

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
      setSignupName('');
      setSignupEmail('');
      setSignupPassword('');
      setSignupConfirm('');
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden py-12">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1671459923818-7d042e07a7ba?w=1920&auto=format&fit=crop&q=80')`,
        }}
      />
      {/* Gradient Overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/85 via-black/70 to-black/85" />
      
      {/* Content */}
      <div className="relative z-10 w-full max-w-lg mx-auto px-4 sm:px-6">
        {/* Logo & Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 mb-4 backdrop-blur-sm">
            <svg className="w-8 h-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-cyan-400 via-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            QuantBlotterSim
          </h1>
          <p className="text-gray-400 mt-2 text-sm sm:text-base">
            Professional FIX Protocol Trading Simulator
          </p>
        </div>

        {/* Project Description */}
        <div className="backdrop-blur-xl bg-white/5 rounded-2xl border border-white/10 p-5 mb-6">
          <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            What is this?
          </h3>
          <p className="text-gray-300 text-sm leading-relaxed mb-4">
            A full-stack trading system simulator built to demonstrate quantitative development skills. 
            The backend implements the <span className="text-white font-medium">FIX 4.4 protocol</span>—the 
            same messaging standard used by investment banks, hedge funds, and exchanges worldwide for 
            electronic order routing.
          </p>
          
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">✓</span>
              <span className="text-gray-400">Real-time order streaming via SSE</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">✓</span>
              <span className="text-gray-400">C++20 backend with QuickFIX engine</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">✓</span>
              <span className="text-gray-400">10+ algorithmic trading strategies</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">✓</span>
              <span className="text-gray-400">Backtesting engine with metrics</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">✓</span>
              <span className="text-gray-400">Portfolio optimization & Black-Scholes</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">✓</span>
              <span className="text-gray-400">Monte Carlo VaR simulation</span>
            </div>
          </div>
        </div>

        {/* Glass Card - Auth Form */}
        <div className="backdrop-blur-xl bg-white/5 rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
          {/* Tab Navigation */}
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setActiveTab('signin')}
              className={`flex-1 py-4 text-sm font-medium transition-all duration-200 ${
                activeTab === 'signin'
                  ? 'text-cyan-400 border-b-2 border-cyan-400 bg-white/5'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setActiveTab('signup')}
              className={`flex-1 py-4 text-sm font-medium transition-all duration-200 ${
                activeTab === 'signup'
                  ? 'text-emerald-400 border-b-2 border-emerald-400 bg-white/5'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Forms Container */}
          <div className="p-6 sm:p-8">
            {activeTab === 'signin' ? (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl 
                             text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50
                             focus:ring-2 focus:ring-cyan-500/20 transition-all duration-200"
                    placeholder="you@example.com"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                    Password
                  </label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl 
                             text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50
                             focus:ring-2 focus:ring-cyan-500/20 transition-all duration-200"
                    placeholder="••••••••"
                    disabled={isLoading}
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !loginEmail || !loginPassword}
                  className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white 
                           rounded-xl font-semibold hover:from-cyan-400 hover:to-cyan-500 
                           transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                           shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Signing in...
                    </span>
                  ) : (
                    'Sign In'
                  )}
                </button>

                <p className="text-center text-xs text-gray-500 mt-4">
                  Demo: Enter any email and password to continue
                </p>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl 
                             text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50
                             focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
                    placeholder="John Doe"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl 
                             text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50
                             focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
                    placeholder="you@example.com"
                    disabled={isLoading}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                      Password
                    </label>
                    <input
                      type="password"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl 
                               text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50
                               focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
                      placeholder="••••••••"
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                      Confirm
                    </label>
                    <input
                      type="password"
                      value={signupConfirm}
                      onChange={(e) => setSignupConfirm(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl 
                               text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50
                               focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
                      placeholder="••••••••"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {(signupError || error) && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-red-400">{signupError || error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !signupName || !signupEmail || !signupPassword || !signupConfirm}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white 
                           rounded-xl font-semibold hover:from-emerald-400 hover:to-emerald-500 
                           transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                           shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Creating account...
                    </span>
                  ) : (
                    'Create Account'
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Important Disclaimer */}
        <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-amber-400 font-semibold text-sm mb-2">Important Disclaimer</p>
              <ul className="text-gray-400 text-xs space-y-1 leading-relaxed">
                <li>• <span className="text-gray-300">Educational purposes only</span> — This is a portfolio project demonstrating quantitative development skills</li>
                <li>• <span className="text-gray-300">Synthetic data</span> — All market prices, orders, and fills are simulated</li>
                <li>• <span className="text-gray-300">No real money</span> — This system does not connect to any live exchange or broker</li>
                <li>• <span className="text-gray-300">Not financial advice</span> — Nothing here constitutes investment recommendations</li>
                <li>• <span className="text-gray-300">Mock authentication</span> — Credentials are not stored securely (demo only)</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer Links */}
        <div className="mt-8 flex items-center justify-center gap-6">
          <a 
            href="https://github.com/mdeadwiler" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            <span className="text-sm">GitHub</span>
          </a>
          <a 
            href="https://www.linkedin.com/in/marquisedeadwiler/" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center gap-2 text-gray-400 hover:text-[#0A66C2] transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            <span className="text-sm">LinkedIn</span>
          </a>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Built with C++20, QuickFIX, React & TypeScript
        </p>
      </div>
    </div>
  );
}
