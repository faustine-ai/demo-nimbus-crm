import { useAuth } from '@/hooks/useAuth';
import { useWebSocket } from '@/hooks/useWebSocket';
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
      </div>
    </div>
  );
}
