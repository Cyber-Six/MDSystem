/**
 * Dental History Step — Step 3: Dental visits, oral appliances, procedures, photos
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Image, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../../context/ThemeContext';
import { axiosRequest, getApiBaseUrl } from '../../../core';
import type { FormData, AllCatalogs } from '../../../services/emr-service';

interface Props {
  formData: FormData;
  onUpdate: (data: Partial<FormData['dentalHistory']>) => void;
  isDark: boolean;
  catalogs: AllCatalogs;
}

const CLEANING_RANGES = ['0 to 6 months ago', '7 to 11 months ago', '1 year or more'];

export const DentalHistoryStep: React.FC<Props> = ({ formData, onUpdate, isDark, catalogs }) => {
  const dh = formData.dentalHistory;

  // Fetch preview URIs for revision-prefilled photos (have id but no uri)
  const [revisionPreviews, setRevisionPreviews] = useState<{ upper?: string; lower?: string }>({});
  const [loadingPreviews, setLoadingPreviews] = useState<{ upper: boolean; lower: boolean }>({ upper: false, lower: false });

  useEffect(() => {
    const fetchPreview = async (fileId: string, key: 'upper' | 'lower') => {
      setLoadingPreviews(prev => ({ ...prev, [key]: true }));
      try {
        const url = `${getApiBaseUrl()}/media/record/dentalPhoto/${fileId}`;
        const response = await axiosRequest.get(url, { responseType: 'arraybuffer' });
        const bytes = new Uint8Array(response.data as ArrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        const base64 = btoa(binary);
        const contentType = (response.headers as Record<string, string>)['content-type'] || 'image/jpeg';
        setRevisionPreviews(prev => ({ ...prev, [key]: `data:${contentType};base64,${base64}` }));
      } catch {
        // Preview failed — user can still re-upload; the id is preserved for submission
      } finally {
        setLoadingPreviews(prev => ({ ...prev, [key]: false }));
      }
    };

    if (dh.upperTeethPhoto?.id && !dh.upperTeethPhoto.uri) fetchPreview(dh.upperTeethPhoto.id, 'upper');
    if (dh.lowerTeethPhoto?.id && !dh.lowerTeethPhoto.uri) fetchPreview(dh.lowerTeethPhoto.id, 'lower');
  }, [dh.upperTeethPhoto?.id, dh.lowerTeethPhoto?.id]);

  // Resolve the display URI: prefer local uri (new pick), fall back to revision preview
  const upperDisplayUri = dh.upperTeethPhoto?.uri || revisionPreviews.upper || null;
  const lowerDisplayUri = dh.lowerTeethPhoto?.uri || revisionPreviews.lower || null;
  const hasUpperPhoto = !!upperDisplayUri || !!dh.upperTeethPhoto?.id;
  const hasLowerPhoto = !!lowerDisplayUri || !!dh.lowerTeethPhoto?.id;

  const inputStyle = [styles.input, {
    backgroundColor: isDark ? colors.neutral[700] : '#FFF',
    color: isDark ? colors.neutral[100] : colors.neutral[900],
    borderColor: isDark ? colors.neutral[600] : colors.neutral[200],
  }];

  const renderYesNo = (label: string, value: string, onSelect: (v: string) => void) => (
    <View style={styles.yesNoContainer}>
      <Text style={[styles.yesNoLabel, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]}>{label}</Text>
      <View style={styles.yesNoBtns}>
        {['yes', 'no'].map(v => (
          <TouchableOpacity
            key={v}
            style={[
              styles.yesNoBtn,
              value === v && styles.yesNoBtnSelected,
              { backgroundColor: value === v ? colors.primary[500] : isDark ? colors.neutral[700] : colors.neutral[100] },
            ]}
            onPress={() => onSelect(v)}
            activeOpacity={0.7}
          >
            <Text style={{
              color: value === v ? '#FFF' : isDark ? colors.neutral[300] : colors.neutral[600],
              fontWeight: '600',
              fontSize: 13,
              textTransform: 'capitalize',
            }}>{v}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const handleApplianceToggle = (id: string) => {
    const current = dh.intraOralAppliances[id];
    const isChecked = typeof current === 'object' ? (current as any)?.checked : !!current;
    const arch = typeof current === 'object' ? ((current as any)?.arch || '') : '';
    onUpdate({
      intraOralAppliances: {
        ...dh.intraOralAppliances,
        [id]: { checked: !isChecked, arch },
      },
    });
  };

  const handleApplianceArch = (id: string, arch: string) => {
    const current = dh.intraOralAppliances[id];
    const isChecked = typeof current === 'object' ? !!(current as any)?.checked : !!current;
    onUpdate({
      intraOralAppliances: {
        ...dh.intraOralAppliances,
        [id]: { checked: isChecked, arch },
      },
    });
  };

  const handleProcedureToggle = (id: string) => {
    onUpdate({
      selectedDentalProcedures: {
        ...dh.selectedDentalProcedures,
        [id]: !dh.selectedDentalProcedures[id],
      },
    });
  };

  const pickImage = async (field: 'upperTeethPhoto' | 'lowerTeethPhoto') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera roll access is required to upload dental photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop() || 'jpg';
      onUpdate({
        [field]: { uri: asset.uri, name: `${field}.${ext}`, type: `image/${ext}` },
      });
    }
  };

  const renderPhotoSection = (
    label: string,
    field: 'upperTeethPhoto' | 'lowerTeethPhoto',
    displayUri: string | null,
    hasPhoto: boolean,
    isLoading: boolean,
  ) => (
    <View style={styles.photoSection}>
      <Text style={[styles.label, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]}>{label}</Text>
      {isLoading ? (
        <View style={[styles.uploadBtn, { borderColor: isDark ? colors.neutral[600] : colors.neutral[300] }]}>
          <ActivityIndicator color={colors.primary[500]} />
          <Text style={{ color: isDark ? colors.neutral[400] : colors.neutral[500], marginTop: 6, fontSize: 12 }}>Loading photo...</Text>
        </View>
      ) : displayUri ? (
        <View style={styles.photoPreview}>
          <Image source={{ uri: displayUri }} style={styles.photoImage} resizeMode="cover" />
          <TouchableOpacity style={styles.changeBtn} onPress={() => pickImage(field)} activeOpacity={0.7}>
            <Text style={styles.changeBtnText}>Change Photo</Text>
          </TouchableOpacity>
        </View>
      ) : hasPhoto ? (
        <View style={[styles.uploadBtn, { borderColor: isDark ? colors.neutral[600] : colors.neutral[300] }]}>
          <Text style={{ color: colors.primary[500], fontWeight: '600', fontSize: 13 }}>Photo from previous submission</Text>
          <TouchableOpacity style={{ marginTop: 8 }} onPress={() => pickImage(field)}>
            <Text style={{ color: colors.primary[500], textDecorationLine: 'underline', fontSize: 13 }}>Replace</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.uploadBtn, { borderColor: isDark ? colors.neutral[600] : colors.neutral[300] }]}
          onPress={() => pickImage(field)}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 24, marginBottom: 4 }}>📷</Text>
          <Text style={{ color: colors.primary[500], fontWeight: '600', fontSize: 14 }}>Upload Photo</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>Dental History</Text>

      {/* First time dentist */}
      <View style={[styles.card, { backgroundColor: isDark ? colors.neutral[800] : '#FFF', borderColor: isDark ? colors.neutral[700] : colors.neutral[200] }]}>
        <Text style={[styles.sectionTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>Dental Visit History</Text>
        {renderYesNo('Is this your first time to be seen by a dentist?', dh.firstTimeDentist, v => onUpdate({ firstTimeDentist: v }))}

        {dh.firstTimeDentist === 'no' && (
          <View style={{ marginTop: 12 }}>
            <Text style={[styles.label, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]}>Last Dental Consultation</Text>
            <TextInput style={inputStyle} value={dh.lastDentalConsultation} onChangeText={v => onUpdate({ lastDentalConsultation: v })}
              placeholder="YYYY-MM" placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} />
          </View>
        )}

        <Text style={[styles.label, { color: isDark ? colors.neutral[200] : colors.secondary[900], marginTop: 16 }]}>
          When was your last dental cleaning?
        </Text>
        {CLEANING_RANGES.map(r => (
          <TouchableOpacity key={r} style={styles.radioRow} onPress={() => onUpdate({ lastDentalCleaning: r })} activeOpacity={0.7}>
            <View style={[styles.radio, dh.lastDentalCleaning === r && styles.radioSelected]}>
              {dh.lastDentalCleaning === r && <View style={styles.radioDot} />}
            </View>
            <Text style={{ color: isDark ? colors.neutral[200] : colors.neutral[800], fontSize: 14, flex: 1 }}>{r}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Intra-Oral Appliances */}
      <View style={[styles.card, { backgroundColor: isDark ? colors.neutral[800] : '#FFF', borderColor: isDark ? colors.neutral[700] : colors.neutral[200] }]}>
        <Text style={[styles.sectionTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>Intra-Oral Appliances</Text>
        {renderYesNo('Are you wearing any intra-oral appliance?', dh.hasIntraOralAppliance, v => onUpdate({ hasIntraOralAppliance: v }))}

        {dh.hasIntraOralAppliance === 'yes' && (
          <View style={{ marginTop: 12 }}>
            {catalogs.oralApplianceCatalog.map(app => {
              const val = dh.intraOralAppliances[app.id];
              const isChecked = typeof val === 'object' ? !!(val as any)?.checked : !!val;
              const arch = typeof val === 'object' ? ((val as any)?.arch || '') : '';
              return (
                <View key={app.id}>
                  <TouchableOpacity style={styles.checkRow} onPress={() => handleApplianceToggle(app.id)} activeOpacity={0.7}>
                    <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                      {isChecked && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={{ color: isDark ? colors.neutral[100] : colors.neutral[800], fontSize: 14, flex: 1 }}>{app.name}</Text>
                  </TouchableOpacity>
                  {isChecked && (
                    <View style={styles.archRow}>
                      {['Upper', 'Lower', 'Both'].map(loc => (
                        <TouchableOpacity
                          key={loc}
                          style={[
                            styles.archBtn,
                            { backgroundColor: arch === loc ? colors.primary[500] : isDark ? colors.neutral[700] : colors.neutral[100] },
                          ]}
                          onPress={() => handleApplianceArch(app.id, loc)}
                          activeOpacity={0.7}
                        >
                          <Text style={{ color: arch === loc ? '#FFF' : isDark ? colors.neutral[400] : colors.neutral[600], fontSize: 12, fontWeight: '600' }}>{loc}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
            <TextInput style={[...inputStyle, { marginTop: 8 }]} value={dh.applianceOther || ''} onChangeText={v => onUpdate({ applianceOther: v })}
              placeholder="Other appliance..." placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} />
          </View>
        )}
      </View>

      {/* Dental Procedures */}
      <View style={[styles.card, { backgroundColor: isDark ? colors.neutral[800] : '#FFF', borderColor: isDark ? colors.neutral[700] : colors.neutral[200] }]}>
        <Text style={[styles.sectionTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>Dental Procedures</Text>
        <Text style={[styles.sublabel, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
          Which procedures have you had in the past 24 months?
        </Text>
        {catalogs.dentalProcedureCatalog.map(proc => (
          <TouchableOpacity key={proc.id} style={styles.checkRow} onPress={() => handleProcedureToggle(proc.id)} activeOpacity={0.7}>
            <View style={[styles.checkbox, dh.selectedDentalProcedures[proc.id] && styles.checkboxChecked]}>
              {dh.selectedDentalProcedures[proc.id] && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={{ color: isDark ? colors.neutral[100] : colors.neutral[800], fontSize: 14, flex: 1 }}>{proc.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Dental Photos */}
      <View style={[styles.card, { backgroundColor: isDark ? colors.neutral[800] : '#FFF', borderColor: isDark ? colors.neutral[700] : colors.neutral[200] }]}>
        <Text style={[styles.sectionTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>Dental Photos</Text>
        {renderPhotoSection('Upper Teeth Photo *', 'upperTeethPhoto', upperDisplayUri, hasUpperPhoto, loadingPreviews.upper)}
        {renderPhotoSection('Lower Teeth Photo *', 'lowerTeethPhoto', lowerDisplayUri, hasLowerPhoto, loadingPreviews.lower)}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 17, fontWeight: '700', marginBottom: 16 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '600', marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 6 },
  sublabel: { fontSize: 13, marginBottom: 10, lineHeight: 18 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  yesNoContainer: { marginBottom: 10 },
  yesNoLabel: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  yesNoBtns: { flexDirection: 'row', gap: 8 },
  yesNoBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  yesNoBtnSelected: {},
  radioRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingLeft: 4, gap: 10 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.neutral[400], alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.primary[500] },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary[500] },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.neutral[400], alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
  checkmark: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  archRow: { flexDirection: 'row', gap: 8, marginLeft: 32, marginBottom: 8 },
  archBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  photoSection: { marginBottom: 16 },
  photoPreview: { marginTop: 8 },
  photoImage: { width: '100%', height: 180, borderRadius: 12 },
  changeBtn: { marginTop: 8, alignSelf: 'flex-start' },
  changeBtnText: { color: colors.primary[500], fontWeight: '600', fontSize: 13 },
  uploadBtn: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 80,
  },
});

export default DentalHistoryStep;
