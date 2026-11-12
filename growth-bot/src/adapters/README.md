# Integration adapters — fail closed

The bot's autonomous permissions are policy declarations, not proof that an external account is connected.
Each provider adapter must:
- use a dedicated service account/token with least privilege;
- read secrets only from the runtime secret store;
- require a budget reservation before any paid operation;
- write an audit event before and after the operation;
- support pause/kill-switch and idempotency;
- return verified provider receipts before spend is settled.

No provider credentials are included in this repository. Until an adapter is implemented, connected, and tested, its operation must remain disabled (fail closed).

Planned adapters:
- Website: GitHub Actions deployment workflow with protected production environment, smoke tests and rollback.
- Ads: Yandex Direct API and VK Ads API, isolated accounts, daily/monthly hard caps.
- Outreach: approved publication APIs and manually curated business contact sources; consent/lawful-basis and suppression checks before sending.
- Analytics: Yandex Metrica and Google Search Console read-only initially.

Never implement unsolicited bulk email/SMS/DM, scraped personal-contact campaigns, fake engagement, or platform-rule evasion.
