"use client";
import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast-provider';
import { Spinner } from '@/components/ui/spinner';
import ProductApiClient from '@/lib/product-api-client';

interface TrashItem {
  id: number;
  product_id: string;
  product_name: string;
  tags: string[];
  imageUrl: string | null;
  main_category?: string;
  deleted_at: string;
  scheduled_deletion_at: string;
}

const PAGE_SIZE = 20;

export default function TrashPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  const fetchTrashItems = async (isLoadMore = false) => {
    try {
      const client = new ProductApiClient({
        supabaseUrl: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL!,
        supabaseKey: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_ANON_KEY!,
        storageBucket: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET!,
      });

      const result = await client.getTrashItems(isLoadMore ? page + 1 : 1, PAGE_SIZE);
      
      setItems(prev => isLoadMore ? [...prev, ...result.items] : result.items);
      setTotal(result.total);
      setHasMore(result.items.length === PAGE_SIZE);
      
      if (isLoadMore) {
        setPage(prev => prev + 1);
      }
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to fetch trash items',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (itemId: number) => {
    try {
      const client = new ProductApiClient({
        supabaseUrl: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL!,
        supabaseKey: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_ANON_KEY!,
        storageBucket: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET!,
      });

      const result = await client.restoreFromTrash(itemId);
      
      if (result.success) {
        setItems(prev => prev.filter(item => item.id !== itemId));
        setTotal(prev => prev - 1);
        addToast({
          title: 'Success',
          description: 'Product restored successfully!',
          variant: 'success',
        });
      } else {
        addToast({
          title: 'Error',
          description: result.error || 'Failed to restore product',
          variant: 'error',
        });
      }
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to restore product',
        variant: 'error',
      });
    }
  };

  const handlePermanentDelete = async (itemId: number) => {
    try {
      const client = new ProductApiClient({
        supabaseUrl: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_URL!,
        supabaseKey: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_ANON_KEY!,
        storageBucket: process.env.NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET!,
      });

      const result = await client.permanentlyDeleteFromTrash(itemId);
      
      if (result.success) {
        setItems(prev => prev.filter(item => item.id !== itemId));
        setTotal(prev => prev - 1);
        addToast({
          title: 'Success',
          description: 'Product permanently deleted!',
          variant: 'success',
        });
      } else {
        addToast({
          title: 'Error',
          description: result.error || 'Failed to delete product',
          variant: 'error',
        });
      }
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to delete product',
        variant: 'error',
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDaysUntilDeletion = (scheduledDate: string) => {
    const now = new Date();
    const scheduled = new Date(scheduledDate);
    const diffTime = scheduled.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  useEffect(() => {
    fetchTrashItems();
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => router.back()}
            variant="outline"
            className="flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back
          </Button>
          <h1 className="text-2xl font-bold">Trash</h1>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Spinner className="w-8 h-8" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center text-gray-500 my-8">
          No items in trash
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {items.map(item => (
              <div
                key={item.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden"
              >
                <div className="relative h-48 bg-gray-100 dark:bg-gray-700">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.product_name}
                      fill
                      className="object-contain"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      No image
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-2">{item.product_name}</h3>
                  {item.tags && item.tags.length > 0 && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                      Tags: {item.tags.join(', ')}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Deleted: {formatDate(item.deleted_at)}
                  </p>
                  <p className="text-sm text-red-500 mb-4">
                    Will be permanently deleted in {getDaysUntilDeletion(item.scheduled_deletion_at)} days
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleRestore(item.id)}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                    >
                      Restore
                    </Button>
                    <Button
                      onClick={() => handlePermanentDelete(item.id)}
                      variant="destructive"
                      className="flex-1"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center mt-8">
              <Button
                onClick={() => fetchTrashItems(true)}
                variant="outline"
                className="min-w-[200px]"
              >
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
} 