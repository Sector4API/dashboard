'use client';

import * as React from 'react';
import Image from 'next/image';
import { createTemplate, getTemplates, deleteTemplate, updateTemplateAssets, updateTemplateOrder } from '@/lib/templates';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast-provider';
import { dashboardSupabase } from '@/lib/supabase';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

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
    badge_position?: {
      x: number;
      y: number;
      rotation: number;
    };
    display_order: number;
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
  const observer = React.useRef<IntersectionObserver | null>(null);
  // Add this state near other state declarations
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [editingTemplateId, setEditingTemplateId] = React.useState<string | null>(null);
  
  const categories = [
    "Supermarket",
    "Grocery",
    "Bakery",
    "Electronics",
    "Furniture",
    "Fashion",
    "Textiles",
    "Stationery",
    "Home & Cleaning",
    "Personal Care",
    "Jewellery",
    "Trending",
    "New Arrivals",
    "Best Picks",
    "Festival",
    "Weekend Offer",
    "Combo Offer",
    "Limited Time"
  ];

  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    category: [] as string[],
    tags: '',
    terms_section_background_color: '#ffffff',
    product_section_background_color: '#ffffff',
    product_card_background_color: '#ffffff',
    global_text_color: '#000000'
  });

  const [openCategory, setOpenCategory] = React.useState(false);

  const handleCategoryChange = React.useCallback((value: string) => {
    setFormData(prev => {
      const newCategories = prev.category.includes(value)
        ? prev.category.filter(c => c !== value)
        : [...prev.category, value];
      
      // Convert categories to tags
      const existingTags = prev.tags.split(',')
        .map(tag => tag.trim())
        .filter(tag => tag !== '' && !prev.category.includes(tag));
      
      // Combine existing non-category tags with new categories
      const newTags = [...existingTags, ...newCategories].join(', ');
      
      return {
        ...prev,
        category: newCategories,
        tags: newTags
      };
    });
  }, []);

  // Update the fetchTemplates function to ensure the spinner is completely removed when no more templates are available
  // Remove unused lastTemplateRef variable since it's not being used
  const fetchTemplates = async (page: number) => {
    setIsLoadingMore(true);
    try {
      const { data, error } = await dashboardSupabase
        .from('templates')
        .select('*')
        .order('display_order', { ascending: true });
  
      if (error) {
        addToast({
          title: 'Error',
          description: 'Failed to fetch templates',
          variant: 'error',
        });
        return;
      }
  
      if (!data || data.length === 0) {
        setHasMoreTemplates(false);
        setTemplates([]);
        return;
      }
  
      // Set all templates at once instead of paginating
      setTemplates(data);
      setHasMoreTemplates(false); // Disable infinite scroll since we're loading all at once
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'An unexpected error occurred while fetching templates',
        variant: 'error',
      });
    } finally {
      setIsLoadingMore(false);
    }
  };

  const lastTemplateRef = React.useCallback(
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

  // Update file state to include preview URLs
  const [files, setFiles] = React.useState({
    headerImage: null as File | null,
    thumbnail: null as File | null,
    seasonalBadges: [] as (File | null)[],
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
        alert('File size must be less than 10MB');
        e.target.value = '';
        return;
      }

      const fileURL = URL.createObjectURL(file);

      if (type === 'seasonalBadge' && typeof index === 'number') {
        setFiles(prev => {
          const newBadges = [...prev.seasonalBadges];
          const newPreviews = [...prev.previews.seasonalBadges];
          
          // Ensure arrays are long enough
          while (newBadges.length <= index) {
            newBadges.push(null);
            newPreviews.push('');
          }
          
          newBadges[index] = file;
          newPreviews[index] = fileURL;
          
          return {
            ...prev,
            seasonalBadges: newBadges,
            previews: { ...prev.previews, seasonalBadges: newPreviews }
          };
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
      // Validate categories
      if (formData.category.length === 0) {
        addToast({
          title: 'Error',
          description: 'Please select at least one category',
          variant: 'error',
        });
        setLoading(false);
        return;
      }

      // Only check for duplicate names when creating a new template
      if (!isEditMode) {
        const { data: existingTemplate, error } = await dashboardSupabase
          .from('templates')
          .select('id')
          .eq('name', formData.name)
          .maybeSingle();

        if (error) {
          addToast({
            title: 'Error',
            description: 'An error occurred while checking the template name.',
            variant: 'error',
          });
          return;
        }

        if (existingTemplate) {
          addToast({
            title: 'Error',
            description: 'A template with this name already exists.',
            variant: 'error',
          });
          return;
        }
      }

      const seasonalBadgeFiles = files.seasonalBadges.filter(Boolean);
      if (seasonalBadgeFiles.length === 0) {
        addToast({
          title: 'Error',
          description: 'Please upload at least one seasonal badge',
          variant: 'error',
        });
        setLoading(false);
        return;
      }

      try {
        const baseData = {
          ...formData,
          tags: formData.tags.split(',').map(tag => tag.trim()),
          product_section_background_color: formData.product_section_background_color,
          product_card_background_color: formData.product_card_background_color,
          badge_position: {
            x: 50,
            y: 50,
            rotation: 0
          }
        };

        // Create template with required files
        await createTemplate({
          ...baseData,
          headerImage: files.headerImage as File,
          thumbnail: files.thumbnail as File,
          seasonalBadges: seasonalBadgeFiles.filter(Boolean) as File[]
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
          category: [],
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
        console.error('Error during template creation:', error);
        addToast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to create template',
          variant: 'error',
        });
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      addToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    setLoading(true);
    try {
      if (!editingTemplateId) return;

      // Update template data including badge position
      const { error: updateError } = await dashboardSupabase
        .from('templates')
        .update({
          ...formData,
          tags: formData.tags.split(',').map(tag => tag.trim()),
          badge_position: {
            x: badgePosition.x,
            y: badgePosition.y,
            rotation: badgeRotation
          }
        })
        .eq('id', editingTemplateId);

      if (updateError) throw updateError;

      // Update assets if changed
      if (files.headerImage || files.thumbnail || files.seasonalBadges.length > 0) {
        await updateTemplateAssets(editingTemplateId, {
          headerImage: files.headerImage,
          thumbnail: files.thumbnail,
          seasonalBadges: files.seasonalBadges,
          replaceExisting: true
        });
      }

      // Reset states and fetch updated templates
      setIsEditMode(false);
      setEditingTemplateId(null);
      const updatedTemplates = await getTemplates();
      setTemplates(updatedTemplates || []);

      addToast({
        title: 'Success',
        description: 'Template updated successfully!',
        variant: 'success',
      });
    } catch (error) {
      console.error('Error updating template:', error);
      addToast({
        title: 'Error',
        description: 'Failed to update template',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // Add effect to load badge position when editing template
  React.useEffect(() => {
    if (editingTemplateId && templates.length > 0) {
      const template = templates.find(t => t.id === editingTemplateId);
      if (template?.badge_position) {
        setBadgePosition({
          x: template.badge_position.x,
          y: template.badge_position.y
        });
        setBadgeRotation(template.badge_position.rotation);
      } else {
        // Reset to default position if no saved position
        setBadgePosition({ x: 50, y: 50 });
        setBadgeRotation(0);
      }
    }
  }, [editingTemplateId, templates]);

  // Update position handlers to trigger template update
  const handlePositionChange = (newPosition: { x: number; y: number }) => {
    setBadgePosition(newPosition);
    if (editingTemplateId) {
      dashboardSupabase
        .from('templates')
        .update({
          badge_position: {
            x: newPosition.x,
            y: newPosition.y,
            rotation: badgeRotation
          }
        })
        .eq('id', editingTemplateId)
        .then(({ error }) => {
          if (error) {
            console.error('Error updating badge position:', error);
          }
        });
    }
  };

  const handleRotationChange = (newRotation: number) => {
    setBadgeRotation(newRotation);
    if (editingTemplateId) {
      dashboardSupabase
        .from('templates')
        .update({
          badge_position: {
            x: badgePosition.x,
            y: badgePosition.y,
            rotation: newRotation
          }
        })
        .eq('id', editingTemplateId)
        .then(({ error }) => {
          if (error) {
            console.error('Error updating badge rotation:', error);
          }
        });
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
    // Update seasonalBadges state
    setSeasonalBadges(seasonalBadges.filter((_, i) => i !== index));
    
    // Update files state
    setFiles(prev => {
      const newBadges = [...prev.seasonalBadges];
      const newPreviews = [...prev.previews.seasonalBadges];
      
      // Remove the file and preview at the specified index
      newBadges.splice(index, 1);
      newPreviews.splice(index, 1);
      
      return {
        ...prev,
        seasonalBadges: newBadges,
        previews: {
          ...prev.previews,
          seasonalBadges: newPreviews
        }
      };
    });
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

  const handleEdit = async (templateId: string) => {
    setLoading(true);
    setIsEditMode(true);
    setEditingTemplateId(templateId);
    try {
      const { data: templateDetails, error } = await dashboardSupabase
        .from('templates')
        .select('name, description, category, tags, terms_section_background_color, product_section_background_color, product_card_background_color, global_text_color, header_image_path, thumbnail_path, seasonal_badge_paths')
        .eq('id', templateId)
        .single();
  
      if (error) {
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
        category: templateDetails.category || [],
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
      addToast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
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

  const CategorySelect = () => {
    const [searchQuery, setSearchQuery] = React.useState("");

    const filteredCategories = React.useMemo(() => {
      if (!searchQuery) return categories;
      const search = searchQuery.toLowerCase();
      return categories.filter(category => 
        category.toLowerCase().includes(search)
      );
    }, [searchQuery]);

    return (
      <div className="relative w-full">
        <Popover open={openCategory} onOpenChange={setOpenCategory}>
          <PopoverTrigger asChild>
            <div 
              className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-700 cursor-pointer"
              onClick={() => setOpenCategory(true)}
            >
              <div className="flex flex-wrap gap-2">
                {formData.category.map((selectedCategory) => (
                  <div
                    key={selectedCategory}
                    className="flex items-center gap-1 bg-slate-100 pr-1 text-sm dark:bg-slate-600"
                  >
                    <span className="px-2 py-1">{selectedCategory}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCategoryChange(selectedCategory);
                      }}
                      className="hover:bg-slate-200 dark:hover:bg-slate-500 rounded"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {formData.category.length === 0 && (
                  <span className="text-sm text-slate-500">Select categories...</span>
                )}
              </div>
            </div>
          </PopoverTrigger>
          <PopoverContent 
            className="w-[300px] p-0" 
            align="start"
            side="bottom"
            sideOffset={5}
          >
            <Command shouldFilter={false} className="rounded-lg border border-slate-200">
              <CommandInput 
                placeholder="Search categories..." 
                className="h-9 border-b border-slate-200"
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <div className="max-h-[200px] overflow-y-auto p-1">
                {filteredCategories.length === 0 ? (
                  <div className="py-6 text-center text-sm">No category found.</div>
                ) : (
                  filteredCategories.map((category) => (
                    <div
                      key={category}
                      role="option"
                      aria-selected={formData.category.includes(category)}
                      className="flex items-center px-2 py-1.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                      onClick={() => {
                        handleCategoryChange(category);
                        setOpenCategory(true); // Keep dropdown open
                      }}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <div 
                          className={cn(
                            "flex h-4 w-4 items-center justify-center rounded border",
                            formData.category.includes(category) 
                              ? "border-blue-500 bg-blue-500" 
                              : "border-slate-300"
                          )}
                        >
                          {formData.category.includes(category) && (
                            <Check className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <span>{category}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    );
  };

  // Add new state for badge position
  const [badgePosition, setBadgePosition] = React.useState({ x: 50, y: 50 }); // Center position in percentage
  const [isDragging, setIsDragging] = React.useState(false);
  const badgeRef = React.useRef<HTMLDivElement>(null);

  // Add drag handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDrag = (e: React.MouseEvent) => {
    if (!isDragging || !badgeRef.current) return;
    
    const previewBox = badgeRef.current.parentElement?.getBoundingClientRect();
    if (!previewBox) return;

    const x = ((e.clientX - previewBox.left) / previewBox.width) * 100;
    const y = ((e.clientY - previewBox.top) / previewBox.height) * 100;

    const constrainedX = Math.max(5, Math.min(95, x));
    const constrainedY = Math.max(5, Math.min(95, y));

    handlePositionChange({ x: constrainedX, y: constrainedY });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // Add event listeners for drag outside the badge
  React.useEffect(() => {
    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        e.preventDefault();
        handleDrag(e as unknown as React.MouseEvent);
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isDragging]);

  // Add rotation state
  const [badgeRotation, setBadgeRotation] = React.useState(0);
  
  // Add rotation control function
  const handleRotation = (direction: 'clockwise' | 'counterclockwise') => {
    setBadgeRotation(prev => {
      const change = direction === 'clockwise' ? 15 : -15;
      return (prev + change) % 360;
    });
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
    
    if (dragIndex === dropIndex) return;

    const newTemplates = [...templates];
    const [draggedTemplate] = newTemplates.splice(dragIndex, 1);
    newTemplates.splice(dropIndex, 0, draggedTemplate);

    // Calculate new display orders
    const updatedTemplates = newTemplates.map((template, index) => ({
      ...template,
      display_order: index + 1 // Start from 1 to maintain consistency with database
    }));

    // Optimistically update the UI
    setTemplates(updatedTemplates);

    try {
      // Update the dragged template's order
      await updateTemplateOrder(draggedTemplate.id, dropIndex + 1);

      // Fetch fresh data to ensure consistency
      const freshTemplates = await getTemplates();
      if (freshTemplates) {
        setTemplates(freshTemplates);
      }

      addToast({
        title: 'Success',
        description: 'Template order updated successfully.',
        variant: 'success',
      });
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to update template order.',
        variant: 'error',
      });
      // Revert to original order on error
      const originalTemplates = await getTemplates();
      setTemplates(originalTemplates || []);
    }
  };

  return (
    <>
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
              Are you sure you want to {isEditMode ? 'update' : 'create'} the template `&quot;`{formData.name}`&quot;`?
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
          className="lg:w-[50%] w-full rounded-lg bg-white p-6 shadow-md dark:bg-slate-800"
          style={{ maxHeight: '1900px', overflowY: 'auto' }}
        >
          <h2 className="mb-6 text-2xl font-bold text-slate-800 dark:text-white">Templates List</h2>
          <div className="space-y-3">
            {templates.map((template, index) => {
              // Ensure we have a unique key by combining id with index
              const uniqueKey = `${template.id}-${index}`;
              return (
                <div
                  key={uniqueKey}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className="flex flex-col sm:flex-row items-center justify-between rounded-lg bg-slate-100 p-8 transition-all hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 cursor-move"
                >
                  <div className="flex items-center gap-8">
                    <GripVertical className="h-6 w-6 text-slate-400" />
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
                      onClick={() => handleEdit(template.id)}
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
              );
            })}
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
        <div className="lg:w-[50%] w-full rounded-lg bg-white p-6 shadow-md dark:bg-slate-800">
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
                    category: [],
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
                <label className="text-sm font-medium">Categories</label>
                <CategorySelect />
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

            {/* Preview Window */}
            <div className="space-y-3 mt-6">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Template Preview:</label>
              <div className="w-full h-[400px] rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-700 overflow-hidden relative">
                {/* Header Image Preview */}
                <div className="w-full h-full relative">
                  {files.previews.headerImage ? (
                    <Image
                      src={files.previews.headerImage}
                      alt="Header Preview"
                      layout="fill"
                      objectFit="cover"
                      className="rounded-lg"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-200 dark:bg-slate-600">
                      <p className="text-sm text-slate-500 dark:text-slate-400">Header Image Preview</p>
                    </div>
                  )}
                </div>
                
                {/* Draggable Seasonal Badge Preview */}
                {files.previews.seasonalBadges[0] && (
                  <div
                    ref={badgeRef}
                    className="absolute w-16 h-16 rounded-full overflow-hidden border-2 border-white cursor-move"
                    style={{
                      left: `${badgePosition.x}%`,
                      top: `${badgePosition.y}%`,
                      transform: `translate(-50%, -50%) rotate(${badgeRotation}deg)`,
                      cursor: isDragging ? 'grabbing' : 'grab'
                    }}
                  >
                    <Image
                      src={files.previews.seasonalBadges[0]}
                      alt="First Seasonal Badge"
                      layout="fill"
                      objectFit="cover"
                      draggable={false}
                    />
                  </div>
                )}
              </div>

              {/* Position and Rotation Controls */}
              {files.previews.seasonalBadges[0] && (
                <div className="flex flex-col gap-2 mt-2">
                  {/* Position Display */}
                  <div className="flex items-center gap-4 p-3 bg-slate-100 rounded-lg dark:bg-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">X:</span>
                      <span className="px-2 py-1 bg-white rounded dark:bg-slate-600 text-sm">
                        {Math.round(badgePosition.x)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Y:</span>
                      <span className="px-2 py-1 bg-white rounded dark:bg-slate-600 text-sm">
                        {Math.round(badgePosition.y)}%
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePositionChange({ x: 50, y: 50 })}
                      className="ml-auto text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Reset Position
                    </button>
                  </div>

                  {/* Rotation Controls */}
                  <div className="flex items-center gap-4 p-3 bg-slate-100 rounded-lg dark:bg-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Rotation:</span>
                      <span className="px-2 py-1 bg-white rounded dark:bg-slate-600 text-sm">
                        {badgeRotation}°
                      </span>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        type="button"
                        onClick={() => handleRotationChange((badgeRotation - 15 + 360) % 360)}
                        className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
                        title="Rotate Counterclockwise"
                      >
                        -15°
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRotationChange((badgeRotation + 15) % 360)}
                        className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
                        title="Rotate Clockwise"
                      >
                        +15°
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRotationChange(0)}
                        className="ml-2 text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Reset Rotation
                      </button>
                    </div>
                  </div>
                </div>
              )}
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
              <button
                type="button"
                className="w-full rounded-lg bg-blue-500 px-4 py-2.5 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                onClick={() => setIsDialogOpen(true)}
              >
                {isEditMode ? 'Update Template' : 'Create Template'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
