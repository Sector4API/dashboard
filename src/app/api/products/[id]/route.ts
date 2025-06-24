import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import ProductApiClient from '@/lib/product-api-client';
import { createClient } from '@supabase/supabase-js';

interface RouteContext {
  params: {
    id: string;
  };
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const id = context.params.id;
  if (!id) return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
  try {
    const client = new ProductApiClient({
      supabaseUrl: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL!,
      supabaseKey: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_ANON_KEY!, 
      storageBucket: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET!,
    });
    const result = await client.deleteProduct(isNaN(Number(id)) ? id : String(Number(id)));
    if (result.success) return NextResponse.json({ success: true });
    return NextResponse.json({ error: result.error || 'Delete failed' }, { status: 500 });
  } catch (error) {
    console.error("[API DELETE /api/products/[id]] Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error in DELETE' }, { status: 500 });
  }
}

export async function GET(req: NextRequest, context: RouteContext) {
  const id = context.params.id;
  if (!id) return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });

  try {
    const client = new ProductApiClient({
      supabaseUrl: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL!,
      supabaseKey: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_ANON_KEY!, 
      storageBucket: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET!,
    });

    const product = await client.getProductById(id);

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(product);

  } catch (error) {
    console.error(`[API GET /api/products/${id}] Error:`, error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to fetch product' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const productId = context.params.id;
  if (!productId) return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });

  // Validate environment variables
  if (!process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL || 
      !process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_ANON_KEY || 
      !process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET) {
    console.error('Missing required environment variables');
    return NextResponse.json({ 
      error: 'Server configuration error: Missing required environment variables' 
    }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const productName = formData.get('productName');
    const productTag = formData.get('productTag');
    const mainCategory = formData.get('mainCategory');
    const fileInput = formData.get('fileInput') as File | null;

    // Ensure productTag is an array of strings
    let productTagArray: string[] = [];
    if (productTag && typeof productTag === 'string') {
      productTagArray = productTag.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    }

    // Normalize the category to match our predefined categories
    const categoryMap: { [key: string]: string } = {
      'Savoury': 'Savoury',
      'Frozen-veggies-breads': 'Frozen-veggies-breads',
      'Pickle': 'Pickle',
      'Cookies': 'Cookies',
      'Spreads': 'Spreads',
      'Chocolates': 'Chocolates',
      'Noodles-Pasta': 'Noodles-Pasta',
      'Sauces': 'Sauces',
      'Sweets': 'Sweets',
      'Cereals': 'Cereals',
      'Vegetables': 'Vegetables',
      'Fruits': 'Fruits',
      'Meat-Seafoods': 'Meat-Seafoods',
      'Condiments': 'Condiments'
    };

    const normalizedCategory = mainCategory && typeof mainCategory === 'string' 
      ? (Object.keys(categoryMap).find(cat => cat.toLowerCase() === mainCategory.toLowerCase()) || mainCategory)
      : mainCategory;

    const client = new ProductApiClient({
      supabaseUrl: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL,
      supabaseKey: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_ANON_KEY,
      storageBucket: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET,
    });

    // First get the current product to know its image path
    const supabase = createClient(
      process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL,
      process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_ANON_KEY
    );

    const { data: currentProduct, error: fetchError } = await supabase
      .from('products_new')
      .select('image_path')
      .eq('id', productId)
      .single();

    if (fetchError) {
      console.error('Error fetching current product:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch current product' }, { status: 500 });
    }

    // Handle file upload if present
    let imagePath = undefined;
    if (fileInput) {
      // Get the directory from current image path or create new one based on category
      let uploadDirectory = '';
      if (currentProduct?.image_path) {
        const lastSlashIndex = currentProduct.image_path.lastIndexOf('/');
        if (lastSlashIndex !== -1) {
          uploadDirectory = currentProduct.image_path.substring(0, lastSlashIndex + 1);
        }
      }

      // If no existing directory, determine from main category
      if (!uploadDirectory && mainCategory) {
        const categoryMap: { [key: string]: string } = {
          'Savoury': 'savoury/',
          'Frozen-veggies-breads': 'frozen-veggies-breads/',
          'Pickle': 'pickle/',
          'Cookies': 'cookies/',
          'Spreads': 'spreads/',
          'Chocolates': 'chocolates/',
          'Noodles-Pasta': 'noodles-pasta/',
          'Sauces': 'sauces/',
          'Sweets': 'sweets/',
          'Cereals': 'cereals/',
          'Vegetables': 'vegetables/',
          'Fruits': 'fruits/',
          'Meat-Seafoods': 'meat-seafoods/',
          'Condiments': 'condiments/'
        };
        
        // Convert category to lowercase for case-insensitive matching
        const normalizedCategory = mainCategory.toString();
        const matchingCategory = Object.keys(categoryMap).find(
          cat => cat.toLowerCase() === normalizedCategory.toLowerCase()
        );
        uploadDirectory = matchingCategory ? categoryMap[matchingCategory] : '';
      }

      // Keep the original file name from the upload
      const fileName = fileInput.name;
      const fullPath = uploadDirectory + fileName;

      // Delete the old image if it exists
      if (currentProduct?.image_path) {
        const { error: deleteError } = await supabase.storage
          .from(process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET)
          .remove([currentProduct.image_path]);

        if (deleteError) {
          console.error('Error deleting old image:', deleteError);
          // Continue with upload even if delete fails
        }
      }

      // Upload the new image
      const { error: uploadError } = await supabase.storage
        .from(process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET)
        .upload(fullPath, fileInput, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Error uploading new image:', uploadError);
        return NextResponse.json({ error: 'Failed to upload new image' }, { status: 500 });
      }

      imagePath = fullPath;
    }

    const result = await client.updateProduct(productId, {
      product_name: productName as string,
      product_tag: productTagArray,
      main_category: normalizedCategory as string,
      ...(imagePath && { image_path: imagePath })
    });

    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        product: result.product 
      });
    }

    return NextResponse.json({ 
      error: result.error || 'Update failed',
      details: result
    }, { status: 500 });

  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to update product' 
    }, { status: 500 });
  }
}
