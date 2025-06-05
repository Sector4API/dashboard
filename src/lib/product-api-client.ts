import { createClient, SupabaseClient } from '@supabase/supabase-js';


interface ProductApiClientOptions {
  supabaseUrl: string;
  supabaseKey: string;
  storageBucket: string;
}

interface UploadOptions {
  customProductName?: string;
  customProductTag?: string;
}

interface ProductUpdatePayload {
  productName?: string;
  productTag?: string[];
  imagePath?: string;
  category?: string;
}

class ProductApiClient {
  private supabase: SupabaseClient;
  private storageBucket: string;
  private isNode: boolean;

  constructor(options: ProductApiClientOptions) {
    const { supabaseUrl, supabaseKey, storageBucket } = options;

    if (!supabaseUrl || !supabaseKey || !storageBucket) {
      throw new Error('supabaseUrl, supabaseKey, and storageBucket are required');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.storageBucket = storageBucket;
    this.isNode = typeof process !== 'undefined' && process.versions?.node != null;
  }

  async uploadProductImage(fileInput: File | Blob, options: UploadOptions = {}) {
    try {
      if (!(fileInput instanceof File || fileInput instanceof Blob)) {
        throw new Error('fileInput must be a File or Blob object');
      }

      const fileName = (fileInput as File).name || `upload_${Date.now()}`;
      const lastDotIndex = fileName.lastIndexOf('.');
      const fileNameWithoutExt = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
      const productName = options.customProductName || fileNameWithoutExt.replace(/[^a-zA-Z0-9]/g, ' ').trim();
      const fileData = fileInput;
      const productTag: string = options.customProductTag || productName;

      const { error: uploadError } = await this.supabase.storage
        .from(this.storageBucket)
        .upload(fileName, fileData, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      const { data: productData, error: productError } = await this.supabase
        .from('products')
        .insert([{ product_name: productName, tags: [productTag], image_path: fileName }])
        .select();

      if (productError) throw productError;

      const { data: urlData } = this.supabase.storage.from(this.storageBucket).getPublicUrl(fileName);

      return { success: true, message: 'Product uploaded successfully', product: productData[0], imageUrl: urlData.publicUrl };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async updateProduct(productId: number | string, updates: ProductUpdatePayload) {
    try {
      const updateData: any = {};
      if (updates.productName !== undefined) updateData.product_name = updates.productName;
      if (updates.productTag !== undefined) updateData.tags = updates.productTag;
      if (updates.imagePath !== undefined) updateData.image_path = updates.imagePath;
      if (updates.category !== undefined) updateData.main_category = updates.category;

      const { data, error } = await this.supabase
        .from('products')
        .update(updateData)
        .eq('id', productId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, product: data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async deleteProduct(productId: number | string) {
    try {
      // Fetch the product to get the image path
      const { data: existingProduct, error: fetchError } = await this.supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (fetchError) throw fetchError;
      if (!existingProduct) throw new Error(`Product with ID ${productId} not found`);

      const imagePath = existingProduct.image_path;

      // Delete the product from the database
      const { error: deleteError } = await this.supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (deleteError) throw deleteError;

      // Delete the image from the storage bucket
      if (imagePath) {
        const { error: storageError } = await this.supabase.storage
          .from(this.storageBucket)
          .remove([imagePath]);

        if (storageError) {
          throw storageError;
        }
      }

      return { success: true, message: `Product with ID ${productId} and its associated image were successfully deleted` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async searchByTag(query: string) {
    try {
      const lowercaseQuery = query.toLowerCase();

      // First, search by tags
      const { data: tagResults, error: tagError } = await this.supabase
        .from('products')
        .select('tags, image_path, product_name, id, main_category')
        .filter('tags', 'cs', `{${query}}`);

      if (tagError) throw tagError;

      // Then, search by product name
      const { data: nameResults, error: nameError } = await this.supabase
        .from('products')
        .select('tags, image_path, product_name, id, main_category')
        .ilike('product_name', `%${query}%`);

      if (nameError) throw nameError;

      // Combine and deduplicate results
      const combinedResults = [...(tagResults || [])];
      if (nameResults) {
        nameResults.forEach(nameResult => {
          if (!combinedResults.some(tagResult => tagResult.id === nameResult.id)) {
            combinedResults.push(nameResult);
          }
        });
      }

      if (combinedResults.length > 0) {
        const productsWithUrls = await Promise.all(
          combinedResults.map(async (product) => {
            const { data: urlData } = this.supabase.storage.from(this.storageBucket).getPublicUrl(product.image_path);

            return {
              ...product,
              imageUrl: urlData.publicUrl,
              product_tag: product.tags,
              category: product.main_category,
            };
          })
        );

        // Sort results by relevance
        const sortedProducts = productsWithUrls.sort((a, b) => {
          const aName = a.product_name.toLowerCase();
          const bName = b.product_name.toLowerCase();
          
          // Check for exact matches first
          if (aName === lowercaseQuery && bName !== lowercaseQuery) return -1;
          if (bName === lowercaseQuery && aName !== lowercaseQuery) return 1;
          
          // Then check for starts with
          const aStartsWith = aName.startsWith(lowercaseQuery);
          const bStartsWith = bName.startsWith(lowercaseQuery);
          if (aStartsWith && !bStartsWith) return -1;
          if (bStartsWith && !aStartsWith) return 1;
          
          // Then check for contains
          const aContains = aName.includes(lowercaseQuery);
          const bContains = bName.includes(lowercaseQuery);
          if (aContains && !bContains) return -1;
          if (bContains && !aContains) return 1;
          
          // If both have same relevance, sort alphabetically
          return aName.localeCompare(bName);
        });

        return { found: true, products: sortedProducts, count: sortedProducts.length };
      } else {
        return { found: false, message: `No products found matching "${query}"` };
      }
    } catch (error) {
      return { found: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async searchByName(query: string) {
    try {
      const { data, error } = await this.supabase
        .from('products')
        .select('product_name, tags, image_path, id, main_category')
        .ilike('product_name', `%${query}%`);

      if (error) throw error;

      if (data && data.length > 0) {
        const productsWithUrls = await Promise.all(
          data.map(async (product) => {
            const { data: urlData } = this.supabase.storage.from(this.storageBucket).getPublicUrl(product.image_path);

            return {
              ...product,
              imageUrl: urlData.publicUrl,
              product_tag: product.tags,
              category: product.main_category,
            };
          })
        );

        return { found: true, products: productsWithUrls, count: productsWithUrls.length };
      } else {
        return { found: false, message: `Product with name "${query}" not found in the database.` };
      }
    } catch (error) {
      return { found: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getAllProducts(page = 1, pageSize = 20) {
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, error, count } = await this.supabase
        .from('products')
        .select('*', { count: 'exact' })
        .order('product_name', { ascending: true })
        .range(from, to);

      if (error) throw error;

      // Custom sort: alphabets first, then digits
      const productsWithUrls = await Promise.all(
        (data || []).map(async (product) => {
          const { data: urlData } = this.supabase.storage.from(this.storageBucket).getPublicUrl(product.image_path);
          return {
            ...product,
            imageUrl: urlData.publicUrl,
            product_tag: product.tags,
            category: product.main_category,
          };
        })
      );

      // Sort: alphabetic names first, then digit names
      productsWithUrls.sort((a, b) => {
        const aAlpha = /^[A-Za-z]/.test(a.product_name.trim());
        const bAlpha = /^[A-Za-z]/.test(b.product_name.trim());
        if (aAlpha && !bAlpha) return -1;
        if (!aAlpha && bAlpha) return 1;
        return a.product_name.localeCompare(b.product_name, undefined, { sensitivity: 'base' });
      });

      return { products: productsWithUrls, total: count ?? 0 };
    } catch (error) {
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  }

  async getProductById(id: string | number) {
    try {
      const { data, error } = await this.supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      const { data: urlData } = this.supabase.storage.from(this.storageBucket).getPublicUrl(data.image_path);

      return {
        ...data,
        imageUrl: urlData.publicUrl,
        product_tag: data.tags,
        category: data.main_category,
      };
    } catch (error) {
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  }

  async getDistinctCategories() {
    try {
      // console.log("API Client: Starting getDistinctCategories...");
      const { data, error } = await this.supabase
        .from('products')
        .select('main_category')
        .not('main_category', 'is', null)
        .neq('main_category', '')
        .order('main_category');

      if (error) {
        // console.error("API Client: Error fetching categories:", error);
        throw error;
      }

      if (!data) {
        // console.log("API Client: No data returned");
        return [];
      }

      // Get distinct, non-null, non-empty categories
      const distinctCategories = Array.from(
        new Set(
          data
            .map(item => item.main_category)
            .filter(category => category && typeof category === 'string' && category.trim() !== '')
        )
      );

      // console.log("API Client: Found categories:", distinctCategories);
      // console.log("API Client: Raw data from DB:", data);
      
      return distinctCategories.sort();
    } catch (error) {
      // console.error("API Client: Error in getDistinctCategories:", error);
      throw error; // Let the API route handle the error
    }
  }

  async moveToTrash(productId: number | string) {
    try {
      // console.log('Moving product to trash:', productId);
      // First, get the product details
      const { data: product, error: fetchError } = await this.supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (fetchError) throw fetchError;
      if (!product) throw new Error(`Product with ID ${productId} not found`);

      // console.log('Found product:', product);

      // Move the image to trash bucket if it exists
      if (product.image_path) {
        const { data: fileData, error: downloadError } = await this.supabase.storage
          .from(this.storageBucket)
          .download(product.image_path);

        if (!downloadError && fileData) {
          // Upload to trash bucket
          await this.supabase.storage
            .from('product-trash')
            .upload(product.image_path, fileData, { upsert: true });

          // Delete from original bucket
          await this.supabase.storage
            .from(this.storageBucket)
            .remove([product.image_path]);
        }
      }

      // Generate new UUID for trash item
      const trashId = crypto.randomUUID();

      // Insert into product_trash table
      const { error: trashError } = await this.supabase
        .from('product_trash')
        .insert([{
          id: trashId,
          product_id: product.id, // Use the original product's UUID
          product_name: product.product_name,
          tags: product.tags || [],
          image_path: product.image_path || null,
          main_category: product.main_category || null,
          original_created_at: product.created_at || new Date().toISOString(),
          deleted_at: new Date().toISOString(),
          scheduled_deletion_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
        }]);

      if (trashError) {
        // console.error('Error moving to trash:', trashError);
        throw trashError;
      }

      // Delete from products table
      const { error: deleteError } = await this.supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (deleteError) throw deleteError;

      return { success: true, message: `Product moved to trash successfully` };
    } catch (error) {
      // console.error('Error in moveToTrash:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async moveMultipleToTrash(productIds: (number | string)[]) {
    try {
      const results = await Promise.all(productIds.map(id => this.moveToTrash(id)));
      const allSuccessful = results.every(result => result.success);
      const failedCount = results.filter(result => !result.success).length;

      return {
        success: allSuccessful,
        message: allSuccessful 
          ? 'All products moved to trash successfully' 
          : `${failedCount} products failed to move to trash`,
        results
      };
    } catch (error) {
      // console.error('Error in moveMultipleToTrash:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getTrashItems(page = 1, pageSize = 20) {
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await this.supabase
        .from('product_trash')
        .select('*', { count: 'exact' })
        .order('deleted_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      const itemsWithUrls = await Promise.all(
        (data || []).map(async (item) => {
          let imageUrl = null;
          if (item.image_path) {
            const { data: urlData } = this.supabase.storage
              .from('product-trash')
              .getPublicUrl(item.image_path);
            imageUrl = urlData.publicUrl;
          }

          return {
            ...item,
            imageUrl
          };
        })
      );

      return { items: itemsWithUrls, total: count ?? 0 };
    } catch (error) {
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  }

  async restoreFromTrash(trashItemId: number | string) {
    try {
      // Get the trash item
      const { data: trashItem, error: fetchError } = await this.supabase
        .from('product_trash')
        .select('*')
        .eq('id', trashItemId)
        .single();

      if (fetchError) throw fetchError;
      if (!trashItem) throw new Error('Trash item not found');

      // Move image back if it exists
      if (trashItem.image_path) {
        const { data: fileData, error: downloadError } = await this.supabase.storage
          .from('product-trash')
          .download(trashItem.image_path);

        if (!downloadError && fileData) {
          // Upload back to original bucket
          await this.supabase.storage
            .from(this.storageBucket)
            .upload(trashItem.image_path, fileData, { upsert: true });

          // Remove from trash bucket
          await this.supabase.storage
            .from('product-trash')
            .remove([trashItem.image_path]);
        }
      }

      // Insert back into products table
      const { error: restoreError } = await this.supabase
        .from('products')
        .insert([{
          id: trashItem.product_id,
          product_name: trashItem.product_name,
          tags: trashItem.tags || [],
          image_path: trashItem.image_path || null,
          main_category: trashItem.main_category || null,
          created_at: trashItem.original_created_at || new Date().toISOString()
        }]);

      if (restoreError) throw restoreError;

      // Delete from trash
      const { error: deleteError } = await this.supabase
        .from('product_trash')
        .delete()
        .eq('id', trashItemId);

      if (deleteError) throw deleteError;

      return { success: true, message: 'Product restored successfully' };
    } catch (error) {
      // console.error('Error in restoreFromTrash:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async permanentlyDeleteFromTrash(trashItemId: number | string) {
    try {
      // Get the trash item first to get the image path
      const { data: trashItem, error: fetchError } = await this.supabase
        .from('product_trash')
        .select('image_path')
        .eq('id', trashItemId)
        .single();

      if (fetchError) throw fetchError;

      // Delete image from trash storage if it exists
      if (trashItem?.image_path) {
        await this.supabase.storage
          .from('product-trash')
          .remove([trashItem.image_path]);
      }

      // Delete the record from product_trash table
      const { error: deleteError } = await this.supabase
        .from('product_trash')
        .delete()
        .eq('id', trashItemId);

      if (deleteError) throw deleteError;

      return { success: true, message: 'Item permanently deleted' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

export default ProductApiClient;