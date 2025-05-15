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

  async uploadProductImage(fileInput: File | Blob | string, options: UploadOptions = {}) {
    try {
      let fileName: string;
      let fileData: File | Blob | Buffer;
      let productName: string;
      let productTag: string;

      if (this.isNode && typeof fileInput === 'string') {
        const fs = await import('fs');
        const path = await import('path');

        if (!fs.existsSync(fileInput)) {
          throw new Error(`File not found: ${fileInput}`);
        }

        fileName = path.basename(fileInput);
        const fileExtension = path.extname(fileName);
        const fileNameWithoutExt = path.basename(fileName, fileExtension);

        productName = options.customProductName || fileNameWithoutExt.replace(/[^a-zA-Z0-9]/g, ' ').trim();
        fileData = fs.readFileSync(fileInput);
      } else {
        if (!(fileInput instanceof File || fileInput instanceof Blob)) {
          throw new Error('In browser environments, fileInput must be a File or Blob object');
        }

        fileName = (fileInput as File).name || `upload_${Date.now()}`;
        const lastDotIndex = fileName.lastIndexOf('.');
        const fileNameWithoutExt = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;

        productName = options.customProductName || fileNameWithoutExt.replace(/[^a-zA-Z0-9]/g, ' ').trim();
        fileData = fileInput;
      }

      productTag = options.customProductTag || productName;

      const { data: uploadData, error: uploadError } = await this.supabase.storage
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
      console.error('Error uploading product image:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async updateProduct(productId: number, updates: { productName?: string; productTag?: string; fileInput?: File | Blob | string } = {}) {
    try {
      const { data: existingProduct, error: fetchError } = await this.supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (fetchError) throw fetchError;
      if (!existingProduct) throw new Error(`Product with ID ${productId} not found`);

      const updateData: Record<string, any> = {};

      if (updates.productName) {
        updateData.product_name = updates.productName;
      }

      if (updates.productTag) {
        updateData.product_tag = updates.productTag;
      }

      let newImageUrl: string | null = null;
      if (updates.fileInput) {
        let fileName: string;
        let fileData: File | Blob | Buffer;

        if (this.isNode && typeof updates.fileInput === 'string') {
          const fs = await import('fs');
          const path = await import('path');

          if (!fs.existsSync(updates.fileInput)) {
            throw new Error(`File not found: ${updates.fileInput}`);
          }

          fileName = path.basename(updates.fileInput);
          fileData = fs.readFileSync(updates.fileInput);
        } else {
          if (!(updates.fileInput instanceof File || updates.fileInput instanceof Blob)) {
            throw new Error('In browser environments, fileInput must be a File or Blob object');
          }

          fileName = (updates.fileInput as File).name || `upload_${Date.now()}`;
          fileData = updates.fileInput;
        }

        const { data: uploadData, error: uploadError } = await this.supabase.storage
          .from(this.storageBucket)
          .upload(fileName, fileData, { cacheControl: '3600', upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = this.supabase.storage.from(this.storageBucket).getPublicUrl(fileName);
        newImageUrl = urlData.publicUrl;

        updateData.image_path = fileName;

        if (existingProduct.image_path && existingProduct.image_path !== fileName) {
          const { error: deleteError } = await this.supabase.storage
            .from(this.storageBucket)
            .remove([existingProduct.image_path]);

          if (deleteError) {
            console.error('Error deleting old image:', deleteError);
          }
        }
      }

      if (Object.keys(updateData).length === 0) {
        return { success: false, message: 'No updates provided', product: existingProduct };
      }

      const { data: updatedProducts, error: updateError } = await this.supabase
        .from('products')
        .update(updateData)
        .eq('id', productId)
        .select();

      if (updateError) throw updateError;
      if (!updatedProducts || updatedProducts.length === 0) {
        throw new Error(`Product with ID ${productId} could not be updated`);
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
    } catch (error: any) {
      console.error('Error updating product:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteProduct(productId: number) {
    try {
      const { data: existingProduct, error: fetchError } = await this.supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (fetchError) throw fetchError;
      if (!existingProduct) throw new Error(`Product with ID ${productId} not found`);

      const imagePath = existingProduct.image_path;

      const { error: deleteError } = await this.supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (deleteError) throw deleteError;

      if (imagePath) {
        const { error: storageError } = await this.supabase.storage
          .from(this.storageBucket)
          .remove([imagePath]);

        if (storageError) {
          console.error('Error deleting image from storage:', storageError);
        }
      }

      return { success: true, message: `Product with ID ${productId} and its associated image were successfully deleted`, deletedProduct: existingProduct };
    } catch (error: any) {
      console.error('Error deleting product:', error);
      return { success: false, error: error.message };
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
    } catch (error: any) {
      console.error('Error searching by tag:', error);
      return { found: false, error: error.message };
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
    } catch (error: any) {
      console.error('Error searching by name:', error);
      return { found: false, error: error.message };
    }
  }

  async getAllProducts(page = 1, pageSize = 20) {
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, error, count } = await this.supabase
        .from('products')
        .select('*', { count: 'exact' })
        .range(from, to);

      if (error) throw error;

      const productsWithUrls = await Promise.all(
        (data || []).map(async (product) => {
          const { data: urlData } = this.supabase.storage.from(this.storageBucket).getPublicUrl(product.image_path);
          return {
            ...product,
            imageUrl: urlData.publicUrl,
          };
        })
      );

      return { products: productsWithUrls, total: count ?? 0 };
    } catch (error: any) {
      console.error('Error getting all products:', error);
      throw error;
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
    } catch (error: any) {
      console.error(`Error getting product with ID ${id}:`, error);
      throw error;
    }
  }
}

export default ProductApiClient;