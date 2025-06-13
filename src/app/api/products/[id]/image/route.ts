import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import ProductApiClient from '@/lib/product-api-client';

export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const { id } = context.params;
    const formData = await request.formData();
    const file = formData.get('fileInput') as File;
    const productName = formData.get('productName') as string;
    const productTag = formData.get('productTag') as string;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    // Initialize Supabase client for storage operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_ANON_KEY!
    );

    // Generate a unique filename
    const fileName = `${Date.now()}_${file.name}`;

    // Upload file to storage
    const { error: uploadError } = await supabase.storage
      .from(process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET!)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ success: false, error: 'Failed to upload image' }, { status: 500 });
    }

    // Get the public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from(process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET!)
      .getPublicUrl(fileName);

    // Initialize ProductApiClient for database operations
    const client = new ProductApiClient({
      supabaseUrl: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL!,
      supabaseKey: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_ANON_KEY!,
      storageBucket: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET!,
    });

    // Update the product record with the new image path
    const result = await client.updateProduct(id, {
      imagePath: fileName,
      productName,
      productTag: productTag ? [productTag] : undefined
    });

    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        imageUrl: urlData.publicUrl,
        product: result.product 
      });
    }

    return NextResponse.json({ error: result.error || 'Update failed' }, { status: 500 });
  } catch (error) {
    console.error('Product image update error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
