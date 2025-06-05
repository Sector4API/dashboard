import { Spinner } from '@/components/ui/spinner';

export default function Loading() {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl flex flex-col items-center gap-4">
        <Spinner className="w-12 h-12 text-blue-600" />
        <p className="text-gray-700 font-medium">Loading...</p>
      </div>
    </div>
  );
} 