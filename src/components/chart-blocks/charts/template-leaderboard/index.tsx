'use client';

import { useState, useEffect } from 'react';
import { Trophy, Medal, ChevronRight } from 'lucide-react';
import { dashboardSupabase } from '@/lib/supabase';
import { Spinner } from '@/components/ui/spinner';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

interface Template {
  id: string;
  name: string;
  total_exports: number;
  rank?: number;
  thumbnail_path?: string;
}

const RankIcon = ({ rank, exports }: { rank: number; exports: number }) => {
  // Don't show medal icons for templates with 0 exports
  if (exports === 0) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-50 font-semibold text-gray-400 dark:bg-gray-700 dark:text-gray-500">
        -
      </div>
    );
  }

  if (rank === 1) {
    return (
      <div className="relative flex h-10 w-10 items-center justify-center">
        <div className="absolute inset-0 animate-pulse rounded-full bg-yellow-200 dark:bg-yellow-900" />
        <Medal className="relative h-6 w-6 text-yellow-600 dark:text-yellow-400" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="relative flex h-10 w-10 items-center justify-center">
        <div className="absolute inset-0 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
        <Medal className="relative h-6 w-6 text-gray-500 dark:text-gray-300" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="relative flex h-10 w-10 items-center justify-center">
        <div className="absolute inset-0 animate-pulse rounded-full bg-amber-100 dark:bg-amber-900" />
        <Medal className="relative h-6 w-6 text-amber-600 dark:text-amber-400" />
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
      {rank}
    </div>
  );
};

const formatImagePath = (path: string | undefined) => {
  if (!path) return '/placeholder-template.png';
  if (path.startsWith('http')) return path;
  return `${process.env.NEXT_PUBLIC_DASHBOARD_SUPABASE_URL}/storage/v1/object/public/${process.env.NEXT_PUBLIC_DASHBOARD_SUPABASE_STORAGE_BUCKET}/${path}`;
};

export default function TemplateLeaderboard() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchTemplates = async (currentOffset: number) => {
    try {
      setIsLoadingMore(true);
      const { data, error } = await dashboardSupabase
        .from('templates')
        .select('id, name, total_exports, thumbnail_path')
        .order('total_exports', { ascending: false })
        .range(currentOffset, currentOffset + 9)
        .limit(11); // Fetch 11 to check if there are more

      if (error) throw error;

      // Check if there are more templates
      setHasMore(data.length > 10);
      
      // Only use the first 10 templates
      const templatesData = data.slice(0, 10);

      // Add ranking with ties only for templates with exports > 0
      const templatesWithRanks = templatesData.reduce<Template[]>((acc, template, index) => {
        const actualIndex = currentOffset + index;
        
        // Don't assign ranks to templates with 0 exports
        if (template.total_exports === 0) {
          return [...acc, template];
        }

        if (actualIndex === 0 || (acc[index - 1]?.total_exports === 0)) {
          // First template or first template with exports gets rank 1
          return [...acc, { ...template, rank: currentOffset + 1 }];
        }

        const previousTemplate = acc[index - 1];
        const rank = template.total_exports === previousTemplate.total_exports
          ? previousTemplate.rank // Same exports = same rank
          : (previousTemplate.rank || actualIndex) + 1; // Different exports = next rank

        return [...acc, { ...template, rank }];
      }, []);

      setTemplates(templatesWithRanks);
    } catch (err) {
      console.error('Error fetching templates:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch templates');
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchTemplates(offset);
  }, [offset]);

  const handleShowNext = () => {
    setOffset(prev => prev + 10);
  };

  const handleShowPrevious = () => {
    setOffset(prev => Math.max(0, prev - 10));
  };

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[400px] items-center justify-center text-red-500">
        Failed to load template leaderboard
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg bg-white p-6 shadow dark:bg-gray-800">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Most Exported Templates
          </h2>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Showing {offset + 1}-{offset + templates.length}
        </div>
      </div>

      <div className="space-y-4">
        {templates.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400">
            No exported templates found
          </div>
        ) : (
          templates.map((template, index) => (
            <div
              key={template.id}
              className={`flex items-center justify-between rounded-lg p-4 transition-all duration-200
                ${template.total_exports > 0 && template.rank && template.rank <= 3
                  ? 'bg-gradient-to-r shadow-md hover:shadow-lg transform hover:-translate-y-0.5' +
                    (template.rank === 1
                      ? ' from-yellow-50 to-yellow-100 dark:from-yellow-900/30 dark:to-yellow-900/10' 
                      : template.rank === 2
                        ? ' from-gray-50 to-gray-100 dark:from-gray-700/30 dark:to-gray-700/10'
                        : ' from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-900/10')
                  : 'bg-gray-50 dark:bg-gray-700'}`}
            >
              <div className="flex items-center gap-4">
                <RankIcon 
                  rank={template.rank || offset + index + 1} 
                  exports={template.total_exports}
                />
                <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md">
                  <Image
                    src={formatImagePath(template.thumbnail_path)}
                    alt={template.name}
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                </div>
                <div className="flex flex-col">
                  <span className={`font-medium ${
                    template.total_exports > 0 && template.rank && template.rank <= 3
                      ? 'text-lg' 
                      : 'text-base'
                  } text-gray-900 dark:text-white`}>
                    {template.name}
                  </span>
                  {template.total_exports > 0 && template.rank && template.rank <= 3 && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {template.rank === 1
                        ? '🏆 Top Performer' 
                        : template.rank === 2
                          ? '🥈 Runner Up' 
                          : '🥉 Third Place'}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-semibold ${
                  template.total_exports > 0 && template.rank && template.rank <= 3
                    ? 'text-base' 
                    : 'text-sm'
                } ${
                  template.total_exports === 0
                    ? 'text-gray-400 dark:text-gray-500'
                    : 'text-gray-900 dark:text-white'
                }`}>
                  {template.total_exports.toLocaleString()}
                </span>
                <span className={`text-xs ${
                  template.total_exports === 0
                    ? 'text-gray-400 dark:text-gray-500'
                    : 'text-gray-500 dark:text-gray-400'
                }`}>
                  exports
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={handleShowPrevious}
          disabled={offset === 0 || isLoadingMore}
          className="flex items-center gap-2"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleShowNext}
          disabled={!hasMore || isLoadingMore}
          className="flex items-center gap-2"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
} 