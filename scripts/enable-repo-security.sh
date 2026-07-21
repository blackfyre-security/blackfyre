#!/usr/bin/env bash
# Blackfyre — enable native GitHub security features that live in repo SETTINGS
# (not in the tree): secret scanning, push protection, and private vulnerability
# reporting. Optionally, branch protection on main.
#
# These are admin API actions, so this script is DRY-RUN BY DEFAULT: it prints the
# exact calls and bodies it would send. Re-run with --apply to execute.
#
#   ./scripts/enable-repo-security.sh                          # dry-run, preview only
#   ./scripts/enable-repo-security.sh --apply                  # enable scanning + push protection + PVR
#   ./scripts/enable-repo-security.sh --apply --with-branch-protection
#
# Requires: gh (GitHub CLI, https://cli.github.com) authenticated with admin on the repo.
set -euo pipefail

REPO="${REPO:-blackfyre-security/blackfyre}"
APPLY=0
BRANCH_PROTECTION=0
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=1 ;;
    --with-branch-protection) BRANCH_PROTECTION=1 ;;
    -h | --help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown arg: $arg" >&2; exit 2 ;;
  esac
done

# --- preflight ---------------------------------------------------------------
command -v gh >/dev/null || { echo "gh CLI not found: https://cli.github.com"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "Not authenticated. Run: gh auth login"; exit 1; }
echo "Target repo: $REPO   (apply=$APPLY, branch-protection=$BRANCH_PROTECTION)"
echo

api_patch() { # $1 = human label, stdin = JSON body
  local body; body="$(cat)"
  echo "→ $1"
  echo "  PATCH repos/$REPO"
  echo "  body: $body"
  [ "$APPLY" -eq 1 ] && printf '%s' "$body" | gh api -X PATCH "repos/$REPO" --input - >/dev/null && echo "  ✓ applied" || { [ "$APPLY" -eq 0 ] && echo "  (dry-run — pass --apply)"; }
  echo
}

# 1) Secret scanning + push protection (free on PUBLIC repos)
api_patch "Enable secret scanning + push protection" <<'JSON'
{"security_and_analysis":{"secret_scanning":{"status":"enabled"},"secret_scanning_push_protection":{"status":"enabled"}}}
JSON

# 2) Private vulnerability reporting (lets researchers report privately, not via public issue)
echo "→ Enable private vulnerability reporting"
echo "  PUT repos/$REPO/private-vulnerability-reporting"
if [ "$APPLY" -eq 1 ]; then
  gh api -X PUT "repos/$REPO/private-vulnerability-reporting" --silent && echo "  ✓ applied"
else
  echo "  (dry-run — pass --apply)"
fi
echo

# 3) OPTIONAL branch protection on main.
#    NOTE: the "contexts" below must EXACTLY match the check-run names GitHub reports.
#    Verify them against the checks list on any recent PR (or set protection once in the
#    Settings UI, which lets you pick from observed names) before requiring them here —
#    a wrong name means PRs wait forever on a check that never reports.
if [ "$BRANCH_PROTECTION" -eq 1 ]; then
  echo "→ Set branch protection on main (required checks, 1 CODEOWNERS review, linear history, no force-push)"
  read -r -d '' BP_BODY <<'JSON' || true
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "CI / Platform — build + typecheck + lint + unit tests",
      "Secret scan / gitleaks"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "require_code_owner_reviews": true,
    "required_approving_review_count": 1
  },
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "restrictions": null
}
JSON
  echo "  PUT repos/$REPO/branches/main/protection"
  echo "  body: $BP_BODY"
  if [ "$APPLY" -eq 1 ]; then
    printf '%s' "$BP_BODY" | gh api -X PUT "repos/$REPO/branches/main/protection" --input - >/dev/null && echo "  ✓ applied"
  else
    echo "  (dry-run — pass --apply)"
  fi
  echo
else
  echo "→ (branch protection skipped — pass --with-branch-protection to include it)"
  echo
fi

echo "Done. Verify at: https://github.com/$REPO/settings/security_analysis"
