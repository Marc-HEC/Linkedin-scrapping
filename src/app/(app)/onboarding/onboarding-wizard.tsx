"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { saveProfileStep, saveSmtpOnboarding, completeOnboarding } from "./actions";

interface Props {
  defaultName: string;
  defaultCompany: string;
  defaultSenderIdentity: string;
}

const STEPS = ["Profil", "Canaux", "Email SMTP", "Prêt !"] as const;

export function OnboardingWizard({ defaultName, defaultCompany, defaultSenderIdentity }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [showSMTP, setShowSMTP] = useState(true);

  // ---- Étape 0 : Profil ----
  async function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true); setError(null);
    const fd = new FormData(e.currentTarget);
    const result = await saveProfileStep(fd);
    setLoading(false);
    if (result?.error) { setError(result.error); return; }
    setStep(1);
  }

  // ---- Étape 2 : SMTP ----
  async function handleSmtpSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true); setError(null);
    const fd = new FormData(e.currentTarget);
    const result = await saveSmtpOnboarding(fd);
    setLoading(false);
    if (result?.error) { setError(result.error); return; }
    setSmtpConfigured(true);
    setStep(3);
  }

  // ---- Étape 3 : Terminer ----
  async function handleFinish() {
    setLoading(true);
    await completeOnboarding();
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-lg">
      {/* Progress bar */}
      <div className="flex gap-0.5 px-6 pt-5">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1 flex flex-col items-center gap-1">
            <div className={`h-1.5 w-full rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
            <span className="text-[10px] text-muted-foreground hidden sm:block">{label}</span>
          </div>
        ))}
      </div>

      {/* Étape 0 : Profil */}
      {step === 0 && (
        <form onSubmit={handleProfileSubmit}>
          <CardHeader>
            <CardTitle>Ton profil</CardTitle>
            <CardDescription>Ces infos apparaîtront dans tes emails de prospection.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Prénom et nom</Label>
              <Input id="full_name" name="full_name" defaultValue={defaultName} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company_name">Entreprise</Label>
              <Input id="company_name" name="company_name" defaultValue={defaultCompany} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sender_identity">Identité expéditeur (ex : Marc, CEO @ Acme)</Label>
              <Input id="sender_identity" name="sender_identity" defaultValue={defaultSenderIdentity} placeholder="Marc, CEO @ MonEntreprise" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sauvegarde…" : "Continuer →"}
            </Button>
          </CardFooter>
        </form>
      )}

      {/* Étape 1 : Canaux */}
      {step === 1 && (
        <>
          <CardHeader>
            <CardTitle>Quels canaux utilises-tu ?</CardTitle>
            <CardDescription>Tu pourras en ajouter d&apos;autres depuis Intégrations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                id: "email",
                label: "Email B2B (cold email)",
                desc: "Envoie des emails personnalisés via ton SMTP. Conforme RGPD si base légale intérêt légitime.",
                action: () => { setShowSMTP(true); setStep(2); },
              },
              {
                id: "linkedin",
                label: "LinkedIn (copy-paste)",
                desc: "L'app génère tes messages, tu les copies-colles manuellement. 100% conforme aux CGU LinkedIn.",
                action: () => { setShowSMTP(false); setStep(3); },
              },
            ].map((c) => (
              <button
                key={c.id}
                onClick={c.action}
                className="w-full text-left rounded-lg border p-4 hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <p className="font-medium">{c.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
              </button>
            ))}
          </CardContent>
          <CardFooter>
            <Button variant="ghost" size="sm" onClick={() => setStep(0)}>← Retour</Button>
          </CardFooter>
        </>
      )}

      {/* Étape 2 : SMTP */}
      {step === 2 && showSMTP && (
        <form onSubmit={handleSmtpSubmit}>
          <CardHeader>
            <CardTitle>Configuration SMTP</CardTitle>
            <CardDescription>
              Tes credentials sont chiffrés (AES-256-GCM) et ne quittent jamais le serveur.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { name: "host", label: "Hôte SMTP", placeholder: "smtp.gmail.com" },
              { name: "port", label: "Port", placeholder: "587", defaultValue: "587" },
              { name: "user", label: "Email de connexion", type: "email" },
              { name: "password", label: "Mot de passe / App password", type: "password" },
              { name: "from_name", label: "Nom expéditeur", placeholder: "Marc Buffry" },
              { name: "from_email", label: "Email d'envoi", type: "email" },
            ].map((f) => (
              <div key={f.name} className="space-y-1.5">
                <Label htmlFor={f.name}>{f.label}</Label>
                <Input
                  id={f.name}
                  name={f.name}
                  type={f.type ?? "text"}
                  placeholder={f.placeholder}
                  defaultValue={f.defaultValue}
                  required
                />
              </div>
            ))}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Sauvegarde…" : "Sauvegarder"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStep(3)}>
              Passer
            </Button>
          </CardFooter>
        </form>
      )}

      {/* Étape 3 : Prêt */}
      {step === 3 && (
        <>
          <CardHeader>
            <CardTitle>Tu es prêt ! 🎉</CardTitle>
            <CardDescription>Voici ce que tu peux faire maintenant :</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              { done: true, label: "Compte créé et sécurisé" },
              { done: smtpConfigured, label: "SMTP configuré" },
              { done: false, label: "Importer tes premiers contacts" },
              { done: false, label: "Créer un template de message" },
              { done: false, label: "Lancer ta première campagne" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={item.done ? "text-green-600" : "text-muted-foreground"}>
                  {item.done ? "✓" : "○"}
                </span>
                <span className={item.done ? "" : "text-muted-foreground"}>{item.label}</span>
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <Button onClick={handleFinish} className="w-full" disabled={loading}>
              {loading ? "Chargement…" : "Accéder au tableau de bord →"}
            </Button>
          </CardFooter>
        </>
      )}
    </Card>
  );
}
