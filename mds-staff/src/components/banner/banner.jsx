import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useBanner } from '../../context/use-banner.js';
import { getStaffSettings } from '../../context/settings-context.jsx';
import styles from './banner.module.css';

const SLIDE_OUT_DURATION = 320; // ms — must match CSS animation duration

/**
 * Group banners by "type:message" key, preserving first-seen order.
 * Returns a Map<key, { repId, ids, type, message, error }>.
 */
function buildGroupMap(banners) {
  const map = new Map();
  banners.forEach((b) => {
    const key = `${b.type}:${b.message}`;
    if (!map.has(key)) {
      map.set(key, { repId: b.id, ids: [], type: b.type, message: b.message, error: b.error });
    }
    map.get(key).ids.push(b.id);
  });
  return map;
}

const Banner = () => {
  const { banners, dismissBanner } = useBanner();
  const autoDismissTimersRef = useRef({});
  const [exitingIds, setExitingIds] = useState(new Set());

  // Always-current banners ref for reading inside timer callbacks.
  const bannersRef = useRef(banners);
  useEffect(() => { bannersRef.current = banners; }, [banners]);

  /**
   * Animated dismiss for a group: slide-right animation on repId, then
   * dismiss every id in allIds from the banner service.
   */
  const triggerDismissGroup = useCallback((repId, allIds) => {
    setExitingIds((prev) => {
      if (prev.has(repId)) return prev;
      return new Set([...prev, repId]);
    });
    setTimeout(() => {
      allIds.forEach((id) => dismissBanner(id));
      setExitingIds((prev) => {
        const next = new Set(prev);
        next.delete(repId);
        return next;
      });
    }, SLIDE_OUT_DURATION);
  }, [dismissBanner]);

  /** Single-banner animated dismiss. */
  const triggerDismiss = useCallback((id) => {
    triggerDismissGroup(id, [id]);
  }, [triggerDismissGroup]);

  /**
   * Auto-dismiss effect.
   * Compact mode  → one timer per group key; reads current group members from
   *                 bannersRef at fire-time so late-arriving same-message banners
   *                 are also dismissed together.
   * Normal mode   → one timer per individual banner id.
   */
  useEffect(() => {
    const s = getStaffSettings();

    if (!s.bannerAutoDismiss) {
      Object.values(autoDismissTimersRef.current).forEach(clearTimeout);
      autoDismissTimersRef.current = {};
      return;
    }

    const delay = Math.max(1, s.bannerDismissDelay || 5) * 1000;

    // Mirror the same visibility filter used at render time.
    let visibleBanners = [...banners];
    if (!s.showBanners) {
      visibleBanners = banners.filter((b) => b.type === 'error');
    } else if (s.bannerErrorsOnly) {
      visibleBanners = visibleBanners.filter((b) => b.type === 'error');
    }

    if (s.bannerCompact) {
      // Remove any lingering individual timers from a previous non-compact state.
      Object.keys(autoDismissTimersRef.current).forEach((key) => {
        if (!key.startsWith('group:')) {
          clearTimeout(autoDismissTimersRef.current[key]);
          delete autoDismissTimersRef.current[key];
        }
      });

      const groupMap = buildGroupMap(visibleBanners);

      groupMap.forEach((_, key) => {
        const timerKey = `group:${key}`;
        if (!autoDismissTimersRef.current[timerKey]) {
          autoDismissTimersRef.current[timerKey] = setTimeout(() => {
            // Read current membership so late-arriving same-message banners are included.
            const curr = bannersRef.current;
            const groupBanners = curr.filter((b) => `${b.type}:${b.message}` === key);
            if (groupBanners.length > 0) {
              triggerDismissGroup(groupBanners[0].id, groupBanners.map((b) => b.id));
            }
            delete autoDismissTimersRef.current[timerKey];
          }, delay);
        }
      });

      return () => {
        const activeTimerKeys = new Set([...groupMap.keys()].map((k) => `group:${k}`));
        Object.keys(autoDismissTimersRef.current).forEach((timerKey) => {
          if (timerKey.startsWith('group:') && !activeTimerKeys.has(timerKey)) {
            clearTimeout(autoDismissTimersRef.current[timerKey]);
            delete autoDismissTimersRef.current[timerKey];
          }
        });
      };
    } else {
      // Remove any lingering group timers from a previous compact state.
      Object.keys(autoDismissTimersRef.current).forEach((key) => {
        if (key.startsWith('group:')) {
          clearTimeout(autoDismissTimersRef.current[key]);
          delete autoDismissTimersRef.current[key];
        }
      });

      // Keys stored as strings because Object.keys always returns strings.
      visibleBanners.forEach((banner) => {
        const key = String(banner.id);
        if (!autoDismissTimersRef.current[key]) {
          autoDismissTimersRef.current[key] = setTimeout(() => {
            triggerDismiss(banner.id);
            delete autoDismissTimersRef.current[key];
          }, delay);
        }
      });

      return () => {
        const currentKeys = new Set(visibleBanners.map((b) => String(b.id)));
        Object.keys(autoDismissTimersRef.current).forEach((key) => {
          if (!key.startsWith('group:') && !currentKeys.has(key)) {
            clearTimeout(autoDismissTimersRef.current[key]);
            delete autoDismissTimersRef.current[key];
          }
        });
      };
    }
  }, [banners, triggerDismiss, triggerDismissGroup]);

  if (banners.length === 0 && exitingIds.size === 0) return null;

  const s = getStaffSettings();

  // Apply banner visibility filters.
  let visibleBanners = [...banners];
  if (!s.showBanners) {
    visibleBanners = banners.filter((b) => b.type === 'error');
  } else if (s.bannerErrorsOnly) {
    visibleBanners = visibleBanners.filter((b) => b.type === 'error');
  }

  if (visibleBanners.length === 0 && exitingIds.size === 0) return null;

  // ── Compact mode: group by type:message ──────────────────────────────────
  if (s.bannerCompact) {
    const groupMap = buildGroupMap(visibleBanners);
    let groups = [...groupMap.values()];

    // Optionally cap the number of visible groups (most-recent N).
    const max = Math.max(1, s.bannerMaxVisible || 3);
    if (groups.length > max) groups = groups.slice(-max);

    return (
      <div className={styles.bannerContainer}>
        {groups.map((group) => (
          <div
            key={group.repId}
            className={`${styles.banner} ${styles[group.type]}${exitingIds.has(group.repId) ? ` ${styles.exiting}` : ''}`}
            role="alert"
          >
            <div className={styles.bannerContent}>
              <span className={styles.icon}>
                {group.type === 'success' && '✓'}
                {group.type === 'error' && '✕'}
                {group.type === 'info' && 'ℹ'}
              </span>
              <div className={styles.textContent}>
                {group.error && <div className={styles.errorCode}>{group.error}</div>}
                <div className={styles.message}>
                  {group.message}
                  {group.ids.length > 1 && (
                    <span className={styles.countBadge}>({group.ids.length})</span>
                  )}
                </div>
              </div>
              <button
                className={styles.closeButton}
                onClick={() => triggerDismissGroup(group.repId, group.ids)}
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Normal mode: individual banners ──────────────────────────────────────
  return (
    <div className={styles.bannerContainer}>
      {visibleBanners.map((banner) => (
        <div
          key={banner.id}
          className={`${styles.banner} ${styles[banner.type]}${exitingIds.has(banner.id) ? ` ${styles.exiting}` : ''}`}
          role="alert"
        >
          <div className={styles.bannerContent}>
            <span className={styles.icon}>
              {banner.type === 'success' && '✓'}
              {banner.type === 'error' && '✕'}
              {banner.type === 'info' && 'ℹ'}
            </span>
            <div className={styles.textContent}>
              {banner.error && <div className={styles.errorCode}>{banner.error}</div>}
              <div className={styles.message}>{banner.message}</div>
            </div>
            <button
              className={styles.closeButton}
              onClick={() => triggerDismiss(banner.id)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Banner;

