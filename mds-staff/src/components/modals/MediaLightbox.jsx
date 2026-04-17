import React, { useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, FileText } from 'lucide-react';

function normalizeContentType(contentType) {
	return String(contentType || '').split(';')[0].trim().toLowerCase();
}

function getMediaType(contentType, filename) {
	const normalized = normalizeContentType(contentType);

	if (normalized.startsWith('image/')) return 'image';
	if (normalized === 'application/pdf') return 'pdf';
	if (normalized.startsWith('video/')) return 'video';

	const ext = (filename || '').split('.').pop()?.toLowerCase() || '';
	if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
	if (ext === 'pdf') return 'pdf';
	if (['mp4', 'mov', 'webm', 'ogg', 'avi'].includes(ext)) return 'video';
	return 'file';
}

/**
 * Modal viewer for image/pdf/video attachments.
 * Rendered via portal to avoid being covered by app sidebars/stacking contexts.
 */
const MediaLightbox = ({ url, filename, contentType, onClose }) => {
	const mediaType = useMemo(() => getMediaType(contentType, filename), [contentType, filename]);
	const isPdf = mediaType === 'pdf';

	const handleKeyDown = useCallback((event) => {
		if (event.key === 'Escape') {
			onClose();
		}
	}, [onClose]);

	useEffect(() => {
		document.addEventListener('keydown', handleKeyDown);
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		return () => {
			document.removeEventListener('keydown', handleKeyDown);
			document.body.style.overflow = previousOverflow;
		};
	}, [handleKeyDown]);

	const handleBackdropClick = (event) => {
		if (event.target === event.currentTarget) {
			onClose();
		}
	};

	return createPortal(
		<div
			className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/80 p-4"
			onClick={handleBackdropClick}
		>
			<div
				className={`w-full max-w-5xl rounded-xl bg-white shadow-2xl dark:bg-neutral-900 ${
					isPdf ? 'h-[92vh]' : 'max-h-[92vh]'
				} flex flex-col overflow-hidden`}
				onClick={(event) => event.stopPropagation()}
			>
				<div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
					<div className="mr-4 min-w-0 flex-1">
						<p className="text-xs font-semibold text-secondary-800 dark:text-white">
							{mediaType === 'image' ? 'Image' : mediaType === 'pdf' ? 'Document' : mediaType === 'video' ? 'Video' : 'File'}
						</p>
						<p className="truncate font-mono text-[10px] text-secondary-400 dark:text-neutral-500">
							{filename || 'Attachment'}
						</p>
					</div>

					<button
						onClick={onClose}
						className="flex-shrink-0 rounded-lg p-1.5 text-secondary-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
						aria-label="Close"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				<div className={`min-h-0 flex-1 bg-neutral-100 dark:bg-neutral-800 ${isPdf ? 'overflow-hidden' : 'overflow-auto'}`}>
					{mediaType === 'image' ? (
						<div className="flex min-h-full items-center justify-center p-4">
							<img
								src={url}
								alt={filename || 'Image'}
								className="max-h-full max-w-full object-contain"
								loading="lazy"
								draggable={false}
								onContextMenu={(event) => event.preventDefault()}
							/>
						</div>
					) : mediaType === 'pdf' ? (
						<iframe
							src={url}
							title={filename || 'PDF Document'}
							className="h-full w-full border-0"
						/>
					) : mediaType === 'video' ? (
						<div className="flex min-h-full items-center justify-center p-4">
							<video
								src={url}
								controls
								controlsList="nodownload"
								className="max-h-full max-w-full"
							>
								Your browser does not support video playback.
							</video>
						</div>
					) : (
						<div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
							<div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700">
								<FileText className="h-8 w-8 text-neutral-400 dark:text-neutral-500" />
							</div>
							<p className="text-sm text-secondary-600 dark:text-neutral-300">Preview not available for this file type.</p>
							<p className="text-xs text-secondary-400 dark:text-neutral-500">{normalizeContentType(contentType) || 'Unknown type'}</p>
						</div>
					)}
				</div>
			</div>
		</div>,
		document.body
	);
};

export default MediaLightbox;
