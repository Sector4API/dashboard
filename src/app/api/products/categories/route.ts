import { NextResponse } from 'next/server';
import ProductApiClient from '@/lib/product-api-client';

export const dynamic = 'force-dynamic'; // Opt out of caching
export const revalidate = 0; // Disable caching completely

export async function GET(request: Request) {
  // console.log("Categories API: Starting request with timestamp:", new Date().toISOString());
  
  try {
    if (!process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL || 
        !process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_ANON_KEY || 
        !process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET) {
      // console.error("Categories API: Missing required environment variables");
      throw new Error("Missing required environment variables");
    }

    const client = new ProductApiClient({
      supabaseUrl: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL,
      supabaseKey: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_ANON_KEY,
      storageBucket: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET,
    });

    // console.log("Categories API: Initialized client, fetching categories...");
    const categories = await client.getDistinctCategories();
    // console.log("Categories API: Raw categories from DB:", categories);
    
    // Ensure we're returning an array and filter out any null/empty values
    const cleanedCategories = (categories || [])
      .filter(category => category && typeof category === 'string' && category.trim() !== '');
    
    // console.log("Categories API: Cleaned categories:", cleanedCategories);
    
    const response = { 
      categories: cleanedCategories,
      timestamp: new Date().toISOString()
    };

    // console.log("Categories API: Sending response:", response);
    
    return new NextResponse(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error) {
    // console.error("Categories API: Error occurred:", error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch categories';
    // console.error("Categories API: Error details:", errorMessage);
    
    return new NextResponse(JSON.stringify({ 
      error: errorMessage,
      timestamp: new Date().toISOString()
    }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  }
} 