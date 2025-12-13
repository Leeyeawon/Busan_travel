console.log("✅ course_walk.js 로드 성공");
(() => {
  "use strict";

  const STATIC_BASE = "/static/";

  const COURSE_DATA = {
    "해운대구": {
      title: "해운대 미포–해월전망대 해안 산책길",
      img: STATIC_BASE + "img/walk/산책-해운대 1.png",
      addr: "부산 해운대구 달맞이길62번길 13",
      trans: "중동역에서 걸어서 18분",
      desc: "넓게 펼쳐진 바다를 옆에 두고 나무 데크길을 따라 걸을 수 있는 부산 대표 산책 코스..."
    }
  };

  function getCourse(name) {
    return COURSE_DATA[name] || {
      title: `${name} 추천 산책 코스`,
      img: STATIC_BASE + "img/walk/default.png",
      addr: `${name} 일대`,
      trans: "대중교통 이용 후 도보 이동",
      desc: "이 구/군의 산책 코스를 여기에 작성해줘!"
    };
  }

  function updateCard(name) {
    const c = getCourse(name);
    const title = document.getElementById("cardTitle");
    const img = document.getElementById("cardImg");
    const addr = document.getElementById("cardAddr");
    const trans = document.getElementById("cardTrans");
    const desc = document.getElementById("cardDesc");

    if (!title || !img || !addr || !trans || !desc) return;

    title.textContent = c.title;
    img.src = c.img;
    img.alt = `${name} 코스 이미지`;
    addr.textContent = c.addr;
    trans.textContent = c.trans;
    desc.textContent = c.desc;
  }

  function injectStyle(svgRoot) {
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = `
      .district{
        cursor:pointer;
        pointer-events:all;
        transition: opacity .15s ease, stroke .15s ease;
        stroke: transparent;
        stroke-width: 2;
      }
      .district:hover{
        opacity:.85;
        stroke:#559DD5;
      }
      .district.is-selected{
        opacity:1;
        stroke:#559DD5;
        stroke-width:3;
        filter: drop-shadow(0 2px 8px rgba(85,157,213,0.35));
      }
    `;
    svgRoot.appendChild(style);
  }

  function pickTargets(svgRoot) {
    let targets = Array.from(svgRoot.querySelectorAll("[data-name]"));
    if (!targets.length) targets = Array.from(svgRoot.querySelectorAll("path[id], polygon[id], rect[id]"));
    if (!targets.length) targets = Array.from(svgRoot.querySelectorAll("path, polygon, rect"));

    targets = targets.filter(el => el.getAttribute("fill") !== "none");

    const rich = targets.some(el => el.hasAttribute("data-name") || el.hasAttribute("id"));
    if (rich) targets = targets.filter(el => el.hasAttribute("data-name") || el.hasAttribute("id"));

    return targets;
  }

  function getName(el) {
    return (el.getAttribute("data-name") || el.getAttribute("id") || "").trim() || "알 수 없음";
  }

  function attach(svgRoot) {
    injectStyle(svgRoot);

    const mapWrap = document.getElementById("mapWrap");
    const tooltip = document.getElementById("tooltip");
    const input = document.getElementById("regionSearch");

    const targets = pickTargets(svgRoot);
    if (!targets.length) {
      console.warn("⚠️ 클릭 대상이 0개야. SVG 안에 구역 path가 있는지 확인!");
      return;
    }

    targets.forEach(el => el.classList.add("district"));

    let selected = null;

    const showTooltip = (text, x, y) => {
      if (!tooltip || !mapWrap) return;
      tooltip.textContent = text;
      tooltip.style.opacity = "1";
      tooltip.style.transform = "translateY(0)";
      const rect = mapWrap.getBoundingClientRect();
      tooltip.style.left = `${x - rect.left + 12}px`;
      tooltip.style.top = `${y - rect.top + 12}px`;
      tooltip.setAttribute("aria-hidden", "false");
    };

    const hideTooltip = () => {
      if (!tooltip) return;
      tooltip.style.opacity = "0";
      tooltip.style.transform = "translateY(4px)";
      tooltip.setAttribute("aria-hidden", "true");
    };

    const setSelected = (el) => {
      if (selected) selected.classList.remove("is-selected");
      selected = el;
      selected.classList.add("is-selected");
    };

    targets.forEach(el => {
      const name = getName(el);

      el.addEventListener("mousemove", (e) => showTooltip(name, e.clientX, e.clientY));
      el.addEventListener("mouseleave", hideTooltip);

      el.addEventListener("click", () => {
        setSelected(el);
        updateCard(name);
        if (input) input.value = name;
      });
    });

    mapWrap?.addEventListener("mouseleave", hideTooltip);
    console.log("✅ SVG 이벤트 연결 완료 / targets:", targets.length);
  }

  async function loadInlineSvg() {
    console.log("✅ course_walk.js 로드됨");

    const container = document.getElementById("mapContainer");
    if (!container) {
      console.warn("mapContainer 없음");
      return;
    }

    const url = container.dataset.svgUrl;
    console.log("svg url:", url);

    if (!url) {
      console.warn("data-svg-url이 없어!");
      return;
    }

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`SVG fetch 실패: ${res.status} ${res.statusText}`);

    const svgText = await res.text();
    container.innerHTML = svgText;

    const svgRoot = container.querySelector("svg");
    if (!svgRoot) {
      console.warn("SVG 루트 없음(파일 내용 확인 필요)");
      return;
    }

    svgRoot.style.pointerEvents = "auto";
    attach(svgRoot);
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadInlineSvg().catch(err => console.error("❌ loadInlineSvg error:", err));
  });
})();
