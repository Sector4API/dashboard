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

    // Mapping is now done in ProductApiClient.getAllProducts
    // const mappedProducts = products.map((product: any) => ({
    //   ...product,
    //   category: product.main_category,
    //   // main_category: undefined, // Optionally remove original if not needed elsewhere by client
    // }));

    return NextResponse.json({ products, total }); // Return products directly
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to fetch products' }, { status: 500 });
  }
}
