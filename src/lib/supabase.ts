import { createClient } from '@supabase/supabase-js';

// Type for Supabase instances
export type SupabaseInstance = 'dashboard' | 'product';

// Configuration type
type SupabaseConfig = {
  supabaseUrl: string;
  supabaseKey: string;
  supabaseStorageBucket: string;
};

// Configuration map
const supabaseConfigs: Record<SupabaseInstance, SupabaseConfig> = {
  dashboard: {
    supabaseUrl: process.env.NEXT_PUBLIC_DASHBOARD_SUPABASE_URL || '',
    supabaseKey: process.env.NEXT_PUBLIC_DASHBOARD_SUPABASE_ANON_KEY || '',
    supabaseStorageBucket: process.env.NEXT_PUBLIC_DASHBOARD_SUPABASE_STORAGE_BUCKET || ''
  },
  product: {
    supabaseUrl: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL || '',
    supabaseKey: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_ANON_KEY || '',
    supabaseStorageBucket: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET || ''
  }
};

// Create Supabase client based on instance
export const createSupabaseClient = (instance: SupabaseInstance) => {
  const config = supabaseConfigs[instance];
  if (!config.supabaseUrl || !config.supabaseKey || !config.supabaseStorageBucket) {
    throw new Error(`Missing Supabase configuration for ${instance}. Please check your .env file for:
      - NEXT_PUBLIC_${instance.toUpperCase()}_SUPABASE_URL
      - NEXT_PUBLIC_${instance.toUpperCase()}_SUPABASE_ANON_KEY)
      - NEXT_PUBLIC_${instance.toUpperCase()}_SUPABASE_STORAGE_BUCKET`);
  }
  return createClient(config.supabaseUrl, config.supabaseKey);
};

// Export instances for direct use
export const dashboardSupabase = createSupabaseClient('dashboard');
export const productSupabase = createSupabaseClient('product');