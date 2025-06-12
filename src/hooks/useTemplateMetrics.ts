'use client';

import { useState, useEffect } from 'react';
import { dashboardSupabase } from '@/lib/supabase';

interface TemplateMetrics {
  totalTemplates: number;
  publishedTemplates: number;
  unpublishedTemplates: number;
  flyersExported: number;
  totalChange: number;
  publishedChange: number;
  unpublishedChange: number;
  exportChange: number;
}

export function useTemplateMetrics() {
  const [metrics, setMetrics] = useState<TemplateMetrics>({
    totalTemplates: 0,
    publishedTemplates: 0,
    unpublishedTemplates: 0,
    flyersExported: 0,
    totalChange: 0,
    publishedChange: 0,
    unpublishedChange: 0,
    exportChange: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        // Get current metrics for templates
        const { data: currentTemplates, error: templatesError } = await dashboardSupabase
          .from('templates')
          .select('id, is_public, created_at')
          .order('created_at', { ascending: false });

        if (templatesError) throw templatesError;

        // Get current metrics for flyer exports
        const { data: currentUserDetails, error: userDetailsError } = await dashboardSupabase
          .from('user_details')
          .select('flyers_exported');

        if (userDetailsError) throw userDetailsError;

        // Get metrics from 30 days ago for comparison
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const { data: previousTemplates, error: previousError } = await dashboardSupabase
          .from('templates')
          .select('id, is_public, created_at')
          .lte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: false });

        if (previousError) throw previousError;

        // Get previous metrics for flyer exports
        const { data: previousUserDetails, error: prevUserDetailsError } = await dashboardSupabase
          .from('user_details')
          .select('flyers_exported')
          .lte('created_at', thirtyDaysAgo.toISOString());

        if (prevUserDetailsError) throw prevUserDetailsError;

        // Calculate current metrics
        const total = currentTemplates?.length || 0;
        const published = currentTemplates?.filter(t => t.is_public).length || 0;
        const unpublished = total - published;
        const flyersExported = currentUserDetails?.reduce((sum, user) => sum + (user.flyers_exported || 0), 0) || 0;

        // Calculate previous metrics
        const prevTotal = previousTemplates?.length || 0;
        const prevPublished = previousTemplates?.filter(t => t.is_public).length || 0;
        const prevUnpublished = prevTotal - prevPublished;
        const prevFlyersExported = previousUserDetails?.reduce((sum, user) => sum + (user.flyers_exported || 0), 0) || 0;

        // Calculate changes (as percentages)
        const calculateChange = (current: number, previous: number) => {
          if (previous === 0) return 0;
          return ((current - previous) / previous);
        };

        setMetrics({
          totalTemplates: total,
          publishedTemplates: published,
          unpublishedTemplates: unpublished,
          flyersExported: flyersExported,
          totalChange: calculateChange(total, prevTotal),
          publishedChange: calculateChange(published, prevPublished),
          unpublishedChange: calculateChange(unpublished, prevUnpublished),
          exportChange: calculateChange(flyersExported, prevFlyersExported),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
  }, []);

  return { metrics, loading, error };
} 