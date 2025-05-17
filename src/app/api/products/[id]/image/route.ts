import { NextRequest, NextResponse } from 'next/server';
import { type NextApiRequest } from 'next';
import ProductApiClient from '@/lib/product-api-client';

export async function POST(
  request: NextRequest,
  context: { params: { id: string } } // Explicitly define the `params` type
) {
  try {
    const { id } = context.params; // Extract the `id` from the context
    const formData = await request.formData();
    const file = formData.get('fileInput') as File;
    const productName = formData.get('productName') as string;
    const productTag = formData.get('productTag') as string;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    const client = new ProductApiClient({
      supabaseUrl: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL!,
      supabaseKey: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_ANON_KEY!,
      storageBucket: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET!,
    });

    const result = await client.updateProduct(id, { fileInput: file, productName, productTag });
    if (result.success) {
      return NextResponse.json({ success: true, imageUrl: result.imageUrl });
    }

    return NextResponse.json({ error: result.error || 'Update failed' }, { status: 500 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
