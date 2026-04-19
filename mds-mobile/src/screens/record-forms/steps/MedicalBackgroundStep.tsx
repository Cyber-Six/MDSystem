/**
 * Medical Background Step — Step 2: Immunizations, Allergies, Hospitalizations,
 * Operations, Medications, Lifestyle, Visual Acuity
 * Aligned with mds-patient update record medical-history-step.jsx
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Switch, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../context/ThemeContext';
import { DatePickerInput } from '../../../components/ui/DatePickerInput';
import { CatalogSearchField } from '../../../components/ui/CatalogSearchField';
import { useCatalogSearch } from '../../../hooks/useCatalogSearch';
import {
  searchImmunizationCatalog, createImmunizationCatalog,
  searchAllergenCatalogByName, createAllergenCatalogEntry,
  searchDomainCatalog, createDomainCatalog,
} from '../../../services/emr-service';
import type { FormData, AllCatalogs } from '../../../services/emr-service';

interface Props {
  formData: FormData;
  onUpdateBg: (data: Partial<FormData['medicalBackground']>) => void;
  isDark: boolean;
  catalogs: AllCatalogs;
}

type SectionKey = 'immunizations' | 'allergies' | 'hospitalizations' | 'operations' | 'medications' | 'lifestyle' | 'visualAcuity';

const FREQUENCY_OPTIONS = ['Daily', 'Weekly', 'Monthly', 'Occasional', 'Rare'];
const VAPE_TYPE_OPTIONS = ['Nicotine', 'CBD', 'THC', 'Flavored'];
const SEVERITY_OPTIONS = ['Mild', 'Moderate', 'Severe'];
const STATUS_OPTIONS = ['Active', 'Resolved', 'Suspected'];

const AccordionSection: React.FC<{
  title: string; isOpen: boolean; onToggle: () => void; isDark: boolean; children: React.ReactNode;
}> = ({ title, isOpen, onToggle, isDark, children }) => (
  <View style={[styles.accordion, { borderColor: isDark ? colors.neutral[700] : colors.neutral[200] }]}>
    <TouchableOpacity style={styles.accordionHeader} onPress={onToggle} activeOpacity={0.7}>
      <Text style={[styles.accordionTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>{title}</Text>
      <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={isDark ? colors.neutral[400] : colors.neutral[500]} />
    </TouchableOpacity>
    {isOpen && <View style={styles.accordionBody}>{children}</View>}
  </View>
);

export const MedicalBackgroundStep: React.FC<Props> = ({ formData, onUpdateBg, isDark, catalogs }) => {
  const bg = formData.medicalBackground;
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    immunizations: true, allergies: false, hospitalizations: false,
    operations: false, medications: false, lifestyle: false, visualAcuity: false,
  });

  const toggleSection = (key: SectionKey) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  const inputStyle = [styles.input, {
    backgroundColor: isDark ? colors.neutral[700] : '#FFF',
    color: isDark ? colors.neutral[100] : colors.neutral[900],
    borderColor: isDark ? colors.neutral[600] : colors.neutral[200],
  }];

  // "Others" search/create hooks for each catalog
  const immunizationOthers = useCatalogSearch({
    catalog: catalogs.immunizationCatalog,
    searchFn: searchImmunizationCatalog,
    createFn: (name: string) => createImmunizationCatalog(name),
    nameKey: 'name',
  });
  const allergenOthers = useCatalogSearch({
    catalog: catalogs.allergenCatalog,
    searchFn: searchAllergenCatalogByName,
    createFn: (name: string) => createAllergenCatalogEntry(name, allergenTypeForCreate),
    nameKey: 'allergen',
  });
  const [allergenTypeForCreate, setAllergenTypeForCreate] = useState('Other');
  const hospitalizationOthers = useCatalogSearch({
    catalog: catalogs.hospitalizationCatalog,
    searchFn: (q: string) => searchDomainCatalog('Hospitalization', q),
    createFn: (name: string) => createDomainCatalog('Hospitalization', name),
    nameKey: 'name',
  });
  const operationOthers = useCatalogSearch({
    catalog: catalogs.operationCatalog,
    searchFn: (q: string) => searchDomainCatalog('Operation', q),
    createFn: (name: string) => createDomainCatalog('Operation', name),
    nameKey: 'name',
  });
  const medicationOthers = useCatalogSearch({
    catalog: catalogs.medicationCatalog,
    searchFn: (q: string) => searchDomainCatalog('Medication', q),
    createFn: (name: string) => createDomainCatalog('Medication', name),
    nameKey: 'name',
  });

  const renderYesNo = (label: string, value: string, onSelect: (v: string) => void) => (
    <View style={styles.yesNoContainer}>
      <Text style={[styles.yesNoLabel, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]}>{label}</Text>
      <View style={styles.yesNoBtns}>
        {['Yes', 'No'].map(v => (
          <TouchableOpacity
            key={v}
            style={[
              styles.yesNoBtn,
              { backgroundColor: value === v ? colors.primary[500] : isDark ? colors.neutral[700] : colors.neutral[100] },
            ]}
            onPress={() => onSelect(v)}
            activeOpacity={0.7}
          >
            <Text style={{ color: value === v ? '#FFF' : isDark ? colors.neutral[300] : colors.neutral[600], fontWeight: '600', fontSize: 13 }}>{v}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderOptionPicker = (label: string, options: string[], value: string, onSelect: (v: string) => void) => (
    <View style={{ marginTop: 8 }}>
      <Text style={[styles.fieldLabel, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]}>{label}</Text>
      <View style={styles.optionRow}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt}
            style={[
              styles.optionChip,
              { backgroundColor: value === opt ? colors.primary[500] : isDark ? colors.neutral[700] : colors.neutral[100] },
            ]}
            onPress={() => onSelect(opt)}
            activeOpacity={0.7}
          >
            <Text style={{ color: value === opt ? '#FFF' : isDark ? colors.neutral[300] : colors.neutral[600], fontSize: 12, fontWeight: '600' }}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // Allergy handlers
  const handleAllergyToggle = (id: string) => {
    const current = bg.allergies[id];
    const isChecked = typeof current === 'object' ? current.checked : !!current;
    if (isChecked) {
      // Uncheck — remove entry
      const updated = { ...bg.allergies };
      delete updated[id];
      onUpdateBg({ allergies: updated });
    } else {
      // Check — with default severity/status
      onUpdateBg({ allergies: { ...bg.allergies, [id]: { checked: true, severity: '', status: 'Active' } } });
    }
  };

  const handleAllergyDetail = (id: string, field: 'severity' | 'status', value: string) => {
    const current = bg.allergies[id];
    const existing = typeof current === 'object' ? current : { checked: true, severity: '', status: 'Active' };
    onUpdateBg({ allergies: { ...bg.allergies, [id]: { ...existing, [field]: value } } });
  };

  // Immunization handlers
  const handleImmunizationToggle = (id: string) => {
    const newVal = !bg.immunizations[id];
    onUpdateBg({ immunizations: { ...bg.immunizations, [id]: newVal } });
    // Remove details if unchecked
    if (!newVal && bg.immunizationDetails?.[id]) {
      const updated = { ...bg.immunizationDetails };
      delete updated[id];
      onUpdateBg({ immunizationDetails: updated });
    }
  };

  const handleImmunizationDetail = (id: string, field: 'date' | 'doseNumber', value: string) => {
    const existing = bg.immunizationDetails?.[id] || { date: '', doseNumber: '' };
    onUpdateBg({ immunizationDetails: { ...bg.immunizationDetails, [id]: { ...existing, [field]: value } } });
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>Medical Background</Text>

      {/* Immunizations */}
      <AccordionSection title="Immunization History" isOpen={openSections.immunizations} onToggle={() => toggleSection('immunizations')} isDark={isDark}>
        <Text style={[styles.sublabel, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
          Select vaccines you have received and provide details:
        </Text>
        {catalogs.immunizationCatalog.map(vac => {
          const isChecked = !!bg.immunizations[vac.id];
          const details = bg.immunizationDetails?.[vac.id];
          return (
            <View key={vac.id}>
              <TouchableOpacity style={styles.checkRow} onPress={() => handleImmunizationToggle(vac.id)} activeOpacity={0.7}>
                <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                  {isChecked && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                </View>
                <Text style={[styles.itemText, { color: isDark ? colors.neutral[100] : colors.neutral[800] }]}>{vac.name}</Text>
              </TouchableOpacity>
              {isChecked && (
                <View style={[styles.detailCard, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50] }]}>
                  <View style={styles.detailRow}>
                    <View style={{ flex: 1 }}>
                      <DatePickerInput
                        label="Date Received"
                        value={details?.date || ''}
                        onChange={v => handleImmunizationDetail(vac.id, 'date', v)}
                        isDark={isDark}
                        required
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.detailLabel, { color: isDark ? colors.neutral[300] : colors.neutral[600] }]}>Dose Number *</Text>
                      <TextInput
                        style={inputStyle}
                        value={details?.doseNumber || ''}
                        onChangeText={v => handleImmunizationDetail(vac.id, 'doseNumber', v)}
                        placeholder="1, 2, 3..."
                        keyboardType="numeric"
                        placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]}
                      />
                    </View>
                  </View>
                </View>
              )}
            </View>
          );
        })}
        {/* Dynamic (searched/created) immunizations */}
        {immunizationOthers.dynamicItems.map((vac: any) => {
          const isChecked = !!bg.immunizations[vac.id];
          const details = bg.immunizationDetails?.[vac.id];
          return (
            <View key={vac.id}>
              <TouchableOpacity style={styles.checkRow} onPress={() => handleImmunizationToggle(vac.id)} activeOpacity={0.7}>
                <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                  {isChecked && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                </View>
                <Text style={[styles.itemText, { color: isDark ? colors.neutral[100] : colors.neutral[800] }]}>{vac.name}</Text>
                <Text style={{ fontSize: 10, color: colors.primary[400], fontWeight: '600' }}>NEW</Text>
              </TouchableOpacity>
              {isChecked && (
                <View style={[styles.detailCard, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50] }]}>
                  <View style={styles.detailRow}>
                    <View style={{ flex: 1 }}>
                      <DatePickerInput label="Date Received" value={details?.date || ''} onChange={v => handleImmunizationDetail(vac.id, 'date', v)} isDark={isDark} required />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.detailLabel, { color: isDark ? colors.neutral[300] : colors.neutral[600] }]}>Dose Number *</Text>
                      <TextInput style={inputStyle} value={details?.doseNumber || ''} onChangeText={v => handleImmunizationDetail(vac.id, 'doseNumber', v)}
                        placeholder="1, 2, 3..." keyboardType="numeric" placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} />
                    </View>
                  </View>
                </View>
              )}
            </View>
          );
        })}
        <CatalogSearchField
          label="Other Immunizations"
          input={immunizationOthers.input}
          onInputChange={immunizationOthers.handleInputChange}
          suggestions={immunizationOthers.suggestions}
          displayKey="name"
          searching={immunizationOthers.searching}
          creating={immunizationOthers.creating}
          focused={immunizationOthers.focused}
          onFocusChange={immunizationOthers.setFocused}
          onSelect={(item) => {
            immunizationOthers.selectItem(item);
            handleImmunizationToggle(item.id);
          }}
          onCreate={() => immunizationOthers.createItem(immunizationOthers.input.trim())}
          isDark={isDark}
          placeholder="Search or add immunizations..."
        />
      </AccordionSection>

      {/* Allergies */}
      <AccordionSection title="Allergies" isOpen={openSections.allergies} onToggle={() => toggleSection('allergies')} isDark={isDark}>
        {renderYesNo('Do you have allergies?', bg.hasAllergies, v => onUpdateBg({ hasAllergies: v }))}
        {bg.hasAllergies === 'Yes' && (
          <>
            {catalogs.allergenCatalog.map(allergen => {
              const val = bg.allergies[allergen.id];
              const isChecked = typeof val === 'object' ? val.checked : !!val;
              const severity = typeof val === 'object' ? val.severity : '';
              const status = typeof val === 'object' ? (val as any).status : 'Active';
              return (
                <View key={allergen.id}>
                  <TouchableOpacity style={styles.checkRow} onPress={() => handleAllergyToggle(allergen.id)} activeOpacity={0.7}>
                    <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                      {isChecked && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                    </View>
                    <Text style={[styles.itemText, { color: isDark ? colors.neutral[100] : colors.neutral[800] }]}>
                      {allergen.allergen} ({allergen.type})
                    </Text>
                  </TouchableOpacity>
                  {isChecked && (
                    <View style={[styles.detailCard, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50] }]}>
                      {renderOptionPicker('Status *', STATUS_OPTIONS, status, v => handleAllergyDetail(allergen.id, 'status', v))}
                      {renderOptionPicker('Severity *', SEVERITY_OPTIONS, severity, v => handleAllergyDetail(allergen.id, 'severity', v))}
                    </View>
                  )}
                </View>
              );
            })}
            {/* Dynamic (searched/created) allergens */}
            {allergenOthers.dynamicItems.map((allergen: any) => {
              const val = bg.allergies[allergen.id];
              const isChecked = typeof val === 'object' ? val.checked : !!val;
              const severity = typeof val === 'object' ? val.severity : '';
              const status = typeof val === 'object' ? (val as any).status : 'Active';
              return (
                <View key={allergen.id}>
                  <TouchableOpacity style={styles.checkRow} onPress={() => handleAllergyToggle(allergen.id)} activeOpacity={0.7}>
                    <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                      {isChecked && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                    </View>
                    <Text style={[styles.itemText, { color: isDark ? colors.neutral[100] : colors.neutral[800] }]}>
                      {allergen.allergen} ({allergen.type})
                    </Text>
                    <Text style={{ fontSize: 10, color: colors.primary[400], fontWeight: '600' }}>NEW</Text>
                  </TouchableOpacity>
                  {isChecked && (
                    <View style={[styles.detailCard, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50] }]}>
                      {renderOptionPicker('Status *', STATUS_OPTIONS, status, v => handleAllergyDetail(allergen.id, 'status', v))}
                      {renderOptionPicker('Severity *', SEVERITY_OPTIONS, severity, v => handleAllergyDetail(allergen.id, 'severity', v))}
                    </View>
                  )}
                </View>
              );
            })}
            {/* Allergen type picker for creation */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
              <Text style={{ fontSize: 13, color: isDark ? colors.neutral[300] : colors.neutral[600] }}>Type:</Text>
              {['Drug', 'Food', 'Environmental', 'Other'].map(t => (
                <TouchableOpacity key={t} onPress={() => setAllergenTypeForCreate(t)}
                  style={[styles.optionChip, { backgroundColor: allergenTypeForCreate === t ? colors.primary[500] : isDark ? colors.neutral[700] : colors.neutral[100] }]}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: allergenTypeForCreate === t ? '#FFF' : isDark ? colors.neutral[300] : colors.neutral[600] }}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <CatalogSearchField
              label="Other Allergens"
              input={allergenOthers.input}
              onInputChange={allergenOthers.handleInputChange}
              suggestions={allergenOthers.suggestions}
              displayKey="allergen"
              searching={allergenOthers.searching}
              creating={allergenOthers.creating}
              focused={allergenOthers.focused}
              onFocusChange={allergenOthers.setFocused}
              onSelect={(item) => {
                allergenOthers.selectItem(item);
                handleAllergyToggle(item.id);
              }}
              onCreate={() => allergenOthers.createItem(allergenOthers.input.trim())}
              isDark={isDark}
              placeholder="Search or add allergens..."
            />
            <TextInput style={[...inputStyle, { marginTop: 8 }]} value={bg.allergyNotes || ''} onChangeText={v => onUpdateBg({ allergyNotes: v })}
              placeholder="Additional allergy notes (optional)" placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} multiline />
          </>
        )}
      </AccordionSection>

      {/* Hospitalizations */}
      <AccordionSection title="Hospitalizations" isOpen={openSections.hospitalizations} onToggle={() => toggleSection('hospitalizations')} isDark={isDark}>
        {renderYesNo('Have you been hospitalized?', bg.hasHospitalization, v => onUpdateBg({ hasHospitalization: v }))}
        {bg.hasHospitalization === 'Yes' && (
          <>
            {catalogs.hospitalizationCatalog.map(cond => {
              const isChecked = !!bg.hospitalizationConditions[cond.id];
              const dates = bg.hospitalizationDates?.[cond.id];
              return (
                <View key={cond.id}>
                  <TouchableOpacity style={styles.checkRow} onPress={() => {
                    const newChecked = !isChecked;
                    onUpdateBg({ hospitalizationConditions: { ...bg.hospitalizationConditions, [cond.id]: newChecked } });
                    if (!newChecked) {
                      const updated = { ...bg.hospitalizationDates };
                      delete updated[cond.id];
                      onUpdateBg({ hospitalizationDates: updated });
                    }
                  }} activeOpacity={0.7}>
                    <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                      {isChecked && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                    </View>
                    <Text style={[styles.itemText, { color: isDark ? colors.neutral[100] : colors.neutral[800] }]}>{cond.name}</Text>
                  </TouchableOpacity>
                  {isChecked && (
                    <View style={[styles.detailCard, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50] }]}>
                      <View style={styles.detailRow}>
                        <View style={{ flex: 1 }}>
                          <DatePickerInput
                            label="Admission Date"
                            value={dates?.admissionDate || ''}
                            onChange={v => {
                              const existing = bg.hospitalizationDates?.[cond.id] || { admissionDate: '', dischargeDate: '' };
                              onUpdateBg({ hospitalizationDates: { ...bg.hospitalizationDates, [cond.id]: { ...existing, admissionDate: v } } });
                            }}
                            isDark={isDark}
                            required
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <DatePickerInput
                            label="Discharge Date"
                            value={dates?.dischargeDate || ''}
                            onChange={v => {
                              const existing = bg.hospitalizationDates?.[cond.id] || { admissionDate: '', dischargeDate: '' };
                              onUpdateBg({ hospitalizationDates: { ...bg.hospitalizationDates, [cond.id]: { ...existing, dischargeDate: v } } });
                            }}
                            isDark={isDark}
                          />
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
            {/* Dynamic (searched/created) hospitalizations */}
            {hospitalizationOthers.dynamicItems.map((cond: any) => {
              const isChecked = !!bg.hospitalizationConditions[cond.id];
              const dates = bg.hospitalizationDates?.[cond.id];
              return (
                <View key={cond.id}>
                  <TouchableOpacity style={styles.checkRow} onPress={() => {
                    const newChecked = !isChecked;
                    onUpdateBg({ hospitalizationConditions: { ...bg.hospitalizationConditions, [cond.id]: newChecked } });
                    if (!newChecked) {
                      const updated = { ...bg.hospitalizationDates };
                      delete updated[cond.id];
                      onUpdateBg({ hospitalizationDates: updated });
                    }
                  }} activeOpacity={0.7}>
                    <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                      {isChecked && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                    </View>
                    <Text style={[styles.itemText, { color: isDark ? colors.neutral[100] : colors.neutral[800] }]}>{cond.name}</Text>
                    <Text style={{ fontSize: 10, color: colors.primary[400], fontWeight: '600' }}>NEW</Text>
                  </TouchableOpacity>
                  {isChecked && (
                    <View style={[styles.detailCard, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50] }]}>
                      <View style={styles.detailRow}>
                        <View style={{ flex: 1 }}>
                          <DatePickerInput label="Admission Date" value={dates?.admissionDate || ''}
                            onChange={v => {
                              const existing = bg.hospitalizationDates?.[cond.id] || { admissionDate: '', dischargeDate: '' };
                              onUpdateBg({ hospitalizationDates: { ...bg.hospitalizationDates, [cond.id]: { ...existing, admissionDate: v } } });
                            }} isDark={isDark} required />
                        </View>
                        <View style={{ flex: 1 }}>
                          <DatePickerInput label="Discharge Date" value={dates?.dischargeDate || ''}
                            onChange={v => {
                              const existing = bg.hospitalizationDates?.[cond.id] || { admissionDate: '', dischargeDate: '' };
                              onUpdateBg({ hospitalizationDates: { ...bg.hospitalizationDates, [cond.id]: { ...existing, dischargeDate: v } } });
                            }} isDark={isDark} />
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
            <CatalogSearchField
              label="Other Hospitalizations"
              input={hospitalizationOthers.input}
              onInputChange={hospitalizationOthers.handleInputChange}
              suggestions={hospitalizationOthers.suggestions}
              displayKey="name"
              searching={hospitalizationOthers.searching}
              creating={hospitalizationOthers.creating}
              focused={hospitalizationOthers.focused}
              onFocusChange={hospitalizationOthers.setFocused}
              onSelect={(item) => {
                hospitalizationOthers.selectItem(item);
                onUpdateBg({ hospitalizationConditions: { ...bg.hospitalizationConditions, [item.id]: true } });
              }}
              onCreate={() => hospitalizationOthers.createItem(hospitalizationOthers.input.trim())}
              isDark={isDark}
              placeholder="Search or add hospitalizations..."
            />
            <TextInput style={[...inputStyle, { marginTop: 8 }]} value={bg.hospitalizationNotes} onChangeText={v => onUpdateBg({ hospitalizationNotes: v })}
              placeholder="Notes (optional)" placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} multiline />
          </>
        )}
      </AccordionSection>

      {/* Operations */}
      <AccordionSection title="Surgeries / Operations" isOpen={openSections.operations} onToggle={() => toggleSection('operations')} isDark={isDark}>
        {renderYesNo('Have you had any surgeries?', bg.hasOperation, v => onUpdateBg({ hasOperation: v }))}
        {bg.hasOperation === 'Yes' && (
          <>
            {catalogs.operationCatalog.map(proc => {
              const isChecked = !!bg.operationConditions[proc.id];
              const opDate = bg.operationDates?.[proc.id] || '';
              return (
                <View key={proc.id}>
                  <TouchableOpacity style={styles.checkRow} onPress={() => {
                    const newChecked = !isChecked;
                    onUpdateBg({ operationConditions: { ...bg.operationConditions, [proc.id]: newChecked } });
                    if (!newChecked) {
                      const updated = { ...bg.operationDates };
                      delete updated[proc.id];
                      onUpdateBg({ operationDates: updated });
                    }
                  }} activeOpacity={0.7}>
                    <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                      {isChecked && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                    </View>
                    <Text style={[styles.itemText, { color: isDark ? colors.neutral[100] : colors.neutral[800] }]}>{proc.name}</Text>
                  </TouchableOpacity>
                  {isChecked && (
                    <View style={[styles.detailCard, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50] }]}>
                      <DatePickerInput
                        label="Operation Date"
                        value={opDate}
                        onChange={v => onUpdateBg({ operationDates: { ...bg.operationDates, [proc.id]: v } })}
                        isDark={isDark}
                        required
                      />
                    </View>
                  )}
                </View>
              );
            })}
            {/* Dynamic (searched/created) operations */}
            {operationOthers.dynamicItems.map((proc: any) => {
              const isChecked = !!bg.operationConditions[proc.id];
              const opDate = bg.operationDates?.[proc.id] || '';
              return (
                <View key={proc.id}>
                  <TouchableOpacity style={styles.checkRow} onPress={() => {
                    const newChecked = !isChecked;
                    onUpdateBg({ operationConditions: { ...bg.operationConditions, [proc.id]: newChecked } });
                    if (!newChecked) {
                      const updated = { ...bg.operationDates };
                      delete updated[proc.id];
                      onUpdateBg({ operationDates: updated });
                    }
                  }} activeOpacity={0.7}>
                    <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                      {isChecked && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                    </View>
                    <Text style={[styles.itemText, { color: isDark ? colors.neutral[100] : colors.neutral[800] }]}>{proc.name}</Text>
                    <Text style={{ fontSize: 10, color: colors.primary[400], fontWeight: '600' }}>NEW</Text>
                  </TouchableOpacity>
                  {isChecked && (
                    <View style={[styles.detailCard, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50] }]}>
                      <DatePickerInput label="Operation Date" value={opDate}
                        onChange={v => onUpdateBg({ operationDates: { ...bg.operationDates, [proc.id]: v } })} isDark={isDark} required />
                    </View>
                  )}
                </View>
              );
            })}
            <CatalogSearchField
              label="Other Operations"
              input={operationOthers.input}
              onInputChange={operationOthers.handleInputChange}
              suggestions={operationOthers.suggestions}
              displayKey="name"
              searching={operationOthers.searching}
              creating={operationOthers.creating}
              focused={operationOthers.focused}
              onFocusChange={operationOthers.setFocused}
              onSelect={(item) => {
                operationOthers.selectItem(item);
                onUpdateBg({ operationConditions: { ...bg.operationConditions, [item.id]: true } });
              }}
              onCreate={() => operationOthers.createItem(operationOthers.input.trim())}
              isDark={isDark}
              placeholder="Search or add operations..."
            />
            <TextInput style={[...inputStyle, { marginTop: 8 }]} value={bg.operationNotes} onChangeText={v => onUpdateBg({ operationNotes: v })}
              placeholder="Surgery notes (optional)" placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} multiline />
          </>
        )}
      </AccordionSection>

      {/* Medications */}
      <AccordionSection title="Current Medications" isOpen={openSections.medications} onToggle={() => toggleSection('medications')} isDark={isDark}>
        {renderYesNo('Are you taking any medications?', bg.hasMedications, v => onUpdateBg({ hasMedications: v }))}
        {bg.hasMedications === 'Yes' && (
          <>
            {catalogs.medicationCatalog.map(med => {
              const isChecked = !!bg.selectedMedications[med.id];
              return (
                <TouchableOpacity key={med.id} style={styles.checkRow} onPress={() => onUpdateBg({ selectedMedications: { ...bg.selectedMedications, [med.id]: !isChecked } })} activeOpacity={0.7}>
                  <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                    {isChecked && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                  </View>
                  <Text style={[styles.itemText, { color: isDark ? colors.neutral[100] : colors.neutral[800] }]}>{med.name}</Text>
                </TouchableOpacity>
              );
            })}
            {/* Dynamic (searched/created) medications */}
            {medicationOthers.dynamicItems.map((med: any) => {
              const isChecked = !!bg.selectedMedications[med.id];
              return (
                <TouchableOpacity key={med.id} style={styles.checkRow} onPress={() => onUpdateBg({ selectedMedications: { ...bg.selectedMedications, [med.id]: !isChecked } })} activeOpacity={0.7}>
                  <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                    {isChecked && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                  </View>
                  <Text style={[styles.itemText, { color: isDark ? colors.neutral[100] : colors.neutral[800] }]}>{med.name}</Text>
                  <Text style={{ fontSize: 10, color: colors.primary[400], fontWeight: '600' }}>NEW</Text>
                </TouchableOpacity>
              );
            })}
            <CatalogSearchField
              label="Other Medications"
              input={medicationOthers.input}
              onInputChange={medicationOthers.handleInputChange}
              suggestions={medicationOthers.suggestions}
              displayKey="name"
              searching={medicationOthers.searching}
              creating={medicationOthers.creating}
              focused={medicationOthers.focused}
              onFocusChange={medicationOthers.setFocused}
              onSelect={(item) => {
                medicationOthers.selectItem(item);
                onUpdateBg({ selectedMedications: { ...bg.selectedMedications, [item.id]: true } });
              }}
              onCreate={() => medicationOthers.createItem(medicationOthers.input.trim())}
              isDark={isDark}
              placeholder="Search or add medications..."
            />
            <TextInput style={[...inputStyle, { marginTop: 8 }]} value={bg.medicationReason || ''} onChangeText={v => onUpdateBg({ medicationReason: v })}
              placeholder="Reason for taking medication" placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} multiline />
            <TextInput style={[...inputStyle, { marginTop: 8 }]} value={bg.medicationNotes || ''} onChangeText={v => onUpdateBg({ medicationNotes: v })}
              placeholder="Medication notes (optional)" placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} multiline />
          </>
        )}
      </AccordionSection>

      {/* Lifestyle */}
      <AccordionSection title="Lifestyle Habits" isOpen={openSections.lifestyle} onToggle={() => toggleSection('lifestyle')} isDark={isDark}>
        {/* Smoker */}
        <View style={[styles.lifestyleSection, { borderLeftColor: '#EAB308' }]}>
          <Text style={[styles.lifestyleSectionTitle, { color: isDark ? colors.neutral[100] : colors.secondary[800] }]}>Smoker</Text>
          {renderYesNo('Do you smoke?', bg.smoker === 'yes' ? 'Yes' : bg.smoker === 'no' ? 'No' : '',
            v => onUpdateBg({ smoker: v === 'Yes' ? 'yes' : 'no' }))}
          {bg.smoker === 'yes' && (
            <View style={styles.detailRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.detailLabel, { color: isDark ? colors.neutral[300] : colors.neutral[600] }]}>Sticks per day</Text>
                <TextInput style={inputStyle} value={bg.smokerSticksPerDay} onChangeText={v => onUpdateBg({ smokerSticksPerDay: v })}
                  placeholder="Number" keyboardType="numeric" placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.detailLabel, { color: isDark ? colors.neutral[300] : colors.neutral[600] }]}>Years of smoking</Text>
                <TextInput style={inputStyle} value={bg.smokerYears} onChangeText={v => onUpdateBg({ smokerYears: v })}
                  placeholder="Years" keyboardType="numeric" placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} />
              </View>
            </View>
          )}
        </View>

        {/* Alcohol */}
        <View style={[styles.lifestyleSection, { borderLeftColor: colors.primary[500] }]}>
          <Text style={[styles.lifestyleSectionTitle, { color: isDark ? colors.neutral[100] : colors.secondary[800] }]}>Alcohol Drinker</Text>
          {renderYesNo('Do you drink alcohol?', bg.alcoholDrinker === 'yes' ? 'Yes' : bg.alcoholDrinker === 'no' ? 'No' : '',
            v => onUpdateBg({ alcoholDrinker: v === 'Yes' ? 'yes' : 'no' }))}
          {bg.alcoholDrinker === 'yes' && (
            renderOptionPicker('Frequency', FREQUENCY_OPTIONS, bg.alcoholFrequency, v => onUpdateBg({ alcoholFrequency: v }))
          )}
        </View>

        {/* Vaper */}
        <View style={[styles.lifestyleSection, { borderLeftColor: colors.accent ? colors.accent[500] : colors.primary[400] }]}>
          <Text style={[styles.lifestyleSectionTitle, { color: isDark ? colors.neutral[100] : colors.secondary[800] }]}>Vaper</Text>
          {renderYesNo('Do you vape?', bg.vaper === 'yes' ? 'Yes' : bg.vaper === 'no' ? 'No' : '',
            v => onUpdateBg({ vaper: v === 'Yes' ? 'yes' : 'no' }))}
          {bg.vaper === 'yes' && (
            <>
              {renderOptionPicker('Vape Type', VAPE_TYPE_OPTIONS, bg.vapeType || '', v => onUpdateBg({ vapeType: v }))}
              {renderOptionPicker('Frequency', FREQUENCY_OPTIONS, bg.vapeFrequency || '', v => onUpdateBg({ vapeFrequency: v }))}
              <View style={{ marginTop: 8 }}>
                <Text style={[styles.detailLabel, { color: isDark ? colors.neutral[300] : colors.neutral[600] }]}>Years of vaping</Text>
                <TextInput style={inputStyle} value={bg.yearsVaping || ''} onChangeText={v => onUpdateBg({ yearsVaping: v })}
                  placeholder="Years" keyboardType="numeric" placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} />
              </View>
            </>
          )}
        </View>
      </AccordionSection>

      {/* Visual Acuity */}
      <AccordionSection title="Visual Acuity" isOpen={openSections.visualAcuity} onToggle={() => toggleSection('visualAcuity')} isDark={isDark}>
        <View style={styles.switchRow}>
          <Text style={{ color: isDark ? colors.neutral[200] : colors.neutral[800], fontSize: 14 }}>Wears Eyeglasses</Text>
          <Switch value={bg.eyeglasses} onValueChange={v => onUpdateBg({ eyeglasses: v })} />
        </View>
        <View style={styles.switchRow}>
          <Text style={{ color: isDark ? colors.neutral[200] : colors.neutral[800], fontSize: 14 }}>Wears Contact Lenses</Text>
          <Switch value={bg.contactLenses} onValueChange={v => onUpdateBg({ contactLenses: v })} />
        </View>
        {(bg.eyeglasses || bg.contactLenses) && (
          <>
            <View style={styles.detailRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.detailLabel, { color: isDark ? colors.neutral[300] : colors.neutral[600] }]}>Right Eye (OD) *</Text>
                <TextInput style={inputStyle} value={bg.gradeOD} onChangeText={v => onUpdateBg({ gradeOD: v })}
                  placeholder="e.g. 20/20, -2.00" placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.detailLabel, { color: isDark ? colors.neutral[300] : colors.neutral[600] }]}>Left Eye (OS) *</Text>
                <TextInput style={inputStyle} value={bg.gradeOS} onChangeText={v => onUpdateBg({ gradeOS: v })}
                  placeholder="e.g. 20/20, -1.75" placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]} />
              </View>
            </View>
            <View style={{ marginTop: 8 }}>
              <DatePickerInput
                label="Visual Acuity Date"
                value={bg.visualAcuityDate || ''}
                onChange={v => onUpdateBg({ visualAcuityDate: v })}
                isDark={isDark}
              />
            </View>
          </>
        )}
      </AccordionSection>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 17, fontWeight: '700', marginBottom: 16 },
  accordion: { borderWidth: 1, borderRadius: 14, marginBottom: 10, overflow: 'hidden' },
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  accordionTitle: { fontSize: 15, fontWeight: '600' },
  accordionBody: { paddingHorizontal: 14, paddingBottom: 14 },
  sublabel: { fontSize: 13, marginBottom: 10, lineHeight: 18 },
  fieldLabel: { fontSize: 13, fontWeight: '500', marginBottom: 6 },
  detailLabel: { fontSize: 13, fontWeight: '500', marginBottom: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.neutral[400], alignItems: 'center' as const, justifyContent: 'center' as const },
  checkboxChecked: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
  checkmark: { color: '#FFF', fontSize: 13, fontWeight: '700' as const },
  itemText: { fontSize: 14, flex: 1 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  yesNoContainer: { marginBottom: 10 },
  yesNoLabel: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  yesNoBtns: { flexDirection: 'row', gap: 8 },
  yesNoBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  detailCard: { marginLeft: 32, marginBottom: 8, borderRadius: 10, padding: 10 },
  detailRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  optionChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  lifestyleSection: { borderLeftWidth: 4, paddingLeft: 12, marginBottom: 16 },
  lifestyleSectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
});

export default MedicalBackgroundStep;
