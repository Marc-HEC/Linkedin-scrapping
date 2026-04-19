# Graph Report - D:\TP info\outreach-app  (2026-04-19)

## Corpus Check
- 46 files · ~23,346 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 132 nodes · 195 edges · 30 communities detected
- Extraction: 69% EXTRACTED · 31% INFERRED · 0% AMBIGUOUS · INFERRED: 61 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]

## God Nodes (most connected - your core abstractions)
1. `createSupabaseAdmin()` - 25 edges
2. `getUserId()` - 15 edges
3. `createSupabaseServer()` - 10 edges
4. `getAuthenticatedUser()` - 8 edges
5. `saveIntegration()` - 8 edges
6. `processCampaignSend()` - 7 edges
7. `saveSMTPAction()` - 7 edges
8. `async()` - 7 edges
9. `launchCampaignAction()` - 6 edges
10. `saveMistralAction()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `launchCampaignAction()` --calls--> `launch()`  [INFERRED]
  outreach-app\src\app\(app)\campaigns\actions.ts → outreach-app\src\app\(app)\campaigns\new\new-campaign-client.tsx
- `AppLayout()` --calls--> `createSupabaseServer()`  [INFERRED]
  outreach-app\src\app\(app)\layout.tsx → outreach-app\src\lib\supabase\server.ts
- `getUserId()` --calls--> `createSupabaseServer()`  [INFERRED]
  outreach-app\src\app\(app)\templates\actions.ts → outreach-app\src\lib\supabase\server.ts
- `processCampaignSend()` --calls--> `sendViaSmtp()`  [INFERRED]
  outreach-app\src\app\(app)\campaigns\actions.ts → outreach-app\src\lib\senders\email.ts
- `processCampaignSend()` --calls--> `sendViaUnipile()`  [INFERRED]
  outreach-app\src\app\(app)\campaigns\actions.ts → outreach-app\src\lib\senders\linkedin.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.12
Nodes (12): completeOnboarding(), saveProfileStep(), saveSmtpOnboarding(), AppLayout(), handleFinish(), handleProfileSubmit(), handleSmtpSubmit(), CampaignDetailPage() (+4 more)

### Community 1 - "Community 1"
Cohesion: 0.18
Nodes (13): cleanOptional(), createContactAction(), deleteContactAction(), deleteTemplateAction(), getUserId(), importContactsCsvAction(), listUserTagsAction(), parseCSV() (+5 more)

### Community 2 - "Community 2"
Cohesion: 0.27
Nodes (15): deleteIntegrationAction(), getAuthenticatedUser(), getDecryptedCredential(), getIntegrationsStatusAction(), getUserDek(), saveDropcontactAction(), saveIntegration(), saveMistralAction() (+7 more)

### Community 3 - "Community 3"
Cohesion: 0.3
Nodes (9): launchCampaignAction(), markAllFailed(), markCampaignCompletedAction(), markMessageSentAction(), previewMatchesAction(), processCampaignSend(), sleep(), createSupabaseAdmin() (+1 more)

### Community 4 - "Community 4"
Cohesion: 0.38
Nodes (8): signUpAction(), decryptBuffer(), decryptWithDek(), encryptBuffer(), encryptWithDek(), generateEncryptedDek(), masterKey(), unpackDek()

### Community 5 - "Community 5"
Cohesion: 0.25
Nodes (5): saveTemplateAction(), extractVariables(), pickValue(), slug(), submit()

### Community 6 - "Community 6"
Cohesion: 0.33
Nodes (3): createSupabaseBrowser(), refresh(), handleLogout()

### Community 7 - "Community 7"
Cohesion: 0.4
Nodes (1): launch()

### Community 8 - "Community 8"
Cohesion: 0.8
Nodes (4): base(), extractLinkedInSlug(), resolveProviderId(), sendViaUnipile()

### Community 9 - "Community 9"
Cohesion: 0.67
Nodes (0): 

### Community 10 - "Community 10"
Cohesion: 1.0
Nodes (0): 

### Community 11 - "Community 11"
Cohesion: 1.0
Nodes (0): 

### Community 12 - "Community 12"
Cohesion: 1.0
Nodes (0): 

### Community 13 - "Community 13"
Cohesion: 1.0
Nodes (0): 

### Community 14 - "Community 14"
Cohesion: 1.0
Nodes (0): 

### Community 15 - "Community 15"
Cohesion: 1.0
Nodes (0): 

### Community 16 - "Community 16"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "Community 17"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "Community 18"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Community 21"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "Community 22"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Community 23"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "Community 24"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 10`** (2 nodes): `middleware()`, `middleware.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 11`** (2 nodes): `RootLayout()`, `layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (2 nodes): `page.tsx`, `HomePage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (2 nodes): `CampaignDetailClient()`, `campaign-detail-client.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (2 nodes): `page.tsx`, `SignupPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (2 nodes): `Badge()`, `badge.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (2 nodes): `utils.ts`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (1 nodes): `next.config.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (1 nodes): `postcss.config.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (1 nodes): `tailwind.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (1 nodes): `button.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (1 nodes): `card.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (1 nodes): `input.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (1 nodes): `label.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (1 nodes): `textarea.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (1 nodes): `integration.schema.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createSupabaseAdmin()` connect `Community 3` to `Community 0`, `Community 1`, `Community 2`, `Community 4`, `Community 5`?**
  _High betweenness centrality (0.369) - this node is a cross-community bridge._
- **Why does `saveTemplateAction()` connect `Community 5` to `Community 1`, `Community 3`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Why does `processCampaignSend()` connect `Community 3` to `Community 8`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Are the 24 inferred relationships involving `createSupabaseAdmin()` (e.g. with `previewMatchesAction()` and `launchCampaignAction()`) actually correct?**
  _`createSupabaseAdmin()` has 24 INFERRED edges - model-reasoned connections that need verification._
- **Are the 9 inferred relationships involving `createSupabaseServer()` (e.g. with `AppLayout()` and `getUserId()`) actually correct?**
  _`createSupabaseServer()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `saveIntegration()` (e.g. with `encryptWithDek()` and `createSupabaseAdmin()`) actually correct?**
  _`saveIntegration()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._