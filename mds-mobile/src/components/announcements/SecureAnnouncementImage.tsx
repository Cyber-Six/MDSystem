import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageProps,
  ImageSourcePropType,
  StyleProp,
  StyleSheet,
  View,
  ImageStyle,
} from 'react-native';
import { axiosRequest, getApiBaseUrl, TokenStorage } from '../../core';
import { useTheme, colors } from '../../context/ThemeContext';

interface SecureAnnouncementImageProps {
  pubmat: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageProps['resizeMode'];
}

const getMimeTypeFromHeaders = (headers: unknown): string => {
  if (!headers || typeof headers !== 'object') return 'image/jpeg';

  const map = headers as Record<string, unknown>;
  const headerValue = map['content-type'] ?? map['Content-Type'];

  if (Array.isArray(headerValue)) {
    return typeof headerValue[0] === 'string' ? headerValue[0] : 'image/jpeg';
  }

  if (typeof headerValue === 'string' && headerValue.length > 0) {
    return headerValue.split(';')[0].trim() || 'image/jpeg';
  }

  return 'image/jpeg';
};

const payloadToBase64 = (payload: unknown): string => {
  if (typeof payload === 'string') {
    try {
      return btoa(payload);
    } catch {
      return payload;
    }
  }

  let bytes: Uint8Array | null = null;
  if (payload instanceof ArrayBuffer) {
    bytes = new Uint8Array(payload);
  } else if (ArrayBuffer.isView(payload)) {
    bytes = new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength);
  }

  if (!bytes) {
    throw new Error('Unsupported image payload');
  }

  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
};

export const SecureAnnouncementImage: React.FC<SecureAnnouncementImageProps> = ({
  pubmat,
  style,
  resizeMode = 'cover',
}) => {
  const { isDark } = useTheme();
  const [source, setSource] = useState<ImageSourcePropType | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadImage = async () => {
      setSource(null);
      setHasError(false);

      try {
        const response = await axiosRequest.get(`/media/record/announcement/${pubmat}`, {
          responseType: 'arraybuffer',
        });

        if (cancelled) return;

        const mimeType = getMimeTypeFromHeaders(response.headers);
        const base64 = payloadToBase64(response.data);
        setSource({ uri: `data:${mimeType};base64,${base64}` });
      } catch {
        try {
          const token = await Promise.resolve(TokenStorage.getAccessToken?.());
          if (cancelled) return;

          const uri = `${getApiBaseUrl()}/media/record/announcement/${pubmat}`;
          if (token) {
            setSource({ uri, headers: { Authorization: `Bearer ${token}` } });
          } else {
            setSource({ uri });
          }
        } catch {
          if (!cancelled) {
            setHasError(true);
          }
        }
      }
    };

    loadImage();

    return () => {
      cancelled = true;
    };
  }, [pubmat]);

  if (!source && !hasError) {
    return (
      <View
        style={[
          style,
          styles.placeholder,
          { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100] },
        ]}
      >
        <ActivityIndicator size="small" color={colors.primary[500]} />
      </View>
    );
  }

  if (!source) {
    return (
      <View
        style={[
          style,
          styles.placeholder,
          { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100] },
        ]}
      />
    );
  }

  return (
    <Image
      source={source}
      style={style}
      resizeMode={resizeMode}
      onError={() => {
        setHasError(true);
        setSource(null);
      }}
    />
  );
};

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SecureAnnouncementImage;
