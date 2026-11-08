# Literata

Self-hosted webfont for the follow-along transcript.

- Source: <https://fonts.google.com/specimen/Literata>
- Upstream: <https://github.com/googlefonts/literata>
- Version: v40 (Google Fonts), OpenType optical-size (`opsz`) variable, weight 400
- License: SIL Open Font License 1.1 — see [`OFL.txt`](./OFL.txt)

The `latin` and `latin-ext` WOFF2 subsets are vendored so the offline service
worker precaches them like any other same-origin asset. To update, fetch the
`@font-face` declarations from the Google Fonts CSS API and replace the files.
