// GuruCool 2.0 — single-page app router + Supabase-backed auth & activity tracking
(function () {
  "use strict";

  var ROUTES = ["login", "welcome", "dashboard", "resources", "handbook", "founders", "team", "contribute", "admin"];
  var PAGE_TITLES = {
    login: "GuruCool 2.0 — Sign Up or Login",
    welcome: "Welcome — GuruCool 2.0",
    dashboard: "Dashboard — GuruCool 2.0",
    resources: "Term-wise Academic Resources — GuruCool 2.0",
    handbook: "Industry Handbook Series — GuruCool 2.0",
    founders: "Meet the Founders — GuruCool 2.0",
    team: "Meet the Team & Contact Us — GuruCool 2.0",
    contribute: "Contribute to GuruCool — GuruCool 2.0",
    admin: "Admin Dashboard — GuruCool 2.0"
  };

  var SUPABASE_URL = "https://kbrutxednbudjbxvtgng.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_6_PgVUdxkI9G6z54S4_Ltw_KjXANM8V";
  var supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  var currentUser = null;
  var currentRole = null;

  /* ---------------- Mobile hamburger nav ---------------- */
  var hamburger = document.getElementById("hamburgerBtn");
  var mainNav = document.getElementById("mainNav");
  if (hamburger && mainNav) {
    hamburger.addEventListener("click", function () {
      var isOpen = mainNav.classList.toggle("open");
      hamburger.classList.toggle("open", isOpen);
      hamburger.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
    mainNav.querySelectorAll(".nav-link").forEach(function (link) {
      link.addEventListener("click", function () {
        mainNav.classList.remove("open");
        hamburger.classList.remove("open");
        hamburger.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------------- Session helpers ---------------- */
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  async function cacheSessionFromUser(user) {
    currentUser = user;
    var res = await supabaseClient.from("profiles").select("full_name, email, role").eq("id", user.id).single();
    var profile = res.data;
    currentRole = (profile && profile.role) || "student";
    var displayName = (profile && profile.full_name) || (user.email ? user.email.split("@")[0] : "Junior");
    localStorage.setItem("gc_name", displayName);
    localStorage.setItem("gc_email", user.email || "");
  }

  function clearSessionCache() {
    currentUser = null;
    currentRole = null;
    localStorage.removeItem("gc_name");
    localStorage.removeItem("gc_email");
  }

  function recordLogin() {
    supabaseClient.rpc("record_login").then(function (res) {
      if (res.error) console.error("record_login failed:", res.error.message);
    });
  }

  /* ---------------- Logout ---------------- */
  var logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function (e) {
      e.preventDefault();
      clearSessionCache();
      navigate("login");
      supabaseClient.auth.signOut();
    });
  }

  /* ---------------- Router ----------------
     Hash format: #route or #route?query=1  (e.g. #resources?term=1)
  ------------------------------------------- */
  function parseHash() {
    var raw = window.location.hash.replace(/^#\/?/, "");
    var qIndex = raw.indexOf("?");
    var route = qIndex === -1 ? raw : raw.slice(0, qIndex);
    var query = new URLSearchParams(qIndex === -1 ? "" : raw.slice(qIndex + 1));
    return { route: route || "login", query: query };
  }

  function navigate(route, queryString) {
    window.location.hash = "#" + route + (queryString ? "?" + queryString : "");
  }
  window.gcNavigate = navigate;

  function updateAdminRibbon(route) {
    var existing = document.getElementById("adminRibbon");
    var show = currentRole === "admin" && route !== "login" && route !== "admin";
    if (show && !existing) {
      var banner = document.createElement("div");
      banner.id = "adminRibbon";
      banner.className = "admin-ribbon";
      banner.innerHTML = '<span>You are viewing GuruCool as <strong>Admin</strong>.</span> <a href="#admin">Go to Admin Dashboard &rarr;</a>';
      document.body.insertBefore(banner, document.body.firstChild);
    } else if (!show && existing) {
      existing.remove();
    }
  }

  function applyGreetings() {
    document.querySelectorAll("[data-greet-name]").forEach(function (el) {
      var name = localStorage.getItem("gc_name");
      var firstName = name ? name.split(" ")[0] : "Junior";
      el.textContent = el.getAttribute("data-greet-name").replace("{name}", firstName);
    });
  }

  function syncResourceBreadcrumb() {
    var crumb = document.getElementById("breadcrumbTerm");
    var labels = { "term-1": "Resources · Term-I", "term-2": "Resources · Term-II", "term-3": "Resources · Term-III" };
    var active = document.querySelector('.tabs[data-tabgroup="term"] .tab-btn.active');
    if (active && crumb) crumb.textContent = labels[active.getAttribute("data-tab")] || "Resources";
  }

  /* ---------------- Admin: live registered-user count + recent logins ---------------- */
  function loadAdminStats() {
    var statEl = document.getElementById("statRegisteredUsers");
    var listEl = document.getElementById("loginActivityList");
    if (!statEl && !listEl) return;

    if (statEl) {
      supabaseClient.from("profiles").select("*", { count: "exact", head: true }).then(function (res) {
        statEl.textContent = res.count != null ? res.count : "—";
      });
    }

    if (listEl) {
      supabaseClient
        .from("login_events")
        .select("email, logged_in_at")
        .order("logged_in_at", { ascending: false })
        .limit(20)
        .then(function (res) {
          if (res.error || !res.data || res.data.length === 0) {
            listEl.innerHTML = '<p class="text-muted mb-0">No login activity yet.</p>';
            return;
          }
          listEl.innerHTML = res.data
            .map(function (row) {
              var when = new Date(row.logged_in_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
              return (
                '<div class="login-activity-row"><span class="la-email">' +
                escapeHtml(row.email) +
                '</span><span class="la-time">' +
                escapeHtml(when) +
                "</span></div>"
              );
            })
            .join("");
        });
    }
  }

  /* ---------------- Admin: registered users roster + remove ---------------- */
  function loadRegisteredUsers() {
    var listEl = document.getElementById("registeredUsersList");
    if (!listEl) return;

    supabaseClient
      .from("profiles")
      .select("id, email, full_name, role, login_count, created_at")
      .order("created_at", { ascending: false })
      .then(function (res) {
        if (res.error || !res.data || res.data.length === 0) {
          listEl.innerHTML = '<p class="text-muted mb-0">No registered users yet.</p>';
          return;
        }
        listEl.innerHTML = res.data
          .map(function (row) {
            var joined = new Date(row.created_at).toLocaleDateString(undefined, { dateStyle: "medium" });
            var isSelf = currentUser && row.id === currentUser.id;
            var roleBadge = row.role === "admin" ? '<span class="badge badge-admin">Admin</span>' : '<span class="badge badge-available">Student</span>';
            var removeBtn = isSelf
              ? '<button class="btn btn-sm is-disabled" disabled title="You can\'t remove your own account">Remove</button>'
              : '<button class="btn btn-sm btn-danger" data-remove-user="' + escapeHtml(row.id) + '" data-remove-email="' + escapeHtml(row.email) + '">Remove</button>';
            return (
              '<div class="user-roster-row">' +
              '<div class="ur-info">' +
              '<div class="ur-top"><span class="ur-email">' + escapeHtml(row.full_name || row.email) + "</span>" + roleBadge + "</div>" +
              '<span class="ur-meta">' + escapeHtml(row.email) + " · Joined " + escapeHtml(joined) + " · " + (row.login_count || 0) + " logins</span>" +
              '<span class="ur-id">ID: ' + escapeHtml(row.id) + "</span>" +
              "</div>" +
              removeBtn +
              "</div>"
            );
          })
          .join("");
      });
  }

  function removeUser(id, email) {
    var confirmed = window.confirm(
      "Remove " + email + "?\n\nThis permanently deletes their account and all their login activity. This cannot be undone."
    );
    if (!confirmed) return;

    supabaseClient.rpc("admin_delete_user", { target_id: id }).then(function (res) {
      if (res.error) {
        window.alert("Couldn't remove this user: " + res.error.message);
        return;
      }
      loadRegisteredUsers();
      loadAdminStats();
    });
  }

  var registeredUsersList = document.getElementById("registeredUsersList");
  if (registeredUsersList) {
    registeredUsersList.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-remove-user]");
      if (!btn) return;
      removeUser(btn.getAttribute("data-remove-user"), btn.getAttribute("data-remove-email"));
    });
  }

  /* ---------------- Industry Handbook: live status + LinkedIn link ---------------- */
  var INDUSTRY_STATUS_META = {
    coming_soon: { badgeClass: "badge-soon", label: "Coming Soon" },
    critical: { badgeClass: "badge-upload", label: "Critical" },
    important: { badgeClass: "badge-curated", label: "Important" },
    live: { badgeClass: "badge-available", label: "Available" }
  };

  function renderIndustryCard(row, isAdmin) {
    var meta = INDUSTRY_STATUS_META[row.status] || INDUSTRY_STATUS_META.coming_soon;
    var isLive = row.status === "live" && !!row.linkedin_url;
    var cardClass = "card hoverable" + (isLive ? " card-tilt-green" : "");
    var iconWrapClass = isLive ? "wrap-icon green" : "wrap-icon";

    var head = isAdmin
      ? '<select class="industry-status-select" data-industry-id="' +
        row.id +
        '">' +
        Object.keys(INDUSTRY_STATUS_META)
          .map(function (key) {
            var selected = key === row.status ? " selected" : "";
            return '<option value="' + key + '"' + selected + ">" + INDUSTRY_STATUS_META[key].label + "</option>";
          })
          .join("") +
        "</select>"
      : '<span class="badge ' + meta.badgeClass + '">' + meta.label + "</span>";

    var body;
    if (isAdmin) {
      var previewLink = row.linkedin_url
        ? '<a href="' + escapeHtml(row.linkedin_url) + '" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">Preview</a>'
        : "";
      var liveHint =
        row.status === "live" && !row.linkedin_url
          ? '<p class="industry-live-hint">Add a LinkedIn URL so students can actually view this.</p>'
          : "";
      body =
        '<div class="form-group mt-16 mb-0">' +
        '<label style="font-size:13px;">LinkedIn post URL</label>' +
        '<input type="url" class="industry-url-input" data-industry-id="' +
        row.id +
        '" placeholder="https://www.linkedin.com/posts/..." value="' +
        escapeHtml(row.linkedin_url || "") +
        '">' +
        "</div>" +
        liveHint +
        '<div class="industry-save-row mt-16">' +
        '<button class="btn btn-primary btn-sm" data-save-industry="' +
        row.id +
        '">Save</button>' +
        previewLink +
        '<span class="industry-save-status" data-status-for="' +
        row.id +
        '"></span>' +
        "</div>";
    } else if (isLive) {
      body = '<a href="' + escapeHtml(row.linkedin_url) + '" target="_blank" rel="noopener" class="btn btn-primary btn-sm">View</a>';
    } else {
      body = '<button class="btn btn-sm is-disabled" disabled>Coming Soon</button>';
    }

    return (
      '<div class="' +
      cardClass +
      '">' +
      '<div class="flex-between mb-0"><span class="' +
      iconWrapClass +
      '"><svg width="20" height="20"><use href="#ic-briefcase"/></svg></span>' +
      head +
      "</div>" +
      '<h3 class="mt-16">' +
      escapeHtml(row.name) +
      "</h3>" +
      "<p>" +
      escapeHtml(row.description) +
      "</p>" +
      body +
      "</div>"
    );
  }

  function loadIndustries() {
    var gridEl = document.getElementById("handbookGrid");
    if (!gridEl) return;

    supabaseClient
      .from("industries")
      .select("id, slug, name, description, status, linkedin_url")
      .order("sort_order")
      .then(function (res) {
        if (res.error || !res.data) {
          gridEl.innerHTML = '<p class="text-muted mb-0">Couldn\'t load industries right now.</p>';
          return;
        }
        var isAdmin = currentRole === "admin";
        gridEl.innerHTML = res.data.map(function (row) { return renderIndustryCard(row, isAdmin); }).join("");
      });
  }

  function saveIndustry(id) {
    var select = document.querySelector('select[data-industry-id="' + id + '"]');
    var input = document.querySelector('input[data-industry-id="' + id + '"]');
    var statusEl = document.querySelector('[data-status-for="' + id + '"]');
    if (!select || !input) return;

    if (statusEl) {
      statusEl.textContent = "Saving…";
      statusEl.classList.remove("error");
    }

    supabaseClient
      .from("industries")
      .update({ status: select.value, linkedin_url: input.value.trim() || null })
      .eq("id", id)
      .then(function (res) {
        if (res.error) {
          if (statusEl) {
            statusEl.textContent = "Couldn't save: " + res.error.message;
            statusEl.classList.add("error");
          }
          return;
        }
        loadIndustries();
      });
  }

  var handbookGrid = document.getElementById("handbookGrid");
  if (handbookGrid) {
    handbookGrid.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-save-industry]");
      if (!btn) return;
      saveIndustry(btn.getAttribute("data-save-industry"));
    });
  }

  /* ---------------- Founders/Team: profile photo upload, change, remove ---------------- */
  var PROFILE_PHOTOS_BUCKET = "profile-photos";
  var MAX_PHOTO_BYTES = 5 * 1024 * 1024;

  function avatarPublicUrl(path) {
    if (!path) return null;
    var res = supabaseClient.storage.from(PROFILE_PHOTOS_BUCKET).getPublicUrl(path);
    return res.data && res.data.publicUrl;
  }

  function renderPersonAvatar(slug, avatarPath) {
    var el = document.getElementById("avatar-" + slug);
    if (!el) return;
    if (el.dataset.initials === undefined) el.dataset.initials = el.textContent.trim();
    var url = avatarPublicUrl(avatarPath);
    if (url) {
      el.innerHTML = '<img src="' + escapeHtml(url) + "?v=" + Date.now() + '" alt="" class="profile-avatar-img">';
    } else {
      el.textContent = el.dataset.initials;
    }
  }

  function renderPersonAdminControls(slug, avatarPath) {
    var el = document.querySelector('.profile-photo-admin[data-person-slug="' + slug + '"]');
    if (!el) return;
    if (currentRole !== "admin") {
      el.innerHTML = "";
      return;
    }
    var removeBtn = avatarPath
      ? '<button type="button" class="btn btn-sm btn-danger" data-remove-photo="' + slug + '">Remove Photo</button>'
      : "";
    el.innerHTML =
      '<label class="btn btn-sm btn-secondary" style="cursor:pointer;">' +
      (avatarPath ? "Change Photo" : "Upload Photo") +
      '<input type="file" accept="image/*" data-upload-photo="' +
      slug +
      '" style="display:none;">' +
      "</label>" +
      removeBtn +
      '<span class="photo-upload-status" data-photo-status-for="' + slug + '"></span>';
  }

  function loadPeoplePhotos() {
    supabaseClient
      .from("people")
      .select("slug, avatar_path")
      .then(function (res) {
        if (res.error || !res.data) return;
        res.data.forEach(function (row) {
          renderPersonAvatar(row.slug, row.avatar_path);
          renderPersonAdminControls(row.slug, row.avatar_path);
        });
      });
  }

  function setPhotoStatus(slug, message, isError) {
    var el = document.querySelector('[data-photo-status-for="' + slug + '"]');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("error", !!isError);
  }

  function uploadPersonPhoto(slug, file) {
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoStatus(slug, "Photo must be under 5MB.", true);
      return;
    }
    setPhotoStatus(slug, "Uploading…", false);

    var ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    var path = slug + "/" + Date.now() + "." + ext;
    var oldPath = null;

    supabaseClient
      .from("people")
      .select("avatar_path")
      .eq("slug", slug)
      .single()
      .then(function (existingRes) {
        oldPath = existingRes.data && existingRes.data.avatar_path;
        return supabaseClient.storage.from(PROFILE_PHOTOS_BUCKET).upload(path, file, { cacheControl: "3600", upsert: false });
      })
      .then(function (uploadRes) {
        if (uploadRes.error) throw uploadRes.error;
        return supabaseClient.from("people").update({ avatar_path: path }).eq("slug", slug);
      })
      .then(function (updateRes) {
        if (updateRes.error) throw updateRes.error;
        if (oldPath) supabaseClient.storage.from(PROFILE_PHOTOS_BUCKET).remove([oldPath]);
        loadPeoplePhotos();
      })
      .catch(function (err) {
        setPhotoStatus(slug, "Couldn't upload: " + (err && err.message ? err.message : err), true);
      });
  }

  function removePersonPhoto(slug) {
    if (!window.confirm("Remove this photo? The card will go back to showing initials.")) return;

    supabaseClient
      .from("people")
      .select("avatar_path")
      .eq("slug", slug)
      .single()
      .then(function (res) {
        var oldPath = res.data && res.data.avatar_path;
        return supabaseClient
          .from("people")
          .update({ avatar_path: null })
          .eq("slug", slug)
          .then(function (updateRes) {
            if (updateRes.error) throw updateRes.error;
            if (oldPath) supabaseClient.storage.from(PROFILE_PHOTOS_BUCKET).remove([oldPath]);
          });
      })
      .then(function () {
        loadPeoplePhotos();
      })
      .catch(function (err) {
        window.alert("Couldn't remove photo: " + (err && err.message ? err.message : err));
      });
  }

  document.addEventListener("change", function (e) {
    var input = e.target.closest("[data-upload-photo]");
    if (!input || !input.files || !input.files[0]) return;
    uploadPersonPhoto(input.getAttribute("data-upload-photo"), input.files[0]);
  });

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-remove-photo]");
    if (!btn) return;
    removePersonPhoto(btn.getAttribute("data-remove-photo"));
  });

  function render() {
    var parsed = parseHash();
    var route = ROUTES.indexOf(parsed.route) !== -1 ? parsed.route : "login";

    if (route === "admin" && currentRole !== "admin") {
      navigate("login");
      return;
    }

    document.querySelectorAll(".page").forEach(function (p) {
      p.classList.toggle("active", p.getAttribute("data-page") === route);
    });

    document.querySelectorAll(".nav-link[data-nav]").forEach(function (l) {
      l.classList.toggle("active", l.getAttribute("data-nav") === route);
    });

    document.body.classList.toggle("pre-auth", route === "login");

    if (PAGE_TITLES[route]) document.title = PAGE_TITLES[route];

    updateAdminRibbon(route);
    applyGreetings();

    if (route === "resources") {
      var term = parsed.query.get("term");
      if (term) activateTab("term", "term-" + term);
      syncResourceBreadcrumb();
    }

    if (route === "handbook") loadIndustries();

    if (route === "founders" || route === "team") loadPeoplePhotos();

    if (route === "admin") {
      loadAdminStats();
      loadRegisteredUsers();
    }

    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", render);

  /* ---------------- Generic tab system ----------------
     Works for: auth tabs, term tabs.
     Markup contract:
       <div class="tabs" data-tabgroup="X">
         <button class="tab-btn" data-tab="a">..</button>
       </div>
       <div class="tab-panel" data-tabpanel="a" data-tabgroup="X">..</div>
  ------------------------------------------------------- */
  document.querySelectorAll("[data-tabgroup]").forEach(function (group) {
    if (!group.classList.contains("tabs")) return;
    var groupName = group.getAttribute("data-tabgroup");
    var buttons = group.querySelectorAll(".tab-btn");
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var tabId = btn.getAttribute("data-tab");
        activateTab(groupName, tabId);
        if (groupName === "term") {
          syncResourceBreadcrumb();
          var termNum = tabId.replace("term-", "");
          history.replaceState(null, "", "#resources?term=" + termNum);
        }
      });
    });
  });

  function activateTab(groupName, tabId) {
    document.querySelectorAll('.tabs[data-tabgroup="' + groupName + '"] .tab-btn').forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-tab") === tabId);
    });
    document.querySelectorAll('.tab-panel[data-tabgroup="' + groupName + '"]').forEach(function (p) {
      p.classList.toggle("active", p.getAttribute("data-tabpanel") === tabId);
    });
  }
  window.gcActivateTab = activateTab;

  /* ---------------- Auth: sign up ---------------- */
  var signupForm = document.getElementById("signupForm");
  if (signupForm) {
    var emailInput = document.getElementById("signupEmail");
    var emailError = document.getElementById("signupEmailError");
    var pw = document.getElementById("signupPassword");
    var pw2 = document.getElementById("signupConfirmPassword");
    var pwError = document.getElementById("signupPasswordError");
    var signupGeneralError = document.getElementById("signupGeneralError");
    var signupSubmitBtn = document.getElementById("signupSubmitBtn");

    signupForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      var validEmail = /^[a-zA-Z0-9._%+-]+@iimsambalpur\.ac\.in$/i.test(emailInput.value.trim());
      var passMatch = pw.value.length >= 6 && pw.value === pw2.value;

      emailInput.classList.toggle("field-error", !validEmail);
      emailInput.classList.toggle("field-ok", validEmail);
      emailError.classList.toggle("show", !validEmail);

      pw2.classList.toggle("field-error", !passMatch);
      pw2.classList.toggle("field-ok", passMatch);
      pwError.classList.toggle("show", !passMatch);

      signupGeneralError.classList.remove("show");

      if (!validEmail || !passMatch) return;

      var name = document.getElementById("signupName").value.trim();
      var emailVal = emailInput.value.trim();

      signupSubmitBtn.disabled = true;
      signupSubmitBtn.textContent = "Creating your account…";

      try {
        var signUpResult = await supabaseClient.auth.signUp({
          email: emailVal,
          password: pw.value,
          options: { data: { full_name: name } }
        });

        if (signUpResult.error) {
          var msg = /already registered|already exists/i.test(signUpResult.error.message || "")
            ? "This email is already registered — try logging in instead."
            : "We couldn't create your account. Please double-check your IIM Sambalpur email ID and try again.";
          signupGeneralError.textContent = msg;
          signupGeneralError.classList.add("show");
          return;
        }

        if (!signUpResult.data.session) {
          signupGeneralError.textContent = "Account created — please confirm your email before logging in.";
          signupGeneralError.classList.add("show");
          return;
        }

        await cacheSessionFromUser(signUpResult.data.session.user);
        recordLogin();
        navigate("welcome");
      } catch (err) {
        signupGeneralError.textContent = "Something went wrong. Please try again in a moment.";
        signupGeneralError.classList.add("show");
      } finally {
        signupSubmitBtn.disabled = false;
        signupSubmitBtn.textContent = "Create My GuruCool Account";
      }
    });

    emailInput.addEventListener("input", function () {
      emailError.classList.remove("show");
      emailInput.classList.remove("field-error", "field-ok");
    });
  }

  /* ---------------- Auth: login ---------------- */
  var loginForm = document.getElementById("loginForm");
  if (loginForm) {
    var loginErrorEl = document.getElementById("loginError");
    var loginSubmitBtn = document.getElementById("loginSubmitBtn");

    loginForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      var loginEmail = document.getElementById("loginEmail");
      var loginPassword = document.getElementById("loginPassword");
      var emailVal = (loginEmail && loginEmail.value.trim()) || "";
      var passVal = (loginPassword && loginPassword.value) || "";

      loginErrorEl.classList.remove("show");
      loginSubmitBtn.disabled = true;
      loginSubmitBtn.textContent = "Signing you in…";

      try {
        var signInResult = await supabaseClient.auth.signInWithPassword({ email: emailVal, password: passVal });

        if (signInResult.error || !signInResult.data.session) {
          loginErrorEl.classList.add("show");
          return;
        }

        await cacheSessionFromUser(signInResult.data.session.user);
        recordLogin();
        navigate(currentRole === "admin" ? "admin" : "dashboard");
      } catch (err) {
        loginErrorEl.classList.add("show");
      } finally {
        loginSubmitBtn.disabled = false;
        loginSubmitBtn.textContent = "Enter GuruCool";
      }
    });
  }

  /* ---------------- Dashboard search -> route on Enter ---------------- */
  var dashSearch = document.getElementById("dashSearchInput");
  if (dashSearch) {
    dashSearch.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var q = dashSearch.value.trim().toLowerCase();
      if (!q) return;
      if (/industry|handbook|bank|auto|pharma|fmcg|it |telecom|airline|ecommerce|e-commerce/.test(q)) {
        navigate("handbook");
      } else if (/term|note|assignment|ppt|subject|course/.test(q)) {
        navigate("resources");
      }
    });
  }

  /* ---------------- Contribute form (mockup, disabled submit) ---------------- */
  var contributeForm = document.getElementById("contributeForm");
  if (contributeForm) {
    contributeForm.addEventListener("submit", function (e) {
      e.preventDefault();
    });
  }

  /* ---------------- Generic modal ---------------- */
  window.gcOpenModal = function (title, body) {
    var overlay = document.getElementById("gcModal");
    if (!overlay) return;
    document.getElementById("gcModalTitle").textContent = title;
    document.getElementById("gcModalBody").textContent = body;
    overlay.classList.add("open");
  };
  window.gcCloseModal = function () {
    var overlay = document.getElementById("gcModal");
    if (overlay) overlay.classList.remove("open");
  };
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") window.gcCloseModal();
  });
  var modalOverlay = document.getElementById("gcModal");
  if (modalOverlay) {
    modalOverlay.addEventListener("click", function (e) {
      if (e.target === modalOverlay) window.gcCloseModal();
    });
  }

  /* ---------------- Session bootstrap ---------------- */
  async function initSession() {
    try {
      var sessionResult = await supabaseClient.auth.getSession();
      var session = sessionResult.data && sessionResult.data.session;
      if (session && session.user) {
        await cacheSessionFromUser(session.user);
        var parsed = parseHash();
        if (!window.location.hash || parsed.route === "login") {
          navigate(currentRole === "admin" ? "admin" : "dashboard");
          return;
        }
      }
    } catch (err) {
      // No valid session — fall through to login page.
    }
    render();
  }

  initSession();
})();
