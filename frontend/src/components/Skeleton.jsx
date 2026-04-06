// Generic animated skeleton block
export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />
}

// Skeleton that matches the PredictionCard layout
export function PredictionSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5 animate-pulse">
      <div className="text-center border-b pb-4 space-y-2">
        <div className="h-3 bg-gray-200 rounded w-28 mx-auto" />
        <div className="h-8 bg-gray-200 rounded w-48 mx-auto" />
        <div className="h-3 bg-gray-200 rounded w-36 mx-auto" />
      </div>
      <div className="space-y-2">
        <div className="h-5 bg-gray-200 rounded-full w-full" />
        <div className="flex justify-between">
          <div className="h-3 bg-gray-200 rounded w-10" />
          <div className="h-3 bg-gray-200 rounded w-10" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-6 bg-gray-200 rounded-full w-32" />
        <div className="h-6 bg-gray-200 rounded-full w-32" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="h-4 bg-gray-200 rounded w-full" />)}
      </div>
      <div className="h-24 bg-gray-100 rounded-xl" />
    </div>
  )
}

// Skeleton for a stats/chart card
export function CardSkeleton({ lines = 4 }) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 space-y-3 animate-pulse">
      <div className="h-5 bg-gray-200 rounded w-40" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 bg-gray-200 rounded" style={{ width: `${70 + (i % 3) * 10}%` }} />
      ))}
    </div>
  )
}
