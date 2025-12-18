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
  const cardImg = document.getElementById("cardImg");
  const cardAddr = document.getElementById("cardAddr");
  const cardTrans = document.getElementById("cardTrans");
  const cardDesc = document.getElementById("cardDesc");

  function setCard(guName) {
    const data = window.WALK_COURSES?.[guName];
    if (!data) return;

    cardTitle.textContent = data.title;
    cardAddr.textContent = data.addr;
    cardTrans.textContent = data.trans;
    cardDesc.textContent = data.desc;
    if (data.img) cardImg.src = data.img;
  }

  // 3) “구 이름 → SVG 요소” 찾기
  // ✅ busan_map.svg 안에서 각 구 path에 id가 "해운대구" 같은 식으로 붙어있으면 가장 확실함.
  // 만약 id가 다르면 아래 selector만 네 svg에 맞게 수정하면 됨.
  function pickGuEl(guName) {
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

  const targetGus = ["중구", "동래구", "부산진구", "해운대구"];

  // 4) 4개 구에 기본 스타일 부여 + 클릭 이벤트
  const guEls = new Map();
  targetGus.forEach((gu) => {
    const el = pickGuEl(gu);
    if (!el) return;

    el.classList.add("gu-focus");
    guEls.set(gu, el);

    el.addEventListener("click", () => {
      // (클릭 시) SVG 안의 모든 text를 회색으로 되돌리고
      svg.querySelectorAll("text").forEach((t) => (t.style.fill = "#000"));

      // 기존 선택 해제
      guEls.forEach((node) => node.classList.remove("is-selected"));

      // 선택된 구 내부의 text는 흰색으로
      el.querySelectorAll("text").forEach((t) => (t.style.fill = "#ffffffff"));

      // 선택 표시
      el.classList.add("is-selected");

      // 카드 내용 변경
      setCard(gu);
    });

    const initGu = "부산진구";

    const initEl = guEls.get(initGu);
    if (initEl) initEl.classList.add("gu-default"); // ✅ 해운대 기본 파란 텍스트
  });

  // 5) 초기값: 해운대구 선택 상태로 시작
  const initGu = "부산진구";
  if (guEls.get(initGu)) {
    guEls.forEach((node) => node.classList.remove("is-selected"));
  }
  setCard(initGu);
});

// // (클릭 시) SVG 안의 모든 text를 회색으로 되돌리고
// svg.querySelectorAll("text").forEach((t) => (t.style.fill = "#000"));

// // 선택된 구 내부의 text는 흰색으로
// el.querySelectorAll("text").forEach((t) => (t.style.fill = "#ffffffff"));

// const initGu = "해운대구";

// const initEl = guEls.get(initGu);
// if (initEl) initEl.classList.add("gu-default"); // ✅ 해운대 기본 파란 텍스트

// 6) 네이버 검색 결과 연동 함수
const searchInput = document.getElementById("regionSearch");
const searchResultsDiv = document.getElementById("searchResults");
const resultsQuerySpan = document.getElementById("resultsQuery");
const resultsListDiv = document.getElementById("resultsList");

/**
 * 네이버 블로그 검색 API를 호출하여 결과를 표시합니다.
 * - 검색어 뒤에 "산책"을 자동으로 추가합니다. (app.py에서 처리)
 */
const searchIcon = document.querySelector(".search-icon");

const handleSearch = async () => {
  // DOM 요소가 정상적으로 로드되었는지 확인
  if (
    !searchInput ||
    !searchResultsDiv ||
    !resultsQuerySpan ||
    !resultsListDiv
  ) {
    console.error("검색 관련 DOM 요소가 HTML에 모두 존재하지 않습니다.");
    return;
  }

  const query = searchInput.value.trim();

  // 검색어가 없으면 결과를 숨깁니다.
  if (query.length < 1) {
    searchResultsDiv.hidden = true;
    return;
  }

  // 로딩 중 표시 및 검색 영역 활성화
  resultsQuerySpan.textContent = `"${query} 핫플" (검색 중...)`;
  resultsListDiv.innerHTML =
    '<div style="padding: 12px; text-align: center; color: #808080;">네이버 블로그 검색 결과를 불러오는 중...</div>';
  searchResultsDiv.hidden = false;

  try {
    // query 파라미터로 사용자가 입력한 값만 보냅니다.
    const response = await fetch(
      `/api/naver-hotplace?q=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
      const errorJson = await response
        .json()
        .catch(() => ({ error: `HTTP ${response.status} 오류` }));
      throw new Error(
        errorJson.error ||
          `서버에서 알 수 없는 오류 발생 (Status: ${response.status})`
      );
    }

    const data = await response.json();

    // 검색 결과 표시 업데이트
    resultsQuerySpan.textContent = `"${query} 핫플" (${data.items.length}건)`;

    if (data.items.length === 0) {
      resultsListDiv.innerHTML =
        '<div style="padding: 12px; text-align: center; color: #808080;">검색 결과가 없습니다.</div>';
      return;
    }

    // 결과 리스트 HTML 생성 (블로그 형식: 제목 + 본문 1줄 + 블로거 이름)
    const resultsHtml = data.items
      .map(
        (item) => `
            <div class="results-item">
                <a href="${
                  item.link || "#"
                }" target="_blank" rel="noopener noreferrer" style="display: block;">
                    <div style="font-weight: 700; color: #000; font-size: 16px;">
                        ${item.title} </div>
                    <div class="results-meta">
                        ${
                          item.description
                        } <span style="color:#559DD5; margin-left: 8px;">(by ${
          item.bloggername || "블로그"
        })</span>
                    </div>
                </a>
            </div>
        `
      )
      .join("");

    resultsListDiv.innerHTML = resultsHtml;
  } catch (error) {
    console.error("Naver API 호출 중 오류 발생:", error);
    let errorMsg = error.message;

    if (errorMsg.includes("NAVER API 키가 없습니다")) {
      errorMsg =
        "NAVER API 키(Client ID/Secret)가 서버에 설정되지 않았습니다. app.py 환경 설정을 확인하세요.";
    }

    resultsListDiv.innerHTML = `<div style="padding: 12px; color: #cc0000; font-weight:700;">검색 실패: ${errorMsg}</div>`;
    resultsQuerySpan.textContent = `"${query} 핫플" (검색 실패)`;
  }
};

searchInput.addEventListener("keydown", async (e) => {
  if (e.key === "Enter") {
    await handleSearch();
  }
});
searchIcon.addEventListener("click", async () => {
  await handleSearch();
});
