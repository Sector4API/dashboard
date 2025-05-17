'use client';

import React, { useRef, useCallback } from 'react';
import Image from 'next/image';
import { createTemplate, getTemplates, deleteTemplate, updateTemplateAssets } from '@/lib/templates';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast-provider';
import { dashboardSupabase } from '@/lib/supabase';

export default function TemplatesPage() {
  const { addToast } = useToast();
  const [templates, setTemplates] = React.useState<{ 
    id: string; 
    name: string; 
    thumbnail_path: string; 
    is_public: boolean; 
    description?: string; 
    category?: string; 
    tags?: string[]; 
    terms_section_background_color?: string; 
    product_section_background_color?: string; 
    product_card_background_color?: string; 
    global_text_color?: string; 
    headerImage?: string; 
    seasonalBadges?: string[]; 
  }[]>([]);
  const [seasonalBadges, setSeasonalBadges] = React.useState([1, 2, 3]);
  const maxFileSize = 5 * 1024 * 1024; // 5MB in bytes
  const [isDialogOpen, setIsDialogOpen] = React.useState(false); // State for confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [templateToDelete, setTemplateToDelete] = React.useState<{ id: string; folderPath: string } | null>(null);
  const [loading, setLoading] = React.useState(false); // State for loading screen
  const [page, setPage] = React.useState(1);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [hasMoreTemplates, setHasMoreTemplates] = React.useState(true); // State to track if more templates are available
  const observer = useRef<IntersectionObserver | null>(null);
  // Add this state near other state declarations
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [editingTemplateId, setEditingTemplateId] = React.useState<string | null>(null);
  
  // Update the fetchTemplates function to ensure the spinner is completely removed when no more templates are available
  const fetchTemplates = async (page: number) => {
    setIsLoadingMore(true); // Show loading spinner for the template list
    try {
      const { data, error } = await dashboardSupabase
        .from('templates')
        .select('*')
        .range((page - 1) * 10, page * 10 - 1); // Fetch 10 templates per page

      if (error) {
        // console.error('Error fetching templates:', error);
        return;
      }

      if (!data || data.length === 0) {
        setHasMoreTemplates(false); // Indicate no more templates are available
        return;
      }

      setTemplates((prev) => (page === 1 ? data : [...prev, ...data]));
    } catch (err) {
      // console.error('Unexpected error:', err);
    } finally {
      setIsLoadingMore(false); // Hide loading spinner
    }
  };

  const lastTemplateRef = useCallback(
    (node: HTMLElement | null) => {
      if (isLoadingMore || !hasMoreTemplates) return; // Stop observing if no more templates
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          setPage((prevPage) => prevPage + 1);
        }
      });
      if (node) observer.current.observe(node);
    },
    [isLoadingMore, hasMoreTemplates]
  );

  React.useEffect(() => {
    fetchTemplates(page);
  }, [page]);

  // Add form state
  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    category: '',
    tags: '',
    terms_section_background_color: '#ffffff',
    product_section_background_color: '#ffffff', // Renamed
    product_card_background_color: '#ffffff',
    global_text_color: '#000000'
  });

  // Update file state to include preview URLs
  const [files, setFiles] = React.useState({
    headerImage: null as File | null,
    thumbnail: null as File | null,
    seasonalBadges: [] as File[],
    previews: {
      headerImage: '',
      thumbnail: '',
      seasonalBadges: [] as string[]
    }
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'headerImage' | 'thumbnail' | 'seasonalBadge',
    index?: number
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > maxFileSize) {
        alert('File size must be less than 5MB');
        e.target.value = '';
        return;
      }

      const fileURL = URL.createObjectURL(file);

      if (type === 'seasonalBadge' && typeof index === 'number') {
        setFiles(prev => {
          const newBadges = [...prev.seasonalBadges];
          const newPreviews = [...prev.previews.seasonalBadges];
          newBadges[index] = file;
          newPreviews[index] = fileURL;
          return { ...prev, seasonalBadges: newBadges, previews: { ...prev.previews, seasonalBadges: newPreviews } };
        });
      } else if (type === 'headerImage' || type === 'thumbnail') {
        setFiles(prev => ({
          ...prev,
          [type]: file,
          previews: { ...prev.previews, [type]: fileURL }
        }));
      }
    }
  };

  const handleSubmit = async () => {
    setIsDialogOpen(false);
    setLoading(true);
    try {
      // Only check for duplicate names when creating a new template
      if (!isEditMode) {
        // console.log('Checking for duplicate template name:', formData.name);
        const { data: existingTemplate, error } = await dashboardSupabase
          .from('templates')
          .select('id')
          .eq('name', formData.name)
          .maybeSingle();
  
        if (error) {
          // console.error('Error checking template name:', error);
          addToast({
            title: 'Error',
            description: 'An error occurred while checking the template name.',
            variant: 'error',
          });
          return;
        }
  
        if (existingTemplate) {
          // console.log('Duplicate template found:', existingTemplate);
          addToast({
            title: 'Error',
            description: 'A template with this name already exists. Please enter a new name.',
            variant: 'error',
          });
          return;
        }
      }
  
      // Proceed with template submission
      // console.log('handleSubmit triggered'); // Debugging log
      if (!files.headerImage || !files.thumbnail) {
        addToast({
          title: 'Error',
          description: 'Please upload header image and thumbnail',
          variant: 'error',
        });
        setLoading(false); // Hide loading screen
        return;
      }
  
      const seasonalBadgeFiles = files.seasonalBadges.filter(Boolean);
      if (seasonalBadgeFiles.length === 0) {
        addToast({
          title: 'Error',
          description: 'Please upload at least one seasonal badge',
          variant: 'error',
        });
        setLoading(false); // Hide loading screen
        return;
      }
  
      try {
        // console.log('Calling createTemplate with formData:', formData); // Debugging log
        await createTemplate({
                  ...formData,
                  tags: formData.tags.split(',').map(tag => tag.trim()),
                  headerImage: files.headerImage,
                  thumbnail: files.thumbnail,
                  seasonalBadges: seasonalBadgeFiles,
                  products_section_background_color: formData.product_section_background_color,
                  product_card_background_color: formData.product_card_background_color,
                });
  
        addToast({
          title: 'Success',
          description: 'Template created successfully!',
          variant: 'success',
        });
  
        // Reset form
        setFormData({
          name: '',
          description: '',
          category: '',
          tags: '',
          terms_section_background_color: '#ffffff',
          product_section_background_color: '#ffffff',
          product_card_background_color: '#ffffff',
          global_text_color: '#000000'
        });
        setFiles({
          headerImage: null,
          thumbnail: null,
          seasonalBadges: [],
          previews: {
            headerImage: '',
            thumbnail: '',
            seasonalBadges: []
          }
        });
        setSeasonalBadges([1, 2, 3]);
  
        // Fetch updated templates
        const updatedTemplates = await getTemplates();
        setTemplates(updatedTemplates || []);
      } catch (error) {
        // console.error('Error during template creation:', error); // Debugging log
        addToast({
          title: 'Error',
          description: 'Failed to create template',
          variant: 'error',
        });
      } finally {
        setLoading(false); // Hide loading screen
      }
    } catch (error) {
      // console.error('Unexpected error:', error);
      addToast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };
  const handleUpdate = async () => {
    if (!editingTemplateId) return;
    setLoading(true);
    try {
      // Fetch the existing template data to get the current seasonal badge paths
      const { data: existingTemplate, error: fetchError } = await dashboardSupabase
        .from('templates')
        .select('seasonal_badge_paths')
        .eq('id', editingTemplateId)
        .single();

      if (fetchError) throw fetchError;

      const existingBadgePaths = existingTemplate?.seasonal_badge_paths || [];

      // Handle file updates if new files are selected
      let updatedBadgePaths = [...existingBadgePaths];
      if (files.seasonalBadges.length > 0) {
        const newBadgePaths = await Promise.all(
          files.seasonalBadges.filter(Boolean).map(async (badge) => {
            const updatedPaths = await updateTemplateAssets(editingTemplateId, {
              headerImage: null,
              thumbnail: null,
              seasonalBadges: [badge],
            });
            return updatedPaths.seasonalBadgePaths[0];
          })
        );
        updatedBadgePaths = [...existingBadgePaths, ...newBadgePaths];
      }

      // Prepare the payload for the update
      const updatePayload = {
        description: formData.description,
        category: formData.category,
        tags: formData.tags.split(',').map(tag => tag.trim()),
        terms_section_background_color: formData.terms_section_background_color,
        product_section_background_color: formData.product_section_background_color, // Renamed
        product_card_background_color: formData.product_card_background_color,
        global_text_color: formData.global_text_color,
        seasonal_badge_paths: updatedBadgePaths,
      };

      // Log the payload for debugging
      // console.log('Payload for update:', updatePayload);

      // Update template data in the database
      const { error: updateError } = await dashboardSupabase
        .from('templates')
        .update(updatePayload)
        .eq('id', editingTemplateId);

      if (updateError) throw updateError;

      // Reset form and states
      setFormData({
        name: '',
        description: '',
        category: '',
        tags: '',
        terms_section_background_color: '#ffffff',
        product_section_background_color: '#ffffff',
        product_card_background_color: '#ffffff',
        global_text_color: '#000000',
      });
      setFiles({
        headerImage: null,
        thumbnail: null,
        seasonalBadges: [],
        previews: {
          headerImage: '',
          thumbnail: '',
          seasonalBadges: [],
        },
      });
      setIsEditMode(false);
      setEditingTemplateId(null);

      // Refresh templates list
      const updatedTemplates = await getTemplates();
      setTemplates(updatedTemplates || []);

      addToast({
        title: 'Success',
        description: 'Template updated successfully!',
        variant: 'success',
      });
    } catch (error) {
      // console.error('Error updating template:', error instanceof Error ? error.message : error);
      addToast({
        title: 'Error',
        description: 'Failed to update template. Please check the console for more details.',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // In your form's submit handler or dialog confirmation
  const handleConfirm = async () => {
    setIsDialogOpen(false);
    if (isEditMode) {
      await handleUpdate();
    } else {
      await handleSubmit();
    }
  };

  const addSeasonalBadge = () => {
    if (seasonalBadges.length < 10) {
      setSeasonalBadges([...seasonalBadges, seasonalBadges.length + 1]);
    }
  };

  const removeSeasonalBadge = (index: number) => {
    setSeasonalBadges(seasonalBadges.filter((_, i) => i !== index));
  };

  const handleDelete = async (id: string, folderPath: string) => {
    setLoading(true); // Show loading screen
    try {
      await deleteTemplate(id, folderPath);

      // Force refresh templates list
      const updatedTemplates = await getTemplates();
      setTemplates(updatedTemplates || []);

      addToast({
        title: 'Success',
        description: 'Template deleted successfully.',
        variant: 'success',
      });
    } catch (error) {
      // console.error('Error deleting template:', error);
      addToast({
        title: 'Error',
        description: 'Failed to delete template.',
        variant: 'error',
      });
    } finally {
      setLoading(false); // Hide loading screen
    }
  };

  const handlePublish = async (id: string) => {
      try {
        // Update the is_public status in the database
        const { error } = await dashboardSupabase
          .from('templates')
          .update({ is_public: true })
          .eq('id', id);
  
        if (error) throw error;
  
        // Update the local state to reflect the change
        setTemplates(prev => prev.map(template => 
          template.id === id ? { ...template, is_public: true } : template
        ));
  
        addToast({
          title: 'Success',
          description: 'Template published successfully.',
          variant: 'success',
        });
      } catch (error) {
        // console.error('Error publishing template:', error);
        addToast({
          title: 'Error',
          description: 'Failed to publish template.',
          variant: 'error',
        });
      }
    };

  const handleEdit = () => {
    // Logic to navigate to the edit page or open an edit modal
  };

  const confirmDeleteTemplate = (id: string, folderPath: string) => {
    setTemplateToDelete({ id, folderPath });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (templateToDelete) {
      setDeleteDialogOpen(false); // Hide the confirmation dialog box
      setLoading(true); // Show loading screen
      await handleDelete(templateToDelete.id, templateToDelete.folderPath);
      setTemplateToDelete(null);
    }
  };

  // Ensure environment variables are available
  const supabaseUrl = process.env.NEXT_PUBLIC_DASHBOARD_SUPABASE_URL;
  const storageBucket = process.env.NEXT_PUBLIC_DASHBOARD_SUPABASE_STORAGE_BUCKET;

  if (!supabaseUrl || !storageBucket) {
    // console.error('Missing required environment variables. Please check your .env file.');
  }

  const formatImagePath = (path: string | null): string => {
    if (!path) return '';
    const base =
      path.startsWith('http') || path.startsWith('/')
        ? path
        : `${supabaseUrl}/storage/v1/object/public/${storageBucket}/${path}`;
    return base;
  };

  return (
    <div className="container mx-auto p-6">
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        // console.log('Dialog state changed:', open); // Debugging log
        setIsDialogOpen(open);
      }}>
        <DialogContent aria-describedby="template-dialog-description">
          <DialogHeader>
            <DialogTitle>{isEditMode ? 'Confirm Template Update' : 'Confirm Template Creation'}</DialogTitle>
            <p id="template-dialog-description" className="text-sm text-gray-500">
              Are you sure you want to {isEditMode ? 'update' : 'create'} the template "{formData.name}"?
            </p>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleConfirm(); // Changed from handleSubmit() to handleConfirm()
              setIsDialogOpen(false);
            }}
          >
            <DialogFooter>
              <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
                {isEditMode ? 'Update Template' : 'Create Template'}
              </button>
              <button
                type="button"
                className="bg-gray-500 text-white px-4 py-2 rounded"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent aria-describedby="delete-dialog-description">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <p id="delete-dialog-description" className="text-sm text-gray-500">
            Are you sure you want to delete this template? This action cannot be undone.
          </p>
          <DialogFooter>
            <button
              className="rounded-lg bg-red-500 px-4 py-2.5 text-white hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              onClick={handleDeleteConfirm}
            >
              Delete
            </button>
            <button
              className="rounded-lg bg-gray-500 px-4 py-2.5 text-white hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Templates List Section */}
        <div
          className="lg:w-[60%] w-full rounded-lg bg-white p-6 shadow-md dark:bg-slate-800"
          style={{ maxHeight: '1500px', overflowY: 'auto' }} // Increased height to 1000px
          onScroll={(e) => {
            const target = e.target as HTMLElement;
            if (
              target.scrollHeight - target.scrollTop === target.clientHeight &&
              !isLoadingMore &&
              hasMoreTemplates
            ) {
              setPage((prevPage) => prevPage + 1); // Load more templates when scrolled to the bottom
            }
          }}
        >
          <h2 className="mb-6 text-2xl font-bold text-slate-800 dark:text-white">Templates List</h2>
          <div className="space-y-3">
            {templates.map((template) => (
              <div
                key={template.id}
                className="flex flex-col sm:flex-row items-center justify-between rounded-lg bg-slate-100 p-8 transition-all hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                <div className="flex items-center gap-8">
                  <div className="h-32 w-32 rounded overflow-hidden">
                    {template.thumbnail_path ? (
                      <Image
                        src={formatImagePath(template.thumbnail_path)}
                        alt={template.name}
                        width={128}
                        height={128}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-red-500"></div>
                    )}
                  </div>
                  <span className="text-xl font-bold text-slate-800 dark:text-white">{template.name}</span>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-4 mt-4 sm:mt-0">
                  <button
                    className={`rounded px-6 py-3 text-white ${template.is_public 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-green-500 hover:bg-green-600'}`}
                    onClick={() => handlePublish(template.id)}
                    disabled={template.is_public}
                  >
                    {template.is_public ? 'Published' : 'Publish'}
                  </button>
                  <button
                    className="rounded bg-blue-500 px-6 py-3 text-white hover:bg-blue-600"
                    onClick={async () => {
                      setLoading(true);
                      setIsEditMode(true);
                      setEditingTemplateId(template.id);
                      try {
                        const { data: templateDetails, error } = await dashboardSupabase
                          .from('templates')
                          .select('name, description, category, tags, terms_section_background_color, product_section_background_color, product_card_background_color, global_text_color, header_image_path, thumbnail_path, seasonal_badge_paths')
                          .eq('id', template.id)
                          .single();
                    
                        if (error) {
                          // console.error('Error fetching template details:', error);
                          addToast({
                            title: 'Error',
                            description: 'Failed to fetch template details.',
                            variant: 'error',
                          });
                          return;
                        }
                    
                        // Add cache-busting query param to force fresh fetch from backend
                        const cacheBuster = `?t=${Date.now()}`;
                        const formatImagePath = (path: string | null): string => {
                          if (!path) return '';
                          const base =
                            path.startsWith('http') || path.startsWith('/')
                              ? path
                              : `${process.env.NEXT_PUBLIC_DASHBOARD_SUPABASE_URL}/storage/v1/object/public/${process.env.NEXT_PUBLIC_DASHBOARD_SUPABASE_STORAGE_BUCKET}/${path}`;
                          // Append cache buster
                          return base + cacheBuster;
                        };
                    
                        setFormData({
                          name: templateDetails.name,
                          description: templateDetails.description || '',
                          category: templateDetails.category || '',
                          tags: templateDetails.tags?.join(', ') || '',
                          terms_section_background_color: templateDetails.terms_section_background_color || '#ffffff',
                          product_section_background_color: templateDetails.product_section_background_color || '#ffffff',
                          product_card_background_color: templateDetails.product_card_background_color || '#ffffff',
                          global_text_color: templateDetails.global_text_color || '#000000',
                        });
                    
                        setFiles({
                          headerImage: null,
                          thumbnail: null,
                          seasonalBadges: [],
                          previews: {
                            headerImage: formatImagePath(templateDetails.header_image_path),
                            thumbnail: formatImagePath(templateDetails.thumbnail_path),
                            seasonalBadges: templateDetails.seasonal_badge_paths?.map(formatImagePath) || [],
                          },
                        });
                      } catch (err) {
                        // console.error('Unexpected error:', err);
                        addToast({
                          title: 'Error',
                          description: 'An unexpected error occurred.',
                          variant: 'error',
                        });
                      } finally {
                        setLoading(false); // Hide loading screen
                      }
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="rounded bg-red-500 px-6 py-3 text-white hover:bg-red-600"
                    onClick={() => confirmDeleteTemplate(template.id, template.thumbnail_path)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {isLoadingMore && (
              <div className="flex justify-center py-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Loading more templates...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Create/Update Template Form Section */}
        <div className="lg:w-[40%] w-full rounded-lg bg-white p-6 shadow-md dark:bg-slate-800">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
              {isEditMode ? 'Update Template' : 'Create Template'}
            </h2>
            {isEditMode && (
              <button
                className="text-sm text-red-500 hover:text-red-600 focus:outline-none"
                onClick={() => {
                  setIsEditMode(false);
                  setEditingTemplateId(null);
                  setFormData({
                    name: '',
                    description: '',
                    category: '',
                    tags: '',
                    terms_section_background_color: '#ffffff',
                    product_section_background_color: '#ffffff',
                    product_card_background_color: '#ffffff',
                    global_text_color: '#000000',
                  });
                  setFiles({
                    headerImage: null,
                    thumbnail: null,
                    seasonalBadges: [],
                    previews: {
                      headerImage: '',
                      thumbnail: '',
                      seasonalBadges: [],
                    },
                  });
                }}
              >
                Cancel
              </button>
            )}
          </div>
          <form className="space-y-6">
            {/* Basic Information */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Name of template:</label>
                <input 
                  type="text" 
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  readOnly={isEditMode}
                  className={isEditMode ? "w-full rounded-lg border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-blue-500" :"w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700" }
                  placeholder="Name"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Category:</label>
                <input 
                  type="text" 
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700" 
                  placeholder="Category"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Description:</label>
              <textarea
              name="description"
                value={formData.description}
                onChange={handleInputChange} 
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700" 
                placeholder="Description"
                rows={4}
              />
            </div>

            {/* Image Uploads */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Header Image:</label>
                <div className="flex w-full items-center justify-center relative">
                  <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600">
                    {files.previews.headerImage && (
                      <Image
                        src={files.previews.headerImage}
                        alt="Header Preview"
                        width={128}
                        height={128}
                        className="absolute inset-0 h-full w-full object-cover rounded-lg"
                      />
                    )}
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg className="mb-3 h-10 w-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">Click to upload</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Max size: 5MB</p>
                    </div>
                    <input 
                      type="file" 
                      className='hidden'
                      onChange={(e) => handleFileChange(e, 'headerImage')}
                      accept="image/*"
                      required
                    />
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Thumbnail:</label>
                <div className="flex w-full items-center justify-center relative">
                  <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600">
                    {files.previews.thumbnail && (
                      <Image
                        src={files.previews.thumbnail}
                        alt="Thumbnail Preview"
                        width={128}
                        height={128}
                        className="absolute inset-0 h-full w-full object-cover rounded-lg"
                      />
                    )}
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg className="mb-3 h-10 w-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">Click to upload</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Max size: 5MB</p>
                    </div>
                    <input 
                      type="file" 
                      className='hidden'
                      onChange={(e) => handleFileChange(e, 'thumbnail')}
                      accept="image/*"
                      required
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Seasonal Badge */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Seasonal badge:</label>
              <div className="flex items-center gap-3">
                <input 
                  type="number" 
                  className="w-24 rounded-lg border border-slate-300 bg-white px-4 py-2.5 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700" 
                  value={seasonalBadges.length} 
                  readOnly
                />
                <button 
                  type="button" 
                  className="rounded-lg bg-blue-500 px-4 py-2.5 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  onClick={addSeasonalBadge}
                >
                  +
                </button>
              </div>
              <div className="space-y-3">
                {seasonalBadges.map((_, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600">
                        {files.previews.seasonalBadges[index] && (
                          <Image
                            src={files.previews.seasonalBadges[index]}
                            alt={`Seasonal Badge Preview ${index + 1}`}
                            width={128}
                            height={128}
                            className="absolute inset-0 h-full w-full object-cover rounded-lg"
                          />
                        )}
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <svg className="mb-3 h-10 w-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">Click to upload</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Max size: 5MB</p>
                        </div>
                        <input 
                          type="file" 
                          className="hidden" 
                          onChange={(e) => handleFileChange(e, 'seasonalBadge', index)} 
                          accept="image/*" 
                        />
                      </label>
                    </div>
                    <button 
                      type="button" 
                      className="rounded-lg bg-red-500 px-4 py-2.5 text-white hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                      onClick={() => removeSeasonalBadge(index)}
                    >
                      -
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Tags:</label>
              <input 
                type="text" 
                name="tags"
                value={formData.tags}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700" 
                placeholder="Add tags separated by commas"
                required
              />
            </div>

            {/* Color Pickers */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Terms section color:</label>
                <input 
                  type="color" 
                  name="terms_section_background_color"
                  value={formData.terms_section_background_color}
                  onChange={handleInputChange}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-600 dark:bg-slate-700" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Product section color:</label>
                <input 
                  type="color" 
                  name="product_section_background_color"
                  value={formData.product_section_background_color}
                  onChange={handleInputChange}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-600 dark:bg-slate-700" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Product background color:</label>
                <input 
                  type="color" 
                  name="product_card_background_color"
                  value={formData.product_card_background_color}
                  onChange={handleInputChange}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-600 dark:bg-slate-700" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Global text color:</label>
                <input 
                  type="color" 
                  name="global_text_color"
                  value={formData.global_text_color}
                  onChange={handleInputChange}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-600 dark:bg-slate-700" 
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              {/* Dialog Wrapper */}
              <Dialog open={isDialogOpen} onOpenChange={(open) => setIsDialogOpen(open)}>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="w-full rounded-lg bg-blue-500 px-4 py-2.5 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    {isEditMode ? 'Update Template' : 'Create Template'}
                  </button>
                </DialogTrigger>
                
              </Dialog>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
