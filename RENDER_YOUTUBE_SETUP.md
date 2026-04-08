## Render YouTube Setup

Set these backend env vars on `mabaso-ai-api` when YouTube blocks hosted requests:

- `YOUTUBE_COOKIES_TXT`
- `YOUTUBE_COOKIES_FILE`
- `YOUTUBE_PROXY_HTTP_URL`
- `YOUTUBE_PROXY_HTTPS_URL`

Recommended order:

1. Set `YOUTUBE_COOKIES_TXT` first.
2. Only use `YOUTUBE_PROXY_HTTP_URL` and `YOUTUBE_PROXY_HTTPS_URL` if cookies are still not enough.
3. Use `YOUTUBE_COOKIES_FILE` only if you already have a cookies file available inside the backend container or mounted storage.

Notes:

- `YOUTUBE_COOKIES_TXT` should contain the full Netscape-format cookies text.
- `YOUTUBE_COOKIES_TXT` is usually the easiest option on Render because the backend will write it to a temporary cookie file automatically.
- Proxy values should be full URLs such as `http://username:password@host:port`.
