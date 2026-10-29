/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: '#182321',
    tint: '#D85D49',
    background: '#F5F4EF',
    foreground: '#182321',
    card: '#FFFFFF',
    cardForeground: '#182321',
    hero: '#182321',
    heroForeground: '#F4F1E8',
    primary: '#D85D49',
    primaryForeground: '#ffffff',
    secondary: '#E8EEE8',
    secondaryForeground: '#35443E',
    muted: '#ECECE6',
    mutedForeground: '#707B75',
    accent: '#D9EFE1',
    accentForeground: '#345748',
    destructive: '#C84943',
    destructiveForeground: '#FFFFFF',
    border: '#E6E6DE',
    input: '#E6E6DE',
  },
  dark: {
    text: '#F4F1E8',
    tint: '#F07B64',
    background: '#111A19',
    foreground: '#F4F1E8',
    card: '#1B2926',
    cardForeground: '#F4F1E8',
    hero: '#162521',
    heroForeground: '#F4F1E8',
    primary: '#F07B64',
    primaryForeground: '#201C19',
    secondary: '#263530',
    secondaryForeground: '#E1EAE3',
    muted: '#23312C',
    mutedForeground: '#A7B2AB',
    accent: '#294438',
    accentForeground: '#BDE5C9',
    destructive: '#F06E67',
    destructiveForeground: '#251413',
    border: '#33413B',
    input: '#33413B',
  },
  radius: 22,
};

export default colors;
