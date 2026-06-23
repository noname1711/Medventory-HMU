// Inter font family names (loaded in App.js).
// Use these instead of fontWeight so custom fonts render the correct weight
// on both iOS and Android (each weight is a distinct family).
export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  black: 'Inter_900Black',
};

// Require each weight's .ttf directly (NOT via the package index, which
// re-exports all 36 variants incl. italics and bloats/breaks the bundle).
export const Inter_400Regular = require('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf');
export const Inter_500Medium = require('@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf');
export const Inter_600SemiBold = require('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf');
export const Inter_700Bold = require('@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf');
export const Inter_800ExtraBold = require('@expo-google-fonts/inter/800ExtraBold/Inter_800ExtraBold.ttf');
export const Inter_900Black = require('@expo-google-fonts/inter/900Black/Inter_900Black.ttf');
