"use client";
import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import ProductApiClient from '@/lib/product-api-client';
import { useToast } from '@/components/ui/toast-provider';
import { Spinner } from '@/components/ui/spinner';

interface Product {
  id: number;
  product_name: string;
  product_tag: string;
  imageUrl: string;
}

const PAGE_SIZE = 40;

const LoadingOverlay = ({ isVisible }: { isVisible: boolean }) => {
  if (!isVisible) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
};

const ProductsPage = () => {
  const { addToast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [initialLoading, setInitialLoading] = useState(true); // Separate state for initial page load
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editTag, setEditTag] = useState('');
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Product[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<number | null>(null);

  const [pageLoading, setPageLoading] = useState(false);

  const confirmDeleteProduct = (productId: number) => {
    setProductToDelete(productId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (productToDelete === null) return;
    setDeleteDialogOpen(false);
    setEditLoading(true); // Show loading spinner during deletion
    try {
      await handleDelete(productToDelete);
    } finally {
      setEditLoading(false); // Hide loading spinner after deletion
    }
    setProductToDelete(null);
  };

  // Fix error handling to use error parameter
  const handleDelete = async (productId: number) => {
    try {
      const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        if (searchTerm.trim()) {
          // Refresh search results if a search term is active
          const client = new ProductApiClient({
            supabaseUrl: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL!,
            supabaseKey: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_ANON_KEY!,
            storageBucket: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET!,
          });
          const searchResult = await client.searchByTag(searchTerm.trim());
          if (searchResult.found && searchResult.products) {
            setSearchResults(searchResult.products);
          } else {
            setSearchResults([]);
            setSearchError('No products found for this tag.');
          }
        } else {
          // Update the product list if no search term is active
          setProducts((prev) => prev.filter((p) => p.id !== productId));
          setTotal((prev) => prev - 1);
        }
        addToast({
          title: 'Success',
          description: 'Product deleted successfully!',
          variant: 'success',
        });
      } else {
        addToast({
          title: 'Error',
          description: result.error || 'Failed to delete product',
          variant: 'error',
        });
      }
    } catch (err) {
      addToast({
        title: 'Error',
        description: 'Failed to delete product',
        variant: 'error',
      });
    }
  };

  const openEditDialog = (product: Product) => {
    setEditProduct(product);
    setEditName(product.product_name);
    setEditTag(product.product_tag);
    setEditImage(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;
    setEditLoading(true);
    setEditProduct(null); // Close the edit dialog immediately
    try {
      const res = await fetch(`/api/products/${editProduct.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: editName, productTag: editTag }),
      });
      const result = await res.json();
      if (result.success) {
        let imageUrl = editProduct.imageUrl;
        if (editImage) {
          const formData = new FormData();
          formData.append('fileInput', editImage);
          formData.append('productName', editName);
          formData.append('productTag', editTag);
          const uploadRes = await fetch(`/api/products/${editProduct.id}/image`, {
            method: 'POST',
            body: formData,
          });
          const uploadResult = await uploadRes.json();
          if (uploadResult.success) {
            imageUrl = uploadResult.imageUrl;
          }
        }

        // Fetch updated products or search results
        if (searchTerm.trim()) {
          const client = new ProductApiClient({
            supabaseUrl: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL!,
            supabaseKey: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_ANON_KEY!,
            storageBucket: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET!,
          });
          const result = await client.searchByTag(searchTerm.trim());
          if (result.found && result.products) {
            setSearchResults(result.products);
          } else {
            setSearchResults([]);
            setSearchError('No products found for this tag.');
          }
        } else {
          const updatedProductsRes = await fetch('/api/products');
          const updatedProductsData = await updatedProductsRes.json();
          if (updatedProductsData.products) {
            setProducts(updatedProductsData.products);
            setTotal(updatedProductsData.total); // Ensure total is updated as well
          }
        }

        addToast({
          title: 'Success',
          description: 'Product updated successfully!',
          variant: 'success',
        });
      } else {
        addToast({
          title: 'Error',
          description: result.error || 'Failed to update product',
          variant: 'error',
        });
      }
    } catch (err) {
      addToast({
        title: 'Error',
        description: 'Failed to update product',
        variant: 'error',
      });
    } finally {
      setEditLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) {
      setSearchResults(null);
      setSearchError(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const client = new ProductApiClient({
        supabaseUrl: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL!,
        supabaseKey: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_ANON_KEY!,
        storageBucket: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET!,
      });
      const result = await client.searchByTag(searchTerm.trim());
      if (result.found && result.products) {
        setSearchResults(result.products);
      } else {
        setSearchResults([]);
        setSearchError('No products found for this tag.');
      }
    } catch (err) {
      setSearchResults([]);
      setSearchError('No products found for this tag.');
    } finally {
      setSearching(false);
    }
  };

  const handleResetSearch = () => {
    setSearchTerm('');
    setSearchResults(null);
    setSearchError(null);
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`/api/products?page=${page}&pageSize=${PAGE_SIZE}`);
      if (!res.ok) throw new Error('Failed to fetch products');
      const data = await res.json();
      if (!data.products) throw new Error('No products found');
      setProducts(data.products);
      setTotal(data.total);
    } catch (err) {
      // console.error('Error fetching products:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setInitialLoading(false);
    }
  };

  // Ensure image URLs are valid
  const formatProductImagePath = (path: string): string => {
    if (!path) return '/placeholder.png'; // Use a placeholder image for missing paths
    return path.startsWith('http') ? path : `${process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL}/${path}`;
  };

  useEffect(() => {
    setInitialLoading(true); // Trigger loading only for the initial page load
    fetchProducts();
  }, [page]);

  useEffect(() => {
    if (editLoading) {
      fetchProducts(); // Fetch updated products after edit
    }
  }, [editLoading]);

  const handlePageChange = async (newPage: number) => {
    setPageLoading(true);
    setPage(newPage);
    try {
      await fetchProducts();
    } finally {
      setPageLoading(false);
    }
  };

  if (initialLoading) {
    return <LoadingOverlay isVisible={true} />;
  }
  if (error) return <div>Error: {error}</div>;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      {editLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Spinner className="w-12 h-12 text-white" />
        </div>
      )}
      <LoadingOverlay isVisible={editLoading} />
      {pageLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Spinner className="w-12 h-12 text-white" />
        </div>
      )}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Products</h1>
        <form onSubmit={handleSearch} className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Search by tag..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="border rounded px-3 py-2 w-56"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={handleResetSearch}
              className="text-gray-500 hover:text-gray-700 focus:outline-none"
              aria-label="Clear search"
            >
              &times;
            </button>
          )}
          <Button type="submit" size="sm" disabled={searching} className="bg-blue-600 text-white">Search</Button>
        </form>
      </div>
      {searching && <div className="text-center text-blue-600">Searching...</div>}
      {searchResults && (
        <div>
          {searchResults.length === 0 ? (
            <div className="text-center text-gray-500 my-8">No products found in the site.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 my-8">
              {searchResults.map(product => (
                <div
                  key={product.id}
                  className="bg-gradient-to-br from-blue-50 to-white rounded-2xl shadow-xl p-6 flex flex-col items-center border border-blue-100 group relative overflow-hidden"
                >
                  <div className="w-full h-40 flex items-center justify-center mb-4 rounded-lg overflow-hidden bg-gradient-to-tr from-blue-100 to-blue-200">
                    <Image
                      src={formatProductImagePath(product.imageUrl)}
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
                  <div className="flex gap-2 mt-2">
                    <button
                      className="px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors text-xs"
                      onClick={() => openEditDialog(product)}
                    >
                      Edit
                    </button>
                    <button
                      className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600 transition-colors text-xs"
                      onClick={() => confirmDeleteProduct(product.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {!searchResults && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8 mt-8">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-gradient-to-br from-blue-50 to-white rounded-2xl shadow-xl p-6 flex flex-col items-center hover:scale-105 hover:shadow-2xl transition-all duration-300 border border-blue-100 group relative overflow-hidden"
            >
              <div className="w-full h-40 flex items-center justify-center mb-4 rounded-lg overflow-hidden bg-gradient-to-tr from-blue-100 to-blue-200">
                <Image
                  src={formatProductImagePath(product.imageUrl)}
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
              <div className="flex gap-2 mt-2">
                <button
                  className="px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors text-xs"
                  onClick={() => openEditDialog(product)}
                >
                  Edit
                </button>
                <button
                  className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600 transition-colors text-xs"
                  onClick={() => confirmDeleteProduct(product.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-center items-center gap-2 mt-6">
        <button
          className="px-3 py-2 border rounded disabled:opacity-50"
          onClick={() => handlePageChange(page - 1)}
          disabled={page === 1}
        >
          &lt;
        </button>
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
              <button key={1} className={`px-3 py-2 rounded border transition-colors duration-200 ${page === 1 ? 'bg-blue-600 text-white border-blue-600 shadow-lg scale-110' : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-100 hover:text-blue-700'}`} onClick={() => handlePageChange(1)} disabled={page === 1} style={{ minWidth: 40 }}>1</button>
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
                onClick={() => handlePageChange(i)}
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
              <button key={totalPages} className={`px-3 py-2 rounded border transition-colors duration-200 ${page === totalPages ? 'bg-blue-600 text-white border-blue-600 shadow-lg scale-110' : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-100 hover:text-blue-700'}`} onClick={() => handlePageChange(totalPages)} disabled={page === totalPages} style={{ minWidth: 40 }}>{totalPages}</button>
            );
          }

          return pageNumbers;
        })()}
        <button
          className="px-3 py-2 border rounded disabled:opacity-50"
          onClick={() => handlePageChange(page + 1)}
          disabled={page === totalPages}
        >
          &gt;
        </button>
      </div>
      {/* Edit Product Dialog */}
      <Dialog open={!!editProduct} onOpenChange={() => setEditProduct(null)}>
        <DialogContent>
          <DialogTitle>Edit Product</DialogTitle>
          <form onSubmit={handleEditSubmit} className="bg-white p-6 rounded-xl shadow-xl w-80 flex flex-col gap-4">
            <label className="text-sm font-medium">Product Name</label>
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="border rounded px-2 py-1"
              required
            />
            <label className="text-sm font-medium">Product Tag</label>
            <input
              type="text"
              value={editTag}
              onChange={e => setEditTag(e.target.value)}
              className="border rounded px-2 py-1"
              required
            />
            <label className="text-sm font-medium">Product Image</label>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={e => setEditImage(e.target.files ? e.target.files[0] : null)}
              className="border rounded px-2 py-1"
            />
            <div className="flex gap-2 mt-4">
              <Button type="submit" disabled={editLoading} className="bg-blue-600 text-white w-full">{editLoading ? 'Saving...' : 'Save'}</Button>
              <Button type="button" variant="secondary" onClick={() => setEditProduct(null)} className="w-full">Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogTitle>Confirm Deletion</DialogTitle>
          <p>Are you sure you want to delete this product? This action cannot be undone.</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              className="bg-red-500 text-white hover:bg-red-600"
              onClick={handleDeleteConfirm}
            >
              Confirm
            </Button>
            <Button
              className="bg-gray-500 text-white hover:bg-gray-600"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductsPage;