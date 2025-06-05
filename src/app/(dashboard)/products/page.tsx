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
  id: number;
  product_name: string;
  product_tag: string[];
  imageUrl: string;
  category?: string;
}

const PAGE_SIZE = 40;

const categoryKeywords: Record<string, string[]> = {
  'Skincare': ['lotion', 'serum', 'moisturizer', 'cleanser', 'cream', 'face', 'vera', 'beauty', 'body wash', 'soap', 'balm', 'oil', 'mask', 'peel', 'toner'],
  'Sunscreen': ['sunscreen', 'spf', 'sunblock', 'sun cream'],
  'Electronics': ['headphone', 'bluetooth', 'wireless', 'charger', 'cable', 'earbud', 'speaker', 'tech', 'gadget', 'adapter', 'power bank', 'keyboard', 'mouse', 'monitor'],
  'Apparel': ['shirt', 't-shirt', 'pants', 'jacket', 'dress', 'cotton', 'clothing', 'wear', 'socks', 'hat', 'hoodie', 'jeans', 'sweater', 'shorts'],
  'Home': ['mug', 'plate', 'decor', 'kitchen', 'furniture', 'towel', 'candle', 'utensil', 'bedding', 'lighting', 'storage'],
  'Books': ['book', 'novel', 'fiction', 'non-fiction', 'reading', 'magazine', 'journal', 'textbook'],
  'Fitness': ['yoga', 'mat', 'dumbbell', 'resistance band', 'fitness', 'workout', 'protein', 'supplement'],
  'Accessories': ['bag', 'watch', 'jewelry', 'wallet', 'belt', 'scarf', 'sunglasses', 'backpack'],
  'Grocery': ['food', 'snack', 'drink', 'beverage', 'organic', 'pantry', 'cereal', 'coffee', 'tea', 'sauce', 'spice', 'pasta', 'rice'],
  'Toys & Games': ['toy', 'game', 'puzzle', 'doll', 'action figure', 'board game'],
  'Automotive': ['car', 'auto', 'vehicle', 'tire', 'motor', 'oil', 'wax', 'polish'],
  'Pet Supplies': ['pet', 'dog', 'cat', 'food', 'leash', 'collar', 'toy', 'bed']
  // Add more categories as needed
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
  const [productToDelete, setProductToDelete] = useState<number | null>(null);

  const [pageLoading, setPageLoading] = useState(false);

  // Refs to manage useEffect behavior
  const initialLoadDoneRef = useRef(false);
  const prevEditLoadingRef = useRef(editLoading);
  const isMountedSelectedTagRef = useRef(false);

  const [dynamicCategories, setDynamicCategories] = useState<string[]>([]);

  // Add new state for multiple selection
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());

  const [bulkCategoryValue, setBulkCategoryValue] = useState<string>('');
  const [bulkNewCategoryName, setBulkNewCategoryName] = useState<string>('');
  const [showBulkNewCategoryInput, setShowBulkNewCategoryInput] = useState<boolean>(false);
  const [bulkUpdateLoading, setBulkUpdateLoading] = useState(false);

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

  const handleDelete = async (productId: number) => {
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

  const fetchDynamicCategories = async () => {
    try {
      // console.log("Starting fetchDynamicCategories...");
      const res = await fetch('/api/products/categories', {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        cache: 'no-store'
      });
      
      if (!res.ok) {
        // console.error("Categories API response not OK:", res.status);
        throw new Error('Failed to fetch categories');
      }
      
      const data = await res.json();
      // console.log("Raw API response:", data);
      
      if (Array.isArray(data.categories)) {
        // console.log("Setting dynamicCategories to:", data.categories);
        setDynamicCategories(data.categories);
      } else {
        // console.error("Unexpected categories data format:", data);
        setDynamicCategories([]);
      }
    } catch (err) {
      // console.error("Error in fetchDynamicCategories:", err);
      setDynamicCategories([]);
    }
  };

  const openEditDialog = async (product: Product) => {
    // console.log("Opening edit dialog for product:", product);
    // Fetch latest categories before opening dialog
    await fetchDynamicCategories();
    // console.log("Current dynamic categories:", dynamicCategories);
    
    setEditProduct(product);
    setEditName(product.product_name);
    setEditTag(Array.isArray(product.product_tag) ? product.product_tag : (product.product_tag ? [product.product_tag as unknown as string] : []));
    
    // If the product has a category, set it regardless of whether it's in known categories
    if (product.category) {
      // console.log("Setting category for product:", product.category);
      setSelectedCategoryValue(product.category);
      setEditCategory(product.category);
      setShowNewCategoryInput(false);
      setNewCategoryName('');
    } else {
      setSelectedCategoryValue('');
      setEditCategory(undefined);
      setShowNewCategoryInput(false);
      setNewCategoryName('');
    }
    setEditImage(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;

    let finalCategory = '';
    if (selectedCategoryValue === '__ADD_NEW__') {
      finalCategory = newCategoryName.trim();
    } else {
      finalCategory = selectedCategoryValue.trim();
    }

    if (selectedCategoryValue === '__ADD_NEW__' && !finalCategory) {
        addToast({
            title: 'Error',
            description: 'Please enter a name for the new category.',
            variant: 'error',
        });
        return;
    }
    
    const currentEditCategory = selectedCategoryValue === '__ADD_NEW__' ? newCategoryName.trim() : selectedCategoryValue.trim();
    // console.log("Submitting edit with category:", currentEditCategory);

    setEditLoading(true);
    try {
      // console.log("Sending PATCH request with category:", currentEditCategory);
      const res = await fetch(`/api/products/${editProduct.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          productName: editName, 
          productTag: editTag.filter(tag => tag.trim() !== ''),
          category: currentEditCategory
        }),
      });
      const result = await res.json();
      // console.log("PATCH response:", result);
      
      if (result.success) {
        let imageUrl = editProduct.imageUrl;
        if (editImage) {
          const formData = new FormData();
          formData.append('fileInput', editImage);
          formData.append('productName', editName);
          formData.append('productTag', editTag.filter(tag => tag.trim() !== '').join(','));
          if (currentEditCategory) {
            formData.append('category', currentEditCategory);
          }
          const uploadRes = await fetch(`/api/products/${editProduct.id}/image`, {
            method: 'POST',
            body: formData,
          });
          const uploadResult = await uploadRes.json();
          if (uploadResult.success) {
            imageUrl = uploadResult.imageUrl;
          }
        }

        // console.log("Edit successful, refreshing categories...");
        
        // First, update the products list to reflect the new category
        setProducts(prev => {
          const updated = prev.map(p => 
            p.id === editProduct.id 
              ? { ...p, product_name: editName, product_tag: editTag, imageUrl: imageUrl, category: currentEditCategory } 
              : p
          );
          // console.log("Updated products list:", updated);
          return updated;
        });

        // Then refresh the categories with multiple attempts
        for (let i = 0; i < 3; i++) {
          // console.log(`Attempt ${i + 1} to refresh categories...`);
          await fetchDynamicCategories();
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait between attempts
        }

        if (searchTerm.trim()) {
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
        }

        addToast({
          title: 'Success',
          description: 'Product updated successfully!',
          variant: 'success',
        });
        setEditProduct(null);
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
    fetchProducts(false); // Fetch all products again when search is reset
  };

  const fetchProducts = async (isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setInitialLoading(true);
      setPage(1);
      setProducts([]); // Clear products for a fresh fetch (e.g. when tag changes)
      setHasMoreProducts(true); // Reset hasMoreProducts for new fetch operation
    }

    try {
      const res = await fetch(`/api/products?page=${isLoadMore ? page + 1 : 1}&pageSize=${PAGE_SIZE}`);
      if (!res.ok) throw new Error('Failed to fetch products');
      const data = await res.json();
      if (!data.products) throw new Error('No products found in API response');

      const newProducts = data.products as Product[];
      
      setProducts(prevProducts => isLoadMore ? [...prevProducts, ...newProducts] : newProducts);
      setTotal(data.total);
      
      if (isLoadMore) {
        setPage(prevPage => prevPage + 1);
      }

      // Determine if there are more products
      let hasMore = true;
      if (newProducts.length < PAGE_SIZE) {
        hasMore = false;
      } else if ((isLoadMore ? page + 1 : 1) * PAGE_SIZE >= data.total && data.total > 0) {
        hasMore = false;
      } else if (data.total === 0 && newProducts.length === 0 && !isLoadMore) {
        hasMore = false;
      }
      setHasMoreProducts(hasMore);

      if (!isLoadMore) {
        // Get both derived and assigned categories
        const allCategories = new Set<string>();
        
        // Add assigned categories
        newProducts.forEach((product: Product) => {
          if (product.category) {
            allCategories.add(product.category);
          }
        });
        
        // Add predefined categories that have matching products
        newProducts.forEach((product: Product) => {
          const derivedCategories = getProductCategories(product);
          derivedCategories.forEach(cat => allCategories.add(cat));
        });

        const finalUniqueTags = Array.from(allCategories);
        setUniqueTags(finalUniqueTags.length > 0 ? ['All', ...finalUniqueTags] : []);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error fetching products');
      setHasMoreProducts(false);
    } finally {
      if (isLoadMore) {
        setLoadingMore(false);
      } else {
        setInitialLoading(false);
      }
    }
  };

  const formatProductImagePath = (path: string): string => {
    if (!path) return '/placeholder.png';
    return path.startsWith('http') ? path : `${process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL}/${path}`;
  };

  useEffect(() => {
    // Handles the very first product load on component mount
    if (!initialLoadDoneRef.current && !searchTerm.trim()) {
      fetchProducts(false).then(() => {
        initialLoadDoneRef.current = true;
      });
      fetchDynamicCategories(); // Fetch categories on initial load
    } else if (searchTerm.trim()) {
      setInitialLoading(false);
      setHasMoreProducts(false);
      initialLoadDoneRef.current = true;
    }
  }, []); // Runs once on mount

  useEffect(() => {
    // Handles re-fetching when selectedTag changes (and not initial mount)
    if (!isMountedSelectedTagRef.current) {
      isMountedSelectedTagRef.current = true;
      return;
    }
    if (!initialLoadDoneRef.current) return;
    
    setSearchResults(null); // Clear search results if any
    setSearchTerm('');    // Clear search term
    fetchProducts(false); // Refetch products for the new tag
  }, [selectedTag]);

  useEffect(() => {
    // Handles data refresh after an edit operation completes
    if (prevEditLoadingRef.current && !editLoading && initialLoadDoneRef.current) { // Transitioned from true to false, and initial load was done
      // If not in search mode, refetch all products to ensure data consistency.
      // Search mode is handled by its own search result update.
      if (!searchTerm.trim()) {
          fetchProducts(false); 
      }
      // If in search mode, the search results should have been updated by handleEditSubmit's logic.
      // If a more direct refresh of search is needed, handleSearch could be called, but be mindful of UX.
    }
    prevEditLoadingRef.current = editLoading; // Update ref for next render
  }, [editLoading, searchTerm]); // Rely on searchTerm to know if we were in search mode

  const handlePageChange = async (newPage: number) => {
    // This function is now OBSOLETE due to infinite scroll
  };

  // Add new handler for multiple selection
  const handleProductSelect = (productId: number, e: React.MouseEvent<HTMLElement> | React.ChangeEvent<HTMLInputElement>) => {
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
        await fetchDynamicCategories();

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

  if (initialLoading && !error && products.length === 0 && !searchResults) {
    return <LoadingOverlay isVisible={true} />;
  }
  if (error) return <div>Error: {error}</div>;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  let productsToDisplayInGrid: Product[] = [];

  if (searchResults !== null) {
    productsToDisplayInGrid = searchResults;
  } else if (selectedTag && selectedTag !== 'All') {
    productsToDisplayInGrid = products.filter(p => {
      // Check both assigned category and derived categories
      const assignedCategory = p.category;
      const derivedCategories = getProductCategories(p);
      return assignedCategory === selectedTag || derivedCategories.includes(selectedTag);
    });
  } else {
    productsToDisplayInGrid = products;
  }

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
                        const value = e.target.value;
                        setBulkCategoryValue(value);
                        if (value === '__ADD_NEW__') {
                          setShowBulkNewCategoryInput(true);
                        } else {
                          setShowBulkNewCategoryInput(false);
                          setBulkNewCategoryName('');
                        }
                      }}
                      className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-gray-200"
                    >
                      <option value="">Select Category</option>
                      {/* Predefined Categories */}
                      <optgroup label="Predefined Categories">
                        {Object.keys(categoryKeywords).sort().map(cat => (
                          <option key={`predefined-${cat}`} value={cat}>{cat}</option>
                        ))}
                      </optgroup>
                      {/* Dynamic Categories */}
                      {dynamicCategories.length > 0 && (
                        <optgroup label="Custom Categories">
                          {dynamicCategories
                            .filter(cat => !Object.keys(categoryKeywords).includes(cat))
                            .sort()
                            .map(cat => (
                              <option key={`dynamic-${cat}`} value={cat}>{cat}</option>
                            ))
                          }
                        </optgroup>
                      )}
                      <option value="__ADD_NEW__">-- Add New Category --</option>
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

        {/* Tag Filters in fixed header */}
        {!searchResults && uniqueTags.length > 0 && (
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
              {searchResults.map(renderProductCard)}
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
              {productsToDisplayInGrid.map(renderProductCard)}
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
                onChange={e => setEditTag(e.target.value.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag))}
                className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-gray-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
              <select 
                value={selectedCategoryValue}
                onChange={e => {
                  const value = e.target.value;
                  setSelectedCategoryValue(value);
                  if (value === '__ADD_NEW__') {
                    setShowNewCategoryInput(true);
                    setEditCategory(''); // Clear the category until user types a new one
                  } else {
                    setShowNewCategoryInput(false);
                    setNewCategoryName('');
                    setEditCategory(value); // Set to selected existing category
                  }
                }}
                className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-gray-200 mb-2"
              >
                <option value="">Select Category</option>
                {/* Predefined Categories */}
                <optgroup label="Predefined Categories">
                  {Object.keys(categoryKeywords).sort().map(cat => (
                    <option key={`predefined-${cat}`} value={cat}>{cat}</option>
                  ))}
                </optgroup>
                {/* Dynamic Categories */}
                {dynamicCategories.length > 0 && (
                  <optgroup label="Custom Categories">
                    {dynamicCategories
                      .filter(cat => !Object.keys(categoryKeywords).includes(cat)) // Only show categories that aren't in predefined list
                      .sort()
                      .map(cat => (
                        <option key={`dynamic-${cat}`} value={cat}>{cat}</option>
                      ))
                    }
                  </optgroup>
                )}
                <option value="__ADD_NEW__">-- Add New Category --</option>
              </select>

              {showNewCategoryInput && (
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={e => {
                    setNewCategoryName(e.target.value);
                    setEditCategory(e.target.value); // Update editCategory as user types new name
                  }}
                  placeholder="Enter new category name"
                  className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 w-full focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-gray-200"
                />
              )}
              {/* <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Type a new name to create a new category.</p> */}
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