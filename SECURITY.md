# Security Policy

## Reporting a vulnerability

Please report suspected security vulnerabilities privately through GitHub's **Report a vulnerability** feature for this repository. Do not include sensitive personal or financial data in a report, and do not disclose an unresolved issue publicly.

Include the affected component, the steps needed to reproduce the issue, and its potential impact. Do not access, modify, or retain data belonging to other users while investigating.

## Security notes

- Never commit `.env`, credentials, production data, or real financial statements.
- Use unique, strong secrets outside local development and rotate any secret that may have been exposed.
- Production deployments must use HTTPS, secure session cookies, exact origin and host allowlists, and protected PostgreSQL backups.
- LedgeVue imports user-provided transaction files and is not a bank-connected or certified financial service.