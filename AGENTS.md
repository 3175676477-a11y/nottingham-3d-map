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
