'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { dashboardSupabase } from '@/lib/supabase';
import ChartTitle from '../../components/chart-title';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import type { ComponentType } from 'react';
import type { SubscriptionData } from './types';

// Dynamically import the chart component with no SSR
const SubscriptionChart: ComponentType<{ data: SubscriptionData }> = dynamic(() => import('@/components/chart-blocks/charts/subscription-status/chart').then(mod => mod.SubscriptionChart), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full min-h-[300px]">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )
});

type SubscriptionStatus = 'premium' | 'preview';

export default function SubscriptionStatusBlock() {
  const [stats, setStats] = useState<SubscriptionData>({
    premium: 0,
    preview: 0,
    total: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchStats() {
      try {
        setError(null);
        const { data: subscriptionData, error: supabaseError } = await dashboardSupabase
          .from('user_details')
          .select('subscription_status');

        if (supabaseError) throw supabaseError;

        if (!subscriptionData) {
          throw new Error('No data received');
        }

        if (isMounted) {
          const stats = subscriptionData.reduce((acc, user) => {
            const status = user.subscription_status as SubscriptionStatus;
            acc[status]++;
            acc.total++;
            return acc;
          }, { premium: 0, preview: 0, total: 0 } as SubscriptionData);

          setStats(stats);
        }
      } catch (err) {
        console.error('Error fetching subscription stats:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch subscription data');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchStats();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="flex h-full flex-col gap-2">
      <ChartTitle title="Subscription Status" icon={Users} />
      {error ? (
        <div className="flex items-center justify-center h-full text-red-500">
          {error}
        </div>
      ) : (
        <>
          <div className="mt-3">
            <span className="mr-1 text-2xl font-medium">{stats.total}</span>
            <span className="text-muted-foreground/60">Total Users</span>
          </div>
          <div className="relative max-h-80 flex-grow">
            <Suspense fallback={
              <div className="flex items-center justify-center h-full min-h-[300px]">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            }>
              {!isLoading && <SubscriptionChart data={stats} />}
            </Suspense>
          </div>
        </>
      )}
    </section>
  );
} 