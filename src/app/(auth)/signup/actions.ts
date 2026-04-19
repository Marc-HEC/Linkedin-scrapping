"use server";

import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { generateEncryptedDek } from "@/lib/crypto/encrypt";

export async function signUpAction(fd: FormData) {
  const email = (fd.get("email") as string).trim().toLowerCase();
  const password = fd.get("password") as string;
  const full_name = (fd.get("full_name") as string).trim();

  if (!email || !password || !full_name) {
    return { error: "Tous les champs sont requis." };
  }
  if (password.length < 8) {
    return { error: "Le mot de passe doit faire au moins 8 caractères." };
  }

  // 1. Créer l'utilisateur Supabase Auth
  const admin = createSupabaseAdmin();
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // En dev on confirme directement
  });

  if (authError || !authData.user) {
    if (authError?.message.includes("already registered")) {
      return { error: "Cet email est déjà utilisé." };
    }
    return { error: "Erreur lors de la création du compte. Réessaie." };
  }

  const userId = authData.user.id;

  // 2. Générer et stocker la DEK chiffrée
  const encryptedDek = generateEncryptedDek();

  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    email,
    full_name,
    encrypted_dek: encryptedDek,
    onboarding_completed: false,
  });

  if (profileError) {
    // Rollback : supprimer l'utilisateur Auth pour éviter un état incohérent
    await admin.auth.admin.deleteUser(userId);
    return { error: "Erreur lors de la création du profil." };
  }

  // 3. Connecter l'utilisateur via le client browser (côté server action)
  // On renvoie null pour que le client puisse faire signInWithPassword
  // La page redirige vers /onboarding après sign-in client
  return { userId };
}
