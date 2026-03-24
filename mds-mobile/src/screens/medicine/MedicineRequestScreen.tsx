/**
 * Medicine Request Screen
 * Mirrors mds-patient medicine-request module
 * 
 * Uses backend queries: getAvailableMedicine, getMedicineStatus, createMedicineRequest
 * Branches: Casal, Arlegui, Quezon City (LocationDesignation enum)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, colors } from '../../context/ThemeContext';
import { useBanner } from '../../context/BannerContext';
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

export const MedicineRequestScreen: React.FC = () => {
  const { isDark } = useTheme();
  const { showBanner } = useBanner();

  // Views
  const [view, setView] = useState<'form' | 'status'>('form');

  // Form state
  const [purpose, setPurpose] = useState('');
  const [location, setLocation] = useState<LocationDesignation | ''>('');
  const [medicines, setMedicines] = useState<AvailableMedicine[]>([]);
  const [grouped, setGrouped] = useState<GroupedMedicine[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [loadingMeds, setLoadingMeds] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Status state
  const [requests, setRequests] = useState<MedicineRequest[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Load status on mount so we can check pending before submit
  useEffect(() => {
    getMedicineStatus()
      .then(setRequests)
      .catch(() => {});
  }, []);

  // Load medicines when location changes
  useEffect(() => {
    if (!location) {
      setMedicines([]);
      setGrouped([]);
      return;
    }
    const load = async () => {
      setLoadingMeds(true);
      setError(null);
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
        setError('Failed to load medicines: ' + err.message);
      } finally {
        setLoadingMeds(false);
      }
    };
    load();
  }, [location]);

  // Load request history
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

  useEffect(() => {
    if (view === 'status') loadHistory();
  }, [view, loadHistory]);

  // Toggle medicine by item_code
  const toggleMedicine = (code: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        if (next.size >= 2) {
          setError('You can select a maximum of 2 medicines per request.');
          return prev;
        }
        next.add(code);
      }
      return next;
    });
  };

  // Submit
  const handleSubmit = async () => {
    setError(null);
    if (!purpose.trim()) { setError('Please enter the purpose of your request.'); return; }
    if (!location) { setError('Please select a branch.'); return; }
    if (selectedCodes.size === 0) { setError('Please select at least one medicine.'); return; }

    // Build items from first batch of each selected code (like the web app)
    const items: Array<{ batchId: number; quantity: number }> = [];
    for (const code of selectedCodes) {
      const group = grouped.find((g) => g.item_code === code);
      if (!group || group.batches.length === 0) {
        setError(`No available batch for ${group?.item_name || code}`);
        return;
      }
      items.push({ batchId: parseInt(group.batches[0].id, 10), quantity: 1 });
    }

    // Check for pending request
    const hasPending = requests.some((r) => r.status?.toLowerCase() === 'pending');
    if (hasPending) {
      setError('You already have a pending request. Please cancel it first or wait for it to be processed.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createMedicineRequest(purpose.trim(), location, items);
      setRequests((prev) => [result, ...prev]);
      showBanner({ type: 'success', message: 'Medicine request submitted successfully!' });
      setPurpose('');
      setLocation('');
      setSelectedCodes(new Set());
      setMedicines([]);
      setGrouped([]);
    } catch (err: any) {
      setError(err.message || 'Failed to submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancelMedicineRequest();
      showBanner({ type: 'success', message: 'Medicine request cancelled.' });
      await loadHistory();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel request.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] }]}
      edges={['top']}
    >
      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF', borderBottomColor: isDark ? colors.neutral[700] : colors.neutral[200] }]}>
        <TouchableOpacity
          style={[styles.tab, view === 'form' && styles.activeTab, view === 'form' && { borderBottomColor: colors.primary[500] }]}
          onPress={() => setView('form')}
        >
          <Text style={[styles.tabText, { color: view === 'form' ? (isDark ? colors.primary[300] : colors.primary[700]) : (isDark ? colors.neutral[500] : colors.neutral[400]) }]}>
            New Request
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, view === 'status' && styles.activeTab, view === 'status' && { borderBottomColor: colors.primary[500] }]}
          onPress={() => setView('status')}
        >
          <Text style={[styles.tabText, { color: view === 'status' ? (isDark ? colors.primary[300] : colors.primary[700]) : (isDark ? colors.neutral[500] : colors.neutral[400]) }]}>
            Request Status
          </Text>
        </TouchableOpacity>
      </View>

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
                    const meds = await getAvailableMedicine(location);
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
          {/* Header */}
          <View style={[styles.headerBanner, { backgroundColor: colors.success[500] }]}>
            <Text style={styles.headerIcon}>💊</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Medicine Request</Text>
              <Text style={styles.headerSubtitle}>Request medicines from the clinic</Text>
            </View>
          </View>

          {/* Error / Success */}
          {error && (
            <View style={[styles.alertBox, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : colors.error[50], borderColor: colors.error[400] }]}>
              <Text style={{ color: colors.error[500], flex: 1 }}>{error}</Text>
              <TouchableOpacity onPress={() => setError(null)}>
                <Text style={{ color: colors.error[500], fontWeight: 'bold', fontSize: 18 }}>×</Text>
              </TouchableOpacity>
            </View>
          )}
          {success && (
            <View style={[styles.alertBox, { backgroundColor: isDark ? 'rgba(34,197,94,0.15)' : colors.success[50], borderColor: colors.success[400] }]}>
              <Text style={{ color: colors.success[500], flex: 1 }}>{success}</Text>
              <TouchableOpacity onPress={() => setSuccess(null)}>
                <Text style={{ color: colors.success[500], fontWeight: 'bold', fontSize: 18 }}>×</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Purpose (Chief Complaint) */}
          <View style={[styles.card, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
            <Text style={[styles.label, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]}>
              Purpose <Text style={{ color: colors.error[500] }}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50],
                  color: isDark ? colors.neutral[100] : colors.neutral[900],
                  borderColor: isDark ? colors.neutral[600] : colors.neutral[200],
                },
              ]}
              placeholder="Describe your symptoms or reason for request..."
              placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]}
              value={purpose}
              onChangeText={setPurpose}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Branch Selection */}
          <View style={[styles.card, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
            <Text style={[styles.label, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]}>
              Branch <Text style={{ color: colors.error[500] }}>*</Text>
            </Text>
            <View style={styles.branchRow}>
              {BRANCHES.map((b) => (
                <TouchableOpacity
                  key={b.value}
                  style={[
                    styles.branchChip,
                    {
                      backgroundColor: location === b.value
                        ? (isDark ? 'rgba(241,197,38,0.15)' : colors.primary[50])
                        : (isDark ? colors.neutral[700] : colors.neutral[100]),
                      borderColor: location === b.value ? colors.primary[500] : (isDark ? colors.neutral[600] : colors.neutral[200]),
                    },
                  ]}
                  onPress={() => setLocation(b.value)}
                >
                  <Text
                    style={[
                      styles.branchText,
                      {
                        color: location === b.value
                          ? (isDark ? colors.primary[300] : colors.primary[700])
                          : (isDark ? colors.neutral[300] : colors.neutral[600]),
                      },
                    ]}
                  >
                    {b.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
                  <Text style={styles.emptyIcon}>💊</Text>
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
                          <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '600' }}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitButton, { opacity: submitting ? 0.5 : 1 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting && <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />}
            <Text style={styles.submitButtonText}>{submitting ? 'Submitting...' : 'Submit Request'}</Text>
          </TouchableOpacity>
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
          {loadingStatus && !refreshing ? (
            <View style={styles.centeredLoader}>
              <ActivityIndicator size="large" color={colors.primary[500]} />
              <Text style={[styles.loadingText, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
                Loading requests...
              </Text>
            </View>
          ) : requests.length === 0 ? (
            <View style={[styles.emptyState, styles.emptyStateCenter, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
              <Text style={styles.emptyIcon}>📋</Text>
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

                  {req.status === 'Pending' && (
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

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {},
  tabText: { fontWeight: '600', fontSize: 14 },

  // Header
  headerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    gap: 14,
  },
  headerIcon: { fontSize: 28 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

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
  submitButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 },

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
  emptyIcon: { fontSize: 36, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  primaryButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
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
});

export default MedicineRequestScreen;
