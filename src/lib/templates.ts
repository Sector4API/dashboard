import { dashboardSupabase } from './supabase';

type TemplateInput = {
  name: string;
  description: string;
  category: string[];
  headerImage: File;
  thumbnail: File;
  seasonalBadges: (File | null)[];
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

export const createTemplate = async (input: TemplateInput) => {
  const storageBucket = process.env.NEXT_PUBLIC_DASHBOARD_SUPABASE_STORAGE_BUCKET;
  if (!storageBucket) {
    throw new Error('Storage bucket name not found in environment variables. Please check NEXT_PUBLIC_DASHBOARD_SUPABASE_STORAGE_BUCKET in .env file');
  }

  let templateId: string | null = null;
  const folderName = input.name.toLowerCase().replace(/\s+/g, '-');
  const uploadedFiles: string[] = [];

  try {
    // Get the highest display_order
    const { data: maxOrderResult, error: maxOrderError } = await dashboardSupabase
      .from('templates')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    if (maxOrderError && maxOrderError.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
      throw maxOrderError;
    }

    const nextOrder = maxOrderResult ? maxOrderResult.display_order + 1 : 1;

    // Step 1: Create a temporary database record first
    const { data: tempTemplate, error: dbError } = await dashboardSupabase
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
        display_order: nextOrder
      })
      .select()
      .single();

    if (dbError) {
      logger.error('Database insert error:', {
        message: 'Database Error',
        code: dbError.code,
        details: dbError.details,
        hint: dbError.hint
      });
      throw dbError;
    }

    templateId = tempTemplate.id;

    // Step 2: Upload files
    // Upload header image
    const headerPath = `${folderName}/${input.headerImage.name}`;
    const { error: headerError } = await dashboardSupabase.storage
      .from(storageBucket)
      .upload(headerPath, input.headerImage);

    if (headerError) {
      throw headerError;
    }
    uploadedFiles.push(headerPath);

    // Upload thumbnail
    const thumbnailPath = `${folderName}/${input.thumbnail.name}`;
    const { error: thumbnailError } = await dashboardSupabase.storage
      .from(storageBucket)
      .upload(thumbnailPath, input.thumbnail);

    if (thumbnailError) {
      throw thumbnailError;
    }
    uploadedFiles.push(thumbnailPath);

    // Upload seasonal badges
    const badgePaths = await Promise.all(
      input.seasonalBadges.map(async (badge) => {
        if (badge) {
          const badgePath = `${folderName}/${badge.name}`;
          const { error: badgeError } = await dashboardSupabase.storage
            .from(storageBucket)
            .upload(badgePath, badge);

          if (badgeError) {
            throw badgeError;
          }
          uploadedFiles.push(badgePath);
          return badgePath;
        }
        return null;
      })
    );

    // Step 3: Update the database record with file paths
    const { error: updateError } = await dashboardSupabase
      .from('templates')
      .update({
        header_image_path: headerPath,
        thumbnail_path: thumbnailPath,
        seasonal_badge_paths: badgePaths,
      })
      .eq('id', templateId);

    if (updateError) {
      throw updateError;
    }

    return tempTemplate;
  } catch (error) {
    // Rollback: Clean up any uploaded files
    if (uploadedFiles.length > 0) {
      try {
        await dashboardSupabase.storage
          .from(storageBucket)
          .remove(uploadedFiles);
      } catch (cleanupError) {
        logger.error('Error during cleanup:', {
          message: 'Cleanup Error',
          details: cleanupError
        });
      }
    }

    // Delete the template record if it was created
    if (templateId) {
      try {
        await dashboardSupabase
          .from('templates')
          .delete()
          .eq('id', templateId);
      } catch (deleteError) {
        logger.error('Error deleting template record:', {
          message: 'Delete Error',
          details: deleteError
        });
      }
    }

    if (error instanceof Error) {
      logger.error('Error creating template:', {
        message: error.message,
        stack: error.stack,
        cause: error.cause
      });
    } else {
      logger.error('Error creating template:', {
        message: 'Unknown error',
        details: error
      });
    }
    throw error;
  }
};

export const getTemplates = async () => {
  try {
    const { data, error } = await dashboardSupabase
      .from('templates')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true }); // Secondary sort by creation date

    if (error) {
      logger.error('Error fetching templates:', {
        message: 'Database Error',
        details: error
      });
      throw error;
    }

    return data;
  } catch (error) {
    logger.error('Error in getTemplates:', {
      message: 'Unknown error',
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
      .select('name, header_image_path, thumbnail_path, seasonal_badge_paths')
      .eq('id', templateId)
      .single();

    if (templateError) throw templateError;

    const folderName = template.name.toLowerCase().replace(/\s+/g, '-');
    let headerImagePath = null;
    let thumbnailPath = null;
    let seasonalBadgePaths = template.seasonal_badge_paths || [];

    // If we're replacing existing files, delete them first
    if (files.replaceExisting) {
      const filesToDelete: string[] = [];
      
      // Add existing files to delete list if we have new files to replace them
      if (files.headerImage && template.header_image_path) {
        filesToDelete.push(template.header_image_path);
      }
      if (files.thumbnail && template.thumbnail_path) {
        filesToDelete.push(template.thumbnail_path);
      }

      // For seasonal badges, only delete the ones being replaced
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

    // Update header image if provided
    if (files.headerImage) {
      headerImagePath = `${folderName}/${files.headerImage.name}`;
      await dashboardSupabase.storage
        .from(storageBucket)
        .upload(headerImagePath, files.headerImage, { upsert: true });
    }

    // Update thumbnail if provided
    if (files.thumbnail) {
      thumbnailPath = `${folderName}/${files.thumbnail.name}`;
      await dashboardSupabase.storage
        .from(storageBucket)
        .upload(thumbnailPath, files.thumbnail, { upsert: true });
    }

    // Update seasonal badges if provided
    if (files.seasonalBadges.length > 0) {
      // Process each seasonal badge position
      await Promise.all(
        files.seasonalBadges.map(async (badge, index) => {
          if (badge) {
            const badgePath = `${folderName}/${badge.name}`;
            await dashboardSupabase.storage
              .from(storageBucket)
              .upload(badgePath, badge, { upsert: true });
            // Update the path in our array
            seasonalBadgePaths[index] = badgePath;
          }
          // If no new badge provided for this position, keep the existing one
        })
      );
    }

    // Return the paths of the newly uploaded files
    return {
      headerImagePath: headerImagePath || template.header_image_path,
      thumbnailPath: thumbnailPath || template.thumbnail_path,
      seasonalBadgePaths
    };
  } catch (error) {
    logger.error('Error updating template assets:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error
    });
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