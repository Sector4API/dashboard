import { NextResponse } from 'next/server';
import ProductApiClient from '@/lib/product-api-client';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

    const client = new ProductApiClient({
      supabaseUrl: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL!,
      supabaseKey: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_ANON_KEY!,
      storageBucket: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET!,
    });

    // Use server-side pagination
    const { products, total } = await client.getAllProducts(page, pageSize);

    return NextResponse.json({ products, total });
  } catch (error) {
    return NextResponse.json({ error: (error instanceof Error ? error.message : String(error)) || 'Failed to fetch products' }, { status: 500 });
  }
}
