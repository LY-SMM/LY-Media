/*
  main.js
  السلوك العام المشترك بين كل الصفحات: قائمة جانبية، تمييز الرابط النشط،
  سنة حقوق النشر، وكشف العناصر عند التمرير.
*/

(function () {
  "use strict";

  /* ——— القائمة الجانبية ——— */
  function initSidebar() {
    const toggle = document.querySelector(".nav-toggle");
    if (!toggle) return;

    let sidebar = document.querySelector(".sidebar");
    let overlay = document.querySelector(".sidebar-overlay");

    if (!sidebar) {
      sidebar = document.createElement("aside");
      sidebar.className = "sidebar";
      sidebar.setAttribute("aria-label", "القائمة الجانبية");

      const head = document.createElement("div");
      head.className = "sidebar__head";
      head.innerHTML =
        '<a class="sidebar__brand" href="index.html"><img src="assets/logo.svg" alt="" /><span>ليبيا GO</span></a>' +
        '<button class="sidebar__close" type="button" aria-label="إغلاق القائمة"><span data-icon="x" data-icon-size="18"></span></button>';
      sidebar.appendChild(head);

      const nav = document.createElement("nav");
      nav.className = "sidebar__nav";
      nav.setAttribute("aria-label", "التنقل الجانبي");

      const links = [
        { href: "index.html", label: "الرئيسية", icon: "home" },
        { href: "index.html#services", label: "الخدمات", icon: "grid" },
        { href: "wallet.html", label: "المحفظة والشحن", icon: "wallet" },
        { href: "settings.html", label: "الإعدادات", icon: "settings" },
      ];

      const path = location.pathname.split("/").pop() || "index.html";
      links.forEach(function (item) {
        const a = document.createElement("a");
        a.className = "sidebar__link";
        const target = item.href.split("/").pop().split("#")[0];
        if (target && target === path && item.href.indexOf("#") === -1) {
          a.classList.add("is-active");
        } else if (item.href === "index.html" && (path === "index.html" || path === "")) {
          a.classList.add("is-active");
        }
        a.href = item.href;
        a.innerHTML =
          '<span class="sidebar__icon" data-icon="' +
          item.icon +
          '" data-icon-size="18"></span><span>' +
          item.label +
          "</span>";
        nav.appendChild(a);
      });

      const logoutWrap = document.createElement("div");
      logoutWrap.style.marginTop = "auto";
      logoutWrap.style.paddingTop = "12px";
      const logout = document.createElement("button");
      logout.className = "sidebar__link";
      logout.type = "button";
      logout.style.width = "100%";
      logout.style.border = "0";
      logout.style.background = "transparent";
      logout.style.textAlign = "start";
      logout.innerHTML =
        '<span class="sidebar__icon" data-icon="logout" data-icon-size="18"></span><span>تسجيل الخروج</span>';
      logout.addEventListener("click", function () {
        if (window.AppAuth && typeof window.AppAuth.signOut === "function") {
          window.AppAuth.signOut();
        } else if (window.SupabaseClient && window.SupabaseClient.auth) {
          window.SupabaseClient.auth.signOut().then(function () {
            location.href = "login.html";
          });
        } else {
          location.href = "login.html";
        }
        closeSidebar();
      });
      logoutWrap.appendChild(logout);
      nav.appendChild(logoutWrap);

      sidebar.appendChild(nav);
      document.body.appendChild(sidebar);
    }

    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "sidebar-overlay";
      document.body.appendChild(overlay);
    }

    function openSidebar() {
      sidebar.classList.add("is-open");
      overlay.classList.add("is-open");
      document.body.classList.add("sidebar-open");
      toggle.setAttribute("aria-expanded", "true");
      const closeBtn = sidebar.querySelector(".sidebar__close");
      if (closeBtn) closeBtn.focus();
    }

    function closeSidebar() {
      sidebar.classList.remove("is-open");
      overlay.classList.remove("is-open");
      document.body.classList.remove("sidebar-open");
      toggle.setAttribute("aria-expanded", "false");
    }

    toggle.addEventListener("click", function () {
      if (sidebar.classList.contains("is-open")) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });

    sidebar.querySelectorAll(".sidebar__close").forEach(function (btn) {
      btn.addEventListener("click", closeSidebar);
    });
    overlay.addEventListener("click", closeSidebar);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeSidebar();
    });

    sidebar.querySelectorAll(".sidebar__link[href]").forEach(function (link) {
      link.addEventListener("click", function () {
        if (link.getAttribute("href") && link.getAttribute("href").indexOf("#") === -1) {
          closeSidebar();
        }
      });
    });

    if (window.Icons && window.Icons.hydrateIcons) {
      window.Icons.hydrateIcons(sidebar);
    }
  }

  /* ——— تمييز الرابط النشط حسب اسم الملف ——— */
  function initActiveLink() {
    const path = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav__link").forEach(function (link) {
      const href = link.getAttribute("href");
      if (!href) return;
      const target = href.split("/").pop();
      if (target === path) link.setAttribute("aria-current", "page");
    });
  }

  /* ——— سنة حقوق النشر ——— */
  function initYear() {
    document.querySelectorAll("[data-year]").forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });
  }

  /* ——— كشف العناصر عند التمرير (مرة واحدة) ——— */
  function initReveal() {
    const items = document.querySelectorAll("[data-reveal]");
    if (!items.length) return;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduce || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    items.forEach((el) => observer.observe(el));
  }

  document.addEventListener("DOMContentLoaded", function () {
    initSidebar();
    initActiveLink();
    initYear();
    initReveal();
  });
})();
