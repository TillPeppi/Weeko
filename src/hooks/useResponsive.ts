import { useWindowDimensions } from 'react-native';

export interface Responsive {
  width: number;
  /** >= 768: show multi-column layouts */
  isTablet: boolean;
  /** >= 1024: full 7-day grid, wide paddings */
  isDesktop: boolean;
}

export function useResponsive(): Responsive {
  const { width } = useWindowDimensions();
  return {
    width,
    isTablet: width >= 768,
    isDesktop: width >= 1024,
  };
}
