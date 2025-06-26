import { dashboardSupabase } from './supabase';

// Helper function to compress an image to target size (1MB)
const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const ONE_MB = 1024 * 1024; // 1MB in bytes
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        let quality = 0.9; // Initial quality
        let iterations = 0;
        const MAX_ITERATIONS = 10;

        // If image is already under 1MB, return original
        if (file.size <= ONE_MB) {
          resolve(file);
          return;
        }

        // Calculate aspect ratio
        const aspectRatio = width / height;

        // If width or height is too large, reduce dimensions
        const MAX_DIMENSION = 2048;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            width = MAX_DIMENSION;
            height = Math.round(width / aspectRatio);
          } else {
            height = MAX_DIMENSION;
            width = Math.round(height * aspectRatio);
          }
        }

        const compress = () => {
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Could not compress image'));
                return;
              }

              // If size is still too large and we haven't tried too many times
              if (blob.size > ONE_MB && iterations < MAX_ITERATIONS) {
                iterations++;
                quality -= 0.1; // Reduce quality
                if (quality < 0.1) quality = 0.1; // Don't go below 0.1
                compress(); // Try again
                return;
              }

              // Create a new file from the blob
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });

              resolve(compressedFile);
            },
            'image/jpeg',
            quality
          );
        };

        compress();
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
  });
};

type TemplateInput = {
  name: string;
  description: string;
  category: string[];
  headerImage: File;
  thumbnail: File;
  dateImage?: File;
  seasonalBadges?: (File | null)[];
  tags: string[];
  isPublic?: boolean;
  terms_section_background_color: string;
  product_section_background_color: string;
  product_card_background_color: string;
  global_text_color: string;
};

/* eslint-disable no-console */
type LogMessage = {
  message?: string;
  details?: unknown;
  code?: string;
  hint?: string;
  stack?: string;
  cause?: unknown;
};

// Logger implementation
const logger = {
  error: (message: string, error?: LogMessage) => {
    if (process.env.NODE_ENV !== 'production') {
      //  console.error(message, error)
    }
    // In production, you might want to use a proper logging service
  },
  info: (message: string, data?: LogMessage) => {
    if (process.env.NODE_ENV !== 'production') {
      //  console.log(message, data)
    }
  }
};

// Helper function to get all templates sorted by updated_at
const getTemplatesSortedByUpdate = async () => {
  const { data, error } = await dashboardSupabase
    .from('templates')
    .select('*, header_image_path, thumbnail_path, seasonal_badge_paths, badge_position, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    logger.error('Error fetching sorted templates:', {
      message: error.message,
      details: error
    });
    throw new Error(`Failed to fetch sorted templates: ${error.message}`);
  }

  return data || [];
};

// Helper function to update display orders for all templates
const updateDisplayOrders = async (templates: any[]) => {
  if (!templates || templates.length === 0) return;

  // Create updates with all required fields
  const updates = templates.map((template, index) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    category: template.category,
    tags: template.tags,
    is_public: template.is_public,
    header_image_path: template.header_image_path,
    thumbnail_path: template.thumbnail_path,
    seasonal_badge_paths: template.seasonal_badge_paths,
    badge_position: template.badge_position,
    terms_section_background_color: template.terms_section_background_color,
    product_section_background_color: template.product_section_background_color,
    product_card_background_color: template.product_card_background_color,
    global_text_color: template.global_text_color,
    display_order: index + 1,
    updated_at: template.updated_at,
    created_at: template.created_at
  }));

  const { error } = await dashboardSupabase
    .from('templates')
    .upsert(updates, { 
      onConflict: 'id',
      ignoreDuplicates: false 
    });

  if (error) {
    logger.error('Error updating display orders:', {
      message: error.message,
      details: error
    });
    throw new Error(`Failed to update display orders: ${error.message}`);
  }
};

// Helper function to retry failed operations
const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) break;
      
      // Wait before retrying, with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  
  throw lastError;
};

// Helper function to upload files in batches with retry logic
const uploadFilesInBatches = async (
  storageBucket: string,
  folderName: string,
  files: (File | null)[],
  batchSize: number = 3
): Promise<(string | null)[]> => {
  const paths: (string | null)[] = new Array(files.length).fill(null);
  
  // Process files in batches
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const batchPromises = batch.map(async (file, batchIndex) => {
      if (!file) return null;
      
      const actualIndex = i + batchIndex;
      const filePath = `${folderName}/${file.name}`;
      
      try {
        await retryOperation(async () => {
          const { error } = await dashboardSupabase.storage
            .from(storageBucket)
            .upload(filePath, file, { upsert: true });

          if (error) throw error;
        });
        
        paths[actualIndex] = filePath;
        return filePath;
      } catch (error) {
        console.error(`Failed to upload file ${actualIndex + 1} after retries:`, error);
        return null;
      }
    });

    // Wait for current batch to complete before moving to next batch
    await Promise.all(batchPromises);
    
    // Add a small delay between batches to prevent rate limiting
    if (i + batchSize < files.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return paths;
};

export const createTemplate = async (input: TemplateInput) => {
  const storageBucket = process.env.NEXT_PUBLIC_DASHBOARD_SUPABASE_STORAGE_BUCKET;
  if (!storageBucket) {
    throw new Error('Storage bucket name not found in environment variables. Please check NEXT_PUBLIC_DASHBOARD_SUPABASE_STORAGE_BUCKET in .env file');
  }

  let templateId: string | null = null;
  const folderName = input.name.toLowerCase()
    .replace(/[^a-z0-9\s-_]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  const uploadedFiles: string[] = [];

  try {
    // Compress images before upload
    const compressedHeaderImage = await compressImage(input.headerImage);
    const compressedThumbnail = await compressImage(input.thumbnail);
    let compressedDateImage = input.dateImage ? await compressImage(input.dateImage) : undefined;
    const compressedSeasonalBadges = await Promise.all(
      (input.seasonalBadges || []).map(async (badge) => {
        if (badge) {
          return compressImage(badge);
        }
        return null;
      })
    );

    // Get current templates to determine the new display order
    const currentTemplates = await retryOperation(async () => {
      return await getTemplatesSortedByUpdate();
    });
    
    // Create the new template with display_order 1
    const { data: tempTemplate, error: dbError } = await retryOperation(async () => {
      return await dashboardSupabase
        .from('templates')
        .insert({
          name: input.name,
          description: input.description,
          category: input.category,
          tags: Array.isArray(input.tags) ? input.tags : [],
          is_public: Boolean(input.isPublic ?? false),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          terms_section_background_color: input.terms_section_background_color,
          product_section_background_color: input.product_section_background_color,
          product_card_background_color: input.product_card_background_color,
          global_text_color: input.global_text_color,
          display_order: 1,
          badge_position: {
            x: 50,
            y: 50,
            rotation: 0,
            scale: 1
          }
        })
        .select()
        .single();
    });

    if (dbError) {
      throw dbError;
    }

    templateId = tempTemplate.id;

    // Update display orders for all existing templates
    await retryOperation(async () => {
      const updatedTemplates = [tempTemplate, ...currentTemplates];
      await updateDisplayOrders(updatedTemplates);
    });

    // Upload header image with retry
    const headerPath = `${folderName}/${compressedHeaderImage.name}`;
    await retryOperation(async () => {
      const { error: headerError } = await dashboardSupabase.storage
        .from(storageBucket)
        .upload(headerPath, compressedHeaderImage);

      if (headerError) throw headerError;
    });
    uploadedFiles.push(headerPath);

    // Upload thumbnail with retry
    const thumbnailPath = `${folderName}/${compressedThumbnail.name}`;
    await retryOperation(async () => {
      const { error: thumbnailError } = await dashboardSupabase.storage
        .from(storageBucket)
        .upload(thumbnailPath, compressedThumbnail);

      if (thumbnailError) throw thumbnailError;
    });
    uploadedFiles.push(thumbnailPath);

    // Upload date image with retry
    let datePath = null;
    if (compressedDateImage) {
      datePath = `${folderName}/${compressedDateImage.name}`;
      await retryOperation(async () => {
        const { error: dateError } = await dashboardSupabase.storage
          .from(storageBucket)
          .upload(datePath, compressedDateImage);

        if (dateError) throw dateError;
      });
      uploadedFiles.push(datePath);
    }

    // Upload seasonal badges in batches with retry logic
    const badgePaths = await uploadFilesInBatches(storageBucket, folderName, compressedSeasonalBadges);
    uploadedFiles.push(...badgePaths.filter((path): path is string => path !== null));

    // Update the database record with file paths
    await retryOperation(async () => {
      const { error: updateError } = await dashboardSupabase
        .from('templates')
        .update({
          header_image_path: headerPath,
          thumbnail_path: thumbnailPath,
          date_image_path: datePath,
          seasonal_badge_paths: badgePaths,
        })
        .eq('id', templateId);

      if (updateError) throw updateError;
    });

    return tempTemplate;
  } catch (error) {
    // If any error occurs, clean up any uploaded files
    if (uploadedFiles.length > 0) {
      try {
        await retryOperation(async () => {
          await dashboardSupabase.storage
            .from(storageBucket)
            .remove(uploadedFiles);
        });
      } catch (cleanupError) {
        console.error('Error cleaning up uploaded files:', cleanupError);
      }
    }

    // If template was created but file upload failed, delete the template
    if (templateId) {
      try {
        await retryOperation(async () => {
          await dashboardSupabase
            .from('templates')
            .delete()
            .eq('id', templateId);
        });
      } catch (deleteError) {
        console.error('Error deleting template:', deleteError);
      }
    }

    throw error;
  }
};

export const getTemplates = async () => {
  try {
    // Get templates sorted by updated_at
    const templates = await getTemplatesSortedByUpdate();
    
    // Always update display orders to match the updated_at order
    if (templates.length > 0) {
      await updateDisplayOrders(templates);
      
      // Fetch the templates again to get the updated display_order values
      const updatedTemplates = await getTemplatesSortedByUpdate();
      return updatedTemplates;
    }
    
    return templates;
  } catch (error) {
    logger.error('Error in getTemplates:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error
    });
    throw error;
  }
};

export const deleteTemplate = async (id: string, folderPath: string) => {
  try {
    const storageBucket = process.env.NEXT_PUBLIC_DASHBOARD_SUPABASE_STORAGE_BUCKET;
    if (!storageBucket) {
      throw new Error('Storage bucket name not found in environment variables.');
    }

    const folderName = folderPath.split('/')[0];
    logger.info('Attempting to delete folder:', { message: folderName });

    const { data: files, error: listError } = await dashboardSupabase
      .storage
      .from(storageBucket)
      .list(folderName);

    if (listError) {
      logger.error('Error listing files in folder:', {
        message: 'List Error',
        details: listError
      });
      throw listError;
    }

    if (files && files.length > 0) {
      const filePaths = files.map(file => `${folderName}/${file.name}`);
      logger.info('Files to delete:', { message: 'File Paths', details: filePaths });

      const { error: deleteFilesError } = await dashboardSupabase
        .storage
        .from(storageBucket)
        .remove(filePaths);

      if (deleteFilesError) {
        logger.error('Error deleting files in folder:', {
          message: 'Delete Files Error',
          details: deleteFilesError
        });
        throw deleteFilesError;
      }
    } else {
      logger.info('No files found in folder to delete.', { message: 'Empty Folder' });
    }

    const { error: deleteFolderError } = await dashboardSupabase
      .storage
      .from(storageBucket)
      .remove([folderName]);

    if (deleteFolderError) {
      logger.error('Error deleting folder:', {
        message: 'Delete Folder Error',
        details: deleteFolderError
      });
      throw deleteFolderError;
    } else {
      logger.info('Folder deleted successfully:', { message: folderName });
    }

    const { error: dbError } = await dashboardSupabase
      .from('templates')
      .delete()
      .eq('id', id);

    if (dbError) {
      logger.error('Error deleting template from database:', {
        message: 'Database Error',
        details: dbError
      });
      throw dbError;
    }
  } catch (error) {
    logger.error('Error in deleteTemplate:', {
      message: 'Unknown error',
      details: error
    });
    throw error;
  }
};

export const updateTemplateAssets = async (templateId: string, files: {
  headerImage: File | null;
  thumbnail: File | null;
  dateImage: File | null;
  seasonalBadges: (File | null)[];
  replaceExisting?: boolean;
}) => {
  try {
    const storageBucket = process.env.NEXT_PUBLIC_DASHBOARD_SUPABASE_STORAGE_BUCKET;
    if (!storageBucket) {
      throw new Error('Storage bucket name not found in environment variables.');
    }

    // Get the template's current folder name and existing paths
    const { data: template, error: templateError } = await dashboardSupabase
      .from('templates')
      .select('name, header_image_path, thumbnail_path, date_image_path, seasonal_badge_paths')
      .eq('id', templateId)
      .single();

    if (templateError) throw templateError;

    const folderName = template.name.toLowerCase()
      .replace(/[^a-z0-9\s-_]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Compress all images before upload
    const compressedFiles = {
      headerImage: files.headerImage ? await compressImage(files.headerImage) : null,
      thumbnail: files.thumbnail ? await compressImage(files.thumbnail) : null,
      dateImage: files.dateImage ? await compressImage(files.dateImage) : null,
      seasonalBadges: await Promise.all(
        files.seasonalBadges.map(async (badge) => {
          if (badge) {
            return compressImage(badge);
          }
          return null;
        })
      )
    };

    let headerImagePath = null;
    let thumbnailPath = null;
    let dateImagePath = null;
    let seasonalBadgePaths = template.seasonal_badge_paths || [];

    // If we're replacing existing files, delete them first
    if (files.replaceExisting) {
      const filesToDelete: string[] = [];
      
      if (files.headerImage && template.header_image_path) {
        filesToDelete.push(template.header_image_path);
      }
      if (files.thumbnail && template.thumbnail_path) {
        filesToDelete.push(template.thumbnail_path);
      }
      if (files.dateImage && template.date_image_path) {
        filesToDelete.push(template.date_image_path);
      }
      if (files.seasonalBadges.length > 0 && template.seasonal_badge_paths) {
        files.seasonalBadges.forEach((badge, index) => {
          if (badge && template.seasonal_badge_paths[index]) {
            filesToDelete.push(template.seasonal_badge_paths[index]);
          }
        });
      }

      // Delete existing files if any
      if (filesToDelete.length > 0) {
        await dashboardSupabase.storage
          .from(storageBucket)
          .remove(filesToDelete);
      }
    }

    // Upload header image
    if (compressedFiles.headerImage) {
      headerImagePath = `${folderName}/${compressedFiles.headerImage.name}`;
      await dashboardSupabase.storage
        .from(storageBucket)
        .upload(headerImagePath, compressedFiles.headerImage, { upsert: true });
    }

    // Upload thumbnail if provided
    if (compressedFiles.thumbnail) {
      thumbnailPath = `${folderName}/${compressedFiles.thumbnail.name}`;
      await dashboardSupabase.storage
        .from(storageBucket)
        .upload(thumbnailPath, compressedFiles.thumbnail, { upsert: true });
    }

    // Upload date image if provided
    if (compressedFiles.dateImage) {
      dateImagePath = `${folderName}/${compressedFiles.dateImage.name}`;
      await dashboardSupabase.storage
        .from(storageBucket)
        .upload(dateImagePath, compressedFiles.dateImage, { upsert: true });
    }

    // Upload seasonal badges in batches
    if (compressedFiles.seasonalBadges.length > 0) {
      const newBadgePaths = await uploadFilesInBatches(storageBucket, folderName, compressedFiles.seasonalBadges);
      seasonalBadgePaths = newBadgePaths;
    }

    // Return the paths of the newly uploaded files
    return {
      headerImagePath: headerImagePath || template.header_image_path,
      thumbnailPath: thumbnailPath || template.thumbnail_path,
      dateImagePath: dateImagePath || template.date_image_path,
      seasonalBadgePaths: seasonalBadgePaths
    };
  } catch (error) {
    throw error;
  }
};

export const updateTemplateOrder = async (templateId: string, newOrder: number) => {
  try {
    // First, get the current order of the template
    const { data: currentTemplate, error: fetchError } = await dashboardSupabase
      .from('templates')
      .select('display_order')
      .eq('id', templateId)
      .single();

    if (fetchError) throw fetchError;

    // Update all templates that need to be reordered
    if (currentTemplate) {
      const oldOrder = currentTemplate.display_order;
      
      if (oldOrder < newOrder) {
        // Moving down: decrease order of templates in between
        await dashboardSupabase.rpc('reorder_templates_down', {
          p_template_id: templateId,
          p_old_order: oldOrder,
          p_new_order: newOrder
        });
      } else if (oldOrder > newOrder) {
        // Moving up: increase order of templates in between
        await dashboardSupabase.rpc('reorder_templates_up', {
          p_template_id: templateId,
          p_old_order: oldOrder,
          p_new_order: newOrder
        });
      }
    }

    // Update the template's order
    const { error: updateError } = await dashboardSupabase
      .from('templates')
      .update({ display_order: newOrder })
      .eq('id', templateId);

    if (updateError) {
      logger.error('Error updating template order:', {
        message: 'Database Error',
        details: updateError
      });
      throw updateError;
    }
  } catch (error) {
    logger.error('Error in updateTemplateOrder:', {
      message: 'Unknown error',
      details: error
    });
    throw error;
  }
};

export const updateAllTemplateOrders = async (templates: { id: string; display_order: number }[]) => {
  try {
    // Get all template data
    const { data: currentTemplates, error: fetchError } = await dashboardSupabase
      .from('templates')
      .select('*')
      .in('id', templates.map(t => t.id));

    if (fetchError) throw fetchError;

    // Create a map of id to template data
    const templateMap = new Map(currentTemplates.map(t => [t.id, t]));

    // Sort templates by display_order and create updates
    const sortedTemplates = [...templates].sort((a, b) => a.display_order - b.display_order);
    
    // Update each template's display_order while preserving all other fields
    const updates = sortedTemplates.map((template, index) => {
      const currentTemplate = templateMap.get(template.id);
      if (!currentTemplate) {
        throw new Error(`Template with id ${template.id} not found`);
      }

      return {
        ...currentTemplate,
        display_order: index + 1
      };
    });

    const { error } = await dashboardSupabase
      .from('templates')
      .upsert(updates, { onConflict: 'id' });

    if (error) {
      throw error;
    }

    // Return the updated templates
    return getTemplates();
  } catch (error) {
    logger.error('Error updating template orders:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error
    });
    throw error;
  }
};

// Update the handleUpdate function to ensure display_order is updated
export const handleTemplateUpdate = async (templateId: string, updateData: any) => {
  try {
    // First update the template with the new data
    const { error: updateError } = await dashboardSupabase
      .from('templates')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', templateId);

    if (updateError) throw updateError;

    // Get all templates sorted by updated_at and update display orders
    const templates = await getTemplatesSortedByUpdate();
    await updateDisplayOrders(templates);

    return templates;
  } catch (error) {
    logger.error('Error updating template:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error
    });
    throw error;
  }
};