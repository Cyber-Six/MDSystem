import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RecordsStackParamList } from './types';
import { RecordsScreen } from '../screens/records/RecordsScreen';
import UpdateRecordChoiceScreen from '../screens/record-forms/UpdateRecordChoiceScreen';
import InitialRecordFormScreen from '../screens/record-forms/InitialRecordFormScreen';

const Stack = createNativeStackNavigator<RecordsStackParamList>();

type RecordsStackNavigatorProps = {
  route?: {
    params?: {
      screen?: string;
      params?: RecordsStackParamList['InitialRecordForm'];
    };
  };
};

export const RecordsStackNavigator: React.FC<RecordsStackNavigatorProps> = ({ route }) => {
  const requestedInitialScreen = route?.params?.screen;
  const initialRouteName: keyof RecordsStackParamList =
    requestedInitialScreen === 'InitialRecordForm' || requestedInitialScreen === 'UpdateRecordChoice'
      ? requestedInitialScreen
      : 'RecordsHome';
  const initialRecordFormParams = requestedInitialScreen === 'InitialRecordForm'
    ? route?.params?.params
    : undefined;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRouteName}>
      <Stack.Screen name="RecordsHome" component={RecordsScreen} />
      <Stack.Screen name="UpdateRecordChoice" component={UpdateRecordChoiceScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="InitialRecordForm"
        component={InitialRecordFormScreen}
        initialParams={initialRecordFormParams}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default RecordsStackNavigator;
