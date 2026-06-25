import { useAuth } from '@/hooks/useAuth';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useTheme } from '@/hooks/useTheme';
import { initials } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

export default function Settings() {
  const { user, logout } = useAuth();
  const { connected } = useWebSocket();
  const { colorId, setColor, presets } = useTheme();

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your account and workspace." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your account information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 text-base">
                <AvatarFallback>{initials(user?.name?.split(' ')[0], user?.name?.split(' ')[1])}</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-semibold">{user?.name}</div>
                <div className="text-sm text-muted-foreground capitalize">{user?.role}</div>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={user?.name || ''} readOnly />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ''} readOnly />
            </div>
            <Button variant="outline" onClick={logout}>Log out</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
            <CardDescription>Status of your Nimbus CRM workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Real-time connection</span>
              <span className="flex items-center gap-2 font-medium">
                <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Version</span>
              <span className="font-medium">1.0.0</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Database</span>
              <span className="font-medium">SQLite</span>
            </div>
            <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              This is a demo workspace. A second user (rep@crm.test / sales123) is also available for testing real-time
              updates across sessions.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Choose the primary color used across the app.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {presets.map((preset) => {
                const selected = preset.id === colorId;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setColor(preset.id)}
                    aria-pressed={selected}
                    title={preset.name}
                    className={`flex h-10 w-10 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      selected ? 'ring-2 ring-ring' : 'ring-1 ring-border hover:scale-105'
                    }`}
                    style={{ backgroundColor: `hsl(${preset.primary})` }}
                  >
                    {selected && (
                      <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                    <span className="sr-only">{preset.name}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Your selection is saved to this browser and applied instantly.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
