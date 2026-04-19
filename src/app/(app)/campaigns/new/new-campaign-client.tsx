"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { renderTemplate } from "@/lib/templating/render";
import { previewMatchesAction, launchCampaignAction, type MatchedContact } from "../actions";
import type { TemplateLite } from "./page";

const CHANNEL_LABEL: Record<TemplateLite["channel"], string> = {
  email: "Email",
  linkedin_connect: "Invitation LinkedIn",
  linkedin_message: "Message LinkedIn",
};

export function NewCampaignClient({
  templates,
  availableTags,
}: {
  templates: TemplateLite[];
  availableTags: string[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState<string>(templates[0]?.id ?? "");
  const [tagsPriority, setTagsPriority] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [dailyQuota, setDailyQuota] = useState(30);
  const [throttle, setThrottle] = useState(45);
  const [preview, setPreview] = useState<MatchedContact[]>([]);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [launching, setLaunching] = useState(false);
  const [, startTransition] = useTransition();

  const tpl = templates.find((t) => t.id === templateId) ?? null;

  // Recalcule l'aperçu contacts à chaque changement de tags (debounced).
  useEffect(() => {
    if (tagsPriority.length === 0) { setPreview([]); return; }
    const timer = setTimeout(() => {
      startTransition(async () => {
        const rows = await previewMatchesAction(tagsPriority, 500);
        setPreview(rows);
        setPreviewIdx(0);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [tagsPriority]);

  const suggestions = useMemo(
    () => availableTags.filter((t) => !tagsPriority.includes(t) && t.toLowerCase().includes(tagInput.toLowerCase())).slice(0, 8),
    [availableTags, tagsPriority, tagInput]
  );

  const topContacts = preview.slice(0, 5);
  const currentContact = preview[previewIdx];
  const renderedSubject = currentContact && tpl?.subject
    ? renderTemplate(tpl.subject, flatten(currentContact)).output : null;
  const renderedBody = currentContact && tpl
    ? renderTemplate(tpl.body_text, flatten(currentContact)).output : null;

  function addTag(t: string) {
    const tag = t.trim();
    if (!tag || tagsPriority.includes(tag)) return;
    setTagsPriority([...tagsPriority, tag]);
    setTagInput("");
  }
  function removeTag(t: string) {
    setTagsPriority(tagsPriority.filter((x) => x !== t));
  }
  function move(idx: number, dir: -1 | 1) {
    const next = [...tagsPriority];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setTagsPriority(next);
  }

  async function launch() {
    if (!tpl) return;
    setLaunching(true);
    const res = await launchCampaignAction({
      name,
      templateId: tpl.id,
      tagsPriority,
      dailyQuota,
      throttleSeconds: throttle,
    });
    setLaunching(false);
    if (res.error) { alert(res.error); return; }
    // Redirige vers la page de révision (les messages sont générés par Mistral, pas encore envoyés)
    router.push(res.campaignId ? `/campaigns/${res.campaignId}` : "/campaigns");
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_480px]">
      {/* ===== Colonne gauche : formulaire ===== */}
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>1. Nom & Template</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Nom de la campagne (ex: Q2 CTOs SaaS France)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun template. Crée-en un sur la page Templates d&apos;abord.
              </p>
            ) : (
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {CHANNEL_LABEL[t.channel]}
                  </option>
                ))}
              </select>
            )}
            {tpl && tpl.variables_used.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <span className="text-xs text-muted-foreground">Variables utilisées :</span>
                {tpl.variables_used.map((v) => (
                  <Badge key={v} variant="outline">[{v}]</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Tags de ciblage</CardTitle>
            <p className="text-xs text-muted-foreground">
              L&apos;ordre = priorité. Les contacts ayant les tags les plus prioritaires sont envoyés en premier.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {tagsPriority.length > 0 && (
              <ol className="space-y-1.5">
                {tagsPriority.map((t, i) => (
                  <li key={t} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
                    <span className="w-6 text-xs font-semibold text-muted-foreground">#{i + 1}</span>
                    <Badge>{t}</Badge>
                    <div className="ml-auto flex gap-1">
                      <button
                        type="button"
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        className="px-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                        title="Monter"
                      >↑</button>
                      <button
                        type="button"
                        onClick={() => move(i, 1)}
                        disabled={i === tagsPriority.length - 1}
                        className="px-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                        title="Descendre"
                      >↓</button>
                      <button
                        type="button"
                        onClick={() => removeTag(t)}
                        className="px-1 text-xs text-muted-foreground hover:text-destructive"
                        title="Retirer"
                      >×</button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <div className="relative">
              <Input
                placeholder="Ajouter un tag (ex: CTO, SaaS, France)…"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); }
                }}
              />
              {tagInput && suggestions.length > 0 && (
                <div className="absolute left-0 top-full z-10 mt-1 w-full rounded-md border bg-background shadow">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => addTag(s)}
                      className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
                    >{s}</button>
                  ))}
                </div>
              )}
            </div>
            {availableTags.length > 0 && tagsPriority.length === 0 && (
              <div className="flex flex-wrap gap-1">
                <span className="text-xs text-muted-foreground">Tags existants :</span>
                {availableTags.slice(0, 10).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => addTag(t)}
                    className="text-xs text-primary hover:underline"
                  >{t}</button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>3. Cadence d&apos;envoi</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Quota journalier</span>
              <Input type="number" min={1} max={500} value={dailyQuota}
                onChange={(e) => setDailyQuota(+e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Délai entre envois (sec)</span>
              <Input type="number" min={0} max={600} value={throttle}
                onChange={(e) => setThrottle(+e.target.value)} />
            </label>
          </CardContent>
        </Card>

        <Button
          size="lg"
          disabled={launching || !name || !tpl || tagsPriority.length === 0 || preview.length === 0}
          onClick={launch}
        >
          {launching ? "Lancement…" : `Lancer la campagne (${Math.min(preview.length, dailyQuota)} messages)`}
        </Button>
      </div>

      {/* ===== Colonne droite : preview ===== */}
      <aside className="space-y-4 lg:sticky lg:top-6 lg:h-fit">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-semibold">
              {preview.length}{" "}
              <span className="text-sm font-normal text-muted-foreground">contacts ciblés</span>
            </div>
            {tagsPriority.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">Ajoute des tags pour voir l&apos;aperçu.</p>
            )}
          </CardContent>
        </Card>

        {topContacts.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Top 5 contacts</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {topContacts.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setPreviewIdx(i)}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left hover:bg-muted ${
                    i === previewIdx ? "bg-muted" : ""
                  }`}
                >
                  <div>
                    <div className="font-medium">
                      {c.first_name} {c.last_name} {c.company_name ? `· ${c.company_name}` : ""}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {c.tags.map((t) => (
                        <span
                          key={t}
                          className={`text-[10px] ${
                            tagsPriority.includes(t) ? "font-semibold text-primary" : "text-muted-foreground"
                          }`}
                        >#{t}</span>
                      ))}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {c.match_count}/{tagsPriority.length}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {currentContact && tpl && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">
                Aperçu — {currentContact.first_name} {currentContact.last_name}
              </CardTitle>
              <div className="flex items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setPreviewIdx(Math.max(0, previewIdx - 1))}
                  disabled={previewIdx === 0}
                  className="px-2 disabled:opacity-30"
                >←</button>
                <span>{previewIdx + 1}/{topContacts.length}</span>
                <button
                  type="button"
                  onClick={() => setPreviewIdx(Math.min(topContacts.length - 1, previewIdx + 1))}
                  disabled={previewIdx >= topContacts.length - 1}
                  className="px-2 disabled:opacity-30"
                >→</button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {renderedSubject && (
                <div className="rounded bg-muted/40 px-2 py-1 text-xs">
                  <span className="text-muted-foreground">Objet :</span> {renderedSubject}
                </div>
              )}
              <pre className="whitespace-pre-wrap font-sans">{renderedBody}</pre>
            </CardContent>
          </Card>
        )}
      </aside>
    </div>
  );
}

function flatten(c: MatchedContact): Record<string, unknown> {
  return {
    first_name: c.first_name,
    last_name: c.last_name,
    email: c.email,
    linkedin_url: c.linkedin_url,
    company_name: c.company_name,
    role: c.role,
    ...(c.custom_fields ?? {}),
  };
}
