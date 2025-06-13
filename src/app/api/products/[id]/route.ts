import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import ProductApiClient from '@/lib/product-api-client';

interface RouteContext {
  params: { id: string };
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
    const result = await client.deleteProduct(isNaN(Number(id)) ? id : Number(id));
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
  const id = context.params.id;
  if (!id) return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });

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
    const body = await req.json();
    let { productName, productTag, category } = body;

    // Ensure productTag is an array of strings
    if (productTag && typeof productTag === 'string') {
      productTag = productTag.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    } else if (productTag && Array.isArray(productTag)) {
      productTag = productTag.map(tag => String(tag).trim()).filter(tag => tag.length > 0);
    }

    const client = new ProductApiClient({
      supabaseUrl: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL,
      supabaseKey: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_ANON_KEY,
      storageBucket: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET,
    });

    const result = await client.updateProduct(
      isNaN(Number(id)) ? id : Number(id),
      { productName, productTag, category }
    );

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
    console.error("[API PATCH /api/products/[id]] Error:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error in PATCH',
      details: error
    }, { status: 500 });
  }
}
