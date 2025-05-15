'use client';

import React from 'react';
import Image from 'next/image';
import { createTemplate, getTemplates, deleteTemplate } from '@/lib/templates';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast-provider';

export default function TemplatesPage() {
  const { addToast } = useToast();
  const [templates, setTemplates] = React.useState<{ id: string; name: string; thumbnail_path: string; is_public: boolean }[]>([]);
  const [seasonalBadges, setSeasonalBadges] = React.useState([1, 2, 3]);
  const maxFileSize = 5 * 1024 * 1024; // 5MB in bytes
  const [isDialogOpen, setIsDialogOpen] = React.useState(false); // State for confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [templateToDelete, setTemplateToDelete] = React.useState<{ id: string; folderPath: string } | null>(null);

  React.useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const data = await getTemplates();
        setTemplates(data || []);
      } catch {
        addToast({
          title: 'Error',
          description: 'Failed to fetch templates.',
          variant: 'error',
        });
      }
    };

    fetchTemplates();
  }, [addToast]);

  // Add form state
  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    category: '',
    tags: '',
    terms_section_background_color: '#ffffff',
    products_section_background_color: '#ffffff',
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
    if (!files.headerImage || !files.thumbnail) {
      addToast({
        title: 'Error',
        description: 'Please upload header image and thumbnail',
        variant: 'error',
      });
      return;
    }

    const seasonalBadgeFiles = files.seasonalBadges.filter(Boolean);
    if (seasonalBadgeFiles.length === 0) {
      addToast({
        title: 'Error',
        description: 'Please upload at least one seasonal badge',
        variant: 'error',
      });
      return;
    }

    try {
      await createTemplate({
        ...formData,
        tags: formData.tags.split(',').map(tag => tag.trim()),
        headerImage: files.headerImage,
        thumbnail: files.thumbnail,
        seasonalBadges: seasonalBadgeFiles
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
        products_section_background_color: '#ffffff',
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
    } catch {
      addToast({
        title: 'Error',
        description: 'Failed to create template. Please try again.',
        variant: 'error',
      });
    }
  };

  const handleConfirm = async () => {
    setIsDialogOpen(false); // Close the dialog
    await handleSubmit(); // Proceed with form submission
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
    try {
      await deleteTemplate(id, folderPath);
      setTemplates(prev => prev.filter(template => template.id !== id));
      addToast({
        title: 'Success',
        description: 'Template deleted successfully.',
        variant: 'success',
      });
    } catch {
      addToast({
        title: 'Error',
        description: 'Failed to delete template.',
        variant: 'error',
      });
    }
  };

  const handlePublish = async (id: string) => {
    try {
      addToast({
        title: 'Success',
        description: 'Template published successfully.',
        variant: 'success',
      });
    } catch {
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
      await handleDelete(templateToDelete.id, templateToDelete.folderPath);
      setTemplateToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Template Creation</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to create this template?</p>
          <DialogFooter>
            <button
              className="rounded-lg bg-blue-500 px-4 py-2.5 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              onClick={handleConfirm}
            >
              Confirm
            </button>
            <button
              className="rounded-lg bg-gray-500 px-4 py-2.5 text-white hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete this template? This action cannot be undone.</p>
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

      <div className="flex gap-8">
        {/* Templates List Section */}
        <div className="w-[60%] rounded-lg bg-white p-6 shadow-md dark:bg-slate-800">
          <h2 className="mb-6 text-2xl font-bold text-slate-800 dark:text-white">Templates</h2>
          <div className="space-y-3">
            {templates.map(template => (
              <div 
                key={template.id}
                className="flex items-center justify-between rounded-lg bg-slate-100 p-4 transition-all hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded overflow-hidden">
                    {template.thumbnail_path ? (
                      <Image
                        src={`${process.env.NEXT_PUBLIC_DASHBOARD_SUPABASE_URL}/storage/v1/object/public/${process.env.NEXT_PUBLIC_DASHBOARD_SUPABASE_STORAGE_BUCKET}/${template.thumbnail_path}`}
                        alt={template.name}
                        width={40}
                        height={40}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-red-500"></div>
                    )}
                  </div>
                  <span className="text-slate-800 dark:text-white">{template.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {template.is_public ? 'Published' : 'Pending'}
                  </span>
                  <button
                    className="rounded bg-green-500 px-3 py-1 text-white hover:bg-green-600"
                    onClick={() => handlePublish(template.id)}
                  >
                    Publish
                  </button>
                  <button
                    className="rounded bg-blue-500 px-3 py-1 text-white hover:bg-blue-600"
                    onClick={() => handleEdit()}
                  >
                    Edit
                  </button>
                  <button
                    className="rounded bg-red-500 px-3 py-1 text-white hover:bg-red-600"
                    onClick={() => confirmDeleteTemplate(template.id, template.thumbnail_path)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Create Template Form Section */}
        <div className="w-[40%] rounded-lg bg-white p-6 shadow-md dark:bg-slate-800">
          <h2 className="mb-6 text-2xl font-bold text-slate-800 dark:text-white">Create template</h2>
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
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700" 
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
                  name="products_section_background_color"
                  value={formData.products_section_background_color}
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
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="w-full rounded-lg bg-blue-500 px-4 py-2.5 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Create Template
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create a New Template</DialogTitle>
                  </DialogHeader>
                  <form>
                    {/* Form content here */}
                  </form>
                  <DialogFooter>
                    <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
                      Submit
                    </button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}