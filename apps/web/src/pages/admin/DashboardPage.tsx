import { useQuery } from '@tanstack/react-query';
import { Users, FileText, MessageSquare, Heart, HardDrive, Database } from 'lucide-react';
import { adminApi, type AdminStats } from '@/api/admin.api';

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function formatStorage(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
}

function StatCard({ title, value, subtitle, icon: Icon, iconColor }: StatCardProps) {
  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${iconColor}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-6 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="mt-2 h-8 w-20 bg-muted rounded" />
          <div className="mt-1 h-4 w-16 bg-muted rounded" />
        </div>
        <div className="p-3 rounded-lg bg-muted">
          <div className="w-6 h-6 bg-muted-foreground/20 rounded" />
        </div>
      </div>
    </div>
  );
}

function StatsGrid({ stats }: { stats: AdminStats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <StatCard
        title="Total Users"
        value={formatNumber(stats.users.total)}
        subtitle={`+${formatNumber(stats.users.today)} today`}
        icon={Users}
        iconColor="bg-blue-500"
      />
      <StatCard
        title="Total Posts"
        value={formatNumber(stats.posts.total)}
        subtitle={`+${formatNumber(stats.posts.today)} today`}
        icon={FileText}
        iconColor="bg-green-500"
      />
      <StatCard
        title="Total Comments"
        value={formatNumber(stats.comments.total)}
        icon={MessageSquare}
        iconColor="bg-purple-500"
      />
      <StatCard
        title="Total Likes"
        value={formatNumber(stats.likes.total)}
        icon={Heart}
        iconColor="bg-red-500"
      />
      <StatCard
        title="Storage Used"
        value={formatStorage(stats.storage.totalBytes)}
        icon={HardDrive}
        iconColor="bg-amber-500"
      />
      <StatCard
        title="Database Size"
        value={formatStorage(stats.database.totalBytes)}
        icon={Database}
        iconColor="bg-cyan-500"
      />
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: adminApi.getStats,
  });

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Failed to load statistics</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground mb-6">Dashboard</h1>
      {isLoading ? <StatsSkeleton /> : stats && <StatsGrid stats={stats} />}
    </div>
  );
}
