/**
 * Medicine Request Screen
 * Mirrors mds-patient medicine-request module
 *
 * Features ported from web:
 * - Email-based location auto-detection (m-prefix → Arlegui/Casal, q-prefix → Quezon City)
 * - Cancel-and-resubmit flow when a pending request already exists
 * - In-app notification banner for approved/rejected requests
 *
 * Uses backend queries: getAvailableMedicine, getMedicineStatus, createMedicineRequest
 * Branches: Casal, Arlegui, Quezon City (LocationDesignation enum)
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Animated,
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Modal,
  Easing,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, colors } from '../../context/ThemeContext';
import { useBanner } from '../../context/BannerContext';
import { toggleAppDrawer } from '../../navigation/drawer-utils';
import { TopBar } from '../../components/layout/TopBar';
import { SegmentControl } from '../../components/common/SegmentControl';
import { FieldLabel } from '../../components/common/InputField';
import { PrimaryButton } from '../../components/common/PrimaryButton';
import { getPatientProfile } from '../../services/profile-service';
import {
  BRANCHES,
  getAvailableMedicine,
  getMedicineStatus,
  createMedicineRequest,
  cancelMedicineRequest,
  type AvailableMedicine,
  type MedicineRequest,
  type LocationDesignation,
} from '../../services/medicine-service';

const DISMISSED_KEY = 'dismissedMedicalNotifications';
const ERROR_AUTO_DISMISS_MS = 4500;
const ERROR_ANIMATION_MS = 220;

interface GroupedMedicine {
  item_code: string;
  item_name: string;
  category: string;
  batches: AvailableMedicine[];
}

const statusColors: Record<string, { bg: string; text: string }> = {
  Pending: { bg: colors.primary[100], text: colors.primary[800] },
  Approved: { bg: colors.success[100], text: colors.success[600] },
  Rejected: { bg: colors.error[100], text: colors.error[600] },
  Completed: { bg: colors.success[100], text: colors.success[600] },
  Cancelled: { bg: colors.neutral[200], text: colors.neutral[600] },
  Expired: { bg: colors.neutral[200], text: colors.neutral[600] },
  InProgress: { bg: colors.accent[100], text: colors.accent[600] },
  Revision: { bg: colors.primary[100], text: colors.primary[700] },
};

const normalizeStatus = (status?: string | null) => (status || '').trim().toLowerCase();
const isPendingStatus = (status?: string | null) => normalizeStatus(status) === 'pending';

export const MedicineRequestScreen: React.FC = () => {
  const { isDark } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { showBanner } = useBanner();
  const isNestedMoreRoute = route.name === 'MedicineRequest';

  // Views
  const [view, setView] = useState<'form' | 'status'>('form');

  // Email-based location detection (mirrors mds-patient)
  const [emailPrefix, setEmailPrefix] = useState<string>('');
  const [allowedBranches, setAllowedBranches] = useState(BRANCHES);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  // Form state
  const [purpose, setPurpose] = useState('');
  const [isPurposeFocused, setIsPurposeFocused] = useState(false);
  const [location, setLocation] = useState<LocationDesignation | ''>('');
  const [medicines, setMedicines] = useState<AvailableMedicine[]>([]);
  const [grouped, setGrouped] = useState<GroupedMedicine[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [loadingMeds, setLoadingMeds] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorVersion, setErrorVersion] = useState(0);
  const errorAnim = useRef(new Animated.Value(0)).current;
  const errorDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorVersionRef = useRef(0);

  // Cancel-and-resubmit flow
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [pendingItems, setPendingItems] = useState<Array<{ batchId: number; quantity: number }>>([]);

  // In-app notification for approved/rejected requests
  const [notificationRequest, setNotificationRequest] = useState<MedicineRequest | null>(null);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  // Status state
  const [requests, setRequests] = useState<MedicineRequest[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const pendingRequests = useMemo(
    () =>
      requests
        .filter((r) => isPendingStatus(r.status))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [requests]
  );
  const latestPendingRequest = pendingRequests[0] ?? null;
  const hasPendingRequest = pendingRequests.length > 0;
  const isFormValid = Boolean(purpose.trim()) && Boolean(location) && selectedCodes.size > 0;

  const segmentOptions = useMemo(
    () => [
      { value: 'form', label: 'New Request' },
      {
        value: 'status',
        label: hasPendingRequest ? `Request Status (${pendingRequests.length})` : 'Request Status',
      },
    ],
    [hasPendingRequest, pendingRequests.length],
  );

  const branchOptions = useMemo(
    () => allowedBranches.map((branch) => ({ value: branch.value, label: branch.label })),
    [allowedBranches],
  );

  const clearErrorTimer = useCallback(() => {
    if (!errorDismissTimerRef.current) return;
    clearTimeout(errorDismissTimerRef.current);
    errorDismissTimerRef.current = null;
  }, []);

  const dismissError = useCallback((animated = true, expectedVersion = errorVersionRef.current) => {
    clearErrorTimer();

    if (!animated) {
      if (errorVersionRef.current === expectedVersion) {
        errorAnim.stopAnimation();
        errorAnim.setValue(0);
        setError(null);
      }
      return;
    }

    Animated.timing(errorAnim, {
      toValue: 0,
      duration: ERROR_ANIMATION_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      if (errorVersionRef.current !== expectedVersion) return;
      setError(null);
      errorAnim.setValue(0);
    });
  }, [clearErrorTimer, errorAnim]);

  const showError = useCallback((message: string) => {
    clearErrorTimer();
    setError(message);
    setErrorVersion((prev) => {
      const next = prev + 1;
      errorVersionRef.current = next;
      return next;
    });
  }, [clearErrorTimer]);

  const errorAnimatedStyle = useMemo(
    () => ({
      opacity: errorAnim,
      transform: [
        {
          translateY: errorAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [-10, 0],
          }),
        },
        {
          scale: errorAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.98, 1],
          }),
        },
      ],
    }),
    [errorAnim]
  );

  useEffect(() => {
    if (!error) return;

    const versionAtStart = errorVersionRef.current;
    errorAnim.stopAnimation();
    errorAnim.setValue(0);

    Animated.timing(errorAnim, {
      toValue: 1,
      duration: ERROR_ANIMATION_MS + 60,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    errorDismissTimerRef.current = setTimeout(() => {
      dismissError(true, versionAtStart);
    }, ERROR_AUTO_DISMISS_MS);

    return clearErrorTimer;
  }, [error, errorVersion, dismissError, clearErrorTimer, errorAnim]);

  // ── Load profile & detect location access ──────────────────────────────
  useEffect(() => {
    getPatientProfile()
      .then((profile) => {
        const email = profile?.email?.toLowerCase()?.trim() || '';
        const prefix = email.charAt(0);
        setEmailPrefix(prefix);

        if (prefix === 'q') {
          // Quezon City campus — auto-assign, no choice needed
          setAllowedBranches(BRANCHES.filter((b) => b.value === 'QuezonCity'));
          setLocation('QuezonCity');
        } else if (prefix === 'm') {
          // Main campus — can choose Arlegui or Casal
          setAllowedBranches(BRANCHES.filter((b) => b.value !== 'QuezonCity'));
        }
        // else: unknown prefix → show all branches
      })
      .catch(() => {})
      .finally(() => setIsProfileLoading(false));
  }, []);

  // ── Load dismissed notifications from storage ──────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_KEY)
      .then((raw) => {
        if (raw) setDismissedIds(JSON.parse(raw));
      })
      .catch(() => {});
  }, []);

  // ── Compute which request (if any) needs a notification banner ─────────
  useEffect(() => {
    if (!requests.length) { setNotificationRequest(null); return; }

    const notifiable = requests
      .filter((r) => {
        const s = r.status?.toLowerCase();
        return s === 'approved' || s === 'rejected';
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const toShow = notifiable.find((r) => !dismissedIds.includes(String(r.id)));
    setNotificationRequest(toShow ?? null);
  }, [requests, dismissedIds]);

  const handleDismissNotification = useCallback(async () => {
    if (!notificationRequest) return;
    const newIds = [...dismissedIds, String(notificationRequest.id)];
    setDismissedIds(newIds);
    setNotificationRequest(null);
    try {
      await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(newIds));
    } catch {}
  }, [notificationRequest, dismissedIds]);

  // ── Load medicines when location changes ──────────────────────────────
  useEffect(() => {
    if (!location) {
      setMedicines([]);
      setGrouped([]);
      return;
    }
    const load = async () => {
      setLoadingMeds(true);
      dismissError(false);
      try {
        const meds = await getAvailableMedicine(location);
        setMedicines(meds);
        // Group by item_code (same as web)
        const groupMap: Record<string, GroupedMedicine> = {};
        meds.forEach((m) => {
          if (!groupMap[m.item_code]) {
            groupMap[m.item_code] = {
              item_code: m.item_code,
              item_name: m.item_name,
              category: m.category,
              batches: [],
            };
          }
          groupMap[m.item_code].batches.push(m);
        });
        setGrouped(Object.values(groupMap));
      } catch (err: any) {
        showError('Failed to load medicines: ' + err.message);
      } finally {
        setLoadingMeds(false);
      }
    };
    load();
  }, [location, dismissError, showError]);

  // ── Load request history ───────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const data = await getMedicineStatus();
      setRequests(data);
    } catch {
      setRequests([]);
    } finally {
      setLoadingStatus(false);
      setRefreshing(false);
    }
  }, []);

  // Load on mount and when switching to status view
  useEffect(() => {
    loadHistory();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (view === 'status') loadHistory();
  }, [view, loadHistory]);

  // ── Submit (with cancel-and-resubmit gate) ────────────────────────────
  const handleSubmit = async () => {
    dismissError(false);
    if (!purpose.trim()) { showError('Please enter the purpose of your request.'); return; }
    if (!location) { showError('Please select a branch.'); return; }
    if (selectedCodes.size === 0) { showError('Please select at least one medicine.'); return; }

    // Build items from first batch of each selected code (like the web app)
    const items: Array<{ batchId: number; quantity: number }> = [];
    for (const code of selectedCodes) {
      const group = grouped.find((g) => g.item_code === code);
      if (!group || group.batches.length === 0) {
        showError(`No available batch for ${group?.item_name || code}`);
        return;
      }
      items.push({ batchId: parseInt(group.batches[0].id, 10), quantity: 1 });
    }

    // If there's a pending request, offer cancel-and-resubmit (mirrors web)
    if (hasPendingRequest) {
      setPendingItems(items);
      setShowCancelConfirm(true);
      return;
    }

    await doSubmit(items);
  };

  const doSubmit = async (items: Array<{ batchId: number; quantity: number }>) => {
    setSubmitting(true);
    try {
      const result = await createMedicineRequest(purpose.trim(), location as LocationDesignation, items);
      setRequests((prev) => [result, ...prev]);
      showBanner({ type: 'success', message: 'Medicine request submitted successfully!' });
      setPurpose('');
      if (emailPrefix !== 'q') setLocation('');
      setSelectedCodes(new Set());
      setMedicines([]);
      setGrouped([]);
    } catch (err: any) {
      showError(err.message || 'Failed to submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelPendingAndResubmit = async () => {
    setShowCancelConfirm(false);
    setSubmitting(true);
    dismissError(false);
    try {
      await cancelMedicineRequest();
      // Update local state immediately
      setRequests((prev) => prev.map((r) => (isPendingStatus(r.status) ? { ...r, status: 'Cancelled' } : r)));
      await doSubmit(pendingItems);
    } catch (err: any) {
      showError(
        err.message ||
          'Unable to cancel your existing request. Please contact clinic staff.',
      );
      setSubmitting(false);
    }
  };

  // ── Toggle medicine by item_code ──────────────────────────────────────
  const toggleMedicine = (code: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        if (next.size >= 2) {
          showError('You can select a maximum of 2 medicines per request.');
          return prev;
        }
        next.add(code);
      }
      return next;
    });
  };

  // ── Cancel a single pending request ──────────────────────────────────
  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancelMedicineRequest();
      showBanner({ type: 'success', message: 'Medicine request cancelled.' });
      await loadHistory();
    } catch (err: any) {
      showError(err.message || 'Failed to cancel request.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] }]}
      edges={['top', 'left', 'right']}
    >
      {/* ── Cancel-and-Resubmit Confirmation Modal ─────────────────────── */}
      <Modal transparent visible={showCancelConfirm} animationType="fade" onRequestClose={() => setShowCancelConfirm(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
            <Text style={[styles.modalTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
              Pending Request Exists
            </Text>
            <Text style={[styles.modalBody, { color: isDark ? colors.neutral[400] : colors.neutral[600] }]}>
              You already have a pending medicine request. Would you like to cancel it and submit this new request instead?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100] }]}
                onPress={() => setShowCancelConfirm(false)}
              >
                <Text style={{ color: isDark ? colors.neutral[300] : colors.neutral[700], fontWeight: '600' }}>Keep Pending</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.error[500] }]}
                onPress={cancelPendingAndResubmit}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Cancel & Resubmit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <TopBar
        title="Medicine"
        showBack={isNestedMoreRoute}
        onBack={() => navigation.goBack()}
        onMenuPress={() => toggleAppDrawer(navigation)}
      />

      <SegmentControl
        options={segmentOptions}
        value={view}
        onChange={(next) => setView(next as 'form' | 'status')}
        className="mx-4 mt-3 mb-4"
      />

      {/* ── Form View ──────────────────────────────────────────────────── */}
      {view === 'form' ? (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                if (location) {
                  try {
                    const meds = await getAvailableMedicine(location as LocationDesignation);
                    setMedicines(meds);
                    const groupMap: Record<string, GroupedMedicine> = {};
                    meds.forEach((m) => {
                      if (!groupMap[m.item_code]) {
                        groupMap[m.item_code] = { item_code: m.item_code, item_name: m.item_name, category: m.category, batches: [] };
                      }
                      groupMap[m.item_code].batches.push(m);
                    });
                    setGrouped(Object.values(groupMap));
                  } catch {}
                }
                setRefreshing(false);
              }}
              colors={[colors.primary[500]]}
              tintColor={colors.primary[500]}
              progressBackgroundColor={colors.secondary[900]}
            />
          }
        >
          {hasPendingRequest && latestPendingRequest && (
            <View
              style={[
                styles.pendingSummaryCard,
                {
                  backgroundColor: isDark ? 'rgba(241,197,38,0.12)' : colors.primary[50],
                  borderColor: isDark ? 'rgba(241,197,38,0.35)' : colors.primary[200],
                },
              ]}
            >
              <View style={[styles.pendingSummaryIconWrap, { backgroundColor: isDark ? 'rgba(241,197,38,0.2)' : '#FFFFFF' }]}>
                <Ionicons name="time-outline" size={16} color={colors.primary[500]} />
              </View>
              <View style={styles.pendingSummaryBody}>
                <Text style={[styles.pendingSummaryTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
                  {pendingRequests.length === 1
                    ? 'You have 1 pending medicine request.'
                    : `You have ${pendingRequests.length} pending medicine requests.`}
                </Text>
                <Text style={[styles.pendingSummaryMeta, { color: isDark ? colors.neutral[300] : colors.neutral[700] }]}>
                  Latest: Request #{latestPendingRequest.id} · {new Date(latestPendingRequest.created_at).toLocaleDateString()} · {latestPendingRequest.items?.length || 0} item{(latestPendingRequest.items?.length || 0) !== 1 ? 's' : ''}
                </Text>
                <Text style={[styles.pendingSummaryHint, { color: isDark ? colors.neutral[400] : colors.neutral[600] }]}>
                  Submitting a new request will prompt you to cancel your pending one first.
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.pendingSummaryAction, { backgroundColor: isDark ? colors.neutral[700] : '#FFFFFF' }]}
                onPress={() => setView('status')}
              >
                <Text style={[styles.pendingSummaryActionText, { color: isDark ? colors.primary[300] : colors.primary[700] }]}>View</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Error */}
          {error && (
            <Animated.View
              style={[
                styles.alertBox,
                {
                  backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : colors.error[50],
                  borderColor: colors.error[400],
                },
                errorAnimatedStyle,
              ]}
            >
              <Text style={{ color: colors.error[500], flex: 1 }}>{error}</Text>
              <TouchableOpacity onPress={() => dismissError()}>
                <Ionicons name="close" size={18} color={colors.error[500]} />
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Purpose (Chief Complaint) */}
          <View style={[styles.card, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
            <FieldLabel label="Purpose" required />
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50],
                  color: isDark ? colors.neutral[100] : colors.neutral[900],
                  borderColor: purpose.length > 280
                    ? colors.error[400]
                    : isPurposeFocused
                    ? colors.primary[500]
                    : isDark
                    ? colors.neutral[600]
                    : colors.neutral[200],
                },
              ]}
              placeholder="Describe your symptoms or reason for request..."
              placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]}
              value={purpose}
              onChangeText={(text) => setPurpose(text.slice(0, 300))}
              onFocus={() => setIsPurposeFocused(true)}
              onBlur={() => setIsPurposeFocused(false)}
              multiline
              numberOfLines={4}
              maxLength={300}
              textAlignVertical="top"
            />
            <Text style={{
              marginTop: 6,
              textAlign: 'right',
              fontSize: 11,
              color: purpose.length > 280
                ? colors.error[500]
                : isDark
                ? colors.neutral[500]
                : colors.neutral[400],
            }}>
              {purpose.length} / 300
            </Text>
          </View>

          {/* Branch Selection — uses allowedBranches from email detection */}
          <View style={[styles.card, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
            <FieldLabel label="Branch" required />
            {isProfileLoading ? (
              <ActivityIndicator size="small" color={colors.primary[500]} />
            ) : (
              <SegmentControl
                options={branchOptions}
                value={location || ''}
                onChange={(value) => setLocation(value as LocationDesignation)}
                className="mx-0 mb-0"
              />
            )}
          </View>

          {/* Medicines */}
          {location !== '' && (
            <View style={[styles.card, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.label, { color: isDark ? colors.neutral[200] : colors.secondary[900], marginBottom: 0 }]}>
                  Select Medicines (max 2) <Text style={{ color: colors.error[500] }}>*</Text>
                </Text>
                {selectedCodes.size > 0 && (
                  <View style={[styles.countBadge, { backgroundColor: colors.primary[500] }]}>
                    <Text style={styles.countText}>{selectedCodes.size}</Text>
                  </View>
                )}
              </View>

              {loadingMeds ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={colors.primary[500]} />
                  <Text style={{ color: isDark ? colors.neutral[400] : colors.neutral[500], marginLeft: 8, fontSize: 13 }}>
                    Loading medicines...
                  </Text>
                </View>
              ) : grouped.length === 0 ? (
                <View style={[styles.emptyState, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50] }]}>
                  <MaterialCommunityIcons name="pill" size={36} color={isDark ? colors.neutral[400] : colors.neutral[500]} style={styles.emptyIcon} />
                  <Text style={[styles.emptyText, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
                    No medicines available for this branch.
                  </Text>
                </View>
              ) : (
                grouped.map((group) => {
                  const isSelected = selectedCodes.has(group.item_code);
                  return (
                    <TouchableOpacity
                      key={group.item_code}
                      style={[
                        styles.medItem,
                        {
                          borderColor: isSelected ? colors.primary[500] : (isDark ? colors.neutral[600] : colors.neutral[200]),
                          backgroundColor: isSelected
                            ? (isDark ? 'rgba(241,197,38,0.08)' : colors.primary[50])
                            : 'transparent',
                        },
                      ]}
                      onPress={() => toggleMedicine(group.item_code)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.checkbox, { borderColor: isSelected ? colors.primary[500] : (isDark ? colors.neutral[500] : colors.neutral[300]) }]}>
                        {isSelected && <View style={[styles.checkboxFill, { backgroundColor: colors.primary[500] }]} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.medName, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
                          {group.item_name}
                        </Text>
                        <Text style={[styles.medDosage, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
                          {group.category} · {group.batches.length} batch{group.batches.length !== 1 ? 'es' : ''} available
                        </Text>
                      </View>
                      {isSelected && (
                        <View style={[styles.selectedBadge, { backgroundColor: colors.primary[500] }]}>
                          <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}

          {/* Submit */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 8,
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
              backgroundColor: isDark ? colors.secondary[700] : colors.accent[50],
            }}
          >
            <Ionicons
              name="information-circle-outline"
              size={16}
              color={isDark ? colors.secondary[200] : colors.accent[600]}
              style={{ marginTop: 2 }}
            />
            <Text style={{
              flex: 1,
              fontSize: 12,
              lineHeight: 20,
              color: isDark ? colors.secondary[200] : colors.accent[700],
            }}>
              After submission, the clinic pharmacist will review your request within 1 business day. You will receive a notification with pickup instructions.
            </Text>
          </View>

          <PrimaryButton
            label="Submit request"
            onPress={handleSubmit}
            loading={submitting}
            disabled={!isFormValid}
          />
        </ScrollView>
      ) : (
        /* ── Status View ──────────────────────────────────────────────── */
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadHistory(); }}
              colors={[colors.primary[500]]}
              tintColor={colors.primary[500]}
              progressBackgroundColor={colors.secondary[900]}
            />
          }
        >
          {/* In-app notification banner for approved/rejected requests */}
          {notificationRequest && (
            <View
              style={[
                styles.notifBanner,
                {
                  backgroundColor: notificationRequest.status?.toLowerCase() === 'approved'
                    ? (isDark ? 'rgba(34,197,94,0.15)' : colors.success[50])
                    : (isDark ? 'rgba(239,68,68,0.15)' : colors.error[50]),
                  borderColor: notificationRequest.status?.toLowerCase() === 'approved'
                    ? colors.success[400]
                    : colors.error[400],
                },
              ]}
            >
              <Ionicons
                name={notificationRequest.status?.toLowerCase() === 'approved' ? 'checkmark-circle' : 'close-circle'}
                size={20}
                color={notificationRequest.status?.toLowerCase() === 'approved' ? colors.success[500] : colors.error[500]}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.notifTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
                  Request {notificationRequest.status}
                </Text>
                {notificationRequest.notes ? (
                  <Text style={[styles.notifBody, { color: isDark ? colors.neutral[400] : colors.neutral[600] }]}>
                    {notificationRequest.notes}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity onPress={handleDismissNotification} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Ionicons name="close" size={18} color={isDark ? colors.neutral[400] : colors.neutral[500]} />
              </TouchableOpacity>
            </View>
          )}
          {loadingStatus && !refreshing ? (
            <View style={styles.centeredLoader}>
              <ActivityIndicator size="large" color={colors.primary[500]} />
              <Text style={[styles.loadingText, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
                Loading requests...
              </Text>
            </View>
          ) : requests.length === 0 ? (
            <View style={[styles.emptyState, styles.emptyStateCenter, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
              <Ionicons name="clipboard" size={36} color={isDark ? colors.neutral[400] : colors.neutral[500]} style={styles.emptyIcon} />
              <Text style={[styles.emptyTitle, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]}>
                No Requests Yet
              </Text>
              <Text style={[styles.emptyText, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
                You haven't made any medicine requests.
              </Text>
              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: 16 }]}
                onPress={() => setView('form')}
              >
                <Text style={styles.primaryButtonText}>Create Request</Text>
              </TouchableOpacity>
            </View>
          ) : (
            requests.map((req) => {
              const sc = statusColors[req.status] || statusColors.Pending;
              return (
                <View key={req.id} style={[styles.card, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
                  <View style={styles.statusHeader}>
                    <Text style={[styles.cardTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900], fontSize: 16 }]}>
                      Request #{req.id}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                      <Text style={{ color: sc.text, fontWeight: '600', fontSize: 12 }}>
                        {req.status}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>Purpose</Text>
                    <Text style={[styles.detailValue, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>{req.purpose}</Text>
                  </View>
                  {req.notes && (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>Staff Notes</Text>
                      <Text style={[styles.detailValue, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>{req.notes}</Text>
                    </View>
                  )}
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>Date</Text>
                    <Text style={[styles.detailValue, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
                      {new Date(req.created_at).toLocaleDateString()}
                    </Text>
                  </View>

                  {req.items?.length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={[styles.detailLabel, { color: isDark ? colors.neutral[400] : colors.neutral[500], marginBottom: 6 }]}>
                        Items ({req.items.length})
                      </Text>
                      {req.items.map((item, i) => (
                        <View key={item.id || i} style={[styles.statusMedItem, { borderColor: isDark ? colors.neutral[700] : colors.neutral[200] }]}>
                          <Text style={[styles.medDosage, { color: isDark ? colors.neutral[300] : colors.neutral[600] }]}>
                            {item.itemName || `Medicine #${item.medicineId}`} × {item.quantity}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {isPendingStatus(req.status) && (
                    <TouchableOpacity
                      style={[styles.cancelButton, { opacity: cancelling ? 0.5 : 1 }]}
                      onPress={handleCancel}
                      disabled={cancelling}
                      activeOpacity={0.7}
                    >
                      {cancelling && <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />}
                      <Text style={styles.cancelButtonText}>
                        {cancelling ? 'Cancelling...' : 'Cancel Request'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  topMenuRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    marginBottom: 10,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerSection: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },

  // Tab bar
  tabBarWrap: {
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  tabBar: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 16,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  tabInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabText: { fontWeight: '600', fontSize: 14 },
  tabCountBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tabCountText: { fontSize: 11, fontWeight: '700' },

  // Header
  headerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    gap: 14,
  },
  headerIcon: { marginTop: 1 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  pendingSummaryCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 10,
    marginBottom: 14,
  },
  pendingSummaryIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  pendingSummaryBody: { flex: 1 },
  pendingSummaryTitle: { fontSize: 13, fontWeight: '700' },
  pendingSummaryMeta: { fontSize: 12, marginTop: 3 },
  pendingSummaryHint: { fontSize: 12, marginTop: 4 },
  pendingSummaryAction: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pendingSummaryActionText: { fontSize: 12, fontWeight: '700' },

  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },

  card: { borderRadius: 16, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: '600' },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },

  label: { fontSize: 15, fontWeight: '600', marginBottom: 10 },

  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Branch
  branchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  branchChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  branchText: { fontWeight: '500', fontSize: 13 },

  // Medicine list
  medItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 10,
    gap: 12,
  },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkboxFill: { width: 12, height: 12, borderRadius: 3 },
  medName: { fontSize: 14, fontWeight: '500' },
  medDosage: { fontSize: 12, marginTop: 2 },

  // Selected badge
  selectedBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  countBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#FFFFFF', fontWeight: '600', fontSize: 12 },

  // Submit
  submitButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitButtonText: { color: colors.secondary[900], fontWeight: '600', fontSize: 16 },

  // Status
  statusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  detailRow: { marginBottom: 12 },
  detailLabel: { fontSize: 12, marginBottom: 2 },
  detailValue: { fontSize: 15, fontWeight: '500' },
  statusMedItem: { padding: 12, borderWidth: 1, borderRadius: 10, marginBottom: 8 },

  // Loading / Empty
  centeredLoader: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  loadingText: { marginTop: 12, fontSize: 14 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20 },
  emptyState: { padding: 32, borderRadius: 12, alignItems: 'center' },
  emptyStateCenter: { marginTop: 40 },
  emptyIcon: { marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  primaryButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  primaryButtonText: { color: colors.secondary[900], fontWeight: '600', fontSize: 15 },
  cancelButton: {
    backgroundColor: colors.error[500],
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
  cancelButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },

  // Cancel-and-resubmit modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    gap: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalBody: { fontSize: 14, lineHeight: 22 },
  modalActions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  modalBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },

  // Notification banner
  notifBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  notifTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  notifBody: { fontSize: 13 },
});

export default MedicineRequestScreen;
