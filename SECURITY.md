# Security

This is a static GitHub Pages site with no backend, database, login, forms, cookies, JavaScript, third-party scripts, external fonts, analytics, or API calls.

Security design:
- restrictive Content Security Policy
- scripts disabled
- forms disabled
- frames/plugins disabled
- no-referrer policy
- same-origin stylesheet only
- HTTPS-only deployment via GitHub Pages
- no dynamic input processing

Operational recommendations:
1. Keep GitHub Pages Enforce HTTPS enabled.
2. Verify feihanhuang.com in GitHub profile-level Pages settings.
3. Enable GitHub 2FA + passkey and store recovery codes offline.
4. Enable Spaceship 2FA/passkey.
5. Keep domain privacy, auto-renew, DNSSEC, and transfer lock enabled where available.
6. Do not add wildcard DNS records.
7. Avoid third-party JavaScript unless necessary.
8. Review OAuth apps, GitHub Apps, SSH keys, deploy keys, and PATs periodically.
