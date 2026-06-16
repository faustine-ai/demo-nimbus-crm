import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Users, Building2, Briefcase, TrendingUp, Trophy, XCircle, CheckSquare, Activity, Receipt, Wallet, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '@/lib/api';
import { useRealtime } from '@/hooks/useWebSocket';
import { formatCurrency, formatRelative } from '@/lib/format';
import { stageTypeMeta } from '@/lib/constants';
import { PageHeader } from '@/components/PageHeader';
import { PageLoader } from '@/components/Spinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function StatCard({ icon: Icon, label, value, sub, to, accent }) {
  const body = (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-bold tracking-tight">{value}</div>
          <div className="text-sm text-muted-foreground">{label}</div>
          {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(() => api.get('/dashboard').then(setStats).catch(() => {}), []);
  const loadActivities = useCallback(() => api.get('/activities?limit=12').then(setActivities).catch(() => {}), []);

  useEffect(() => {
    Promise.all([loadStats(), loadActivities()]).finally(() => setLoading(false));
  }, [loadStats, loadActivities]);

  // Live updates: refresh stats on any entity change, prepend new activities.
  useRealtime(
    ['contact.created', 'contact.deleted', 'company.created', 'company.deleted', 'deal.created', 'deal.updated', 'deal.deleted', 'task.created', 'task.updated', 'invoice.created', 'invoice.updated', 'invoice.deleted'],
    loadStats
  );
  useRealtime('activity.created', (msg) => {
    setActivities((prev) => [msg.payload, ...prev].slice(0, 12));
  });

  if (loading || !stats) return <PageLoader />;

  const chartData = (stats.stages || []).map((s) => ({
    name: s.name,
    value: s.count || 0,
    fill: stageTypeMeta(s.type).dot,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="A quick overview of your sales activity." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Contacts" value={stats.totalContacts} to="/contacts" accent="bg-blue-100 text-blue-600" />
        <StatCard icon={Building2} label="Companies" value={stats.totalCompanies} to="/companies" accent="bg-violet-100 text-violet-600" />
        <StatCard icon={Briefcase} label="Total deals" value={stats.totalDeals} to="/deals" accent="bg-indigo-100 text-indigo-600" />
        <StatCard icon={CheckSquare} label="Open tasks" value={stats.openTasks} to="/tasks" accent="bg-amber-100 text-amber-600" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={TrendingUp} label="Open deals" value={stats.openDeals} sub={formatCurrency(stats.openValue)} accent="bg-sky-100 text-sky-600" />
        <StatCard icon={Trophy} label="Won deals" value={stats.wonDeals} sub={formatCurrency(stats.wonValue)} accent="bg-emerald-100 text-emerald-600" />
        <StatCard icon={XCircle} label="Lost deals" value={stats.lostDeals} accent="bg-rose-100 text-rose-600" />
        <StatCard
          icon={Activity}
          label="Win rate"
          value={`${stats.wonDeals + stats.lostDeals > 0 ? Math.round((stats.wonDeals / (stats.wonDeals + stats.lostDeals)) * 100) : 0}%`}
          accent="bg-teal-100 text-teal-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Receipt} label="Outstanding" value={formatCurrency(stats.invoiceOutstanding || 0)} to="/invoices" accent="bg-amber-100 text-amber-600" />
        <StatCard icon={Wallet} label="Paid invoices" value={formatCurrency(stats.invoicePaid || 0)} to="/invoices" accent="bg-emerald-100 text-emerald-600" />
        <StatCard icon={FileText} label="Invoices" value={stats.invoiceCount || 0} to="/invoices" accent="bg-violet-100 text-violet-600" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Pipeline chart */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>{stats.pipelineName ? `${stats.pipelineName} — by stage` : 'Pipeline by stage'}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(99,102,241,0.06)' }} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={56}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Activity feed */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="space-y-4">
                {activities.map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <div>
                      <p className="text-sm text-foreground">{a.message}</p>
                      <p className="text-xs text-muted-foreground">{formatRelative(a.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
