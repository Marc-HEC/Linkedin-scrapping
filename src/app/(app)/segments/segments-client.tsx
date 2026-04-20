"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  createSegmentAction,
  updateSegmentAction,
  deleteSegmentAction,
  type Segment,
  type TagFilter,
} from "./actions";
import { previewMatchesAction } from "../campaigns/actions";

export function SegmentsClient({
  segments,
  availableTags,
}: {
  segments: Segment[];
  availableTags: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Segment | "new" | null>(null);

  function onSaved() {
    setEditing(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card className="border-muted bg-muted/30">
        <CardContent className="p-4 text-sm text-muted-foreground">
          Un <strong className="text-foreground">segment</strong> est une combinaison de tags sauvegardée.
          Utilise-le pour lancer une campagne ciblée en un clic, sans reconfigurer les tags à chaque fois.
        </CardContent>
      </Card>
      <div className="flex">
        <Button onClick={() => setEditing("new")}>+ Nouveau segment</Button>
      </div>

      {editing && (
        <SegmentForm
          initial={editing === "new" ? null : editing}
          availableTags={availableTags}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}

      {segments.length === 0 && !editing && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Aucun segment. Crée-en un pour sauvegarder tes combinaisons de tags.
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {segments.map((seg) => {
          const allTags = [
            ...seg.tag_filters.filter((f) => f.required),
            ...seg.tag_filters.filter((f) => !f.required),
          ];
          const campaignUrl = `/campaigns/new?tags=${allTags.map((f) => f.tag).join(",")}`;

          return (
            <Card key={seg.id}>
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0 space-y-1.5">
                  <div className="font-medium">{seg.name}</div>
                  {seg.description && (
                    <p className="text-sm text-muted-foreground">{seg.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {seg.tag_filters.map((f) => (
                      <Badge key={f.tag} variant={f.required ? "default" : "outline"} className="text-xs">
                        {f.tag}{!f.required && " (opt)"}
                      </Badge>
                    ))}
                    {seg.tag_filters.length === 0 && (
                      <span className="text-xs text-muted-foreground">Aucun tag</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="outline" onClick={() => setEditing(seg)}>
                    Éditer
                  </Button>
                  <Link
                    href={campaignUrl}
                    className="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Ouvre une nouvelle campagne avec ces tags pré-remplis"
                  >
                    Utiliser
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Supprimer "${seg.name}" ?`)) {
                        deleteSegmentAction(seg.id).then(onSaved);
                      }
                    }}
                  >×</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function SegmentForm({
  initial,
  availableTags,
  onClose,
  onSaved,
}: {
  initial: Segment | null;
  availableTags: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [filters, setFilters] = useState<TagFilter[]>(initial?.tag_filters ?? []);
  const [tagInput, setTagInput] = useState("");
  const [tagHighlight, setTagHighlight] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [contactCount, setContactCount] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(
    () =>
      availableTags
        .filter((t) => !filters.some((f) => f.tag === t) && t.toLowerCase().includes(tagInput.toLowerCase()))
        .slice(0, 8),
    [availableTags, filters, tagInput]
  );

  const requiredTags = useMemo(() => filters.filter((f) => f.required).map((f) => f.tag), [filters]);

  useEffect(() => {
    if (requiredTags.length === 0) { setContactCount(null); return; }
    const timer = setTimeout(() => {
      startTransition(async () => {
        const rows = await previewMatchesAction(requiredTags, 500);
        setContactCount(rows.length);
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [requiredTags]);

  useEffect(() => {
    if (tagHighlight >= 0 && suggestionsRef.current) {
      const item = suggestionsRef.current.children[tagHighlight] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [tagHighlight]);

  function addTag(raw: string) {
    const t = raw.trim();
    if (!t || filters.some((f) => f.tag === t)) return;
    setFilters([...filters, { tag: t, required: true }]);
    setTagInput("");
    setTagHighlight(-1);
  }

  async function save() {
    setSaving(true);
    const res = initial
      ? await updateSegmentAction(initial.id, name, description || null, filters)
      : await createSegmentAction(name, description || null, filters);
    setSaving(false);
    if (res.error) { alert(res.error); return; }
    onSaved();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initial ? "Éditer le segment" : "Nouveau segment"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Nom du segment (ex: CTOs SaaS France)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="Description (optionnel)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Tags de ciblage</p>
          {filters.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {filters.map((f) => (
                <div key={f.tag} className="flex items-center gap-0.5">
                  <Badge variant={f.required ? "default" : "outline"}>{f.tag}</Badge>
                  <button
                    type="button"
                    onClick={() => setFilters(filters.map((x) => x.tag === f.tag ? { ...x, required: !x.required } : x))}
                    className="rounded-sm border px-1 text-[10px] text-muted-foreground hover:bg-muted"
                    title="Basculer requis / optionnel"
                  >
                    {f.required ? "Requis" : "Opt"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilters(filters.filter((x) => x.tag !== f.tag))}
                    className="px-1 text-xs text-muted-foreground hover:text-destructive"
                  >×</button>
                </div>
              ))}
            </div>
          )}

          <div className="relative max-w-xs">
            <Input
              placeholder="Ajouter un tag…"
              value={tagInput}
              autoComplete="off"
              onChange={(e) => { setTagInput(e.target.value); setTagHighlight(-1); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setTagHighlight((i) => Math.min(i + 1, suggestions.length - 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setTagHighlight((i) => Math.max(i - 1, 0)); }
                else if (e.key === "Enter") { e.preventDefault(); if (tagHighlight >= 0) addTag(suggestions[tagHighlight]); else addTag(tagInput); }
                else if (e.key === "Escape") { setTagInput(""); setTagHighlight(-1); }
              }}
            />
            {tagInput && suggestions.length > 0 && (
              <div ref={suggestionsRef} className="absolute left-0 top-full z-10 mt-1 w-full rounded-md border bg-background shadow">
                {suggestions.map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addTag(s)}
                    onMouseEnter={() => setTagHighlight(i)}
                    className={`block w-full px-3 py-1.5 text-left text-sm ${i === tagHighlight ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}
                  >{s}</button>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Tags <strong>Requis</strong> filtrent strictement. Tags <strong>Opt</strong>ionnels boostent le score de priorité.
          </p>
        </div>

        {contactCount !== null && (
          <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
            <span className="font-semibold">{contactCount}</span> contact(s) matchent les tags requis
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={save} disabled={saving || !name || filters.length === 0}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
        </div>
      </CardContent>
    </Card>
  );
}
