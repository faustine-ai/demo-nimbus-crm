import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Building2, MoreHorizontal, Pencil, Trash2, Globe, MapPin } from 'lucide-react';
import { api } from '@/lib/api';
import { useRealtime } from '@/hooks/useWebSocket';
import { PageHeader } from '@/components/PageHeader';
import { PageLoader } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CompanyFormDialog } from '@/components/forms/CompanyFormDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/sonner';

export default function Companies() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(() => {
    return api.get(`/companies${api.qs({ search })}`).then(setCompanies).catch((e) => toast.error(e.message));
  }, [search]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  useRealtime(['company.created', 'company.updated', 'company.deleted', 'contact.created', 'contact.deleted'], load);

  async function confirmDelete() {
    try {
      await api.del(`/companies/${deleting.id}`);
      toast.success('Company deleted');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Companies" description="The organizations you work with.">
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4" /> New company
        </Button>
      </PageHeader>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search companies…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <PageLoader />
      ) : companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No companies found"
          description={search ? 'Try a different search.' : 'Add your first company to get started.'}
          action={<Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" /> New company</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((c) => (
            <Card key={c.id} className="group transition-shadow hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <Link to={`/companies/${c.id}`} className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground font-semibold">
                      {c.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold leading-tight hover:underline">{c.name}</div>
                      {c.industry && <div className="text-xs text-muted-foreground">{c.industry}</div>}
                    </div>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEditing(c); setFormOpen(true); }}><Pencil className="h-4 w-4" /> Edit</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleting(c)}><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                  {c.location && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {c.location}</div>}
                  {c.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5" />
                      <a href={c.website} target="_blank" rel="noreferrer" className="truncate hover:text-primary" onClick={(e) => e.stopPropagation()}>
                        {c.website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <Badge className="bg-accent text-accent-foreground border-transparent">{c.contact_count} contact{c.contact_count === 1 ? '' : 's'}</Badge>
                  {c.size && <Badge className="bg-secondary text-secondary-foreground border-transparent">{c.size}</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CompanyFormDialog open={formOpen} onOpenChange={setFormOpen} company={editing} onSaved={load} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="Delete company?"
        description={deleting ? `This will permanently remove ${deleting.name}.` : ''}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
