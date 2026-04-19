"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  confirmAndSendCampaignAction,
  regenerateMessageAction,
  updateMessageBodyAction,
  stopCampaignAction,
} from "../actions";

type Row = {
  id: string;
  subject: string | null;
  body: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  ai_refined: boolean;
  contact: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    linkedin_url: string | null;
    company_name: string | null;
  } | null;
};

export function CampaignDetailClient({
  campaignId,
  campaignStatus,
  rows,
  channel,
  hasMistral,
}: {
  campaignId: string;
  campaignStatus: string;
  rows: Row[];
  channel: string;
  hasMistral: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Local bodies: user can edit before confirming
  const [bodies, setBodies] = useState<Record<string, string>>(
    () => Object.fromEntries(rows.map((r) => [r.id, r.body]))
  );
  const [regenerating, setRegenerating] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  const isDraft = campaignStatus === "draft";
  const isSending = campaignStatus === "sending";

  useEffect(() => {
    if (!isSending) return;
    const id = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(id);
  }, [isSending, router]);

  async function handleRegenerate(rowId: string) {
    setRegenerating((r) => ({ ...r, [rowId]: true }));
    setFeedback(null);
    const res = await regenerateMessageAction(rowId);
    setRegenerating((r) => ({ ...r, [rowId]: false }));
    if (res.error) { setFeedback(`Erreur : ${res.error}`); return; }
    if (res.newBody) setBodies((b) => ({ ...b, [rowId]: res.newBody! }));
  }

  async function handleBodyBlur(rowId: string) {
    await updateMessageBodyAction(rowId, bodies[rowId] ?? "");
  }

  function handleConfirm() {
    startTransition(async () => {
      // Save any pending edits first
      await Promise.all(
        rows
          .filter((r) => r.status === "pending")
          .map((r) => updateMessageBodyAction(r.id, bodies[r.id] ?? ""))
      );
      const res = await confirmAndSendCampaignAction(campaignId);
      if (res.error) { setFeedback(`Erreur : ${res.error}`); return; }
      router.refresh();
    });
  }

  function handleStop() {
    if (!confirm("Arrêter la campagne ? Les messages non encore envoyés seront ignorés.")) return;
    startTransition(async () => {
      await stopCampaignAction(campaignId);
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">Aucun message généré.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ---- Bandeau Review (statut draft) ---- */}
      {isDraft && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <p className="font-semibold text-primary">Révision avant envoi</p>
              <p className="text-xs text-muted-foreground">
                {hasMistral
                  ? "Messages générés par Mistral AI. Édite ou régénère chaque message, puis confirme."
                  : "Messages préparés. Édite chaque texte si besoin, puis confirme l'envoi."}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="destructive" size="sm" onClick={handleStop} disabled={isPending}>
                Annuler
              </Button>
              <Button size="sm" onClick={handleConfirm} disabled={isPending}>
                {isPending ? "Envoi en cours…" : `Envoyer (${rows.filter(r => r.status === "pending").length} messages)`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---- Bandeau Stop (statut sending) ---- */}
      {isSending && (
        <Card className="border-orange-300/60 bg-orange-50/40">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium text-orange-800">Campagne en cours d'envoi…</p>
              <p className="text-xs text-muted-foreground">Les messages sont envoyés en arrière-plan selon le throttle configuré.</p>
            </div>
            <Button variant="destructive" size="sm" onClick={handleStop} disabled={isPending}>
              Arrêter la campagne
            </Button>
          </CardContent>
        </Card>
      )}

      {feedback && (
        <p className="text-sm text-destructive">{feedback}</p>
      )}

      {/* ---- Liste des messages ---- */}
      <div className="space-y-2">
        {rows.map((row) => {
          const name = row.contact
            ? [row.contact.first_name, row.contact.last_name].filter(Boolean).join(" ") || "—"
            : "Contact supprimé";
          const target = channel === "email" ? row.contact?.email : row.contact?.linkedin_url;
          const isRegen = regenerating[row.id] ?? false;

          return (
            <Card key={row.id}>
              <CardContent className="space-y-2 p-4">
                {/* Header contact */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {row.contact?.company_name ? `${row.contact.company_name} · ` : ""}
                      {target || "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {row.ai_refined && !isDraft && (
                      <span className="text-xs text-primary/60">✦ IA</span>
                    )}
                    {!isDraft && <StatusBadge status={row.status} />}
                  </div>
                </div>

                {/* Subject */}
                {row.subject && (
                  <div className="text-xs">
                    <span className="font-medium">Objet :</span> {row.subject}
                  </div>
                )}

                {/* Body — editable in review mode, read-only otherwise */}
                {isDraft && row.status === "pending" ? (
                  <Textarea
                    rows={6}
                    value={bodies[row.id] ?? ""}
                    onChange={(e) => setBodies((b) => ({ ...b, [row.id]: e.target.value }))}
                    onBlur={() => handleBodyBlur(row.id)}
                    className="text-xs font-mono resize-y"
                    disabled={isRegen}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs">{bodies[row.id] ?? row.body}</pre>
                )}

                {/* Regenerate button (review mode only, requires Mistral) */}
                {isDraft && row.status === "pending" && hasMistral && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRegenerate(row.id)}
                    disabled={isRegen || isPending}
                    className="h-7 text-xs"
                  >
                    {isRegen ? "Génération…" : "🔄 Régénérer"}
                  </Button>
                )}

                {/* Errors / sent_at (non-review) */}
                {!isDraft && row.error_message && (
                  <p className="text-xs text-destructive">Erreur : {row.error_message}</p>
                )}
                {!isDraft && row.sent_at && (
                  <p className="text-xs text-muted-foreground">
                    Envoyé {new Date(row.sent_at).toLocaleString("fr-FR")}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Bouton confirm bas de page (review) */}
      {isDraft && rows.filter(r => r.status === "pending").length > 0 && (
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="destructive" size="sm" onClick={handleStop} disabled={isPending}>
            Annuler la campagne
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Envoi en cours…" : "Confirmer et envoyer"}
          </Button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "sent" ? "secondary"
    : status === "failed" ? "destructive"
    : status === "skipped" || status === "cancelled" ? "outline"
    : "default";
  return <Badge variant={variant}>{status}</Badge>;
}
