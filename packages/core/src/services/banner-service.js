/**
 * Banner Service
 * Platform-agnostic banner/notification state management
 * 
 * Manages banner notifications with support for:
 * - Adding banners with auto-dismiss
 * - Manual dismissal
 * - Clearing all banners
 * - Subscribing to state changes
 * 
 * This class can be wrapped in React Context (web/RN) or used directly
 * with other state management solutions.
 * 
 * @module banner-service
 */

/**
 * Banner Service class for managing notification banners
 * 
 * @example
 * // Create instance
 * import { BannerService } from '@mdsystem/core/services/banner-service';
 * 
 * const bannerService = new BannerService();
 * 
 * // Subscribe to changes
 * const unsubscribe = bannerService.subscribe((banners) => {
 *   console.log('Banners updated:', banners);
 * });
 * 
 * // Show a banner
 * const bannerId = bannerService.showBanner({
 *   type: 'success',
 *   message: 'Operation completed successfully',
 *   duration: 5000
 * });
 * 
 * // Dismiss manually
 * bannerService.dismissBanner(bannerId);
 * 
 * // Clean up
 * unsubscribe();
 * 
 * @example
 * // React integration (web/native)
 * const [banners, setBanners] = useState([]);
 * const bannerService = useRef(new BannerService()).current;
 * 
 * useEffect(() => {
 *   return bannerService.subscribe(setBanners);
 * }, []);
 */
export class BannerService {
  constructor() {
    /**
     * @private
     * @type {Array<Object>}
     */
    this.banners = [];
    
    /**
     * @private
     * @type {number}
     */
    this.nextId = 1;
    
    /**
     * @private
     * @type {Set<Function>}
     */
    this.listeners = new Set();
    
    /**
     * @private
     * @type {Map<number, number>}
     */
    this.timers = new Map();
  }

  /**
   * Show a new banner notification
   * 
   * @param {Object} banner - Banner configuration
   * @param {('success'|'error'|'info')} banner.type - Banner type (success=green, error=red, info=grey)
   * @param {string} banner.message - Main message to display
   * @param {string} [banner.error] - Error code (optional)
   * @param {number} [banner.duration=5000] - Auto-dismiss duration in ms (0 for no auto-dismiss)
   * 
   * @returns {number} Banner ID for manual dismissal
   * 
   * @example
   * const id = bannerService.showBanner({
   *   type: 'error',
   *   message: 'Failed to save changes',
   *   error: 'SAVE_ERROR',
   *   duration: 0 // Don't auto-dismiss
   * });
   */
  showBanner(banner) {
    const id = this.nextId++;
    const duration = banner.duration !== undefined ? banner.duration : 5000;
    
    const newBanner = {
      id,
      type: banner.type || 'info',
      message: banner.message || 'An action occurred',
      error: banner.error || null,
      duration,
    };

    this.banners.push(newBanner);
    this.notify();

    // Auto-dismiss if duration > 0
    if (duration > 0) {
      const timerId = setTimeout(() => {
        this.dismissBanner(id);
      }, duration);
      this.timers.set(id, timerId);
    }

    return id;
  }

  /**
   * Dismiss a specific banner by ID
   * 
   * @param {number} id - Banner ID to dismiss
   * 
   * @example
   * bannerService.dismissBanner(bannerId);
   */
  dismissBanner(id) {
    // Clear auto-dismiss timer if exists
    if (this.timers.has(id)) {
      clearTimeout(this.timers.get(id));
      this.timers.delete(id);
    }
    
    const previousLength = this.banners.length;
    this.banners = this.banners.filter((banner) => banner.id !== id);
    
    // Only notify if a banner was actually removed
    if (this.banners.length !== previousLength) {
      this.notify();
    }
  }

  /**
   * Clear all banners at once
   * 
   * @example
   * bannerService.clearAllBanners();
   */
  clearAllBanners() {
    // Clear all timers
    this.timers.forEach((timerId) => clearTimeout(timerId));
    this.timers.clear();
    
    const hadBanners = this.banners.length > 0;
    this.banners = [];
    
    // Only notify if there were banners to clear
    if (hadBanners) {
      this.notify();
    }
  }

  /**
   * Get current banners (read-only copy)
   * 
   * @returns {Array<Object>} Array of current banners
   * 
   * @example
   * const currentBanners = bannerService.getBanners();
   */
  getBanners() {
    return [...this.banners];
  }

  /**
   * Subscribe to banner state changes
   * 
   * @param {Function} listener - Callback function that receives updated banners array
   * @returns {Function} Unsubscribe function
   * 
   * @example
   * const unsubscribe = bannerService.subscribe((banners) => {
   *   console.log('Banners updated:', banners);
   * });
   * 
   * // Later...
   * unsubscribe();
   */
  subscribe(listener) {
    this.listeners.add(listener);
    
    // Immediately call listener with current state
    listener(this.getBanners());
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state change
   * @private
   */
  notify() {
    const banners = this.getBanners();
    this.listeners.forEach((listener) => {
      try {
        listener(banners);
      } catch (error) {
        console.error('Banner listener error:', error);
      }
    });
  }

  /**
   * Clean up all resources
   * Call this when the service is no longer needed
   * 
   * @example
   * bannerService.destroy();
   */
  destroy() {
    this.clearAllBanners();
    this.listeners.clear();
  }
}
