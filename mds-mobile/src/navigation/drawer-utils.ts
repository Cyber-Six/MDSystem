import { DrawerActions } from '@react-navigation/native';

type NavigationLike = {
  dispatch?: (action: any) => void;
  getParent?: () => NavigationLike | undefined;
  getState?: () => { type?: string } | undefined;
};

export const toggleAppDrawer = (navigation: NavigationLike | undefined) => {
  if (!navigation) return;

  let current: NavigationLike | undefined = navigation;
  while (current) {
    if (current.getState?.()?.type === 'drawer') {
      current.dispatch?.(DrawerActions.toggleDrawer());
      return;
    }
    current = current.getParent?.();
  }

  navigation.dispatch?.(DrawerActions.toggleDrawer());
};