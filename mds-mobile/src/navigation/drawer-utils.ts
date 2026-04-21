import { DrawerActions } from '@react-navigation/native';

type NavigationLike = {
  dispatch?: (action: any) => void;
  getParent?: () => NavigationLike | undefined;
  getState?: () => { type?: string } | undefined;
};

const findDrawerNavigation = (navigation: NavigationLike): NavigationLike | undefined => {
  let current: NavigationLike | undefined = navigation;
  while (current) {
    if (current.getState?.()?.type === 'drawer') {
      return current;
    }
    current = current.getParent?.();
  }
  return undefined;
};

const dispatchDrawerAction = (
  navigation: NavigationLike | undefined,
  createAction: () => any,
) => {
  if (!navigation) return;

  const drawerNavigation = findDrawerNavigation(navigation);
  const targetNavigation = drawerNavigation ?? navigation;
  targetNavigation.dispatch?.(createAction());
};

export const toggleAppDrawer = (navigation: NavigationLike | undefined) => {
  dispatchDrawerAction(navigation, DrawerActions.toggleDrawer);
};

export const openAppDrawer = (navigation: NavigationLike | undefined) => {
  dispatchDrawerAction(navigation, DrawerActions.openDrawer);
};