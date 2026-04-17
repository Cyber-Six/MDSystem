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
import './announcement-management-theme.css';

const ANNOUNCEMENT_DETAILS_CACHE_TTL_MS = 5 * 60 * 1000;
const AUTH_IMAGE_SRC_CACHE = new Map();
const AUTH_IMAGE_FETCH_CACHE = new Map();

const getCachedAuthImageSrc = async (path) => {
  if (!path) return null;
  const cachedSrc = AUTH_IMAGE_SRC_CACHE.get(path);
  if (cachedSrc) return cachedSrc;
  const pendingFetch = AUTH_IMAGE_FETCH_CACHE.get(path);
  if (pendingFetch) return pendingFetch;
  const fetchPromise = axiosRequest
    .get(path, { responseType: 'blob' })
    .then((res) => {
      const objectUrl = URL.createObjectURL(res.data);
      AUTH_IMAGE_SRC_CACHE.set(path, objectUrl);
      AUTH_IMAGE_FETCH_CACHE.delete(path);
      return objectUrl;
    })
    .catch((error) => {
      AUTH_IMAGE_FETCH_CACHE.delete(path);
      throw error;
    });
  AUTH_IMAGE_FETCH_CACHE.set(path, fetchPromise);
  return fetchPromise;
};

function AuthImage({ path, alt, className, onClick }) {
  const [src, setSrc] = React.useState(null);
  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    getCachedAuthImageSrc(path)
      .then((cachedSrc) => { if (!cancelled) setSrc(cachedSrc); })
      .catch(() => { if (!cancelled) setSrc(null); });
    return () => { cancelled = true; };
  }, [path]);
  if (!src) return (
    <div className="w-full h-24 flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 rounded-lg">
      <span className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full" />
    </div>
  );
  return <img src={src} alt={alt} className={className} onClick={onClick} />;
}

function ImageLightbox({ src, onClose }) {
  if (!src) return null;
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
    >
      <div className="relative max-w-5xl w-full max-h-[90vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt="Enlarged preview" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 p-1.5 bg-neutral-900/70 hover:bg-neutral-900/90 text-white rounded-full transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ── Refined section header with improved visual hierarchy ── */
function SectionHeader({ children }) {
  return (
    <div className="mb-3 pb-2 border-b border-neutral-200 dark:border-neutral-700/60" style={{ marginBottom: '12px' }}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-400 dark:text-neutral-500" style={{ lineHeight: 1.2, margin: 0 }}>
        {children}
      </p>
    </div>
  );
}

/* ── Meta field: label + value pair with refined hierarchy ── */
function MetaField({ label, value, muted = false }) {
  return (
    <div className="flex flex-col" style={{ gap: '3px' }}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-400 dark:text-neutral-500" style={{ lineHeight: 1.2, margin: 0 }}>
        {label}
      </p>
      <p className={`text-xs leading-snug ${
        muted
          ? 'text-secondary-400 dark:text-neutral-500 italic'
          : 'font-medium text-secondary-800 dark:text-neutral-100'
      }`} style={{ lineHeight: 1.2 }}>
        {value}
      </p>
    </div>
  );
}

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
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const fileInputRef = React.useRef(null);
  const detailsRequestCacheRef = React.useRef({});
  const effectiveBranch = staffBranch || 'Both';
  const clientTimeZone = getAnnouncementTimeZone();

  const locationOptions = isAdmin || effectiveBranch === 'Both'
    ? [{ value: 'Both', label: 'All Branches' }, { value: 'Manila', label: 'Manila (Arlegui & Casal)' }, { value: 'QuezonCity', label: 'Quezon City' }]
    : effectiveBranch === 'Manila'
      ? [{ value: 'Both', label: 'All Branches' }, { value: 'Manila', label: 'Manila (Arlegui & Casal)' }]
      : [{ value: 'Both', label: 'All Branches' }, { value: 'QuezonCity', label: 'Quezon City' }];

  const defaultLocation = isAdmin || effectiveBranch === 'Both' ? 'Both' : effectiveBranch;

  const [formData, setFormData] = useState({
    label: '',
    description: '',
    isActive: true,
    location: defaultLocation,
    viewableUntil: '',
  });

  useEffect(() => {
    if (!editingId) {
      setFormData((prev) => ({ ...prev, location: defaultLocation }));
    }
  }, [defaultLocation, editingId]);

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
    const { hasFullDetails = true, fetchedAt = Date.now() } = options;
    setAnnouncementDetailsCache((previousCache) => ({
      ...previousCache,
      [announcementId]: { data: details, fetchedAt, hasFullDetails },
    }));
  };

  const ensureAnnouncementDetails = async (announcementSummary, options = {}) => {
    const { forceRefresh = false } = options;
    if (!announcementSummary?.id) return announcementSummary;
    const announcementId = announcementSummary.id;
    const pendingRequest = detailsRequestCacheRef.current[announcementId];
    if (pendingRequest) return pendingRequest;
    const cacheEntry = announcementDetailsCache[announcementId];
    const requiresFetch = forceRefresh || !cacheEntry || !cacheEntry.hasFullDetails || isDetailsCacheStale(cacheEntry);
    if (!requiresFetch) return cacheEntry.data;
    const detailsRequestPromise = (async () => {
      setDetailsLoadingId(announcementId);
      try {
        const fetchedAnnouncement = await fetchAnnouncementById(announcementId);
        const mergedAnnouncement = mergeAnnouncementDetails(announcementSummary, fetchedAnnouncement);
        setAnnouncementDetailsCacheEntry(announcementId, mergedAnnouncement, { hasFullDetails: true });
        return mergedAnnouncement;
      } catch (err) {
        const fallbackAnnouncement = mergeAnnouncementDetails(announcementSummary, cacheEntry?.data);
        setAnnouncementDetailsCacheEntry(announcementId, fallbackAnnouncement, { hasFullDetails: true });
        return fallbackAnnouncement;
      } finally {
        delete detailsRequestCacheRef.current[announcementId];
        setDetailsLoadingId((currentId) => (currentId === announcementId ? null : currentId));
      }
    })();
    detailsRequestCacheRef.current[announcementId] = detailsRequestPromise;
    return detailsRequestPromise;
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const processFile = async (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
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

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const removeImage = () => {
    setImagePreview(null);
    setStagedFileId(null);
    setExistingPubmat(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resetForm = () => {
    setFormData({ label: '', description: '', isActive: true, location: defaultLocation, viewableUntil: '' });
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
        viewableUntil: detailedAnnouncement.viewableUntil ? toLocal(detailedAnnouncement.viewableUntil, clientTimeZone) : '',
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
      const normalizedViewableUntil = formData.viewableUntil ? toUTC(formData.viewableUntil, clientTimeZone) : null;
      if (formData.viewableUntil && !normalizedViewableUntil) {
        setError(`Viewable Until must be a valid date and time in ${clientTimeZone}.`);
        return;
      }
      if (formData.viewableUntil && isPastLocalDateTime(formData.viewableUntil, clientTimeZone)) {
        setError('Viewable Until must be a future date and time.');
        return;
      }
      const payload = { ...formData, pubmat: stagedFileId || existingPubmat || null, viewableUntil: normalizedViewableUntil };
      let savedAnnouncement;
      if (editedAnnouncementId) {
        savedAnnouncement = await updateAnnouncement(editedAnnouncementId, payload);
      } else {
        savedAnnouncement = await createAnnouncement(payload);
      }
      if (savedAnnouncement?.id) {
        const normalizedDetails = mergeAnnouncementDetails(savedAnnouncement, savedAnnouncement);
        setAnnouncementDetailsCacheEntry(savedAnnouncement.id, normalizedDetails, { hasFullDetails: true });
      }
      resetForm();
      setIsFormOpen(false);
      await loadAnnouncements();
      if (editedAnnouncementId) setExpandedAnnouncementId(editedAnnouncementId);
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
    if (editedAnnouncementId) setExpandedAnnouncementId(editedAnnouncementId);
  };

  /* ── Shared input class matching the portal's input style ── */
  const inputCls = "w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors";

  const renderAnnouncementForm = ({ mode = 'create' } = {}) => {
    const isInlineEdit = mode === 'edit';
    const checkboxId = isInlineEdit ? `isActive-${editingId}` : 'isActive-create';

    return (
      <div className={
        isInlineEdit
          ? 'rounded-xl border border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800/60 p-5 mt-4'
          : 'bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-5'
      }>
        {/* Form section header */}
        <SectionHeader>{isInlineEdit ? 'Edit Announcement' : 'New Announcement'}</SectionHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-secondary-400 dark:text-neutral-500 mb-1.5">
              Title
            </label>
            <input
              type="text"
              name="label"
              value={formData.label}
              onChange={handleInputChange}
              placeholder="Enter announcement title"
              className={inputCls}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-secondary-400 dark:text-neutral-500 mb-1.5">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Enter announcement description"
              rows="4"
              className={inputCls}
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-secondary-400 dark:text-neutral-500 mb-1.5">
              Image / Pubmat <span className="normal-case font-normal text-neutral-400">(Optional)</span>
            </label>
            {!imagePreview && !existingPubmat ? (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => !isUploadingFile && fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center gap-2 w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors
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
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" onChange={handleFileChange} disabled={isUploadingFile} className="hidden" />
              </div>
            ) : (
              <div className="relative mt-1 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-600">
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
                  <p className="text-xs text-success-600 dark:text-success-400 px-3 py-1 bg-success-50 dark:bg-success-900/20 border-t border-neutral-200 dark:border-neutral-600">
                    Image ready to save
                  </p>
                )}
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" onChange={handleFileChange} disabled={isUploadingFile} className="hidden" />
              </div>
            )}
          </div>

          {/* Two-column row: Visibility + Viewable Until */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-secondary-400 dark:text-neutral-500 mb-1.5">
                Visibility
              </label>
              <select
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                className={inputCls}
              >
                {locationOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                Which branch patients see this.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-secondary-400 dark:text-neutral-500 mb-1.5">
                Viewable Until
              </label>
              <div className="flex gap-2">
                <input
                  type="datetime-local"
                  name="viewableUntil"
                  value={formData.viewableUntil}
                  onChange={handleInputChange}
                  min={getLocalMinDateTime(clientTimeZone, 1)}
                  className={inputCls}
                />
                {formData.viewableUntil && (
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, viewableUntil: '' }))}
                    className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 text-secondary-700 dark:text-neutral-300 text-sm font-medium rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors whitespace-nowrap"
                  >
                    Clear
                  </button>
                )}
              </div>
              {error && isFormOpen && (
                <p className="text-xs text-warning-600 dark:text-warning-400 mt-1.5">⚠ {error}</p>
              )}
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                Leave blank for indefinite visibility.
              </p>
            </div>
          </div>

          {/* Active Status — toggle style */}
          <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-neutral-100 dark:bg-neutral-700/50 border border-neutral-200 dark:border-neutral-600">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-secondary-400 dark:text-neutral-500">
                Status
              </p>
              <p className="text-sm font-medium text-secondary-700 dark:text-neutral-200 mt-0.5">
                {formData.isActive ? 'Active — publicly visible' : 'Inactive — hidden from patients'}
              </p>
            </div>
            <label htmlFor={checkboxId} className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                id={checkboxId}
                name="isActive"
                checked={formData.isActive}
                onChange={handleInputChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-neutral-300 dark:bg-neutral-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500 rounded-full peer peer-checked:bg-primary-500 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
            </label>
          </div>

          {/* Form error */}
          {error && !isFormOpen && (
            <p className="text-xs text-warning-600 dark:text-warning-400">⚠ {error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={handleCancelForm}
              className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 text-secondary-700 dark:text-neutral-300 text-sm font-medium rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || isUploadingFile}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
            >
              {isSaving ? 'Saving…' : isInlineEdit ? 'Update Announcement' : 'Create Announcement'}
            </button>
          </div>
        </form>
      </div>
    );
  };

  /* ── Loading skeleton ── */
  if (isLoading) {
    return (
      <div className="space-y-5 announcement-management-theme">
        <div className="flex items-end justify-between">
          <div className="space-y-2">
            <div className="h-7 w-52 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
            <div className="h-4 w-72 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
          </div>
          <div className="h-10 w-36 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse" />
        </div>
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-5 animate-pulse">
              <div className="flex gap-2 mb-3">
                <div className="h-5 w-32 bg-neutral-200 dark:bg-neutral-700 rounded" />
                <div className="h-5 w-16 bg-neutral-200 dark:bg-neutral-700 rounded-full" />
                <div className="h-5 w-20 bg-neutral-200 dark:bg-neutral-700 rounded-full" />
              </div>
              <div className="h-4 w-full bg-neutral-100 dark:bg-neutral-700/50 rounded mb-2" />
              <div className="h-4 w-2/3 bg-neutral-100 dark:bg-neutral-700/50 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isPermissionDenied) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-12 text-center announcement-management-theme">
        <div className="w-14 h-14 rounded-full bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-neutral-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <p className="text-secondary-700 dark:text-neutral-300 font-semibold">Access Denied</p>
        <p className="text-secondary-500 dark:text-neutral-400 text-sm mt-1">You do not have permission to manage announcements.</p>
      </div>
    );
  }

  const visibleAnnouncements = (isAdmin || effectiveBranch === 'Both')
    ? announcements
    : announcements.filter(a => a.location === 'Both' || a.location === effectiveBranch);

  return (
    <>
      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      <div className="space-y-5 announcement-management-theme">

        {/* ── Page Header ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-lg font-bold text-secondary-800 dark:text-white leading-none m-0">
              Announcements
            </h1>
            <p className="text-xs text-secondary-500 dark:text-neutral-400">
              Create clear, time-bound announcements with branch-aware visibility.
            </p>
          </div>
          <button
            onClick={() => {
              if (isFormOpen && !editingId) { handleCancelForm(); return; }
              resetForm();
              setIsFormOpen(true);
              setExpandedAnnouncementId(null);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-600 active:bg-primary-700"
          >
            {isFormOpen && !editingId ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Announcement
              </>
            )}
          </button>
        </div>

        {/* Global error */}
        {error && !isFormOpen && !editingId && (
          <div className="flex items-center gap-2 p-3 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg text-sm text-error-700 dark:text-error-400">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* Create form */}
        {isFormOpen && !editingId && renderAnnouncementForm({ mode: 'create' })}

        {/* Announcements List container */}
        <div className="space-y-2.5">
          {visibleAnnouncements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center rounded-lg border border-dashed border-neutral-200 dark:border-neutral-700">
              <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-secondary-600 dark:text-neutral-400">No announcements yet</p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">Click "+ New Announcement" to create one.</p>
            </div>
          ) : (
            <>
              {visibleAnnouncements.map((announcement) => {
                const cachedDetails = announcementDetailsCache[announcement.id]?.data;
                const announcementDetails = cachedDetails || announcement;
                const isExpanded = expandedAnnouncementId === announcement.id;
                const isEditing = editingId === announcement.id;
                const isLoadingExpandedDetails = detailsLoadingId === announcement.id;

                const locationLabel = announcementDetails.location === 'Manila'
                  ? 'Manila'
                  : announcementDetails.location === 'QuezonCity'
                  ? 'Quezon City'
                  : 'All Branches';

                const locationPillClass = announcementDetails.location === 'Manila'
                  ? 'announcement-pill--manila'
                  : announcementDetails.location === 'QuezonCity'
                  ? 'announcement-pill--qc'
                  : 'announcement-pill--all';

                return (
                  <div
                    key={announcement.id}
                    className={`rounded-lg border transition-all ${
                      isExpanded
                        ? 'border-primary-300 dark:border-primary-700/50 bg-white dark:bg-neutral-800/90 shadow-sm'
                        : 'border-neutral-200 dark:border-neutral-700/60 bg-white dark:bg-neutral-800 hover:shadow-md hover:border-neutral-300 dark:hover:border-neutral-600/80'
                    }`}
                  >
                    {/* ── Card header row (always visible) ── */}
                    <div
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      onClick={() => toggleExpandedAnnouncement(announcement)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleExpandedAnnouncement(announcement);
                        }
                      }}
                      className="flex items-start gap-3 px-4 py-3 cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                    >
                      {/* Status dot */}
                      <div className="shrink-0 mt-0.5">
                        <span className={`block w-2 h-2 rounded-full ${announcementDetails.isActive ? 'bg-success-500' : 'bg-neutral-300 dark:bg-neutral-600'}`} />
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        {/* Title + Pills row */}
                        <div className="flex flex-wrap items-center" style={{ gap: '6px', marginBottom: '9px' }}>
                          <h3 className="text-sm font-semibold text-secondary-800 dark:text-white truncate" style={{ lineHeight: 1.2, margin: 0 }}>
                            {announcementDetails.label}
                          </h3>
                          <span className={`announcement-pill px-2.5 py-0.5 text-[11px] ${announcementDetails.isActive ? 'announcement-pill--active' : 'announcement-pill--inactive'}`}>
                            {announcementDetails.isActive ? 'Active' : 'Inactive'}
                          </span>
                          <span className={`announcement-pill px-2.5 py-0.5 text-[11px] ${locationPillClass}`}>
                            {locationLabel}
                          </span>
                          {isEditing && (
                            <span className="rounded-md bg-primary-100 dark:bg-primary-900/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300">
                              Editing
                            </span>
                          )}
                        </div>

                        {/* Preview description */}
                        <p className="text-xs text-secondary-500 dark:text-neutral-400 line-clamp-1" style={{ lineHeight: 1.3 }}>
                          {announcementDetails.description || 'No description provided.'}
                        </p>
                      </div>

                      {/* Action buttons + chevron */}
                      <div className="flex items-center gap-1 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleEdit(announcement); }}
                          aria-pressed={isEditing}
                          disabled={isSaving}
                          className={`announcement-icon-button announcement-icon-button--edit p-2 disabled:opacity-50 ${isEditing ? 'announcement-icon-button--active' : ''}`}
                          title={isEditing ? 'Exit edit mode' : 'Edit'}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDelete(announcement.id); }}
                          disabled={isSaving}
                          className="announcement-icon-button announcement-icon-button--delete p-2 disabled:opacity-50"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>

                        {/* Chevron toggle */}
                        <div
                          className="p-2 text-neutral-400 dark:text-neutral-500 cursor-pointer"
                          onClick={() => toggleExpandedAnnouncement(announcement)}
                        >
                          <svg
                            className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* ── Expanded details panel ── */}
                    {isExpanded && !isEditing && (
                      <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-700/50">
                        {isLoadingExpandedDetails ? (
                          <div className="flex items-center gap-2 py-2 text-xs text-secondary-400 dark:text-neutral-500">
                            <span className="animate-spin w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full" />
                            Loading announcement details…
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Metadata grid — refined layout with better spacing */}
                            <div>
                              <SectionHeader>Details</SectionHeader>
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                <MetaField label="Visibility" value={locationLabel} />
                                <MetaField
                                  label="Status"
                                  value={announcementDetails.isActive ? 'Active' : 'Inactive'}
                                />
                                <MetaField
                                  label="Posted"
                                  value={
                                    formatAnnouncementDate(announcementDetails.created_at, clientTimeZone, {
                                      month: 'long', day: 'numeric', year: 'numeric',
                                    }) || 'Unknown'
                                  }
                                />
                                <MetaField
                                  label="Viewable Until"
                                  value={
                                    announcementDetails.viewableUntil
                                      ? formatAnnouncementDateTime(announcementDetails.viewableUntil, clientTimeZone)
                                      : 'Indefinite'
                                  }
                                />
                              </div>
                            </div>

                            {/* Full description */}
                            <div>
                              <SectionHeader>Full Description</SectionHeader>
                              <p className="text-[13px] leading-relaxed text-secondary-700 dark:text-neutral-300 whitespace-pre-wrap">
                                {announcementDetails.description || (
                                  <span className="italic text-secondary-400 dark:text-neutral-500">No description available.</span>
                                )}
                              </p>
                            </div>

                            {/* Pubmat */}
                            {announcementDetails.pubmat && (
                              <div>
                                <SectionHeader>Pubmat</SectionHeader>
                                <AuthImage
                                  path={`/media/record/announcement/${announcementDetails.pubmat}`}
                                  alt={announcementDetails.label || 'Announcement image'}
                                  className="w-full max-h-80 object-contain rounded-lg border border-neutral-200 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-800 cursor-zoom-in shadow-sm"
                                  onClick={(e) => { e.stopPropagation(); setLightboxSrc(e.currentTarget.src); }}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Inline edit form ── */}
                    {isExpanded && isEditing && (
                      <div
                        className="px-5 pb-5 border-t border-neutral-100 dark:border-neutral-700/60"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        {renderAnnouncementForm({ mode: 'edit' })}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* ── Delete Confirmation Modal ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-white dark:bg-neutral-800 rounded-xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-error-100 dark:bg-error-900/30 flex items-center justify-center">
              <svg className="w-7 h-7 text-error-600 dark:text-error-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div className="text-center">
              <h3 className="text-base font-semibold text-secondary-800 dark:text-white mb-1">
                Delete Announcement
              </h3>
              <p className="text-sm text-secondary-500 dark:text-neutral-400">
                Are you sure you want to delete{' '}
                <span className="font-medium text-secondary-700 dark:text-neutral-300">"{deleteConfirm.label}"</span>?{' '}
                This action cannot be undone.
              </p>
            </div>
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
                className="flex-1 px-4 py-2 bg-error-600 hover:bg-error-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AnnouncementManagement;