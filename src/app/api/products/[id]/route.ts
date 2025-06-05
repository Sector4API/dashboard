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
    // console.log("DELETE API Key used:", process.env.PRODUCT_SUPABASE_SERVICE_KEY ? "Service Key" : "Anon/Public Key or Undefined");
    const client = new ProductApiClient({
      supabaseUrl: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL!,
      supabaseKey: process.env.PRODUCT_SUPABASE_SERVICE_KEY!, 
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
      // Use anon key for GET, or service key if RLS requires it for specific product details
      supabaseKey: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_ANON_KEY!, 
      storageBucket: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET!,
    });

    // The ProductApiClient.getProductById can handle string or number, 
    // but route param `id` will be a string.
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
  // // --- TEMPORARY DEBUG LOGS ---
  // console.log("API [PATCH /api/products/[id]]: Supabase URL Env Var:", process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL);
  // console.log("API [PATCH /api/products/[id]]: Supabase SERVICE Key Env Var:", process.env.PRODUCT_SUPABASE_SERVICE_KEY);
  // console.log("API [PATCH /api/products/[id]]: Storage Bucket Env Var:", process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET);
  // // --- END TEMPORARY DEBUG LOGS ---

  const id = context.params.id;
  if (!id) return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
  try {
    const body = await req.json();
    let { productName, productTag, category } = body;

    // Ensure productTag is an array of strings
    if (productTag && typeof productTag === 'string') {
      productTag = productTag.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    } else if (productTag && Array.isArray(productTag)) {
      // Ensure all elements are strings and trim them
      productTag = productTag.map(tag => String(tag).trim()).filter(tag => tag.length > 0);
    } else {
      // If productTag is not provided or is an unexpected type, set it to undefined or an empty array
      // depending on how you want to handle missing/malformed tags.
      // For now, let's keep it as is, ProductApiClient might handle undefined.
      // If it's an empty array for "no tags", that should be fine.
    }

    const client = new ProductApiClient({
      supabaseUrl: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL!,
      supabaseKey: process.env.PRODUCT_SUPABASE_SERVICE_KEY!, 
      storageBucket: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET!,
    });
    const result = await client.updateProduct(
      isNaN(Number(id)) ? id : Number(id),
      { productName, productTag, category }
    );
    if (result.success) return NextResponse.json({ success: true, product: result.product });
    return NextResponse.json({ error: result.error || 'Update failed' }, { status: 500 });
  } catch (error) {
    console.error("[API PATCH /api/products/[id]] Error:", error); // Log the full error object
    // if (error instanceof Error && error.message.includes("supabaseUrl, supabaseKey, and storageBucket are required")) {
    //     console.error("ProductApiClient instantiation failed in PATCH. Env Vars Problem?");
    // }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error in PATCH' }, { status: 500 });
  }
}
