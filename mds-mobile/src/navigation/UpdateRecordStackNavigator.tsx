import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import UpdateRecordChoiceScreen from '../screens/record-forms/UpdateRecordChoiceScreen';
import InitialRecordFormScreen from '../screens/record-forms/InitialRecordFormScreen';
import { useTheme, colors } from '../context/ThemeContext';
import { toggleAppDrawer } from './drawer-utils';

type UpdateRecordStackParamList = {
  UpdateRecordChoice: undefined;
  InitialRecordForm:
    | {
        isRevision?: boolean;
        recordType?: 'medical' | 'dental' | 'both';
        isUpdate?: boolean;
      }
    | undefined;
};

const Stack = createNativeStackNavigator<UpdateRecordStackParamList>();

const HeaderMenuButton: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const navigation = useNavigation<any>();

  return (
    <TouchableOpacity
      style={[
        styles.headerMenuButton,
        { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' },
      ]}
      onPress={() => toggleAppDrawer(navigation)}
      accessibilityRole="button"
      accessibilityLabel="Open sidebar"
      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
    >
      <Ionicons
        name="menu"
        size={22}
        color={isDark ? colors.neutral[100] : colors.secondary[900]}
      />
    </TouchableOpacity>
  );
};

export const UpdateRecordStackNavigator: React.FC = () => {
  const { isDark } = useTheme();

  const sharedOptions = {
    headerShown: true,
    headerBackTitle: 'Back',
    headerStyle: {
      backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50],
    },
    headerTintColor: isDark ? colors.neutral[100] : colors.secondary[900],
    headerShadowVisible: false,
  };

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="UpdateRecordChoice"
        component={UpdateRecordChoiceScreen}
        options={{
          ...sharedOptions,
          title: 'Update Record',
          headerLeft: () => <HeaderMenuButton isDark={isDark} />,
        }}
      />
      <Stack.Screen
        name="InitialRecordForm"
        component={InitialRecordFormScreen}
        options={({ route }) => ({
          ...sharedOptions,
          title: route.params?.isUpdate ? 'Update Record' : 'Record Form',
          headerRight: () => <HeaderMenuButton isDark={isDark} />,
        })}
      />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  headerMenuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
});

export default UpdateRecordStackNavigator;