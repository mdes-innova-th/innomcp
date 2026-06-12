#!/bin/sh
# secrets-guard.sh

fail() {
    printf "%s\n" "$1"
    printf "Bypass with: git commit --no-verify (DISCOURAGED: risks leaking secrets!)\n"
    exit 1
}

TMPFILE="${TMPDIR:-/tmp}/secrets-guard.$$"
trap 'rm -f "$TMPFILE"' EXIT

git diff --cached --name-only --diff-filter=ACM > "$TMPFILE"

OFFENDERS=""
while IFS= read -r f; do
    base=$(basename "$f")
    case "$base" in
        .env|.env.*)
            if [ "$base" != ".env.example" ]; then
                OFFENDERS="$OFFENDERS $f"
            fi
            ;;
    esac
done < "$TMPFILE"

if [ -n "$OFFENDERS" ]; then
    fail "Blocked: prohibited .env files staged:$OFFENDERS"
fi

if command -v gitleaks >/dev/null 2>&1; then
    if ! gitleaks protect --staged --redact --config .gitleaks.toml; then
        fail "Blocked: gitleaks detected secrets."
    fi
else
    PATTERNS="sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{36}|user_[A-Za-z0-9]{60}|eyJ[A-Za-z0-9_-]+\.eyJ|AKIA[0-9A-Z]{16}|BEGIN PRIVATE KEY|[A-Z_]*TOKEN=[a-fA-F0-9]{32}"
    FOUND_SECRETS=0
    while IFS= read -r f; do
        # allowlist: the security tooling itself + docs carry secret PATTERNS as
        # literals, not real secrets — mirror the gitleaks [allowlist] paths
        case "$f" in
            .gitleaks.toml|.githooks/*|*.md|*.env.example|docs/*|scripts/sanitize-log.js) continue ;;
        esac
        MATCHES=$(git show ":$f" 2>/dev/null | grep -E -a -o "$PATTERNS" || true)
        if [ -n "$MATCHES" ]; then
            FOUND_SECRETS=1
            echo "$MATCHES" | while IFS= read -r m; do
                mask=$(printf "%.6s..." "$m")
                printf "Secret found in %s: %s\n" "$f" "$mask"
            done
        fi
    done < "$TMPFILE"
    if [ "$FOUND_SECRETS" -eq 1 ]; then
        fail "Blocked: fallback scan detected secrets."
    fi
fi

echo "secrets-guard: OK - no secrets detected."
