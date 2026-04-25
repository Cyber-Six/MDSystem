import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { colors } from '../../context/ThemeContext';

const AUTH_REDIRECT_SCHEME = 'mdsystem';

export interface GoogleSignInSectionProps {
  clientId: string;
  isDark: boolean;
  isLoading: boolean;
  onError: (message: string) => void;
  onLoadingChange: (value: boolean) => void;
  onIdToken: (idToken: string) => Promise<void>;
}

export const GoogleSignInSection: React.FC<GoogleSignInSectionProps> = ({
  clientId,
  isDark,
  isLoading,
  onError,
  onLoadingChange,
  onIdToken,
}) => {
  const discovery = AuthSession.useAutoDiscovery('https://accounts.google.com');
  const nonceRef = useRef(Math.random().toString(36).substring(2));

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId,
      redirectUri: AuthSession.makeRedirectUri({
        scheme: AUTH_REDIRECT_SCHEME,
      }),
      scopes: ['openid', 'profile', 'email'],
      responseType: AuthSession.ResponseType.IdToken,
      extraParams: {
        hd: 'tip.edu.ph',
        nonce: nonceRef.current,
      },
    },
    discovery
  );

  useEffect(() => {
    if (!response) {
      return;
    }

    if (response.type === 'success') {
      const idToken = response.params?.id_token;
      if (idToken) {
        void onIdToken(idToken);
        return;
      }

      onError('Google sign-in did not return an ID token.');
      onLoadingChange(false);
      return;
    }

    if (response.type === 'error') {
      onError('Google sign-in was cancelled or failed.');
      onLoadingChange(false);
      return;
    }

    if (
      response.type === 'cancel' ||
      response.type === 'dismiss' ||
      response.type === 'locked'
    ) {
      onLoadingChange(false);
    }
  }, [response, onError, onIdToken, onLoadingChange]);

  const handlePress = async () => {
    try {
      onError('');
      onLoadingChange(true);
      await promptAsync();
    } catch {
      onError('Google sign-in was cancelled or failed.');
      onLoadingChange(false);
    }
  };

  return (
    <>
      <View style={styles.oauthDivider}>
        <View
          style={[
            styles.oauthDividerLine,
            { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[300] },
          ]}
        />
        <Text
          style={[
            styles.oauthDividerText,
            { color: isDark ? colors.neutral[400] : colors.neutral[500] },
          ]}
        >
          or
        </Text>
        <View
          style={[
            styles.oauthDividerLine,
            { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[300] },
          ]}
        />
      </View>

      <TouchableOpacity
        style={[
          styles.googleButton,
          {
            borderColor: isDark ? colors.neutral[600] : colors.neutral[300],
            backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF',
          },
        ]}
        onPress={handlePress}
        disabled={isLoading || !request}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: 'https://developers.google.com/identity/images/g-logo.png' }}
          style={styles.googleIcon}
        />
        <Text
          style={[
            styles.googleButtonText,
            { color: isDark ? colors.neutral[100] : colors.secondary[900] },
          ]}
        >
          {isLoading ? 'Signing in...' : 'Sign in with Google'}
        </Text>
      </TouchableOpacity>
    </>
  );
};

const styles = StyleSheet.create({
  oauthDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  oauthDividerLine: {
    flex: 1,
    height: 1,
  },
  oauthDividerText: {
    paddingHorizontal: 12,
    fontSize: 14,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
