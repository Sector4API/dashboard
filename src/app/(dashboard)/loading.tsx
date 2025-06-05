import { Spinner } from '@/components/ui/spinner';

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Loading */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 flex items-center px-4 animate-pulse">
        <div className="h-8 w-32 bg-gray-200 rounded" />
        <div className="ml-auto flex items-center gap-4">
          <div className="h-8 w-8 bg-gray-200 rounded-full" />
          <div className="h-8 w-24 bg-gray-200 rounded" />
        </div>
      </div>

      {/* Sidebar Loading */}
      <div className="fixed top-16 left-0 bottom-0 w-64 bg-white border-r border-gray-200 animate-pulse">
        <div className="p-4 space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 rounded" />
          ))}
        </div>
      </div>

      {/* Main Content Loading */}
      <div className="ml-64 pt-16">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-64 bg-gray-200 rounded" />
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded" />
              ))}
            </div>
            <div className="h-96 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
} 