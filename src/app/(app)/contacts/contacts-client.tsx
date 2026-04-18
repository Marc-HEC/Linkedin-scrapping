"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  createContactAction,
  updateContactTagsAction,
  deleteContactAction,
  importContactsCsvAction,
} from "./actions";

type Contact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  linkedin_url: string | null;
  company_name: string | null;
  role: string | null;
  tags: string[];
};

export function ContactsClient({
  contacts,
  knownTags,
}: {
  contacts: Contact[];
  knownTags: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);

  async function handleAdd(fd: FormData) {
    const res = await createContactAction(fd);
    if (!res.error) setShowAdd(false);
    else alert(res.error);
  }

  async function handleImport() {
    const res = await importContactsCsvAction(csvText);
    if (res.error) setImportMsg(`Erreur : ${res.error}`);
    else {
      setImportMsg(`${res.imported} contact(s) importé(s).`);
      setCsvText("");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={() => setShowAdd((v) => !v)}>+ Ajouter un contact</Button>
        <Button variant="outline" onClick={() => setShowImport((v) => !v)}>
          Importer un CSV
        </Button>
        {knownTags.length > 0 && (
          <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            Tags existants :
            {knownTags.slice(0, 8).map((t) => (
              <Badge key={t} variant="outline">{t}</Badge>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <Card>
          <CardHeader><CardTitle>Nouveau contact</CardTitle></CardHeader>
          <CardContent>
            <form action={handleAdd} className="grid grid-cols-2 gap-3">
              <Input name="first_name" placeholder="Prénom" />
              <Input name="last_name" placeholder="Nom" />
              <Input name="email" type="email" placeholder="Email" />
              <Input name="linkedin_url" placeholder="URL LinkedIn (https://...)" />
              <Input name="company_name" placeholder="Entreprise" />
              <Input name="role" placeholder="Rôle / poste" />
              <Input name="tags" className="col-span-2" placeholder="Tags (séparés par virgules) — ex: CTO, SaaS, France" />
              <div className="col-span-2 flex gap-2">
                <Button type="submit">Enregistrer</Button>
                <Button type="button" variant="ghost" onClick={() => setShowAdd(false)}>Annuler</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {showImport && (
        <Card>
          <CardHeader>
            <CardTitle>Import CSV</CardTitle>
            <p className="text-xs text-muted-foreground">
              Colonnes reconnues : prenom, nom, email, entreprise, role, linkedin, tags (séparés par <code>;</code> ou <code>|</code>).
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            <Textarea
              rows={8}
              placeholder={"prenom,nom,email,entreprise,role,tags\nMarie,Durand,marie@acme.io,Acme,CTO,CTO;SaaS;France"}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
            {importMsg && <p className="text-sm">{importMsg}</p>}
            <div className="flex gap-2">
              <Button onClick={() => startTransition(handleImport)} disabled={isPending || !csvText.trim()}>
                Importer
              </Button>
              <Button variant="ghost" onClick={() => setShowImport(false)}>Fermer</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {contacts.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              Aucun contact. Ajoute-en un ou importe un CSV.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Contact</th>
                  <th className="px-4 py-2 font-medium">Entreprise / Rôle</th>
                  <th className="px-4 py-2 font-medium">Tags</th>
                  <th className="px-4 py-2 font-medium w-8"></th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <ContactRow key={c.id} contact={c} knownTags={knownTags} />
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ContactRow({ contact, knownTags }: { contact: Contact; knownTags: string[] }) {
  const [tags, setTags] = useState<string[]>(contact.tags ?? []);
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState(false);

  async function commit(next: string[]) {
    setTags(next);
    await updateContactTagsAction(contact.id, next);
  }
  function addTag(raw: string) {
    const t = raw.trim();
    if (!t || tags.includes(t)) return;
    commit([...tags, t]);
    setInput("");
  }

  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "—";
  const suggestions = knownTags.filter(
    (t) => !tags.includes(t) && t.toLowerCase().includes(input.toLowerCase())
  ).slice(0, 5);

  return (
    <tr className="border-b last:border-0 align-top">
      <td className="px-4 py-3">
        <div className="font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">
          {contact.email || contact.linkedin_url || "—"}
        </div>
      </td>
      <td className="px-4 py-3">
        <div>{contact.company_name || "—"}</div>
        <div className="text-xs text-muted-foreground">{contact.role || ""}</div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1">
          {tags.map((t) => (
            <Badge key={t} variant="secondary">
              {t}
              <button
                type="button"
                className="ml-1 text-xs opacity-60 hover:opacity-100"
                onClick={() => commit(tags.filter((x) => x !== t))}
              >×</button>
            </Badge>
          ))}
          {editing ? (
            <div className="relative">
              <input
                autoFocus
                className="h-7 rounded-md border px-2 text-xs"
                placeholder="tag…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addTag(input); }
                  if (e.key === "Escape") { setEditing(false); setInput(""); }
                }}
                onBlur={() => setTimeout(() => setEditing(false), 150)}
              />
              {input && suggestions.length > 0 && (
                <div className="absolute left-0 top-full z-10 mt-1 w-40 rounded-md border bg-background shadow">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="block w-full px-2 py-1 text-left text-xs hover:bg-muted"
                      onMouseDown={(e) => { e.preventDefault(); addTag(s); }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              + tag
            </button>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={() => {
            if (confirm("Supprimer ce contact ?")) deleteContactAction(contact.id);
          }}
          className="text-muted-foreground hover:text-destructive"
          title="Supprimer"
        >×</button>
      </td>
    </tr>
  );
}
