import { Monitor, Moon, Sun } from 'lucide-react';

import { cn } from '../../utils/cn';
import { useTheme } from '../../context/ThemeContext';

const OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/** Three-way theme switch: explicit light, explicit dark, or follow the OS. */
export function ThemeToggle({ className }) {
  const { mode, setTheme } = useTheme();

  return (
    <div
      className={cn('inline-flex items-center gap-0.5 rounded-lg border border-line bg-sunken p-0.5', className)}
      role="group"
      aria-label="Colour theme"
    >
      {OPTIONS.map((option) => {
        const active = mode === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            aria-pressed={active}
            aria-label={option.label}
            title={option.label}
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded-[0.3rem] transition-colors',
              active ? 'bg-surface text-ink shadow-xs' : 'text-ink-subtle hover:text-ink',
            )}
          >
            <option.icon className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}