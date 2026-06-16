import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Globe, MapPin, Users2, Briefcase, Pencil, Trash2, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useRealtime } from '@/hooks/useWebSocket';
import { initials, formatCurrency } from '@/lib/format';
import { PageLoader } from '@/components/Spinner';
import { StatusBadge, StageBadge } from '@/components/StatusBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CompanyFormDialog } from '@/components/forms/CompanyFormDialog';
import { ContactFormDialog } from '@/components/forms/ContactFormDialog';
import { NotesPanel } from '@/components/NotesPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/sonner';

export default function CompanyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(() => api.get(`/companies/${id}`).then(setCompany).catch(() => setCompany(null)), [id]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  useRealtime(['company.updated', 'contact.created', 'contact.updated', 'contact.deleted', 'deal.created', 'deal.updated', 'deal.deleted'], load);

  async function confirmDelete() {
    try {
      await api.del(`/companies/${id}`);
      toast.success('Company deleted');
      navigate('/companies');
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (loading) return <PageLoader />;
  if (!company) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Company not found.</p>
        <Button variant="outline" className="mt-4" asChild><Link to="/companies">Back to companies</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
        <Link to="/companies"><ArrowLeft className="h-4 w-4" /> Companies</Link>
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent text-accent-foreground text-xl font-bold">
            {company.name[0]?.toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{company.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {company.industry && <span>{company.industry}</span>}
              {company.size && <Badge className="bg-secondary text-secondary-foreground border-transparent">{company.size}</Badge>}
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
            <CardContent className="space-y-3 pt-0 text-sm">
              {company.website && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Globe className="h-4 w-4" />
                  <a href={company.website} target="_blank" rel="noreferrer" className="hover:text-primary">{company.website.replace(/^https?:\/\//, '')}</a>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" /> {company.location || '—'}</div>
              <div className="flex items-center gap-2 text-muted-foreground"><Users2 className="h-4 w-4" /> {company.contacts?.length || 0} contacts</div>
              <div className="flex items-center gap-2 text-muted-foreground"><Briefcase className="h-4 w-4" /> {company.deals?.length || 0} deals</div>
            </CardContent>
          </Card>

          {company.notes && (
            <Card>
              <CardHeader><CardTitle>About</CardTitle></CardHeader>
              <CardContent className="pt-0 text-sm text-muted-foreground whitespace-pre-wrap">{company.notes}</CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Contacts</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setContactOpen(true)}><Plus className="h-4 w-4" /> Add contact</Button>
            </CardHeader>
            <CardContent className="pt-0">
              {company.contacts?.length ? (
                <div className="space-y-2">
                  {company.contacts.map((c) => (
                    <Link key={c.id} to={`/contacts/${c.id}`} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Avatar><AvatarFallback>{initials(c.first_name, c.last_name)}</AvatarFallback></Avatar>
                        <div>
                          <div className="font-medium text-sm">{c.first_name} {c.last_name}</div>
                          {c.job_title && <div className="text-xs text-muted-foreground">{c.job_title}</div>}
                        </div>
                      </div>
                      <StatusBadge status={c.status} />
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No contacts yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Deals</CardTitle></CardHeader>
            <CardContent className="pt-0">
              {company.deals?.length ? (
                <div className="space-y-2">
                  {company.deals.map((d) => (
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
                <p className="text-sm text-muted-foreground">No deals yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <NotesPanel
                entityType="company"
                entityId={company.id}
                notes={company.note_entries || []}
                onChange={(next) => setCompany((c) => ({ ...c, note_entries: next }))}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <CompanyFormDialog open={editOpen} onOpenChange={setEditOpen} company={company} onSaved={load} />
      <ContactFormDialog open={contactOpen} onOpenChange={setContactOpen} defaultCompanyId={company.id} onSaved={load} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete company?"
        description={`This will permanently remove ${company.name}.`}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
