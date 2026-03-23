/**
 * DataConsent Modal Component for React Native
 * Mirrors mds-patient/src/modules/auth/data-consent/data-consent.jsx
 *
 * Displays data consent policy in a modal for login/register flows.
 *
 * Backend Integration:
 * - GET /info/consent/:purpose - Fetches consent data
 * - POST /info/consent/:purpose - Records user consent
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useTheme, colors } from '../../context/ThemeContext';
import { axiosRequest } from '../../core';

interface ConsentData {
  ok: boolean;
  consent_text?: string;
  required_version?: string;
  data_consent_version?: string;
  message?: string;
}

interface DataConsentProps {
  isOpen: boolean;
  verificationKey: string;
  purpose: 'login' | 'register';
  onAccept: (data: { version?: string; verificationKey: string }) => void;
  onCancel: () => void;
}

export const DataConsent: React.FC<DataConsentProps> = ({
  isOpen,
  verificationKey,
  purpose = 'login',
  onAccept,
  onCancel,
}) => {
  const { isDark } = useTheme();

  const [consentData, setConsentData] = useState<ConsentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [showEmailExistsDialog, setShowEmailExistsDialog] = useState(false);
  const contentHeightRef = useRef(0);
  const scrollViewHeightRef = useRef(0);

  // Load consent data when modal opens
  useEffect(() => {
    if (isOpen && verificationKey) {
      loadConsentData();
    }
  }, [isOpen, verificationKey]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setAgreed(false);
      setError('');
      setShowExitWarning(false);
      setHasScrolledToBottom(false);
    }
  }, [isOpen]);

  const loadConsentData = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await axiosRequest.get(`/info/consent/${purpose}`, {
        params: { verificationKey },
      });

      if (response.data.ok) {
        setConsentData(response.data);
      } else {
        setConsentData(response.data);
        setError(response.data.message || 'Unexpected response from server.');
      }
    } catch (err: any) {
      const errorCode = err.response?.data?.error;
      const errorMessage = err.response?.data?.message || 'Failed to load consent policy.';

      switch (errorCode) {
        case 'INVALID_OR_EXPIRED_SESSION':
          setError('Your session has expired. Please restart the process.');
          break;
        case 'MISSING_VERIFICATION_KEY':
          setError('Verification key is missing. Please restart the process.');
          break;
        default:
          setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!agreed) {
      setError('You must agree to the data consent policy to continue.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await axiosRequest.post(`/info/consent/${purpose}`, {
        verificationKey,
      });

      if (response.data.ok) {
        if (onAccept) {
          onAccept({
            version: response.data.version,
            verificationKey,
          });
        }
      }
    } catch (err: any) {
      const errorCode = err.response?.data?.error;
      const errorMessage = err.response?.data?.message || 'Failed to record consent.';

      switch (errorCode) {
        case 'INVALID_OR_EXPIRED_SESSION':
          setError('Your session has expired. Please restart the process.');
          break;
        case 'EMAIL_ALREADY_EXISTS':
        case 'USER_ALREADY_EXISTS':
          if (purpose === 'register') {
            setShowEmailExistsDialog(true);
          } else {
            setError(errorMessage);
          }
          break;
        default:
          setError(errorMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseClick = () => {
    setShowExitWarning(true);
  };

  const handleConfirmExit = () => {
    setShowExitWarning(false);
    setAgreed(false);
    setError('');
    if (onCancel) {
      onCancel();
    }
  };

  const handleCancelExit = () => {
    setShowExitWarning(false);
  };

  const handleGoToLogin = () => {
    setShowEmailExistsDialog(false);
    if (onCancel) {
      onCancel();
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isAtBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
    if (isAtBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleContentSizeChange = (_w: number, h: number) => {
    contentHeightRef.current = h;
    // If content fits without scrolling, allow checkbox immediately
    if (scrollViewHeightRef.current > 0 && h <= scrollViewHeightRef.current + 10) {
      setHasScrolledToBottom(true);
    }
  };

  const handleScrollViewLayout = (event: any) => {
    scrollViewHeightRef.current = event.nativeEvent.layout.height;
    // Check again after layout
    if (contentHeightRef.current > 0 && contentHeightRef.current <= scrollViewHeightRef.current + 10) {
      setHasScrolledToBottom(true);
    }
  };

  const isNewVersion =
    consentData &&
    consentData.data_consent_version &&
    consentData.data_consent_version !== consentData.required_version;

  if (!isOpen) return null;

  return (
    <>
      {/* Main Modal */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={handleCloseClick}
      >
        <View style={styles.overlay}>
          <View
            style={[
              styles.modalContainer,
              { backgroundColor: isDark ? colors.neutral[900] : '#FFFFFF' },
            ]}
          >
            {/* Header */}
            <View
              style={[
                styles.header,
                { borderBottomColor: isDark ? colors.neutral[700] : colors.neutral[200] },
              ]}
            >
              <View style={styles.headerLeft}>
                <Text style={styles.headerIcon}>🛡️</Text>
                <View style={styles.headerTextContainer}>
                  <Text
                    style={[
                      styles.headerTitle,
                      { color: isDark ? colors.neutral[100] : colors.secondary[900] },
                    ]}
                  >
                    Data Consent Policy
                  </Text>
                  <Text
                    style={[
                      styles.headerSubtitle,
                      { color: isDark ? colors.neutral[400] : colors.neutral[500] },
                    ]}
                  >
                    {purpose === 'register'
                      ? 'Required for Account Registration'
                      : isNewVersion
                        ? 'Policy Update — Renewal Required'
                        : 'Review MDSystem Data Policy'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleCloseClick} style={styles.closeButton}>
                <Text
                  style={[
                    styles.closeButtonText,
                    { color: isDark ? colors.neutral[400] : colors.neutral[500] },
                  ]}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.contentContainer}>
              {loading ? (
                <View style={styles.centeredState}>
                  <ActivityIndicator size="large" color={colors.primary[500]} />
                  <Text
                    style={[
                      styles.stateText,
                      { color: isDark ? colors.neutral[400] : colors.neutral[500] },
                    ]}
                  >
                    Loading consent policy...
                  </Text>
                </View>
              ) : error && !consentData ? (
                <View style={styles.centeredState}>
                  <Text style={styles.errorIcon}>⚠️</Text>
                  <Text style={[styles.errorText, { color: colors.error[600] }]}>{error}</Text>
                  <TouchableOpacity
                    onPress={loadConsentData}
                    style={[styles.retryButton, { backgroundColor: colors.primary[500] }]}
                  >
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <ScrollView
                    style={styles.scrollContent}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    onContentSizeChange={handleContentSizeChange}
                    onLayout={handleScrollViewLayout}
                  >
                    {/* Version Update Notice */}
                    {isNewVersion && (
                      <View
                        style={[
                          styles.versionNotice,
                          {
                            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#FFFBEB',
                            borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#FDE68A',
                          },
                        ]}
                      >
                        <Text style={styles.versionNoticeTitle}>⚠️ Policy Updated</Text>
                        <Text
                          style={[
                            styles.versionNoticeText,
                            { color: isDark ? '#FBBF24' : '#92400E' },
                          ]}
                        >
                          Updated from version {consentData?.data_consent_version} to{' '}
                          {consentData?.required_version}. Please review and accept the new policy.
                        </Text>
                      </View>
                    )}

                    {/* Consent Text */}
                    {consentData?.consent_text ? (
                      <Text
                        style={[
                          styles.consentText,
                          { color: isDark ? colors.neutral[300] : colors.neutral[700] },
                        ]}
                      >
                        {consentData.consent_text.replace(/<[^>]*>/g, '')}
                      </Text>
                    ) : (
                      <Text
                        style={[
                          styles.consentText,
                          { color: isDark ? colors.neutral[300] : colors.neutral[700] },
                        ]}
                      >
                        I consent to the collection and use of my data in accordance with the
                        MDSystem Privacy Policy.
                      </Text>
                    )}

                    {/* Version Badge */}
                    {consentData && (
                      <View
                        style={[
                          styles.versionBadgeContainer,
                          { borderTopColor: isDark ? colors.neutral[700] : colors.neutral[200] },
                        ]}
                      >
                        <Text
                          style={[
                            styles.versionLabel,
                            { color: isDark ? colors.neutral[500] : colors.neutral[400] },
                          ]}
                        >
                          Document version:
                        </Text>
                        <View
                          style={[
                            styles.versionBadge,
                            { backgroundColor: isDark ? 'rgba(241, 197, 38, 0.1)' : colors.primary[50] || '#FEF9E7' },
                          ]}
                        >
                          <Text style={[styles.versionBadgeText, { color: colors.primary[600] || colors.primary[500] }]}>
                            {consentData.required_version}
                          </Text>
                        </View>
                      </View>
                    )}
                  </ScrollView>
                </>
              )}
            </View>

            {/* Footer */}
            {!loading && consentData && (
              <View
                style={[
                  styles.footer,
                  {
                    borderTopColor: isDark ? colors.neutral[700] : colors.neutral[200],
                    backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50],
                  },
                ]}
              >
                {/* Checkbox */}
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => {
                    if (hasScrolledToBottom && !submitting) {
                      setAgreed(!agreed);
                      setError('');
                    }
                  }}
                  disabled={!hasScrolledToBottom || submitting}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: agreed
                          ? colors.primary[500]
                          : isDark
                            ? colors.neutral[600]
                            : colors.neutral[400],
                        backgroundColor: agreed
                          ? colors.primary[500]
                          : 'transparent',
                        opacity: hasScrolledToBottom ? 1 : 0.5,
                      },
                    ]}
                  >
                    {agreed && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={styles.checkboxTextContainer}>
                    <Text
                      style={[
                        styles.checkboxLabel,
                        { color: isDark ? colors.neutral[300] : colors.neutral[600] },
                      ]}
                    >
                      I have read and agree to the data consent policy and understand how my
                      personal and medical information will be collected, used, and protected.
                    </Text>
                    {!hasScrolledToBottom && (
                      <Text style={[styles.scrollHint, { color: '#F59E0B' }]}>
                        ⚠ Please scroll to the bottom to enable this option
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Error in footer */}
                {error && (
                  <View
                    style={[
                      styles.footerError,
                      {
                        backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2',
                        borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECACA',
                      },
                    ]}
                  >
                    <Text style={[styles.footerErrorText, { color: colors.error[600] }]}>
                      {error}
                    </Text>
                  </View>
                )}

                {/* Buttons */}
                <View style={styles.footerButtons}>
                  <TouchableOpacity
                    style={[
                      styles.cancelButton,
                      {
                        backgroundColor: isDark ? colors.neutral[700] : '#FFFFFF',
                        borderColor: isDark ? colors.neutral[600] : colors.neutral[300],
                      },
                    ]}
                    onPress={handleCloseClick}
                    disabled={submitting}
                  >
                    <Text
                      style={[
                        styles.cancelButtonText,
                        { color: isDark ? colors.neutral[300] : colors.neutral[600] },
                      ]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.acceptButton,
                      {
                        backgroundColor: colors.primary[500],
                        opacity: !agreed || submitting ? 0.5 : 1,
                      },
                    ]}
                    onPress={handleSubmit}
                    disabled={!agreed || submitting}
                  >
                    {submitting ? (
                      <View style={styles.buttonContent}>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                        <Text style={styles.acceptButtonText}>Processing...</Text>
                      </View>
                    ) : (
                      <View style={styles.buttonContent}>
                        <Text style={styles.acceptButtonText}>✓ Accept & Continue</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Exit Warning Dialog */}
      <Modal
        visible={showExitWarning}
        transparent
        animationType="fade"
        onRequestClose={handleCancelExit}
      >
        <View style={styles.overlay}>
          <View
            style={[
              styles.dialogContainer,
              { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' },
            ]}
          >
            <View style={styles.dialogHeader}>
              <View
                style={[
                  styles.dialogIconCircle,
                  { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7' },
                ]}
              >
                <Text style={styles.dialogIconText}>⚠️</Text>
              </View>
              <View style={styles.dialogTextContainer}>
                <Text
                  style={[
                    styles.dialogTitle,
                    { color: isDark ? colors.neutral[100] : colors.secondary[900] },
                  ]}
                >
                  Data Consent Required
                </Text>
                <Text
                  style={[
                    styles.dialogMessage,
                    { color: isDark ? colors.neutral[400] : colors.neutral[500] },
                  ]}
                >
                  {purpose === 'register'
                    ? 'Consent is required to create an account. Closing will cancel your registration.'
                    : 'Consent is required to continue. Closing will cancel your login.'}
                </Text>
              </View>
            </View>
            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={[
                  styles.dialogCancelBtn,
                  {
                    backgroundColor: isDark ? colors.neutral[700] : '#FFFFFF',
                    borderColor: isDark ? colors.neutral[600] : colors.neutral[300],
                  },
                ]}
                onPress={handleConfirmExit}
              >
                <Text
                  style={[
                    styles.dialogCancelText,
                    { color: isDark ? colors.neutral[300] : colors.neutral[600] },
                  ]}
                >
                  Cancel {purpose === 'register' ? 'Registration' : 'Login'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogContinueBtn, { backgroundColor: colors.primary[500] }]}
                onPress={handleCancelExit}
              >
                <Text style={styles.dialogContinueText}>Continue Review</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Email Already Exists Dialog */}
      <Modal
        visible={showEmailExistsDialog}
        transparent
        animationType="fade"
        onRequestClose={handleGoToLogin}
      >
        <View style={styles.overlay}>
          <View
            style={[
              styles.dialogContainer,
              { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' },
            ]}
          >
            <View style={styles.dialogHeader}>
              <View
                style={[
                  styles.dialogIconCircle,
                  { backgroundColor: isDark ? 'rgba(241, 197, 38, 0.2)' : colors.primary[100] || '#FEF9E7' },
                ]}
              >
                <Text style={styles.dialogIconText}>👤</Text>
              </View>
              <View style={styles.dialogTextContainer}>
                <Text
                  style={[
                    styles.dialogTitle,
                    { color: isDark ? colors.neutral[100] : colors.secondary[900] },
                  ]}
                >
                  Account Already Exists
                </Text>
                <Text
                  style={[
                    styles.dialogMessage,
                    { color: isDark ? colors.neutral[400] : colors.neutral[500] },
                  ]}
                >
                  An account with this email already exists. Please log in to your existing
                  account instead.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.fullWidthBtn, { backgroundColor: colors.primary[500] }]}
              onPress={handleGoToLogin}
            >
              <Text style={styles.fullWidthBtnText}>Go to Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  headerIcon: {
    fontSize: 20,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
    marginLeft: 12,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
    minHeight: 200,
  },
  centeredState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  stateText: {
    fontSize: 14,
    marginTop: 12,
  },
  errorIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    maxHeight: 350,
  },
  versionNotice: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  versionNoticeTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  versionNoticeText: {
    fontSize: 12,
    lineHeight: 18,
  },
  consentText: {
    fontSize: 14,
    lineHeight: 22,
  },
  versionBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  versionLabel: {
    fontSize: 12,
  },
  versionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  versionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxTextContainer: {
    flex: 1,
  },
  checkboxLabel: {
    fontSize: 12,
    lineHeight: 18,
  },
  scrollHint: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
  },
  footerError: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  footerErrorText: {
    fontSize: 12,
    textAlign: 'center',
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  acceptButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // Dialog styles
  dialogContainer: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    padding: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  dialogIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogIconText: {
    fontSize: 16,
  },
  dialogTextContainer: {
    flex: 1,
  },
  dialogTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  dialogMessage: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  dialogButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  dialogCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  dialogCancelText: {
    fontSize: 12,
    fontWeight: '500',
  },
  dialogContinueBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  dialogContinueText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  fullWidthBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  fullWidthBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default DataConsent;
