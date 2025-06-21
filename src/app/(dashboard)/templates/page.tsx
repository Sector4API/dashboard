'use client';

import * as React from 'react';
import Image from 'next/image';
import { createTemplate, getTemplates, deleteTemplate, updateTemplateAssets, updateTemplateOrder, updateAllTemplateOrders, handleTemplateUpdate } from '@/lib/templates';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast-provider';
import { dashboardSupabase } from '@/lib/supabase';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, GripVertical, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { debounce } from 'lodash';

interface BadgePosition {
  x: number;
  y: number;
  rotation: number;
  scale: number;
}

interface PreviewUrls {
  [key: string]: string;
}

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
      scale: number;
    };
    display_order: number;
    created_at: string;
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
  const [searchQuery, setSearchQuery] = React.useState('');
  const [allTemplates, setAllTemplates] = React.useState<typeof templates>([]);
  
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

  const [previewUrls, setPreviewUrls] = React.useState<PreviewUrls>({});
  const previewUrlsRef = React.useRef<PreviewUrls>({});

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

  // Add this function to handle search
  const handleSearch = React.useCallback((query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setTemplates(allTemplates);
      return;
    }
    
    const filteredTemplates = allTemplates.filter(template => 
      template.name.toLowerCase().includes(query.toLowerCase())
    );
    setTemplates(filteredTemplates);
  }, [allTemplates]);

  // Modify the fetchTemplates function
  const fetchTemplates = async (page: number) => {
    setIsLoadingMore(true);
    try {
      const data = await getTemplates();
  
      if (!data || data.length === 0) {
        setHasMoreTemplates(false);
        setTemplates([]);
        setAllTemplates([]);
        return;
      }
  
      setTemplates(data);
      setAllTemplates(data); // Store all templates
      setHasMoreTemplates(false);
    } catch (error) {
      console.error('Template fetch error:', error);
      addToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An unexpected error occurred while fetching templates',
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

  // Update file state to include date image
  const [files, setFiles] = React.useState<{
    headerImage: File | null;
    thumbnail: File | null;
    dateImage: File | null;
    seasonalBadges: (File | null)[];
    previews: {
      headerImage: string;
      thumbnail: string;
      dateImage: string;
      seasonalBadges: string[];
    };
  }>({
    headerImage: null,
    thumbnail: null,
    dateImage: null,
    seasonalBadges: [],
    previews: {
      headerImage: '',
      thumbnail: '',
      dateImage: '',
      seasonalBadges: []
    }
  });

  const validateImageDimensions = async (file: File, type: 'headerImage' | 'thumbnail' | 'dateImage' | 'seasonalBadge'): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = document.createElement('img');
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const { width, height } = img;

        switch (type) {
          case 'headerImage':
            resolve(width <= 3661 && height <= 2059);
            break;
          case 'thumbnail':
            resolve(width <= 1100 && height <= 830);
            break;
          case 'dateImage':
            resolve(width <= 600 && height <= 190);
            break;
          case 'seasonalBadge':
            resolve(width <= 2048 && height <= 2048);
            break;
          default:
            resolve(false);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(false);
      };

      img.src = objectUrl;
    });
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'headerImage' | 'thumbnail' | 'dateImage' | 'seasonalBadge',
    index?: number
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Validate file size
      if (file.size > maxFileSize) {
        addToast({
          title: 'Error',
          description: 'File size must be less than 5MB',
          variant: 'error',
        });
        e.target.value = '';
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        addToast({
          title: 'Error',
          description: 'Only image files are allowed',
          variant: 'error',
        });
        e.target.value = '';
        return;
      }

      // Validate dimensions
      const isValidDimensions = await validateImageDimensions(file, type);
      if (!isValidDimensions) {
        const dimensionsMessage = {
          headerImage: 'Header image must not exceed 3661x2059 pixels',
          thumbnail: 'Thumbnail must not exceed 1100x830 pixels',
          dateImage: 'Date image must not exceed 600x190 pixels',
          seasonalBadge: 'Seasonal badge must not exceed 2048x2048 pixels'
        }[type];

        addToast({
          title: 'Error',
          description: dimensionsMessage,
          variant: 'error',
        });
        e.target.value = '';
        return;
      }

      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      const urlKey = type === 'seasonalBadge' ? `${type}_${index}` : type;
      
      // Store the URL in both state and ref
      setPreviewUrls(prev => {
        const newUrls = { ...prev, [urlKey]: previewUrl };
        previewUrlsRef.current = newUrls;
        return newUrls;
      });

      // Update files and previews state based on type
      if (type === 'seasonalBadge' && typeof index === 'number') {
        setFiles(prev => {
          const newBadges = [...prev.seasonalBadges];
          const newPreviews = [...prev.previews.seasonalBadges];
          
          newBadges[index] = file;
          newPreviews[index] = previewUrl;
          
          return {
            ...prev,
            seasonalBadges: newBadges,
            previews: {
              ...prev.previews,
              seasonalBadges: newPreviews
            }
          };
        });
      } else {
        setFiles(prev => ({
          ...prev,
          [type]: file,
          previews: {
            ...prev.previews,
            [type]: previewUrl
          }
        }));
      }

      e.target.value = '';
    } catch (error) {
      console.error('Error handling file upload:', error);
      addToast({
        title: 'Error',
        description: 'Failed to process the image. Please try again.',
        variant: 'error',
      });
      e.target.value = '';
    }
  };

  // Update the cleanup effect
  React.useEffect(() => {
    return () => {
      // Cleanup all preview URLs when component unmounts
      Object.values(previewUrlsRef.current).forEach(url => {
        if (url && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, []);

  // Add this effect to handle preview URL updates
  React.useEffect(() => {
    const currentUrls = { ...previewUrlsRef.current };
    
    // Cleanup any old URLs that are no longer in use
    Object.entries(currentUrls).forEach(([key, url]) => {
      if (!Object.values(files.previews).includes(url) && 
          !files.previews.seasonalBadges.includes(url)) {
        URL.revokeObjectURL(url);
        delete currentUrls[key];
      }
    });
    
    previewUrlsRef.current = currentUrls;
  }, [files.previews]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async () => {
    setIsDialogOpen(false);
    setLoading(true);
    try {
      // Validate required fields
      if (formData.category.length === 0) {
        addToast({
          title: 'Error',
          description: 'Please select at least one category',
          variant: 'error',
        });
        setLoading(false);
        return;
      }

      if (!files.headerImage || !files.thumbnail) {
          addToast({
            title: 'Error',
            description: 'Please upload required images (Header and Thumbnail)',
            variant: 'error',
          });
        setLoading(false);
          return;
      }

      const seasonalBadgeFiles = files.seasonalBadges.filter(Boolean);

      try {
        const baseData = {
          ...formData,
          tags: formData.tags.split(',').map(tag => tag.trim()),
          product_section_background_color: formData.product_section_background_color,
          product_card_background_color: formData.product_card_background_color,
          badge_position: {
            x: 50,
            y: 50,
            rotation: 0,
            scale: 1
          }
        };

        // Create template with required files
        await createTemplate({
          ...baseData,
          headerImage: files.headerImage,
          thumbnail: files.thumbnail,
          ...(files.dateImage && { dateImage: files.dateImage }),
          ...(files.seasonalBadges.length > 0 && { seasonalBadges: files.seasonalBadges })
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
          dateImage: null,
          seasonalBadges: [],
          previews: {
            headerImage: '',
            thumbnail: '',
            dateImage: '',
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

      // Check if the new name is different from any other template (except current one)
      if (formData.name.trim()) {
        const { data: existingTemplate, error: nameCheckError } = await dashboardSupabase
          .from('templates')
          .select('id')
          .eq('name', formData.name)
          .neq('id', editingTemplateId)
          .maybeSingle();

        if (nameCheckError) {
          addToast({
            title: 'Error',
            description: 'Failed to check template name availability.',
            variant: 'error',
          });
          setLoading(false);
          return;
        }

        if (existingTemplate) {
          addToast({
            title: 'Error',
            description: 'A template with this name already exists.',
            variant: 'error',
          });
          setLoading(false);
          return;
        }
      } else {
        addToast({
          title: 'Error',
          description: 'Template name cannot be empty.',
          variant: 'error',
        });
        setLoading(false);
        return;
      }

      // Update template data including name
      const { error: updateError } = await dashboardSupabase
        .from('templates')
        .update({
          name: formData.name,
          description: formData.description,
          category: formData.category,
          tags: formData.tags.split(',').map(tag => tag.trim()),
          terms_section_background_color: formData.terms_section_background_color,
          product_section_background_color: formData.product_section_background_color,
          product_card_background_color: formData.product_card_background_color,
          global_text_color: formData.global_text_color,
          badge_position: {
            x: badgePosition.x,
            y: badgePosition.y,
            rotation: badgeRotation,
            scale: badgeScale
          },
          updated_at: new Date().toISOString(),
          is_public: false // Set to unpublished when edited
        })
        .eq('id', editingTemplateId);

      if (updateError) {
        addToast({
          title: 'Error',
          description: 'Failed to update template.',
          variant: 'error',
        });
        setLoading(false);
        return;
      }

      // Update assets if changed
      if (files.headerImage || files.thumbnail || files.dateImage || files.seasonalBadges.length > 0) {
        const updatedAssets = await updateTemplateAssets(editingTemplateId, {
          headerImage: files.headerImage,
          thumbnail: files.thumbnail,
          dateImage: files.dateImage,
          seasonalBadges: files.seasonalBadges,
          replaceExisting: true
        });

        // Update the template with new asset paths
        const { error: updateAssetsError } = await dashboardSupabase
          .from('templates')
          .update({
            header_image_path: updatedAssets.headerImagePath,
            thumbnail_path: updatedAssets.thumbnailPath,
            date_image_path: updatedAssets.dateImagePath,
            seasonal_badge_paths: updatedAssets.seasonalBadgePaths,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingTemplateId);

        if (updateAssetsError) {
          addToast({
            title: 'Error',
            description: 'Failed to update template asset paths.',
            variant: 'error',
          });
          setLoading(false);
          return;
        }
      }

      // Reset form and state
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
        dateImage: null,
        seasonalBadges: [],
        previews: {
          headerImage: '',
          thumbnail: '',
          dateImage: '',
          seasonalBadges: []
        }
      });

      setIsEditMode(false);
      setEditingTemplateId(null);

      // Fetch updated templates and update the state
      const updatedTemplates = await getTemplates();
      if (updatedTemplates) {
        setTemplates(updatedTemplates);
      }

      addToast({
        title: 'Success',
        description: 'Template updated successfully!',
        variant: 'success',
      });
    } catch (error) {
      console.error('Error updating template:', error);
      addToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update template',
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
        const position = template.badge_position as BadgePosition;
        setBadgePosition({
          x: Math.round(position.x),
          y: Math.round(position.y)
        });
        setBadgeRotation(position.rotation || 0);
        setBadgeScale(parseFloat((position.scale || 1).toFixed(1)));
      } else {
        // Reset to default position if no saved position
        setBadgePosition({ x: 50, y: 50 });
        setBadgeRotation(0);
        setBadgeScale(1);
      }
    }
  }, [editingTemplateId, templates]);

  // Add state for badge position and dragging
  const [badgePosition, setBadgePosition] = React.useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [badgeRotation, setBadgeRotation] = React.useState(0);
  const badgeRef = React.useRef<HTMLDivElement>(null);
  const previewRef = React.useRef<HTMLDivElement>(null);
  const lastUpdateRef = React.useRef<number>(0);

  const updateBadgePosition = ({ x, y }: { x: number; y: number }) => {
    const roundedX = Math.round(x);
    const roundedY = Math.round(y);
    
    setBadgePosition({ 
      x: roundedX, 
      y: roundedY 
    });

    // Throttle database updates
    const now = Date.now();
    if (now - lastUpdateRef.current > 500) {
      const updatedBadgePosition: BadgePosition = {
        x: roundedX,
        y: roundedY,
        rotation: badgeRotation,
        scale: parseFloat(badgeScale.toFixed(1))
      };

      dashboardSupabase
        .from('templates')
        .update({
          badge_position: updatedBadgePosition,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingTemplateId);
      lastUpdateRef.current = now;
    }
  };

  const handleBadgeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);

    const handleMouseMove = (e: MouseEvent) => {
      if (!previewRef.current) return;

      const rect = previewRef.current.getBoundingClientRect();
      const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
      const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);

      // Ensure x and y are within bounds (0-100)
      const boundedX = Math.max(0, Math.min(100, x));
      const boundedY = Math.max(0, Math.min(100, y));

      updateBadgePosition({ x: boundedX, y: boundedY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      // Update database with final position including scale
      const updatedBadgePosition: BadgePosition = {
        x: Math.round(badgePosition.x),
        y: Math.round(badgePosition.y),
        rotation: badgeRotation,
        scale: parseFloat(badgeScale.toFixed(1))
      };

      dashboardSupabase
        .from('templates')
        .update({
          badge_position: updatedBadgePosition,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingTemplateId);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleBadgeMouseMove = React.useCallback((e: MouseEvent) => {
    if (!isDragging || !badgeRef.current || !previewRef.current) return;
    
    const previewBox = previewRef.current.getBoundingClientRect();
    
    const x = ((e.clientX - previewBox.left) / previewBox.width) * 100;
    const y = ((e.clientY - previewBox.top) / previewBox.height) * 100;

    const constrainedX = Math.max(5, Math.min(95, x));
    const constrainedY = Math.max(5, Math.min(95, y));

    updateBadgePosition({ x: constrainedX, y: constrainedY });
  }, [isDragging, updateBadgePosition]);

  const handleBadgeMouseUp = React.useCallback(() => {
    setIsDragging(false);
    
    // Force one final update
    if (editingTemplateId) {
      dashboardSupabase
        .from('templates')
        .update({
          badge_position: {
            x: badgePosition.x,
            y: badgePosition.y,
            rotation: badgeRotation
          }
        })
        .eq('id', editingTemplateId)
        .then(({ error }) => {
          if (error) {
            console.error('Error updating final badge position:', error);
          }
        });
    }
  }, [editingTemplateId, badgePosition, badgeRotation]);

  // Add event listeners for badge dragging
  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleBadgeMouseMove);
      window.addEventListener('mouseup', handleBadgeMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleBadgeMouseMove);
      window.removeEventListener('mouseup', handleBadgeMouseUp);
    };
  }, [isDragging, handleBadgeMouseMove, handleBadgeMouseUp]);

  const handleRotationChange = (newRotation: number) => {
    setBadgeRotation(newRotation);
    if (editingTemplateId) {
      dashboardSupabase
        .from('templates')
        .update({
          badge_position: {
            x: badgePosition.x,
            y: badgePosition.y,
            rotation: newRotation,
            scale: badgeScale
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
      display_order: index + 1
    }));
    
    setTemplates(updatedTemplates);

    try {
      // Update all template orders at once
      await updateAllTemplateOrders(updatedTemplates);

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

  // Template reordering drag handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
  };

  // Add scale state
  const [badgeScale, setBadgeScale] = React.useState(1);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const SCALE_STEP = 0.1;

  // Memoize the database update function
  const updateBadgePositionInDB = React.useCallback(
    async (position: BadgePosition) => {
      if (!editingTemplateId || isUpdating) return;
      
      try {
        setIsUpdating(true);
        await dashboardSupabase
          .from('templates')
          .update({
            badge_position: position,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingTemplateId);
      } catch (error) {
        console.error('Error updating badge position:', error);
      } finally {
        setIsUpdating(false);
      }
    },
    [editingTemplateId, isUpdating]
  );

  // Debounced database update
  const debouncedUpdateDB = React.useMemo(
    () => debounce(updateBadgePositionInDB, 500),
    [updateBadgePositionInDB]
  );

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      debouncedUpdateDB.cancel();
    };
  }, [debouncedUpdateDB]);

  const handleScaleChange = React.useCallback((value: number[]) => {
    const newScale = parseFloat(value[0].toFixed(1));
    if (newScale === badgeScale) return;
    
    setBadgeScale(newScale);
    
    // Create position object for database update
    const updatedBadgePosition: BadgePosition = {
      x: Math.round(badgePosition.x),
      y: Math.round(badgePosition.y),
      rotation: badgeRotation,
      scale: newScale
    };

    // Debounced database update
    debouncedUpdateDB(updatedBadgePosition);
  }, [badgeScale, badgePosition, badgeRotation, debouncedUpdateDB]);

  const handleScaleButtonClick = React.useCallback((e: React.MouseEvent, increment: boolean) => {
    e.preventDefault(); // Prevent any default browser behavior
    e.stopPropagation(); // Stop event propagation
    
    setBadgeScale(prev => {
      const newScale = parseFloat((increment ? prev + SCALE_STEP : prev - SCALE_STEP).toFixed(1));
      if (newScale <= 0.1 || newScale > 20 || newScale === prev) return prev;
      
      const updatedBadgePosition: BadgePosition = {
        x: Math.round(badgePosition.x),
        y: Math.round(badgePosition.y),
        rotation: badgeRotation,
        scale: newScale
      };

      // Debounced database update
      debouncedUpdateDB(updatedBadgePosition);
      return newScale;
    });
  }, [badgePosition, badgeRotation, debouncedUpdateDB]);

  const handleResetScale = React.useCallback(() => {
    if (badgeScale === 1) return;
    
    setBadgeScale(1);
    
    const updatedBadgePosition: BadgePosition = {
      x: badgePosition.x,
      y: badgePosition.y,
      rotation: badgeRotation,
      scale: 1
    };

    // Immediate database update for reset
    updateBadgePositionInDB(updatedBadgePosition);
  }, [badgeScale, badgePosition, badgeRotation, updateBadgePositionInDB]);

  const handleConfirm = async () => {
    setIsDialogOpen(false);
    if (isEditMode) {
      await handleUpdate();
    } else {
      await handleSubmit();
    }
  };

  const handleDeleteConfirm = async () => {
    if (templateToDelete) {
      setDeleteDialogOpen(false);
      setLoading(true);
      await handleDelete(templateToDelete.id, templateToDelete.folderPath);
      setTemplateToDelete(null);
    }
  };

  const handlePublish = async (id: string) => {
    try {
      const updatedTemplates = await handleTemplateUpdate(id, { is_public: true });
      if (updatedTemplates) {
        setTemplates(updatedTemplates);
      }

      addToast({
        title: 'Success',
        description: 'Template published successfully.',
        variant: 'success',
      });
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to publish template.',
        variant: 'error',
      });
    }
  };

  const handleEdit = async (templateId: string) => {
    setLoading(true);
    setEditingTemplateId(templateId);
    setIsEditMode(true);

    try {
      const { data: templateDetails, error } = await dashboardSupabase
          .from('templates')
        .select('*')
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

      // Set form data
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

      // Set badge position and scale
      if (templateDetails.badge_position) {
        const position = templateDetails.badge_position as BadgePosition;
        setBadgePosition({
          x: Math.round(position.x),
          y: Math.round(position.y)
        });
        setBadgeRotation(position.rotation || 0);
        setBadgeScale(parseFloat((position.scale || 1).toFixed(1)));
      }

      // Set file previews
      setFiles({
        headerImage: null,
        thumbnail: null,
        dateImage: null,
        seasonalBadges: [],
        previews: {
          headerImage: formatImagePath(templateDetails.header_image_path),
          thumbnail: formatImagePath(templateDetails.thumbnail_path),
          dateImage: formatImagePath(templateDetails.date_image_path),
          seasonalBadges: templateDetails.seasonal_badge_paths?.map(formatImagePath) || []
        }
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

  const addSeasonalBadge = () => {
    if (seasonalBadges.length < 10) {
      setSeasonalBadges([...seasonalBadges, seasonalBadges.length + 1]);
    }
  };

  const removeSeasonalBadge = async (index: number) => {
    try {
      // If we're in edit mode, we need to delete from storage and update DB
      if (isEditMode && editingTemplateId) {
        const storageBucket = process.env.NEXT_PUBLIC_DASHBOARD_SUPABASE_STORAGE_BUCKET;
        if (!storageBucket) {
          throw new Error('Storage bucket name not found');
        }

        // Get current template details
        const { data: template, error: templateError } = await dashboardSupabase
          .from('templates')
          .select('seasonal_badge_paths')
          .eq('id', editingTemplateId)
          .single();

        if (templateError) throw templateError;

        if (template.seasonal_badge_paths && template.seasonal_badge_paths[index]) {
          // Delete the file from storage
          const { error: deleteError } = await dashboardSupabase.storage
            .from(storageBucket)
            .remove([template.seasonal_badge_paths[index]]);

          if (deleteError) throw deleteError;

          // Update the database with new badge paths array
          const newBadgePaths = [...template.seasonal_badge_paths];
          newBadgePaths.splice(index, 1);

          const { error: updateError } = await dashboardSupabase
            .from('templates')
            .update({
              seasonal_badge_paths: newBadgePaths,
              updated_at: new Date().toISOString()
            })
            .eq('id', editingTemplateId);

          if (updateError) throw updateError;
        }
      }

      // Revoke the blob URL for the removed badge
      const urlKey = `seasonalBadge_${index}`;
      if (previewUrlsRef.current[urlKey]) {
        URL.revokeObjectURL(previewUrlsRef.current[urlKey]);
        setPreviewUrls(prev => {
          const newUrls = { ...prev };
          delete newUrls[urlKey];
          previewUrlsRef.current = newUrls;
          return newUrls;
        });
      }

      // Update local state
      setFiles(prev => {
        const newBadges = [...prev.seasonalBadges];
        const newPreviews = [...prev.previews.seasonalBadges];
        
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
      
      setSeasonalBadges(prev => prev.filter((_, i) => i !== index));

    } catch (error) {
      console.error('Error removing seasonal badge:', error);
      addToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove seasonal badge',
        variant: 'error',
      });
    }
  };

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
                        setOpenCategory(true);
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

  // Add handleDelete function
  const handleDelete = async (id: string, folderPath: string) => {
    setLoading(true);
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
      addToast({
        title: 'Error',
        description: 'Failed to delete template.',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // Add environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_DASHBOARD_SUPABASE_URL;
  const storageBucket = process.env.NEXT_PUBLIC_DASHBOARD_SUPABASE_STORAGE_BUCKET;

  if (!supabaseUrl || !storageBucket) {
    console.error('Missing required environment variables. Please check your .env file.');
  }

  const resetForm = () => {
    // Cleanup all preview URLs
    Object.values(previewUrlsRef.current).forEach(url => {
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
    setPreviewUrls({});
    previewUrlsRef.current = {};

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
      dateImage: null,
      seasonalBadges: [],
      previews: {
        headerImage: '',
        thumbnail: '',
        dateImage: '',
        seasonalBadges: []
      }
    });

    setSeasonalBadges([1, 2, 3]);
    setBadgePosition({ x: 50, y: 50 });
    setBadgeRotation(0);
    setBadgeScale(1);
    setIsEditMode(false);
    setEditingTemplateId(null);
  };

  return (
    <>
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
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
              handleConfirm();
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
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Templates List</h2>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Total Templates: {templates.length}
              </div>
            </div>
            
            {/* Add search input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search templates by name..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 pr-10 text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
              />
              <svg
                className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            <div className="space-y-3">
              {templates.length === 0 && searchQuery && (
                <div className="text-center py-4 text-slate-500 dark:text-slate-400">
                  No templates found matching "{searchQuery}"
                </div>
              )}
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
                  className="flex flex-col rounded-lg bg-slate-100 p-4 transition-all hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 cursor-move"
                >
                  {/* Top section with image and name */}
                  <div className="flex items-center gap-4 mb-4">
                    <GripVertical className="h-6 w-6 text-slate-400 flex-shrink-0" />
                    <div className="relative w-20 h-20 sm:w-28 sm:h-28 rounded-lg overflow-hidden flex-shrink-0">
                      {template.thumbnail_path ? (
                        <Image
                          src={formatImagePath(template.thumbnail_path)}
                          alt={template.name}
                          fill
                          sizes="(max-width: 640px) 80px, 112px"
                          className="object-cover"
                          priority
                        />
                      ) : (
                        <div className="h-full w-full bg-red-500"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white truncate block">{template.name}</span>
                    </div>
                  </div>

                  {/* Bottom section with buttons */}
                  <div className="flex flex-wrap gap-2 sm:gap-4 mt-auto justify-center">
                    <button
                      className={`rounded px-4 py-2 text-sm text-white min-w-[80px] ${
                        template.is_public || isEditMode
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-green-500 hover:bg-green-600'
                      }`}
                      onClick={() => handlePublish(template.id)}
                      disabled={template.is_public || isEditMode}
                    >
                      {template.is_public ? 'Published' : 'Publish'}
                    </button>
                    <button
                      className={`rounded px-4 py-2 text-sm text-white min-w-[80px] ${
                        isEditMode && editingTemplateId !== template.id
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-500 hover:bg-blue-600'
                      }`}
                      onClick={() => handleEdit(template.id)}
                      disabled={isEditMode && editingTemplateId !== template.id}
                    >
                      Edit
                    </button>
                    <button
                      className={`rounded px-4 py-2 text-sm text-white min-w-[80px] ${
                        isEditMode
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-red-500 hover:bg-red-600'
                      }`}
                      onClick={() => confirmDeleteTemplate(template.id, template.thumbnail_path)}
                      disabled={isEditMode}
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
        </div>

        {/* Create/Update Template Form Section */}
        <div className="lg:w-[50%] w-full rounded-lg bg-white p-6 shadow-md dark:bg-slate-800">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
              {isEditMode ? 'Update Template' : 'Create Template'}
            </h2>
            {/* Add template count to the header */}
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Total Templates: {templates.length}
            </div>
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
                    dateImage: null,
                    seasonalBadges: [],
                    previews: {
                      headerImage: '',
                      thumbnail: '',
                      dateImage: '',
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
            {/* Template Name Field - Now editable in both create and edit modes */}
              <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Template Name <span className="text-red-500">*</span>:
              </label>
                <input 
                  type="text" 
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                placeholder="Enter template name"
                />
              </div>

            {/* Categories */}
              <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Categories:</label>
                <CategorySelect />
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
            <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Header Image:</label>
                <div className="flex w-full items-center justify-center">
                  <label className="relative w-full cursor-pointer">
                    <div className="w-full pb-[56.25%] relative rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600 overflow-hidden">
                      {files.previews.headerImage ? (
                        <Image
                          src={files.previews.headerImage}
                          alt="Header Preview"
                          fill
                          className="object-contain"
                          onError={() => {
                            // Handle image load error
                            setFiles(prev => ({
                              ...prev,
                              headerImage: null,
                              previews: {
                                ...prev.previews,
                                headerImage: ''
                              }
                            }));
                            addToast({
                              title: 'Error',
                              description: 'Failed to load header image preview',
                              variant: 'error',
                            });
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <svg className="mb-3 h-10 w-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">Click to upload header image</p>
                        </div>
                      )}
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => handleFileChange(e, 'headerImage')}
                      accept="image/*"
                    />
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Thumbnail:</label>
                <div className="flex w-full items-center justify-center">
                  <label className="relative w-full cursor-pointer">
                    <div className="w-full pb-[75.45%] relative rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600 overflow-hidden">
                      {files.previews.thumbnail ? (
                        <Image
                          src={files.previews.thumbnail}
                          alt="Thumbnail Preview"
                          fill
                          className="object-contain"
                          onError={() => {
                            setFiles(prev => ({
                              ...prev,
                              thumbnail: null,
                              previews: {
                                ...prev.previews,
                                thumbnail: ''
                              }
                            }));
                            addToast({
                              title: 'Error',
                              description: 'Failed to load thumbnail preview',
                              variant: 'error',
                            });
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <svg className="mb-3 h-10 w-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">Click to upload thumbnail</p>
                        </div>
                      )}
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => handleFileChange(e, 'thumbnail')}
                      accept="image/*"
                    />
                  </label>
                </div>
              </div>
            </div>

              {/* Date Image */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Date Image:
                  <span className="text-xs text-slate-500 ml-2">(Max: 600x190px)</span>
                </label>
                <div className="flex w-full items-center justify-center">
                  <label className="relative w-full cursor-pointer">
                    <div className="w-full pb-[31.67%] relative rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600 overflow-hidden">
                      {files.previews.dateImage ? (
                        <Image
                          src={files.previews.dateImage}
                          alt="Date Image Preview"
                          fill
                          className="object-contain"
                          onError={() => {
                            setFiles(prev => ({
                              ...prev,
                              dateImage: null,
                              previews: {
                                ...prev.previews,
                                dateImage: ''
                              }
                            }));
                            addToast({
                              title: 'Error',
                              description: 'Failed to load date image preview',
                              variant: 'error',
                            });
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <svg className="mb-3 h-10 w-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">Click to upload date image</p>
                        </div>
                      )}
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => handleFileChange(e, 'dateImage')}
                      accept="image/*"
                    />
                  </label>
                </div>
              </div>

              {/* Seasonal Badges */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Seasonal Badges:
                    <span className="text-xs text-slate-500 ml-2">(Max: 2048x2048px)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={addSeasonalBadge}
                      disabled={seasonalBadges.length >= 10}
                      className={cn(
                        "rounded-full p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900",
                        seasonalBadges.length >= 10 && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {seasonalBadges.map((_, index) => (
                    <div key={index} className="relative">
                      <label className="relative block cursor-pointer">
                        <div className="w-full pb-[100%] relative rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600 overflow-hidden">
                          {files.previews.seasonalBadges[index] ? (
                            <Image
                              src={files.previews.seasonalBadges[index]}
                              alt={`Seasonal Badge ${index + 1}`}
                              fill
                              className="object-contain"
                              onError={() => {
                                setFiles(prev => {
                                  const newBadges = [...prev.seasonalBadges];
                                  const newPreviews = [...prev.previews.seasonalBadges];
                                  newBadges[index] = null;
                                  newPreviews[index] = '';
                                  return {
                                    ...prev,
                                    seasonalBadges: newBadges,
                                    previews: {
                                      ...prev.previews,
                                      seasonalBadges: newPreviews
                                    }
                                  };
                                });
                                addToast({
                                  title: 'Error',
                                  description: `Failed to load seasonal badge ${index + 1} preview`,
                                  variant: 'error',
                                });
                              }}
                            />
                          ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <svg className="mb-2 h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                              <p className="text-xs text-slate-500 dark:text-slate-400">Badge {index + 1}</p>
                            </div>
                          )}
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => handleFileChange(e, 'seasonalBadge', index)}
                          accept="image/*"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setLoading(true);
                          removeSeasonalBadge(index)
                            .finally(() => setLoading(false));
                        }}
                        className="absolute -top-2 -right-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                        disabled={loading}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Preview Window */}
            <div className="space-y-3 mt-6">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Template Preview:</label>
              <div 
                ref={previewRef}
                className="w-full pb-[56.2%] relative rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-700 overflow-hidden"
              >
                {/* Header Image Preview */}
                <div className="absolute inset-0">
                  {files.previews.headerImage ? (
                    <Image
                      src={files.previews.headerImage}
                      alt="Header Preview"
                      fill
                      className="object-contain"
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
                    onMouseDown={handleBadgeMouseDown}
                    className="absolute w-16 h-16 rounded-full overflow-hidden border-2 border-white cursor-move"
                    style={{
                      left: `${badgePosition.x}%`,
                      top: `${badgePosition.y}%`,
                      transform: `translate(-50%, -50%) rotate(${badgeRotation}deg) scale(${badgeScale})`,
                      cursor: isDragging ? 'grabbing' : 'grab',
                      zIndex: 10
                    }}
                  >
                    <Image
                      src={files.previews.seasonalBadges[0]}
                      alt="First Seasonal Badge"
                      fill
                      className="object-contain pointer-events-none"
                    />
                  </div>
                )}
              </div>

              {/* Position, Rotation, and Scale Controls */}
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
                      onClick={() => updateBadgePosition({ x: 50, y: 50 })}
                      className="ml-auto text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Reset Position
                    </button>
                  </div>

                  {/* Rotation Controls */}
                  <div className="flex items-center gap-4 p-3 bg-slate-100 rounded-lg dark:bg-slate-700">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Rotation:</span>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={badgeRotation}
                      onChange={(e) => {
                        const newRotation = parseInt(e.target.value);
                        setBadgeRotation(newRotation);
                        const now = Date.now();
                        if (now - lastUpdateRef.current > 500) {
                          dashboardSupabase
                            .from('templates')
                            .update({
                              badge_position: {
                                x: badgePosition.x,
                                y: badgePosition.y,
                                rotation: newRotation,
                                scale: badgeScale
                              },
                              updated_at: new Date().toISOString()
                            })
                            .eq('id', editingTemplateId);
                          lastUpdateRef.current = now;
                        }
                      }}
                      className="flex-1"
                    />
                    <span className="px-2 py-1 bg-white rounded dark:bg-slate-600 text-sm min-w-[60px] text-center">
                        {badgeRotation}°
                      </span>
                      <button
                        type="button"
                      onClick={() => {
                        setBadgeRotation(0);
                        dashboardSupabase
                          .from('templates')
                          .update({
                            badge_position: {
                              x: badgePosition.x,
                              y: badgePosition.y,
                              rotation: 0,
                              scale: badgeScale
                            },
                            updated_at: new Date().toISOString()
                          })
                          .eq('id', editingTemplateId);
                      }}
                      className="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Reset Rotation
                      </button>
                  </div>

                  {/* Scale Controls */}
                  <div className="flex items-center gap-4 p-3 bg-slate-100 rounded-lg dark:bg-slate-700">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Scale:</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={(e) => handleScaleButtonClick(e, false)}
                        disabled={badgeScale <= 0.1 || isUpdating}
                        type="button"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="px-2 py-1 bg-white rounded dark:bg-slate-600 text-sm min-w-[60px] text-center">
                        {badgeScale.toFixed(1)}x
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={(e) => handleScaleButtonClick(e, true)}
                        disabled={badgeScale >= 20 || isUpdating}
                        type="button"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <Slider
                      value={[badgeScale]}
                      onValueChange={handleScaleChange}
                      min={0.1}
                      max={20}
                      step={0.1}
                      className="flex-1 mx-4"
                      disabled={isUpdating}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleResetScale();
                      }}
                      disabled={badgeScale === 1 || isUpdating}
                      className={cn(
                        "text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300",
                        (badgeScale === 1 || isUpdating) && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      Reset Scale
                    </button>
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
            <div className="pt-4 flex gap-4">
              <button
                type="button"
                className="flex-1 rounded-lg bg-blue-500 px-4 py-2.5 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                onClick={() => setIsDialogOpen(true)}
              >
                {isEditMode ? 'Update Template' : 'Create Template'}
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg bg-gray-500 px-4 py-2.5 text-white hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                onClick={resetForm}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
