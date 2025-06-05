'use client';

import React, { useState, useEffect } from 'react';
import { dashboardSupabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast-provider';
import { Spinner } from '@/components/ui/spinner';

interface User {
  id: string;
  name: string;
  organization_name: string;
  email: string;
  phone_number: string;
  address: string;
  subscription_status: 'premium' | 'preview';
  subscription_expires_at: string;
  flyers_created: number;
  flyers_exported: number;
  organization_logo: string;
  created_at: string | null;
  last_login: string | null;
}

interface EditableUser extends Omit<User, 'email' | 'flyers_created' | 'flyers_exported' | 'created_at' | 'last_login'> {}

const PAGE_SIZE = 10;

const formatDate = (dateString: string | null) => {
  if (!dateString || dateString === '') return 'Never logged in';
  
  try {
    // Handle PostgreSQL timestamptz format
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
    return 'Never logged in';
  } catch (error) {
    console.error('Error formatting date:', error, 'for value:', dateString);
    return 'Never logged in';
  }
};

// Add a separate function for date and time formatting
const formatDateTime = (dateString: string | null) => {
  if (!dateString || dateString === '') return 'Never logged in';
  
  try {
    // Handle PostgreSQL timestamptz format
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      });
    }
    return 'Never logged in';
  } catch (error) {
    console.error('Error formatting date:', error, 'for value:', dateString);
    return 'Never logged in';
  }
};

const isNewUser = (createdAt: string | null) => {
  if (!createdAt) return false;
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  return new Date(createdAt) > twoDaysAgo;
};

const NewUserBadge = () => (
  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
    NEW
  </span>
);

const UsersPage = () => {
  const { addToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<EditableUser | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  const fetchUsers = async (pageNum = 1, search = '') => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/users?page=${pageNum}&pageSize=${PAGE_SIZE}&search=${search}`);
      if (!res.ok) throw new Error('Failed to fetch users');
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Debug log for first user's dates
      /* if (data.users?.[0]) {
        console.log('First user dates:', {
         expired : data.users[0].subscription_expires_at,
          created_at: data.users[0].created_at,
          last_login: data.users[0].last_login
        });
      } */

      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (error) {
      // console.error('Error fetching users:', error);
      addToast({
        title: 'Error',
        description: 'Failed to fetch users',
        variant: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(page, searchTerm);
  }, [page, searchTerm]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers(1, searchTerm);
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    const { email, flyers_created, flyers_exported, created_at, last_login, ...editableFields } = user;
    setEditingUser(editableFields);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingUser(null);
    setSelectedUser(null);
    setShowSaveConfirmation(false);
  };

  const handleSave = async () => {
    if (!editingUser) return;
    
    setIsSaving(true);
    try {
      // console.log('Updating user with data:', editingUser);
      
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editingUser),
      });

      // console.log('Response status:', res.status);
      // console.log('Response headers:', Object.fromEntries(res.headers.entries()));

      const responseText = await res.text();
      // console.log('Raw response:', responseText);

      let errorData;
      if (!res.ok) {
        try {
          errorData = responseText ? JSON.parse(responseText) : { error: 'Unknown error occurred' };
        } catch (e) {
          errorData = { error: `Failed to parse error response: ${responseText}` };
        }
        // console.error('Server response error:', errorData);
        throw new Error(errorData.error || 'Failed to update user');
      }

      let updatedUser;
      try {
        updatedUser = responseText ? JSON.parse(responseText) : null;
      } catch (e) {
        throw new Error(`Failed to parse success response: ${responseText}`);
      }

      if (!updatedUser) {
        throw new Error('No data received from server');
      }

      // console.log('Server response:', updatedUser);
      
      // Update the users list with the new data
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === editingUser.id ? { ...user, ...updatedUser } : user
        )
      );
      
      // Reset all edit-related state
      setSelectedUser(null);
      setEditingUser(null);
      setIsEditing(false);
      setShowSaveConfirmation(false);
      
      // Refresh the users list to ensure we have the latest data
      await fetchUsers(page, searchTerm);
      
      addToast({
        title: 'Success',
        description: 'User updated successfully',
        variant: 'success',
      });
    } catch (error) {
      // console.error('Error updating user:', error);
      addToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update user',
        variant: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Add a new effect to handle dialog state
  useEffect(() => {
    if (!isEditing) {
      setEditingUser(null);
      setSelectedUser(null);
      setShowSaveConfirmation(false);
    }
  }, [isEditing]);

  const handleStatusChange = async (userId: string, newStatus: 'active' | 'inactive') => {
    setEditLoading(true);
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, status: newStatus })
      });

      if (!res.ok) throw new Error('Failed to update user status');
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, status: newStatus } : user
      ));

      addToast({
        title: 'Success',
        description: 'User status updated successfully',
        variant: 'success',
      });
    } catch (error) {
      // console.error('Error updating user status:', error);
      addToast({
        title: 'Error',
        description: 'Failed to update user status',
        variant: 'error',
      });
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    
    setEditLoading(true);
    try {
      const res = await fetch(`/api/users?id=${userToDelete}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Failed to delete user');
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setUsers(prev => prev.filter(user => user.id !== userToDelete));
      setDeleteDialogOpen(false);
      setUserToDelete(null);

      addToast({
        title: 'Success',
        description: 'User deleted successfully',
        variant: 'success',
      });
    } catch (error) {
      // console.error('Error deleting user:', error);
      addToast({
        title: 'Error',
        description: 'Failed to delete user',
        variant: 'error',
      });
    } finally {
      setEditLoading(false);
    }
  };

  const confirmDelete = (userId: string) => {
    setUserToDelete(userId);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="container mx-auto p-6">
      {/* Search and Filters */}
      <div className="mb-6">
        <form onSubmit={handleSearch} className="flex gap-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search users..."
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700"
          />
          <Button type="submit">Search</Button>
        </form>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Contact</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Subscription</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Usage</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center">
                  <Spinner className="mx-auto" />
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  No users found
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      {user.organization_logo ? (
                        <img
                          src={user.organization_logo}
                          alt={`${user.organization_name} logo`}
                          className="mr-3 h-10 w-10 rounded-full object-cover bg-gray-100"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = '/placeholder-logo.png';
                          }}
                        />
                      ) : (
                        <div className="mr-3 h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                          <span className="text-gray-500 text-lg font-medium">
                            {user.organization_name?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {user.name}
                          {isNewUser(user.created_at) && <NewUserBadge />}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{user.organization_name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <div className="text-gray-900 dark:text-white">{user.email}</div>
                      <div className="text-gray-500 dark:text-gray-400">{user.phone_number}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <div className={`inline-flex rounded-full px-2 text-xs font-semibold ${
                        user.subscription_status === 'premium' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}>
                        {user.subscription_status}
                      </div>
                      <div className="mt-1 text-gray-500 dark:text-gray-400">
                        Expires: {formatDate(user.subscription_expires_at)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 dark:text-white">
                      <div>Flyers Created: {user.flyers_created}</div>
                      <div>Flyers Exported: {user.flyers_exported}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(user)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => confirmDelete(user.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-700 dark:text-gray-300">
          Showing {((page - 1) * PAGE_SIZE) + 1} to {Math.min(page * PAGE_SIZE, total)} of {total} users
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() => setPage(p => p + 1)}
            disabled={page * PAGE_SIZE >= total}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog 
        open={isEditing} 
        onOpenChange={(open) => {
          if (!open) {
            setIsEditing(false);
            setEditingUser(null);
            setSelectedUser(null);
            setShowSaveConfirmation(false);
          }
        }}
      >
        <DialogContent className="bg-white dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
          <DialogTitle className="text-gray-900 dark:text-white">
            {selectedUser ? `Edit User: ${selectedUser.name}` : 'User Details'}
          </DialogTitle>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
              <input
                type="text"
                value={editingUser?.name || ''}
                onChange={(e) => setEditingUser(prev => prev ? { ...prev, name: e.target.value } : null)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Organization Name</label>
              <input
                type="text"
                value={editingUser?.organization_name || ''}
                onChange={(e) => setEditingUser(prev => prev ? { ...prev, organization_name: e.target.value } : null)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone Number</label>
              <input
                type="text"
                value={editingUser?.phone_number || ''}
                onChange={(e) => setEditingUser(prev => prev ? { ...prev, phone_number: e.target.value } : null)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Address</label>
              <textarea
                value={editingUser?.address || ''}
                onChange={(e) => setEditingUser(prev => prev ? { ...prev, address: e.target.value } : null)}
                rows={3}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Subscription Status</label>
              <select
                value={editingUser?.subscription_status || ''}
                onChange={(e) => setEditingUser(prev => prev ? { ...prev, subscription_status: e.target.value as 'premium' | 'preview' } : null)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700"
              >
                <option value="premium">Premium</option>
                <option value="preview">Preview</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Subscription Expires At</label>
              <input
                type="date"
                value={editingUser?.subscription_expires_at?.split('T')[0] || ''}
                onChange={(e) => setEditingUser(prev => prev ? { ...prev, subscription_expires_at: e.target.value } : null)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700"
              />
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <p>Created At: {formatDateTime(selectedUser?.created_at || '')}</p>
              <p>Last Login: {formatDateTime(selectedUser?.last_login || '')}</p>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <Button variant="outline" onClick={handleCancel}>Cancel</Button>
            <Button onClick={() => setShowSaveConfirmation(true)} disabled={isSaving}>
              {isSaving ? <Spinner className="mr-2" /> : null}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogTitle>Confirm Delete</DialogTitle>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Are you sure you want to delete this user? This action cannot be undone.
          </p>
          <div className="mt-4 flex justify-end space-x-3">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save Confirmation Dialog */}
      <Dialog open={showSaveConfirmation} onOpenChange={setShowSaveConfirmation}>
        <DialogContent>
          <DialogTitle>Confirm Changes</DialogTitle>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Are you sure you want to save these changes?
          </p>
          <div className="mt-4 flex justify-end space-x-3">
            <Button variant="outline" onClick={() => setShowSaveConfirmation(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Spinner className="mr-2" /> : null}
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersPage;