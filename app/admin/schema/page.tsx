// app/admin/schema/page.tsx

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, Check, Undo2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SchemaFieldRow {
  id: string;
  tableId: string;
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  validValues: string[] | null;
  marketingMeaning: string | null;
  reviewStatus: string;
}

interface SchemaTableRow {
  id: string;
  name: string;
  description: string | null;
  fields: SchemaFieldRow[];
}

type ReviewFilter = 'all' | 'draft';

export default function SchemaAdminPage() {
  const [tables, setTables] = useState<SchemaTableRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');

  // fieldId -> in-progress edit text (only present while text differs from saved value)
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [savingFieldId, setSavingFieldId] = useState<string | null>(null);
  const [statusFieldId, setStatusFieldId] = useState<string | null>(null);

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/schema-fields');
      if (!response.ok) throw new Error('Failed to fetch schema fields');
      const data: SchemaTableRow[] = await response.json();
      setTables(data);
      if (data.length > 0) {
        setActiveTableId(data[0].id);
        setSelectedFieldId(data[0].fields[0]?.id ?? null);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const activeTable = tables.find((t) => t.id === activeTableId) ?? null;
  const selectedField = activeTable?.fields.find((f) => f.id === selectedFieldId) ?? null;

  const draftCountByTable = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tables) {
      counts[t.id] = t.fields.filter((f) => f.reviewStatus === 'draft').length;
    }
    return counts;
  }, [tables]);

  const visibleFields = useMemo(() => {
    if (!activeTable) return [];
    let fields = activeTable.fields;
    if (reviewFilter === 'draft') fields = fields.filter((f) => f.reviewStatus === 'draft');
    if (search) fields = fields.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));
    return [...fields].sort((a, b) => {
      if (a.reviewStatus !== b.reviewStatus) return a.reviewStatus === 'draft' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [activeTable, search, reviewFilter]);

  const selectTable = (tableId: string) => {
    setActiveTableId(tableId);
    const table = tables.find((t) => t.id === tableId);
    setSelectedFieldId(table?.fields[0]?.id ?? null);
    setSearch('');
  };

  const updateFieldInState = (fieldId: string, updates: Partial<SchemaFieldRow>) => {
    setTables((prev) =>
      prev.map((t) => ({
        ...t,
        fields: t.fields.map((f) => (f.id === fieldId ? { ...f, ...updates } : f)),
      }))
    );
  };

  const handleSave = async (field: SchemaFieldRow) => {
    const newValue = edits[field.id];
    setSavingFieldId(field.id);
    try {
      const response = await fetch(`/api/schema-fields/${field.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketingMeaning: newValue }),
      });
      if (!response.ok) throw new Error('Failed to save');
      updateFieldInState(field.id, { marketingMeaning: newValue });
      setEdits((prev) => {
        const next = { ...prev };
        delete next[field.id];
        return next;
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingFieldId(null);
    }
  };

  const handleSetStatus = async (field: SchemaFieldRow, action: 'approve' | 'unapprove') => {
    setStatusFieldId(field.id);
    try {
      const response = await fetch(`/api/schema-fields/${field.id}/${action}`, { method: 'POST' });
      if (!response.ok) throw new Error(`Failed to ${action}`);
      updateFieldInState(field.id, { reviewStatus: action === 'approve' ? 'approved' : 'draft' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setStatusFieldId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {error && (
        <Alert variant="destructive" className="m-4 mb-0">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Tables */}
        <aside className="w-56 shrink-0 overflow-y-auto border-r p-4">
          <h1 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Schema Registry
          </h1>
          <p className="mb-4 mt-1 text-[11px] text-muted-foreground">
            Badge = fields needing review
          </p>
          <div className="space-y-1">
            {tables.map((table) => {
              const draftCount = draftCountByTable[table.id] ?? 0;
              return (
                <button
                  key={table.id}
                  onClick={() => selectTable(table.id)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
                    activeTableId === table.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <span>{table.name}</span>
                  {draftCount > 0 && (
                    <Badge
                      variant={activeTableId === table.id ? 'secondary' : 'outline'}
                      className="ml-2 shrink-0"
                      title={`${draftCount} field${draftCount === 1 ? '' : 's'} need review`}
                    >
                      {draftCount}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Field list */}
        <section className="flex w-[32rem] shrink-0 flex-col border-r">
          <div className="space-y-2 border-b p-3">
            <Input
              placeholder="Search fields..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={reviewFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setReviewFilter('all')}
                className="flex-1"
              >
                All
              </Button>
              <Button
                size="sm"
                variant={reviewFilter === 'draft' ? 'default' : 'outline'}
                onClick={() => setReviewFilter('draft')}
                className="flex-1"
              >
                Needs review
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {visibleFields.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">No fields match.</p>
            )}
            {visibleFields.map((field) => {
              const preview = edits[field.id] ?? field.marketingMeaning;
              return (
                <button
                  key={field.id}
                  onClick={() => setSelectedFieldId(field.id)}
                  className={cn(
                    'block w-full border-b px-3 py-2.5 text-left transition-colors',
                    selectedFieldId === field.id ? 'bg-accent' : 'hover:bg-accent/50'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-sm">{field.name}</span>
                    <Badge
                      variant={field.reviewStatus === 'approved' ? 'default' : 'secondary'}
                      className="shrink-0 text-[10px]"
                    >
                      {field.reviewStatus}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {preview || 'No marketing meaning set'}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Detail panel */}
        <main className="min-w-0 flex-1 overflow-y-auto p-6">
          {!selectedField && (
            <p className="text-sm text-muted-foreground">Select a field to view details.</p>
          )}

          {selectedField && (
            <FieldDetail
              key={selectedField.id}
              field={selectedField}
              editValue={edits[selectedField.id] ?? selectedField.marketingMeaning ?? ''}
              onChange={(value) =>
                setEdits((prev) => ({ ...prev, [selectedField.id]: value }))
              }
              isDirty={
                edits[selectedField.id] !== undefined &&
                edits[selectedField.id] !== (selectedField.marketingMeaning ?? '')
              }
              isSaving={savingFieldId === selectedField.id}
              isChangingStatus={statusFieldId === selectedField.id}
              onSave={() => handleSave(selectedField)}
              onApprove={() => handleSetStatus(selectedField, 'approve')}
              onUnapprove={() => handleSetStatus(selectedField, 'unapprove')}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function FieldDetail({
  field,
  editValue,
  onChange,
  isDirty,
  isSaving,
  isChangingStatus,
  onSave,
  onApprove,
  onUnapprove,
}: {
  field: SchemaFieldRow;
  editValue: string;
  onChange: (value: string) => void;
  isDirty: boolean;
  isSaving: boolean;
  isChangingStatus: boolean;
  onSave: () => void;
  onApprove: () => void;
  onUnapprove: () => void;
}) {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="font-mono text-lg">{field.name}</CardTitle>
          <div className="flex shrink-0 gap-1">
            <Badge variant="outline">{field.type}</Badge>
            {field.primaryKey && <Badge variant="outline">PK</Badge>}
            {!field.nullable && <Badge variant="outline">not null</Badge>}
            <Badge variant={field.reviewStatus === 'approved' ? 'default' : 'secondary'}>
              {field.reviewStatus}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {field.validValues && field.validValues.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Valid values
            </p>
            <div className="flex flex-wrap gap-1">
              {field.validValues.map((v) => (
                <span key={v} className="rounded border bg-muted px-2 py-0.5 font-mono text-[10px]">
                  {v}
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Marketing meaning
          </p>
          <Textarea
            value={editValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder="No marketing meaning set"
            rows={6}
          />
        </div>

        <div className="flex justify-end gap-2">
          {field.reviewStatus === 'draft' ? (
            <Button size="sm" variant="outline" onClick={onApprove} disabled={isChangingStatus}>
              {isChangingStatus ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="mr-2 h-3.5 w-3.5" />
              )}
              Approve
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={onUnapprove} disabled={isChangingStatus}>
              {isChangingStatus ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Undo2 className="mr-2 h-3.5 w-3.5" />
              )}
              Move to draft
            </Button>
          )}
          <Button size="sm" onClick={onSave} disabled={!isDirty || isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-2 h-3.5 w-3.5" />
            )}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
