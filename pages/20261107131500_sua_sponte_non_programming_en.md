# Spontaneity and Aphesis

**Published:** 7 November 2026  
**Author:** amaaov  
**Language:** English · [Русский](20261107131500_sua_sponte_non_programming.md) · [Suomi](20261107131500_sua_sponte_non_programming_fi.md)  
**HTML:** [English](20261107131500_sua_sponte_non_programming_en.html) · [Русский](20261107131500_sua_sponte_non_programming.html) · [Suomi](20261107131500_sua_sponte_non_programming_fi.html)  
**Licence:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — credit Andrei Makarov / amaaov

---

An argument in the comments under a video about vibe-coded firmware for inexpensive digital synthesisers came to rest on the sequencer. The devices had either an open SDK or firmware that had already been reverse-engineered. My interlocutor was prepared to recognise programming while it remained editable, readable code. Button presses were placed outside the boundary.

A sequencer makes that boundary unusually visible. A musician enters an event, pitch, point in time, or duration; the device stores the pattern and plays it back through time. Program text need never appear. Yet the entered sequence governs the machine’s later behaviour so directly that programming sequencers, patterns, and sounds has long belonged to the vocabulary of manuals and musicians. Once this is programming, the input method cannot serve as a universal boundary.

For this article I use a broad sense: **programming is shaping a computer system’s path through states by means of input the system actually receives and processes**. The source may be a person, another machine, a program, a sensor, or the surroundings once their effect becomes a signal available to the computer. The source’s intention, textual code, and full knowledge of the consequences are not conditions of this definition.

This is deliberately broader than ordinary professional usage. I am not claiming that people already call every letter typed in a word processor programming. I am claiming that the letter and the source file enter the same causal relation: a computer receives input, interprets it under its rules, and moves into another state. Their differences still matter, but those differences do not lie in the dignity of the act or the shape of the interface.

When I start a video, I program the system to play the selected video. When I type a comment, I specify particular letters, the publication of the text, and possible reply notifications. When I write C++, the editor first processes my input as document state; a compiler may later process that document as a description of another system. If the code is never compiled, the executable program does not change. The editor and the file do. Each example therefore needs both the input and the computer system whose behaviour it changes.

One press and a program differ in reach. A press may alter one present state; a stored pattern, script, configuration, or model may govern a class of later transitions. They differ in persistence, expressive range, reversibility, available control, and the consequences a person can inspect. These distinctions do not restore source code’s monopoly over programming. They let us speak more precisely after that monopoly is gone.

Merely observing a computer is not programming. If I look at an unchanging screen and the system does not measure my gaze, no input comes from me. The relation changes where presence is made into an event: starting, pausing, scrolling, watch duration, or a sensor reading receives a machine representation and enters processing. I need not intend to give an instruction. The system can produce a measurement from my interaction. “Giving a computer a command” is therefore nested inside the wider sense, “becoming a source of processed input.”

## After source code

Vibe coding brought this difference back into view without creating it. The name spread widely after [Andrej Karpathy’s post on 2 February 2025](https://x.com/karpathy/status/1886192184808149383). By then public API function calling had existed since [June 2023](https://openai.com/index/function-calling-and-other-api-updates/), the o1-preview service had launched in [September 2024](https://openai.com/index/introducing-openai-o1-preview/) without function calling in its initial API, and MCP had been released in [November 2024](https://www.anthropic.com/news/model-context-protocol). In autumn 2025, reasoning models, tools, and repository work converged into an accessible practice for me. Autumn remains the date when I recognised the change. It became difficult to maintain the appearance that a computer accepts only instructions a person has already cast as source code.

Computers prepared input for further computation long before language models. In 1952 Grace Hopper described a computer assembling a program from a library of routines and a problem description; the authors of FORTRAN wrote in 1957 about enabling the IBM 704 to code problems from mathematical descriptions. Current probabilistic generation works differently, while the possibility of one machine preparing a program for another is old.

This also gives a limited use for *The Matrix*. If two candidate sources are placed under identical conditions and produce the same observable artefact, with no metadata or separate provenance record, the computer will not find a secret “made by a human” mark inside it. When style, timing, a watermark, error distributions, or technical metadata differ, the source can be estimated probabilistically. The illustration is limited to information available to the system; another provenance record may be found elsewhere.

The more systems are connected, the harder it becomes to see the whole path of one action. A comment may remain a record, alter the context of a current session, enter search or moderation, trigger a notification, become a ranking feature, or later appear among material from which training data is selected. The product, settings, region, retention, and later selection determine which branches are taken. Logging, product memory, retrieval, model inference, personalisation, fine-tuning, and weight updates remain different processes. A request to a chat system usually conditions the current output; that alone does not mean the request immediately changed the neural network.

Connections between events exist as data, but a user cannot inspect every link. A legal right of access provides the data relating to a person, the purposes, and some conditions of its processing. In the GDPR cases covering automated decisions, it includes meaningful information about the logic involved, its significance, and the envisaged consequences. That information still does not amount to the service’s internal architecture, every intermediate feature, and the complete path of one event. Traceability for a system operator and observability for the person who pressed the button are different.

This distinction becomes political inside an advertising network. Addressable influence does not always need an ordinary name. A persistent pseudonym, device profile, or another distinguishable address may allow a network to find the same node again and direct selected material towards it. Under European law, pseudonymisation by itself does not remove information from the category of personal data when a person can still be singled out by reasonably available means. The sentence “there is no personal data, but this particular person can be targeted” contradicts itself when addressability connects the traces to a person. Public names may be absent while vulnerability through addressability remains.

## The loop in both directions

I use *inference* more broadly here than it is commonly used in machine learning. In this article it means the processing of data between input and output. Computer inference may consist of calculation, retrieval, ranking, or model execution. By human inference I mean a passage in which a person hears, sees, or undergoes something, followed by understanding, action, and side effects. I define this extended use within the article; technical dictionaries retain narrower meanings.

A book and conventional radio can affect a person deeply, yet they receive no return input from that reader or listener and do not adapt their delivery to that person in the same moment. An interactive system receives an action, processes it, answers, measures the next move, and changes its next answer. A person programs the computer; its output then alters the field in which the person acts. A loop appears.

The second half is easy to overstate as “the computer programs the person.” My first definition made a computer the object of programming, so literal symmetry would break its own condition. There is no symmetry. A computer follows formally specified transitions; a person encounters a selected environment, suggestion, limit, or repetition. In the second half of the loop, *programs* names influence through an interactive medium. The person does not become an executable function.

That distinction matters to me. Mathematics and science can describe human behaviour, bodies, speech, and relations. A bounded model can be accurate and useful for a bounded task. Its success does not make it an exhaustive account of a person or require everyone to accept institutions built as though nothing remained outside it. Someone may choose to describe themselves as a function. Another person may refuse that self-description.

Emergence offers no simple proof of the opposite. Computational systems also produce macroscopic patterns that are hard to see in individual rules. Weak emergence allows a whole pattern to be determined by microdynamics while becoming available only through simulation or another level of description. Formal comparisons between computers and living systems are possible. They do not equalise their material, embodiment, experience, relational history, or moral standing.

When I speak about a person’s wholeness, I am not denying that parts, mechanisms, and particular functions can be studied. I refuse to give a partial description the authority to replace the life from which it was extracted. A person is connected across body, memory, surroundings, earlier decisions, and relationships. A profile cuts those relations to fit the system’s task. It may predict a purchase and still know nothing of the pain, mood, loss, chance discovery, or effort from which an interest grew.

Some properties become visible only along a path. One snapshot does not show direction, pace, dependence on previous states, or a response to disturbance. Even a stable distribution can conceal a continuing current. For a person, this marks a useful boundary of representation: the same position may be a return, a pause, or the start of departure. Wholeness appears in the transition connecting states; a static sum of attributes loses the trajectory.

The same applies to words. An account of experience becomes a new event that selects and orders parts of what happened. Different people may use different words for related phenomena, use one word for different phenomena, or find no words at all. Language can also change attention and later memory. Silence therefore does not prove emptiness, and a formulation gains no authority over a person merely by appearing coherent. When a chat system answers “what is known about me” with a coherent profile, it demonstrates the coherence of its own output. The person decides whether to identify with it or contest it.

Knowledge and the availability of words do not alter basic dignity. This does not make every action equal in consequence or ignorance safe in every role. We can judge harm, obligations, and completed work without turning vocabulary, awareness, or fitness for a model into measures of human worth.

## When the internet ended at the door

I have a life from before the dense layer of recommendations. In 2012 we met in Petrozavodsk, in squares, parks, and on the embankment of Lake Onega. People brought balls, clubs, poi, staffs, unicycles, a slackline, and instruments. We could make arrangements on the spot or simply begin playing beside one another, then go for tea. The internet helped us gather; then the computer was turned off, people went outside, and its work ended at the door.

Around 2016 I began to notice a different pressure. Coordination was becoming an environment where every meeting was expected to leave a correctly formatted continuation: a recording, a photograph, a metric, material for the next display. Computers influenced juggling and music directly and through other people’s behaviour. I watched streaming enter decisions about music, while computational cameras and platforms changed photography and video. The traces of a practice returned to it as conditions of its visibility.

This mediation is often useful when buying things. A system can remove a long analysis of options against requirements, almost a project of its own. The cost is higher in a personal practice because search, error, and an accidental encounter are part of the practice itself. If recommendations repeatedly determine what becomes visible, an interest gradually answers to what the system can readily continue, alongside lived experience, mood, loss, discovery, and effort.

Refusal here is harder than closing one tab. Computational devices are carried by other people too, and institutions and spaces continually produce traces, making exit a shared material question. A right to refuse does not prove that an available exit already exists. It calls for an unpersonalised route, the ability to withhold unnecessary events, intelligible ways to sever a link, and places where participation is not a condition of ordinary life.

## Releasing the next move

Broad programming has no single opposite. Technical unprogrammability means that input cannot change the system through the chosen channel. Autonomy concerns a person’s own measure of action. Spontaneity concerns a movement that remains one’s own even though the world supplies causes and occasions. I also need a term for the side that could exercise control and releases it.

The Greek *aphesis* means letting go, release, dismissal, or remission. English phonetics already gives the word another specialist meaning, so I am not presenting it as established computing terminology. Here, aphesis names an act by the source: declining to set another’s next state, loosening the claim to control, leaving the continuation to the other. Spontaneity names the space that opens after this release, with causes still present and chaos unnecessary.

*Akrateia* and *akrasia* do not fit because they concern a lack of self-mastery and release the wrong side. *Anarchia* concerns the absence of a ruler and carries its own large political history. Aphesis is smaller. It is the concrete end of a claim over the next move.

Three demands follow, and an interface setting cannot absorb them. A person should have the right to remain outside adaptive influence. The people who build a system should retain the possibility of declining to program others even when attention capture and personalisation are technically available. Spaces must remain where the control loop actually stops.

Such a space requires no war against mathematics. I work with computers, numbers, and digital materials every day. A computer remains an instrument for solving particular tasks. That is exactly why I can draw a boundary: the system’s ability to perform a task gives it no authority to decide who a person is; the ability to predict a continuation does not oblige us to provide it in advance.

Somewhere in a forest, a friend and I talk within sight of a shore. We have no devices with us, and there is no perceptible digital observation around us. We have gone beyond the radar. Aphesis has already occurred: nobody holds the next move. What remains is called spontaneity.

## Sources

1. Alan F. Blackwell. “What is Programming?” PPIG, 2002. [PDF](https://ppig.org/files/2002-PPIG-14th-blackwell.pdf)
2. Andrew J. Ko et al. “The State of the Art in End-User Software Engineering.” *ACM Computing Surveys* 43, no. 3, 2011. [DOI](https://doi.org/10.1145/1922649.1922658)
3. Allen Cypher, ed. *Watch What I Do: Programming by Demonstration*, 1993. [Web edition](https://www.acypher.com/wwid/FrontMatter/index.html)
4. Karl J. Åström and Richard M. Murray. *Feedback Systems*, 2008. [PDF](http://www.cds.caltech.edu/~murray/books/AM08/pdf/am08-intro_04Mar10.pdf)
5. YouTube. “YouTube’s recommendation system.” [Product documentation](https://support.google.com/youtube/answer/16533387?hl=en)
6. Mark Bedau. “Weak Emergence.” *Philosophical Perspectives* 11, 1997. [PDF](https://people.reed.edu/~mab/papers/weak.emergence.pdf)
7. Gary Lupyan. “Linguistically Modulated Perception and Cognition.” *Frontiers in Psychology* 3, 2012. [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC3297074/)
8. Regulation (EU) 2016/679, recitals 26 and 30, articles 15 and 20. [EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
9. Henry George Liddell, Robert Scott, Henry Stuart Jones. “ἄφεσις.” *A Greek–English Lexicon*. [Logeion](https://logeion.uchicago.edu/morpho/%E1%BC%84%CF%86%CE%B5%CF%83%CE%B9%CF%82)
10. Grace Hopper. “The Education of a Computer.” ACM, 1952. [DOI](https://doi.org/10.1145/609784.609818)
11. John Backus et al. “The FORTRAN Automatic Coding System.” ACM, 1957. [DOI](https://doi.org/10.1145/1455567.1455599)
12. Stanford Encyclopedia of Philosophy. “Emergent Properties.” [SEP](https://plato.stanford.edu/entries/properties-emergent/)
