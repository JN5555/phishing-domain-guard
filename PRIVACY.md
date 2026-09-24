# Privacy Policy — Phishing Domain Guard

**Last updated: September 24, 2026**

## Overview

Phishing Domain Guard is a browser-security extension designed to identify phishing websites, lookalike domains, and risky sign-in pages.

The extension is designed so that as much analysis as possible takes place locally in the user's browser. The developer does not operate an analytics or browsing-history collection service for this extension.

## Visited page addresses

The extension needs access to the address of a visited page so it can compare the domain against:

- protected institutions and brands,
- user-defined protected domains,
- trusted exceptions,
- locally cached public phishing lists.

These comparisons are performed locally in the browser.

Visited URLs are not sent to the extension developer.

## Password fields

The extension may detect the presence of an HTML password input field in order to decide whether an unknown domain should receive additional security checks.

It does **not** read, store, transmit, or otherwise process the contents of the password field.

## RDAP domain-age lookup

When domain-age checking is enabled and a password field is detected on an unknown website, the extension may query an RDAP service.

Only the registrable domain, for example `example.cz`, is sent to the RDAP provider. The full URL path, page contents, form contents, and password are not sent.

RDAP providers currently used by the extension may include:

- `https://rdap.nic.cz/`
- `https://rdap.org/`

As with any normal HTTPS request, the external provider may receive technical connection information such as the user's IP address.

## Public phishing feeds

The extension may download public phishing datasets from sources such as:

- `https://openphish.com/`
- `https://phish.co.za/`

The downloaded list is stored locally and matching against visited addresses is performed in the browser. The extension does not query the phishing-feed provider separately for every visited website.

## Public Suffix List

The extension may download Public Suffix List data from:

- `https://publicsuffix.org/`

This data is used only to determine the registrable portion of hostnames. The current visited URL is not sent as part of the Public Suffix List download.

## GitHub protected-list synchronization

If the user enables protected-list synchronization, the extension downloads JSON data from:

- `https://raw.githubusercontent.com/JN5555/phishing-domain-guard/main/protected-list.json`

The request is independent of the website currently being visited. The current visited URL is not sent to GitHub as part of this synchronization.

The downloaded file contains protected-domain and brand metadata only. Remote JavaScript is not downloaded or executed.

## Local storage

The extension uses Chrome Storage APIs.

`chrome.storage.local` may contain:

- downloaded phishing lists,
- Public Suffix List data,
- cached RDAP results,
- downloaded GitHub protected-list data,
- synchronization status and timestamps.

`chrome.storage.sync` may contain:

- extension settings,
- user-defined protected domains,
- trusted-domain exceptions,
- synchronization configuration.

If Chrome Sync is enabled by the user, Chrome may synchronize data stored through `chrome.storage.sync` between the user's signed-in browsers. The extension developer does not receive direct access to that synchronized data.

## Analytics and advertising

Phishing Domain Guard does not use:

- advertising networks,
- Google Analytics,
- third-party analytics SDKs,
- behavioral advertising,
- data brokers.

The developer does not sell user data.

## User accounts

The extension does not require an account with the extension developer.

## Sensitive data

The extension is not designed to collect:

- passwords,
- authentication codes,
- payment-card details,
- form contents,
- email messages,
- personal files,
- page content beyond the technical signals required for its security features.

## Data retention

Security caches can remain in browser-local extension storage until they are refreshed, automatically cleared, manually removed, or the extension itself is uninstalled.

The extension developer does not receive or retain those local caches.

## Removing stored data

Users can remove extension data by:

- changing or deleting user-defined entries in the extension,
- clearing extension data using browser controls,
- uninstalling the extension.

## Security

External network communication uses HTTPS.

Remote protected-list data is treated as data rather than executable code and is validated before use. Where supported by the Chrome Extensions API, extension storage access is restricted to trusted extension contexts.

## Changes to this policy

This privacy policy may be updated when extension functionality or data handling changes. The current version will be published in the project's GitHub repository.

## Contact and security reports

Project repository:

https://github.com/JN5555/phishing-domain-guard

Issues:

https://github.com/JN5555/phishing-domain-guard/issues

Do not include passwords, authentication codes, payment information, or other sensitive data in public issue reports.
