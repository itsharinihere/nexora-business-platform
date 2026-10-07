import { cn } from '../../utils/cn';
import { initialsOf } from '../../utils/formatters';

const SIZES = {
  xs: 'h-6 w-6 text-2xs',
  sm: 'h-7 w-7 text-2xs',
  md: 'h-9 w-9 text-xs',
  lg: 'h-11 w-11 text-sm',
  xl: 'h-14 w-14 text-base',
};

/**
 * Avatar. Renders `src` when the record has an image, otherwise a deterministic
 * colour derived from the name so the same person is always the same colour.
 */
export function Avatar({ name = '', src, size = 'md', status, className, ring = false }) {
  const style = { backgroundColor: `hsl(${hashHue(name)} 62% 46%)` };

  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span
        className={cn(
          'inline-flex items-center justify-center overflow-hidden rounded-full font-semibold text-white',
          SIZES[size],
          ring && 'ring-2 ring-surface',
        )}
        style={src ? undefined : style}
        aria-hidden="true"
      >
        {src ? <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" /> : initialsOf(name)}
      </span>
      {status ? (
        <span
          className={cn(
            'absolute bottom-0 right-0 block rounded-full ring-2 ring-surface',
            size === 'xs' || size === 'sm' ? 'h-1.5 w-1.5' : 'h-2.5 w-2.5',
            status === 'active' && 'bg-success-500',
            status === 'invited' && 'bg-info-500',
            status === 'inactive' && 'bg-ink-subtle',
          )}
        />
      ) : null}
      <span className="sr-only">{name}</span>
    </span>
  );
}

/** Overlapping avatars with a `+N` overflow chip. */
export function AvatarGroup({ people = [], max = 4, size = 'sm', className }) {
  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;

  return (
    <div className={cn('flex items-center -space-x-1.5', className)}>
      {shown.map((person, index) => (
        <Avatar
          key={person.id ?? index}
          name={person.name}
          src={person.avatar_url}
          size={size}
          ring
        />
      ))}
      {overflow > 0 ? (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-sunken font-semibold text-ink-muted ring-2 ring-surface',
            SIZES[size],
          )}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

function hashHue(seed = '') {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  return hash;
}