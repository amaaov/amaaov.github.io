# auth.md

amaaov.github.io is a personal essay and practice site. Agents and crawlers may read the public pages. This hostname does not register agent accounts and does not mint OAuth access tokens.

## Audience

Readers and agents that need the article index, Markdown mirrors, demos list, and discovery metadata.

## Registration

There is no machine registration endpoint. Humans reach the author through the public contacts on the homepage (Telegram). Agents do not receive credentials from this hostname.

## Methods

- anonymous read of public HTML, Markdown mirrors (`.md` beside many essays), `llms.txt`, feed, and sitemap
- homepage contacts for human messages only

## Credentials

Bearer tokens are not issued. Protected Resource Metadata and Authorization Server Metadata exist so discovery scanners can locate this policy. `GET` of `/oauth/authorize` and `/oauth/token` returns a JSON refusal. Use public URLs without credentials.

## Discovery

- Protected resource: `https://amaaov.github.io/.well-known/oauth-protected-resource`
- Authorization server: `https://amaaov.github.io/.well-known/oauth-authorization-server`
- API catalog: `https://amaaov.github.io/.well-known/api-catalog`
- LLM index: `https://amaaov.github.io/llms.txt`
