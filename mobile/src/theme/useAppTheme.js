// src/theme/useAppTheme.js
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTheme } from './Theme';

export function useAppTheme() {
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('user_theme')
      .then((savedTheme) => {
        if (savedTheme !== null) {
          setIsDarkMode(savedTheme === 'dark');
        }
      })
      .catch(() => {});
  }, []);

  const toggleTheme = useCallback((val) => {
    const nextVal = typeof val === 'boolean' ? val : !isDarkMode;
    setIsDarkMode(nextVal);
    AsyncStorage.setItem('user_theme', nextVal ? 'dark' : 'light').catch(() => {});
  }, [isDarkMode]);

  const theme = getTheme(isDarkMode);

  return {
    isDarkMode,
    theme,
    toggleTheme,
  };
}
export default useAppTheme;
