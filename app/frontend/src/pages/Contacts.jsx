import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Users, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useRealtime } from '@/hooks/useWebSocket';
import { CONTACT_STATUSES } from '@/lib/constants';
import { initials, formatDate } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { PageLoader } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ContactFormDialog } from '@/components/forms/ContactFormDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/sonner';

const ALL = '__all__';

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(() => {
    const query = api.qs({ search, status: status === ALL ? '' : status });
    return api.get(`/contacts${query}`).then(setContacts).catch((e) => toast.error(e.message));
  }, [search, status]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  // Reload list when contacts change elsewhere.
  useRealtime(['contact.created', 'contact.updated', 'contact.deleted'], load);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(contact) {
    setEditing(contact);
    setFormOpen(true);
  }

  async function confirmDelete() {
    try {
      await api.del(`/contacts/${deleting.id}`);
      toast.success('Contact deleted');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Contacts" description="Manage the people in your network.">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> New contact
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-48"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {CONTACT_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <PageLoader />
      ) : contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No contacts found"
          description={search || status !== ALL ? 'Try adjusting your search or filters.' : 'Get started by adding your first contact.'}
          action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> New contact</Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Company</TableHead>
                <TableHead className="hidden lg:table-cell">Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden xl:table-cell">Added</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link to={`/contacts/${c.id}`} className="flex items-center gap-3 hover:underline">
                      <Avatar><AvatarFallback>{initials(c.first_name, c.last_name)}</AvatarFallback></Avatar>
                      <div>
                        <div className="font-medium">{c.first_name} {c.last_name}</div>
                        {c.job_title && <div className="text-xs text-muted-foreground">{c.job_title}</div>}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{c.company_name || '—'}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{c.email || '—'}</TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell className="hidden xl:table-cell text-muted-foreground">{formatDate(c.created_at)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleting(c)}>
                          <Trash2 className="h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <ContactFormDialog open={formOpen} onOpenChange={setFormOpen} contact={editing} onSaved={load} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="Delete contact?"
        description={deleting ? `This will permanently remove ${deleting.first_name} ${deleting.last_name}.` : ''}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
