# Aegis Documentation

This directory contains technical design notes, the threat model, architecture decisions, and implementation plans for Aegis.

Application features are intentionally not implemented yet. See the root README for workspace commands.

## Design notes

- [Local authentication handoff](./local-auth-handoff.md) — how the per-launch
  token reaches the trusted browser UI without a URL, `localStorage`, or logs.
