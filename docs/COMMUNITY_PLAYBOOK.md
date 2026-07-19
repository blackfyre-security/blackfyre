# Community playbook (maintainers)

Operational guide for growing Blackfyre's community. Nothing here auto-posts
anywhere: the [community-digest workflow](../.github/workflows/community-digest.yml)
drafts, humans publish.

## Label taxonomy

The [issue-triage workflow](../.github/workflows/issue-triage.yml) applies these
automatically; `triage:gfi-candidate` is a bot suggestion a maintainer either
promotes to `good first issue` or removes. Create the full set once:

```bash
REPO=blackfyre-security/blackfyre

# Types (GitHub defaults bug/documentation/duplicate/enhancement/question/help wanted/good first issue already exist)
gh label create "security"            -R $REPO -c B60205 -d "Security-relevant — never goes stale" --force
gh label create "needs-repro"         -R $REPO -c FBCA04 -d "Bug report awaiting reproduction info" --force
gh label create "triage:gfi-candidate" -R $REPO -c BFDADC -d "Bot-flagged good-first-issue candidate — maintainer confirms" --force

# Providers
gh label create "provider:aws"        -R $REPO -c FF9900 -d "AWS auditors/integration" --force
gh label create "provider:azure"      -R $REPO -c 0078D4 -d "Azure auditors/integration" --force
gh label create "provider:gcp"        -R $REPO -c 34A853 -d "GCP auditors/integration" --force
gh label create "provider:onprem"     -R $REPO -c 6E7781 -d "On-prem auditors (AD/SNMP/endpoint/OT)" --force

# Frameworks
gh label create "framework"           -R $REPO -c 5319E7 -d "Compliance frameworks / control catalogs / mappings" --force

# Difficulty (set when triaging; pairs with good first issue)
gh label create "difficulty:starter"  -R $REPO -c C2E0C6 -d "<1 day, no architecture knowledge needed" --force
gh label create "difficulty:medium"   -R $REPO -c FEF2C0 -d "A few days; touches one subsystem" --force
gh label create "difficulty:hard"     -R $REPO -c F9D0C4 -d "Cross-cutting or architecture-level" --force

# Process
gh label create "roadmap"             -R $REPO -c 0E8A16 -d "Tracked on ROADMAP.md — never goes stale" --force
gh label create "pinned"              -R $REPO -c D4C5F9 -d "Exempt from stale bot" --force
gh label create "stale"               -R $REPO -c EEEEEE -d "Applied by the stale bot" --force
```

## Discussions categories

Discussions is enabled. Configure these categories (Settings → Discussions):

| Category | Format | Why |
|---|---|---|
| Announcements | Announcement (maintainers post) | Releases, digest posts — the "follow the project" feed |
| Q&A | Question/Answer | Deflects usage questions from Issues; answered = searchable docs |
| Ideas | Open discussion | Pre-issue feature talk; graduate solid ones to Issues |
| Show and tell | Open discussion | Users showing their compliance setups — best social proof there is |
| Compliance corner | Open discussion | Framework interpretation debates (SOC 2 vs ISO mapping etc.) — unique to this project, attracts the non-coder compliance crowd |

## Converting an issue into a good `good first issue`

A `good first issue` is a product you ship to potential contributors. Checklist
before applying the label (the triage bot's `triage:gfi-candidate` is only a hint):

- [ ] **Scoped**: one outcome, one or two files, no architecture decisions left open
- [ ] **Context in the issue body**: exact file paths to touch, the pattern to follow
      (link a neighboring example), what done looks like
- [ ] **Verifiable**: names the exact command that proves it works
      (`npm run test:unit --workspace=packages/api`, or a curl against `:4000`)
- [ ] **No hidden prerequisites**: doable with the compose stack — no cloud account,
      no staging access, no maintainer-only secrets
- [ ] **Add** `difficulty:starter` and the area label (`provider:*` / `framework` / docs)
- [ ] **Respond fast**: first-time contributors churn in days — acknowledge claims
      within 24h, review their PR within 48h if at all possible

## Release announcement template

```markdown
## Blackfyre vX.Y.Z — <one-line theme>

<2-3 sentences: what this release means for a user, not a commit list.>

**Highlights**
- <feature> — <why it matters> (#PR, thanks @contributor!)
- <fix> — <who was hit by it>

**Compliance coverage**: <N> frameworks, <N> controls (+<delta> this release)

**Upgrade**: `git pull && cd platform && npm ci && npm run db:migrate`
<call out any migration/breaking notes>

Full notes: <github release link>
New here? Start with the [15-minute local setup](docs/developer/local-development.md).
```

## Launch & sharing checklist

One community at a time, 2–3 days apart, so you can actually engage the comments.
Angle that works everywhere: **open-source alternative to commercial CSPM/compliance
tools (Wiz/Drata/Vanta et al.) you can self-host** — concrete, verifiable, and each
community gets its own flavor of it. Prerequisites before ANY launch:

- [ ] README screenshots/GIF captured (the dashboard is the hook)
- [ ] Fresh-clone quickstart re-verified that morning (nothing kills a launch like a broken `npm install`)
- [ ] A tagged release exists (social proof: "v0.X released")
- [ ] 3–5 `good first issue`s open and genuinely doable (launch traffic converts via these)
- [ ] You're free for the next 6–8 hours to answer comments

| Where | Norms & what works |
|---|---|
| **Hacker News — "Show HN"** | Title: "Show HN: Blackfyre – open-source multi-cloud compliance scanning (SOC 2, ISO 27001, …)". First comment from you: why you built it, the RLS-below-the-ORM design, honest limitations. No marketing tone — HN rewards technical depth and punishes hype. Tue–Thu, 14:00–16:00 UTC. |
| **Product Hunt** | Full section below. |
| **r/devops** | Frame as tooling: "self-hosted compliance scanning without the SaaS bill". Lead with the docker-compose quickstart. Mention you're the author — Reddit punishes stealth marketing but respects makers answering questions. |
| **r/aws** | Lead with the AWS auditor list (IAM, S3, GuardDuty, CloudTrail…) and Prowler integration. Concrete checks > product pitch. |
| **r/AZURE, r/googlecloud** | Same shape, provider-specific auditor list. Smaller subs, gentler pace. |
| **r/cybersecurity, r/netsec** | r/netsec is link-only + strict (technical write-ups, not products) — post there only with a technical deep-dive (e.g. "enforcing tenant isolation with Postgres RLS below the ORM"). r/cybersecurity allows tool posts on weekends ("Tool Tuesday"-type threads — check current rules). |
| **dev.to** | Long-form articles, not announcements: "Mapping 678 compliance controls across 9 frameworks", "Postgres RLS multi-tenancy in production". Each article links the repo; evergreen search traffic. |
| **X/Twitter** | Thread: 1 hook (the dashboard GIF) + 3-4 tweets of concrete capability + repo link. Tag #opensource #devsecops #compliance. Engage replies same-day. |
| **LinkedIn** | Post from https://www.linkedin.com/in/giridhar-k-203283b3 — the compliance-manager audience lives here, not on HN. Angle: audit-prep pain + evidence vault, less code talk. ~120 words, one image, repo link in first comment or post. |

### Product Hunt launch

Worth doing once there's a GIF, a tagged release, and the README shines — PH
traffic is broad, so the repo must self-explain in 30 seconds.

- **Prep (1–2 weeks out)**: maker account with real history; gallery of 4–6
  images (dashboard first, then scan progress, finding detail, evidence chain) +
  the GIF as the first slot; tagline ≤60 chars — e.g. *"Open-source compliance
  scanning for AWS, Azure & GCP"*; description focused on the job ("get
  audit-ready without a $30k/yr SaaS"), not the stack.
- **Hunter**: self-hunting is fine now; a known hunter adds reach but isn't
  required. Don't pay for one.
- **Launch day**: post 00:01 PT (12:31 IST) for the full 24h window. Your maker
  comment = the Show HN first comment: why, what's hard, what's next, and an
  explicit "compliance people: tell me which framework you need". Answer
  everything all day.
- **Don'ts**: no vote-begging or vote rings (PH delists for it) — a small
  "we're live on PH today" note in Discussions/X/LinkedIn is fine.
- **After**: add the PH badge to the website (not the README — keep it clean),
  and fold the day's feedback into issues while it's hot.

## Contributor recognition ritual

Costs minutes, compounds for years:

- **Release notes**: every contributor thanked by name (`release.yml` includes
  authors; the announcement template has a thanks slot). First-time contributors
  called out as such.
- **README `Contributors` section**: once there are ≥5 external contributors, add
  a contributors graph/grid (all-contributors or contrib.rocks) — premature with 3.
- **SECURITY.md Hall of fame**: credit every accepted vulnerability report.
- **Weekly digest**: the community-digest drafts thank new contributors by name —
  keep those names when you edit and post.
- **Compliance credit too**: someone who corrects a control mapping in an issue
  contributed exactly as much as a code PR — say so publicly, in the release notes.
