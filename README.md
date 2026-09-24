# Phishing Domain Guard

**Phishing Domain Guard** is a Manifest V3 browser extension for Google Chrome and other Chromium-based browsers. It helps detect phishing websites, lookalike domains, typosquatting, suspicious sign-in pages, and domains impersonating protected banks, media brands, public institutions, and other services.

The extension is primarily designed for Czech users and currently includes Czech banks and selected Czech services, while the detection engine itself is not limited to `.cz` domains.

> Phishing Domain Guard is an additional security layer, not a guarantee that a website is safe. Always verify the address before entering passwords, payment details, or other sensitive information.

## Features

- Lookalike-domain and typosquatting detection
- Basic homograph/confusable-character protection
- Protected entities with brands, aliases, official domains, and known sign-in hosts
- Support for short bank brands such as KB and RB
- Public phishing-feed checks
- Domain-age checks through RDAP on suspicious sign-in pages
- Public Suffix List support for correct registrable-domain detection
- User-defined protected domains
- User-defined trusted exceptions
- Optional protected-list synchronization from GitHub
- Local fallback database when the remote list is unavailable
- SHA-256 fingerprint display for downloaded protected-list data
- Manifest V3 service worker architecture

## How it works

When a page is opened, the extension evaluates its hostname and compares it with protected entities. A protected entity can contain:

- an institution or service name,
- a category,
- official root domains,
- known sign-in hosts,
- brand names and aliases.

Example:

```json
{
  "id": "kb",
  "name": "Komerční banka / Mojebanka",
  "category": "bank",
  "domains": [
    "kb.cz",
    "mojebanka.cz"
  ],
  "hosts": [
    "login.kb.cz",
    "plus.kb.cz"
  ],
  "brands": [
    "kb",
    "komercni banka",
    "komercnibanka",
    "mojebanka"
  ]
}
```

This allows the extension to detect suspicious domains such as:

```text
kb-login.cz
rb-login.cz
george-login.cz
csob-secure.cz
airbamk.cz
```

while avoiding simple substring matching that would create unnecessary false positives.

## GitHub protected-list synchronization

The extension includes a built-in protected list as a fallback. An updated list can optionally be loaded from this repository:

```text
https://raw.githubusercontent.com/JN5555/phishing-domain-guard/main/protected-list.json
```

A normal GitHub file URL is also accepted:

```text
https://github.com/JN5555/phishing-domain-guard/blob/main/protected-list.json
```

The extension converts it internally to a Raw GitHub URL.

Synchronization can be performed:

- manually,
- every 6 hours,
- once a day,
- once a week.

If the download fails or the JSON does not pass validation, the last valid downloaded copy remains active. If no valid downloaded copy exists, the built-in list is used.

## `protected-list.json` format

```json
{
  "schema": 1,
  "version": "2026-09-24",
  "updated": "2026-09-24",
  "entities": [
    {
      "id": "airbank",
      "name": "Air Bank",
      "category": "bank",
      "source": "ČNB + Air Bank",
      "domains": ["airbank.cz"],
      "hosts": ["ib.airbank.cz"],
      "brands": ["airbank", "air bank"]
    }
  ],
  "disabledIds": []
}
```

Each entity must have a unique `id`, a `name`, and at least one valid entry in `domains`. `hosts` and `brands` are optional.

Remote entries with the same `id` replace built-in entries. New IDs are added. IDs listed in `disabledIds` are disabled even if they still exist in the built-in fallback database.

## Security of remote updates

The remote list is treated strictly as data, not executable code.

The extension:

- accepts only HTTPS GitHub / Raw GitHub URLs for the protected list,
- downloads the list only from `raw.githubusercontent.com`,
- parses it as JSON,
- validates its structure and domain values,
- limits the downloaded file size to 1 MB,
- stores the last valid copy in `chrome.storage.local`,
- calculates a SHA-256 fingerprint of the downloaded JSON,
- keeps the built-in protected database as an offline fallback,
- limits extension storage access to trusted extension contexts where supported.

For repository security, enabling GitHub two-factor authentication and protecting the `main` branch is strongly recommended.

## Phishing feeds

The extension can download public phishing lists, including sources such as:

- OpenPhish
- phish.co.za

These lists are downloaded into the browser and matching is performed locally. The extension does not submit each visited URL to a phishing-feed provider for classification.

## Domain-age checks

When a password field appears on an unknown website, the extension can query RDAP to determine the approximate age of the registrable domain.

Only the registrable domain, for example:

```text
example.cz
```

is sent to the RDAP service. The full page URL, page content, form data, and password are not sent.

## Public Suffix List

The extension uses the Public Suffix List to correctly determine registrable domains such as:

```text
example.co.uk
example.com.pl
example.co.jp
```

If the current list cannot be downloaded, the extension uses its local fallback data.

## Privacy

Phishing Domain Guard does not contain advertising, analytics, or tracking SDKs.

Most detection is performed locally in the browser. Network access is used only for security-related data such as phishing feeds, RDAP responses, the Public Suffix List, and the optional GitHub protected list.

See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

## Permissions

### `webNavigation`

Used to detect top-level navigation so the destination domain can be evaluated for phishing or impersonation.

### `storage`

Used for user settings, trusted/protected custom domains, and local security-data caches.

### `alarms`

Used for periodic phishing-feed and protected-list updates.

### `activeTab`

Used after the user opens the extension popup to display the security status of the currently active page.

### `unlimitedStorage`

Used for larger local security datasets such as public phishing feeds and Public Suffix List data.

## Host permissions

Network access is limited to security-related providers currently declared in `manifest.json`, including:

```text
https://openphish.com/*
https://phish.co.za/*
https://rdap.nic.cz/*
https://rdap.org/*
https://publicsuffix.org/*
https://raw.githubusercontent.com/*
```

## What the extension does not do

Phishing Domain Guard does not:

- read or store passwords,
- send password contents,
- send form contents,
- use advertising trackers,
- use analytics trackers,
- sell user data,
- execute JavaScript downloaded from GitHub.

## Manual installation

1. Download the latest release ZIP.
2. Extract the archive.
3. Open:

```text
chrome://extensions
```

4. Enable **Developer mode**.
5. Click **Load unpacked**.
6. Select the extracted extension directory.

## Development

Clone the repository:

```bash
git clone https://github.com/JN5555/phishing-domain-guard.git
cd phishing-domain-guard
```

Load the repository directory through `chrome://extensions` using **Load unpacked**.

After changing source files, use the **Reload** button on the extension card.

## Updating the protected list

Edit `protected-list.json`, then commit and push it:

```bash
git add protected-list.json
git commit -m "Update protected domain list"
git push
```

Users with GitHub synchronization enabled will receive the updated list during their next synchronization.

## Releasing a new extension version

Increase the version number in `manifest.json`, for example:

```json
"version": "0.5.2"
```

Then commit and tag the release:

```bash
git add .
git commit -m "Release 0.5.2"
git tag v0.5.2
git push
git push origin v0.5.2
```

A packaged ZIP can then be attached to the corresponding GitHub Release and submitted to the Chrome Web Store.

## Reporting false positives or missing domains

Use GitHub Issues:

https://github.com/JN5555/phishing-domain-guard/issues

For reports involving a legitimate institution, include the domain, institution name, and preferably an authoritative source confirming the official domain.

Never include passwords, authentication codes, payment details, or other sensitive information in an issue.

## Repository

https://github.com/JN5555/phishing-domain-guard

## License

No open-source license is included yet. Without an explicit license, normal copyright restrictions apply.
