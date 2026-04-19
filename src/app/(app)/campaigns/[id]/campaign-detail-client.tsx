"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { markCampaignCompletedAction } from "../actions";

type Row = {
  id: string;
  subject: string | null;
  body: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
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
}: {
  campaignId: string;
  campaignStatus: string;
  rows: Row[];
  channel: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function completeCampaign() {
    startTransition(async () => {
      await markCampaignCompletedAction(campaignId);
      router.refresh();
    });
  }

  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-4">
      {campaignStatus !== "completed" && pendingCount === 0 && rows.length > 0 && (
        <Card>
          <CardContent className="flex items-center justify-between p-4 text-sm">
            <span>Tous les messages sont traités.</span>
            <Button size="sm" onClick={completeCampaign} disabled={isPending}>
              Clôturer la campagne
            </Button>
          </CardContent>
        </Card>
      )}

      {rows.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">
          Aucun message généré.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const name = row.contact
              ? [row.contact.first_name, row.contact.last_name].filter(Boolean).join(" ") || "—"
              : "Contact supprimé";
            const target = channel === "email"
              ? row.contact?.email
              : row.contact?.linkedin_url;
            return (
              <Card key={row.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">{name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {row.contact?.company_name ? `${row.contact.company_name} · ` : ""}
                        {target || "—"}
                      </div>
                    </div>
                    <StatusBadge status={row.status} />
                  </div>
                  {row.subject && (
                    <div className="text-xs"><span className="font-medium">Objet :</span> {row.subject}</div>
                  )}
                  <pre className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs">{row.body}</pre>
                  {row.error_message && (
                    <p className="text-xs text-destructive">Erreur : {row.error_message}</p>
                  )}
                  {row.sent_at && (
                    <p className="text-xs text-muted-foreground">
                      Envoyé {new Date(row.sent_at).toLocaleString("fr-FR")}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "sent" ? "secondary"
    : status === "failed" ? "destructive"
    : status === "skipped" ? "outline"
    : "default";
  return <Badge variant={variant}>{status}</Badge>;
}
