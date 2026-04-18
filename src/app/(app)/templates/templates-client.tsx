"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { renderTemplate, extractVariables } from "@/lib/templating/render";
import { saveTemplateAction, deleteTemplateAction } from "./actions";
import type { TemplateRow } from "./page";

const CHANNEL_LABELS: Record<TemplateRow["channel"], string> = {
  email: "Email",
  linkedin_connect: "Invitation LinkedIn",
  linkedin_message: "Message LinkedIn",
};

const DEMO_CTX = {
  first_name: "Marie",
  last_name: "Durand",
  company_name: "Acme",
  role: "CTO",
  industry: "SaaS",
  email: "marie@acme.io",
};

export function TemplatesClient({ templates }: { templates: TemplateRow[] }) {
  const [editing, setEditing] = useState<TemplateRow | "new" | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex">
        <Button onClick={() => setEditing("new")}>+ Nouveau template</Button>
      </div>

      {editing && (
        <TemplateEditor
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {templates.map((t) => (
          <Card key={t.id}>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>{t.name}</CardTitle>
                <p className="text-xs text-muted-foreground">{CHANNEL_LABELS[t.channel]}</p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setEditing(t)}>Éditer</Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => confirm("Supprimer ?") && deleteTemplateAction(t.id)}
                >×</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {t.subject && <div className="text-sm font-medium">Objet : {t.subject}</div>}
              <pre className="whitespace-pre-wrap rounded bg-muted/50 p-2 text-xs">{t.body_text}</pre>
              <div className="flex flex-wrap gap-1">
                {t.variables_used.map((v) => (
                  <Badge key={v} variant="outline">[{v}]</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TemplateEditor({
  initial,
  onClose,
}: {
  initial: TemplateRow | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [channel, setChannel] = useState<TemplateRow["channel"]>(initial?.channel ?? "email");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [body, setBody] = useState(initial?.body_text ?? "");
  const [saving, setSaving] = useState(false);

  const vars = useMemo(() => extractVariables(body + " " + subject), [body, subject]);
  const preview = useMemo(() => renderTemplate(body, DEMO_CTX), [body]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData();
    if (initial?.id) fd.set("id", initial.id);
    fd.set("name", name);
    fd.set("channel", channel);
    fd.set("subject", subject);
    fd.set("body_text", body);
    const res = await saveTemplateAction(fd);
    setSaving(false);
    if (res.error) alert(res.error);
    else onClose();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initial ? "Éditer le template" : "Nouveau template"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <Input
              placeholder="Nom (ex: Cold email CTO SaaS)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as TemplateRow["channel"])}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="email">Email</option>
              <option value="linkedin_connect">Invitation LinkedIn (note 300 car.)</option>
              <option value="linkedin_message">Message LinkedIn</option>
            </select>
            {channel === "email" && (
              <Input
                placeholder="Objet (peut contenir des variables)"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            )}
            <Textarea
              rows={10}
              placeholder={"Bonjour [Prénom],\n\nJe vois que [NomEntreprise] se développe..."}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
            <div className="flex flex-wrap gap-1">
              <span className="text-xs text-muted-foreground">Variables détectées :</span>
              {vars.length === 0 && <span className="text-xs text-muted-foreground">aucune</span>}
              {vars.map((v) => (
                <Badge key={v} variant="outline">[{v}]</Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving || !name || !body}>
                {saving ? "Enregistrement…" : "Enregistrer"}
              </Button>
              <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-muted-foreground">
              Aperçu (ex: Marie Durand — CTO chez Acme)
            </div>
            {channel === "email" && subject && (
              <div className="mt-2 rounded-md border bg-muted/30 p-2 text-sm">
                <span className="text-xs text-muted-foreground">Objet :</span>{" "}
                <HighlightedText original={subject} />
              </div>
            )}
            <div className="mt-2 whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm">
              <HighlightedText original={body} />
            </div>
            {preview.missing.length > 0 && (
              <div className="mt-2 text-xs text-amber-700">
                Variables sans valeur démo : {preview.missing.map((m) => `[${m}]`).join(", ")}
              </div>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// Reconstruit le rendu segment par segment pour surligner les valeurs substituées.
function HighlightedText({ original }: { original: string }) {
  const MARK_OPEN = "\u0001";
  const MARK_CLOSE = "\u0002";
  const re = /(?<!\\)\[([^\]\n]+)\]/g;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(original)) !== null) {
    out += original.slice(last, m.index);
    const rendered = renderTemplate(m[0], DEMO_CTX);
    out += rendered.output === m[0] ? m[0] : `${MARK_OPEN}${rendered.output}${MARK_CLOSE}`;
    last = m.index + m[0].length;
  }
  out += original.slice(last);

  const parts = out.split(new RegExp(`${MARK_OPEN}|${MARK_CLOSE}`));
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded bg-yellow-200/60 px-0.5">{p}</mark>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}
