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
        .insert([{ product_name: productName, product_tag: productTag, image_path: fileName }])
        .select();

      if (productError) throw productError;

      const { data: urlData } = this.supabase.storage.from(this.storageBucket).getPublicUrl(fileName);

      return { success: true, message: 'Product uploaded successfully', product: productData[0], imageUrl: urlData.publicUrl };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async updateProduct(productId: number | string, updates: { productName?: string; productTag?: string; fileInput?: File | Blob } = {}) {
    try {
      const { data: existingProduct, error: fetchError } = await this.supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (fetchError) throw fetchError;
      if (!existingProduct) throw new Error(`Product with ID ${productId} not found`);

      const updateData: Record<string, unknown> = {};
      if (updates.productName) {
        updateData.product_name = updates.productName;
      }
      if (updates.productTag) {
        updateData.product_tag = updates.productTag;
      }

      let newImageUrl: string | null = null;
      let oldImagePath: string | null = null;
      
      if (updates.fileInput) {
        // Change let to const since these variables are never reassigned
        const fileName = (updates.fileInput as File).name || `upload_${Date.now()}`;
        const fileData = updates.fileInput;

        // Upload new image
        const { error: uploadError } = await this.supabase.storage
          .from(this.storageBucket)
          .upload(fileName, fileData, { cacheControl: '3600', upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = this.supabase.storage.from(this.storageBucket).getPublicUrl(fileName);
        newImageUrl = urlData.publicUrl;

        // Store the old image path for later deletion
        oldImagePath = existingProduct.image_path;
        updateData.image_path = fileName;
      }

      if (Object.keys(updateData).length === 0) {
        return { success: false, message: 'No updates provided', product: existingProduct };
      }

      // Update the database
      const { data: updatedProducts, error: updateError } = await this.supabase
        .from('products')
        .update(updateData)
        .eq('id', productId)
        .select();

      if (updateError) throw updateError;
      if (!updatedProducts || updatedProducts.length === 0) {
        throw new Error(`Product with ID ${productId} could not be updated`);
      }

      // Only delete the old image after successful database update
      if (oldImagePath && oldImagePath !== updateData.image_path) {
        const { error: deleteError } = await this.supabase.storage
          .from(this.storageBucket)
          .remove([oldImagePath]);

        if (deleteError) {
          // console.warn(`Failed to delete old image: ${oldImagePath}`, deleteError);
          // Don't throw error here, as the update was successful
        }
      }

      const updatedProduct = updatedProducts[0];
      const imageUrl = newImageUrl || this.supabase.storage.from(this.storageBucket).getPublicUrl(updatedProduct.image_path).data.publicUrl;

      return {
        success: true,
        message: 'Product updated successfully',
        product: updatedProduct,
        imageUrl,
        updatedFields: Object.keys(updateData),
      };
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
      const { data, error } = await this.supabase
        .from('products')
        .select('product_tag, image_path, product_name, id')
        .ilike('product_tag', `%${query}%`);

      if (error) throw error;

      if (data && data.length > 0) {
        const productsWithUrls = await Promise.all(
          data.map(async (product) => {
            const { data: urlData } = this.supabase.storage.from(this.storageBucket).getPublicUrl(product.image_path);

            return {
              ...product,
              imageUrl: urlData.publicUrl,
            };
          })
        );

        return { found: true, products: productsWithUrls, count: productsWithUrls.length };
      } else {
        return { found: false, message: `Product with tag "${query}" not found in the database.` };
      }
    } catch (error) {
      return { found: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async searchByName(query: string) {
    try {
      const { data, error } = await this.supabase
        .from('products')
        .select('product_name, product_tag, image_path, id')
        .ilike('product_name', `%${query}%`);

      if (error) throw error;

      if (data && data.length > 0) {
        const productsWithUrls = await Promise.all(
          data.map(async (product) => {
            const { data: urlData } = this.supabase.storage.from(this.storageBucket).getPublicUrl(product.image_path);

            return {
              ...product,
              imageUrl: urlData.publicUrl,
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

  async getProductById(id: number) {
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
      };
    } catch (error) {
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  }
}

export default ProductApiClient;