import React, { useEffect, useState } from 'react';
import ProductApiClient from '@/lib/product-api-client';

interface Product {
  id: number;
  product_name: string;
  product_tag: string;
  imageUrl: string;
}

const ProductsPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const client = new ProductApiClient({
          supabaseUrl: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL!,
          supabaseKey: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_ANON_KEY!,
          storageBucket: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET!,
        });

        const products = await client.getAllProducts();
        setProducts(products);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch products');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Products</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {products.map((product) => (
          <div key={product.id} className="border p-4 rounded shadow">
            <img src={product.imageUrl} alt={product.product_name} className="w-full h-48 object-cover" />
            <h2 className="text-lg font-bold mt-2">{product.product_name}</h2>
            <p className="text-sm text-gray-600">{product.product_tag}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductsPage;
