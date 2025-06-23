"use client";
import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import ProductApiClient from '@/lib/product-api-client';
import { useToast } from '@/components/ui/toast-provider';
import { Spinner } from '@/components/ui/spinner';
import { useRouter } from 'next/navigation';

interface Product {
  id: string;
  product_name: string;
  product_tag: string[];
  imageUrl: string;
  main_category?: string;
}

const PAGE_SIZE = 40;

const categoryKeywords: Record<string, string[]> = {
  'Savoury': ['savoury'],
  'Frozen-veggies-breads': ['frozen food'],
  'Pickle': ['pickle'],
  'Cookies': ['cookies'],
  'Spreads': ['spread'],
  'Chocolates': ['chocolate'],
  'Noodles-Pasta': ['noodle', 'pasta', 'spaghetti', 'macaroni', 'vermicelli'],
  'Sauces': ['sauce'],
  'Sweets': ['sweet'],
  'Cereals': ['cereal'],
  'Vegetables': ['Vegetables'],
  'Fruits': ['fruits'],
  'Meat-Seafoods': ['Meat-Seafoods'],
  'Condiments': ['Condiments']
};

const getProductCategories = (product: Product): string[] => {
  const derivedCategories = new Set<string>();
  const tagString = Array.isArray(product.product_tag) ? product.product_tag.join(' ') : '';
  const combinedText = `${product.product_name.toLowerCase()} ${tagString.toLowerCase()}`;

  for (const category in categoryKeywords) {
    for (const keyword of categoryKeywords[category]) {
      if (combinedText.includes(keyword.toLowerCase())) {
        derivedCategories.add(category);
        // break; // Optional: if a product should only belong to the first matched category
      }
    }
  }
  return Array.from(derivedCategories);
};

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
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [uniqueTags, setUniqueTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMoreProducts, setHasMoreProducts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editTag, setEditTag] = useState<string[]>([]);
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editCategory, setEditCategory] = useState<string | undefined>(undefined);
  const [selectedCategoryValue, setSelectedCategoryValue] = useState<string>('');
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState<boolean>(false);
  const [editLoading, setEditLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Product[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);

  const [pageLoading, setPageLoading] = useState(false);

  // Refs to manage useEffect behavior
  const initialLoadDoneRef = useRef(false);
  const prevEditLoadingRef = useRef(editLoading);
  const isMountedSelectedTagRef = useRef(false);

  // Add new state for multiple selection
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  const [bulkCategoryValue, setBulkCategoryValue] = useState<string>('');
  const [bulkNewCategoryName, setBulkNewCategoryName] = useState<string>('');
  const [showBulkNewCategoryInput, setShowBulkNewCategoryInput] = useState<boolean>(false);
  const [bulkUpdateLoading, setBulkUpdateLoading] = useState(false);

  const confirmDeleteProduct = (productId: string) => {
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

  const handleDelete = async (productId: string) => {
    try {
      const client = new ProductApiClient({
        supabaseUrl: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL!,
        supabaseKey: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_ANON_KEY!,
        storageBucket: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET!,
      });

      const result = await client.moveToTrash(productId);
      
      if (result.success) {
        if (searchTerm.trim()) {
          const searchResult = await client.searchByTag(searchTerm.trim());
          if (searchResult.found && searchResult.products) {
            setSearchResults(searchResult.products);
          } else {
            setSearchResults([]);
            setSearchError('No products found for this tag.');
          }
        } else {
          setProducts((prev) => prev.filter((p) => p.id !== productId));
          setTotal((prev) => prev - 1);
        }
        addToast({
          title: 'Success',
          description: 'Product moved to trash successfully!',
          variant: 'success',
        });
      } else {
        addToast({
          title: 'Error',
          description: result.error || 'Failed to move product to trash',
          variant: 'error',
        });
      }
    } catch (err) {
      addToast({
        title: 'Error',
        description: 'Failed to move product to trash',
        variant: 'error',
      });
    }
  };

  // Add handler for multiple deletion
  const handleMultipleDelete = async () => {
    if (selectedProducts.size === 0) return;

    try {
      const client = new ProductApiClient({
        supabaseUrl: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL!,
        supabaseKey: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_ANON_KEY!,
        storageBucket: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET!,
      });

      const result = await client.moveMultipleToTrash(Array.from(selectedProducts));
      
      if (result.success) {
        if (searchTerm.trim()) {
          const searchResult = await client.searchByTag(searchTerm.trim());
          if (searchResult.found && searchResult.products) {
            setSearchResults(searchResult.products);
          } else {
            setSearchResults([]);
            setSearchError('No products found for this tag.');
          }
        } else {
          setProducts((prev) => prev.filter((p) => !selectedProducts.has(p.id)));
          setTotal((prev) => prev - selectedProducts.size);
        }
        addToast({
          title: 'Success',
          description: 'Selected products moved to trash successfully!',
          variant: 'success',
        });
        setIsMultiSelectMode(false);
        clearSelection();
      } else {
        addToast({
          title: 'Error',
          description: result.error || 'Failed to move some products to trash',
          variant: 'error',
        });
      }
    } catch (err) {
      addToast({
        title: 'Error',
        description: 'Failed to move products to trash',
        variant: 'error',
      });
    }
  };

  // Add navigation to trash page
  const navigateToTrash = () => {
    router.push('/products/trash');
  };

  const openEditDialog = async (product: Product) => {
    console.log('Opening edit dialog with product:', {
      id: product.id,
      name: product.product_name,
      tags: product.product_tag,
      main_category: product.main_category,
      imageUrl: product.imageUrl
    });

    // Normalize the category value to match exactly with our predefined categories
    let normalizedCategory = '';
    if (product.main_category) {
      // Find the exact matching category from our predefined list
      const exactMatch = Object.keys(categoryKeywords).find(
        cat => cat.toLowerCase() === product.main_category?.toLowerCase()
      );
      if (exactMatch) {
        normalizedCategory = exactMatch;
      }
    }
    
    console.log('Normalized category:', normalizedCategory);

    setEditProduct(product);
    setEditName(product.product_name);
    setEditTag(Array.isArray(product.product_tag) ? product.product_tag : []);
    setEditImage(null);
    setEditCategory(normalizedCategory);
    setSelectedCategoryValue(normalizedCategory);
    setShowNewCategoryInput(false);
    setNewCategoryName('');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;

    console.log('Submitting edit with values:', {
      name: editName,
      tags: editTag,
      category: selectedCategoryValue,
      hasImage: !!editImage
    });

    setEditLoading(true);
    try {
      const formData = new FormData();
      if (editImage) {
        formData.append('fileInput', editImage);
      }
      formData.append('productName', editName);
      formData.append('productTag', editTag.join(','));
      formData.append('mainCategory', selectedCategoryValue === '__ADD_NEW__' ? newCategoryName : selectedCategoryValue);

      const response = await fetch(`/api/products/${editProduct.id}`, {
        method: 'PATCH',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to update product');
      }

      const result = await response.json();
      console.log('Update response:', result);

      addToast({
        title: 'Success',
        description: 'Product updated successfully!',
        variant: 'success',
      });

      setEditProduct(null);
      
      // Refresh the products list
      if (selectedTag && selectedTag !== 'All') {
        void searchByCategory(selectedTag);
      } else {
        void fetchProducts();
      }
    } catch (err) {
      console.error('Error updating product:', err);
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
    initialLoadDoneRef.current = true; // Mark initial load as done if a search is performed.
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
      setInitialLoading(false); // A search counts as an initial display action
      setHasMoreProducts(false); // Search results are not paginated with infinite scroll in this setup
    }
  };

  const handleResetSearch = () => {
    setSearchTerm('');
    setSearchResults(null);
    setSearchError(null);
    void fetchProducts(); // Fetch all products again when search is reset
  };

  const fetchProducts = async (isLoadMore = false) => {
    try {
      if (!isLoadMore) {
        setInitialLoading(true);
      } else {
        setLoadingMore(true);
      }

      const client = new ProductApiClient({
        supabaseUrl: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL!,
        supabaseKey: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_ANON_KEY!,
        storageBucket: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET!,
      });

      const { products: fetchedProducts, total: totalProducts } = await client.getAllProducts(page, PAGE_SIZE);

      // Set uniqueTags to include 'All' and all predefined categories
      setUniqueTags(['All', ...Object.keys(categoryKeywords)]);

      if (isLoadMore) {
        setProducts(prev => [...prev, ...fetchedProducts]);
      } else {
        setProducts(fetchedProducts);
      }

      setTotal(totalProducts);
      setHasMoreProducts(fetchedProducts.length === PAGE_SIZE);
    } catch (err) {
      console.error('Error fetching products:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
    } finally {
      setInitialLoading(false);
      setLoadingMore(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Determine which products to display based on search results and filters
  let productsToDisplayInGrid: Product[] = [];

  if (searchResults !== null) {
    productsToDisplayInGrid = searchResults;
  } else {
    productsToDisplayInGrid = products;
  }

  const formatProductImagePath = (path: string): string => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL}/storage/v1/object/public/${process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET}/${path}`;
  };

  useEffect(() => {
    if (!initialLoadDoneRef.current) {
      void fetchProducts();
      initialLoadDoneRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (isMountedSelectedTagRef.current) {
      if (selectedTag && selectedTag !== 'All') {
        void searchByCategory(selectedTag);
      } else {
        void fetchProducts();
      }
    } else {
      isMountedSelectedTagRef.current = true;
    }
  }, [selectedTag]);

  useEffect(() => {
    if (prevEditLoadingRef.current && !editLoading) {
      void fetchProducts();
    }
    prevEditLoadingRef.current = editLoading;
  }, [editLoading]);

  const handlePageChange = async (newPage: number) => {
    // This function is now OBSOLETE due to infinite scroll
  };

  // Add new handler for multiple selection
  const handleProductSelect = (productId: string, e: React.MouseEvent<HTMLElement> | React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation(); // Prevent opening edit dialog when selecting
    if (isMultiSelectMode) {
      setSelectedProducts(prev => {
        const newSelected = new Set(prev);
        if (newSelected.has(productId)) {
          newSelected.delete(productId);
        } else {
          newSelected.add(productId);
        }
        return newSelected;
      });
    }
  };

  // Add handler to clear selections
  const clearSelection = () => {
    setSelectedProducts(new Set());
  };

  // Add new function for bulk category update
  const handleBulkCategoryUpdate = async () => {
    if (selectedProducts.size === 0) return;

    let finalCategory = '';
    if (bulkCategoryValue === '__ADD_NEW__') {
      finalCategory = bulkNewCategoryName.trim();
    } else {
      finalCategory = bulkCategoryValue.trim();
    }

    if (bulkCategoryValue === '__ADD_NEW__' && !finalCategory) {
      addToast({
        title: 'Error',
        description: 'Please enter a name for the new category.',
        variant: 'error',
      });
      return;
    }

    setBulkUpdateLoading(true);
    try {
      const res = await fetch('/api/products/bulk-update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: Array.from(selectedProducts),
          updates: { category: finalCategory }
        }),
      });

      const result = await res.json();

      if (result.success) {
        // Update local state
        setProducts(prev => prev.map(p => 
          selectedProducts.has(p.id) 
            ? { ...p, category: finalCategory }
            : p
        ));

        // Refresh categories
        await fetchProducts();

        addToast({
          title: 'Success',
          description: 'Categories updated successfully!',
          variant: 'success',
        });

        // Clear selection
        setSelectedProducts(new Set());
        setIsMultiSelectMode(false);
        setBulkCategoryValue('');
        setBulkNewCategoryName('');
        setShowBulkNewCategoryInput(false);
      } else {
        addToast({
          title: 'Error',
          description: result.error || 'Failed to update categories',
          variant: 'error',
        });
      }
    } catch (err) {
      addToast({
        title: 'Error',
        description: 'Failed to update categories',
        variant: 'error',
      });
    } finally {
      setBulkUpdateLoading(false);
    }
  };

  // Modify the existing product grid rendering to include selection UI
  const renderProductCard = (product: Product) => (
    <div 
      key={product.id} 
      className={`min-w-0 bg-gradient-to-br from-blue-50 to-white dark:from-slate-800 dark:to-slate-900 rounded-2xl shadow-xl p-3 flex flex-col items-center border border-blue-100 dark:border-slate-700 group relative overflow-hidden cursor-pointer hover:shadow-2xl transition-all duration-300 ${
        selectedProducts.has(product.id) ? 'ring-2 ring-blue-500' : ''
      }`}
      onClick={(e) => {
        if (isMultiSelectMode) {
          handleProductSelect(product.id, e);
        } else {
          void openEditDialog(product);
        }
      }}
    >
      {isMultiSelectMode && (
        <div 
          className="absolute top-2 left-2 z-10"
          onClick={(e) => e.stopPropagation()} // Prevent card click when clicking checkbox area
        >
          <input
            type="checkbox"
            checked={selectedProducts.has(product.id)}
            onChange={(e) => handleProductSelect(product.id, e)}
            className="w-4 h-4 rounded border-gray-300 cursor-pointer"
          />
        </div>
      )}
      <div className="w-full h-40 flex items-center justify-center mb-2 rounded-lg overflow-hidden bg-gradient-to-tr from-blue-100 to-blue-200 dark:from-slate-700 dark:to-slate-800">
        <Image src={formatProductImagePath(product.imageUrl)} alt={product.product_name} width={320} height={160} className="object-contain h-full max-h-40 w-auto group-hover:scale-110 transition-transform duration-300" loading="lazy" />
      </div>
      <h2 className="text-base font-semibold text-center mb-1 break-words max-w-full truncate text-blue-900 group-hover:text-blue-700" title={product.product_name}>{product.product_name}</h2>
      <p className="text-xs text-blue-500 text-center mb-2 break-words max-w-full truncate" title={(Array.isArray(product.product_tag) ? product.product_tag : []).join(', ')}>{(Array.isArray(product.product_tag) ? product.product_tag : []).join(', ')}</p>
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-200 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      {!isMultiSelectMode && (
        <div className="flex gap-2 mt-2">
          <button 
            className="px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors text-xs"
            onClick={(e) => { 
              e.stopPropagation(); 
              void openEditDialog(product); 
            }}
          >
            Edit
          </button>
          <button 
            className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600 transition-colors text-xs"
            onClick={(e) => { e.stopPropagation(); confirmDeleteProduct(product.id); }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );

  const searchByCategory = async (category: string) => {
    setInitialLoading(true);
    try {
      const client = new ProductApiClient({
        supabaseUrl: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL!,
        supabaseKey: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_ANON_KEY!,
        storageBucket: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET!,
      });

      const result = await client.searchByMainCategory(category);
      
      if (result.found && result.products && result.count !== undefined) {
        setProducts(result.products);
        setTotal(result.count);
        setHasMoreProducts(false); // Disable infinite scroll for category results
      } else {
        setProducts([]);
        setTotal(0);
        setHasMoreProducts(false);
      }
    } catch (err) {
      console.error('Error searching by category:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch products by category');
    } finally {
      setInitialLoading(false);
    }
  };

  const filterProductsByCategory = (products: Product[], category: string | null): Product[] => {
    if (!category || category === 'All') return products;
    return products.filter(product => {
      const productCategories = getProductCategories(product);
      return productCategories.includes(category);
    });
  };

  if (initialLoading && !error && products.length === 0 && !searchResults) {
    return <LoadingOverlay isVisible={true} />;
  }
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="min-h-screen relative">
      {editLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Spinner className="w-12 h-12 text-white" />
        </div>
      )}
      <LoadingOverlay isVisible={editLoading || (initialLoading && !initialLoadDoneRef.current)} />

      {/* Fixed header - adjusted for sidebar */}
      <div className="fixed top-0 left-[250px] right-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-lg">
        <div className="p-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Products</h1>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  if (isMultiSelectMode) {
                    clearSelection();
                  }
                  setIsMultiSelectMode(!isMultiSelectMode);
                }}
                variant={isMultiSelectMode ? "default" : "secondary"}
                className={`${
                  isMultiSelectMode 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'hover:bg-gray-200'
                }`}
              >
                {isMultiSelectMode ? 'Exit Selection' : 'Select Multiple'}
              </Button>
              {isMultiSelectMode && selectedProducts.size > 0 && (
                <>
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {selectedProducts.size} item{selectedProducts.size !== 1 ? 's' : ''} selected
                  </span>
                  <div className="flex items-center gap-2 ml-4">
                    <select 
                      value={bulkCategoryValue}
                      onChange={e => {
                        setBulkCategoryValue(e.target.value);
                          setShowBulkNewCategoryInput(false);
                          setBulkNewCategoryName('');
                      }}
                      className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-gray-200"
                    >
                      <option value="">Select Category</option>
                        {Object.keys(categoryKeywords).sort().map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                    {showBulkNewCategoryInput && (
                      <input
                        type="text"
                        value={bulkNewCategoryName}
                        onChange={e => setBulkNewCategoryName(e.target.value)}
                        placeholder="Enter new category name"
                        className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-gray-200"
                      />
                    )}
                    <Button
                      onClick={handleBulkCategoryUpdate}
                      disabled={bulkUpdateLoading || (!bulkCategoryValue || (bulkCategoryValue === '__ADD_NEW__' && !bulkNewCategoryName.trim()))}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {bulkUpdateLoading ? (
                        <div className="flex items-center">
                          <Spinner className="w-4 h-4 mr-2" />
                          Updating...
                        </div>
                      ) : (
                        'Update Categories'
                      )}
                    </Button>
                  </div>
                  <Button
                    onClick={handleMultipleDelete}
                    variant="destructive"
                    className="bg-red-500 hover:bg-red-600 text-white ml-2"
                  >
                    Move to Trash
                  </Button>
                </>
              )}
              <Button
                onClick={navigateToTrash}
                variant="outline"
                className="flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
                Trash
              </Button>
            </div>
          </div>
          <form onSubmit={handleSearch} className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="Search by product name or tag..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="border rounded px-3 py-2 w-64"
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

        {/* Tag Filters in fixed header */}
        {uniqueTags.length > 0 && (
          <div className="px-4 pb-4">
            <div className="flex flex-wrap gap-3 p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
              {uniqueTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag === 'All' ? null : tag)}
                  className={`
                    px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ease-in-out
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-800
                    ${(selectedTag === tag || (tag === 'All' && !selectedTag))
                      ? 'bg-blue-600 text-white shadow-md focus:ring-blue-500'
                      : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 focus:ring-blue-400'
                    }
                  `}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main content with padding to account for fixed header */}
      <div className="pt-[180px] p-4">
        {searchResults !== null ? (
          searchResults.length === 0 ? (
            <div className="text-center text-gray-500 my-8">No products found for your search.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 my-8">
              {filterProductsByCategory(searchResults, selectedTag).map(renderProductCard)}
            </div>
          )
        ) : (
          productsToDisplayInGrid.length === 0 && initialLoadDoneRef.current ? (
            <div className="text-center text-gray-500 my-8">
              {selectedTag && selectedTag !== 'All' 
                ? 'No products found for this category.' 
                : (products.length === 0 ? 'No products available.' : 'No products match the current filter.')}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filterProductsByCategory(productsToDisplayInGrid, selectedTag).map(renderProductCard)}
            </div>
          )
        )}

        {/* Load More Button */}
        {!searchResults && hasMoreProducts && (
          <div className="flex justify-center my-8">
            <Button onClick={() => fetchProducts(true)} disabled={loadingMore} className="bg-blue-600 hover:bg-blue-700 text-white">
              {loadingMore ? (
                <div className="flex items-center">
                  <Spinner className="w-4 h-4 mr-2 animate-spin" />
                  Loading...
                </div>
              ) : 'Load More'}
            </Button>
          </div>
        )}
      </div>

      <Dialog open={!!editProduct} onOpenChange={() => setEditProduct(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit Product</DialogTitle>
          <form onSubmit={handleEditSubmit} className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-xl w-full flex flex-col gap-5 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product Name</label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-gray-200"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product Tag (comma-separated)</label>
              <input
                type="text"
                value={editTag.join(', ')}
                onChange={e => setEditTag(e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag))}
                className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-gray-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
              <select 
                value={selectedCategoryValue}
                onChange={e => {
                  const value = e.target.value;
                  console.log('Category selected:', value);
                  setSelectedCategoryValue(value);
                  setEditCategory(value);
                }}
                className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-gray-200 mb-2"
              >
                <option value="">Select Category</option>
                {Object.keys(categoryKeywords).sort().map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product Image</label>
              {/* Display current image if available */}
              {editProduct && editProduct.imageUrl && (
                <div className="mb-3 rounded-md overflow-hidden border border-gray-200 dark:border-gray-700">
                  <Image 
                    src={formatProductImagePath(editProduct.imageUrl)} 
                    alt="Current product image" 
                    width={100} 
                    height={100} 
                    className="object-contain h-24 w-full"
                  />
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={e => setEditImage(e.target.files ? e.target.files[0] : null)}
                className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-slate-700 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-slate-600"
              />
            </div>
            <div className="flex gap-3 mt-6">
              <Button type="submit" disabled={editLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                {editLoading ? (
                  <div className="flex items-center justify-center">
                    <Spinner className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </div>
                ) : 'Save'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEditProduct(null)} className="w-full py-2 px-4 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
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