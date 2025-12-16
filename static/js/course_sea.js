document.addEventListener("DOMContentLoaded", async () => {
  const mapContainer = document.getElementById("mapContainer");
  const svgUrl = mapContainer?.dataset.svgUrl;
  if (!mapContainer || !svgUrl) return;

  // 1) SVG 불러와 삽입
  const res = await fetch(svgUrl);
  const svgText = await res.text();
  mapContainer.innerHTML = svgText;

  const svg = mapContainer.querySelector("svg");
  if (!svg) return;

  // 2) 카드 DOM
  const cardTitle = document.getElementById("cardTitle");
  const cardImg   = document.getElementById("cardImg");
  const cardAddr  = document.getElementById("cardAddr");
  const cardTrans = document.getElementById("cardTrans");
  const cardDesc  = document.getElementById("cardDesc");

  function setCard(guName){
    const data = window.WALK_COURSES?.[guName];
    if (!data) return;

    cardTitle.textContent = data.title;
    cardAddr.textContent  = data.addr;
    cardTrans.textContent = data.trans;
    cardDesc.textContent  = data.desc;
    if (data.img) cardImg.src = data.img;
  }

  // 3) “구 이름 → SVG 요소” 찾기
  // ✅ busan_map.svg 안에서 각 구 path에 id가 "해운대구" 같은 식으로 붙어있으면 가장 확실함.
  // 만약 id가 다르면 아래 selector만 네 svg에 맞게 수정하면 됨.
  function pickGuEl(guName){
    // 1순위: id 정확히 일치
    let el = svg.querySelector(`#${CSS.escape(guName)}`);
    if (el) return el;

    // 2순위: id에 일부 포함(예: "해운대"만 들어간 경우)
    const key = guName.replace("구", "");
    el = svg.querySelector(`[id*="${key}"]`);
    if (el) return el;

    // 3순위: data-name / aria-label 등
    el = svg.querySelector(`[data-name="${guName}"], [aria-label="${guName}"]`);
    return el;
  }

  const targetGus = ["해운대구", "기장군", "수영구", "사하구" ];

  // 4) 4개 구에 기본 스타일 부여 + 클릭 이벤트
  const guEls = new Map();
  targetGus.forEach((gu) => {
    const el = pickGuEl(gu);
    if (!el) return;

    el.classList.add("gu-focus");
    guEls.set(gu, el);

    el.addEventListener("click", () => {
      // 기존 선택 해제
      guEls.forEach((node) => node.classList.remove("is-selected"));

      // 선택 표시
      el.classList.add("is-selected");

      // 카드 내용 변경
      setCard(gu);
    });
  });

  // 5) 초기값: 해운대구 선택 상태로 시작
  const initGu = "해운대구";
  if (guEls.get(initGu)) {
    guEls.forEach((node) => node.classList.remove("is-selected"));
  }
  setCard(initGu);
});

const initEl = guEls.get(initGu);
if (initEl) initEl.classList.add("gu-default");  // ✅ 해운대 기본 파란 텍스트

  // ✅ 6) 검색창: "지역 + 산책로" 네이버 검색(API) → 결과 출력
  const input = document.getElementById("regionSearch");
  const box = document.getElementById("searchResults");
  const list = document.getElementById("resultsList");
  const qText = document.getElementById("resultsQuery");

  async function runSearch(keyword){
    const q = (keyword || "").trim();
    if (!q) return;

    const queryForNaver = `${q} 산책로`;
    qText.textContent = queryForNaver;

    // 결과 박스 열기
    box.hidden = false;
    list.innerHTML = `<div class="results-item">검색 중...</div>`;

    try{
      const res = await fetch(`/api/naver-walk?q=${encodeURIComponent(queryForNaver)}`);
      const data = await res.json();

      if (!data.items || data.items.length === 0){
        list.innerHTML = `<div class="results-item">결과가 없어요.</div>`;
        return;
      }

      list.innerHTML = data.items.map(item => {
        return `
          <div class="results-item">
            <a href="${item.link}" target="_blank" rel="noopener">${item.title}</a>
            <div class="results-meta">
              ${item.category ? `🏷 ${item.category}<br/>` : ""}
              ${item.roadAddress ? `📍 ${item.roadAddress}<br/>` : ""}
              ${item.telephone ? `☎ ${item.telephone}` : ""}
            </div>
          </div>
        `;
      }).join("");

    }catch(e){
      list.innerHTML = `<div class="results-item">검색 오류: ${e.message}</div>`;
    }
  }

  // 엔터로 검색
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runSearch(input.value);
  });
