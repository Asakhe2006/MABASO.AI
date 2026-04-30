## Render YouTube Setup

Set these backend env vars on `mabaso-ai-api` when YouTube blocks hosted requests:

- `YOUTUBE_COOKIES_TXT`
- `YOUTUBE_COOKIES_FILE`
- `YOUTUBE_PROXY_HTTP_URL`
- `YOUTUBE_PROXY_HTTPS_URL`
- `YOUTUBE_WEBSHARE_PROXY_USERNAME`
- `YOUTUBE_WEBSHARE_PROXY_PASSWORD`
- `YOUTUBE_WEBSHARE_PROXY_HOST`
- `YOUTUBE_WEBSHARE_PROXY_PORT`

Recommended order:

1. Set `YOUTUBE_COOKIES_TXT` first.
2. If you already use Webshare, set `YOUTUBE_WEBSHARE_PROXY_USERNAME` and `YOUTUBE_WEBSHARE_PROXY_PASSWORD`. The backend now reuses those settings for watch-page requests and yt-dlp downloads too.
3. Only use `YOUTUBE_PROXY_HTTP_URL` and `YOUTUBE_PROXY_HTTPS_URL` when you want a custom proxy URL instead of the built-in Webshare backbone format.
4. Use `YOUTUBE_COOKIES_FILE` only if you already have a cookies file available inside the backend container or mounted storage.

Notes:

- `YOUTUBE_COOKIES_TXT` should contain the full Netscape-format cookies text.
- `YOUTUBE_COOKIES_TXT` is usually the easiest option on Render because the backend will write it to a temporary cookie file automatically.
- Proxy values should be full URLs such as `http://username:password@host:port`.
- The default Webshare backbone connection is `http://username:password@p.webshare.io:80`, so most users can leave `YOUTUBE_WEBSHARE_PROXY_HOST` and `YOUTUBE_WEBSHARE_PROXY_PORT` at their defaults.
