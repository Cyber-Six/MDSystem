import React, { useState, useEffect } from 'react';
import {
  fetchAllAnnouncementsAdmin,
  fetchAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  uploadPubmat,
} from '../announcement-service';
import { axiosRequest } from '../../../packages-core-adapter';
import { usePermissions } from '../../../context/permissions-context';
import {
  formatAnnouncementDate,
  formatAnnouncementDateTime,
  getAnnouncementTimeZone,
  getLocalMinDateTime,
  isPastLocalDateTime,
  toLocal,
  toUTC,
} from '../timezoneUtils';

const ANNOUNCEMENT_DETAILS_CACHE_TTL_MS = 5 * 60 * 1000;

/* Authenticated image loader — media endpoints require JWT */
function AuthImage({ path, alt, className, onClick }) {
  const [src, setSrc] = React.useState(null);
  useEffect(() => {
    let objectUrl = null, cancelled = false;
    axiosRequest.get(path, { responseType: 'blob' })
      .then((res) => { if (!cancelled) { objectUrl = URL.createObjectURL(res.data); setSrc(objectUrl); } })
      .catch(() => {});
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path]);
  if (!src) return <div className="w-full h-24 flex items-center justify-center"><span className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full" /></div>;
  return <img src={src} alt={alt} className={className} onClick={onClick} />;
}

/* Simple lightbox overlay */
function ImageLightbox({ src, onClose }) {
  if (!src) return null;
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
    >
      <div className="relative max-w-5xl w-full max-h-[90vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <img
          src={src}
          alt="Enlarged preview"
          className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
        />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 p-1.5 bg-neutral-900/70 hover:bg-neutral-900/90 text-white rounded-full transition-colors"
          title="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * Announcement Management Component
 * Staff interface to manage announcements (CRUD)
 */
const AnnouncementManagement = () => {
  const { branch: staffBranch, isAdmin } = usePermissions();
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedAnnouncementId, setExpandedAnnouncementId] = useState(null);
  const [detailsLoadingId, setDetailsLoadingId] = useState(null);
  const [announcementDetailsCache, setAnnouncementDetailsCache] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [stagedFileId, setStagedFileId] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [existingPubmat, setExistingPubmat] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, label }
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const fileInputRef = React.useRef(null);
  // Use staffBranch from usePermissions() — already sourced from MedicalPersonnel.designation (authoritative)
  const effectiveBranch = staffBranch || 'Both';
  const clientTimeZone = getAnnouncementTimeZone();

  // Compute allowed location options based on branch.
  // Manila and QuezonCity staff can also create/manage 'All Branches' announcements.
  const locationOptions = isAdmin || effectiveBranch === 'Both'
    ? [{ value: 'Both', label: 'All Branches' }, { value: 'Manila', label: 'Manila (Arlegui & Casal)' }, { value: 'QuezonCity', label: 'Quezon City' }]
    : effectiveBranch === 'Manila'
      ? [{ value: 'Both', label: 'All Branches' }, { value: 'Manila', label: 'Manila (Arlegui & Casal)' }]
      : [{ value: 'Both', label: 'All Branches' }, { value: 'QuezonCity', label: 'Quezon City' }];

  // Default to staff's own branch when creating, not 'Both'
  const defaultLocation = isAdmin || effectiveBranch === 'Both' ? 'Both' : effectiveBranch;

  const [formData, setFormData] = useState({
    label: '',
    description: '',
    isActive: true,
    location: defaultLocation,
    viewableUntil: '',
  });

  // Update form default location when branch info becomes available
  useEffect(() => {
    if (!editingId) {
      setFormData((prev) => ({ ...prev, location: defaultLocation }));
    }
  }, [defaultLocation, editingId]);

  // Fetch announcements on mount
  useEffect(() => {
    loadAnnouncements();
  }, []);

  const [isPermissionDenied, setIsPermissionDenied] = useState(false);

  const loadAnnouncements = async () => {
    try {
      setIsLoading(true);
      const { data } = await fetchAllAnnouncementsAdmin();
      setAnnouncements(data);
      setAnnouncementDetailsCache((previousCache) => {
        const nextCache = { ...previousCache };

        data.forEach((announcement) => {
          const existingEntry = nextCache[announcement.id];
          if (existingEntry) {
            nextCache[announcement.id] = {
              ...existingEntry,
              data: mergeAnnouncementDetails(announcement, existingEntry.data),
            };
          } else {
            nextCache[announcement.id] = {
              data: mergeAnnouncementDetails(announcement, announcement),
              fetchedAt: 0,
              hasFullDetails: false,
            };
          }
        });

        return nextCache;
      });
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

  const mergeAnnouncementDetails = (baseAnnouncement, detailedAnnouncement) => ({
    id: detailedAnnouncement?.id ?? baseAnnouncement?.id,
    label: detailedAnnouncement?.label ?? baseAnnouncement?.label ?? '',
    description: detailedAnnouncement?.description ?? baseAnnouncement?.description ?? '',
    pubmat: detailedAnnouncement?.pubmat ?? baseAnnouncement?.pubmat ?? null,
    isActive: detailedAnnouncement?.isActive ?? baseAnnouncement?.isActive ?? true,
    location: detailedAnnouncement?.location ?? baseAnnouncement?.location ?? 'Both',
    created_at: detailedAnnouncement?.created_at ?? baseAnnouncement?.created_at ?? null,
    viewableUntil: detailedAnnouncement?.viewableUntil ?? baseAnnouncement?.viewableUntil ?? null,
  });

  const isDetailsCacheStale = (cacheEntry) => {
    if (!cacheEntry?.fetchedAt) return true;
    return (Date.now() - cacheEntry.fetchedAt) > ANNOUNCEMENT_DETAILS_CACHE_TTL_MS;
  };

  const setAnnouncementDetailsCacheEntry = (announcementId, details, options = {}) => {
    const {
      hasFullDetails = true,
      fetchedAt = Date.now(),
    } = options;

    setAnnouncementDetailsCache((previousCache) => ({
      ...previousCache,
      [announcementId]: {
        data: details,
        fetchedAt,
        hasFullDetails,
      },
    }));
  };

  const ensureAnnouncementDetails = async (announcementSummary, options = {}) => {
    const { forceRefresh = false } = options;
    if (!announcementSummary?.id) return announcementSummary;

    const cacheEntry = announcementDetailsCache[announcementSummary.id];
    const requiresFetch = forceRefresh
      || !cacheEntry
      || !cacheEntry.hasFullDetails
      || isDetailsCacheStale(cacheEntry);

    if (!requiresFetch) {
      return cacheEntry.data;
    }

    setDetailsLoadingId(announcementSummary.id);
    try {
      const fetchedAnnouncement = await fetchAnnouncementById(announcementSummary.id);
      const mergedAnnouncement = mergeAnnouncementDetails(announcementSummary, fetchedAnnouncement);

      setAnnouncementDetailsCacheEntry(announcementSummary.id, mergedAnnouncement, {
        hasFullDetails: true,
      });

      return mergedAnnouncement;
    } catch (err) {
      const fallbackAnnouncement = mergeAnnouncementDetails(
        announcementSummary,
        cacheEntry?.data,
      );

      // Cache fallback details after a fetch attempt to avoid unnecessary refetches until stale.
      setAnnouncementDetailsCacheEntry(announcementSummary.id, fallbackAnnouncement, {
        hasFullDetails: true,
      });

      return fallbackAnnouncement;
    } finally {
      setDetailsLoadingId((currentId) => (
        currentId === announcementSummary.id ? null : currentId
      ));
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const processFile = async (file) => {
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
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    await processFile(file);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type === 'image/jpeg' || file.type === 'image/png')) {
      await processFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const removeImage = () => {
    setImagePreview(null);
    setStagedFileId(null);
    setExistingPubmat(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resetForm = () => {
    setFormData({
      label: '',
      description: '',
      isActive: true,
      location: defaultLocation,
      viewableUntil: '',
    });
    setEditingId(null);
    setStagedFileId(null);
    setImagePreview(null);
    setExistingPubmat(null);
  };

  const handleEdit = async (announcement) => {
    try {
      const detailedAnnouncement = await ensureAnnouncementDetails(announcement);

      setFormData({
        label: detailedAnnouncement.label || '',
        description: detailedAnnouncement.description || '',
        isActive: detailedAnnouncement.isActive !== false,
        location: detailedAnnouncement.location || 'Both',
        viewableUntil: detailedAnnouncement.viewableUntil
          ? toLocal(detailedAnnouncement.viewableUntil, clientTimeZone)
          : '',
      });
      setEditingId(detailedAnnouncement.id);
      setStagedFileId(null);
      setImagePreview(null);
      setExistingPubmat(detailedAnnouncement.pubmat || null);
      setIsFormOpen(false);
      setExpandedAnnouncementId(detailedAnnouncement.id);
    } catch (err) {
      console.error('Error in handleEdit:', err);
      setError('Failed to open edit form. Please try again.');
    }
  };

  const toggleExpandedAnnouncement = async (announcement) => {
    if (!announcement?.id) return;

    if (expandedAnnouncementId === announcement.id) {
      if (editingId === announcement.id) {
        setEditingId(null);
        setStagedFileId(null);
        setImagePreview(null);
        setExistingPubmat(null);
      }
      setExpandedAnnouncementId(null);
      return;
    }

    if (editingId && editingId !== announcement.id) {
      setEditingId(null);
      setStagedFileId(null);
      setImagePreview(null);
      setExistingPubmat(null);
    }

    setIsFormOpen(false);
    setExpandedAnnouncementId(announcement.id);
    await ensureAnnouncementDetails(announcement);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setError(null);
      const editedAnnouncementId = editingId;

      const normalizedViewableUntil = formData.viewableUntil
        ? toUTC(formData.viewableUntil, clientTimeZone)
        : null;

      if (formData.viewableUntil && !normalizedViewableUntil) {
        setError(`Viewable Until must be a valid date and time in ${clientTimeZone}.`);
        return;
      }

      if (formData.viewableUntil && isPastLocalDateTime(formData.viewableUntil, clientTimeZone)) {
        setError('Viewable Until must be a future date and time.');
        return;
      }

      const payload = {
        ...formData,
        pubmat: stagedFileId || existingPubmat || null,
        viewableUntil: normalizedViewableUntil,
      };

      let savedAnnouncement;

      if (editedAnnouncementId) {
        savedAnnouncement = await updateAnnouncement(editedAnnouncementId, payload);
      } else {
        savedAnnouncement = await createAnnouncement(payload);
      }

      if (savedAnnouncement?.id) {
        const normalizedDetails = mergeAnnouncementDetails(savedAnnouncement, savedAnnouncement);
        setAnnouncementDetailsCacheEntry(savedAnnouncement.id, normalizedDetails, {
          hasFullDetails: true,
        });
      }

      resetForm();
      setIsFormOpen(false);
      await loadAnnouncements();

      if (editedAnnouncementId) {
        setExpandedAnnouncementId(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to save announcement');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const announcement = announcements.find((a) => a.id === id);
    setDeleteConfirm({ id, label: announcement?.label || 'this announcement' });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    setDeleteConfirm(null);
    try {
      setIsSaving(true);
      await deleteAnnouncement(id);
      setExpandedAnnouncementId((currentId) => (currentId === id ? null : currentId));
      await loadAnnouncements();
    } catch (err) {
      setError(err.message || 'Failed to delete announcement');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelForm = () => {
    const editedAnnouncementId = editingId;
    resetForm();
    setIsFormOpen(false);

    if (editedAnnouncementId) {
      setExpandedAnnouncementId(editedAnnouncementId);
    }
  };

  const renderAnnouncementForm = ({ mode = 'create' } = {}) => {
    const isInlineEdit = mode === 'edit';
    const checkboxId = isInlineEdit ? `isActive-${editingId}` : 'isActive-create';

    return (
      <div
        className={isInlineEdit
          ? 'rounded-lg border border-neutral-200 dark:border-neutral-600 bg-neutral-50/80 dark:bg-neutral-800/60 p-4'
          : 'bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4'
        }
      >
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

            {/* Drag-and-drop zone */}
            {!imagePreview && !existingPubmat ? (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => !isUploadingFile && fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center gap-2 w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors
                  ${isDragging
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-700/40 hover:border-primary-400 hover:bg-primary-50/50 dark:hover:bg-primary-900/10'
                  }
                  ${isUploadingFile ? 'pointer-events-none opacity-60' : ''}
                `}
              >
                {isUploadingFile ? (
                  <span className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
                ) : (
                  <svg className="w-8 h-8 text-neutral-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
                <span className="text-xs text-secondary-500 dark:text-neutral-400">
                  {isUploadingFile ? 'Uploading…' : 'Drag & drop or click to upload'}
                </span>
                <span className="text-xs text-neutral-400 dark:text-neutral-500">PNG, JPG accepted</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handleFileChange}
                  disabled={isUploadingFile}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="relative mt-1 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-600">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full max-h-48 object-contain bg-neutral-100 dark:bg-neutral-700 cursor-zoom-in"
                    onClick={() => setLightboxSrc(imagePreview)}
                    title="Click to enlarge"
                  />
                ) : (
                  <div>
                    <AuthImage
                      path={`/media/record/announcement/${existingPubmat}`}
                      alt="Current announcement image"
                      className="w-full max-h-48 object-contain bg-neutral-100 dark:bg-neutral-700 cursor-zoom-in"
                      onClick={(e) => setLightboxSrc(e.currentTarget.src)}
                      title="Click to enlarge"
                    />
                    <p className="text-xs text-secondary-500 dark:text-neutral-400 px-3 py-1 border-t border-neutral-200 dark:border-neutral-600">
                      Upload a new file to replace it
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-2 right-2 p-1 bg-neutral-900/60 hover:bg-neutral-900/80 text-white rounded-full transition-colors"
                  title="Remove image"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                {imagePreview && !isUploadingFile && (
                  <p className="text-xs text-success-600 dark:text-success-400 px-3 py-1 bg-success-50 dark:bg-success-900/20 border-t border-neutral-200 dark:border-neutral-600 mb-0">
                    Image ready to save
                  </p>
                )}
                {/* Hidden input for re-upload */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handleFileChange}
                  disabled={isUploadingFile}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Branch / Location */}
          <div>
            <label className="block text-xs font-semibold text-secondary-700 dark:text-neutral-300 mb-1">
              Announcement Visibility
            </label>
            <select
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded text-sm bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {locationOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-1">
              Controls which branch patients can see this announcement.
            </p>
          </div>

          {/* Viewable Until */}
          <div>
            <label className="block text-xs font-semibold text-secondary-700 dark:text-neutral-300 mb-1">
              Viewable Until
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="datetime-local"
                name="viewableUntil"
                value={formData.viewableUntil}
                onChange={handleInputChange}
                min={getLocalMinDateTime(clientTimeZone, 1)}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded text-sm bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {formData.viewableUntil && (
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, viewableUntil: '' }))}
                  className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 text-secondary-700 dark:text-neutral-300 text-sm font-medium rounded hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            {error && (
              <p className="text-xs text-warning-600 dark:text-warning-400 mt-2">
                ⚠ {error}
              </p>
            )}
            <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-1">
              Timezone: {clientTimeZone}. Leave blank to keep this announcement visible indefinitely.
            </p>
          </div>

          {/* Active Status */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={checkboxId}
              name="isActive"
              checked={formData.isActive}
              onChange={handleInputChange}
              className="rounded border-neutral-300 dark:border-neutral-600 text-primary-500 focus:ring-primary-500"
            />
            <label htmlFor={checkboxId} className="text-xs text-secondary-700 dark:text-neutral-300">
              Active (publicly visible)
            </label>
          </div>

          {/* Submit Button */}
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={handleCancelForm}
              className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 text-secondary-700 dark:text-neutral-300 text-sm font-medium rounded hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || isUploadingFile}
              className="px-3 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-white text-sm font-medium rounded transition-colors"
            >
              {isSaving ? 'Saving...' : isInlineEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    );
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
    <>
    <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-secondary-800 dark:text-white">
          Announcements Management
        </h2>
        <button
          onClick={() => {
            if (isFormOpen && !editingId) {
              handleCancelForm();
              return;
            }
            resetForm();
            setIsFormOpen(true);
            setExpandedAnnouncementId(null);
          }}
          className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded transition-colors"
        >
          {isFormOpen && !editingId ? 'Cancel' : '+ New Announcement'}
        </button>
      </div>

      {/* Error Message */}
      {error && !isFormOpen && !editingId && (
        <div className="p-3 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded text-sm text-error-700 dark:text-error-400">
          {error}
        </div>
      )}

      {/* Form */}
      {isFormOpen && !editingId && renderAnnouncementForm({ mode: 'create' })}

      {/* Announcements List */}
      {(() => {
        // Client-side filter: Manila/QC staff see only their branch + 'Both' announcements
        const visibleAnnouncements = (isAdmin || effectiveBranch === 'Both')
          ? announcements
          : announcements.filter(a => a.location === 'Both' || a.location === effectiveBranch);
        return (
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
        {visibleAnnouncements.length === 0 ? (
          <div className="p-4 text-center text-secondary-500 dark:text-neutral-400 text-sm">
            No announcements yet
          </div>
        ) : (
          <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {visibleAnnouncements.map((announcement) => (
              (() => {
                const cachedDetails = announcementDetailsCache[announcement.id]?.data;
                const announcementDetails = cachedDetails || announcement;
                const isExpanded = expandedAnnouncementId === announcement.id;
                const isLoadingExpandedDetails = detailsLoadingId === announcement.id;

                return (
              <div
                key={announcement.id}
                onClick={() => toggleExpandedAnnouncement(announcement)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleExpandedAnnouncement(announcement);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                className={`p-4 transition-colors cursor-pointer ${
                  isExpanded
                    ? 'bg-neutral-100 dark:bg-neutral-700/60'
                    : 'hover:bg-neutral-50 dark:hover:bg-neutral-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-sm font-semibold text-secondary-800 dark:text-white">
                        {announcementDetails.label}
                      </h3>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded ${
                          announcementDetails.isActive
                            ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400'
                            : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-400'
                        }`}
                      >
                        {announcementDetails.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded ${
                          announcementDetails.location === 'Manila'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                            : announcementDetails.location === 'QuezonCity'
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                            : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        {announcementDetails.location === 'Manila'
                          ? 'Manila'
                          : announcementDetails.location === 'QuezonCity'
                          ? 'Quezon City'
                          : 'All Branches'}
                      </span>
                      <span className="text-[11px] font-medium text-secondary-500 dark:text-neutral-400">
                        {isExpanded ? 'Hide details' : 'View details'}
                      </span>
                    </div>
                    <p className={`text-xs text-secondary-600 dark:text-neutral-400 mb-1 ${
                      isExpanded
                        ? 'whitespace-pre-wrap leading-relaxed'
                        : 'line-clamp-2'
                    }`}>
                      {announcementDetails.description}
                    </p>
                    <p className="text-xs text-secondary-500 dark:text-neutral-500">
                      Posted: {formatAnnouncementDate(announcementDetails.created_at, clientTimeZone, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      }) || 'Unknown'}
                    </p>
                    <p className="text-xs text-secondary-500 dark:text-neutral-500">
                      Viewable Until: {announcementDetails.viewableUntil
                        ? formatAnnouncementDateTime(announcementDetails.viewableUntil, clientTimeZone)
                        : 'Indefinite'}
                    </p>

                    {isExpanded && isLoadingExpandedDetails && (
                      <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-600">
                        <div className="flex items-center gap-2 text-xs text-secondary-500 dark:text-neutral-400">
                          <span className="animate-spin w-3.5 h-3.5 border-2 border-primary-500 border-t-transparent rounded-full" />
                          Loading latest announcement details...
                        </div>
                      </div>
                    )}

                    {isExpanded && editingId !== announcement.id && (
                      <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-600 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-secondary-600 dark:text-neutral-300">
                          <p>
                            <span className="font-semibold text-secondary-700 dark:text-neutral-200">Visibility:</span>{' '}
                            {announcementDetails.location === 'Manila'
                              ? 'Manila'
                              : announcementDetails.location === 'QuezonCity'
                                ? 'Quezon City'
                                : 'All Branches'}
                          </p>
                          <p>
                            <span className="font-semibold text-secondary-700 dark:text-neutral-200">Status:</span>{' '}
                            {announcementDetails.isActive ? 'Active' : 'Inactive'}
                          </p>
                          <p>
                            <span className="font-semibold text-secondary-700 dark:text-neutral-200">Posted:</span>{' '}
                            {formatAnnouncementDate(announcementDetails.created_at, clientTimeZone, {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            }) || 'Unknown'}
                          </p>
                          <p>
                            <span className="font-semibold text-secondary-700 dark:text-neutral-200">Viewable Until:</span>{' '}
                            {announcementDetails.viewableUntil
                              ? formatAnnouncementDateTime(announcementDetails.viewableUntil, clientTimeZone)
                              : 'Indefinite'}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-secondary-700 dark:text-neutral-200 mb-1">
                            Full Description
                          </p>
                          <p className="text-sm text-secondary-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">
                            {announcementDetails.description || 'No description available'}
                          </p>
                        </div>

                        {announcementDetails.pubmat && (
                          <div>
                            <p className="text-xs font-semibold text-secondary-700 dark:text-neutral-200 mb-1">
                              Pubmat
                            </p>
                            <AuthImage
                              path={`/media/record/announcement/${announcementDetails.pubmat}`}
                              alt={announcementDetails.label || 'Announcement image'}
                              className="w-full max-h-80 object-contain rounded border border-neutral-200 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-800 cursor-zoom-in"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxSrc(e.currentTarget.src);
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {isExpanded && editingId === announcement.id && (
                      <div
                        className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-600"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        {renderAnnouncementForm({ mode: 'edit' })}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(announcement);
                      }}
                      disabled={isSaving}
                      className="p-1.5 text-secondary-500 hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400 transition-colors disabled:opacity-50"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(announcement.id);
                      }}
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
                );
              })()
            ))}
          </div>
        )}
      </div>
        );
      })()}
      
      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDeleteConfirm(null)}
          />
          {/* Dialog */}
          <div className="relative bg-white dark:bg-neutral-800 rounded-xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center gap-4">
            {/* Icon */}
            <div className="w-14 h-14 rounded-full bg-error-100 dark:bg-error-900/30 flex items-center justify-center">
              <svg className="w-7 h-7 text-error-600 dark:text-error-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            {/* Text */}
            <div className="text-center">
              <h3 className="text-base font-semibold text-secondary-800 dark:text-white mb-1">
                Delete Announcement
              </h3>
              <p className="text-sm text-secondary-500 dark:text-neutral-400">
                Are you sure you want to delete{' '}
                <span className="font-medium text-secondary-700 dark:text-neutral-300">
                  "{deleteConfirm.label}"
                </span>
                ? This action cannot be undone.
              </p>
            </div>
            {/* Actions */}
            <div className="flex gap-3 w-full">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-600 text-secondary-700 dark:text-neutral-300 text-sm font-medium rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 bg-error-600 hover:bg-error-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default AnnouncementManagement;
