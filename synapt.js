/* Synapt — interactions: nav state, live release data, install picker */
(function () {
  "use strict";

  /* ====================================================================
     THE ONLY THING IN THIS SITE THAT IS WRITTEN BY HAND.

     Every GitHub URL on the page and every version number is derived from
     this at runtime — versions and installer filenames come from the
     releases API, links are built from the owner/repo below. A new release
     needs no edit here or anywhere else; this changes only if a repo is
     renamed, moved, or a third app is added.
     ==================================================================== */
  var SITE = {
    owner: "aatishbagal",
    apps: {
      synapt: { repo: "synapt", name: "Synapt" },
      synaptclip: { repo: "synapt-clip", name: "SynaptClip" }
    },
    /* Branch the LICENSE and PRIVACY links point at. */
    defaultBranch: "main"
  };

  /* Release metadata is cached so repeat visits don't spend the caller's
     unauthenticated GitHub API budget (60 requests/hour per IP). */
  var CACHE_TTL_MS = 60 * 60 * 1000;

  function repoUrl(app) {
    return "https://github.com/" + SITE.owner + "/" + SITE.apps[app].repo;
  }

  /** Resolve a data-link token ("synapt", "synaptclip:releases", "owner"). */
  function resolveLink(token) {
    if (token === "owner") return "https://github.com/" + SITE.owner;
    var parts = token.split(":");
    var app = parts[0];
    var what = parts[1];
    if (!SITE.apps[app]) return null;
    var base = repoUrl(app);
    if (what === "releases") return base + "/releases";
    if (what === "latest") return base + "/releases/latest";
    if (what === "license") return base + "/blob/" + SITE.defaultBranch + "/LICENSE";
    if (what === "privacy") return base + "/blob/" + SITE.defaultBranch + "/PRIVACY.md";
    if (what === "changelog") return base + "/blob/" + SITE.defaultBranch + "/CHANGELOG.md";
    return base;
  }

  /* ---- Stamp every repo link on the page from SITE ---- */
  Array.prototype.forEach.call(document.querySelectorAll("[data-link]"), function (el) {
    var url = resolveLink(el.getAttribute("data-link"));
    if (url) el.setAttribute("href", url);
  });

  /* Sample clipboard content in the SynaptClip mockup that happens to be a
     repo URL — derived too, so it can never go stale. */
  Array.prototype.forEach.call(document.querySelectorAll("[data-link-text]"), function (el) {
    var url = resolveLink(el.getAttribute("data-link-text"));
    if (url) el.textContent = url;
  });

  /* ---- Nav background on scroll ---- */
  var nav = document.querySelector(".nav");
  function onScroll() {
    if (nav) nav.dataset.scrolled = window.scrollY > 12 ? "true" : "false";
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---- Release lookup ------------------------------------------------ */

  function cacheKey(key) {
    return "synapt.release." + key;
  }

  function readCache(key) {
    try {
      var raw = window.localStorage.getItem(cacheKey(key));
      if (!raw) return null;
      var entry = JSON.parse(raw);
      if (!entry || Date.now() - entry.at > CACHE_TTL_MS) return null;
      return entry.data;
    } catch (err) {
      return null;
    }
  }

  function writeCache(key, data) {
    try {
      window.localStorage.setItem(cacheKey(key), JSON.stringify({ at: Date.now(), data: data }));
    } catch (err) {
      /* private mode, quota, or storage disabled — the page works without it */
    }
  }

  /** Latest published release for one repo, normalised to {version, assets}. */
  function fetchRelease(key) {
    var cached = readCache(key);
    if (cached) return Promise.resolve(cached);

    var url = "https://api.github.com/repos/" + SITE.owner + "/" +
              SITE.apps[key].repo + "/releases/latest";
    return fetch(url, { headers: { Accept: "application/vnd.github+json" } })
      .then(function (res) {
        if (!res.ok) throw new Error("github " + res.status);
        return res.json();
      })
      .then(function (json) {
        var data = {
          version: String(json.tag_name || "").replace(/^v/, ""),
          assets: (json.assets || []).map(function (a) {
            return { name: a.name, url: a.browser_download_url, size: a.size };
          })
        };
        writeCache(key, data);
        return data;
      });
  }

  /* Release notes ship in each repo as whatsnew.json (the same file the apps
     bundle). raw.githubusercontent.com is not part of the API rate limit. */
  var WHATSNEW_COUNT = 3;

  /** Newest-first release notes for one repo, trimmed to what the page shows. */
  function fetchWhatsNew(key) {
    var cached = readCache("whatsnew." + key);
    if (cached) return Promise.resolve(cached);

    var url = "https://raw.githubusercontent.com/" + SITE.owner + "/" +
              SITE.apps[key].repo + "/" + SITE.defaultBranch + "/whatsnew.json";
    return fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error("whatsnew " + res.status);
        return res.json();
      })
      .then(function (json) {
        var data = (json.versions || []).slice(0, WHATSNEW_COUNT).map(function (v) {
          return {
            version: String(v.version || ""),
            date: v.date ? String(v.date) : "",
            headline: String(v.headline || ""),
            highlights: (v.highlights || []).slice(0, 3).map(String)
          };
        });
        writeCache("whatsnew." + key, data);
        return data;
      });
  }

  /** Pick the installer a given OS should actually download. */
  function pickAsset(assets, os) {
    function match(re) {
      for (var i = 0; i < assets.length; i++) {
        if (re.test(assets[i].name)) return assets[i];
      }
      return null;
    }
    if (os === "mac") return match(/\.dmg$/i);
    if (os === "windows") return match(/\.msi$/i) || match(/-setup\.exe$/i) || match(/\.exe$/i);
    return match(/\.AppImage$/i) || match(/\.deb$/i) || match(/\.rpm$/i);
  }

  function formatSize(bytes) {
    if (!bytes) return "";
    var mb = bytes / (1024 * 1024);
    return mb >= 1 ? mb.toFixed(1) + " MB" : Math.round(bytes / 1024) + " KB";
  }

  /* ---- Version badges throughout the page ---- */
  function paintVersions(key, version) {
    if (!version) return;  /* leave the badges empty rather than printing "v" */
    var role = key === "synapt" ? "v-synapt" : "v-clip";
    Array.prototype.forEach.call(document.querySelectorAll('[data-role="' + role + '"]'), function (el) {
      el.textContent = "v" + version;
    });
    if (key === "synaptclip") {
      /* SynaptClip's own header prints the bare number, no "v" prefix. */
      Array.prototype.forEach.call(document.querySelectorAll('[data-role="v-clip-bare"]'), function (el) {
        el.textContent = version;
      });
    }
  }

  var releases = {};
  var whatsNew = {};

  Object.keys(SITE.apps).forEach(function (key) {
    fetchWhatsNew(key)
      .then(function (data) {
        whatsNew[key] = data;
        renderInstall();
      })
      .catch(function () {
        /* No whatsnew.json on the default branch yet, or offline. The
           section stays hidden rather than showing stale notes. */
      });

    fetchRelease(key)
      .then(function (data) {
        releases[key] = data;
        paintVersions(key, data.version);
        renderInstall();
      })
      .catch(function () {
        /* Offline, rate-limited, or nothing published yet. The version
           badges stay empty (CSS hides them when empty) and the install box
           falls back to the releases page — never a stale hardcoded number. */
        renderInstall();
      });
  });

  /* ---- Install: app / OS picker with auto-detection ---- */
  var renderInstall = function () {};

  (function () {
    var box = document.getElementById("installer");
    if (!box) return;

    var OS_LABEL = { linux: "Linux", mac: "macOS", windows: "Windows" };

    function detectOS() {
      var ua = navigator.userAgent || "";
      if (/Win/i.test(ua)) return "windows";
      if (/Mac/i.test(ua)) return "mac";
      if (/Linux|X11|Android/i.test(ua)) return "linux";
      return "mac";
    }

    var appToggle = box.querySelector('[data-role="app-toggle"]');
    var osPicker = box.querySelector('[data-role="os-picker"]');
    var osLabelEl = box.querySelector('[data-role="os-label"]');
    var cmdLabelEl = box.querySelector('[data-role="cmd-label"]');
    var cmdTextEl = box.querySelector('[data-role="cmd-text"]');
    var copyBtn = box.querySelector('[data-role="copy-btn"]');
    var dlBtn = box.querySelector('[data-role="dl-btn"]');
    var dlLabel = box.querySelector('[data-role="dl-label"]');
    var allBtn = box.querySelector('[data-role="all-btn"]');
    var wnBox = box.querySelector('[data-role="whatsnew"]');
    var wnList = box.querySelector('[data-role="whatsnew-list"]');
    var wnLink = box.querySelector('[data-role="changelog-link"]');

    function el(tag, className, text) {
      var node = document.createElement(tag);
      if (className) node.className = className;
      if (text) node.textContent = text;
      return node;
    }

    /* Built with textContent only, so nothing from the JSON is parsed as HTML. */
    function renderWhatsNew(app) {
      if (!wnBox) return;
      var entries = whatsNew[app];
      wnLink.href = resolveLink(app + ":changelog");
      if (!entries || !entries.length) {
        wnBox.hidden = true;
        return;
      }
      wnList.textContent = "";
      entries.forEach(function (entry) {
        var item = el("li", "whatsnew-item");
        var meta = el("div", "whatsnew-meta");
        meta.appendChild(el("span", "whatsnew-version", "v" + entry.version));
        if (entry.date) meta.appendChild(el("span", "whatsnew-date", entry.date));
        item.appendChild(meta);
        if (entry.headline) item.appendChild(el("div", "whatsnew-headline", entry.headline));
        if (entry.highlights.length) {
          var points = el("ul", "whatsnew-points");
          entry.highlights.forEach(function (h) { points.appendChild(el("li", "", h)); });
          item.appendChild(points);
        }
        wnList.appendChild(item);
      });
      wnBox.hidden = false;
    }

    var detected = detectOS();
    box.dataset.os = detected;

    renderInstall = function () {
      var app = box.dataset.app;
      var os = box.dataset.os;
      var release = releases[app];
      var releasesUrl = repoUrl(app) + "/releases/latest";
      var version = release ? release.version : "";
      var asset = release ? pickAsset(release.assets, os) : null;

      osLabelEl.textContent = OS_LABEL[detected];
      cmdLabelEl.textContent = OS_LABEL[os] + (version ? " · v" + version : "");
      allBtn.href = releasesUrl;

      if (asset) {
        cmdTextEl.textContent = asset.name;
        copyBtn.setAttribute("data-cmd", asset.url);
        dlBtn.href = asset.url;
        dlLabel.textContent = "Download" + (asset.size ? " · " + formatSize(asset.size) : "");
      } else {
        /* No matching installer in the latest release (or the API is
           unavailable) — fall back to the release page rather than guessing
           an asset filename that may not exist. */
        cmdTextEl.textContent = releasesUrl;
        copyBtn.setAttribute("data-cmd", releasesUrl);
        dlBtn.href = releasesUrl;
        dlLabel.textContent = release ? "Browse releases" : "Download";
      }

      Array.prototype.forEach.call(appToggle.querySelectorAll(".seg-btn"), function (b) {
        b.setAttribute("data-active", b.getAttribute("data-app-value") === app ? "true" : "false");
      });
      Array.prototype.forEach.call(osPicker.querySelectorAll(".seg-btn"), function (b) {
        b.setAttribute("data-active", b.getAttribute("data-os-value") === os ? "true" : "false");
      });

      renderWhatsNew(app);
    };

    appToggle.addEventListener("click", function (e) {
      var btn = e.target.closest(".seg-btn");
      if (!btn) return;
      box.dataset.app = btn.getAttribute("data-app-value");
      renderInstall();
    });

    osPicker.addEventListener("click", function (e) {
      var btn = e.target.closest(".seg-btn");
      if (!btn) return;
      box.dataset.os = btn.getAttribute("data-os-value");
      renderInstall();
    });

    renderInstall();
  })();


  /* ---- aatish.io signature card --------------------------------------
     Ported from marblearch-showcase/components/BottomOverlay.tsx. The open
     and close animations are CSS; only the pointer parallax needs script.
     Original used GSAP with a 0.5s power2.out tween — here the easing lives
     on the .sig-bg / .sig-content transition and script only sets the
     offsets. Tilt math and the 10.0 / 2.5 parallax constants are unchanged. */
  (function () {
    var trigger = document.querySelector('[data-role="sig-open"]');
    var overlay = document.querySelector('[data-role="sig-overlay"]');
    if (!trigger || !overlay) return;

    var card = overlay.querySelector('[data-role="sig-card"]');
    var bg = overlay.querySelector('[data-role="sig-bg"]');
    var content = overlay.querySelector('[data-role="sig-content"]');
    var closeBtn = overlay.querySelector('[data-role="sig-close"]');

    var BG_PARALLAX = 10.0;
    var OVERLAY_PARALLAX = 2.5;
    var MAX_TILT = 20;

    var lastFocus = null;

    function setOpen(open) {
      overlay.setAttribute("data-open", open ? "true" : "false");
      overlay.setAttribute("aria-hidden", open ? "false" : "true");
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        lastFocus = document.activeElement;
        if (closeBtn) closeBtn.focus();
      } else {
        resetParallax();
        if (lastFocus && lastFocus.focus) lastFocus.focus();
      }
    }

    function isOpen() {
      return overlay.getAttribute("data-open") === "true";
    }

    function resetParallax() {
      if (bg) bg.style.transform = "";
      if (content) content.style.transform = "";
    }

    trigger.addEventListener("click", function () { setOpen(true); });
    if (closeBtn) closeBtn.addEventListener("click", function () { setOpen(false); });

    /* Backdrop click closes; clicks inside the card do not. */
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) setOpen(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen()) setOpen(false);
    });

    /* Keep focus inside the card while it is open. */
    overlay.addEventListener("keydown", function (e) {
      if (e.key !== "Tab" || !isOpen()) return;
      var items = overlay.querySelectorAll("a[href], button");
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    overlay.addEventListener("mousemove", function (e) {
      if (!card || !bg || !content) return;

      var rect = card.getBoundingClientRect();
      var centerX = rect.left + rect.width / 2;
      var centerY = rect.top + rect.height / 2;

      var mouseX = (e.clientX - centerX) / (rect.width / 2);
      var mouseY = (e.clientY - centerY) / (rect.height / 2);

      var tiltX = Math.max(-MAX_TILT, Math.min(MAX_TILT, mouseX * MAX_TILT));
      var tiltY = Math.max(-MAX_TILT, Math.min(MAX_TILT, mouseY * MAX_TILT));

      /* Background drifts against the pointer, content drifts with it. */
      var bgX = -tiltX * (BG_PARALLAX / 10);
      var bgY = -tiltY * (BG_PARALLAX / 10);
      var contentX = tiltX * (OVERLAY_PARALLAX / 10);
      var contentY = tiltY * (OVERLAY_PARALLAX / 10);

      bg.style.transform = "translate(" + bgX + "px, " + bgY + "px)";
      content.style.transform = "translate(" + contentX + "px, " + contentY + "px)";
    });

    overlay.addEventListener("mouseleave", resetParallax);
  })();

  /* ---- Copy buttons (delegated: the install box re-renders) ---- */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".copy");
    if (!btn) return;
    var cmd = btn.getAttribute("data-cmd") || "";
    var done = function () {
      var prev = btn.getAttribute("data-label") || btn.textContent;
      btn.setAttribute("data-label", prev);
      btn.textContent = "Copied";
      btn.setAttribute("data-copied", "true");
      setTimeout(function () { btn.textContent = prev; btn.removeAttribute("data-copied"); }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(cmd).then(done, done);
    } else {
      var ta = document.createElement("textarea");
      ta.value = cmd; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (err) {}
      document.body.removeChild(ta); done();
    }
  });

})();
