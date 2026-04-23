import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, UserX, UserCheck, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, type AdminUser } from '@/api/admin.api';

type StatusFilter = 'all' | 'active' | 'banned';

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', { page, pageSize, search, statusFilter }],
    queryFn: () =>
      adminApi.getUsers({
        page,
        pageSize,
        search: search || undefined,
        isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
      }),
  });

  const banMutation = useMutation({
    mutationFn: (userId: string) => adminApi.banUser(userId),
    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: ['admin', 'users'] });
      const previousData = queryClient.getQueryData(['admin', 'users', { page, pageSize, search, statusFilter }]);
      queryClient.setQueryData<typeof data>(
        ['admin', 'users', { page, pageSize, search, statusFilter }],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((user) =>
              user.id === userId ? { ...user, isActive: false } : user
            ),
          };
        }
      );
      return { previousData };
    },
    onError: () => {
      toast.error('Failed to ban user');
    },
    onSuccess: () => {
      toast.success('User banned');
    },
  });

  const unbanMutation = useMutation({
    mutationFn: (userId: string) => adminApi.unbanUser(userId),
    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: ['admin', 'users'] });
      const previousData = queryClient.getQueryData(['admin', 'users', { page, pageSize, search, statusFilter }]);
      queryClient.setQueryData<typeof data>(
        ['admin', 'users', { page, pageSize, search, statusFilter }],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((user) =>
              user.id === userId ? { ...user, isActive: true } : user
            ),
          };
        }
      );
      return { previousData };
    },
    onError: () => {
      toast.error('Failed to unban user');
    },
    onSuccess: () => {
      toast.success('User unbanned');
    },
  });

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Users</h1>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search by username or display name..."
              className="w-full pl-10 pr-4 py-2 border border-input rounded-lg bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Search
          </button>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as StatusFilter);
            setPage(1);
          }}
          className="px-4 py-2 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="banned">Banned</option>
        </select>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">User</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Registered</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              ) : data?.items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                    No users found
                  </td>
                </tr>
              ) : (
                data?.items.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    onBan={() => banMutation.mutate(user.id)}
                    onUnban={() => unbanMutation.mutate(user.id)}
                    isBanning={banMutation.isPending && banMutation.variables === user.id}
                    isUnbanning={unbanMutation.isPending && unbanMutation.variables === user.id}
                    formatDate={formatDate}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, data?.total ?? 0)} of {data?.total ?? 0} users
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-input bg-background text-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-secondary transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-muted-foreground px-2">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-input bg-background text-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-secondary transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UserRow({
  user,
  onBan,
  onUnban,
  isBanning,
  isUnbanning,
  formatDate,
}: {
  user: AdminUser;
  onBan: () => void;
  onUnban: () => void;
  isBanning: boolean;
  isUnbanning: boolean;
  formatDate: (date: string) => string;
}) {
  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-sm font-medium text-muted-foreground">
                {user.displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{user.displayName}</p>
            <p className="text-xs text-muted-foreground">@{user.username}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            user.isActive
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
          }`}
        >
          {user.isActive ? 'Active' : 'Banned'}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {formatDate(user.createdAt)}
      </td>
      <td className="px-4 py-3 text-right">
        {user.isActive ? (
          <button
            onClick={onBan}
            disabled={isBanning}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-destructive border border-destructive/30 rounded-lg hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isBanning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserX className="w-4 h-4" />
            )}
            Ban
          </button>
        ) : (
          <button
            onClick={onUnban}
            disabled={isUnbanning}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-600 dark:text-green-400 border border-green-600/30 dark:border-green-400/30 rounded-lg hover:bg-green-600/10 dark:hover:bg-green-400/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isUnbanning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserCheck className="w-4 h-4" />
            )}
            Unban
          </button>
        )}
      </td>
    </tr>
  );
}
