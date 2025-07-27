<script>
  document.addEventListener("DOMContentLoaded", function () {
    const modal = document.getElementById("size-guide-modal");
    const openBtn = document.querySelector(".open-size-guide");
    const closeBtn = modal?.querySelector(".size-guide-close");
    const overlay = modal?.querySelector(".size-guide-overlay");

    if (openBtn && modal) {
      openBtn.addEventListener("click", () => {
        modal.classList.add("active");
      });

      closeBtn?.addEventListener("click", () => {
        modal.classList.remove("active");
      });

      overlay?.addEventListener("click", () => {
        modal.classList.remove("active");
      });
    }
  });
</script>
