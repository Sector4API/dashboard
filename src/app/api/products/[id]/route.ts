import { NextRequest, NextResponse } from 'next/server';
import ProductApiClient from '@/lib/product-api-client';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  if (!id) return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
  try {
    const client = new ProductApiClient({
      supabaseUrl: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL!,
      supabaseKey: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_ANON_KEY!,
      storageBucket: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET!,
    });
    // Handle both numeric and string IDs
    const result = await client.deleteProduct(isNaN(Number(id)) ? id : Number(id));
    if (result.success) return NextResponse.json({ success: true });
    return NextResponse.json({ error: result.error || 'Delete failed' }, { status: 500 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  // Accept both string and number IDs for compatibility with UUIDs
  const id = params.id;
  if (!id) return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
  const body = await req.json();
  try {
    const client = new ProductApiClient({
      supabaseUrl: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL!,
      supabaseKey: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_ANON_KEY!,
      storageBucket: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET!,
    });
    // Try as number, fallback to string (for UUID support)
    const result = await client.updateProduct(isNaN(Number(id)) ? id : Number(id), body);
    if (result.success) return NextResponse.json({ success: true, product: result.product });
    return NextResponse.json({ error: result.error || 'Update failed' }, { status: 500 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
