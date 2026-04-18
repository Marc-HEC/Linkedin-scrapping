"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Field {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
}

interface CredentialFormProps {
  title: string;
  description: ReactNode;
  fields: Field[];
  isConnected: boolean;
  last4?: string | null;
  updatedAt?: string | null;
  onSave: (fd: FormData) => Promise<{ ok?: boolean; error?: string; tested?: boolean }>;
  onTest?: (fd: FormData) => Promise<{ ok?: boolean; error?: string; tested?: boolean }>;
  onDisconnect: () => Promise<void>;
}

export function CredentialForm({
  title, description, fields, isConnected, last4, updatedAt, onSave, onTest, onDisconnect,
}: CredentialFormProps) {
  const [editing, setEditing] = useState(!isConnected);
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; msg: string } | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    const fd = new FormData(e.currentTarget);
    const result = await onSave(fd);
    setLoading(false);
    if (result.error) {
      setFeedback({ type: "error", msg: result.error });
    } else {
      setFeedback({ type: "ok", msg: "Credentials sauvegardés et chiffrés." });
      setEditing(false);
    }
  }

  async function handleTest(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (!onTest) return;
    setTestLoading(true);
    setFeedback(null);
    const form = (e.currentTarget.closest("form") as HTMLFormElement);
    const fd = new FormData(form);
    fd.set("test", "true");
    const result = await onTest(fd);
    setTestLoading(false);
    if (result.error) {
      setFeedback({ type: "error", msg: result.error });
    } else {
      setFeedback({ type: "ok", msg: "Connexion testée avec succès !" });
    }
  }

  async function handleDisconnect() {
    if (!confirm(`Déconnecter ${title} ?`)) return;
    await onDisconnect();
    setEditing(false);
    setFeedback(null);
  }

  return (
    <div className="rounded-lg border bg-background p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${isConnected ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
          {isConnected ? "✓ Connecté" : "Non configuré"}
        </span>
      </div>

      {isConnected && !editing && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>Clé : ••••{last4}</span>
          {updatedAt && <span>· Mis à jour le {new Date(updatedAt).toLocaleDateString("fr-FR")}</span>}
          <button onClick={() => setEditing(true)} className="ml-auto text-primary hover:underline underline-offset-4">
            Modifier
          </button>
          <button onClick={handleDisconnect} className="text-destructive hover:underline underline-offset-4">
            Déconnecter
          </button>
        </div>
      )}

      {editing && (
        <form onSubmit={handleSave} className="space-y-3">
          {fields.map((field) => (
            <div key={field.name} className="space-y-1.5">
              <Label htmlFor={field.name}>{field.label}</Label>
              <div className="relative">
                <Input
                  id={field.name}
                  name={field.name}
                  type={field.type === "password" ? (showSecret ? "text" : "password") : (field.type ?? "text")}
                  placeholder={field.placeholder}
                  defaultValue={field.defaultValue}
                  required={field.required}
                />
                {field.type === "password" && (
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {showSecret ? "Masquer" : "Afficher"}
                  </button>
                )}
              </div>
            </div>
          ))}

          {feedback && (
            <p className={`text-sm ${feedback.type === "ok" ? "text-green-600" : "text-destructive"}`}>
              {feedback.msg}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "Sauvegarde…" : "Sauvegarder"}
            </Button>
            {onTest && (
              <Button type="button" size="sm" variant="outline" onClick={handleTest} disabled={testLoading}>
                {testLoading ? "Test…" : "Tester la connexion"}
              </Button>
            )}
            {isConnected && (
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Annuler
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
