    <div class="benefit-breakdown">
      ${welcomeLines}
      ${visibleBenefits
        .map((benefit) => {
          const isRedeemedMonetary = benefit?.type === "Points Redeemed" && !isPointBenefit(benefit) && toNumber(benefit.pointsAmount) > 0;
          const redeemedPoints = isPointBenefit(benefit)
            ? toNumber(benefit.amount)
            : toNumber(benefit.pointsAmount);
          const isRedeemedPoints = benefit?.type === "Points Redeemed" && redeemedPoints > 0;
          const impactLabel = isPointBenefit(benefit) ? "Points" : "Monetary";
          const name = isRedeemedMonetary ? formatPoints(benefit.pointsAmount) : (benefit.label || benefit.type);
          return `
            <span class="benefit-line${isRedeemedPoints ? " benefit-line-redeemed" : ""}">
              <span class="benefit-line-name" style="font-style: italic;">${escapeHtml(name)}</span>
              <span class="benefit-line-meta" style="background: rgba(148, 163, 184, 0.1); padding: 2px 8px; border-radius: 12px; font-style: italic;">${escapeHtml(benefit.type)} | ${escapeHtml(impactLabel)}</span>
              <strong>${escapeHtml(formatBenefitValue(benefit))}</strong>
            </span>
          `;
        })
        .join("")}
    </div>
  `;
}
function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.remove("show");
  }, 2300);
}
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
const APP_PIN = "1397"; // 🔥 change this
function checkPin() {
  const input = document.getElementById("pinInput").value;
  if (input === APP_PIN) {
    sessionStorage.setItem("unlocked", "true");
    document.getElementById("lockScreen").style.display = "none";
    document.getElementById("app").style.display = "block";
    showView("dashboard");
  } else {
    document.getElementById("pinError").style.display = "block";
  }
}
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("pinInput");
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        checkPin();
      }
    });
  }
});
// Auto-check on reload
window.addEventListener("DOMContentLoaded", () => {
  if (sessionStorage.getItem("unlocked") === "true") {
    document.getElementById("lockScreen").style.display = "none";
    document.getElementById("app").style.display = "block";
    showView("dashboard");
  }
});
function updateSortColor() {
  if (els.sortSelect) {
    if (els.sortSelect.value !== "netAsc") {
      els.sortSelect.style.color = "#f59e0b";
    } else {
      els.sortSelect.style.color = "#f8fafc";
    }
  }
}
function lockApp() {
  state.currentView = "dashboard";
  sessionStorage.setItem("currentView", "dashboard");
  updateAppBackButton();
  // clear session
  sessionStorage.removeItem("unlocked");
  // hide app
  const app = document.getElementById("app");
  app.style.display = "none";
  app.removeAttribute("data-visual-assets-ready");
  app.removeAttribute("data-visual-assets-view");
  // show lock screen
  document.getElementById("lockScreen").style.display = "flex";
  // reset input
  document.getElementById("pinInput").value = "";
  document.getElementById("pinError").style.display = "none";
}
// attach click event
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("lockBtn");
  if (btn) {
    btn.addEventListener("click", handleAppBackButton);
  }
});
function handleAppBackButton() {
  lockApp();
}
