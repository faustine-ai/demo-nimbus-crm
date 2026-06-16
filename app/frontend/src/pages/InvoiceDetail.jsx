import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, ChevronDown, Building2, User } from 'lucide-react';
import { api } from '@/lib/api';
import { useRealtime } from '@/hooks/useWebSocket';
import { INVOICE_STATUSES } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/format';
import { PageLoader } from '@/components/Spinner';
import { InvoiceStatusBadge } from '@/components/StatusBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { InvoiceFormDialog } from '@/components/forms/InvoiceFormDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/sonner';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(() => api.get(`/invoices/${id}`).then(setInvoice).catch(() => setInvoice(null)), [id]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  useRealtime(['invoice.updated', 'invoice.deleted'], (msg) => {
    if (msg.type === 'invoice.deleted' && msg.payload.id === Number(id)) return navigate('/invoices');
    load();
  });

  async function changeStatus(status) {
    try {
      await api.patch(`/invoices/${id}/status`, { status });
      toast.success(`Marked as ${status}`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function confirmDelete() {
    try {
      await api.del(`/invoices/${id}`);
      toast.success('Invoice deleted');
      navigate('/invoices');
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (loading) return <PageLoader />;
  if (!invoice) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Invoice not found.</p>
        <Button variant="outline" className="mt-4" asChild><Link to="/invoices">Back to invoices</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
          <Link to="/invoices"><ArrowLeft className="h-4 w-4" /> Invoices</Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Status <ChevronDown className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {INVOICE_STATUSES.map((s) => (
                <DropdownMenuItem key={s.value} onClick={() => changeStatus(s.value)} disabled={s.value === invoice.status}>
                  Mark as {s.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={() => window.print()}>Print</Button>
          <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /> Edit</Button>
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      {/* Invoice document */}
      <Card className="mx-auto max-w-3xl">
        <CardContent className="p-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">N</div>
              <div className="mt-2 text-sm text-muted-foreground">Nimbus CRM</div>
            </div>
            <div className="text-right">
              <h1 className="text-2xl font-bold tracking-tight">{invoice.number}</h1>
              <div className="mt-2"><InvoiceStatusBadge status={invoice.status} /></div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-6 text-sm">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bill to</div>
              {invoice.company ? (
                <Link to={`/companies/${invoice.company.id}`} className="mt-1 flex items-center gap-1.5 font-medium hover:text-primary print:text-foreground">
                  <Building2 className="h-4 w-4" /> {invoice.company.name}
                </Link>
              ) : <div className="mt-1 text-muted-foreground">—</div>}
              {invoice.contact && (
                <Link to={`/contacts/${invoice.contact.id}`} className="mt-1 flex items-center gap-1.5 text-muted-foreground hover:text-primary print:text-muted-foreground">
                  <User className="h-3.5 w-3.5" /> {invoice.contact.first_name} {invoice.contact.last_name}
                </Link>
              )}
              {invoice.contact?.email && <div className="text-muted-foreground">{invoice.contact.email}</div>}
            </div>
            <div className="text-right">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                <span className="text-muted-foreground">Issue date</span><span className="font-medium">{formatDate(invoice.issue_date)}</span>
                <span className="text-muted-foreground">Due date</span><span className="font-medium">{formatDate(invoice.due_date)}</span>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit price</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">{it.description}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{it.quantity}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(it.unit_price)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(it.quantity * it.unit_price)}</TableCell>
                  </TableRow>
                ))}
                {invoice.items.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No line items.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-6 flex justify-end">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCurrency(invoice.subtotal)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Tax ({invoice.tax_rate || 0}%)</span><span>{formatCurrency(invoice.tax)}</span></div>
              <div className="flex justify-between border-t pt-2 text-base font-bold text-foreground"><span>Total</span><span>{formatCurrency(invoice.total)}</span></div>
            </div>
          </div>

          {invoice.notes && (
            <div className="mt-8 border-t pt-4 text-sm">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</div>
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{invoice.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <InvoiceFormDialog open={editOpen} onOpenChange={setEditOpen} invoice={invoice} onSaved={load} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete invoice?"
        description={`This will permanently remove ${invoice.number}.`}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
