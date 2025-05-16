import { dashboardSupabase } from './supabase';

type TemplateInput = {
  name: string;
  description: string;
  category: string;
  headerImage: File;
  thumbnail: File;
  seasonalBadges: File[];
  tags: string[];
  isPublic?: boolean;
  terms_section_background_color: string;
  products_section_background_color: string;
  product_section_background_color: string; // Renamed
  product_card_background_color: string;
  global_text_color: string;
};

/* eslint-disable no-console */
type LogMessage = {
  message: string;
  details?: unknown;
  stack?: string;
  cause?: unknown;
  code?: string;
  hint?: string;
};

// Logger implementation
const logger = {
  error: (message: string, error?: LogMessage) => {
    if (process.env.NODE_ENV !== 'production') {
      console.error(message, error)
    }
    // In production, you might want to use a proper logging service
  },
  info: (message: string, data?: LogMessage) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(message, data)
    }
  }
};

export const createTemplate = async (input: TemplateInput) => {
  try {
    const folderName = input.name.toLowerCase().replace(/\s+/g, '-');
    const storageBucket = process.env.NEXT_PUBLIC_DASHBOARD_SUPABASE_STORAGE_BUCKET;
    if (!storageBucket) {
      throw new Error('Storage bucket name not found in environment variables. Please check NEXT_PUBLIC_DASHBOARD_SUPABASE_STORAGE_BUCKET in .env file');
    }

    // Upload header image
    const headerPath = `${folderName}/${input.headerImage.name}`;
    await dashboardSupabase.storage
      .from(storageBucket)
      .upload(headerPath, input.headerImage);

    // Upload thumbnail
    const thumbnailPath = `${folderName}/${input.thumbnail.name}`;
    await dashboardSupabase.storage
      .from(storageBucket)
      .upload(thumbnailPath, input.thumbnail);

    // Upload seasonal badges
    const badgePaths = await Promise.all(
      input.seasonalBadges.map(async (badge) => {
        const badgePath = `${folderName}/${badge.name}`;
        await dashboardSupabase.storage
          .from(storageBucket)
          .upload(badgePath, badge);
        return badgePath;
      })
    );

    // Create template record in database with exact column names from the table
    const templateData = {
      name: input.name,
      description: input.description,
      category: input.category,
      header_image_path: headerPath,
      thumbnail_path: thumbnailPath,
      seasonal_badge_paths: badgePaths,
      tags: Array.isArray(input.tags) ? input.tags : [],
      is_public: Boolean(input.isPublic ?? false),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      terms_section_background_color: input.terms_section_background_color,
      products_section_background_color: input.products_section_background_color,
      product_section_background_color: input.product_section_background_color, // Renamed
      product_card_background_color: input.product_card_background_color,
      global_text_color: input.global_text_color
    };

    // Create a logger utility
    /* eslint-disable no-console */
    // Add this at the top of the file
    type LogMessage = {
      message: string;
      details?: unknown;
      stack?: string;
      cause?: unknown;
      code?: string;
      hint?: string;
    };
    
    // Update the logger implementation
    const logger = {
      error: (message: string, error?: LogMessage) => {
        if (process.env.NODE_ENV !== 'production') {
          console.error(message, error)
        }
        // In production, you might want to use a proper logging service
      },
      info: (message: string, data?: LogMessage) => {
        if (process.env.NODE_ENV !== 'production') {
          console.log(message, data)
        }
      }
    };

    // Then replace all console.log/error calls with logger
    logger.info('Attempting to insert template with data:', { message: 'Template Data', details: templateData });

    const { data, error } = await dashboardSupabase
      .from('templates')
      .insert(templateData)
      .select()
      .single();

    if (error) {
      logger.error('Database insert error:', {
        message: 'Database Error',
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }

    return data;
  } catch (error) {
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
      .select('id, name, thumbnail_path, is_public');

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
  seasonalBadges: File[];
}) => {
  try {
    const storageBucket = process.env.NEXT_PUBLIC_DASHBOARD_SUPABASE_STORAGE_BUCKET;
    if (!storageBucket) {
      throw new Error('Storage bucket name not found in environment variables.');
    }

    // Get the template's current folder name
    const { data: template, error: templateError } = await dashboardSupabase
      .from('templates')
      .select('name')
      .eq('id', templateId)
      .single();

    if (templateError) throw templateError;

    const folderName = template.name.toLowerCase().replace(/\s+/g, '-');
    let headerImagePath = null;
    let thumbnailPath = null;
    let seasonalBadgePaths: string[] = [];

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
      seasonalBadgePaths = await Promise.all(
        files.seasonalBadges.map(async (badge) => {
          const badgePath = `${folderName}/${badge.name}`;
          await dashboardSupabase.storage
            .from(storageBucket)
            .upload(badgePath, badge, { upsert: true });
          return badgePath;
        })
      );
    }

    // Only return the paths if new files were uploaded, otherwise return null for those fields
    return {
      headerImagePath: headerImagePath,
      thumbnailPath: thumbnailPath,
      seasonalBadgePaths: seasonalBadgePaths
    };
  } catch (error) {
    logger.error('Error updating template assets:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error
    });
    throw error;
  }
};