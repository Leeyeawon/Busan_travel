document.addEventListener("DOMContentLoaded", () => {
  const posters = Array.from(document.querySelectorAll(".js-poster"));
  const overlays = Array.from(document.querySelectorAll(".js-overlay"));

  // poster-1 -> overlay DOM 찾기
  function getOverlayFor(poster) {
    const posterClass = Array.from(poster.classList).find((c) => c.startsWith("poster-"));
    if (!posterClass) return null;
    return overlays.find((ov) => ov.dataset.for === posterClass) || null;
  }

  function closePoster(poster) {
    const overlay = getOverlayFor(poster);
    if (overlay) overlay.classList.remove("is-open");

    // 원본 이미지로 복귀
    const original = poster.dataset.original;
    if (original) poster.src = original;

    poster.dataset.open = "0";
  }

  function openPoster(poster) {
    const overlay = getOverlayFor(poster);
    const swapped = poster.dataset.swapped;

    if (swapped) poster.src = swapped;
    if (overlay) overlay.classList.add("is-open");

    poster.dataset.open = "1";

    // ✅ 애니 재시작(연속 클릭에도 모션 나오게)
    poster.classList.remove("poster-anim");
    if (overlay) overlay.classList.remove("overlay-anim");
    void poster.offsetWidth; // reflow
    poster.classList.add("poster-anim");
    if (overlay) overlay.classList.add("overlay-anim");
  }

  function togglePoster(poster) {
    const isOpen = poster.dataset.open === "1";

    if (isOpen) {
      closePoster(poster);
      return;
    }

    // 다른 포스터 열려있으면 닫기
    posters.forEach((p) => {
      if (p !== poster) closePoster(p);
    });

    openPoster(poster);
  }

  // 초기값
  posters.forEach((p) => (p.dataset.open = "0"));

  // ✅ 포스터 클릭
  posters.forEach((poster) => {
    poster.addEventListener("click", () => togglePoster(poster));
  });

  // ✅ 오버레이 클릭(오버레이가 포스터 위를 덮으므로 “다시 누르면 원복” 동작을 위해 필요)
  overlays.forEach((overlay) => {
    overlay.addEventListener("click", () => {
      const targetPosterClass = overlay.dataset.for; // "poster-1"
      const poster = posters.find((p) => p.classList.contains(targetPosterClass));
      if (poster) togglePoster(poster);
    });
  });
});
