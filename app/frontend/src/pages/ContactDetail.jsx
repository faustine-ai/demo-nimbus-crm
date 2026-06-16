import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Briefcase, Building2, Pencil, Trash2, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useRealtime } from '@/hooks/useWebSocket';
import { initials, formatCurrency, formatDate } from '@/lib/format';
import { PageLoader } from '@/components/Spinner';
import { StatusBadge, StageBadge } from '@/components/StatusBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ContactFormDialog } from '@/components/forms/ContactFormDialog';
import { TaskFormDialog } from '@/components/forms/TaskFormDialog';
import { NotesPanel } from '@/components/NotesPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/sonner';

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground w-24">{label}</span>
      <span className="text-sm font-medium">{value || '—'}</span>
    </div>
  );
}

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(() => {
    return api.get(`/contacts/${id}`).then(setContact).catch(() => setContact(null));
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  useRealtime(['contact.updated', 'deal.updated', 'deal.created', 'deal.deleted'], (msg) => {
    if (msg.type === 'contact.updated' && msg.payload.id !== Number(id)) return;
    load();
  });

  async function confirmDelete() {
    try {
      await api.del(`/contacts/${id}`);
      toast.success('Contact deleted');
      navigate('/contacts');
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (loading) return <PageLoader />;
  if (!contact) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Contact not found.</p>
        <Button variant="outline" className="mt-4" asChild><Link to="/contacts">Back to contacts</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
        <Link to="/contacts"><ArrowLeft className="h-4 w-4" /> Contacts</Link>
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 text-base">
            <AvatarFallback>{initials(contact.first_name, contact.last_name)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{contact.first_name} {contact.last_name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={contact.status} />
              {contact.company_name && <span className="text-sm text-muted-foreground">{contact.company_name}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /> Edit</Button>
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <InfoRow icon={Mail} label="Email" value={contact.email} />
              <Separator />
              <InfoRow icon={Phone} label="Phone" value={contact.phone} />
              <Separator />
              <InfoRow icon={Briefcase} label="Title" value={contact.job_title} />
              <Separator />
              <InfoRow
                icon={Building2}
                label="Company"
                value={contact.company_id ? <Link className="text-primary hover:underline" to={`/companies/${contact.company_id}`}>{contact.company_name}</Link> : '—'}
              />
              <Separator />
              <InfoRow icon={Briefcase} label="Added" value={formatDate(contact.created_at)} />
            </CardContent>
          </Card>

          {contact.notes && (
            <Card>
              <CardHeader><CardTitle>About</CardTitle></CardHeader>
              <CardContent className="pt-0 text-sm text-muted-foreground whitespace-pre-wrap">{contact.notes}</CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Deals</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {contact.deals?.length ? (
                <div className="space-y-2">
                  {contact.deals.map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <div className="font-medium text-sm">{d.name}</div>
                        <div className="text-xs text-muted-foreground">{formatCurrency(d.value)}</div>
                      </div>
                      <StageBadge stage={d.stage_name || d.stage} type={d.stage_type} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No deals linked to this contact.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Notes & Activity</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setTaskOpen(true)}><Plus className="h-4 w-4" /> Add task</Button>
            </CardHeader>
            <CardContent className="pt-0">
              <NotesPanel
                entityType="contact"
                entityId={contact.id}
                notes={contact.note_entries || []}
                onChange={(next) => setContact((c) => ({ ...c, note_entries: next }))}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <ContactFormDialog open={editOpen} onOpenChange={setEditOpen} contact={contact} onSaved={load} />
      <TaskFormDialog open={taskOpen} onOpenChange={setTaskOpen} link={{ type: 'contact', id: contact.id }} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete contact?"
        description={`This will permanently remove ${contact.first_name} ${contact.last_name}.`}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
