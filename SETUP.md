# Outreach B2B — Setup Guide

## 1. Supabase

1. Crée un projet sur [supabase.com](https://supabase.com)
2. Dans **SQL Editor**, exécute les migrations dans l'ordre :
   - `supabase/migrations/0001_init_schema.sql`
   - `supabase/migrations/0002_rls_policies.sql`
   - `supabase/migrations/0003_auth_trigger.sql`
   - `supabase/migrations/0004_tags_and_matching.sql`
3. Dans **Project Settings → API**, copie :
   - `URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY`

## 2. Variables d'environnement

Crée un fichier `.env.local` à la racine de `outreach-app/` :

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Clé maître de chiffrement (générer UNE SEULE FOIS, garder précieusement)
# Commande : node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
APP_MASTER_KEY=<ta_clé_32_bytes_en_base64>

# Email système (optionnel en dev)
RESEND_API_KEY=re_...

# Cron (mettre n'importe quelle valeur secrète en dev)
CRON_SECRET=dev-secret-change-me

# URL publique
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPPORT_EMAIL=marcbuffry@gmail.com
```

### Générer APP_MASTER_KEY

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

> ⚠️ **IMPORTANT** : cette clé chiffre les DEK de tous les utilisateurs.
> Ne jamais la committer. La sauvegarder dans un gestionnaire de mots de passe.

## 3. Démarrer en développement

```bash
cd outreach-app
npm install      # si pas déjà fait
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000)

## 4. Flux utilisateur

1. `/signup` → crée le compte (profil + DEK chiffrée créés automatiquement)
2. `/onboarding` → wizard 4 étapes (profil, canal, SMTP, terminé)
3. `/dashboard` → vue d'ensemble
4. `/integrations` → ajoute/modifie SMTP, Mistral, Unipile, Dropcontact
   - Chaque credential est chiffré AES-256-GCM avec ta DEK personnelle
   - Persisté en base, rechargé à chaque connexion sans jamais être exposé côté client

## 5. Architecture credentials (sécurité)

```
APP_MASTER_KEY (env var)
    └── chiffre ──► encrypted_dek (profiles.encrypted_dek en DB)
                        └── chiffre ──► credentials SMTP/API (user_integrations.encrypted_payload)
```

- **Le client ne voit jamais** les valeurs en clair après sauvegarde (juste les 4 derniers caractères)
- **Déchiffrement** uniquement dans les Server Actions côté serveur, juste avant utilisation
- **RLS Supabase** : chaque utilisateur ne peut lire/modifier que ses propres données

## 6. Flux d'utilisation (M3 — Campagnes par tags)

1. **Contacts** (`/contacts`) : ajoute des contacts à la main ou importe un CSV.
   Colonnes reconnues : `prenom, nom, email, entreprise, role, linkedin, tags`
   (les tags sont séparés par `;` ou `|` dans la colonne CSV).
2. **Templates** (`/templates`) : crée un template avec des variables entre crochets :
   `[Prénom]`, `[NomEntreprise]`, `[Rôle]`, `[Secteur]`, etc.
   Alias FR automatiques (`Prénom`/`Prenom`/`prenom` → `first_name`, etc.).
   Choisis le canal : **Email**, **Invitation LinkedIn** (note 300 car.), **Message LinkedIn**.
3. **Campagnes** (`/campaigns/new`) :
   - choisis le template,
   - ajoute les **tags de ciblage par ordre de priorité** (le 1er pèse le plus),
   - l'aperçu à droite montre le nombre de contacts matchés, le top 5, et
     le rendu du message pour chaque contact (variables substituées),
   - règle le quota journalier et le délai entre envois,
   - **Lancer** → messages envoyés automatiquement :
     - email via ton SMTP configuré,
     - LinkedIn via l'API Unipile (partenaire officiel).

## 7. Intégration LinkedIn via Unipile

Unipile est une API tierce officielle qui permet l'envoi programmatique de messages
et invitations LinkedIn sans enfreindre les CGU. Dans **Intégrations** → **LinkedIn —
Unipile**, fournis :

- `api_key` : clé Unipile (`upli_...`)
- `dsn` : le host:port fourni par Unipile (ex: `api8.unipile.com:13851`)
- `account_id` : l'ID de ton compte LinkedIn connecté dans Unipile

## 8. Prochaines étapes

- [ ] Raffinement IA Mistral avant envoi (ton formel/casual)
- [ ] Suivi des réponses LinkedIn (webhook Unipile `message_received`)
- [ ] Enrichissement Dropcontact à l'import (trouve l'email pro)
- [ ] Dashboard analytics (taux d'ouverture, réponses, bounces)
- [ ] Gestion de la liste de suppression (désinscription RGPD)


