import { NextResponse } from 'next/server';
import ProductApiClient from '@/lib/product-api-client';

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { productIds, updates } = body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: 'No products selected' }, { status: 400 });
    }

    const client = new ProductApiClient({
      supabaseUrl: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL!,
      supabaseKey: process.env.PRODUCT_SUPABASE_SERVICE_KEY!,
      storageBucket: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET!,
    });

    const results = await Promise.all(
      productIds.map(id => client.updateProduct(id, updates))
    );

    const success = results.every(result => result.success);
    const errors = results
      .filter(result => !result.success)
      .map(result => result.error);

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: 'Some updates failed', 
        errors 
      }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error in bulk update' 
    }, { status: 500 });
  }
} 