import React, { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, FileText } from 'lucide-react';

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const ZOOM_STEP = 0.25;

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
	const isImage = mediaType === 'image';
	const isPdf = mediaType === 'pdf';
	const [scale, setScale] = useState(1);
	const [pan, setPan] = useState({ x: 0, y: 0 });
	const [isDragging, setIsDragging] = useState(false);
	const dragOriginRef = useRef(null);

	const clampScale = useCallback((nextScale) => {
		return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(nextScale.toFixed(3))));
	}, []);

	const resetView = useCallback(() => {
		setScale(1);
		setPan({ x: 0, y: 0 });
		setIsDragging(false);
		dragOriginRef.current = null;
	}, []);

	const zoomIn = useCallback(() => {
		setScale((previousScale) => clampScale(previousScale + ZOOM_STEP));
	}, [clampScale]);

	const zoomOut = useCallback(() => {
		setScale((previousScale) => {
			const nextScale = clampScale(previousScale - ZOOM_STEP);
			if (nextScale <= 1) {
				setPan({ x: 0, y: 0 });
			}
			return nextScale;
		});
	}, [clampScale]);

	const handleKeyDown = useCallback((event) => {
		if (event.key === 'Escape') {
			onClose();
			return;
		}

		if (!isImage) {
			return;
		}

		if (event.key === '+' || event.key === '=') {
			event.preventDefault();
			zoomIn();
		} else if (event.key === '-') {
			event.preventDefault();
			zoomOut();
		} else if (event.key === '0') {
			event.preventDefault();
			resetView();
		}
	}, [onClose, isImage, zoomIn, zoomOut, resetView]);

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

	const handleWheel = useCallback((event) => {
		if (!isImage) {
			return;
		}

		event.preventDefault();
		const delta = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
		setScale((previousScale) => {
			const nextScale = clampScale(previousScale + delta);
			if (nextScale <= 1) {
				setPan({ x: 0, y: 0 });
			}
			return nextScale;
		});
	}, [isImage, clampScale]);

	const handleMouseDown = useCallback((event) => {
		if (!isImage || scale <= 1 || event.button !== 0) {
			return;
		}

		event.preventDefault();
		setIsDragging(true);
		dragOriginRef.current = {
			x: event.clientX - pan.x,
			y: event.clientY - pan.y
		};
	}, [isImage, scale, pan.x, pan.y]);

	const handleMouseMove = useCallback((event) => {
		if (!isDragging || !dragOriginRef.current) {
			return;
		}

		setPan({
			x: event.clientX - dragOriginRef.current.x,
			y: event.clientY - dragOriginRef.current.y
		});
	}, [isDragging]);

	const handleMouseUp = useCallback(() => {
		setIsDragging(false);
		dragOriginRef.current = null;
	}, []);

	useEffect(() => {
		resetView();
	}, [url, mediaType, resetView]);

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

					{isImage && (
						<div className="mr-2 flex items-center gap-1">
							<button
								onClick={zoomOut}
								disabled={scale <= MIN_SCALE}
								className="rounded-lg px-2 py-1 text-xs font-semibold text-secondary-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-300 dark:hover:bg-neutral-700"
								title="Zoom out"
							>
								-
							</button>
							<button
								onClick={resetView}
								className="rounded-lg px-2 py-1 text-[11px] font-mono text-secondary-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
								title="Reset zoom"
							>
								{Math.round(scale * 100)}%
							</button>
							<button
								onClick={zoomIn}
								disabled={scale >= MAX_SCALE}
								className="rounded-lg px-2 py-1 text-xs font-semibold text-secondary-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-300 dark:hover:bg-neutral-700"
								title="Zoom in"
							>
								+
							</button>
						</div>
					)}

					<button
						onClick={onClose}
						className="flex-shrink-0 rounded-lg p-1.5 text-secondary-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
						aria-label="Close"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				<div className={`min-h-0 flex-1 bg-neutral-100 dark:bg-neutral-800 ${isPdf ? 'overflow-hidden' : 'overflow-auto'}`}>
					{isImage ? (
						<div
							className="flex min-h-full items-center justify-center overflow-hidden p-4"
							onWheel={handleWheel}
							onMouseDown={handleMouseDown}
							onMouseMove={handleMouseMove}
							onMouseUp={handleMouseUp}
							onMouseLeave={handleMouseUp}
							onDoubleClick={resetView}
							style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in' }}
						>
							<img
								src={url}
								alt={filename || 'Image'}
								className="object-contain"
								loading="lazy"
								draggable={false}
								onContextMenu={(event) => event.preventDefault()}
								style={{
									maxWidth: scale > 1 ? 'none' : '100%',
									maxHeight: scale > 1 ? 'none' : '100%',
									transform: `scale(${scale}) translate(${pan.x / scale}px, ${pan.y / scale}px)`,
									transformOrigin: 'center center',
									transition: isDragging ? 'none' : 'transform 120ms ease-out',
									userSelect: 'none',
									pointerEvents: 'none'
								}}
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
