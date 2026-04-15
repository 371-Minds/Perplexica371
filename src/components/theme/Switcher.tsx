'use client';
import { useTheme } from 'next-themes';
import Select from '../ui/Select';

type Theme = 'dark' | 'light' | 'system';

const ThemeSwitcher = ({ className }: { className?: string }) => {
  const { theme, setTheme } = useTheme();

  const handleThemeSwitch = (theme: Theme) => {
    setTheme(theme);
  };
  const selectedTheme = theme === 'light' ? 'light' : 'dark';

  return (
    <Select
      className={className}
      value={selectedTheme}
      onChange={(e) => handleThemeSwitch(e.target.value as Theme)}
      options={[
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
      ]}
    />
  );
};

export default ThemeSwitcher;
