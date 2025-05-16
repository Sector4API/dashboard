import { NextRequest, NextResponse } from 'next/server';
import ProductApiClient from '@/lib/product-api-client';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // Accept both string and number IDs for compatibility with UUIDs
  const id = params.id;
  if (!id) return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
  const formData = await req.formData();
  const fileInput = formData.get('fileInput');
  const productName = formData.get('productName') as string;
  const productTag = formData.get('productTag') as string;
  if (!fileInput || !(fileInput instanceof Blob)) {
    return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
  }
  try {
    const client = new ProductApiClient({
      supabaseUrl: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL!,
      supabaseKey: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_ANON_KEY!,
      storageBucket: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET!,
    });
    // Pass id as string for UUID support
    const result = await client.updateProduct(id, { fileInput, productName, productTag });
    if (result.success) {
      return NextResponse.json({ success: true, imageUrl: result.imageUrl });
    }
    // Return detailed error for debugging
    return NextResponse.json({
      error: result.error || result.message || 'Image update failed',
      details: result,
      notification: 'Failed to update product image. Please try again.',
    }, { status: 500 });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      notification: 'An unexpected error occurred while updating the product image.',
    }, { status: 500 });
  }
}
