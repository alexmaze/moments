import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, UserPlus, UserX, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/api/admin.api';
import { useAuthStore } from '@/store/auth.store';

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? 'bg-primary' : 'bg-muted'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function SettingsSkeleton() {
  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-6 animate-pulse">
      <div className="h-6 w-32 bg-muted rounded mb-4" />
      <div className="h-5 w-48 bg-muted rounded mb-2" />
      <div className="h-4 w-64 bg-muted rounded" />
    </div>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.currentUser);

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: adminApi.getSettings,
  });

  const registrationMutation = useMutation({
    mutationFn: (open: boolean) => adminApi.setRegistrationOpen(open),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      toast.success('Registration setting updated');
    },
    onError: () => {
      toast.error('Failed to update registration setting');
    },
  });

  const isRegistrationOpen = settings?.registration_open === 'true';

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Failed to load settings</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground mb-6">Settings</h1>

      <div className="space-y-6">
        {isLoading ? (
          <SettingsSkeleton />
        ) : (
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Settings className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-lg font-medium text-foreground">Registration</h2>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {isRegistrationOpen ? 'Open' : 'Closed'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isRegistrationOpen
                    ? 'New users can create accounts'
                    : 'New user registration is disabled'}
                </p>
              </div>
              <Toggle
                checked={isRegistrationOpen}
                onChange={(checked) => registrationMutation.mutate(checked)}
                disabled={registrationMutation.isPending}
              />
            </div>

            {registrationMutation.isPending && (
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Updating...</span>
              </div>
            )}
          </div>
        )}

        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-500/10">
              {isRegistrationOpen ? (
                <UserPlus className="w-5 h-5 text-blue-500" />
              ) : (
                <UserX className="w-5 h-5 text-blue-500" />
              )}
            </div>
            <h2 className="text-lg font-medium text-foreground">Current Admin</h2>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Username</span>
              <span className="text-sm font-medium text-foreground">{currentUser?.username}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Display Name</span>
              <span className="text-sm font-medium text-foreground">{currentUser?.displayName}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
