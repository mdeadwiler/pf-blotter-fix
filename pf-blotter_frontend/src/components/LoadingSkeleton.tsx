export function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-dark-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header skeleton */}
        <div className="flex justify-between items-center mb-6">
          <div className="h-8 w-48 bg-dark-700 rounded animate-pulse" />
          <div className="flex gap-4">
            <div className="h-8 w-24 bg-dark-700 rounded animate-pulse" />
            <div className="h-8 w-20 bg-dark-700 rounded animate-pulse" />
          </div>
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-dark-800 rounded-lg p-4 neon-border">
              <div className="h-4 w-16 bg-dark-700 rounded animate-pulse mb-2" />
              <div className="h-8 w-12 bg-dark-700 rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Order form skeleton */}
        <div className="bg-dark-800 rounded-lg p-4 neon-border mb-6">
          <div className="h-6 w-32 bg-dark-700 rounded animate-pulse mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i}>
                <div className="h-3 w-12 bg-dark-700 rounded animate-pulse mb-2" />
                <div className="h-10 bg-dark-700 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Table skeleton */}
        <div className="bg-dark-800 rounded-lg p-4 neon-border">
          <div className="h-6 w-40 bg-dark-700 rounded animate-pulse mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-4">
                {[1, 2, 3, 4, 5, 6].map((j) => (
                  <div key={j} className="h-8 flex-1 bg-dark-700 rounded animate-pulse" />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Connecting message */}
        <div className="fixed inset-0 bg-dark-900/80 flex items-center justify-center z-40">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-neon-cyan text-lg">Connecting to gateway...</p>
            <p className="text-gray-500 text-sm mt-2">Establishing real-time connection</p>
          </div>
        </div>
      </div>
    </div>
  );
}
