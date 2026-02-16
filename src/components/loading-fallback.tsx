'use client';

/**
 * Loading Fallback Components
 *
 * Consistent loading UI for Suspense boundaries across the application.
 */

interface LoadingFallbackProps {
  message?: string;
}

/** Full-page loading skeleton with header/sidebar placeholders */
export function PageLoadingFallback({ message = 'Loading...' }: LoadingFallbackProps) {
  return (
    <div className="min-h-screen bg-[#0a0a12] flex">
      {/* Sidebar placeholder */}
      <div className="hidden lg:block w-[280px] border-r border-white/5 p-4">
        <div className="h-8 w-32 bg-white/5 rounded-lg animate-pulse mb-8" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>

      {/* Main content placeholder */}
      <div className="flex-1 pt-20 px-4 sm:px-6 lg:px-8 pb-8">
        {/* Header placeholder */}
        <div className="mb-8">
          <div className="h-8 w-48 bg-white/5 rounded-lg animate-pulse mb-2" />
          <div className="h-4 w-72 bg-white/5 rounded-lg animate-pulse" />
        </div>

        {/* Cards placeholder */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-48 bg-white/5 rounded-2xl animate-pulse border border-white/5"
            />
          ))}
        </div>

        {/* Loading text */}
        <div className="flex items-center justify-center mt-12">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-white/40 text-sm">{message}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Card loading skeleton */
export function CardLoadingFallback({ message }: LoadingFallbackProps) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/5 p-6 animate-pulse">
      <div className="h-5 w-32 bg-white/10 rounded mb-4" />
      <div className="space-y-3">
        <div className="h-4 w-full bg-white/10 rounded" />
        <div className="h-4 w-3/4 bg-white/10 rounded" />
        <div className="h-4 w-1/2 bg-white/10 rounded" />
      </div>
      {message && (
        <div className="mt-4 text-white/30 text-xs text-center">{message}</div>
      )}
    </div>
  );
}

/** Table loading skeleton with rows */
export function TableLoadingFallback({ message }: LoadingFallbackProps) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/5 overflow-hidden">
      {/* Table header */}
      <div className="flex gap-4 p-4 border-b border-white/5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-4 flex-1 bg-white/10 rounded animate-pulse" />
        ))}
      </div>
      {/* Table rows */}
      {Array.from({ length: 5 }).map((_, row) => (
        <div key={row} className="flex gap-4 p-4 border-b border-white/5 last:border-0">
          {Array.from({ length: 5 }).map((_, col) => (
            <div key={col} className="h-4 flex-1 bg-white/5 rounded animate-pulse" />
          ))}
        </div>
      ))}
      {message && (
        <div className="p-4 text-white/30 text-xs text-center">{message}</div>
      )}
    </div>
  );
}

/** Chart area loading skeleton */
export function ChartLoadingFallback({ message }: LoadingFallbackProps) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/5 p-6">
      <div className="h-5 w-40 bg-white/10 rounded mb-4 animate-pulse" />
      <div className="h-48 bg-white/5 rounded-xl animate-pulse flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-white/30 text-sm">{message || 'Loading chart...'}</span>
        </div>
      </div>
    </div>
  );
}
