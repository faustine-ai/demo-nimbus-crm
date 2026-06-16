import { useEffect, useState, useCallback } from 'react';
import { Plus, CheckSquare, MoreHorizontal, Pencil, Trash2, Calendar, Link2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useRealtime } from '@/hooks/useWebSocket';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/PageHeader';
import { PageLoader } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import { PriorityBadge } from '@/components/StatusBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { TaskFormDialog } from '@/components/forms/TaskFormDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/sonner';

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(() => {
    const status = filter === 'all' ? '' : filter;
    return api.get(`/tasks${api.qs({ status })}`).then(setTasks).catch((e) => toast.error(e.message));
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  useRealtime(['task.created', 'task.updated', 'task.deleted'], load);

  async function toggle(task) {
    // Optimistic toggle.
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: task.completed ? 0 : 1 } : t)));
    try {
      await api.put(`/tasks/${task.id}`, { completed: !task.completed });
      if (!task.completed) toast.success('Task completed');
    } catch (err) {
      toast.error(err.message);
      load();
    }
  }

  async function confirmDelete() {
    try {
      await api.del(`/tasks/${deleting.id}`);
      toast.success('Task deleted');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const isOverdue = (t) => !t.completed && t.due_date && new Date(t.due_date) < new Date(new Date().toDateString());

  return (
    <div className="space-y-6">
      <PageHeader title="Tasks" description="Stay on top of your follow-ups.">
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" /> New task</Button>
      </PageHeader>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <PageLoader />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks here"
          description={filter === 'completed' ? 'Completed tasks will show up here.' : 'Create a task to track your next steps.'}
          action={<Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" /> New task</Button>}
        />
      ) : (
        <Card className="divide-y">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-3 p-4">
              <Checkbox checked={Boolean(task.completed)} onCheckedChange={() => toggle(task)} />
              <div className="min-w-0 flex-1">
                <div className={cn('font-medium', task.completed && 'text-muted-foreground line-through')}>{task.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {task.due_date && (
                    <span className={cn('flex items-center gap-1', isOverdue(task) && 'font-medium text-destructive')}>
                      <Calendar className="h-3 w-3" /> {formatDate(task.due_date)}
                    </span>
                  )}
                  {task.entity_label && (
                    <span className="flex items-center gap-1"><Link2 className="h-3 w-3" /> {task.entity_label}</span>
                  )}
                </div>
              </div>
              <PriorityBadge priority={task.priority} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => { setEditing(task); setFormOpen(true); }}><Pencil className="h-4 w-4" /> Edit</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleting(task)}><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </Card>
      )}

      <TaskFormDialog open={formOpen} onOpenChange={setFormOpen} task={editing} onSaved={load} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="Delete task?"
        description={deleting ? `This will permanently remove "${deleting.title}".` : ''}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
