# DCode Docs

Documentation is organized by reader intent, not by document type.

| Directory                       | For whom           | What lives here                                                                                                    |
| -------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [`guides/`](guides)             | Users & operators   | How to deploy, test, and run the product. Server deployment, WebUI, Hub testing, CDP debugging.                    |
| [`contributing/`](contributing) | Contributors        | Dev environment setup, file-structure conventions, PR automation workflow.                                         |
| [`theming/`](theming)           | Contributors        | Design tokens and theming conventions.                                                                              |
| [`prds/`](prds)                 | Product team        | Formal Product Requirement Documents maintained by the product team. **Do not reorganize without their consent.** |

## Quick pointers

- Setting up a dev environment? See [`contributing/development.md`](contributing/development.md).
- Writing code? The entry point for code-style, linting, formatting, and commit rules is [`AGENTS.md`](../AGENTS.md) at the repo root.
- Deploying a server? [`guides/deploy-server.md`](guides/deploy-server.md).

## Where to put new docs

| Content type                                       | Destination                  |
| ---------------------------------------------------- | ------------------------------ |
| User/ops-facing how-to                             | `guides/`                    |
| Contributor convention, workflow, or tooling rule  | `contributing/`               |
| Design tokens / theming convention                 | `theming/`                    |
| Formal PRD owned by product team                   | `prds/` (coordinate first)   |
