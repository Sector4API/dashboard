"use client";
import React, { useEffect, useState } from 'react';
import Image from 'next/image';

interface Product {
  id: number;
  product_name: string;
  product_tag: string;
  imageUrl: string;
}

const PAGE_SIZE = 40;

const ProductsPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/products?page=${page}&pageSize=${PAGE_SIZE}`);
        if (!res.ok) throw new Error('Failed to fetch products');
        const data = await res.json();
        setProducts(data.products);
        setTotal(data.total);
      } catch (err) {
        setError((err instanceof Error ? err.message : String(err)) || 'Failed to fetch products');
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [page]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <h1>Products</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 mt-8">
        {products.map((product) => (
          <div
            key={product.id}
            className="bg-gradient-to-br from-blue-50 to-white rounded-2xl shadow-xl p-6 flex flex-col items-center hover:scale-105 hover:shadow-2xl transition-all duration-300 border border-blue-100 group relative overflow-hidden"
          >
            <div className="w-full h-40 flex items-center justify-center mb-4 rounded-lg overflow-hidden bg-gradient-to-tr from-blue-100 to-blue-200">
              <Image
                src={product.imageUrl}
                alt={product.product_name}
                width={320}
                height={160}
                className="object-contain h-full max-h-40 w-auto group-hover:scale-110 transition-transform duration-300"
                loading="lazy"
              />
            </div>
            <h2 className="text-base font-semibold text-center mb-1 break-words max-w-full truncate text-blue-900 group-hover:text-blue-700" title={product.product_name}>
              {product.product_name}
            </h2>
            <p className="text-xs text-blue-500 text-center mb-2 break-words max-w-full truncate" title={product.product_tag}>
              {product.product_tag}
            </p>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-200 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
        ))}
      </div>
      <div className="flex justify-center items-center gap-2 mt-6">
        <button
          className="px-3 py-2 border rounded disabled:opacity-50"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          &lt;
        </button>
        {/* Pagination numbers with ellipsis */}
        {(() => {
          const pageNumbers = [];
          const maxPagesToShow = 7;
          let startPage = Math.max(1, page - 3);
          let endPage = Math.min(totalPages, page + 3);

          if (endPage - startPage < maxPagesToShow - 1) {
            if (startPage === 1) {
              endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
            } else if (endPage === totalPages) {
              startPage = Math.max(1, endPage - maxPagesToShow + 1);
            }
          }

          if (startPage > 1) {
            pageNumbers.push(
              <button key={1} className={`px-3 py-2 rounded border transition-colors duration-200 ${page === 1 ? 'bg-blue-600 text-white border-blue-600 shadow-lg scale-110' : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-100 hover:text-blue-700'}`} onClick={() => setPage(1)} disabled={page === 1} style={{ minWidth: 40 }}>1</button>
            );
            if (startPage > 2) {
              pageNumbers.push(<span key="start-ellipsis" className="px-2">...</span>);
            }
          }

          for (let i = startPage; i <= endPage; i++) {
            if (i === 1 || i === totalPages) continue;
            pageNumbers.push(
              <button
                key={i}
                className={`px-3 py-2 rounded border transition-colors duration-200 ${
                  i === page
                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg scale-110'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-100 hover:text-blue-700'
                }`}
                onClick={() => setPage(i)}
                disabled={i === page}
                style={{ minWidth: 40 }}
              >
                {i}
              </button>
            );
          }

          if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
              pageNumbers.push(<span key="end-ellipsis" className="px-2">...</span>);
            }
            pageNumbers.push(
              <button key={totalPages} className={`px-3 py-2 rounded border transition-colors duration-200 ${page === totalPages ? 'bg-blue-600 text-white border-blue-600 shadow-lg scale-110' : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-100 hover:text-blue-700'}`} onClick={() => setPage(totalPages)} disabled={page === totalPages} style={{ minWidth: 40 }}>{totalPages}</button>
            );
          }

          return pageNumbers;
        })()}
        <button
          className="px-3 py-2 border rounded disabled:opacity-50"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
        >
          &gt;
        </button>
      </div>
    </div>
  );
};

export default ProductsPage;