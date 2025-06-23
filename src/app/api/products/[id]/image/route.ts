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

    // Initialize ProductApiClient for database operations
    const client = new ProductApiClient({
      supabaseUrl: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL!,
      supabaseKey: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_ANON_KEY!,
      storageBucket: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET!,
    });

    // Get the current product to find the old image path
    const { data: currentProduct, error: fetchError } = await supabase
      .from('products_new')
      .select('image_path')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching current product:', fetchError);
      return NextResponse.json({ success: false, error: 'Failed to fetch current product' }, { status: 500 });
    }

    // Delete the old image if it exists
    if (currentProduct?.image_path) {
      const { error: deleteError } = await supabase.storage
        .from(process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET!)
        .remove([currentProduct.image_path]);

      if (deleteError) {
        console.error('Error deleting old image:', deleteError);
        // Continue with upload even if delete fails
      }
    }

    // Use the original filename
    const fileName = file.name;

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
