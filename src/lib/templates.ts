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
  product_card_background_color: string;
  global_text_color: string;
};

export const createTemplate = async (input: TemplateInput) => {
  try {
    // Format folder name: convert to lowercase and replace spaces with hyphens
    const folderName = input.name.toLowerCase().replace(/\s+/g, '-');
      const storageBucket = process.env.NEXT_PUBLIC_DASHBOARD_SUPABASE_STORAGE_BUCKET;
    if (!storageBucket) {
      throw new Error('Storage bucket name not found in environment variables. Please check NEXT_PUBLIC_DASHBOARD_SUPABASE_STORAGE_BUCKET in .env file');
    }

    // Upload header image
    const headerExt = input.headerImage.name.split('.').pop();
    const headerPath = `${folderName}/header.${headerExt}`;
    await dashboardSupabase.storage
      .from(storageBucket)
      .upload(headerPath, input.headerImage);

    // Upload thumbnail
    const thumbExt = input.thumbnail.name.split('.').pop();
    const thumbnailPath = `${folderName}/thumb.${thumbExt}`;
    await dashboardSupabase.storage
      .from(storageBucket)
      .upload(thumbnailPath, input.thumbnail);

    // Upload seasonal badges
    const badgePaths = await Promise.all(
      input.seasonalBadges.map(async (badge, index) => {
        const badgeExt = badge.name.split('.').pop();
        const badgePath = `${folderName}/badge${index + 1}.${badgeExt}`;
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
      product_card_background_color: input.product_card_background_color,
      global_text_color: input.global_text_color
    };

    // Create a logger utility
    const logger = {
      error: (message: string, error?: any) => {
        if (process.env.NODE_ENV !== 'production') {
          console.error(message, error)
        }
        // In production, you might want to use a proper logging service
      },
      info: (message: string, data?: any) => {
        if (process.env.NODE_ENV !== 'production') {
          console.log(message, data)
        }
      }
    }

    // Then replace all console.log/error calls with logger
    logger.info('Attempting to insert template with data:', templateData)

    const { data, error } = await dashboardSupabase
      .from('templates')
      .insert(templateData)
      .select()
      .single();

    if (error) {
      console.error('Database insert error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        data: templateData
      });
      throw error;
    }

    return data;
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error creating template:', {
        message: error.message,
        stack: error.stack,
        cause: error.cause
      });
    } else {
      console.error('Error creating template:', error);
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
      console.error('Error fetching templates:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in getTemplates:', error);
    throw error;
  }
};

export const deleteTemplate = async (id: string, folderPath: string) => {
  try {
    const storageBucket = process.env.NEXT_PUBLIC_DASHBOARD_SUPABASE_STORAGE_BUCKET;
    if (!storageBucket) {
      throw new Error('Storage bucket name not found in environment variables.');
    }

    // Extract the folder name from the file path
    const folderName = folderPath.split('/')[0];
    console.log('Attempting to delete folder:', folderName);

    // List all files in the folder
    const { data: files, error: listError } = await dashboardSupabase
      .storage
      .from(storageBucket)
      .list(folderName);

    if (listError) {
      console.error('Error listing files in folder:', listError);
      throw listError;
    }

    if (files && files.length > 0) {
      const filePaths = files.map(file => `${folderName}/${file.name}`);
      console.log('Files to delete:', filePaths);

      // Delete all files in the folder
      const { error: deleteFilesError } = await dashboardSupabase
        .storage
        .from(storageBucket)
        .remove(filePaths);

      if (deleteFilesError) {
        console.error('Error deleting files in folder:', deleteFilesError);
        throw deleteFilesError;
      }
    } else {
      console.log('No files found in folder to delete.');
    }

    // Attempt to delete the folder itself
    const { error: deleteFolderError } = await dashboardSupabase
      .storage
      .from(storageBucket)
      .remove([folderName]);

    if (deleteFolderError) {
      console.error('Error deleting folder:', deleteFolderError);
      throw deleteFolderError;
    } else {
      console.log('Folder deleted successfully:', folderName);
    }

    // Delete the template record from the database
    const { error: dbError } = await dashboardSupabase
      .from('templates')
      .delete()
      .eq('id', id);

    if (dbError) {
      console.error('Error deleting template from database:', dbError);
      throw dbError;
    }
  } catch (error) {
    console.error('Error in deleteTemplate:', error);
    throw error;
  }
};