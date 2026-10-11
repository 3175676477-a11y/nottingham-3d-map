# Project delivery

The user uses a persistent Mac desktop link, not a manually started Vite server.
After user-requested app changes, run the relevant tests and build, commit and
push `codex/sherwood-hall-map`, then run `npm run release` to publish the built
snapshot to `solar-atlas-releases`. GitHub Actions also attempts publication on
source pushes; publishing an already archived source commit is a no-op.

Each published source commit has its own immutable `releases/v-<12-char-sha>`
directory and a manifest entry. Never overwrite or remove historical releases,
and never force-push the release branch. If a concurrent publisher wins, rerun
the publishing command against the refreshed archive branch.

Keep Vite asset paths and navigation relative so both current and historical
snapshots work under their own directories. The local launcher downloads only
prebuilt snapshots; it does not modify the user's development checkout. The
fixed local link checks for updates on access and the history page selects a
specific snapshot. Further app requests should be delivered to this same link.

Installer changes require a one-time reinstall on the Mac. Ordinary app updates
do not require rerunning installation or copying terminal commands.

# Automatic Finder delivery

The user manually creates public GitHub repositories under `3175676477-a11y`.
After Codex finishes and publishes a webpage, a Mac login service automatically
creates `~/Documents/codex/<repository>/最新版本.webloc` and `历史版本.webloc`.
Never ask the user to manually create per-repository folders or repeatedly run
dev servers. An initial Mac service upgrade is required to enable discovery;
cloud-side work alone cannot install it on the user's Mac.

This repository keeps its existing `solar-atlas-releases` archive and publisher.
Other web repositories use `codex-releases`, immutable `releases/v-<12-char-sha>`
builds and a manifest with latest, entry and versions. Read
`docs/automatic-delivery.md` for the contract and use the standalone
`scripts/publish-task.mjs` after completing tests, build and source commits.
The hub uses separate `/projects/<owner>/<repository>/` routes on port 43173.
Do not point another repository at this project's snapshots. Keep all old builds.

Finder files are generated directly in Documents, never Downloads. Preserve
existing codex folders and unrelated files; only update the two managed links.
The service is for built static web apps. Do not silently run downloaded source
code, install dependencies, or claim it deploys a backend. A different Codex
cloud environment also needs the publishing contract in its startup/custom
instructions; the Mac service cannot set those instructions remotely.
