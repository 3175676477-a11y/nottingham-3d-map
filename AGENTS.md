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

# Finder organization

The user organizes generated web tasks in `~/Documents/Codex任务/<repository>/`.
Each repository folder contains `最新版本.webloc` and `历史版本.webloc`,
pointing at that repository's stable latest/history routes. This repository
uses port 43173; do not point other repositories at its service or archive.
Keep these links stable, continue publishing immutable cloud snapshots, and
retain the existing desktop links for compatibility. The downloadable Finder
folder only contains shortcuts; it relies on the already installed Mac service.
Do not require users to reinstall the service for shortcut organization.
