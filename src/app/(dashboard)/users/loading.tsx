import { Spinner } from '@/components/ui/spinner';

export default function UsersLoading() {
  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-10 w-64 bg-gray-200 rounded animate-pulse" />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="animate-pulse">
          {/* Header */}
          <div className="bg-gray-50 px-6 py-3">
            <div className="grid grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded" />
              ))}
            </div>
          </div>

          {/* Rows */}
          {[...Array(5)].map((_, i) => (
            <div key={i} className="border-t border-gray-200 px-6 py-4">
              <div className="grid grid-cols-6 gap-4">
                {[...Array(6)].map((_, j) => (
                  <div key={j} className="h-4 bg-gray-200 rounded" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex justify-between items-center">
        <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="flex gap-2">
          <div className="h-10 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-24 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
} 