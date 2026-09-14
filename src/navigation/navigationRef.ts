import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();

export function getActiveRouteName(): string {
  try {
    if (navigationRef.isReady()) {
      const route = navigationRef.getCurrentRoute();
      return route?.name || 'Home';
    }
  } catch (err) {
    console.warn('Errore lettura active route:', err);
  }
  return 'Home';
}

export function navigateSafely(name: string, params?: any) {
  try {
    if (navigationRef.isReady()) {
      (navigationRef as any).navigate(name, params);
    }
  } catch (err) {
    console.warn('Errore navigazione sicura:', err);
  }
}
