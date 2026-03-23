/**
 * Navigation type definitions for MDSystem Mobile
 */

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Appointments: undefined;
  HealthChat: undefined;
  Records: undefined;
  More: undefined;
};

export type MoreStackParamList = {
  MoreMenu: undefined;
  Profile: undefined;
  MedicineRequest: undefined;
  ChangePassword: undefined;
  LoginActivity: undefined;
  FAQs: undefined;
  ContactSupport: undefined;
  Feedback: undefined;
  InitialRecordForm: { isRevision?: boolean } | undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};
