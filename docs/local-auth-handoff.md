# Local authentication handoff

## Problem

The server generates a cryptographically random bearer token per launch. That
token authorizes every vault and credential operation. The original handoff
published it to a file (for example `<tmp>/aegis/server.token`) and expected the
UI to read it.

A browser page cannot read arbitrary files from disk. The File System Access API
requires an explicit user gesture and a file picker, so it is not a startup
handoff. Reading the file is only possible for a native process (Electron/Tauri
main process, a launcher, a CLI). The browser UI therefore had no legitimate way
to obtain the token.

The obvious browser workarounds are all unacceptable:

| Mechanism                         | Why not                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| `?token=…` in the URL             | Lands in history, the address bar, `Referer`, proxy logs, and screenshots.             |
| `localStorage` / `sessionStorage` | Readable by any script in the origin, including an XSS payload, and persisted to disk. |
| Log line / console                | Persisted, copied by log shippers, visible to support tooling.                         |
| Token file                        | The browser cannot read it; a native helper is required.                               |

## Chosen mechanism: server-installed HttpOnly session cookie

The trusted local server already holds the token in memory. It delivers the
credential to the browser over the one channel a browser is designed to protect:
an `HttpOnly` cookie.

```
browser (same origin)                 local server
        |                                   |
        | POST /auth/session                |
        | x-aegis-handoff: 1                |
        |---------------------------------->|
        |                                   |  Set-Cookie: aegis_session=<token>
        |                                   |    Path=/; HttpOnly; SameSite=Strict
        |<----------------------------------|
        | 204 No Content (empty body)       |
        |                                   |
        | GET /vaults/...                   |
        | Cookie: aegis_session=<token>     |
        |---------------------------------->|  constant-time verify
        |<----------------------------------|
```

Properties:
- **Never in a URL, `localStorage`, or logs.** The token appears only in the
  `Set-Cookie` response header and the subsequent `Cookie` request header.
- **Not readable by page JavaScript.** `HttpOnly` means an XSS payload cannot
  read or exfiltrate the long-lived token. It can still act inside the page, but
  the token itself does not leave the browser.
- **Session cookie, not persisted.** No `Max-Age`/`Expires` is set, so the
  browser keeps it in memory and drops it when the browser session ends. A token
  restored from a previous launch is harmless because the server rotates the
  token every launch.
- **Host-only.** No `Domain` attribute, so it is never sent to a sibling
  hostname.
- **`SameSite=Strict` plus the existing request checks.** The global security
  hooks already reject foreign `Host` values (DNS rebinding), non-allowlisted
  `Origin` values, and `Sec-Fetch-Site: cross-site`. The handoff endpoint also
  requires `x-aegis-handoff: 1`, which a cross-site form or image cannot set and
  which forces a CORS preflight that the server never grants. A cross-site
  request therefore cannot install a session, and a cross-site request cannot
  use one. These are **browser** controls; they do not authenticate a
  non-browser local caller (see the trust boundary below).
- **No `Secure` flag.** Aegis binds plain HTTP on loopback (`127.0.0.1`), where a
  `Secure` cookie would never be sent. Loopback traffic does not cross a network
  boundary; the `Host`/`Origin` checks are the transport guard. If Aegis ever
  serves over TLS, add `Secure` to `buildSessionCookie`.
- **No CORS.** The UI is served from the same origin as the API. A separate dev
  server should proxy `/auth` and `/vaults` so the browser still sees one
  origin; enabling cross-origin credentialed requests would also require an
  explicit CORS policy and is intentionally out of scope.

## Trust boundary: the listener, not the OS user

`POST /auth/session` is intentionally **unauthenticated with respect to the
operating system**. It has to be: before the handoff the browser has no
credential to present, and Node cannot recover the OS user of a TCP peer.

The `x-aegis-handoff` header, `SameSite=Strict`, and the
`Host`/`Origin`/`Sec-Fetch-Site` hooks are **browser CSRF defenses, not
authentication factors**. A non-browser local process can:
- send `x-aegis-handoff: 1` itself,
- omit `Origin` (the hooks only validate an `Origin` that is present), or
- replay the exact request a browser would make.

Loopback is shared by all local users on most systems, so any process that can
connect to the listener can obtain a session cookie. The actual boundary is:

> **Any process that can reach the loopback listener is trusted to attempt
> authentication.** The per-launch token gates accidental and remote access and
> browser CSRF. The vault passphrase remains the secret that protects the data.
> This transport does **not** provide OS-user isolation.

This is acceptable for the intended single-user, local-first deployment, where
the desktop session is the trust domain. It is **not** acceptable on a
multi-user host where other OS users are untrusted. Enforcing the OS-user
boundary requires an OS-scoped channel and a native component:
- POSIX: a Unix domain socket in a `0700` directory (the socket file itself
  `0600`), plus a native launcher/bridge that the browser talks to.
- Windows: a named pipe with a DACL limited to the current user SID, plus the
  same native bridge.

The browser cannot connect to a Unix socket or named pipe directly, so this
requires a native component that the repository does not yet ship. Until then,
deployments that need multi-user isolation should run Aegis under a dedicated
OS account, container, or VM.

### Endpoints

- `POST /auth/session` — installs the cookie. Requires `x-aegis-handoff: 1`.
  Returns `204` with an empty body; the token is only in `Set-Cookie`.
- `GET /auth/session` — probe. `204` when the cookie is valid, `401` otherwise.
  Lets the UI decide between "open the vault" and "unlock/initialize" without
  ever handling the token.
- `DELETE /auth/session` — expires the cookie (`Max-Age=0`). Local sign-out.

### Non-browser clients

CLI tools, native launchers, and automation continue to use
`Authorization: Bearer <token>`. The verifier accepts either source. Writing a
token file is now **opt-in** via `AEGIS_TOKEN_FILE`; there is no default secret
on disk. A supplied `AEGIS_API_TOKEN` disables the file entirely.

## Alternatives considered

- **Native preload bridge (Electron/Tauri).** The native main process reads the
  file and injects the token into the webview. This works, but the repository
  does not ship a native shell, and a preload bridge still exposes the token to
  page JavaScript. The cookie approach is strictly stronger for a browser UI and
  needs no new runtime.
- **`window.postMessage` from a native host.** Equivalent to the preload bridge,
  with an additional origin-checking burden and no benefit for a browser-only
  UI.
- **One-time code in the URL, exchanged for a cookie.** Removes the long-lived
  token from the URL, but still puts a credential in browser history/logs and
  adds a round trip. The server already knows it is serving the trusted origin,
  so it can install the cookie directly.
- **CORS with credentials for a separate dev origin.** Larger attack surface and
  unnecessary; a dev proxy keeps one origin.

## Code map

- `apps/server/src/http/session.ts` — cookie parse/serialize helpers.
- `apps/server/src/http/routes/session.ts` — handoff, probe, and sign-out routes.
- `apps/server/src/http/auth.ts` — accepts header or cookie in constant time.
- `apps/server/src/http/build-server.ts` — wires the routes and authenticator.
- `apps/server/src/config.ts` — token file is opt-in.
- `apps/web/src/auth/session.ts` — `SessionClient`; never reads or stores the
  token, always uses `credentials: 'same-origin'`.

## Tests

- `apps/server/src/http/session.test.ts` — cookie format/parsing bounds.
- `apps/server/src/http/session-handoff.test.ts` — issuance, CSRF rejection,
  cookie authentication, probe, sign-out, and "the token never reaches the log".
- `apps/web/src/auth/session.test.ts` — the UI requests the cookie without a
  token in the URL/body/headers and never adds `Authorization`.

## Residual considerations

- Any local process that can reach the listener can obtain a session cookie
  (see [Trust boundary](#trust-boundary-the-listener-not-the-os-user)). This is
  true regardless of which OS user owns the process. The OS-user boundary is
  **not** provided by the loopback transport; do not treat `127.0.0.1` as
  user-scoped.
- `POST /auth/session` is unauthenticated by design (it is the bootstrap). The
  browser controls reduce cross-site risk only; they do not authenticate a
  local caller. The endpoint only ever returns `204` and never echoes the token
  in a body.
- On Windows the opt-in token file's `0o600` mode is not an ACL guarantee. The
  parent directory ACL is the control; verify it before enabling the file.
