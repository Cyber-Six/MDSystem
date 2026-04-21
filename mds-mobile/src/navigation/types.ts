/**
 * Navigation type definitions for MDSystem Mobile
 */

import { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type RecordsStackParamList = {
  RecordsHome: undefined;
  UpdateRecordChoice: undefined;
  InitialRecordForm: { isRevision?: boolean; recordType?: 'medical' | 'dental' | 'both'; isUpdate?: boolean } | undefined;
};

export type MoreStackParamList = {
  Profile: undefined;
  MedicineRequest: undefined;
  MyDocuments: undefined;
  ChangePassword: undefined;
  LoginActivity: undefined;
  FAQs: undefined;
  ContactSupport: undefined;
  Feedback: undefined;
  InitialRecordForm: { isRevision?: boolean; recordType?: 'medical' | 'dental' | 'both'; isUpdate?: boolean } | undefined;
  UpdateRecordChoice: undefined;
  Announcements: undefined;
  Settings: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Appointments: undefined;
  HealthChat: undefined;
  Medicine: undefined;
  Records: NavigatorScreenParams<RecordsStackParamList> | undefined;
};

export type AppDrawerParamList = {
  MainTabs: undefined;
  MoreStack: NavigatorScreenParams<MoreStackParamList> | undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};
