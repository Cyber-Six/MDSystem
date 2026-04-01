import React, { useState, useEffect } from 'react';
import {
  fetchAllAnnouncementsAdmin,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  uploadPubmat,
} from '../announcement-service';

/**
 * Announcement Management Component
 * Staff interface to manage announcements (CRUD)
 */
const AnnouncementManagement = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [stagedFileId, setStagedFileId] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [existingPubmat, setExistingPubmat] = useState(null);

  const [formData, setFormData] = useState({
    label: '',
    description: '',
    isActive: true,
    location: 'Both',
  });

  // Fetch announcements on mount
  useEffect(() => {
    loadAnnouncements();
  }, []);

  const [isPermissionDenied, setIsPermissionDenied] = useState(false);

  const loadAnnouncements = async () => {
    try {
      setIsLoading(true);
      const data = await fetchAllAnnouncementsAdmin();
      setAnnouncements(data);
      setError(null);
      setIsPermissionDenied(false);
    } catch (err) {
      if (err?.response?.status === 403) {
        setIsPermissionDenied(true);
      } else {
        setError('Failed to load announcements');
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);

    // Upload to staging
    try {
      setIsUploadingFile(true);
      setError(null);
      const fileId = await uploadPubmat(file);
      setStagedFileId(fileId);
    } catch (err) {
      setError('Failed to upload image. Please try again.');
      setImagePreview(null);
      e.target.value = '';
    } finally {
      setIsUploadingFile(false);
    }
  };

  const resetForm = () => {
    setFormData({
      label: '',
      description: '',
      isActive: true,
      location: 'Both',
    });
    setEditingId(null);
    setStagedFileId(null);
    setImagePreview(null);
    setExistingPubmat(null);
  };

  const handleEdit = (announcement) => {
    setFormData({
      label: announcement.label || '',
      description: announcement.description || '',
      isActive: announcement.isActive !== false,
      location: announcement.location || 'Both',
    });
    setEditingId(announcement.id);
    setStagedFileId(null);
    setImagePreview(null);
    setExistingPubmat(announcement.pubmat || null);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSaving(true);

      const payload = {
        ...formData,
        pubmat: stagedFileId || existingPubmat || null,
      };

      if (editingId) {
        await updateAnnouncement(editingId, payload);
      } else {
        await createAnnouncement(payload);
      }

      resetForm();
      setIsFormOpen(false);
      await loadAnnouncements();
    } catch (err) {
      setError(err.message || 'Failed to save announcement');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) {
      return;
    }

    try {
      setIsSaving(true);
      await deleteAnnouncement(id);
      await loadAnnouncements();
    } catch (err) {
      setError(err.message || 'Failed to delete announcement');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3"></div>
          <div className="space-y-2">
            <div className="h-12 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
            <div className="h-12 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (isPermissionDenied) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-8 text-center">
        <svg className="w-12 h-12 mx-auto mb-3 text-neutral-400 dark:text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
        <p className="text-secondary-700 dark:text-neutral-300 font-medium">Access Denied</p>
        <p className="text-secondary-500 dark:text-neutral-400 text-sm mt-1">You do not have permission to manage announcements.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-secondary-800 dark:text-white">
          Announcements Management
        </h2>
        <button
          onClick={() => {
            resetForm();
            setIsFormOpen(!isFormOpen);
          }}
          className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded transition-colors"
        >
          {isFormOpen ? 'Cancel' : '+ New Announcement'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded text-sm text-error-700 dark:text-error-400">
          {error}
        </div>
      )}

      {/* Form */}
      {isFormOpen && (
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-secondary-700 dark:text-neutral-300 mb-1">
                Title
              </label>
              <input
                type="text"
                name="label"
                value={formData.label}
                onChange={handleInputChange}
                placeholder="Enter announcement title"
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded text-sm bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-secondary-700 dark:text-neutral-300 mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Enter announcement description"
                rows="4"
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded text-sm bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-xs font-semibold text-secondary-700 dark:text-neutral-300 mb-1">
                Image / Pubmat (Optional)
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleFileChange}
                disabled={isUploadingFile}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded text-sm bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
              />
              {isUploadingFile && (
                <p className="text-xs text-primary-500 mt-1 flex items-center gap-1">
                  <span className="animate-spin inline-block w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full"></span>
                  Uploading image...
                </p>
              )}
              {imagePreview && !isUploadingFile && (
                <div className="mt-2">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-h-40 rounded border border-neutral-200 dark:border-neutral-600 object-contain"
                  />
                  <p className="text-xs text-success-600 dark:text-success-400 mt-1">Image ready</p>
                </div>
              )}
              {!imagePreview && existingPubmat && (
                <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-1">
                  Current image: {existingPubmat} — upload a new file to replace it
                </p>
              )}
            </div>

            {/* Branch / Location */}
            <div>
              <label className="block text-xs font-semibold text-secondary-700 dark:text-neutral-300 mb-1">
                Branch Visibility
              </label>
              <select
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded text-sm bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="Both">All Branches</option>
                <option value="Manila">Manila (Arlegui &amp; Casal)</option>
                <option value="QuezonCity">Quezon City</option>
              </select>
              <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-1">
                Controls which branch patients can see this announcement.
              </p>
            </div>

            {/* Active Status */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                name="isActive"
                checked={formData.isActive}
                onChange={handleInputChange}
                className="rounded border-neutral-300 dark:border-neutral-600 text-primary-500 focus:ring-primary-500"
              />
              <label htmlFor="isActive" className="text-xs text-secondary-700 dark:text-neutral-300">
                Active (publicly visible)
              </label>
            </div>

            {/* Submit Button */}
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setIsFormOpen(false);
                }}
                className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 text-secondary-700 dark:text-neutral-300 text-sm font-medium rounded hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || isUploadingFile}
                className="px-3 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-white text-sm font-medium rounded transition-colors"
              >
                {isSaving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Announcements List */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
        {announcements.length === 0 ? (
          <div className="p-4 text-center text-secondary-500 dark:text-neutral-400 text-sm">
            No announcements yet
          </div>
        ) : (
          <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                className="p-4 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-sm font-semibold text-secondary-800 dark:text-white">
                        {announcement.label}
                      </h3>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded ${
                          announcement.isActive
                            ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400'
                            : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-400'
                        }`}
                      >
                        {announcement.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded ${
                          announcement.location === 'Manila'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                            : announcement.location === 'QuezonCity'
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                            : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        {announcement.location === 'Manila'
                          ? 'Manila'
                          : announcement.location === 'QuezonCity'
                          ? 'Quezon City'
                          : 'All Branches'}
                      </span>
                    </div>
                    <p className="text-xs text-secondary-600 dark:text-neutral-400 line-clamp-2 mb-1">
                      {announcement.description}
                    </p>
                    <p className="text-xs text-secondary-500 dark:text-neutral-500">
                      Posted: {new Date(announcement.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEdit(announcement)}
                      disabled={isSaving}
                      className="p-1.5 text-secondary-500 hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400 transition-colors disabled:opacity-50"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(announcement.id)}
                      disabled={isSaving}
                      className="p-1.5 text-secondary-500 hover:text-error-600 dark:text-neutral-400 dark:hover:text-error-400 transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnnouncementManagement;
