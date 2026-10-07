import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Settings, User } from 'lucide-react';

import { cn } from '../../utils/cn';
import { roleLabel } from '../../utils/constants';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Avatar } from '../ui/Avatar';
import { Dropdown } from '../ui/Dropdown';

/** Account menu with the signed-in identity and the sign-out action. */
export function UserMenu() {
  const { user, signOut } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    await signOut();
    toast.success('Your session has ended.');
    navigate('/login', { replace: true });
  }, [signOut, toast, navigate]);

  if (!user) return null;

  return (
    <div className="relative">
      <Dropdown
        width="w-60"
        buttonLabel="Account menu"
        trigger={
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-lg p-0.5 pr-1.5 transition hover:bg-sunken',
              signingOut && 'opacity-60',
            )}
          >
            <Avatar name={user.name} src={user.avatar_url} size="sm" status={user.status} />
            <span className="hidden min-w-0 text-left sm:block">
              <span className="block max-w-32 truncate text-xs font-medium text-ink">{user.name}</span>
              <span className="block text-2xs text-ink-subtle">{roleLabel(user.role_name)}</span>
            </span>
          </span>
        }
        items={[
          {
            label: 'Your profile',
            icon: User,
            onClick: () => navigate('/app/profile'),
          },
          {
            label: 'Settings',
            icon: Settings,
            onClick: () => navigate('/app/settings'),
          },
          { separator: true },
          {
            label: signingOut ? 'Signing out…' : 'Sign out',
            icon: LogOut,
            danger: true,
            onClick: handleSignOut,
          },
        ]}
      />
    </div>
  );
}