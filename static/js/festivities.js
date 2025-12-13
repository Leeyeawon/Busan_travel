document.addEventListener("DOMContentLoaded", () => {
  const config = [
    {
      posterSel: ".poster-1",
      overlaySel: ".overlay-1",
      swappedSrc: "img/광안리어방축제_상세.png",
    },
    {
      posterSel: ".poster-2",
      overlaySel: ".overlay-2",
      swappedSrc: "img/국제영화제_상세.png",
    },
    {
      posterSel: ".poster-3",
      overlaySel: ".overlay-3",
      swappedSrc: "img/불꽃축제_상세.png",
    },
  ];

  const items = config
    .map((c) => {
      const poster = document.querySelector(c.posterSel);
      const overlay = document.querySelector(c.overlaySel);
      if (!poster || !overlay) return null;

      poster.dataset.originalSrc = poster.getAttribute("src");
      poster.dataset.open = "0"; // 초기 닫힘

      return { ...c, poster, overlay };
    })
    .filter(Boolean);

  const closeItem = ({ poster, overlay }) => {
    overlay.classList.remove("is-open");
    poster.setAttribute("src", poster.dataset.originalSrc);
    poster.dataset.open = "0";
  };

  const openItem = ({ poster, overlay, swappedSrc }) => {
    poster.setAttribute("src", swappedSrc);
    overlay.classList.add("is-open");
    poster.dataset.open = "1";

    // ✅ 애니메이션 재시작(연속 클릭에도 모션 나오게)
    poster.classList.remove("poster-anim");
    overlay.classList.remove("overlay-anim");
    void poster.offsetWidth; // reflow
    poster.classList.add("poster-anim");
    overlay.classList.add("overlay-anim");
  };

  items.forEach((item) => {
    item.poster.addEventListener("click", () => {
      const isOpen = item.poster.dataset.open === "1";

      if (isOpen) {
        // ✅ 같은 포스터 다시 누르면 원복(닫힘)
        closeItem(item);
        return;
      }

      // ✅ 다른 포스터 열려있으면 닫고, 클릭한 것만 열기
      items.forEach((it) => it !== item && closeItem(it));
      openItem(item);
    });
  });
});
