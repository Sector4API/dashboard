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

interface Product {
  id: string; // UUID
  product_name: string;
  image_path: string;
  created_at?: string;
  product_tag?: string[];
  description?: string;
  main_category?: string;
}

interface ProductUpdatePayload {
  product_name?: string;
  product_tag?: string[];
  image_path?: string;
  main_category?: string;
  description?: string;
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
        .from('products_new')
        .insert([{ product_name: productName, tags: [productTag], image_path: fileName }])
        .select();

      if (productError) throw productError;

      const { data: urlData } = this.supabase.storage.from(this.storageBucket).getPublicUrl(fileName);

      return { success: true, message: 'Product uploaded successfully', product: productData[0], imageUrl: urlData.publicUrl };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async updateProduct(productId: string, updates: ProductUpdatePayload) {
    try {
      const updateData: Partial<Product> = {};
      if (updates.product_name !== undefined) updateData.product_name = updates.product_name;
      if (updates.product_tag !== undefined) updateData.product_tag = updates.product_tag;
      if (updates.image_path !== undefined) updateData.image_path = updates.image_path;
      if (updates.main_category !== undefined) updateData.main_category = updates.main_category;
      if (updates.description !== undefined) updateData.description = updates.description;

      const { data, error } = await this.supabase
        .from('products_new')
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

  async deleteProduct(productId: string) {
    try {
      // Fetch the product to get the image path
      const { data: existingProduct, error: fetchError } = await this.supabase
        .from('products_new')
        .select('*')
        .eq('id', productId)
        .single();

      if (fetchError) throw fetchError;

      // Delete the product
      const { error: deleteError } = await this.supabase
        .from('products_new')
        .delete()
        .eq('id', productId);

      if (deleteError) throw deleteError;

      // If product had an image, delete it from storage
      if (existingProduct?.image_path) {
        const { error: storageError } = await this.supabase.storage
          .from(this.storageBucket)
          .remove([existingProduct.image_path]);

        if (storageError) throw storageError;
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async searchByTag(query: string) {
    try {
      const lowercaseQuery = query.toLowerCase();

      // Log the search URL for name-based search
      // console.log(`Search URL: ${this.supabase.from('products').select('product_name,tags,image_path,id,main_category').ilike('product_name', `%${query}%`).url}`);

      // Then, search by product name
      const { data: nameResults, error: nameError } = await this.supabase
        .from('products_new')
        .select('product_name,product_tag,image_path,id,main_category')
        .ilike('product_name', `%${query}%`);

      if (nameError) {
        console.error('Name search error:', nameError.message);
        return { found: false, error: nameError.message };
      }

      // Log the search URL for tag-based search
      // console.log(`Tag search URL: ${this.supabase.from('products').select('product_name,tags,image_path,id,main_category').filter('tags', 'cs', `{${query}}`).url}`);

      // Search by tags
      const { data: tagResults, error: tagError } = await this.supabase
        .from('products_new')
        .select('product_name,product_tag,image_path,id,main_category')
        .filter('product_tag', 'cs', `{${query}}`);

      if (tagError) {
        console.error('Tag search error:', tagError.message);
        return { found: false, error: tagError.message };
      }

      // Log the results
      console.log('Name search results:', nameResults?.length || 0, 'results');
      console.log('Tag search results:', tagResults?.length || 0, 'results');

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
              product_tag: product.product_tag,
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

        console.log('Final combined and sorted results:', sortedProducts.length, 'results');
        return { found: true, products: sortedProducts, count: sortedProducts.length };
      } else {
        console.log('No results found for query:', query);
        return { found: false, message: `No products found matching "${query}"` };
      }
    } catch (error) {
      console.error('Search error:', error);
      return { found: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async searchByName(query: string) {
    try {
      const { data, error } = await this.supabase
        .from('products_new')
        .select('product_name, product_tag, image_path, id, main_category')
        .ilike('product_name', `%${query}%`);

      if (error) throw error;

      if (data && data.length > 0) {
        const productsWithUrls = await Promise.all(
          data.map(async (product) => {
            const { data: urlData } = this.supabase.storage.from(this.storageBucket).getPublicUrl(product.image_path);

            return {
              ...product,
              imageUrl: urlData.publicUrl,
              product_tag: product.product_tag,
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
        .from('products_new')
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
            product_tag: product.product_tag || [],
            main_category: product.main_category || ''
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

  async getProductById(id: string) {
    try {
      const { data, error } = await this.supabase
        .from('products_new')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      const { data: urlData } = this.supabase.storage.from(this.storageBucket).getPublicUrl(data.image_path);

      return {
        ...data,
        imageUrl: urlData.publicUrl,
        product_tag: data.product_tag,
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
        .from('products_new')
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

  async moveToTrash(productId: string) {
    try {
      // Get the product details
      const { data: product, error: fetchError } = await this.supabase
        .from('products_new')
        .select('*')
        .eq('id', productId)
        .single();

      if (fetchError) throw fetchError;

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
          scheduled_deletion_at: null // No automatic deletion
        }]);

      if (trashError) {
        // console.error('Error moving to trash:', trashError);
        throw trashError;
      }

      // Delete from products table
      const { error: deleteError } = await this.supabase
        .from('products_new')
        .delete()
        .eq('id', productId);

      if (deleteError) throw deleteError;

      return { success: true, message: `Product moved to trash successfully` };
    } catch (error) {
      // console.error('Error in moveToTrash:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async moveMultipleToTrash(productIds: (string)[]) {
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

  async restoreFromTrash(trashItemId: string) {
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
        .from('products_new')
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

  async permanentlyDeleteFromTrash(trashItemId: string) {
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

  async searchByMainCategory(category: string) {
    try {
      const { data, error } = await this.supabase
        .from('products_new')
        .select('*')
        .ilike('main_category', `%${category}%`);

      if (error) throw error;

      // If products found, get the image URLs
      if (data && data.length > 0) {
        const productsWithUrls = await Promise.all(data.map(async (product) => {
          const { data: urlData } = this.supabase.storage.from(this.storageBucket).getPublicUrl(product.image_path);
          return {
            ...product,
            imageUrl: urlData.publicUrl
          };
        }));

        return {
          found: true,
          products: productsWithUrls,
          count: productsWithUrls.length,
          category: category
        };
      } else {
        return {
          found: false,
          message: `No products found in category "${category}"`,
          category: category
        };
      }
    } catch (error) {
      console.error('Error searching by main category:', error);
      return {
        found: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        category: category
      };
    }
  }

  async searchByNameWithCategories(productName: string, categories: string[] = []) {
    try {
      // Start with the base query for product name
      let query = this.supabase
        .from('products_new')
        .select('*')
        .ilike('product_name', `%${productName}%`);

      // If categories are provided, add the category filter
      if (categories && categories.length > 0) {
        // Use in() operator for exact matches in the provided categories
        query = query.in('main_category', categories);
      }

      // Execute the query
      const { data, error } = await query;

      if (error) throw error;

      // If products found, get the image URLs
      if (data && data.length > 0) {
        const productsWithUrls = await Promise.all(data.map(async (product) => {
          const { data: urlData } = this.supabase.storage.from(this.storageBucket).getPublicUrl(product.image_path);
          return {
            ...product,
            imageUrl: urlData.publicUrl
          };
        }));

        // Group products by category for better organization
        const productsByCategory = productsWithUrls.reduce((acc: { [key: string]: any[] }, product) => {
          const category = product.main_category || 'Uncategorized';
          if (!acc[category]) {
            acc[category] = [];
          }
          acc[category].push(product);
          return acc;
        }, {});

        return {
          found: true,
          products: productsWithUrls,
          productsByCategory: productsByCategory,
          count: productsWithUrls.length,
          categoriesFound: Object.keys(productsByCategory),
          searchCriteria: {
            productName: productName,
            categories: categories
          }
        };
      } else {
        const categoriesMessage = categories.length > 0
          ? ` in categories: ${categories.join(', ')}`
          : '';
        return {
          found: false,
          message: `No products found matching "${productName}"${categoriesMessage}`,
          searchCriteria: {
            productName: productName,
            categories: categories
          }
        };
      }
    } catch (error) {
      console.error('Error searching by name with categories:', error);
      return {
        found: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        searchCriteria: {
          productName: productName,
          categories: categories
        }
      };
    }
  }

  async getAllCategories() {
    try {
      const { data, error } = await this.supabase
        .from('products_new')
        .select('main_category')
        .not('main_category', 'is', null);

      if (error) throw error;

      // Extract unique categories
      const uniqueCategories = [...new Set(data
        .map(item => item.main_category)
        .filter(category => category !== null && category !== '')
      )].sort();

      return {
        success: true,
        categories: uniqueCategories,
        count: uniqueCategories.length
      };
    } catch (error) {
      console.error('Error fetching categories:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getProductsByCategories(categories: string[] = [], options: { limit?: number; sortBy?: string; ascending?: boolean } = {}) {
    try {
      let query = this.supabase
        .from('products_new')
        .select('*');

      // Apply category filter if categories are provided
      if (categories && categories.length > 0) {
        query = query.in('main_category', categories);
      }

      // Apply sorting if specified
      if (options.sortBy) {
        query = query.order(options.sortBy, {
          ascending: options.ascending !== false
        });
      }

      // Apply limit if specified
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        // Add image URLs to all products
        const productsWithUrls = await Promise.all(data.map(async (product) => {
          const { data: urlData } = this.supabase.storage.from(this.storageBucket).getPublicUrl(product.image_path);
          return {
            ...product,
            imageUrl: urlData.publicUrl
          };
        }));

        // Group products by category
        const productsByCategory = productsWithUrls.reduce((acc: { [key: string]: { products: any[]; count: number } }, product) => {
          const category = product.main_category || 'Uncategorized';
          if (!acc[category]) {
            acc[category] = {
              products: [],
              count: 0
            };
          }
          acc[category].products.push(product);
          acc[category].count++;
          return acc;
        }, {});

        // Calculate totals
        const totalProducts = productsWithUrls.length;
        const categoriesFound = Object.keys(productsByCategory);

        return {
          success: true,
          productsByCategory,
          categories: categoriesFound,
          totalProducts,
          categoryStats: categoriesFound.map(category => ({
            category,
            count: productsByCategory[category].count
          })),
          searchCriteria: {
            categories,
            options
          }
        };
      } else {
        const categoriesMessage = categories.length > 0
          ? ` in categories: ${categories.join(', ')}`
          : '';
        return {
          success: false,
          message: `No products found${categoriesMessage}`,
          searchCriteria: {
            categories,
            options
          }
        };
      }
    } catch (error) {
      console.error('Error fetching products by categories:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        searchCriteria: {
          categories,
          options
        }
      };
    }
  }
}

export default ProductApiClient;