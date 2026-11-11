#!/usr/bin/env bash
# Commits the recent knr-web changes to master in meaningful batches.
# Batches whose files have no changes (already committed) are skipped, so it is safe to re-run.
# Run from the repo root:  ./commit-batches.sh [--push]
set -euo pipefail

PUSH=0
[[ "${1:-}" == "--push" ]] && PUSH=1

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "Not inside a git repo."; exit 1; }
cd "$(git rev-parse --show-toplevel)"

# Make sure we're on master
branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$branch" != "master" ]]; then
  echo "On '$branch', switching to master..."
  git checkout master
fi

# Don't sweep up unrelated work that was already staged
git reset -q

# commit_batch "message" file1 file2 ...
# Stages only the listed files that actually changed (including deletions), then commits them.
commit_batch() {
  local msg="$1"; shift
  local files=()
  for f in "$@"; do
    if { [[ -e "$f" ]] || [[ -n "$(git ls-files -- "$f")" ]]; } && [[ -n "$(git status --porcelain -- "$f")" ]]; then
      files+=("$f")
    fi
  done
  if [[ ${#files[@]} -eq 0 ]]; then
    echo "skip   - ${msg%%$'\n'*} (no changes)"
    return
  fi
  git add -- "${files[@]}"
  git commit -q -m "$msg"
  echo "commit - ${msg%%$'\n'*}"
  printf '           %s\n' "${files[@]}"
}

commit_batch "fix(header): make mobile hamburger menu work after page transitions

Bind toggle handlers once on document so they survive ClientRouter swaps.
Close on link tap, outside tap, Escape and resize; style the dropdown as a
floating panel and animate the hamburger into an X." \
  src/components/layout/Header.astro

commit_batch "feat(hero): add drifting dot-grid texture beside the IDE card

Decorative left-side texture (dot grid plus soft glow) that fades toward
the code card. Hidden on narrow screens and static for reduced motion." \
  src/components/sections/Hero.astro

commit_batch "feat(home): add black info strip between Live demos and KNR Cards

New InfoStrip section with placeholder at-a-glance stats, wired into the
home page between Showcase and KnrCards." \
  src/components/sections/InfoStrip.astro \
  src/pages/index.astro

commit_batch "feat(motion): fade three.js scenes in with Motion

Add FadeIn3D, an opacity-only Motion wrapper, and wrap the Hero, Services,
Process, Sonar, KNR card and Contact canvases in it so they ease in instead
of popping in. No transforms, so the scenes still measure true canvas size,
and the scenes' own inline opacity and masks keep working. Click-through
except the KNR card. Skipped for reduced motion.

Hero3D now finds its host with closest('.hero') since the canvas is no
longer a direct child of the section." \
  src/components/motion/FadeIn3D.tsx \
  src/components/ui/Hero3D.tsx \
  src/components/ui/Services3D.tsx \
  src/components/ui/Process3D.tsx \
  src/components/ui/Sonar3D.tsx \
  src/components/ui/KnrCard3D.tsx \
  src/components/ui/Contact3D.tsx

commit_batch "feat(footer): redesign with CTA row, numbered nav and slimmer zipper

Add a call-to-action row (headline, Get in touch button, email), numbered
mono column headings with animated underline links, a compact brand block,
and a rounded bottom bar with social icons and back-to-top. The zipper
motif is reduced to a hairline. Drop the duplicate Privacy/Terms row and
add visible focus styles; hover motion is off for reduced motion." \
  src/components/layout/Footer.astro

commit_batch "feat(contact): replace demo carousel with a black and white photo

Swap the live demo carousel beside the form for a single photo, rendered
grayscale to match the rest of the site. Remove the demo list, carousel
markup, styles and autoplay script." \
  src/components/sections/Contact.astro

commit_batch "feat(faq): replace head-and-chips illustration with floating CRT

New CRT3D three.js scene: a monochrome CRT monitor that floats, leans toward
the pointer and types out a short audit log, with breathing ground rings and
drifting wire cubes. Pauses off-screen, static for reduced motion, silent
without WebGL. Remove the unused BrainChips illustration." \
  src/components/ui/CRT3D.tsx \
  src/components/sections/FAQ.astro \
  src/components/ui/BrainChips.astro

# Report anything left over rather than committing it blindly
leftover="$(git status --porcelain)"
if [[ -n "$leftover" ]]; then
  echo
  echo "Not committed (review these yourself):"
  echo "$leftover"
fi

if [[ $PUSH -eq 1 ]]; then
  echo
  git push origin master
else
  echo
  echo "Done. Run 'git push origin master' when ready (or rerun with --push)."
fi