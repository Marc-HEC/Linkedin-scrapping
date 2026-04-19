"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { addSuppressionAction, removeSuppressionAction } from "./actions";

type Row = {
  id: string;
  email: string;
  reason: "unsubscribe" | "bounce" | "complaint" | "manual";
  created_at: string;
};

export function GdprClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  async function handleAdd(fd: FormData) {
    setMsg(null);
    const res = await addSuppressionAction(fd);
    if (res.error) setMsg(res.error);
    else router.refresh();
  }

  async function handleRemove(id: string) {
    startTransition(async () => {
      await removeSuppressionAction(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Ajouter un email à la liste</CardTitle></CardHeader>
        <CardContent>
          <form action={handleAdd} className="flex gap-2 items-end">
            <div className="flex-1">
              <Input name="email" type="email" required placeholder="exemple@domaine.com" />
            </div>
            <select name="reason" defaultValue="manual" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="manual">Manuel</option>
              <option value="unsubscribe">Désinscription</option>
              <option value="bounce">Bounce</option>
              <option value="complaint">Plainte</option>
            </select>
            <Button type="submit">Ajouter</Button>
          </form>
          {msg && <p className="mt-2 text-sm text-destructive">{msg}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Aucun email suppressé.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Raison</th>
                  <th className="px-4 py-2 font-medium">Ajouté le</th>
                  <th className="px-4 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-4 py-2">{r.email}</td>
                    <td className="px-4 py-2"><Badge variant="outline">{r.reason}</Badge></td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => handleRemove(r.id)}
                        disabled={isPending}
                        className="text-muted-foreground hover:text-destructive"
                        title="Retirer"
                      >×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
