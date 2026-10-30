# Tucano's site

> **Upstream site.** This is upstream Tucano's marketing page, kept in the tree as reference. It is
> served by upstream at `tucano.sh`, this fork does not deploy it, and every download and GitHub
> link here points at upstream ([eduwxyz/tucano](https://github.com/eduwxyz/tucano)).

Live at **[tucano.sh](https://tucano.sh)**. A single static page: `index.html` (CSS and JS inline) and `assets/`. No build step.

- **Preview:** open `index.html` in a browser. `index.html?shot` shows everything at once (for screenshots).
- **Languages:** Portuguese and English, with the PT | EN switch at the top. Every text is written in both, side by side (`<span lang="pt-BR">` and `<span lang="en">`), and the CSS shows the one matching `<html lang>`; what the scripts draw goes through `T(pt, en)`. With no saved choice it opens in Portuguese if the browser is in Portuguese, otherwise in English.
- **Look:** the shapes of the app icon (the round body, the eye, the two-orange beak) in cream, black and orange. The toucan in the hero, the one in the footer and the agents follow the pointer with their eyes.
- **App screens:** drawn in HTML, not screenshots. The #checkout channel in the "Live" section plays by itself and waits for the visitor to approve.
- **Fonts:** Bricolage Grotesque (headings) and Inter (text), from Google Fonts.
- **Logos:** `assets/logos/` come from [Simple Icons](https://simpleicons.org) (CC0).
- **Publishing:** served by Cloudflare as static files on `tucano.sh` and `www.tucano.sh` (`wrangler.jsonc`; `_headers` adds the security headers, `.assetsignore` keeps this README and the config off the site):

  ```bash
  cd site && npx wrangler deploy
  ```
