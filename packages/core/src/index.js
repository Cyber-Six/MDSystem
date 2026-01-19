/**
 * @mdsystem/core - Shared Core Package
 * 
 * Platform-agnostic business logic for MDSystem web and mobile applications.
 * Provides HTTP client, token management, role detection, and notification handling.
 * 
 * @module @mdsystem/core
 * @version 1.0.0
 */

// Config exports
export * from './config/banner-config.js';

// Service exports
export { createApiBaseUrlProvider } from './services/api-base-url-provider.js';
export { createTokenService } from './services/token-service.js';
export { createAxiosRequestHandler } from './services/axios-request-handler.js';
export { BannerService } from './services/banner-service.js';

// Utility exports
export { detectRoleFromHostname } from './utils/role-detection.js';

// Validation exports
export * from './validation/email-validation.js';
export * from './validation/password-validation.js';
export * from './validation/user-constants.js';
