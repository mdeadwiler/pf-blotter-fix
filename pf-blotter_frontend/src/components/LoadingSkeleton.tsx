export function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header skeleton */}
        <div className="flex justify-between items-center mb-6">
          <div className="h-8 w-48 bg-white/5 rounded-lg animate-pulse" />
          <div className="flex gap-4">
            <div className="h-8 w-24 bg-white/5 rounded-lg animate-pulse" />
            <div className="h-8 w-20 bg-white/5 rounded-lg animate-pulse" />
          </div>
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/5">
              <div className="h-4 w-16 bg-white/10 rounded animate-pulse mb-2" />
              <div className="h-8 w-12 bg-white/10 rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Order form skeleton */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/5 mb-6">
          <div className="h-6 w-32 bg-white/10 rounded animate-pulse mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i}>
                <div className="h-3 w-12 bg-white/10 rounded animate-pulse mb-2" />
                <div className="h-10 bg-white/10 rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Table skeleton */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/5">
          <div className="h-6 w-40 bg-white/10 rounded animate-pulse mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-4">
                {[1, 2, 3, 4, 5, 6].map((j) => (
                  <div key={j} className="h-8 flex-1 bg-white/10 rounded-lg animate-pulse" />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Connecting message */}
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="text-center">
            <div className="w-16 h-16 relative mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20"></div>
              <div className="absolute inset-0 rounded-full border-4 border-cyan-500 border-t-transparent animate-spin"></div>
              <div className="absolute inset-2 rounded-full border-4 border-emerald-500/20"></div>
              <div className="absolute inset-2 rounded-full border-4 border-emerald-500 border-b-transparent animate-spin" style={{animationDirection: 'reverse', animationDuration: '0.75s'}}></div>
            </div>
            <p className="text-xl font-semibold bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              Connecting to Gateway
            </p>
            <p className="text-gray-500 text-sm mt-2">Establishing real-time connection...</p>
          </div>
        </div>
      </div>
    </div>
  );
}
