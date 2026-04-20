# Graph Report - D:\TP info\outreach-app  (2026-04-20)

## Corpus Check
- 57 files · ~37,825 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 217 nodes · 367 edges · 35 communities detected
- Extraction: 70% EXTRACTED · 30% INFERRED · 0% AMBIGUOUS · INFERRED: 109 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]

## God Nodes (most connected - your core abstractions)
1. `createSupabaseAdmin()` - 42 edges
2. `getUserId()` - 32 edges
3. `processCampaignSend()` - 11 edges
4. `createSupabaseServer()` - 11 edges
5. `getAuthenticatedUser()` - 10 edges
6. `saveIntegration()` - 10 edges
7. `async()` - 9 edges
8. `saveSMTPAction()` - 7 edges
9. `last4()` - 7 edges
10. `searchAndImportLinkedinContactsAction()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `launchCampaignAction()` --calls--> `launch()`  [INFERRED]
  D:\TP info\outreach-app\src\app\(app)\campaigns\actions.ts → D:\TP info\outreach-app\src\app\(app)\campaigns\new\new-campaign-client.tsx
- `saveTemplateAction()` --calls--> `submit()`  [INFERRED]
  D:\TP info\outreach-app\src\app\(app)\templates\actions.ts → D:\TP info\outreach-app\src\app\(app)\templates\templates-client.tsx
- `AppLayout()` --calls--> `createSupabaseServer()`  [INFERRED]
  outreach-app\src\app\(app)\layout.tsx → outreach-app\src\lib\supabase\server.ts
- `withUnsubFooter()` --calls--> `makeUnsubscribeToken()`  [INFERRED]
  D:\TP info\outreach-app\src\app\(app)\campaigns\actions.ts → D:\TP info\outreach-app\src\lib\crypto\encrypt.ts
- `getUserId()` --calls--> `createSupabaseServer()`  [INFERRED]
  D:\TP info\outreach-app\src\app\(app)\templates\actions.ts → outreach-app\src\lib\supabase\server.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.13
Nodes (26): addSuppressionAction(), appUrl(), confirmAndSendCampaignAction(), createSegmentAction(), deleteSegmentAction(), deleteTemplateAction(), getContactsProvidersStatusAction(), getSegmentsAction() (+18 more)

### Community 1 - "Community 1"
Cohesion: 0.11
Nodes (22): apolloSearchAndImportContactsAction(), cleanOptional(), createContactAction(), deleteContactAction(), enrichMissingEmailsWithDropcontactAction(), importContactsCsvAction(), listUserTagsAction(), parseCSV() (+14 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (12): completeOnboarding(), saveProfileStep(), saveSmtpOnboarding(), AppLayout(), handleFinish(), handleProfileSubmit(), handleSmtpSubmit(), GdprPage() (+4 more)

### Community 3 - "Community 3"
Cohesion: 0.15
Nodes (7): extractLinkedInSlug(), FallbackLinkedinSender, OutxLinkedinSender, sendViaUnipile(), unipileBase(), UnipileLinkedinSender, unipileResolveProviderId()

### Community 4 - "Community 4"
Cohesion: 0.27
Nodes (17): deleteIntegrationAction(), getAuthenticatedUser(), getDecryptedCredential(), getIntegrationsStatusAction(), getUserDek(), saveApolloAction(), saveDropcontactAction(), saveIntegration() (+9 more)

### Community 5 - "Community 5"
Cohesion: 0.13
Nodes (11): normHeader(), regenerateMessageAction(), handleBodyBlur(), handleRegenerate(), handleSubjectBlur(), pickValue(), renderTemplateWithMistral(), slug() (+3 more)

### Community 6 - "Community 6"
Cohesion: 0.27
Nodes (12): signUpAction(), b64urlDecode(), b64urlEncode(), decryptBuffer(), decryptWithDek(), encryptBuffer(), encryptWithDek(), generateEncryptedDek() (+4 more)

### Community 7 - "Community 7"
Cohesion: 0.17
Nodes (6): createSupabaseBrowser(), handleAdd(), refresh(), onSaved(), save(), handleLogout()

### Community 8 - "Community 8"
Cohesion: 0.51
Nodes (8): extractSlug(), fetchProfileUrn(), headers(), norm(), searchProfiles(), sendConnectionRequest(), sendMessage(), sleep()

### Community 9 - "Community 9"
Cohesion: 0.33
Nodes (1): launch()

### Community 10 - "Community 10"
Cohesion: 0.67
Nodes (2): base(), searchPeople()

### Community 11 - "Community 11"
Cohesion: 0.67
Nodes (1): submit()

### Community 12 - "Community 12"
Cohesion: 0.67
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

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 13`** (2 nodes): `middleware()`, `middleware.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (2 nodes): `RootLayout()`, `layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (2 nodes): `page.tsx`, `HomePage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (2 nodes): `page.tsx`, `SignupPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (2 nodes): `Badge()`, `badge.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (2 nodes): `utils.ts`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (2 nodes): `mistral.ts`, `refineMessage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (2 nodes): `dropcontact.ts`, `enrichBatch()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (1 nodes): `next.config.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (1 nodes): `postcss.config.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (1 nodes): `tailwind.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (1 nodes): `button.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `card.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (1 nodes): `input.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (1 nodes): `label.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (1 nodes): `textarea.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (1 nodes): `integration.schema.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createSupabaseAdmin()` connect `Community 0` to `Community 1`, `Community 2`, `Community 4`, `Community 5`, `Community 6`?**
  _High betweenness centrality (0.335) - this node is a cross-community bridge._
- **Why does `getUserId()` connect `Community 0` to `Community 1`, `Community 2`, `Community 5`?**
  _High betweenness centrality (0.111) - this node is a cross-community bridge._
- **Why does `processCampaignSend()` connect `Community 0` to `Community 1`, `Community 3`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Are the 41 inferred relationships involving `createSupabaseAdmin()` (e.g. with `previewMatchesAction()` and `launchCampaignAction()`) actually correct?**
  _`createSupabaseAdmin()` has 41 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `processCampaignSend()` (e.g. with `createSupabaseAdmin()` and `sendViaSmtp()`) actually correct?**
  _`processCampaignSend()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 10 inferred relationships involving `createSupabaseServer()` (e.g. with `AppLayout()` and `getUserId()`) actually correct?**
  _`createSupabaseServer()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._