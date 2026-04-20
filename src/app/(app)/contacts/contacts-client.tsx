"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  createContactAction,
  updateContactAction,
  updateContactTagsAction,
  deleteContactAction,
  importContactsCsvAction,
  searchAndImportLinkedinContactsAction,
  searchAndImportWithUnipileAction,
  apolloSearchAndImportContactsAction,
  enrichMissingEmailsWithDropcontactAction,
} from "./actions";

type Providers = {
  linkedin: boolean;
  linkedinSearch: boolean;
  unipileSearch: boolean;
  apollo: boolean;
  dropcontact: boolean;
};

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
  providers,
}: {
  contacts: Contact[];
  knownTags: string[];
  providers: Providers;
}) {
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [showLinkedIn, setShowLinkedIn] = useState(false);
  const [showUnipile, setShowUnipile] = useState(false);
  const [showApollo, setShowApollo] = useState(false);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);
  const [enrichMsg, setEnrichMsg] = useState<string | null>(null);

  async function handleLinkedinSearch(fd: FormData) {
    setSearchMsg("Recherche en cours…");
    const res = await searchAndImportLinkedinContactsAction(fd);
    if (res.error) setSearchMsg(`Erreur : ${res.error}`);
    else setSearchMsg(`${res.imported} importé(s), ${res.skipped ?? 0} doublon(s).`);
  }

  async function handleUnipileSearch(fd: FormData) {
    setSearchMsg("Recherche Unipile en cours…");
    const res = await searchAndImportWithUnipileAction(fd);
    if (res.error) setSearchMsg(`Erreur : ${res.error}`);
    else setSearchMsg(`${res.imported} importé(s), ${res.skipped ?? 0} doublon(s).`);
  }

  async function handleApolloSearch(fd: FormData) {
    setSearchMsg("Recherche Apollo…");
    const res = await apolloSearchAndImportContactsAction(fd);
    if (res.error) setSearchMsg(`Erreur : ${res.error}`);
    else setSearchMsg(`${res.imported} importé(s), ${res.skipped ?? 0} doublon(s).`);
  }

  async function handleEnrich() {
    setEnrichMsg("Enrichissement en cours (jusqu'à 2 min)…");
    const res = await enrichMissingEmailsWithDropcontactAction();
    if (res.error) setEnrichMsg(`Erreur : ${res.error}`);
    else setEnrichMsg(res.message ?? `${res.enriched}/${res.total} contact(s) enrichi(s).`);
  }

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
        {providers.linkedinSearch && (
          <Button variant="outline" onClick={() => { setShowLinkedIn((v) => !v); setSearchMsg(null); }}>
            Rechercher sur LinkedIn
          </Button>
        )}
        {providers.unipileSearch && (
          <Button variant="outline" onClick={() => { setShowUnipile((v) => !v); setSearchMsg(null); }}>
            Rechercher via Unipile
          </Button>
        )}
        {providers.apollo && (
          <Button variant="outline" onClick={() => { setShowApollo((v) => !v); setSearchMsg(null); }}>
            Importer depuis Apollo
          </Button>
        )}
        {providers.dropcontact && (
          <Button
            variant="ghost"
            onClick={() => startTransition(handleEnrich)}
            disabled={isPending}
          >
            Enrichir emails (Dropcontact)
          </Button>
        )}
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

      {showLinkedIn && (
        <Card>
          <CardHeader>
            <CardTitle>Recherche LinkedIn (via OutX)</CardTitle>
            <p className="text-xs text-muted-foreground">
              Les profils trouvés seront créés en contacts (les doublons par URL LinkedIn sont ignorés).
            </p>
          </CardHeader>
          <CardContent>
            <form action={(fd) => startTransition(() => handleLinkedinSearch(fd))} className="grid grid-cols-2 gap-3">
              <Input name="keywords" placeholder="Mots-clés (ex: CTO SaaS France)" required className="col-span-2" />
              <Input name="title" placeholder="Titre (optionnel)" />
              <Input name="company" placeholder="Entreprise (optionnel)" />
              <Input name="location" placeholder="Localisation (optionnel)" />
              <Input name="limit" type="number" min={1} max={100} placeholder="Limite" defaultValue="25" />
              <div className="col-span-2 flex gap-2 items-center">
                <Button type="submit" disabled={isPending}>Rechercher</Button>
                <Button type="button" variant="ghost" onClick={() => setShowLinkedIn(false)}>Fermer</Button>
                {searchMsg && <span className="text-sm text-muted-foreground">{searchMsg}</span>}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {showUnipile && (
        <Card>
          <CardHeader>
            <CardTitle>Recherche LinkedIn (via Unipile)</CardTitle>
            <p className="text-xs text-muted-foreground">
              Recherche via ton compte LinkedIn connecté dans Unipile. Les doublons par URL sont ignorés.
            </p>
          </CardHeader>
          <CardContent>
            <form action={(fd) => startTransition(() => handleUnipileSearch(fd))} className="grid grid-cols-2 gap-3">
              <Input name="keywords" placeholder="Mots-clés (ex: CTO SaaS Paris)" required className="col-span-2" />
              <Input name="title" placeholder="Titre (optionnel)" />
              <Input name="company" placeholder="Entreprise (optionnel)" />
              <Input name="location" placeholder="Localisation (optionnel)" />
              <Input name="limit" type="number" min={1} max={100} placeholder="Limite" defaultValue="25" />
              <div className="col-span-2 flex gap-2 items-center">
                <Button type="submit" disabled={isPending}>Rechercher</Button>
                <Button type="button" variant="ghost" onClick={() => setShowUnipile(false)}>Fermer</Button>
                {searchMsg && <span className="text-sm text-muted-foreground">{searchMsg}</span>}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {showApollo && (
        <Card>
          <CardHeader>
            <CardTitle>Import depuis Apollo</CardTitle>
            <p className="text-xs text-muted-foreground">
              Recherche de leads B2B. Dédoublonne automatiquement sur email et URL LinkedIn.
            </p>
          </CardHeader>
          <CardContent>
            <form action={(fd) => startTransition(() => handleApolloSearch(fd))} className="grid grid-cols-2 gap-3">
              <Input name="keywords" placeholder="Mots-clés" required className="col-span-2" />
              <Input name="title" placeholder="Titre (ex: Head of Sales)" />
              <Input name="company" placeholder="Entreprise" />
              <Input name="location" placeholder="Localisation (ex: France)" />
              <Input name="limit" type="number" min={1} max={100} placeholder="Limite" defaultValue="25" />
              <div className="col-span-2 flex gap-2 items-center">
                <Button type="submit" disabled={isPending}>Importer</Button>
                <Button type="button" variant="ghost" onClick={() => setShowApollo(false)}>Fermer</Button>
                {searchMsg && <span className="text-sm text-muted-foreground">{searchMsg}</span>}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {enrichMsg && (
        <div className="rounded-md border border-muted bg-muted/30 px-3 py-2 text-sm">
          {enrichMsg}
        </div>
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
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const [editingFields, setEditingFields] = useState(false);
  const [firstName, setFirstName] = useState(contact.first_name ?? "");
  const [lastName, setLastName] = useState(contact.last_name ?? "");
  const [email, setEmail] = useState(contact.email ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(contact.linkedin_url ?? "");
  const [companyName, setCompanyName] = useState(contact.company_name ?? "");
  const [role, setRole] = useState(contact.role ?? "");
  const [saving, setSaving] = useState(false);

  async function saveFields() {
    setSaving(true);
    const res = await updateContactAction(contact.id, {
      first_name: firstName || null,
      last_name: lastName || null,
      email: email || null,
      linkedin_url: linkedinUrl || null,
      company_name: companyName || null,
      role: role || null,
    });
    setSaving(false);
    if (res.error) { alert(res.error); return; }
    setEditingFields(false);
  }

  useEffect(() => {
    if (highlightedIndex >= 0 && suggestionsRef.current) {
      const item = suggestionsRef.current.children[highlightedIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

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

  const name = [firstName, lastName].filter(Boolean).join(" ") || "—";
  const suggestions = knownTags.filter(
    (t) => !tags.includes(t) && t.toLowerCase().includes(input.toLowerCase())
  ).slice(0, 5);

  return (
    <>
    <tr className="border-b last:border-0 align-top">
      <td className="px-4 py-3">
        <div className="font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">
          {email || linkedinUrl || "—"}
        </div>
      </td>
      <td className="px-4 py-3">
        <div>{companyName || "—"}</div>
        <div className="text-xs text-muted-foreground">{role || ""}</div>
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
                autoComplete="off"
                className="h-7 rounded-md border px-2 text-xs"
                placeholder="tag…"
                value={input}
                onChange={(e) => { setInput(e.target.value); setHighlightedIndex(-1); }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1)); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); e.stopPropagation(); setHighlightedIndex((i) => Math.max(i - 1, 0)); }
                  else if (e.key === "Enter") { e.preventDefault(); if (highlightedIndex >= 0) { addTag(suggestions[highlightedIndex]); setHighlightedIndex(-1); } else addTag(input); }
                  else if (e.key === "Escape") { setEditing(false); setInput(""); setHighlightedIndex(-1); }
                }}
                onBlur={() => setTimeout(() => { setEditing(false); setHighlightedIndex(-1); }, 150)}
              />
              {input && suggestions.length > 0 && (
                <div ref={suggestionsRef} className="absolute left-0 top-full z-10 mt-1 w-40 rounded-md border bg-background shadow">
                  {suggestions.map((s, i) => (
                    <button
                      key={s}
                      type="button"
                      className={`block w-full px-2 py-1 text-left text-xs ${i === highlightedIndex ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}
                      onMouseEnter={() => setHighlightedIndex(i)}
                      onMouseDown={(e) => { e.preventDefault(); addTag(s); setHighlightedIndex(-1); }}
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
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setEditingFields((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground"
            title="Éditer"
          >✎</button>
          <button
            type="button"
            onClick={() => {
              if (confirm("Supprimer ce contact ?")) deleteContactAction(contact.id);
            }}
            className="text-muted-foreground hover:text-destructive"
            title="Supprimer"
          >×</button>
        </div>
      </td>
    </tr>
    {editingFields && (
      <tr className="border-b bg-muted/20">
        <td colSpan={4} className="px-4 py-3">
          <div className="grid grid-cols-3 gap-2">
            <Input placeholder="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <Input placeholder="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input placeholder="Entreprise" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            <Input placeholder="Rôle" value={role} onChange={(e) => setRole(e.target.value)} />
            <Input placeholder="URL LinkedIn" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} />
          </div>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={saveFields} disabled={saving}>{saving ? "…" : "Enregistrer"}</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingFields(false)}>Annuler</Button>
          </div>
        </td>
      </tr>
    )}
    </>
  );
}
