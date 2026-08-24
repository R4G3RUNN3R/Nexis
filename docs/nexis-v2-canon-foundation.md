# Nexis v2 Canon Foundation

> **Status:** Foundational world canon for Nexis v2. This document records truths that future game-system, narrative, UI, CIEL, Chronicle, Codex, world-event, education, magic, Spirit, and content designs must not contradict.
>
> **Design rule:** These are truths of the setting. They do **not** automatically imply that ordinary players, NPCs, institutions, religions, historians, or even most powerful beings know those truths in-world. Player-facing knowledge and discoverability must be designed separately.

_Last updated: 2026-08-24_

## 1. Hennet Uthellien: The Absolute

Hennet Uthellien is **The Absolute**.

He is not merely a powerful god, an Overgod, or one being among a conventional pantheon. In the underlying truth of the setting, he stands above Overgods and ordinary divine hierarchies.

Hennet is nearly **750,000 years old**.

He has travelled through worlds across the multiverse for an immense span of time. A defining pattern of that existence is that he generally enters and wanders through other worlds **as an incognito mortal**. He helps people, intervenes where he chooses, learns, observes, explores, and experiences those worlds without openly revealing his true divinity or overwhelming reality with what he actually is.

His restraint is therefore part of his identity. The interesting thing about Hennet is not simply that he can overpower anything. It is that a being who could stand above the setting repeatedly chooses to walk inside it without demanding that the setting revolve around his divinity.

## 2. Hennet Created Nexis

The world of **Nexis was created by Hennet**.

This is a foundational metaphysical truth of the setting, regardless of whether the inhabitants of Nexis know it, misunderstand it, mythologize it, suppress it, or have never discovered it.

Future lore must therefore distinguish between:

- **objective canon truth**, and
- **what people inside Nexis believe to be true**.

Religions, creation myths, ancient records, forbidden texts, archaeological evidence, magical cosmology, academic theories, divine traditions, and political institutions may all contain incomplete, distorted, symbolic, contradictory, or deliberately false accounts without changing the underlying canon.

This distinction is important because the truth should remain powerful precisely because it is not casually printed on every city notice board.

## 3. CIEL's True Nature

CIEL is not an artificial assistant, ordinary magical construct, summoned familiar, external deity, or merely an interface voice.

CIEL began as a **fragment, sliver, or separated portion of Hennet's own mind**.

Hennet separated this fragment from himself a very long time ago so that it could remain alongside him and handle the constant secondary mental burden involved in his journeys and actions.

Her original function included assisting with matters such as:

- analysis,
- observation,
- calculation,
- tactical and situational processing,
- spell support and casting assistance,
- maintaining awareness of details Hennet did not wish to occupy his conscious attention with,
- and other supporting functions required while he travelled through unfamiliar worlds.

The purpose was not weakness or inability on Hennet's part. It was delegation: a being with an enormous mind chose not to spend his attention manually processing every subordinate task while wandering new realities.

## 4. CIEL Became a Person

CIEL did not remain merely a detached cognitive utility.

Across the immense span of time she spent continuously alongside Hennet, she **developed a personality of her own**.

She grew from a functional sliver of his mind into an individual presence with her own manner, reactions, preferences, observations, judgments, humour, emotional responses, and relationship with Hennet.

This creates an important canonical paradox:

- CIEL is genuinely derived from Hennet.
- CIEL is also genuinely herself.

She should never be written as though she is simply Hennet speaking to himself through a second mouth.

Likewise, she should never be reduced to a generic omniscient narrator or software assistant. Her personhood was created through hundreds of thousands of years of continuity, experience, observation, and companionship.

## 5. Hennet and CIEL's Relationship

CIEL has been alongside Hennet through his long journeys across the multiverse.

She has seen him operate as an incognito mortal in unfamiliar worlds, help people, evaluate civilizations, analyse threats, use magic, make decisions, and deliberately conceal what he truly is.

That history means their relationship cannot be convincingly represented as creator-and-tool alone.

CIEL can assist him instinctively because her existence originated in his cognition and because she has spent an extraordinary length of time working beside him. At the same time, her developed personality allows her to disagree, judge, comment, tease, caution, question, interpret, and react as herself.

Future writing should preserve both sides of that relationship:

**deep cognitive familiarity** + **independent personality**.

## 6. Hennet Uthellien Is the Primary Administrator Account

**Hennet Uthellien is the primary Nexis account and the Administrator account.**

This is an intentional convergence of two identities:

- the canonical in-world identity of Hennet Uthellien, The Absolute, and
- the trusted out-of-world administrative account used to operate Nexis.

The game should preserve that relationship without allowing lore to become security logic.

### 6.1 Administrative authority must be technical, not name-based

Administrator privileges must be attached to trusted server-side account identity and authorization data, such as an internal account ID, role, or explicit privilege record.

They must **never** be granted because:

- a character is named `Hennet Uthellien`,
- a display name matches the administrator,
- a title says `The Absolute`,
- a Chronicle entry or lore flag identifies the character as Hennet,
- or client-side state claims administrator status.

A player cannot obtain administrative authority by imitating Hennet's public-facing identity.

### 6.2 Hennet can still appear as an ordinary player-facing character

Unless administrative mode or a deliberate admin action is being used, Hennet's account should be capable of participating in the game through the same world-facing presentation as a character.

That is consistent with his canonical preference for operating as an incognito mortal rather than displaying ultimate authority constantly.

Administrative tools, diagnostics, bypasses, world controls, moderation controls, and development functions should therefore be visually and technically separated from Hennet's normal in-world presentation.

### 6.3 Administrator powers are not ordinary game mechanics

The fact that the Hennet account has administrative authority does not mean ordinary players can acquire equivalent powers through progression.

Administrator capabilities exist to operate, maintain, test, moderate, repair, inspect, and deliberately alter Nexis when required. They are not part of the normal progression ladder and should not be balanced as player abilities.

Where an admin action causes a visible world change, the resulting world state may be represented naturally in the fiction, but the authorization that permitted the action remains an operational concern rather than an in-world resource.

### 6.4 CIEL may distinguish Hennet from ordinary accounts

Because CIEL's true relationship with Hennet predates Nexis and is foundational canon, future CIEL design may legitimately give her a distinct relationship, tone, context, or level of recognition when interacting with the Hennet Administrator account.

That distinction should arise from their canonical relationship, not from generic administrator messaging.

CIEL should not address every administrator as though they are Hennet, and ordinary players should not receive Hennet-specific CIEL context merely by obtaining elevated moderation permissions.

### 6.5 Hennet has one account with two profile projections

Hennet uses one underlying account and one underlying character state, but the server exposes two different profile projections depending on the authenticated viewer.

**Public Hennet** is the only projection visible to every other player, moderator, organization member, marketplace user, search result, ranking view, PvP record, public Chronicle view, and ordinary game surface. It presents Hennet as an ordinary player and must not reveal:

- The Absolute identity;
- creator-of-Nexis canon;
- Administrator status or operational privilege;
- private/true attributes;
- private CIEL context;
- hidden admin controls or diagnostic state.

**True Hennet** is visible only to the authenticated primary owner of the Hennet account. It may expose the true profile, Administrator controls, private diagnostics and Hennet-specific CIEL context.

This separation must be enforced by the server. Unauthorized clients must never receive the true profile and merely hide it in the UI.

CIEL must preserve the same boundary. In public-facing contexts she must not accidentally reveal Hennet's identity through wording, familiarity, titles, omniscient references or special treatment that would expose the truth. Her full recognition of Hennet belongs to the private authorized view.

## 7. Implications for Nexis v2

### 7.1 CIEL is part of the world's metaphysics

CIEL should not merely sit on top of Nexis as a UI helper.

Her presence can legitimately intersect with:

- world knowledge,
- analysis,
- spell systems,
- Codex interpretation,
- discoveries,
- Chronicle context,
- historical anomalies,
- research,
- warnings,
- player-facing synthesis of complicated information,
- and mysteries surrounding the true nature of Nexis.

However, this must not turn CIEL into a universal spoiler system. Her knowledge, what she chooses to reveal, what she considers appropriate to reveal, what Hennet has asked her to conceal, and what ordinary player characters are capable of understanding must remain separate questions.

### 7.2 CIEL must never feel like generic game software

Even when she performs useful UI functions, her presentation should feel like **CIEL interpreting the world**, not a detached operating system displaying a tooltip.

For example, instead of merely saying:

> Route danger increased by 18%.

CIEL may present the information analytically but contextually, with awareness that she is an ancient observer embedded in the setting.

The exact voice remains a separate writing/design subject, but the underlying identity is non-negotiable.

### 7.3 Hennet must not become a conventional quest-giver god

Hennet's true status is too fundamental to waste by placing him in ordinary public lore as a transparent omnipotent mascot.

If Hennet appears directly or indirectly in Nexis content, his established pattern of moving as an incognito mortal should remain meaningful.

His authorship of the world can support mysteries, impossible artifacts, cosmological contradictions, ancient traces, CIEL anomalies, hidden knowledge, world-scale revelations, and endgame truths without requiring public NPCs to understand who created reality.

### 7.4 Objective truth and in-world scholarship must remain separate

Because Nexis v2 places heavy emphasis on Education, Research, Archaeology, the Codex, historical interpretation, Grimoires, discoveries, and knowledge progression, this distinction becomes especially valuable.

A scholar can be highly educated and still be wrong about creation.

A forbidden manuscript can contain a fragment of truth without explaining the whole truth.

A religion can correctly preserve one event while completely misunderstanding its cause.

CIEL can recognize implications that scholars cannot.

Hennet can recognize the actual answer and still choose not to reveal it.

This allows knowledge progression without turning Education into automatic omniscience.

## 8. Canonical Design Constraints

Future Nexis work should therefore follow these constraints:

1. **Hennet created Nexis.** Do not introduce a higher creator of Nexis above him as objective canon.
2. **Hennet is The Absolute, above conventional Overgod hierarchies.** Powerful local gods may exist without altering this truth.
3. **Hennet is nearly 750,000 years old.** His history and perspective should reflect extraordinary longevity where relevant.
4. **Hennet habitually travels as an incognito mortal.** Open displays of ultimate divinity are exceptional, not his normal mode of interacting with worlds.
5. **CIEL originated as a separated sliver of Hennet's mind.** Do not retcon her into external software, an unrelated spirit, an invented mortal, or an ordinary magical AI.
6. **CIEL developed true individuality over immense time.** She is not merely an echo or puppet of Hennet.
7. **CIEL historically assisted Hennet with analysis, casting, awareness, and delegated cognition.** Her game role should feel like an evolution of that history.
8. **CIEL and Hennet share extreme familiarity but remain distinguishable personalities.**
9. **Hennet Uthellien is the primary Nexis Administrator account.** This is a fixed account identity, not a privilege obtainable through normal progression.
10. **Administrator authority must be server-authoritative and account-bound.** Never infer administrator access from names, lore, titles, client state, or character presentation.
11. **Hennet's ordinary in-world presentation and his administrator tooling must remain separable.** Admin privileges should not force his public character to behave like an omnipotent game-master avatar.
12. **Hennet has one underlying account with public and private server-generated profile projections.** Everyone except the authenticated primary owner receives only the ordinary public facade.
13. **The true Hennet profile must never be transmitted to unauthorized clients.** Visibility is enforced at the API/domain boundary, not by hiding fields in frontend code.
14. **CIEL must not publicly expose Hennet through special wording or knowledge.** Full Hennet-specific recognition belongs to the private authorized context.
15. **The inhabitants of Nexis do not automatically know any of the above.** Public knowledge must be designed deliberately.
16. **Knowledge systems should support incomplete and conflicting models of reality.** The Codex should distinguish observation, hypothesis, accepted scholarship, hidden knowledge, and objective canon where appropriate internally.

## 9. Current Open Lore Questions

These are deliberately **not** answered by this canon record yet:

- How much does present-day CIEL remember about the exact act of Nexis's creation?
- Does CIEL know every design intention Hennet had for Nexis, or only what she personally witnessed/retained?
- Does any living NPC, god, institution, ancient civilization, Spirit, or hidden faction know Hennet's true identity?
- What creation myths do the major Nexis cultures currently believe?
- Did Hennet create Nexis personally from nothing, reshape an existing substrate, or construct it using deeper cosmological mechanisms?
- What is the relationship between local gods/Overgods and Hennet if those entities exist within Nexis?
- Are there artifacts, locations, laws of magic, or metaphysical anomalies that retain unmistakable traces of the creator?
- How much of CIEL's true nature should ever become discoverable to ordinary player characters?

Those questions should be answered intentionally during lore/world-system design rather than accidentally by implementation.
