/**
 * DataConsent Modal Component for React Native
 * Mirrors mds-patient/src/modules/auth/data-consent/data-consent.jsx
 *
 * Displays data consent policy in a modal for login/register flows.
 * Renders the HTML consent document with proper structure (headings, sections, lists).
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
  useWindowDimensions,
  Linking,
} from 'react-native';
import { useTheme, colors } from '../../context/ThemeContext';
import { axiosRequest } from '../../core';

// ── HTML Renderer ─────────────────────────────────────────────────────────────

const decodeEntities = (str: string): string =>
  str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();

/** Renders inline HTML (text with <strong>, <b>, <a>, <br>) as React Native Text nodes */
const renderInlineHtml = (
  html: string,
  baseStyle: object,
  boldStyle: object,
  linkStyle: object,
): React.ReactNode => {
  const parts: Array<{ text: string; type: 'text' | 'bold' | 'link'; href?: string }> = [];

  const normalized = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(
      /<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
      '__LINK__$1__TEXT__$2__ENDLINK__',
    );

  const regex =
    /<(?:strong|b)>([\s\S]*?)<\/(?:strong|b)>|__LINK__([^_]*)__TEXT__([\s\S]*?)__ENDLINK__|([^<]+)/g;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(normalized)) !== null) {
    if (m[1] !== undefined) {
      parts.push({ text: decodeEntities(m[1]), type: 'bold' });
    } else if (m[2] !== undefined) {
      parts.push({ text: decodeEntities(m[3] ?? ''), type: 'link', href: m[2] });
    } else if (m[4] !== undefined) {
      const text = decodeEntities(m[4]);
      if (text) parts.push({ text, type: 'text' });
    }
  }

  if (parts.length === 0) return null;

  return (
    <Text style={baseStyle}>
      {parts.map((p, i) => {
        if (p.type === 'bold') {
          return (
            <Text key={i} style={boldStyle}>
              {p.text}
            </Text>
          );
        }
        if (p.type === 'link') {
          return (
            <Text
              key={i}
              style={linkStyle}
              onPress={() => p.href && Linking.openURL(p.href).catch(() => {})}
            >
              {p.text}
            </Text>
          );
        }
        return p.text;
      })}
    </Text>
  );
};

/** Parses full consent HTML into structured React Native nodes */
const renderConsentHtml = (html: string, isDark: boolean): React.ReactNode[] => {
  const textColor = isDark ? colors.neutral[300] : colors.neutral[700];
  const h1Color = isDark ? colors.neutral[50] : colors.secondary[900];
  const h2Color = isDark ? colors.primary[300] : colors.primary[700];
  const dividerColor = isDark ? colors.neutral[700] : colors.neutral[200];
  const linkColor = isDark ? colors.accent[400] : colors.accent[600];
  const bulletColor = isDark ? colors.primary[400] : colors.primary[500];

  let content = html;
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) content = bodyMatch[1];
  content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  const nodes: React.ReactNode[] = [];
  let key = 0;

  const blockRegex =
    /<(h1|h2|p)\b[^>]*>([\s\S]*?)<\/\1>|<(ul)\b[^>]*>([\s\S]*?)<\/ul>/gi;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(content)) !== null) {
    const tag = match[1]?.toLowerCase();
    const inner = match[2] ?? '';
    const ulInner = match[4];

    if (tag === 'h1') {
      const text = decodeEntities(inner.replace(/<[^>]*>/g, ''));
      if (!text) continue;
      nodes.push(
        <View key={key++} style={{ marginBottom: 16 }}>
          <Text
            style={{ fontSize: 17, fontWeight: '700', color: h1Color, lineHeight: 25 }}
          >
            {text}
          </Text>
          <View
            style={{
              height: 2,
              backgroundColor: h2Color,
              marginTop: 8,
              borderRadius: 1,
              opacity: 0.6,
            }}
          />
        </View>,
      );
    } else if (tag === 'h2') {
      const text = decodeEntities(inner.replace(/<[^>]*>/g, ''));
      if (!text) continue;
      nodes.push(
        <View key={key++} style={{ marginTop: 18, marginBottom: 6 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: h2Color,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}
          >
            {text}
          </Text>
          <View style={{ height: 1, backgroundColor: dividerColor, marginTop: 5 }} />
        </View>,
      );
    } else if (tag === 'p') {
      const node = renderInlineHtml(
        inner,
        { fontSize: 13, lineHeight: 21, color: textColor, marginBottom: 8 } as object,
        { fontWeight: '700', color: textColor } as object,
        { color: linkColor, textDecorationLine: 'underline' } as object,
      );
      if (node) nodes.push(<View key={key++}>{node}</View>);
    } else if (ulInner !== undefined) {
      const liItems: string[] = [];
      const liRegex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
      let liMatch: RegExpExecArray | null;
      while ((liMatch = liRegex.exec(ulInner)) !== null) {
        liItems.push(liMatch[1]);
      }
      nodes.push(
        <View key={key++} style={{ marginBottom: 8 }}>
          {liItems.map((item, i) => (
            <View
              key={i}
              style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 5 }}
            >
              <Text
                style={{
                  color: bulletColor,
                  fontSize: 14,
                  lineHeight: 21,
                  marginRight: 8,
                }}
              >
                ›
              </Text>
              <View style={{ flex: 1 }}>
                {renderInlineHtml(
                  item,
                  { fontSize: 13, lineHeight: 21, color: textColor } as object,
                  { fontWeight: '700', color: textColor } as object,
                  { color: linkColor, textDecorationLine: 'underline' } as object,
                )}
              </View>
            </View>
          ))}
        </View>,
      );
    }
  }

  return nodes;
};

// ── Component ─────────────────────────────────────────────────────────────────

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
  const { height: screenHeight } = useWindowDimensions();

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

  useEffect(() => {
    if (isOpen && verificationKey) {
      loadConsentData();
    }
  }, [isOpen, verificationKey]);

  useEffect(() => {
    if (!isOpen) {
      setAgreed(false);
      setError('');
      setShowExitWarning(false);
      setHasScrolledToBottom(false);
      setConsentData(null);
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

      switch (errorCode) {
        case 'INVALID_OR_EXPIRED_SESSION':
          setError('Your session has expired. Please restart the process.');
          break;
        case 'MISSING_VERIFICATION_KEY':
          setError('Verification key is missing. Please restart the process.');
          break;
        default:
          setError(err.response?.data?.message || 'Failed to load consent policy.');
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
        onAccept?.({ version: response.data.version, verificationKey });
      }
    } catch (err: any) {
      const errorCode = err.response?.data?.error;

      switch (errorCode) {
        case 'INVALID_OR_EXPIRED_SESSION':
          setError('Your session has expired. Please restart the process.');
          break;
        case 'EMAIL_ALREADY_EXISTS':
        case 'USER_ALREADY_EXISTS':
          if (purpose === 'register') {
            setShowEmailExistsDialog(true);
          } else {
            setError(err.response?.data?.message || 'Failed to record consent.');
          }
          break;
        default:
          setError(err.response?.data?.message || 'Failed to record consent.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseClick = () => setShowExitWarning(true);
  const handleConfirmExit = () => {
    setShowExitWarning(false);
    setAgreed(false);
    setError('');
    onCancel?.();
  };
  const handleCancelExit = () => setShowExitWarning(false);
  const handleGoToLogin = () => {
    setShowEmailExistsDialog(false);
    onCancel?.();
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isAtBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 24;
    if (isAtBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleContentSizeChange = (_w: number, h: number) => {
    contentHeightRef.current = h;
    if (scrollViewHeightRef.current > 0 && h <= scrollViewHeightRef.current + 10) {
      setHasScrolledToBottom(true);
    }
  };

  const handleScrollViewLayout = (event: any) => {
    scrollViewHeightRef.current = event.nativeEvent.layout.height;
    if (
      contentHeightRef.current > 0 &&
      contentHeightRef.current <= scrollViewHeightRef.current + 10
    ) {
      setHasScrolledToBottom(true);
    }
  };

  const isNewVersion =
    consentData?.data_consent_version &&
    consentData.data_consent_version !== consentData.required_version;

  const renderedHtml =
    consentData?.consent_text ? renderConsentHtml(consentData.consent_text, isDark) : null;

  // Sizes the modal at 88% of screen height for proper scroll area
  const MODAL_HEIGHT = Math.min(screenHeight * 0.88, 680);

  const bgModal = isDark ? colors.neutral[900] : '#FFFFFF';
  const bgFooter = isDark ? colors.neutral[800] : colors.neutral[50];
  const borderColor = isDark ? colors.neutral[700] : colors.neutral[200];
  const textPrimary = isDark ? colors.neutral[100] : colors.secondary[900];
  const textSecondary = isDark ? colors.neutral[400] : colors.neutral[500];

  if (!isOpen) return null;

  return (
    <>
      {/* ── Main Consent Modal ─────────────────────────────────────────────── */}
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
              { backgroundColor: bgModal, height: MODAL_HEIGHT },
            ]}
          >
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: borderColor }]}>
              <View style={styles.headerLeft}>
                <View
                  style={[
                    styles.iconCircle,
                    {
                      backgroundColor: isDark
                        ? 'rgba(241,197,38,0.15)'
                        : colors.primary[50],
                    },
                  ]}
                >
                  <Text style={styles.headerIconText}>🛡️</Text>
                </View>
                <View style={styles.headerTextBlock}>
                  <Text style={[styles.headerTitle, { color: textPrimary }]}>
                    Data Consent Policy
                  </Text>
                  <Text style={[styles.headerSubtitle, { color: textSecondary }]}>
                    {purpose === 'register'
                      ? 'Required for Account Registration'
                      : isNewVersion
                        ? 'Policy Update — Renewal Required'
                        : 'Review MDSystem Data Policy'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={handleCloseClick}
                style={[
                  styles.closeBtn,
                  {
                    backgroundColor: isDark
                      ? colors.neutral[800]
                      : colors.neutral[100],
                  },
                ]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.closeBtnText, { color: textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Scrollable content area — flex: 1 */}
            <View style={styles.contentArea}>
              {loading ? (
                <View style={styles.centeredState}>
                  <ActivityIndicator size="large" color={colors.primary[500]} />
                  <Text style={[styles.stateText, { color: textSecondary }]}>
                    Loading consent policy…
                  </Text>
                </View>
              ) : error && !consentData ? (
                <View style={styles.centeredState}>
                  <Text style={styles.errorIcon}>⚠️</Text>
                  <Text style={[styles.errorText, { color: colors.error[600] }]}>
                    {error}
                  </Text>
                  <TouchableOpacity
                    onPress={loadConsentData}
                    style={[styles.retryBtn, { backgroundColor: colors.primary[500] }]}
                  >
                    <Text style={styles.retryBtnText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {/* Version-updated notice */}
                  {isNewVersion && (
                    <View
                      style={[
                        styles.versionNotice,
                        {
                          backgroundColor: isDark
                            ? 'rgba(245,158,11,0.1)'
                            : '#FFFBEB',
                          borderColor: isDark ? 'rgba(245,158,11,0.3)' : '#FDE68A',
                          marginHorizontal: 16,
                          marginTop: 12,
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
                        Updated from v{consentData?.data_consent_version} to v
                        {consentData?.required_version}. Please review and accept the new
                        policy.
                      </Text>
                    </View>
                  )}

                  {/* Scroll-down hint */}
                  {!hasScrolledToBottom && (
                    <View
                      style={[
                        styles.scrollHintBanner,
                        {
                          backgroundColor: isDark
                            ? 'rgba(241,197,38,0.08)'
                            : colors.primary[50],
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.scrollHintText,
                          {
                            color: isDark
                              ? colors.primary[300]
                              : colors.primary[700],
                          },
                        ]}
                      >
                        ↓  Scroll down to read the full policy
                      </Text>
                    </View>
                  )}

                  {/* Policy document — structured HTML render */}
                  <ScrollView
                    style={styles.scrollContent}
                    contentContainerStyle={styles.scrollContentInner}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    onContentSizeChange={handleContentSizeChange}
                    onLayout={handleScrollViewLayout}
                    showsVerticalScrollIndicator
                    bounces={false}
                  >
                    {renderedHtml ?? (
                      <Text
                        style={{
                          fontSize: 13,
                          lineHeight: 21,
                          color: isDark ? colors.neutral[300] : colors.neutral[700],
                        }}
                      >
                        I consent to the collection and use of my data in accordance with
                        the MDSystem Privacy Policy.
                      </Text>
                    )}

                    {/* Version badge at bottom of document */}
                    {consentData && (
                      <View
                        style={[
                          styles.versionBadgeContainer,
                          { borderTopColor: borderColor },
                        ]}
                      >
                        <Text style={[styles.versionLabel, { color: textSecondary }]}>
                          Document version:
                        </Text>
                        <View
                          style={[
                            styles.versionBadge,
                            {
                              backgroundColor: isDark
                                ? 'rgba(241,197,38,0.1)'
                                : colors.primary[50],
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.versionBadgeText,
                              { color: colors.primary[600] },
                            ]}
                          >
                            {consentData.required_version}
                          </Text>
                        </View>
                      </View>
                    )}
                  </ScrollView>
                </>
              )}
            </View>

            {/* Footer — pinned at bottom of the modal */}
            {!loading && consentData && (
              <View
                style={[
                  styles.footer,
                  { borderTopColor: borderColor, backgroundColor: bgFooter },
                ]}
              >
                {/* Agreement checkbox */}
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
                        backgroundColor: agreed ? colors.primary[500] : 'transparent',
                        opacity: hasScrolledToBottom ? 1 : 0.45,
                      },
                    ]}
                  >
                    {agreed && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={styles.checkboxLabelBlock}>
                    <Text
                      style={[
                        styles.checkboxLabel,
                        {
                          color: isDark ? colors.neutral[300] : colors.neutral[600],
                        },
                      ]}
                    >
                      I have read and agree to the data consent policy and understand
                      how my personal and medical information will be collected, used,
                      and protected.
                    </Text>
                    {!hasScrolledToBottom && (
                      <Text
                        style={[styles.checkboxHint, { color: colors.primary[500] }]}
                      >
                        Scroll to the bottom to enable
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Inline error message */}
                {error && (
                  <View
                    style={[
                      styles.footerError,
                      {
                        backgroundColor: isDark
                          ? 'rgba(239,68,68,0.1)'
                          : '#FEF2F2',
                        borderColor: isDark
                          ? 'rgba(239,68,68,0.25)'
                          : '#FECACA',
                      },
                    ]}
                  >
                    <Text style={[styles.footerErrorText, { color: colors.error[600] }]}>
                      {error}
                    </Text>
                  </View>
                )}

                {/* Cancel / Accept buttons */}
                <View style={styles.footerButtons}>
                  <TouchableOpacity
                    style={[
                      styles.cancelBtn,
                      {
                        backgroundColor: isDark ? colors.neutral[700] : '#FFFFFF',
                        borderColor: isDark
                          ? colors.neutral[600]
                          : colors.neutral[300],
                      },
                    ]}
                    onPress={handleCloseClick}
                    disabled={submitting}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.cancelBtnText,
                        {
                          color: isDark ? colors.neutral[300] : colors.neutral[600],
                        },
                      ]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.acceptBtn,
                      {
                        backgroundColor: colors.primary[500],
                        opacity: !agreed || submitting ? 0.45 : 1,
                      },
                    ]}
                    onPress={handleSubmit}
                    disabled={!agreed || submitting}
                    activeOpacity={0.8}
                  >
                    {submitting ? (
                      <View style={styles.btnContent}>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                        <Text style={styles.acceptBtnText}>Processing…</Text>
                      </View>
                    ) : (
                      <View style={styles.btnContent}>
                        <Text style={styles.acceptBtnText}>✓  Accept & Continue</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Exit Warning Dialog ────────────────────────────────────────────── */}
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
            <View style={styles.dialogIconRow}>
              <View
                style={[
                  styles.dialogIconCircle,
                  {
                    backgroundColor: isDark
                      ? 'rgba(245,158,11,0.2)'
                      : '#FEF3C7',
                  },
                ]}
              >
                <Text style={styles.dialogIconEmoji}>⚠️</Text>
              </View>
            </View>
            <Text style={[styles.dialogTitle, { color: textPrimary }]}>
              Data Consent Required
            </Text>
            <Text style={[styles.dialogBody, { color: textSecondary }]}>
              {purpose === 'register'
                ? 'Consent is required to create an account. Closing will cancel your registration.'
                : 'Consent is required to continue. Closing will cancel your login.'}
            </Text>
            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={[
                  styles.dialogSecondaryBtn,
                  {
                    backgroundColor: isDark ? colors.neutral[700] : '#FFFFFF',
                    borderColor: isDark ? colors.neutral[600] : colors.neutral[300],
                  },
                ]}
                onPress={handleConfirmExit}
              >
                <Text
                  style={[
                    styles.dialogSecondaryText,
                    { color: isDark ? colors.neutral[300] : colors.neutral[600] },
                  ]}
                >
                  Cancel {purpose === 'register' ? 'Registration' : 'Login'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogPrimaryBtn, { backgroundColor: colors.primary[500] }]}
                onPress={handleCancelExit}
              >
                <Text style={styles.dialogPrimaryText}>Continue Review</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Email Already Exists Dialog ────────────────────────────────────── */}
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
            <View style={styles.dialogIconRow}>
              <View
                style={[
                  styles.dialogIconCircle,
                  {
                    backgroundColor: isDark
                      ? 'rgba(241,197,38,0.2)'
                      : colors.primary[100] ?? '#FEF9E7',
                  },
                ]}
              >
                <Text style={styles.dialogIconEmoji}>👤</Text>
              </View>
            </View>
            <Text style={[styles.dialogTitle, { color: textPrimary }]}>
              Account Already Exists
            </Text>
            <Text style={[styles.dialogBody, { color: textSecondary }]}>
              An account with this email already exists. Please log in to your existing
              account instead.
            </Text>
            <TouchableOpacity
              style={[styles.dialogFullBtn, { backgroundColor: colors.primary[500] }]}
              onPress={handleGoToLogin}
            >
              <Text style={styles.dialogPrimaryText}>Go to Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Overlay & modal shell
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    // `height` is set inline (dynamic via useWindowDimensions)
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: { fontSize: 18 },
  headerTextBlock: { flex: 1 },
  headerTitle: { fontSize: 15, fontWeight: '700', letterSpacing: 0.1 },
  headerSubtitle: { fontSize: 11, marginTop: 2 },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  closeBtnText: { fontSize: 13, fontWeight: '700' },

  // Content area — flex: 1 so it takes all space between header and footer
  contentArea: {
    flex: 1,
    overflow: 'hidden',
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  stateText: { fontSize: 14, marginTop: 12 },
  errorIcon: { fontSize: 32, marginBottom: 12 },
  errorText: { fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },

  // Version-updated banner
  versionNotice: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 4,
  },
  versionNoticeTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    color: '#92400E',
  },
  versionNoticeText: { fontSize: 12, lineHeight: 18 },

  // Scroll hint
  scrollHintBanner: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  scrollHintText: { fontSize: 12, fontWeight: '600' },

  // Policy scroll area — flex: 1 (no maxHeight constraint)
  scrollContent: { flex: 1 },
  scrollContentInner: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },

  // Version badge at end of policy
  versionBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  versionLabel: { fontSize: 11 },
  versionBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  versionBadgeText: { fontSize: 11, fontWeight: '700', fontFamily: 'monospace' },

  // Footer
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkmark: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  checkboxLabelBlock: { flex: 1 },
  checkboxLabel: { fontSize: 12, lineHeight: 18 },
  checkboxHint: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  footerError: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  footerErrorText: { fontSize: 12, textAlign: 'center' },
  footerButtons: { flexDirection: 'row', gap: 8 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '500' },
  acceptBtn: {
    flex: 1.6,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  acceptBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // Dialogs (exit warning + email exists)
  dialogContainer: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    padding: 24,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    alignItems: 'center',
  },
  dialogIconRow: { marginBottom: 14 },
  dialogIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogIconEmoji: { fontSize: 24 },
  dialogTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  dialogBody: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 20 },
  dialogButtons: { flexDirection: 'row', gap: 8, width: '100%' },
  dialogSecondaryBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  dialogSecondaryText: { fontSize: 13, fontWeight: '500' },
  dialogPrimaryBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  dialogPrimaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  dialogFullBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
});

export default DataConsent;
