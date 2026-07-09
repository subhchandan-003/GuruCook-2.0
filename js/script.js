// GuruCool 2.0 — single-page app router + shared interactivity
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
  var MASTER_EMAIL = "admin@gurucool.in";
  var MASTER_PASSWORD = "GuruCool@Admin2.0";

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

  /* ---------------- Logout ---------------- */
  var logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      localStorage.removeItem("gc_name");
      localStorage.removeItem("gc_email");
      localStorage.removeItem("gc_role");
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
    var isAdmin = localStorage.getItem("gc_role") === "admin";
    var show = isAdmin && route !== "login" && route !== "admin";
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

  function render() {
    var parsed = parseHash();
    var route = ROUTES.indexOf(parsed.route) !== -1 ? parsed.route : "login";

    if (route === "admin" && localStorage.getItem("gc_role") !== "admin") {
      window.location.hash = "#login";
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

  /* ---------------- Auth page: sign up / login ---------------- */
  var signupForm = document.getElementById("signupForm");
  if (signupForm) {
    var emailInput = document.getElementById("signupEmail");
    var emailError = document.getElementById("signupEmailError");
    var pw = document.getElementById("signupPassword");
    var pw2 = document.getElementById("signupConfirmPassword");
    var pwError = document.getElementById("signupPasswordError");

    signupForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var validEmail = /^[a-zA-Z0-9._%+-]+@iimsambalpur\.ac\.in$/i.test(emailInput.value.trim());
      var passMatch = pw.value.length >= 6 && pw.value === pw2.value;

      emailInput.classList.toggle("field-error", !validEmail);
      emailInput.classList.toggle("field-ok", validEmail);
      emailError.classList.toggle("show", !validEmail);

      pw2.classList.toggle("field-error", !passMatch);
      pw2.classList.toggle("field-ok", passMatch);
      pwError.classList.toggle("show", !passMatch);

      if (!validEmail || !passMatch) return;

      var name = document.getElementById("signupName").value.trim();
      if (name) localStorage.setItem("gc_name", name);
      localStorage.setItem("gc_email", emailInput.value.trim());
      localStorage.setItem("gc_role", "student");
      navigate("welcome");
    });

    emailInput.addEventListener("input", function () {
      emailError.classList.remove("show");
      emailInput.classList.remove("field-error", "field-ok");
    });
  }

  var loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var loginEmail = document.getElementById("loginEmail");
      var loginPassword = document.getElementById("loginPassword");
      var emailVal = (loginEmail && loginEmail.value.trim()) || "";
      var passVal = (loginPassword && loginPassword.value) || "";

      if (emailVal.toLowerCase() === MASTER_EMAIL && passVal === MASTER_PASSWORD) {
        localStorage.setItem("gc_role", "admin");
        localStorage.setItem("gc_name", "Admin");
        localStorage.setItem("gc_email", emailVal);
        navigate("admin");
        return;
      }

      localStorage.setItem("gc_role", "student");
      if (emailVal) {
        var namePart = emailVal.split("@")[0].replace(/[._]/g, " ");
        localStorage.setItem("gc_name", namePart.replace(/\b\w/g, function (c) { return c.toUpperCase(); }));
        localStorage.setItem("gc_email", emailVal);
      }
      navigate("dashboard");
    });
  }

  /* ---------------- Generic search/filter ----------------
     Markup contract: input[data-filter-input="scope"], items[data-filter-item="scope"]
     Filters by textContent match; shows/hides items, and toggles an "empty state" node.
  ------------------------------------------------------- */
  document.querySelectorAll("[data-filter-input]").forEach(function (input) {
    var scope = input.getAttribute("data-filter-input");
    var items = document.querySelectorAll('[data-filter-item="' + scope + '"]');
    var emptyState = document.querySelector('[data-filter-empty="' + scope + '"]');

    function runFilter() {
      var q = input.value.trim().toLowerCase();
      var visibleCount = 0;
      items.forEach(function (item) {
        var text = (item.getAttribute("data-filter-text") || item.textContent).toLowerCase();
        var match = q === "" || text.indexOf(q) !== -1;
        item.classList.toggle("hidden", !match);
        if (match) visibleCount++;
      });
      if (emptyState) emptyState.classList.toggle("hidden", visibleCount !== 0);
    }
    input.addEventListener("input", runFilter);
  });

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

  /* ---------------- Initial render ---------------- */
  render();
})();
