import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, colors } from '../../context/ThemeContext';
import { axiosRequest } from '../../core';

type PasswordStep = 'passwords' | 'verify-totp' | 'verify-email';
type FeedbackType = 'success' | 'error';

type TotpSetupData = {
  qrCode: string;
  secret: string;
};

type FeedbackState = {
  type: FeedbackType;
  message: string;
} | null;

const codeInput = (value: string) => value.replace(/\D/g, '').slice(0, 6);

const SecuritySettingsCard: React.FC = () => {
  const { isDark } = useTheme();

  const [totpEnabled, setTotpEnabled] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  // TOTP setup/disable states
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [showManualKey, setShowManualKey] = useState(false);
  const [setupData, setSetupData] = useState<TotpSetupData | null>(null);
  const [setupToken, setSetupToken] = useState('');
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [disableToken, setDisableToken] = useState('');
  const [disableError, setDisableError] = useState<string | null>(null);
  const [disableLoading, setDisableLoading] = useState(false);

  // Change password modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordStep, setPasswordStep] = useState<PasswordStep>('passwords');
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwTotpToken, setPwTotpToken] = useState('');
  const [pwEmailOtp, setPwEmailOtp] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwLoading, setPwLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const fetchTotpStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await axiosRequest.get('/settings/totp/status');
      if (res.data?.ok) {
        setTotpEnabled(Boolean(res.data.totpEnabled));
      }
    } catch {
      // Keep previous state when status is unavailable.
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTotpStatus();
  }, [fetchTotpStatus]);

  const clearTotpSetupState = useCallback(() => {
    setShowSetupModal(false);
    setShowManualKey(false);
    setSetupData(null);
    setSetupToken('');
    setSetupError(null);
    setSetupLoading(false);
  }, []);

  const clearTotpDisableState = useCallback(() => {
    setShowDisableModal(false);
    setDisableToken('');
    setDisableError(null);
    setDisableLoading(false);
  }, []);

  const clearPasswordState = useCallback(() => {
    setShowPasswordModal(false);
    setPasswordStep('passwords');
    setPwCurrent('');
    setPwNew('');
    setPwConfirm('');
    setPwTotpToken('');
    setPwEmailOtp('');
    setPwError(null);
    setPwLoading(false);
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
  }, []);

  const startTotpSetup = useCallback(async () => {
    setFeedback(null);
    setSetupError(null);
    setSetupLoading(true);
    try {
      const res = await axiosRequest.post('/settings/totp/setup');
      if (res.data?.ok) {
        setSetupData({ qrCode: res.data.qrCode, secret: res.data.secret });
        setShowSetupModal(true);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to start 2FA setup.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setSetupLoading(false);
    }
  }, []);

  const verifyTotpSetup = useCallback(async () => {
    if (setupToken.length !== 6) return;
    setSetupError(null);
    setSetupLoading(true);
    try {
      const res = await axiosRequest.post('/settings/totp/verify', { token: setupToken });
      if (res.data?.ok) {
        clearTotpSetupState();
        setTotpEnabled(true);
        setFeedback({ type: 'success', message: 'Authenticator 2FA has been enabled successfully.' });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Invalid verification code.';
      setSetupError(msg);
    } finally {
      setSetupLoading(false);
    }
  }, [clearTotpSetupState, setupToken]);

  const disableTotp = useCallback(async () => {
    if (disableToken.length !== 6) return;
    setDisableError(null);
    setDisableLoading(true);
    try {
      const res = await axiosRequest.post('/settings/totp/disable', { token: disableToken });
      if (res.data?.ok) {
        clearTotpDisableState();
        setTotpEnabled(false);
        setFeedback({ type: 'success', message: 'Authenticator 2FA has been disabled.' });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to disable 2FA.';
      setDisableError(msg);
    } finally {
      setDisableLoading(false);
    }
  }, [clearTotpDisableState, disableToken]);

  const passwordsValid = useMemo(() => {
    if (!pwCurrent || !pwNew || !pwConfirm) return false;
    if (pwNew.length < 8) return false;
    if (pwNew !== pwConfirm) return false;
    if (pwCurrent === pwNew) return false;
    return true;
  }, [pwCurrent, pwNew, pwConfirm]);

  const sendPasswordEmailOtp = useCallback(async () => {
    await axiosRequest.post('/settings/password/change/otp/send');
  }, []);

  const continuePasswordFlow = useCallback(async () => {
    if (!passwordsValid) return;

    setPwError(null);
    if (totpEnabled) {
      setPasswordStep('verify-totp');
      return;
    }

    setPwLoading(true);
    try {
      await sendPasswordEmailOtp();
      setPasswordStep('verify-email');
    } catch (err: any) {
      const code = err?.response?.data?.error;
      const msg = err?.response?.data?.message || 'Failed to send verification code.';
      if (code === 'EMAIL_COOLDOWN_ACTIVE') {
        setPwError('Please wait before requesting another code.');
      } else {
        setPwError(msg);
      }
    } finally {
      setPwLoading(false);
    }
  }, [passwordsValid, sendPasswordEmailOtp, totpEnabled]);

  const useEmailInstead = useCallback(async () => {
    setPwError(null);
    setPwTotpToken('');
    setPwLoading(true);
    try {
      await sendPasswordEmailOtp();
      setPasswordStep('verify-email');
    } catch (err: any) {
      const code = err?.response?.data?.error;
      const msg = err?.response?.data?.message || 'Failed to send verification code.';
      if (code === 'EMAIL_COOLDOWN_ACTIVE') {
        setPwError('Please wait before requesting another code.');
      } else {
        setPwError(msg);
      }
    } finally {
      setPwLoading(false);
    }
  }, [sendPasswordEmailOtp]);

  const submitPasswordChange = useCallback(async () => {
    setPwError(null);
    setPwLoading(true);
    try {
      const payload: Record<string, string> = {
        currentPassword: pwCurrent,
        newPassword: pwNew,
      };

      if (passwordStep === 'verify-totp') {
        payload.totpToken = pwTotpToken;
      } else {
        payload.emailOtp = pwEmailOtp;
      }

      const res = await axiosRequest.post('/settings/password/change', payload);
      if (res.data?.ok) {
        clearPasswordState();
        setFeedback({ type: 'success', message: res.data?.message || 'Password changed successfully.' });
      }
    } catch (err: any) {
      const code = err?.response?.data?.error;
      const msg = err?.response?.data?.message || 'Failed to change password.';
      const attempts = err?.response?.data?.attempts;
      const retryAfter = err?.response?.data?.retryAfterSeconds;

      if (code === 'INVALID_TOTP_CODE') {
        setPwTotpToken('');
        setPwError('Invalid authenticator code. Please try again.');
      } else if (code === 'INVALID_OTP') {
        setPwEmailOtp('');
        setPwError(typeof attempts === 'number' ? `Invalid code. Attempts: ${attempts}` : 'Invalid code.');
      } else if (code === 'OTP_LOCKED_OUT') {
        setPwError(typeof retryAfter === 'number' ? `Too many invalid attempts. Try again in ${retryAfter}s.` : msg);
      } else if (code === 'OTP_EXPIRED') {
        setPwError('Verification code has expired. Please request a new one.');
      } else if (code === 'INVALID_CURRENT_PASSWORD') {
        setPasswordStep('passwords');
        setPwError('Current password is incorrect.');
      } else {
        setPwError(msg);
      }
    } finally {
      setPwLoading(false);
    }
  }, [clearPasswordState, passwordStep, pwCurrent, pwEmailOtp, pwNew, pwTotpToken]);

  const renderFeedback = () => {
    if (!feedback) return null;
    const isSuccess = feedback.type === 'success';
    return (
      <View
        style={[
          styles.feedback,
          {
            backgroundColor: isSuccess
              ? (isDark ? 'rgba(34,197,94,0.15)' : colors.success[50])
              : (isDark ? 'rgba(239,68,68,0.15)' : colors.error[50]),
            borderColor: isSuccess ? colors.success[400] : colors.error[400],
          },
        ]}
      >
        <Text style={{ color: isSuccess ? colors.success[500] : colors.error[500], flex: 1 }}>{feedback.message}</Text>
        <TouchableOpacity onPress={() => setFeedback(null)}>
          <Ionicons name="close" size={16} color={isSuccess ? colors.success[500] : colors.error[500]} />
        </TouchableOpacity>
      </View>
    );
  };

  const statusBadge = (
    <View
      style={[
        styles.statusBadge,
        {
          backgroundColor: totpEnabled
            ? (isDark ? 'rgba(34,197,94,0.18)' : colors.success[100])
            : (isDark ? colors.neutral[700] : colors.neutral[200]),
        },
      ]}
    >
      <Text
        style={{
          color: totpEnabled
            ? (isDark ? colors.success[300] : colors.success[600])
            : (isDark ? colors.neutral[400] : colors.neutral[600]),
          fontSize: 11,
          fontWeight: '600',
        }}
      >
        {totpEnabled ? 'Enabled' : 'Disabled'}
      </Text>
    </View>
  );

  return (
    <View style={[styles.card, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
      <Text style={[styles.sectionTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>Security</Text>
      {renderFeedback()}

      <View style={styles.securityRow}>
        <View style={styles.securityInfo}>
          <Text style={[styles.securityLabel, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>Authenticator 2FA</Text>
          <Text style={[styles.securityDescription, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>Enable app-based two-factor authentication.</Text>
        </View>
        {statusLoading ? (
          <ActivityIndicator size="small" color={colors.primary[500]} />
        ) : (
          <View style={styles.securityActions}>
            {statusBadge}
            <TouchableOpacity
              style={[
                styles.actionButton,
                {
                  backgroundColor: totpEnabled ? colors.error[500] : colors.primary[500],
                  opacity: setupLoading || disableLoading ? 0.6 : 1,
                },
              ]}
              disabled={setupLoading || disableLoading}
              onPress={() => {
                setFeedback(null);
                if (totpEnabled) {
                  setDisableError(null);
                  setDisableToken('');
                  setShowDisableModal(true);
                } else {
                  void startTotpSetup();
                }
              }}
            >
              {(setupLoading || disableLoading) ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.actionButtonText}>{totpEnabled ? 'Remove' : 'Set Up'}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={[styles.securityRow, styles.securityRowBorder, { borderTopColor: isDark ? colors.neutral[700] : colors.neutral[200] }]}>
        <View style={styles.securityInfo}>
          <Text style={[styles.securityLabel, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>Change Password</Text>
          <Text style={[styles.securityDescription, { color: isDark ? colors.neutral[400] : colors.neutral[500] }]}>
            {totpEnabled
              ? 'Authenticator or email verification will be required to confirm changes.'
              : 'An email verification code will be required to confirm changes.'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary[500], opacity: statusLoading ? 0.6 : 1 }]}
          disabled={statusLoading}
          onPress={() => {
            setFeedback(null);
            setShowPasswordModal(true);
          }}
        >
          <Text style={styles.actionButtonText}>Change</Text>
        </TouchableOpacity>
      </View>

      {/* Setup 2FA modal */}
      <Modal transparent visible={showSetupModal} animationType="fade" onRequestClose={clearTotpSetupState}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
            <Text style={[styles.modalTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>Set Up Authenticator 2FA</Text>
            <Text style={[styles.modalDescription, { color: isDark ? colors.neutral[400] : colors.neutral[600] }]}>Scan this QR code in your authenticator app, then enter the 6-digit code.</Text>

            {setupData?.qrCode ? (
              <View style={[styles.qrWrap, { backgroundColor: '#FFFFFF' }]}>
                <Image source={{ uri: setupData.qrCode }} style={styles.qrImage} resizeMode="contain" />
              </View>
            ) : null}

            <TouchableOpacity onPress={() => setShowManualKey((prev) => !prev)}>
              <Text style={[styles.linkText, { color: isDark ? colors.primary[300] : colors.primary[700] }]}>
                {showManualKey ? 'Hide manual key' : "Can't scan? Enter key manually"}
              </Text>
            </TouchableOpacity>

            {showManualKey && setupData?.secret ? (
              <View style={[styles.secretWrap, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100] }]}>
                <Text style={[styles.secretText, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>{setupData.secret}</Text>
              </View>
            ) : null}

            <TextInput
              style={[
                styles.codeInput,
                {
                  backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50],
                  color: isDark ? colors.neutral[100] : colors.neutral[900],
                  borderColor: isDark ? colors.neutral[600] : colors.neutral[200],
                },
              ]}
              placeholder="000000"
              keyboardType="number-pad"
              value={setupToken}
              onChangeText={(text) => setSetupToken(codeInput(text))}
              maxLength={6}
              editable={!setupLoading}
              placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]}
            />

            {setupError ? <Text style={styles.errorText}>{setupError}</Text> : null}

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100] }]} onPress={clearTotpSetupState}>
                <Text style={{ color: isDark ? colors.neutral[300] : colors.neutral[700], fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary[500], opacity: setupToken.length === 6 && !setupLoading ? 1 : 0.5 }]}
                onPress={() => { void verifyTotpSetup(); }}
                disabled={setupToken.length !== 6 || setupLoading}
              >
                {setupLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.modalActionText}>Verify</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Disable 2FA modal */}
      <Modal transparent visible={showDisableModal} animationType="fade" onRequestClose={clearTotpDisableState}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
            <Text style={[styles.modalTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>Disable Authenticator 2FA</Text>
            <Text style={[styles.modalDescription, { color: isDark ? colors.neutral[400] : colors.neutral[600] }]}>Enter your current authenticator code to confirm disabling 2FA.</Text>

            <TextInput
              style={[
                styles.codeInput,
                {
                  backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50],
                  color: isDark ? colors.neutral[100] : colors.neutral[900],
                  borderColor: isDark ? colors.neutral[600] : colors.neutral[200],
                },
              ]}
              placeholder="000000"
              keyboardType="number-pad"
              value={disableToken}
              onChangeText={(text) => setDisableToken(codeInput(text))}
              maxLength={6}
              editable={!disableLoading}
              placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]}
            />

            {disableError ? <Text style={styles.errorText}>{disableError}</Text> : null}

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100] }]} onPress={clearTotpDisableState}>
                <Text style={{ color: isDark ? colors.neutral[300] : colors.neutral[700], fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.error[500], opacity: disableToken.length === 6 && !disableLoading ? 1 : 0.5 }]}
                onPress={() => { void disableTotp(); }}
                disabled={disableToken.length !== 6 || disableLoading}
              >
                {disableLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.modalActionText}>Disable</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Change password modal */}
      <Modal transparent visible={showPasswordModal} animationType="fade" onRequestClose={clearPasswordState}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, styles.passwordModal, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitle, { color: isDark ? colors.neutral[100] : colors.secondary[900] }]}>
                {passwordStep === 'passwords' ? 'Change Password' : 'Verify Identity'}
              </Text>
              <Text style={[styles.modalDescription, { color: isDark ? colors.neutral[400] : colors.neutral[600] }]}>
                {passwordStep === 'passwords'
                  ? 'Enter your current password and your new password.'
                  : passwordStep === 'verify-totp'
                  ? 'Enter the code from your authenticator app.'
                  : 'Enter the 6-digit code sent to your email.'}
              </Text>

              {passwordStep === 'passwords' && (
                <>
                  <Text style={[styles.inputLabel, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]}>Current password</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={[styles.input, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50], color: isDark ? colors.neutral[100] : colors.neutral[900], borderColor: isDark ? colors.neutral[600] : colors.neutral[200] }]}
                      value={pwCurrent}
                      onChangeText={setPwCurrent}
                      secureTextEntry={!showCurrent}
                      editable={!pwLoading}
                      placeholder="Enter current password"
                      placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]}
                    />
                    <TouchableOpacity style={styles.eyeButton} onPress={() => setShowCurrent((prev) => !prev)}>
                      <Ionicons name={showCurrent ? 'eye-off' : 'eye'} size={20} color={isDark ? colors.neutral[400] : colors.neutral[500]} />
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.inputLabel, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]}>New password</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={[styles.input, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50], color: isDark ? colors.neutral[100] : colors.neutral[900], borderColor: isDark ? colors.neutral[600] : colors.neutral[200] }]}
                      value={pwNew}
                      onChangeText={setPwNew}
                      secureTextEntry={!showNew}
                      editable={!pwLoading}
                      placeholder="At least 8 characters"
                      placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]}
                    />
                    <TouchableOpacity style={styles.eyeButton} onPress={() => setShowNew((prev) => !prev)}>
                      <Ionicons name={showNew ? 'eye-off' : 'eye'} size={20} color={isDark ? colors.neutral[400] : colors.neutral[500]} />
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.inputLabel, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]}>Confirm new password</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={[styles.input, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50], color: isDark ? colors.neutral[100] : colors.neutral[900], borderColor: isDark ? colors.neutral[600] : colors.neutral[200] }]}
                      value={pwConfirm}
                      onChangeText={setPwConfirm}
                      secureTextEntry={!showConfirm}
                      editable={!pwLoading}
                      placeholder="Repeat new password"
                      placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]}
                    />
                    <TouchableOpacity style={styles.eyeButton} onPress={() => setShowConfirm((prev) => !prev)}>
                      <Ionicons name={showConfirm ? 'eye-off' : 'eye'} size={20} color={isDark ? colors.neutral[400] : colors.neutral[500]} />
                    </TouchableOpacity>
                  </View>

                  {pwNew.length > 0 && pwNew.length < 8 ? <Text style={styles.errorText}>Password must be at least 8 characters.</Text> : null}
                  {pwNew.length > 0 && pwCurrent === pwNew ? <Text style={styles.errorText}>New password must differ from your current password.</Text> : null}
                  {pwConfirm.length > 0 && pwNew !== pwConfirm ? <Text style={styles.errorText}>Passwords do not match.</Text> : null}
                </>
              )}

              {passwordStep !== 'passwords' && (
                <>
                  <Text style={[styles.inputLabel, { color: isDark ? colors.neutral[200] : colors.secondary[900] }]}>Verification code</Text>
                  <TextInput
                    style={[
                      styles.codeInput,
                      {
                        backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50],
                        color: isDark ? colors.neutral[100] : colors.neutral[900],
                        borderColor: isDark ? colors.neutral[600] : colors.neutral[200],
                      },
                    ]}
                    placeholder="000000"
                    keyboardType="number-pad"
                    value={passwordStep === 'verify-totp' ? pwTotpToken : pwEmailOtp}
                    onChangeText={(text) => {
                      const parsed = codeInput(text);
                      if (passwordStep === 'verify-totp') setPwTotpToken(parsed);
                      else setPwEmailOtp(parsed);
                    }}
                    maxLength={6}
                    editable={!pwLoading}
                    placeholderTextColor={isDark ? colors.neutral[500] : colors.neutral[400]}
                  />
                </>
              )}

              {pwError ? <Text style={styles.errorText}>{pwError}</Text> : null}

              <View style={styles.modalActions}>
                {passwordStep === 'passwords' ? (
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100] }]}
                    onPress={clearPasswordState}
                    disabled={pwLoading}
                  >
                    <Text style={{ color: isDark ? colors.neutral[300] : colors.neutral[700], fontWeight: '600' }}>Cancel</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100] }]}
                    onPress={() => {
                      setPwError(null);
                      setPwTotpToken('');
                      setPwEmailOtp('');
                      setPasswordStep(passwordStep === 'verify-totp' ? 'passwords' : (totpEnabled ? 'verify-totp' : 'passwords'));
                    }}
                    disabled={pwLoading}
                  >
                    <Text style={{ color: isDark ? colors.neutral[300] : colors.neutral[700], fontWeight: '600' }}>Back</Text>
                  </TouchableOpacity>
                )}

                {passwordStep === 'passwords' ? (
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: colors.primary[500], opacity: passwordsValid && !pwLoading ? 1 : 0.5 }]}
                    onPress={() => { void continuePasswordFlow(); }}
                    disabled={!passwordsValid || pwLoading}
                  >
                    {pwLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.modalActionText}>Continue</Text>}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.modalBtn,
                      {
                        backgroundColor: colors.primary[500],
                        opacity:
                          passwordStep === 'verify-totp'
                            ? (pwTotpToken.length === 6 && !pwLoading ? 1 : 0.5)
                            : (pwEmailOtp.length === 6 && !pwLoading ? 1 : 0.5),
                      },
                    ]}
                    onPress={() => { void submitPasswordChange(); }}
                    disabled={
                      pwLoading ||
                      (passwordStep === 'verify-totp' ? pwTotpToken.length !== 6 : pwEmailOtp.length !== 6)
                    }
                  >
                    {pwLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.modalActionText}>Confirm</Text>}
                  </TouchableOpacity>
                )}
              </View>

              {passwordStep === 'verify-totp' && (
                <TouchableOpacity disabled={pwLoading} onPress={() => { void useEmailInstead(); }}>
                  <Text style={[styles.linkText, { color: isDark ? colors.primary[300] : colors.primary[700], marginTop: 8 }]}>Use email code instead</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  feedback: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    gap: 8,
  },
  securityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  securityRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
    paddingTop: 12,
  },
  securityInfo: { flex: 1 },
  securityLabel: { fontSize: 15, fontWeight: '500' },
  securityDescription: { fontSize: 12, marginTop: 2 },
  securityActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  actionButton: {
    minWidth: 72,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    borderRadius: 16,
    padding: 18,
    maxHeight: '90%',
  },
  passwordModal: { paddingBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  modalDescription: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  qrWrap: {
    alignSelf: 'center',
    padding: 8,
    borderRadius: 10,
    marginBottom: 8,
  },
  qrImage: { width: 210, height: 210 },
  linkText: { fontSize: 12, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  secretWrap: {
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  secretText: {
    fontSize: 12,
    fontFamily: 'monospace',
    letterSpacing: 0.4,
  },
  inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
  },
  eyeButton: {
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  codeInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 6,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorText: {
    color: colors.error[500],
    fontSize: 12,
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  modalBtn: {
    minWidth: 88,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
});

export default SecuritySettingsCard;
