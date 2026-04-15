/**
 * My Documents Screen
 *
 * Mirrors mds-patient my-documents flow:
 * - Requested documents (Requested, Pending, Recorded/Rejected)
 * - Manual upload + submit for requested files
 * - Issued documents list with open action
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  StyleSheet,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, colors } from '../../context/ThemeContext';
import {
  getMyDocuments,
  downloadAndOpenDocument,
  getRequestedDocuments,
  stageRequestedDocumentFile,
  uploadRequestedDocument,
  type PatientDocument,
  type RequestedDocument,
} from '../../services/documents-service';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const TYPE_LABELS: Record<string, string> = {
  prescription: 'Prescription',
  'medical-certificate': 'Medical Certificate',
  'diagnosis-report': 'Diagnosis Report',
  'staff-report': 'Staff Report',
};

type DocIconConfig =
  | { lib: 'Ionicons'; name: React.ComponentProps<typeof Ionicons>['name'] }
  | { lib: 'MCI'; name: string };

const TYPE_ICON: Record<string, DocIconConfig> = {
  prescription: { lib: 'MCI', name: 'pill' },
  'medical-certificate': { lib: 'Ionicons', name: 'medkit' },
  'diagnosis-report': { lib: 'Ionicons', name: 'flask' },
  'staff-report': { lib: 'Ionicons', name: 'document-text' },
};

const TYPE_COLOR: Record<string, string> = {
  prescription: colors.primary[500],
  'medical-certificate': colors.accent[500],
  'diagnosis-report': colors.success[500],
  'staff-report': colors.neutral[500],
};

type RequestFilter = 'requested' | 'pending' | 'recorded';

interface StagedFile {
  fileId: string;
  name: string;
  size: number;
  mimeType: string;
}

interface RequestStatusColors {
  border: string;
  background: string;
  iconBg: string;
  iconColor: string;
  chipBg: string;
  chipText: string;
}

const getStatusColors = (status: string, isDark: boolean): RequestStatusColors => {
  switch (status) {
    case 'Recorded':
      return {
        border: isDark ? 'rgba(34,197,94,0.45)' : 'rgba(34,197,94,0.35)',
        background: isDark ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.08)',
        iconBg: isDark ? 'rgba(34,197,94,0.2)' : 'rgba(34,197,94,0.16)',
        iconColor: isDark ? '#86EFAC' : '#15803D',
        chipBg: isDark ? 'rgba(34,197,94,0.2)' : '#DCFCE7',
        chipText: isDark ? '#86EFAC' : '#166534',
      };
    case 'Rejected':
      return {
        border: isDark ? 'rgba(239,68,68,0.45)' : 'rgba(239,68,68,0.35)',
        background: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.08)',
        iconBg: isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.16)',
        iconColor: isDark ? '#FCA5A5' : '#B91C1C',
        chipBg: isDark ? 'rgba(239,68,68,0.2)' : '#FEE2E2',
        chipText: isDark ? '#FCA5A5' : '#991B1B',
      };
    case 'Pending':
      return {
        border: isDark ? 'rgba(59,130,246,0.45)' : 'rgba(59,130,246,0.35)',
        background: isDark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.08)',
        iconBg: isDark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.16)',
        iconColor: isDark ? '#93C5FD' : '#1D4ED8',
        chipBg: isDark ? 'rgba(59,130,246,0.2)' : '#DBEAFE',
        chipText: isDark ? '#93C5FD' : '#1E3A8A',
      };
    default:
      return {
        border: isDark ? 'rgba(241,197,38,0.45)' : 'rgba(241,197,38,0.35)',
        background: isDark ? 'rgba(241,197,38,0.08)' : 'rgba(241,197,38,0.08)',
        iconBg: isDark ? 'rgba(241,197,38,0.2)' : 'rgba(241,197,38,0.16)',
        iconColor: isDark ? '#FCD34D' : '#B45309',
        chipBg: isDark ? 'rgba(241,197,38,0.2)' : '#FEF3C7',
        chipText: isDark ? '#FCD34D' : '#92400E',
      };
  }
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function formatFileSize(size: number): string {
  if (!size || size <= 0) return 'Unknown size';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

const IssuedDocumentCard: React.FC<{
  doc: PatientDocument;
  isDark: boolean;
  onOpen: () => void;
  isOpening: boolean;
}> = ({ doc, isDark, onOpen, isOpening }) => {
  const label = TYPE_LABELS[doc.templateType] || doc.templateType;
  const iconConfig = TYPE_ICON[doc.templateType] ?? { lib: 'Ionicons', name: 'document' };
  const badgeColor = TYPE_COLOR[doc.templateType] || colors.neutral[500];

  return (
    <View
      style={[
        styles.issuedCard,
        {
          backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF',
          borderColor: isDark ? colors.neutral[700] : colors.neutral[200],
        },
      ]}
    >
      <View
        style={[
          styles.issuedIcon,
          {
            backgroundColor: isDark ? `${badgeColor}22` : `${badgeColor}18`,
          },
        ]}
      >
        {iconConfig.lib === 'MCI' ? (
          <MaterialCommunityIcons name={iconConfig.name as any} size={22} color={badgeColor} />
        ) : (
          <Ionicons name={iconConfig.name} size={22} color={badgeColor} />
        )}
      </View>

      <View style={styles.issuedBody}>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: `${badgeColor}20`, borderColor: `${badgeColor}40` }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>{label}</Text>
          </View>
        </View>

        {doc.description ? (
          <Text
            style={[styles.description, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}
            numberOfLines={2}
          >
            {doc.description}
          </Text>
        ) : null}

        <View style={styles.metaRow}>
          <Text style={[styles.metaText, { color: isDark ? colors.neutral[500] : colors.neutral[400] }]}>
            Issued: {formatDateTime(doc.createdAt)}
          </Text>
          {doc.issuedBy?.name ? (
            <Text style={[styles.metaText, { color: isDark ? colors.neutral[500] : colors.neutral[400] }]}>
              By: {doc.issuedBy.name}
            </Text>
          ) : null}
          {doc.expiredAt ? (
            <Text style={[styles.metaText, { color: isDark ? colors.accent[400] : colors.accent[600] }]}>
              Expires: {formatDate(doc.expiredAt)}
            </Text>
          ) : null}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.openBtn, { backgroundColor: colors.primary[500], opacity: isOpening ? 0.65 : 1 }]}
        onPress={onOpen}
        activeOpacity={0.82}
        disabled={isOpening}
      >
        {isOpening ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.openBtnText}>Open</Text>}
      </TouchableOpacity>
    </View>
  );
};

interface MyDocumentsScreenProps {
  navigation: any;
}

export const MyDocumentsScreen: React.FC<MyDocumentsScreenProps> = () => {
  const { isDark } = useTheme();

  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [requestedDocs, setRequestedDocs] = useState<RequestedDocument[]>([]);

  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [requestFilter, setRequestFilter] = useState<RequestFilter>('requested');
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [stagedFiles, setStagedFiles] = useState<Record<number, StagedFile>>({});

  const loadDocuments = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const issued = await getMyDocuments();
      setDocuments(issued);
    } catch (err: any) {
      setError(err.message || 'Failed to load issued documents.');
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  const loadRequested = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const requested = await getRequestedDocuments();
      setRequestedDocs(requested);
    } catch (err: any) {
      setError(err.message || 'Failed to load document requests.');
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setError(null);
    await Promise.all([loadDocuments(), loadRequested()]);
  }, [loadDocuments, loadRequested]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const pickAndStageFile = async (documentId: number) => {
    const pickerResult = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
      type: ['application/pdf', 'image/*'],
    });

    if (pickerResult.canceled || !pickerResult.assets?.length) {
      return;
    }

    const asset = pickerResult.assets[0];
    setUploadingId(documentId);
    setError(null);

    try {
      const fileId = await stageRequestedDocumentFile({
        uri: asset.uri,
        name: asset.name || `document-${Date.now()}`,
        type: asset.mimeType || 'application/octet-stream',
      });

      setStagedFiles((prev) => ({
        ...prev,
        [documentId]: {
          fileId,
          name: asset.name || 'Selected file',
          size: asset.size || 0,
          mimeType: asset.mimeType || 'application/octet-stream',
        },
      }));
    } catch (err: any) {
      setError(err.message || 'Failed to stage selected file.');
    } finally {
      setUploadingId(null);
    }
  };

  const submitRequestedDocument = async (documentId: number) => {
    const staged = stagedFiles[documentId];
    if (!staged?.fileId) {
      Alert.alert('No File Selected', 'Please select a file before submitting.');
      return;
    }

    setSubmittingId(documentId);
    setError(null);

    try {
      await uploadRequestedDocument(documentId, staged.fileId);
      setStagedFiles((prev) => {
        const next = { ...prev };
        delete next[documentId];
        return next;
      });
      await Promise.all([loadDocuments(), loadRequested()]);
      Alert.alert('Submitted', 'Your document has been submitted for review.');
    } catch (err: any) {
      setError(err.message || 'Failed to submit document.');
    } finally {
      setSubmittingId(null);
    }
  };

  const cancelStagedFile = (documentId: number) => {
    setStagedFiles((prev) => {
      const next = { ...prev };
      delete next[documentId];
      return next;
    });
  };

  const openIssuedDocument = async (doc: PatientDocument) => {
    if (downloadingId !== null) return;

    setDownloadingId(doc.id);
    try {
      await downloadAndOpenDocument(doc);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to open the document.');
    } finally {
      setDownloadingId(null);
    }
  };

  const requested = requestedDocs.filter((d) => d.submission?.status === 'Requested');
  const pending = requestedDocs.filter((d) => d.submission?.status === 'Pending');
  const recorded = requestedDocs.filter(
    (d) => d.submission?.status === 'Recorded' || d.submission?.status === 'Rejected'
  );

  const filteredRequests =
    requestFilter === 'requested'
      ? requested
      : requestFilter === 'pending'
        ? pending
        : recorded;

  const bg = isDark ? colors.neutral[900] : colors.neutral[50];
  const textPrimary = isDark ? colors.neutral[100] : colors.secondary[900];
  const textMuted = isDark ? colors.neutral[400] : colors.neutral[500];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary[500]]}
            tintColor={colors.primary[500]}
          />
        }
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: textPrimary }]}>My Documents</Text>
            <Text style={[styles.subtitle, { color: textMuted }]}>Manage requests and view issued documents.</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.refreshBtn,
              { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF', borderColor: isDark ? colors.neutral[700] : colors.neutral[200] },
            ]}
            onPress={onRefresh}
            activeOpacity={0.76}
            disabled={loadingDocs || loadingRequests}
          >
            {loadingDocs || loadingRequests ? (
              <ActivityIndicator size="small" color={colors.primary[500]} />
            ) : (
              <Ionicons name="refresh" size={18} color={colors.primary[500]} />
            )}
          </TouchableOpacity>
        </View>

        {error ? (
          <View
            style={[
              styles.errorBox,
              {
                backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#FEF2F2',
                borderColor: isDark ? 'rgba(239,68,68,0.35)' : '#FECACA',
              },
            ]}
          >
            <Ionicons name="warning" size={16} color={isDark ? '#FCA5A5' : '#B91C1C'} style={{ marginRight: 6 }} />
            <Text style={{ color: isDark ? '#FCA5A5' : '#B91C1C', fontSize: 13, flex: 1 }}>{error}</Text>
          </View>
        ) : null}

        {(loadingRequests || requestedDocs.length > 0) && (
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF', borderColor: isDark ? colors.neutral[700] : colors.neutral[200] },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>Document Requests</Text>

            <View style={styles.tabRow}>
              {([
                { key: 'requested', label: 'Requested', count: requested.length },
                { key: 'pending', label: 'Pending', count: pending.length },
                { key: 'recorded', label: 'Recorded', count: recorded.length },
              ] as Array<{ key: RequestFilter; label: string; count: number }>).map((tab) => {
                const active = requestFilter === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[
                      styles.tabBtn,
                      active
                        ? { backgroundColor: isDark ? 'rgba(241,197,38,0.25)' : colors.primary[100], borderColor: colors.primary[500] }
                        : { backgroundColor: 'transparent', borderColor: 'transparent' },
                    ]}
                    onPress={() => setRequestFilter(tab.key)}
                    activeOpacity={0.78}
                  >
                    <Text
                      style={[
                        styles.tabBtnText,
                        { color: active ? (isDark ? colors.primary[300] : colors.primary[700]) : textMuted },
                      ]}
                    >
                      {tab.label} ({tab.count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {loadingRequests ? (
              <View style={styles.loaderWrap}>
                <ActivityIndicator size="small" color={colors.primary[500]} />
                <Text style={[styles.loaderText, { color: textMuted }]}>Loading requested documents...</Text>
              </View>
            ) : filteredRequests.length === 0 ? (
              <View style={styles.emptyRequestWrap}>
                <Ionicons name="document" size={34} color={isDark ? colors.neutral[600] : colors.neutral[300]} />
                <Text style={[styles.emptyRequestText, { color: textMuted }]}>No {requestFilter} documents.</Text>
              </View>
            ) : (
              <View style={styles.requestList}>
                {filteredRequests.map((doc) => {
                  const status = doc.submission?.status || 'Requested';
                  const colorsByStatus = getStatusColors(status, isDark);
                  const isRequested = status === 'Requested';
                  const isPendingStatus = status === 'Pending';
                  const isRecordedStatus = status === 'Recorded';
                  const isRejectedStatus = status === 'Rejected';
                  const staged = stagedFiles[doc.id];
                  const isUploading = uploadingId === doc.id;
                  const isSubmitting = submittingId === doc.id;

                  return (
                    <View
                      key={doc.id}
                      style={[
                        styles.requestCard,
                        {
                          borderColor: colorsByStatus.border,
                          backgroundColor: colorsByStatus.background,
                        },
                      ]}
                    >
                      <View style={styles.requestHeaderRow}>
                        <View
                          style={[
                            styles.requestIcon,
                            { backgroundColor: colorsByStatus.iconBg },
                          ]}
                        >
                          {isRecordedStatus ? (
                            <Ionicons name="checkmark" size={20} color={colorsByStatus.iconColor} />
                          ) : isRejectedStatus ? (
                            <Ionicons name="close" size={20} color={colorsByStatus.iconColor} />
                          ) : isPendingStatus ? (
                            <Ionicons name="time" size={20} color={colorsByStatus.iconColor} />
                          ) : (
                            <Ionicons name="document" size={20} color={colorsByStatus.iconColor} />
                          )}
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={[styles.requestTitle, { color: textPrimary }]}>{doc.label}</Text>
                          {doc.submission?.recordedBy?.name ? (
                            <Text style={[styles.requestMeta, { color: textMuted }]}>Requested by: {doc.submission.recordedBy.name}</Text>
                          ) : null}
                          {doc.submission?.submittedAt ? (
                            <Text style={[styles.requestMeta, { color: textMuted }]}>Submitted: {formatDate(doc.submission.submittedAt)}</Text>
                          ) : null}
                        </View>

                        <View style={[styles.statusChip, { backgroundColor: colorsByStatus.chipBg }]}>
                          <Text style={[styles.statusChipText, { color: colorsByStatus.chipText }]}>
                            {status === 'Recorded' ? 'Approved' : status}
                          </Text>
                        </View>
                      </View>

                      {doc.submission?.notes ? (
                        <View
                          style={[
                            styles.noteBox,
                            {
                              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                              borderColor: isDark ? colors.neutral[700] : colors.neutral[200],
                            },
                          ]}
                        >
                          <Text style={[styles.noteLabel, { color: textMuted }]}>Staff Notes</Text>
                          <Text style={[styles.noteText, { color: textPrimary }]}>{doc.submission.notes}</Text>
                        </View>
                      ) : null}

                      {isPendingStatus && !doc.submission?.notes ? (
                        <View style={[styles.statusBox, { backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF' }]}>
                          <Text style={[styles.statusBoxText, { color: isDark ? '#93C5FD' : '#1D4ED8' }]}>
                            Under review. You will be notified once approved.
                          </Text>
                        </View>
                      ) : null}

                      {isRecordedStatus && !doc.submission?.notes ? (
                        <View style={[styles.statusBox, { backgroundColor: isDark ? 'rgba(34,197,94,0.15)' : '#F0FDF4' }]}>
                          <Text style={[styles.statusBoxText, { color: isDark ? '#86EFAC' : '#166534' }]}>
                            Approved and recorded. No action required.
                          </Text>
                        </View>
                      ) : null}

                      {isRejectedStatus && !doc.submission?.notes ? (
                        <View style={[styles.statusBox, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2' }]}>
                          <Text style={[styles.statusBoxText, { color: isDark ? '#FCA5A5' : '#B91C1C' }]}>
                            Rejected. Please wait for a new request from staff.
                          </Text>
                        </View>
                      ) : null}

                      {isRequested && (
                        <View style={styles.uploadAreaWrap}>
                          {staged ? (
                            <View
                              style={[
                                styles.stagedBox,
                                {
                                  backgroundColor: isDark ? 'rgba(34,197,94,0.14)' : '#F0FDF4',
                                  borderColor: isDark ? 'rgba(34,197,94,0.45)' : '#86EFAC',
                                },
                              ]}
                            >
                              <Text style={[styles.stagedName, { color: isDark ? '#86EFAC' : '#166534' }]} numberOfLines={1}>
                                {staged.name}
                              </Text>
                              <Text style={[styles.stagedMeta, { color: isDark ? '#86EFAC' : '#15803D' }]}>
                                {formatFileSize(staged.size)} • Ready to submit
                              </Text>

                              <View style={styles.stagedActions}>
                                <TouchableOpacity
                                  style={[styles.submitBtn, { backgroundColor: colors.success[600], opacity: isSubmitting ? 0.7 : 1 }]}
                                  onPress={() => submitRequestedDocument(doc.id)}
                                  disabled={isSubmitting}
                                  activeOpacity={0.82}
                                >
                                  {isSubmitting ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                  ) : (
                                    <Text style={styles.submitBtnText}>Submit Document</Text>
                                  )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                  style={[
                                    styles.cancelBtn,
                                    {
                                      backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100],
                                    },
                                  ]}
                                  onPress={() => cancelStagedFile(doc.id)}
                                  disabled={isSubmitting}
                                  activeOpacity={0.82}
                                >
                                  <Text style={{ color: isDark ? colors.neutral[200] : colors.secondary[700], fontWeight: '600' }}>
                                    Cancel
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={[
                                styles.uploadSelectBtn,
                                {
                                  borderColor: isDark ? colors.primary[700] : colors.primary[300],
                                  backgroundColor: isDark ? 'rgba(241,197,38,0.07)' : colors.primary[50],
                                  opacity: isUploading ? 0.7 : 1,
                                },
                              ]}
                              onPress={() => pickAndStageFile(doc.id)}
                              activeOpacity={0.82}
                              disabled={isUploading}
                            >
                              {isUploading ? (
                                <>
                                  <ActivityIndicator size="small" color={colors.primary[500]} />
                                  <Text style={[styles.uploadSelectText, { color: isDark ? colors.primary[300] : colors.primary[700] }]}>Uploading...</Text>
                                </>
                              ) : (
                                <>
                                  <Ionicons name="cloud-upload" size={20} color={isDark ? colors.primary[300] : colors.primary[700]} />
                                  <Text style={[styles.uploadSelectText, { color: isDark ? colors.primary[300] : colors.primary[700] }]}>Select PDF or image</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        <View style={{ marginTop: 8 }}>
          <Text style={[styles.sectionHeaderText, { color: textPrimary }]}>Issued Documents</Text>
          <Text style={[styles.sectionHeaderSubText, { color: textMuted }]}>Documents generated by your healthcare provider.</Text>
        </View>

        {loadingDocs ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="small" color={colors.primary[500]} />
            <Text style={[styles.loaderText, { color: textMuted }]}>Loading issued documents...</Text>
          </View>
        ) : documents.length === 0 ? (
          <View style={styles.emptyIssuedWrap}>
            <Ionicons name="document-text" size={42} color={isDark ? colors.neutral[600] : colors.neutral[300]} />
            <Text style={[styles.emptyIssuedTitle, { color: textPrimary }]}>No Issued Documents</Text>
            <Text style={[styles.emptyIssuedBody, { color: textMuted }]}>Issued prescriptions and certificates will appear here.</Text>
          </View>
        ) : (
          <View style={styles.issuedList}>
            {documents.map((doc) => (
              <IssuedDocumentCard
                key={doc.id}
                doc={doc}
                isDark={isDark}
                onOpen={() => openIssuedDocument(doc)}
                isOpening={downloadingId === doc.id}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 28, gap: 12 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 23,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 11,
    borderRadius: 10,
    borderWidth: 1,
  },

  sectionCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },

  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  tabBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },

  loaderWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 22,
    gap: 8,
  },
  loaderText: {
    fontSize: 12,
  },

  emptyRequestWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  emptyRequestText: {
    fontSize: 13,
    fontWeight: '600',
  },

  requestList: {
    gap: 10,
  },
  requestCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  requestHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  requestIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 1,
  },
  requestMeta: {
    fontSize: 11,
    marginTop: 1,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
  },

  noteBox: {
    marginTop: 9,
    borderWidth: 1,
    borderRadius: 9,
    padding: 8,
  },
  noteLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 3,
  },
  noteText: {
    fontSize: 12,
    lineHeight: 17,
  },

  statusBox: {
    marginTop: 9,
    borderRadius: 8,
    padding: 8,
  },
  statusBoxText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },

  uploadAreaWrap: {
    marginTop: 10,
  },
  uploadSelectBtn: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  uploadSelectText: {
    fontSize: 13,
    fontWeight: '700',
  },

  stagedBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  stagedName: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  stagedMeta: {
    fontSize: 11,
    marginBottom: 10,
  },
  stagedActions: {
    flexDirection: 'row',
    gap: 8,
  },
  submitBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  cancelBtn: {
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionHeaderText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  sectionHeaderSubText: {
    fontSize: 12,
  },

  emptyIssuedWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 44,
    gap: 8,
  },
  emptyIssuedTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  emptyIssuedBody: {
    fontSize: 12,
    maxWidth: 260,
    textAlign: 'center',
    lineHeight: 18,
  },

  issuedList: {
    gap: 10,
  },
  issuedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  issuedIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  issuedBody: { flex: 1, gap: 4 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  description: { fontSize: 12 },
  metaRow: { gap: 2 },
  metaText: { fontSize: 11 },

  openBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    flexShrink: 0,
  },
  openBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});

export default MyDocumentsScreen;
