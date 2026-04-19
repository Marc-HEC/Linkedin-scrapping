import { z } from "zod";

export const smtpSchema = z.object({
  host: z.string().min(1, "Hôte SMTP requis"),
  port: z.coerce.number().int().min(1).max(65535),
  user: z.string().email("Email SMTP invalide"),
  password: z.string().min(1, "Mot de passe requis"),
  from_name: z.string().min(1, "Nom d'expéditeur requis"),
  from_email: z.string().email("Email expéditeur invalide"),
  secure: z.coerce.boolean().default(false),
});

export const mistralSchema = z.object({
  api_key: z.string().min(10, "Clé API invalide"),
  model: z.string().default("mistral-small-latest"),
});

export const unipileSchema = z.object({
  api_key: z.string().min(10, "Clé API Unipile invalide"),
  dsn: z.string().min(5, "DSN Unipile requis (ex: api8.unipile.com:13851)"),
  account_id: z.string().min(1, "Account ID Unipile requis"),
});

export const dropcontactSchema = z.object({
  api_key: z.string().min(10, "Clé API Dropcontact invalide"),
});

export const outxSchema = z.object({
  api_key: z.string().min(10, "Clé API OutX invalide"),
  base_url: z.string().url("URL invalide").default("https://api.outx.ai"),
});

export const apolloSchema = z.object({
  api_key: z.string().min(10, "Clé API Apollo invalide"),
});

export type SmtpConfig = z.infer<typeof smtpSchema>;
export type MistralConfig = z.infer<typeof mistralSchema>;
export type UnipileConfig = z.infer<typeof unipileSchema>;
export type DropcontactConfig = z.infer<typeof dropcontactSchema>;
export type OutxConfig = z.infer<typeof outxSchema>;
export type ApolloConfig = z.infer<typeof apolloSchema>;
