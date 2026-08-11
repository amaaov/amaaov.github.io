#!/usr/bin/env node
/**
 * Submit URLs through browser UIs when no public API exists.
 *
 * Usage:
 *   node submit.mjs --provider brave --url https://example.com/page
 *   node submit.mjs --provider ghostarchive --url https://example.com/page
 *   node submit.mjs --provider brave --urls-file urls.txt --headed
 *   node submit.mjs --provider brave --urls-file urls.txt --dry-run
 *   node submit.mjs --list-providers
 *
 * Called from scripts/submit_urls.rb when brave.mode=playwright, ghostarchive.enabled,
 * or other providers under playwright.providers.
 */

import { createRequire } from "node:module";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    console.error(
      "Playwright not installed. From scripts/playwright run:\n" +
        "  npm install\n" +
        "  npx playwright install chromium"
    );
    process.exit(1);
  }
}

/** @typedef {{ name: string, submitPage: string, submit: (page: import('playwright').Page, url: string, opts: object) => Promise<{ok: boolean, detail?: string}> }} Provider */

const GHOSTARCHIVE_ARCHIVE_RE = /\/archive\/([A-Za-z0-9]+)/;

function ghostarchiveNormalizeHref(href) {
  if (!href || !href.includes("/archive/") || href.includes("/replay/")) return null;
  if (href.startsWith("/")) return `https://ghostarchive.org${href}`;
  if (href.startsWith("http://ghostarchive.org")) {
    return href.replace("http://", "https://");
  }
  if (href.startsWith("https://ghostarchive.org")) return href;
  return null;
}

/** @type {Record<string, Provider>} */
const PROVIDERS = {
  brave: {
    name: "Brave Search",
    submitPage: "https://search.brave.com/submit-url",
    async submit(page, url, opts) {
      await page.goto(opts.submitPage || this.submitPage, {
        waitUntil: "domcontentloaded",
        timeout: opts.timeoutMs,
      });

      const input = page
        .locator(
          [
            'input[type="url"]',
            'input[name="url"]',
            'input[placeholder*="URL" i]',
            'input[aria-label*="URL" i]',
            'form input[type="text"]',
            "main input",
            "input",
          ].join(", ")
        )
        .first();

      await input.waitFor({ state: "visible", timeout: opts.timeoutMs });
      await input.fill("");
      await input.fill(url);

      const button = page
        .locator(
          [
            'button[type="submit"]',
            'input[type="submit"]',
            'button:has-text("Submit")',
            'button:has-text("Re-fetch")',
            'button:has-text("Send")',
          ].join(", ")
        )
        .first();

      await button.click({ timeout: opts.timeoutMs });

      // Brave often shows thank-you / queued copy; also accept quiet success.
      const body = page.locator("body");
      await sleep(800);
      const text = ((await body.innerText().catch(() => "")) || "").toLowerCase();

      if (
        text.includes("captcha") ||
        text.includes("verify you are human") ||
        text.includes("unusual traffic")
      ) {
        return { ok: false, detail: "captcha_or_challenge" };
      }

      if (
        text.includes("thank") ||
        text.includes("queued") ||
        text.includes("re-fetch") ||
        text.includes("submitted") ||
        text.includes("received")
      ) {
        return { ok: true, detail: "accepted_copy" };
      }

      // No clear failure banner → treat as submitted; UI may not change much.
      return { ok: true, detail: "submitted_no_clear_ack" };
    },
  },
  ghostarchive: {
    name: "Ghost Archive",
    submitPage: "https://ghostarchive.org/",
    async submit(page, url, opts) {
      await page.goto(opts.submitPage || this.submitPage, {
        waitUntil: "domcontentloaded",
        timeout: opts.timeoutMs,
      });

      const challengeText = (
        (await page.locator("body").innerText().catch(() => "")) || ""
      ).toLowerCase();
      if (
        challengeText.includes("verify you are human") ||
        challengeText.includes("just a moment") ||
        challengeText.includes("cf-challenge")
      ) {
        return { ok: false, detail: "captcha_or_challenge" };
      }

      const input = page.locator('input[name="archive"]').first();
      await input.waitFor({ state: "visible", timeout: opts.timeoutMs });
      await input.fill("");
      await input.fill(url);

      const button = page
        .locator(
          [
            'input[type="submit"][value="Submit for archival"]',
            'input[type="submit"][value*="archival" i]',
            'button:has-text("Submit for archival")',
            'input[type="submit"]',
            'button[type="submit"]',
          ].join(", ")
        )
        .first();
      await button.click({ timeout: opts.timeoutMs });

      const deadline = Date.now() + opts.timeoutMs;
      while (Date.now() < deadline) {
        const current = page.url().split("?")[0];
        if (GHOSTARCHIVE_ARCHIVE_RE.test(current)) {
          return { ok: true, detail: `archived:${current}` };
        }

        const bodyText = (
          (await page.locator("body").innerText().catch(() => "")) || ""
        ).toLowerCase();
        if (
          bodyText.includes("verify you are human") ||
          bodyText.includes("captcha") ||
          bodyText.includes("unusual traffic")
        ) {
          return { ok: false, detail: "captcha_or_challenge" };
        }

        const hrefs = await page.$$eval("a[href]", (anchors) =>
          anchors.map((a) => a.getAttribute("href") || "")
        );
        for (const href of hrefs) {
          const archiveUrl = ghostarchiveNormalizeHref(href);
          if (archiveUrl) {
            return { ok: true, detail: `archived:${archiveUrl}` };
          }
        }

        await sleep(1000);
      }

      return { ok: false, detail: "no_archive_url" };
    },
  },
};

function usage() {
  return `Usage:
  node submit.mjs --provider <name> (--url URL | --urls-file PATH) [options]

Options:
  --provider NAME     Provider key (see --list-providers)
  --url URL           Single URL (repeatable)
  --urls-file PATH    One URL per line
  --submit-page URL   Override provider submit page
  --headed            Show browser (default headless)
  --slow-mo MS        Playwright slowMo
  --delay SECONDS     Pause between URLs (default 3)
  --timeout MS        Per-action timeout (default 30000)
  --max N             Cap URLs
  --dry-run           Print planned actions only
  --results PATH      Write JSON results
  --list-providers    List providers and exit
  -h, --help
`;
}

function parseArgs(argv) {
  const opts = {
    provider: null,
    urls: [],
    urlsFile: null,
    submitPage: null,
    headed: false,
    slowMo: 0,
    delay: 3,
    timeoutMs: 30_000,
    max: 0,
    dryRun: false,
    results: null,
    listProviders: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--provider":
        opts.provider = argv[++i];
        break;
      case "--url":
        opts.urls.push(argv[++i]);
        break;
      case "--urls-file":
        opts.urlsFile = argv[++i];
        break;
      case "--submit-page":
        opts.submitPage = argv[++i];
        break;
      case "--headed":
        opts.headed = true;
        break;
      case "--slow-mo":
        opts.slowMo = Number(argv[++i] || 0);
        break;
      case "--delay":
        opts.delay = Number(argv[++i] || 3);
        break;
      case "--timeout":
        opts.timeoutMs = Number(argv[++i] || 30_000);
        break;
      case "--max":
        opts.max = Number(argv[++i] || 0);
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--results":
        opts.results = argv[++i];
        break;
      case "--list-providers":
        opts.listProviders = true;
        break;
      case "-h":
      case "--help":
        console.log(usage());
        process.exit(0);
        break;
      default:
        console.error(`Unknown arg: ${arg}\n`);
        console.error(usage());
        process.exit(2);
    }
  }

  return opts;
}

function collectUrls(opts) {
  const urls = [...opts.urls];
  if (opts.urlsFile) {
    const text = readFileSync(resolve(opts.urlsFile), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const u = line.trim();
      if (u && !u.startsWith("#")) urls.push(u);
    }
  }
  const uniq = [...new Set(urls.map((u) => u.replace(/\/$/, "")))];
  return opts.max > 0 ? uniq.slice(0, opts.max) : uniq;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.listProviders) {
    for (const [key, provider] of Object.entries(PROVIDERS)) {
      console.log(`${key}\t${provider.name}\t${provider.submitPage}`);
    }
    return;
  }

  if (!opts.provider || !PROVIDERS[opts.provider]) {
    console.error(
      `Unknown or missing provider. Available: ${Object.keys(PROVIDERS).join(", ")}`
    );
    process.exit(2);
  }

  const provider = PROVIDERS[opts.provider];
  const urls = collectUrls(opts);
  if (urls.length === 0) {
    console.error("No URLs provided");
    process.exit(2);
  }

  console.error(
    `${provider.name}: ${urls.length} URL(s) via Playwright (${opts.headed ? "headed" : "headless"})`
  );

  if (opts.dryRun) {
    for (const url of urls) {
      console.log(`DRY-RUN ${opts.provider}: ${url} -> ${opts.submitPage || provider.submitPage}`);
    }
    return;
  }

  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({
    headless: !opts.headed,
    slowMo: opts.slowMo,
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = [];
  let failures = 0;

  try {
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      process.stderr.write(`[${i + 1}/${urls.length}] ${url} ... `);
      try {
        const outcome = await provider.submit(page, url, {
          submitPage: opts.submitPage,
          timeoutMs: opts.timeoutMs,
        });
        results.push({ url, provider: opts.provider, ...outcome });
        if (outcome.ok) {
          console.error(`ok (${outcome.detail || "ok"})`);
        } else {
          failures += 1;
          console.error(`FAIL (${outcome.detail || "unknown"})`);
          if (outcome.detail === "captcha_or_challenge" && !opts.headed) {
            console.error(
              "Hint: re-run with --headed to solve challenges interactively, then continue."
            );
          }
        }
      } catch (err) {
        failures += 1;
        const detail = err instanceof Error ? err.message : String(err);
        results.push({ url, provider: opts.provider, ok: false, detail });
        console.error(`ERROR (${detail})`);
      }

      if (i + 1 < urls.length && opts.delay > 0) {
        await sleep(opts.delay * 1000);
      }
    }
  } finally {
    await browser.close();
  }

  if (opts.results) {
    const out = resolve(opts.results);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(
      out,
      JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          provider: opts.provider,
          results,
        },
        null,
        2
      )
    );
    console.error(`Wrote results: ${out}`);
  }

  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
