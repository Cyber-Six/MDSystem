/**
 * Type declarations for @mdsystem/core package
 * 
 * This file provides TypeScript type definitions for the JavaScript-based
 * @mdsystem/core package to prevent implicit 'any' type warnings.
 */

// Wildcard declaration for all @mdsystem/core modules
declare module '@mdsystem/core/*';

// Explicit declarations for better IDE support
declare module '@mdsystem/core/services/api-base-url-provider';
declare module '@mdsystem/core/services/token-service';
declare module '@mdsystem/core/services/axios-request-handler';
declare module '@mdsystem/core/services/banner-service';
declare module '@mdsystem/core/config/banner-config';
declare module '@mdsystem/core/utils/role-detection';
declare module '@mdsystem/core/validation/email-validation';
declare module '@mdsystem/core/validation/password-validation';
declare module '@mdsystem/core/validation/user-constants';
