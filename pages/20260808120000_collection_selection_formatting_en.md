# Collection, Selection, Formatting

**Published:** 8 August 2026, Helsinki  
**Modified:** 9 August 2026  
**Author:** amaaov  
**Language:** English  
**Русский:** [20260808120000_collection_selection_formatting.html](20260808120000_collection_selection_formatting.html)  
**HTML:** [20260808120000_collection_selection_formatting_en.html](20260808120000_collection_selection_formatting_en.html)

---

At 2:13 in the morning, three patches for the same task are waiting in a work repository. The first is short and breaks a rare case, the second passes the tests and introduces a vocabulary foreign to the project, and the third touches more files because it noticed a boundary missing from the issue; all three appeared within minutes. I open the diffs, return to the types, read the history of a neighbouring module, run the tests, and gradually realise that generation has finished while the engineering work has entered its densest part.

The interface gives visual weight to the button after which code appears, so the eye easily accepts that moment as the centre of the event. Repository history tells another story: before the request, maintainers chose the directory structure, names, dependencies, and rules; during the request, the system retrieved a portion of that environment; after the response, I decide which version may alter the product. What appears on screen is the cheap end of a long chain whose cultural and technical power is distributed across collecting material, deciding what matters, and formatting it into features available to the system.

I call this chain generative reproduction; it begins before the model and continues after publication:

`experience → capture → collection → selection → formatting → selection → publication → recapture`

The final arrow closes the apparatus as a published text enters search, an accepted patch becomes repository history, a clip enters recommendation, and a generated caption returns tomorrow as an example. Culture increasingly reproduces its available forms through material prepared by earlier cycles.

## Before the button

In his paper on surveillance and capture, Philip Agre described a computational system that requires a grammar of action. A production process has to be articulated into recognisable states, and activity is often reorganised so the system can register it in real time ([Agre 1994](https://doi.org/10.1080/01972243.1994.9960162)). An issue card, a status, a required field, a sequence of transitions, and a user role appear to describe work that already exists, while together they construct work available to computation.

The distinction between digitisation and capture matters here. Digitisation converts an event or object into data; capture arranges the event in advance so that data arise systematically. A collection then decides which traces will be kept together, selection makes some traces operationally relevant, and formatting turns selected material into a new usable instance. When an engineer writes a task for an agent, change history, team conventions, tool rules, module names, and retrieved fragments are already acting beside it. Surrounding language has become a dependency capable of orienting probabilistic production before the first token.

A collection constructs a region of comparison in which “good code,” “successful pull requests,” “Finnish music,” “juggling history,” and “unsafe content” look like discovered sets, although each is assembled through rules of inclusion, duplicate removal, naming, retention, and metadata quality. Geoffrey Bowker and Susan Leigh Star described classifications and standards as a built information environment where every category supports one point of view and silences another ([Bowker and Star 1999](https://mitpress.mit.edu/9780262024617/sorting-things-out/)). A generative system gives this arrangement additional productive force: classification of the past outlines the space of future variations.

At the level of labour, collection means clerical work: someone records material, gives it a name, fills in a description, files it under a category, updates the record, and publishes it so the material enters circulation. This clerical process handles human observations and outputs from generative systems alike, giving a text, image, or piece of code an address, date, and category after which it can be searched, compared, and used again.

Within a particular collection and retrieval system, sparsely represented material is harder to reproduce, while abundant material has more chances to become statistically ordinary. A poorly captioned trace remains on a disk and falls out of retrieval, while richly described material enters new answers, images, decisions, and learning sequences. Cultural visibility therefore gains another capacity: survival in a sufficiently distinct form to become material again later.

## The weight of format

Formatting sounds like the final administrative task: JSON, a database schema, Markdown, a caption, a crop, an API, an embedding, a prompt template. In practice, format determines a family of possible operations. Lev Manovich described the database as a characteristic cultural form of the computer age, a collection of addressable elements from which an interface or algorithm constructs a sequence ([Manovich 1999](https://manovich.net/index.php/projects/database-as-a-symbolic-form)). He later identified three decisions that make a phenomenon computable: choosing the objects, choosing their features, and encoding those features ([Manovich 2019](https://manovich.net/index.php/projects/data)).

The formatter role in this essay usually belongs to generative software: it receives collected and selected material and returns code, an image, a report, or a caption in a form ready for the next action; generation becomes automated formatting at scale, while a person can perform the same transition through bespoke manual work that takes time, costs more, and is therefore available to few.

A juggling evening can be preserved as video, an audio track, a sequence of frames, skeleton coordinates, siteswap, trick names, a throw count, a competition score, a tutorial, or an embedding. Each format carries some relations and cuts others. Siteswap makes the temporal structure of throws available for transformation; tension in the wrist, a joke between friends, the slippery floor, and the reason for meeting lie beyond its boundary. Video keeps voice and movement as its frame selects the edge of the room and one direction of sight. Formatting turns a heterogeneous situation into sufficiently homogeneous material for a chosen family of transformations, and every generative capacity begins with an earlier decision about acceptable loss.

Erik Åberg’s artistic research project *Division Dialogues* shows this process at a small scale. The reduct-construct method breaks a juggling pattern, a sculptural object, or an archival fragment into elements and assembles new constellations from them; historiography becomes a creative generative practice ([Åberg 2026](https://www.researchcatalogue.net/view/4392556/4392557)). [*Executable Traces*](20260804140000_executable_traces.html) already follows how a description of the method, a recording, a patent, and a factory copy carry a scheme of action beyond the room where it arose. The prior gesture matters here: components become components after somebody decides where to make the cut.

Lucy Suchman connected plans with situated action and showed the inherent vagueness of their prescriptive force in actual circumstances ([Suchman 2006](https://doi.org/10.1017/CBO9780511808418.007)). A plan helps people orient themselves while particular bodies, objects, and conditions complete its meaning on site. The same remainder lives in code, a score, a tutorial, a prompt, or a model: a format can reproduce a usable effect when the downstream system does not require the whole practice and relationships from which that effect grew.

`reproducibility of effect ≠ reproducibility of practice ≠ reproducibility of relation`

This technical distinction keeps an account of loss close to the material. Tacit knowledge, mutual timing, a history of trust, hesitation before an irreversible act, and responsibility in a particular situation have low transferability between formats. They may be decisive in live work while remaining weak signals in a collection.

## After abundance

The three patches still wait in the repository at night. The low cost of creating a candidate has not reduced the cost of understanding: every diff enters a system with users, on-call shifts, team habits, and future changes. Generative programming moves a substantial share of work from typing code toward maintaining the conditions from which code can be reconstructed, including tests, types, boundaries, names, documentation, history, dependency provenance, and clear authority over the final transition.

Measurements yield divergent estimates of that transfer. In a randomized METR study, experienced open-source developers using early-2025 tools took 19 percent longer on familiar tasks ([METR 2025](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/)); a later experiment with newer agents pointed toward possible speedups, but participant and task selection made the estimate unreliable ([METR 2026](https://metr.org/blog/2026-02-24-uplift-update/)). A separate manual evaluation found that functionally correct agent code often still needed work on tests, formatting, and general quality before it could be used ([METR 2025](https://metr.org/blog/2025-08-12-research-update-towards-reconciling-slowdown-with-time-horizons/)). These results remain bounded by their tools, repositories, and dates, yet they expose the boundary between producing a candidate and accepting a usable change.

As candidate production becomes cheaper, scarcity moves toward attention, discrimination, verification, and willingness to bind oneself to one result. Three different acts can appear as the same Accept button in telemetry: a reviewer studies the alternatives and understands why one belongs in the situation; a maintainer removes obvious failures; an overloaded engineer confirms the first plausible answer because the queue is already long. Judgment, filtering, and confirmation cross different psychological boundaries even when the interface records one event.

In this scheme, designers, engineers, managers, programmers, and analysts occupy the same functional position: they select. A job title specifies the domain of selection, so the designer chooses form and hierarchy, the engineer draws a boundary and accepts a level of risk, the manager sets direction and priority, the programmer chooses an implementation, and the analyst decides which evidence and measure to trust. The objects of selection and the price of error differ; in each role, one possible candidate acquires the force of a decision.

Automation research has long connected overreliance with monitoring failures and decision bias, especially under heavy workload and unclear system state ([Parasuraman and Riley 1997](https://doi.org/10.1518/001872097778543886)). A formal selector role therefore provides limited authority on its own: refusal remains meaningful while the person has enough time, understanding, and organisational permission to keep a candidate outside. A system can liberalise production and centralise acceptance at the same time, with many people producing candidates while a narrow set of policies, rankings, maintainers, or platforms determines their further life.

Cognitive offloading expands human capacity as we externalise memory and computation, changing a task’s requirements and freeing attention for another level ([Risko and Gilbert 2016](https://discovery.ucl.ac.uk/id/eprint/1508770/)). In generative work, an engineer increasingly remembers a path of reconstruction: where the repository lives, which query will find the answer, which logs matter, which script builds the artefact. This knowledge offers enormous range and also makes the work fragile because the remembered map can omit the point at which reconstruction already changed the object.

Expertise in this environment lives in the ability to preserve a consequential distinction after a smooth result appears. A test can confirm expected behaviour and miss the situation, a review can verify local correctness and overlook a new reading cost, and a metric can call an action successful after it destroyed the fallback path. The formatter proposes; selection binds the proposal to consequences.

## The future-tense archive

An archive usually faces backward: a letter, photograph, recording, or source file preserves a trace of what happened. A generative collection also faces forward because stored material participates in producing instances that have never existed. A photograph sustains memory of a meeting and enters an image space from which another meeting may later be reconstructed; a repository keeps the history of a program and becomes context for the next patch; a language corpus contains utterances and feeds the production of new strings. The archive acquires a prospective tense and becomes a reservoir of possibility.

Recursion begins after publication as a generated explanation becomes documentation, a comment, a search result, and material for the next retrieval; provenance gradually wears away, and a downstream system meets an observation, a human account, a machine summary, and a synthesis based on summaries as equally available strings. Research on recursive training demonstrates a narrow technical case of this apparatus: when successive models learn from data produced by earlier models, the distribution can lose its rare edges and eventually collapse ([Shumailov et al. 2024](https://www.nature.com/articles/s41586-024-07566-y)). Cultural recursion is wider and begins before another training run, as reproduced material already serves as evidence, example, and ground for a decision.

A continuously assembled world depends on earlier acts of admission, naming, and exclusion, and an available effect can travel far from the event, labour, and infrastructure that once stood behind it. Collection, selection, and formatting occupy the interval between those conditions: they prepare reality for reconstruction and determine which of its parts can act after the originating encounter has disappeared.

The organisation of memory changes as preservation of an object comes to sit beside preservation of enough material for its future reconstruction, with different criteria of completeness for the two tasks. A recording of a musical evening preserves one occurrence, while an annotated corpus promises a space of similar performances; the richness of the second can conceal the loss of what made the first a shared event.

## When format turns back toward the work

A support message arrives after midnight: “export sometimes loses the last page.” The sentence carries an interruption somebody lived through, yet it cannot enter the queue until the form asks for a browser, version, file size, account tier, reproduction steps, expected result, and screenshot. Each field improves the chance of finding the defect. Together they teach reporters which parts of an experience count as a useful issue and which parts will remain outside triage.

By morning, the report has become a row that can be grouped with similar rows, scored for severity, attached to a release, and retrieved as context for a later patch. The original frustration survives only where the schema admitted it. If the reporter learns to reproduce the failure before writing, remove uncertain details, and phrase the result in the product's vocabulary, capture has begun reorganising observation before the form opens.

Generative tools extend that pressure upstream. Well-formed issues are easier to retrieve, summarize, and turn into candidate fixes; unusual reports with incomplete metadata remain harder to recognize even when they describe the more consequential failure. The collection gradually rewards experiences already shaped like its own records, so a clean archive can become evidence of a clean product after inconvenient events have failed admission.

## Custody of consequences

Power in a generative chain is distributed across these kinds of labour. The clerk decides which material receives a record, name, and public address; generative software acts as the formatter and turns selected material into a set of available candidates; a selector selects one of them and binds it to action; the platform governs circulation. A museum, standards body, search engine, model provider, maintainer team, and social network can hold these roles separately; consequences arise from their composition.

Human presence is therefore most useful as continuity of responsible custody across the chain. Someone remains answerable for admitting material to a collection, establishing a category and removing a distinction, choosing retrieved sources, accepting a candidate, preserving a route of retraction, and explaining why the result continues to act. Authorship is one possible relation, while custody covers the places where a trace changes status and enters another system.

At 2:47 I close two patches and leave the third on screen. It still carries an unnecessary layer, but its vocabulary belongs to the product, a test reproduces the rare case, and the module boundary has become clearer for the next person. I change several lines, write down the reason for the decision, and run the checks again. In the morning the commit will look like a new piece of code, although its human part will remain in the selection, in the distinctions that survived, and in the readiness to answer for what became real to other people after merge.

---

## References

- Philip E. Agre. “Surveillance and Capture: Two Models of Privacy.” *The Information Society* 10(2), 1994. https://doi.org/10.1080/01972243.1994.9960162
- Geoffrey C. Bowker, Susan Leigh Star. *Sorting Things Out: Classification and Its Consequences*. MIT Press, 1999. https://mitpress.mit.edu/9780262024617/sorting-things-out/
- Lev Manovich. “Database as Symbolic Form.” *Convergence* 5(2), 1999. https://doi.org/10.1177/135485659900500206
- Lev Manovich. “Data.” In *Critical Terms in Futures Studies*, 2019. https://manovich.net/index.php/projects/data
- Erik Åberg. *Division Dialogues: On the Components and Practice of Juggling*. Stockholm University of the Arts, 2026. https://www.researchcatalogue.net/view/4392556/4392557
- Lucy A. Suchman. *Human-Machine Reconfigurations: Plans and Situated Actions*. Cambridge University Press, 2006. https://doi.org/10.1017/CBO9780511808418
- Raja Parasuraman, Victor Riley. “Humans and Automation: Use, Misuse, Disuse, Abuse.” *Human Factors* 39(2), 1997. https://doi.org/10.1518/001872097778543886
- Evan F. Risko, Sam J. Gilbert. “Cognitive Offloading.” *Trends in Cognitive Sciences* 20(9), 2016. https://doi.org/10.1016/j.tics.2016.07.002
- Ilia Shumailov et al. “AI models collapse when trained on recursively generated data.” *Nature* 631, 2024. https://doi.org/10.1038/s41586-024-07566-y
- METR. “Measuring the Impact of Early-2025 AI on Experienced Open-Source Developer Productivity.” 2025. https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/
- David Rein. “Research Update: Algorithmic vs. Holistic Evaluation.” METR, 2025. https://metr.org/blog/2025-08-12-research-update-towards-reconciling-slowdown-with-time-horizons/
- Joel Becker et al. “We are Changing our Developer Productivity Experiment Design.” METR, 2026. https://metr.org/blog/2026-02-24-uplift-update/

## Nearby on this site

- [Executable Traces](20260804140000_executable_traces.html)
- [Inferentia & Probabilisticum](20260703120000_inferentia_probabilisticum_en.html)
- [Post-Simulacrum Self-Service Without Contact](20260714120000_post_simulacrum_self_service_without_contact_en.html)
- [pray](20260626120000_prayfile_language_before_inference_en.html)
