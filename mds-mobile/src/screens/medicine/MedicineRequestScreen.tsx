/**
 * Medicine Request Screen
 * Mirrors mds-patient medicine-request module
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
import {
  listMedicines,
  submitMedicineRequest,
  getMedicineRequestStatus,
} from '../../services/medicine-service';

interface Medicine {
  id: string;
  name: string;
  dosage: string;
  unit: string;
  quantity: number;
}

interface SelectedMedicine {
  medicineId: string;
  name: string;
  dosage: string;
  quantity: number;
}

const BRANCHES = ['Main Campus', 'QC Campus', 'Manila Campus'];

const statusColors: Record<string, { bg: string; text: string }> = {
  Pending: { bg: colors.primary[100], text: colors.primary[800] },
  Approved: { bg: colors.success[100], text: colors.success[600] },
  Rejected: { bg: colors.error[100], text: colors.error[600] },
  Completed: { bg: colors.success[100], text: colors.success[600] },
};

export const MedicineRequestScreen: React.FC = () => {
  const { isDark } = useTheme();

  // Views
  const [view, setView] = useState<'form' | 'status'>('form');

  // Form state
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [branch, setBranch] = useState('');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [selected, setSelected] = useState<SelectedMedicine[]>([]);
  const [loadingMeds, setLoadingMeds] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Status state
  const [statusData, setStatusData] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Load medicines when branch changes
  useEffect(() => {
    if (!branch) {
      setMedicines([]);
      return;
    }
    const load = async () => {
      setLoadingMeds(true);
      setError(null);
      try {
        const meds = await listMedicines(branch);
        setMedicines(meds || []);
      } catch (err: any) {
        setError('Failed to load medicines: ' + err.message);
      } finally {
        setLoadingMeds(false);
      }
    };
    load();
  }, [branch]);

  // Load request status
  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const data = await getMedicineRequestStatus();
      setStatusData(data);
    } catch {
      setStatusData(null);
    } finally {
      setLoadingStatus(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'status') loadStatus();
  }, [view, loadStatus]);

  // Toggle medicine selection
  const toggleMedicine = (med: Medicine) => {
    setSelected((prev) => {
      const exists = prev.find((s) => s.medicineId === med.id);
      if (exists) return prev.filter((s) => s.medicineId !== med.id);
      return [...prev, { medicineId: med.id, name: med.name, dosage: med.dosage, quantity: 1 }];
    });
  };

  const updateQuantity = (medicineId: string, qty: number) => {
    if (qty < 1) return;
    setSelected((prev) =>
      prev.map((s) => (s.medicineId === medicineId ? { ...s, quantity: qty } : s))
    );
  };

  // Submit
  const handleSubmit = async () => {
    setError(null);
    if (!chiefComplaint.trim()) { setError('Please enter your chief complaint.'); return; }
    if (!branch) { setError('Please select a branch.'); return; }
    if (selected.length === 0) { setError('Please select at least one medicine.'); return; }

    setSubmitting(true);
    try {
      await submitMedicineRequest(
        chiefComplaint.trim(),
        branch,
        selected.map((s) => ({ medicineId: s.medicineId, quantity: s.quantity }))
      );
      setSuccess('Medicine request submitted successfully!');
      setChiefComplaint('');
      setBranch('');
      setSelected([]);
      setMedicines([]);
    } catch (err: any) {
      setError(err.message || 'Failed to submit request.');
    } finally {
      setSubmitting(false);
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
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
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

          {/* Chief Complaint */}
          <View style={[styles.card, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
            <Text style={[styles.label, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]}>
              Chief Complaint <Text style={{ color: colors.error[500] }}>*</Text>
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
              value={chiefComplaint}
              onChangeText={setChiefComplaint}
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
                  key={b}
                  style={[
                    styles.branchChip,
                    {
                      backgroundColor: branch === b
                        ? (isDark ? 'rgba(241,197,38,0.15)' : colors.primary[50])
                        : (isDark ? colors.neutral[700] : colors.neutral[100]),
                      borderColor: branch === b ? colors.primary[500] : (isDark ? colors.neutral[600] : colors.neutral[200]),
                    },
                  ]}
                  onPress={() => setBranch(b)}
                >
                  <Text
                    style={[
                      styles.branchText,
                      {
                        color: branch === b
                          ? (isDark ? colors.primary[300] : colors.primary[700])
                          : (isDark ? colors.neutral[300] : colors.neutral[600]),
                      },
                    ]}
                  >
                    {b}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Medicines */}
          {branch !== '' && (
            <View style={[styles.card, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.label, { color: isDark ? colors.neutral[200] : colors.secondary[900], marginBottom: 0 }]}>
                  Select Medicines <Text style={{ color: colors.error[500] }}>*</Text>
                </Text>
                {selected.length > 0 && (
                  <View style={[styles.countBadge, { backgroundColor: colors.primary[500] }]}>
                    <Text style={styles.countText}>{selected.length}</Text>
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
              ) : medicines.length === 0 ? (
                <View style={[styles.emptyState, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50] }]}>
                  <Text style={styles.emptyIcon}>💊</Text>
                  <Text style={[styles.emptyText, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
                    No medicines available for this branch.
                  </Text>
                </View>
              ) : (
                medicines.map((med) => {
                  const isSelected = selected.some((s) => s.medicineId === med.id);
                  const sel = selected.find((s) => s.medicineId === med.id);
                  return (
                    <TouchableOpacity
                      key={med.id}
                      style={[
                        styles.medItem,
                        {
                          borderColor: isSelected ? colors.primary[500] : (isDark ? colors.neutral[600] : colors.neutral[200]),
                          backgroundColor: isSelected
                            ? (isDark ? 'rgba(241,197,38,0.08)' : colors.primary[50])
                            : 'transparent',
                        },
                      ]}
                      onPress={() => toggleMedicine(med)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.checkbox, { borderColor: isSelected ? colors.primary[500] : (isDark ? colors.neutral[500] : colors.neutral[300]) }]}>
                        {isSelected && <View style={[styles.checkboxFill, { backgroundColor: colors.primary[500] }]} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.medName, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
                          {med.name}
                        </Text>
                        <Text style={[styles.medDosage, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
                          {med.dosage} · {med.unit} · {med.quantity} available
                        </Text>
                      </View>
                      {isSelected && sel && (
                        <View style={styles.qtyControl}>
                          <TouchableOpacity
                            style={[styles.qtyBtn, { backgroundColor: isDark ? colors.neutral[600] : colors.neutral[200] }]}
                            onPress={() => updateQuantity(med.id, sel.quantity - 1)}
                          >
                            <Text style={[styles.qtyBtnText, { color: isDark ? colors.neutral[200] : colors.neutral[700] }]}>−</Text>
                          </TouchableOpacity>
                          <Text style={[styles.qtyValue, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>{sel.quantity}</Text>
                          <TouchableOpacity
                            style={[styles.qtyBtn, { backgroundColor: isDark ? colors.neutral[600] : colors.neutral[200] }]}
                            onPress={() => updateQuantity(med.id, sel.quantity + 1)}
                          >
                            <Text style={[styles.qtyBtnText, { color: isDark ? colors.neutral[200] : colors.neutral[700] }]}>+</Text>
                          </TouchableOpacity>
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadStatus(); }} />}
        >
          {loadingStatus ? (
            <View style={styles.centeredLoader}>
              <ActivityIndicator size="large" color={colors.primary[500]} />
              <Text style={[styles.loadingText, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
                Loading status...
              </Text>
            </View>
          ) : !statusData ? (
            <View style={[styles.emptyState, styles.emptyStateCenter, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={[styles.emptyTitle, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]}>
                No Active Request
              </Text>
              <Text style={[styles.emptyText, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
                You don't have any pending medicine requests.
              </Text>
              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: 16 }]}
                onPress={() => setView('form')}
              >
                <Text style={styles.primaryButtonText}>Create Request</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
              <View style={styles.statusHeader}>
                <Text style={[styles.cardTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
                  Request Details
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: (statusColors[statusData.status] || statusColors.Pending).bg }]}>
                  <Text style={{ color: (statusColors[statusData.status] || statusColors.Pending).text, fontWeight: '600', fontSize: 12 }}>
                    {statusData.status}
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>Chief Complaint</Text>
                <Text style={[styles.detailValue, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>{statusData.chiefComplaint}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>Branch</Text>
                <Text style={[styles.detailValue, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>{statusData.branch}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>Date</Text>
                <Text style={[styles.detailValue, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
                  {new Date(statusData.created_at).toLocaleDateString()}
                </Text>
              </View>

              {statusData.medicines?.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <Text style={[styles.label, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]}>Medicines</Text>
                  {statusData.medicines.map((med: any, i: number) => (
                    <View key={i} style={[styles.statusMedItem, { borderColor: isDark ? colors.neutral[700] : colors.neutral[200] }]}>
                      <Text style={[styles.medName, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>{med.name}</Text>
                      <Text style={[styles.medDosage, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
                        {med.dosage} × {med.quantity}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
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

  // Quantity
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 16, fontWeight: '600' },
  qtyValue: { fontSize: 14, fontWeight: '600', minWidth: 20, textAlign: 'center' },

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
});

export default MedicineRequestScreen;
