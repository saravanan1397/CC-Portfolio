const storageKey = "credit-card-portfolio-v1";

const benefitTypes = [
  "Welcome Benefit (Points)",
  "Welcome Benefit (Monetary)",
  "Points Redeemed",
  "Unredeemed Points",
  "Cashback / Statement Credit",
  "Milestone / Voucher",
];

const benefitValueTypes = [
  { value: "cash", label: "Monetary Value (Redeemed/Cashback)" },
  { value: "points", label: "Points (Unredeemed)" },
];

const sampleCards = [
  {
    id: "sample-premium",
    name: "Premium Travel Card",
    issuer: "Example Bank",
    annualFee: 12500,
    taxFee: 2250,
    targetValue: 14750,
    notes: "High fee card; keep only if travel benefits are used.",
    benefits: [
      { id: "b1", type: "Lounge", label: "Lounge Access", amount: 8000, valueType: "cash" },
      { id: "b2", type: "Voucher", label: "Travel Voucher", amount: 6000, valueType: "cash" },
      { id: "b3", type: "Unredeemed Points", label: "Pending Points", amount: 3500, valueType: "points" },
    ],
  },
  {
    id: "sample-cashback",
    name: "Cashback Card",
    issuer: "Daily Spend Bank",
    annualFee: 999,
    taxFee: 180,
    targetValue: 1179,
    notes: "Used for groceries and utilities.",
    benefits: [
      { id: "b4", type: "Cashback / Credit", label: "Monthly Cashback", amount: 7800, valueType: "cash" },
      { id: "b5", type: "Cashback / Credit", label: "Utility Offer", amount: 1200, valueType: "cash" },
    ],
  },
  {
    id: "sample-fuel",
    name: "Fuel Card",
    issuer: "Metro Finance",
    annualFee: 499,
    taxFee: 90,
    targetValue: 589,
    notes: "Low fee keeper if surcharge waiver continues.",
    benefits: [
      { id: "b6", type: "Cashback / Credit", label: "Fuel Surcharge Waiver", amount: 2100, valueType: "cash" },
      { id: "b7", type: "Milestone", label: "Spend Milestone", amount: 750, valueType: "cash" },
    ],
  },
];

const state = {
  currency: "INR",
  cards: [],
  swipes: [],
  rpSpends: [],
  loungeVisits: [],
  search: "",
  swipeSearch: "",
  statusFilter: "all",
  sort: "netAsc",
  currentView: sessionStorage.getItem("currentView") || "dashboard",
};

let draftBenefits = [];
let draftPreviousAnnualFees = [];
let draftFutureAnnualFees = [];
let toastTimer = null;
let loungeChartInstance = null;

// Client-side rendering limits to improve initial load performance
const INITIAL_VISIBLE_CARDS = 20;
let cardsAllExpanded = false; // set true when user clicks "Load more"
let swipesAllExpanded = false;
let rpSpendsAllExpanded = false;
let loungeAllExpanded = false;

const els = {};

document.addEventListener("DOMContentLoaded", async () => {
  
cacheElements();
await loadState();
bindEvents();
initUiEnhancements();
resetForm();
render();
});

function cacheElements() {
  Object.assign(els, {
    newCardBtn: document.getElementById("newCardBtn"),
    searchInput: document.getElementById("searchInput"),
    statusFilter: document.getElementById("statusFilter"),
    sortSelect: document.getElementById("sortSelect"),
    netMetric: document.getElementById("netMetric"),
    sortSelect: document.getElementById("sortSelect"),
    netValue: document.getElementById("netValue"),
    netHint: document.getElementById("netHint"),
    feeValue: document.getElementById("feeValue"),
    feeHint: document.getElementById("feeHint"),
    benefitValue: document.getElementById("benefitValue"),
    benefitHint: document.getElementById("benefitHint"),
    pointsValue: document.getElementById("pointsValue"),
    pointsHint: document.getElementById("pointsHint"),
    coverageValue: document.getElementById("coverageValue"),
    coverageHint: document.getElementById("coverageHint"),
    cardForm: document.getElementById("cardForm"),
    formTitle: document.getElementById("formTitle"),
    editingId: document.getElementById("editingId"),
    cardName: document.getElementById("cardName"),
    issuerName: document.getElementById("issuerName"),
    annualFee: document.getElementById("annualFee"),
    taxFee: document.getElementById("taxFee"),
    memberSince: document.getElementById("memberSince"),
    targetValue: document.getElementById("targetValue"),
    notes: document.getElementById("notes"),
    benefitRows: document.getElementById("benefitRows"),
    addBenefitBtn: document.getElementById("addBenefitBtn"),
    clearFormBtn: document.getElementById("clearFormBtn"),
    portfolioCount: document.getElementById("portfolioCount"),
    recoveryTitle: document.getElementById("recoveryTitle"),
    recoveryText: document.getElementById("recoveryText"),
    recoveryBar: document.getElementById("recoveryBar"),
    cardsTable: document.getElementById("cardsTable"),
    categoryTotal: document.getElementById("categoryTotal"),
    categoryBars: document.getElementById("categoryBars"),
    toast: document.getElementById("toast"),
    dashboardView: document.getElementById("dashboardView"),
    portfolioView: document.getElementById("portfolioView"),
    swipesView: document.getElementById("swipesView"),
    rpSpendsView: document.getElementById("rpSpendsView"),
    loungeView: document.getElementById("loungeView"),
    dashboardNetValue: document.getElementById("dashboardNetValue"),
    dashboardNetHint: document.getElementById("dashboardNetHint"),
    dashboardSwipeValue: document.getElementById("dashboardSwipeValue"),
    dashboardSwipeHint: document.getElementById("dashboardSwipeHint"),
    dashboardLoungeValue: document.getElementById("dashboardLoungeValue"),
    dashboardLoungeHint: document.getElementById("dashboardLoungeHint"),
    dashboardRpValue: document.getElementById("dashboardRpValue"),
    dashboardRpHint: document.getElementById("dashboardRpHint"),
    openPortfolioBtn: document.getElementById("openPortfolioBtn"),
    openSwipesBtn: document.getElementById("openSwipesBtn"),
    openRpSpendsBtn: document.getElementById("openRpSpendsBtn"),
    editingSwipeId:document.getElementById("editingSwipeId"),
    openLoungeBtn: document.getElementById("openLoungeBtn"),
    backFromPortfolioBtn: document.getElementById("backFromPortfolioBtn"),
    backFromSwipesBtn: document.getElementById("backFromSwipesBtn"),
    backFromRpSpendsBtn: document.getElementById("backFromRpSpendsBtn"),
    backFromLoungeBtn: document.getElementById("backFromLoungeBtn"),
    exportBtn: document.getElementById("exportBtn"),
    importBtn: document.getElementById("importBtn"),
    importFile: document.getElementById("importFile"),
    swipeCardSelect: document.getElementById("swipeCardSelect"),
    swipeAmount: document.getElementById("swipeAmount"),
    swipeCategorySelect: document.getElementById("swipeCategorySelect"),
    swipeSpentFor: document.getElementById("swipeSpentFor"),
    swipeProgressPlaceholder: document.getElementById("swipeProgressPlaceholder"),
    editingSwipeId: document.getElementById("editingSwipeId"),
spentCardSelect:document.getElementById("spentCardSelect"),
spentAmount:document.getElementById("spentAmount"),
spentTypeSelect:document.getElementById("spentTypeSelect"),
spentFySelect:document.getElementById("spentFySelect"),
spentForText:document.getElementById("spentForText"),
spentForBtn:document.getElementById("spentForBtn"),
    swipeTypeSelect: document.getElementById("swipeTypeSelect"),
    swipeFySelect: document.getElementById("swipeFySelect"),
    swipeFyFilter: document.getElementById("swipeFyFilter"),
    swipeCategoryFilter: document.getElementById("swipeCategoryFilter"),
    swipeTypeFilter: document.getElementById("swipeTypeFilter"),
    swipeSortFilter: document.getElementById("swipeSortFilter"),
    swipeFilteredTotal: document.getElementById("swipeFilteredTotal"),
    swipeCardFilter: document.getElementById("swipeCardFilter"),
    swipeSearchInput: document.getElementById("swipeSearchInput"),
    addSwipeBtn: document.getElementById("addSwipeBtn"),
    clearSwipeBtn: document.getElementById("clearSwipeBtn") || document.getElementById("cancelSwipeBtn"),
    editingSwipeId: document.getElementById("editingSwipeId"), // Ensure this hidden input exists in HTML
    swipesTable: document.getElementById("swipesTable"),
    editingRpSpendId: document.getElementById("editingRpSpendId"),
    editingRpPurchaseId: document.getElementById("editingRpPurchaseId"),
    rpCardSelect: document.getElementById("rpCardSelect"),
    rpPoints: document.getElementById("rpPoints"),
    rpPointsValue: document.getElementById("rpPointsValue"),
    rpRedemptionCharges: document.getElementById("rpRedemptionCharges"),
    rpCardPaid: document.getElementById("rpCardPaid"),
    rpVoucherPaid: document.getElementById("rpVoucherPaid"),
    rpPurchasedFrom: document.getElementById("rpPurchasedFrom"),
    rpProductName: document.getElementById("rpProductName"),
    rpProductValue: document.getElementById("rpProductValue"),
    rpPointsReceived: document.getElementById("rpPointsReceived"),
    rpPaidValue: document.getElementById("rpPaidValue"),
    saveRpSpendBtn: document.getElementById("saveRpSpendBtn"),
    clearRpSpendBtn: document.getElementById("clearRpSpendBtn"),
    rpConfirmModal: document.getElementById("rpConfirmModal"),
    rpConfirmOkBtn: document.getElementById("rpConfirmOkBtn"),
    rpConfirmCancelBtn: document.getElementById("rpConfirmCancelBtn"),
    rpSpendsTable: document.getElementById("rpSpendsTable"),
    loungeCardSelect: document.getElementById("loungeCardSelect"),
    loungeTypeSelect: document.getElementById("loungeTypeSelect"),
    loungeMembers: document.getElementById("loungeMembers"),
    loungeAirport: document.getElementById("loungeAirport"),
    loungeVisitValue: document.getElementById("loungeVisitValue"),
    loungeVisitDate: document.getElementById("loungeVisitDate"),
    saveLoungeVisitBtn: document.getElementById("saveLoungeVisitBtn"),
    clearLoungeVisitBtn: document.getElementById("clearLoungeVisitBtn"),
    editingLoungeVisitId: document.getElementById("editingLoungeVisitId"),
    loungeTable: document.getElementById("loungeTable"),
    loungeCalculatedValue: document.getElementById("loungeCalculatedValue"),
    loungeBenefitType: document.getElementById("loungeBenefitType"),
    loungeCardFilter: document.getElementById("loungeCardFilter"),
    loungeBenefitLabel: document.getElementById("loungeBenefitLabel"),
    loungeBenefitValue: document.getElementById("loungeBenefitValue"),
    saveLoungeBenefitBtn: document.getElementById("saveLoungeBenefitBtn"),
    clearLoungeBenefitBtn: document.getElementById("clearLoungeBenefitBtn"),
    loungeTypeFilter: document.getElementById("loungeTypeFilter"),
    scrollTopBtn: document.getElementById("scrollTopBtn"),

    prevYearFee: document.getElementById("prevYearFee"), // This maps to the input for Previous Annual Fee
    prevFeeContainer: document.getElementById("prevFeeContainer"),
    previousFeeDate: document.getElementById("previousFeeDate"),
    previousFeeDateContainer: document.getElementById("previousFeeDateContainer"),
    previousFeeList: document.getElementById("previousFeeList"),
    futureFeeDate: document.getElementById("futureFeeDate"),
    futureAnnualFee: document.getElementById("futureAnnualFee"),
    futureFeeDateContainer: document.getElementById("futureFeeDateContainer"),
    futureAnnualFeeContainer: document.getElementById("futureAnnualFeeContainer"),
    futureFeeList: document.getElementById("futureFeeList"),
  });
}

function bindEvents() {
  els.searchInput.addEventListener("input", () => {
    state.search = els.searchInput.value.trim().toLowerCase();
    // collapse expanded list when new query typed
    cardsAllExpanded = false;
    renderCards();
  });

  els.statusFilter.addEventListener("change", () => {
    state.statusFilter = els.statusFilter.value;
    cardsAllExpanded = false;
    renderCards();
  });

  els.sortSelect.addEventListener("change", () => {
    state.sort = els.sortSelect.value;
    cardsAllExpanded = false;
    renderCards();
  });

  els.newCardBtn.addEventListener("click", () => {
    resetForm();
    els.cardName.focus();
  });

  els.feeValue.addEventListener("click", () => {
    showFeePopup();
  });

  document.addEventListener("click", (e) => {
  if (e.target.id === "pointsValue") {
    showPointsPopup();
  }
});

document.addEventListener("click", (e) => {
  if (e.target.id === "benefitValue") {
    showCashPopup();
  }
});

document.addEventListener("click", (e) => {
  if (e.target.id === "pointsValue") {
    showPointsPopup();
  }

  if (e.target.id === "closePointsModal") {
    document.getElementById("pointsModal").style.display = "none";
  }

  if (e.target.id === "pointsModal") {
    document.getElementById("pointsModal").style.display = "none";
  }
});

  els.clearFormBtn.addEventListener("click", resetForm);
  els.addBenefitBtn.addEventListener("click", addBenefitDraft);
  els.cardForm.addEventListener("submit", saveCardFromForm);
  els.benefitRows.addEventListener("input", updateDraftBenefit);
  els.benefitRows.addEventListener("change", updateDraftBenefit);
  els.benefitRows.addEventListener("click", removeBenefitDraft);
  els.cardsTable.addEventListener("click", handleCardAction);
  els.memberSince.addEventListener("change", togglePreviousFeeField);
  els.previousFeeDate?.addEventListener("change", loadSelectedPreviousFee);
  els.prevYearFee?.addEventListener("input", syncPreviousFeeFromForm);
  els.prevYearFee?.addEventListener("change", syncPreviousFeeFromForm);
  els.previousFeeList?.addEventListener("click", removePreviousFeeDraft);
  els.futureFeeDate?.addEventListener("change", loadSelectedFutureFee);
  els.futureAnnualFee?.addEventListener("input", syncFutureFeeFromForm);
  els.futureAnnualFee?.addEventListener("change", syncFutureFeeFromForm);
  els.futureFeeList?.addEventListener("click", removeFutureFeeDraft);
  els.openPortfolioBtn?.addEventListener("click", () => showView("portfolio"));
  els.openSwipesBtn?.addEventListener("click", () => showView("swipes"));
  els.openRpSpendsBtn?.addEventListener("click", () => showView("rpSpends"));
  els.openLoungeBtn?.addEventListener("click", () => showView("lounge"));
  els.backFromPortfolioBtn?.addEventListener("click", () => showView("dashboard"));
  els.backFromSwipesBtn?.addEventListener("click", () => showView("dashboard"));
  els.backFromRpSpendsBtn?.addEventListener("click", () => showView("dashboard"));
  els.backFromLoungeBtn?.addEventListener("click", () => showView("dashboard"));
  els.swipeFyFilter?.addEventListener("change", () => { swipesAllExpanded = false; renderSwipes(); });
  els.swipeCategoryFilter?.addEventListener("change", () => { swipesAllExpanded = false; renderSwipes(); });
  els.swipeTypeFilter?.addEventListener("change", () => { swipesAllExpanded = false; renderSwipes(); });
  els.swipeSortFilter?.addEventListener("change", () => { swipesAllExpanded = false; renderSwipes(); });
  els.swipeCardFilter?.addEventListener("change", () => { swipesAllExpanded = false; renderSwipes(); });
  els.swipeSearchInput?.addEventListener("input", () => {
    state.swipeSearch = els.swipeSearchInput.value.trim().toLowerCase();
    swipesAllExpanded = false;
    renderSwipes();
  });
  els.swipeTypeFilter?.addEventListener("change", renderSwipes);
  els.addSwipeBtn?.addEventListener("click", addSwipeFromForm);
  els.exportBtn?.addEventListener("click", exportPortfolio);
  els.importBtn?.addEventListener("click", () => els.importFile?.click());
  els.importFile?.addEventListener("change", importPortfolio);
  els.clearSwipeBtn?.addEventListener("click", resetSwipeForm);
  els.swipesTable?.addEventListener("click", handleSwipeAction);
  [els.rpPointsValue, els.rpRedemptionCharges, els.rpCardPaid, els.rpVoucherPaid].forEach((input) => {
    input?.addEventListener("input", updateRpPaidValue);
  });
  els.saveRpSpendBtn?.addEventListener("click", saveRpSpendFromForm);
  els.clearRpSpendBtn?.addEventListener("click", resetRpSpendForm);
  els.rpConfirmOkBtn?.addEventListener("click", () => handleRpSpendConfirm(true));
  els.rpConfirmCancelBtn?.addEventListener("click", () => handleRpSpendConfirm(false));
  els.rpSpendsTable?.addEventListener("click", handleRpSpendAction);
  els.loungeMembers?.addEventListener("input", updateLoungeCalculatedValue);
  els.loungeVisitValue?.addEventListener("input", updateLoungeCalculatedValue);
  els.saveLoungeVisitBtn?.addEventListener("click", saveLoungeVisitFromForm);
  els.clearLoungeVisitBtn?.addEventListener("click", resetLoungeVisitForm);
  els.loungeTable?.addEventListener("click", handleLoungeAction);
  els.saveLoungeBenefitBtn?.addEventListener("click", saveLoungeBenefitFromForm);
  els.clearLoungeBenefitBtn?.addEventListener("click", resetLoungeBenefitForm);
  els.loungeCardFilter?.addEventListener("change", () => { loungeAllExpanded = false; renderLoungeVisits(); });
  els.loungeTypeFilter?.addEventListener("change", () => { loungeAllExpanded = false; renderLoungeVisits(); });
  els.scrollTopBtn?.addEventListener("click", scrollToPageTop);
  window.addEventListener("scroll", updateScrollTopButton, { passive: true });
}

async function loadState() {
  try {
    const { doc, getDoc } = window.firebaseFns;

    const snap = await getDoc(doc(window.db, "portfolio", "userData"));

    if (snap.exists()) {
      const data = snap.data();

      state.currency = data.currency || "INR";
      state.cards = (data.cards || []).map(normalizeCard);
      state.swipes = (data.swipes || []).map(normalizeSwipe);
      state.rpSpends = (data.rpSpends || []).map(normalizeRpSpend);
      state.loungeVisits = (data.loungeVisits || []).map(normalizeLoungeVisit);
      syncLoungeBenefitsFromVisits();

      console.log("✅ Data loaded from Firebase", state.cards);
    } else {
      console.log("⚠️ No data found in Firebase");
    }
  } catch (e) {
    console.error("❌ Load failed", e);
  }
}

async function saveState() {
  console.log("🔥 saveState triggered");

  const { doc, setDoc } = window.firebaseFns;

  await setDoc(doc(window.db, "portfolio", "userData"), {
    currency: state.currency,
    cards: state.cards,
    swipes: state.swipes,
    rpSpends: state.rpSpends,
    loungeVisits: state.loungeVisits,
  });

  console.log("✅ Saved to Firebase");
}

function normalizeCard(card) {
  return {
    id: card.id || createId(),
    name: card.name || "",
    issuer: card.issuer || "",
    annualFee: toNumber(card.annualFee),
    taxFee: toNumber(card.taxFee),
    isGreyedOut: !!card.isGreyedOut,
    memberSince: card.memberSince || "",
    previousAnnualFees: normalizePreviousAnnualFees(card),
    futureAnnualFees: normalizeFutureAnnualFees(card),
    targetValue: toNumber(card.targetValue),
    notes: card.notes || "",
    benefits: Array.isArray(card.benefits)
      ? card.benefits.map((benefit) => ({
          id: benefit.id || createId(),
          type: benefitTypes.includes(benefit.type) ? benefit.type : "Other",
          valueType: normalizeBenefitValueType(benefit.valueType),
          label: benefit.label || "",
          amount: toNumber(benefit.amount),
        }))
      : [],
  };
}

function normalizeSwipe(swipe) {
  return {
    id: swipe.id || createId(),
    cardId: swipe.cardId || "",
    amount: toNumber(swipe.amount),
    type: swipe.type === "E" ? "E" : "F",
    financialYear: normalizeFinancialYear(swipe.financialYear),
    category: normalizeSwipeCategory(swipe.category),
    spentFor: swipe.spentFor || "",
    createdAt: swipe.createdAt || new Date().toISOString(),
  };
}

function normalizeRpSpend(spend) {
  const id = spend.id || createId();

  return {
    id,
    purchaseId: spend.purchaseId || spend.productGroupId || id,
    cardId: spend.cardId || "",
    points: toNumber(spend.points),
    pointsValue: toNumber(spend.pointsValue ?? spend.value),
    redemptionCharges: toNumber(spend.redemptionCharges),
    cardPaid: toNumber(spend.cardPaid),
    voucherPaid: toNumber(spend.voucherPaid),
    purchasedFrom: spend.purchasedFrom || "",
    productName: spend.productName || spend.product || "",
    productValue: toNumber(spend.productValue),
    pointsReceived: toNumber(spend.pointsReceived ?? spend.neucoinsPointsReceived),
    createdAt: spend.createdAt || new Date().toISOString(),
  };
}

function normalizeSwipeCategory(category) {
  return String(category || "").toLowerCase() === "personal" ? "personal" : "business";
}

function normalizeLoungeVisit(visit) {
  const members = toNumber(visit.members);
  const perPerson = toNumber(visit.perPerson);
  const total = toNumber(visit.total || visit.valuePerPerson); // Migration fallback

  return {
    id: visit.id || createId(),
    cardId: visit.cardId || "",
    // Preserve explicit loungeType (including values like "Domestic_Golf" or "International_Restaurant");
    // fall back to "International"/"Domestic" for legacy entries that only used those values.
    loungeType: (typeof visit.loungeType === 'string' && visit.loungeType.trim() !== '')
      ? visit.loungeType
      : (visit.loungeType === "International" ? "International" : "Domestic"),
    airport: visit.airport || "",
    members,
    perPerson,
    date: visit.date || visit.createdAt?.split('T')[0] || "",
    total,
    createdAt: visit.createdAt || new Date().toISOString(),
  };
}

function normalizePreviousAnnualFees(card) {
  const entries = [];

  if (Array.isArray(card.previousAnnualFees)) {
    card.previousAnnualFees.forEach((fee) => {
      entries.push({
        month: normalizeMonth(fee.month || fee.date || fee.previousFeeDate),
        amount: toNumber(fee.amount ?? fee.fee ?? fee.prevYearFee),
      });
    });
  }

  const legacyMonth = normalizeMonth(card.previousFeeDate || card.prevFeeDate || card.memberSince);
  const legacyAmount = toNumber(card.prevYearFee ?? card.prevFee);

  if (legacyMonth && legacyAmount > 0) {
    entries.push({
      month: legacyMonth,
      amount: legacyAmount,
    });
  }

  const byMonth = new Map();
  entries.forEach((fee) => {
    if (fee.month && fee.amount > 0) {
      byMonth.set(fee.month, fee);
    }
  });

  return Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month));
}

function normalizeFutureAnnualFees(card) {
  const entries = [];

  if (Array.isArray(card.futureAnnualFees)) {
    card.futureAnnualFees.forEach((fee) => {
      entries.push({
        month: normalizeMonth(fee.month || fee.date || fee.futureFeeDate),
        amount: toNumber(fee.amount ?? fee.fee ?? fee.futureAnnualFee),
      });
    });
  }

  const legacyMonth = normalizeMonth(card.futureFeeDate || card.upcomingFeeDate);
  const legacyAmount = toNumber(card.futureAnnualFee ?? card.upcomingAnnualFee);

  if (legacyMonth && legacyAmount > 0) {
    entries.push({
      month: legacyMonth,
      amount: legacyAmount,
    });
  }

  const byMonth = new Map();
  entries.forEach((fee) => {
    if (fee.month && fee.amount > 0) {
      byMonth.set(fee.month, fee);
    }
  });

  return Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month));
}

function togglePreviousFeeField() {
  if (els.previousFeeDateContainer) els.previousFeeDateContainer.style.display = "block";
  if (els.prevFeeContainer) els.prevFeeContainer.style.display = "block";
  if (els.previousFeeList) els.previousFeeList.style.display = "block";
  renderPreviousFeeList();
}

function loadSelectedPreviousFee() {
  const selectedMonth = normalizeMonth(els.previousFeeDate?.value);
  const fee = draftPreviousAnnualFees.find((item) => item.month === selectedMonth);

  if (els.prevYearFee) {
    els.prevYearFee.value = fee ? fee.amount : "";
  }

  renderPreviousFeeList();
}

function syncPreviousFeeFromForm() {
  const selectedMonth = normalizeMonth(els.previousFeeDate?.value);
  if (!selectedMonth) {
    renderPreviousFeeList();
    return;
  }

  const amount = toNumber(els.prevYearFee?.value);
  const existingIndex = draftPreviousAnnualFees.findIndex((fee) => fee.month === selectedMonth);

  if (amount > 0) {
    const fee = { month: selectedMonth, amount };
    if (existingIndex >= 0) {
      draftPreviousAnnualFees[existingIndex] = fee;
    } else {
      draftPreviousAnnualFees.push(fee);
    }
  } else if (existingIndex >= 0) {
    draftPreviousAnnualFees.splice(existingIndex, 1);
  }

  draftPreviousAnnualFees.sort((a, b) => a.month.localeCompare(b.month));
  renderPreviousFeeList();
}

function removePreviousFeeDraft(event) {
  const button = event.target.closest("[data-remove-previous-fee]");
  if (!button) return;

  const month = button.dataset.removePreviousFee;
  draftPreviousAnnualFees = draftPreviousAnnualFees.filter((fee) => fee.month !== month);

  if (normalizeMonth(els.previousFeeDate?.value) === month && els.prevYearFee) {
    els.prevYearFee.value = "";
  }

  renderPreviousFeeList();
}

function renderPreviousFeeList() {
  if (!els.previousFeeList) return;

  

  els.previousFeeList.innerHTML = `
    <div style="display:grid; gap:6px;">
      ${draftPreviousAnnualFees.map((fee) => `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 10px; border:1px solid #334155; border-radius:8px; background:#0f172a;">
          <span style="font-size:13px; color:#cbd5e1;">${escapeHtml(formatMonthYear(fee.month))}</span>
          <strong style="font-size:13px; color:#f8fafc;">${escapeHtml(formatMoney(fee.amount))}</strong>
          <button class="icon-button subtle" type="button" data-remove-previous-fee="${escapeAttribute(fee.month)}" title="Remove previous fee" aria-label="Remove previous fee" style="width:32px; min-height:32px;">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14" />
            </svg>
          </button>
        </div>
      `).join("")}
    </div>
  `;
}

function toggleFutureFeeFields(show) {
  if (els.futureFeeDateContainer) {
    els.futureFeeDateContainer.style.display = "block";
  }

  if (els.futureAnnualFeeContainer) {
    els.futureAnnualFeeContainer.style.display = "block";
  }

  if (els.futureFeeList) {
    els.futureFeeList.style.display = "block";
  }

  if (!show) {
    if (els.futureFeeDate) els.futureFeeDate.value = "";
    if (els.futureAnnualFee) els.futureAnnualFee.value = "";
    draftFutureAnnualFees = [];
  }

  renderFutureFeeList();
}

function loadSelectedFutureFee() {
  const selectedMonth = normalizeMonth(els.futureFeeDate?.value);
  const fee = draftFutureAnnualFees.find((item) => item.month === selectedMonth);

  if (els.futureAnnualFee) {
    els.futureAnnualFee.value = fee ? fee.amount : "";
  }

  renderFutureFeeList();
}

function syncFutureFeeFromForm() {
  const selectedMonth = normalizeMonth(els.futureFeeDate?.value);
  if (!selectedMonth) {
    renderFutureFeeList();
    return;
  }

  const amount = toNumber(els.futureAnnualFee?.value);
  const existingIndex = draftFutureAnnualFees.findIndex((fee) => fee.month === selectedMonth);

  if (amount > 0) {
    const fee = { month: selectedMonth, amount };
    if (existingIndex >= 0) {
      draftFutureAnnualFees[existingIndex] = fee;
    } else {
      draftFutureAnnualFees.push(fee);
    }
  } else if (existingIndex >= 0) {
    draftFutureAnnualFees.splice(existingIndex, 1);
  }

  draftFutureAnnualFees.sort((a, b) => a.month.localeCompare(b.month));
  renderFutureFeeList();
}

function removeFutureFeeDraft(event) {
  const button = event.target.closest("[data-remove-future-fee]");
  if (!button) return;

  const month = button.dataset.removeFutureFee;
  draftFutureAnnualFees = draftFutureAnnualFees.filter((fee) => fee.month !== month);

  if (normalizeMonth(els.futureFeeDate?.value) === month && els.futureAnnualFee) {
    els.futureAnnualFee.value = "";
  }

  renderFutureFeeList();
}

function renderFutureFeeList() {
  if (!els.futureFeeList) return;

  

  els.futureFeeList.innerHTML = `
    <div style="display:grid; gap:6px;">
      ${draftFutureAnnualFees.map((fee) => `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 10px; border:1px solid #334155; border-radius:8px; background:#0f172a;">
          <span style="font-size:13px; color:#cbd5e1;">${escapeHtml(formatMonthYear(fee.month))}</span>
          <strong style="font-size:13px; color:#f8fafc;">${escapeHtml(formatMoney(fee.amount))}</strong>
          <button class="icon-button subtle" type="button" data-remove-future-fee="${escapeAttribute(fee.month)}" title="Remove future fee" aria-label="Remove future fee" style="width:32px; min-height:32px;">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14" />
            </svg>
          </button>
        </div>
      `).join("")}
    </div>
  `;
}

function showView(view) {
  const previousView = state.currentView;
  state.currentView = view;
  sessionStorage.setItem("currentView", view);

  // Reset any expanded lists when switching views so UI always starts collapsed
  cardsAllExpanded = false;
  swipesAllExpanded = false;
  rpSpendsAllExpanded = false;
  loungeAllExpanded = false;
  // Remove any leftover load-more UI
  removeLoadMore();
  removeLoadMoreIn(els.swipesTable);
  removeLoadMoreIn(els.rpSpendsTable);
  removeLoadMoreIn(els.loungeTable);

  if (els.dashboardView) els.dashboardView.style.display = view === "dashboard" ? "block" : "none";
  if (els.portfolioView) els.portfolioView.style.display = view === "portfolio" ? "block" : "none";
  if (els.swipesView) els.swipesView.style.display = view === "swipes" ? "block" : "none";
  if (els.rpSpendsView) els.rpSpendsView.style.display = view === "rpSpends" ? "block" : "none";
  if (els.loungeView) els.loungeView.style.display = view === "lounge" ? "block" : "none";
  syncActiveViewClasses();
  animateActiveView(view);

  if (view === "portfolio" && previousView !== "portfolio") {
    resetPortfolioFilters();
  }

  if (view === "swipes" && previousView !== "swipes") {
    resetSwipeFilters();
  }

  if (view === "lounge" && previousView !== "lounge") {
    resetLoungeFilters();
  }

  updateAppBackButton();
  updateScrollTopButton();

  window.scrollTo({ top: 0, behavior: shouldReduceMotion() ? "auto" : "smooth" });
}

function initUiEnhancements() {
  document.documentElement.classList.add("ui-revamp-ready");
  document.body?.classList.add("ui-enhanced");

  getViews().forEach((view) => {
    view?.classList.add("app-view");
  });

  document.addEventListener("focusin", handleFieldFocus);
  document.addEventListener("focusout", handleFieldBlur);
  document.addEventListener("input", handleFieldValueChange);
  document.addEventListener("change", handleFieldValueChange);

  refreshAllFieldStates();
  syncActiveViewClasses();

  requestAnimationFrame(() => {
    document.body?.classList.add("ui-hydrated");
    animateActiveView(state.currentView);
  });
}

function getViews() {
  return [els.dashboardView, els.portfolioView, els.swipesView, els.rpSpendsView, els.loungeView].filter(Boolean);
}

function syncActiveViewClasses() {
  const viewMap = {
    dashboard: els.dashboardView,
    portfolio: els.portfolioView,
    swipes: els.swipesView,
    rpSpends: els.rpSpendsView,
    lounge: els.loungeView,
  };

  if (document.body) {
    document.body.dataset.view = state.currentView;
  }

  Object.entries(viewMap).forEach(([name, view]) => {
    view?.classList.toggle("is-active-view", name === state.currentView);
  });
}

function animateActiveView(view) {
  if (shouldReduceMotion()) return;

  const viewEl = {
    dashboard: els.dashboardView,
    portfolio: els.portfolioView,
    swipes: els.swipesView,
    rpSpends: els.rpSpendsView,
    lounge: els.loungeView,
  }[view];

  if (!viewEl) return;

  viewEl.classList.remove("view-enter");
  void viewEl.offsetWidth;
  viewEl.classList.add("view-enter");

  window.setTimeout(() => {
    viewEl.classList.remove("view-enter");
  }, 520);
}

function handleFieldFocus(event) {
  event.target.closest?.(".field")?.classList.add("is-focused");
}

function handleFieldBlur(event) {
  event.target.closest?.(".field")?.classList.remove("is-focused");
  refreshFieldState(event.target);
}

function handleFieldValueChange(event) {
  refreshFieldState(event.target);
}

function refreshAllFieldStates() {
  document.querySelectorAll(".field input, .field select, .field textarea").forEach(refreshFieldState);
}

function refreshFieldState(control) {
  if (!control?.matches?.("input, select, textarea")) return;

  const field = control.closest(".field");
  if (!field) return;

  const hasValue = control.type === "checkbox" || control.type === "radio"
    ? control.checked
    : String(control.value || "").trim() !== "";

  field.classList.toggle("has-value", hasValue);
}

function shouldReduceMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

function updateAppBackButton() {
  const button = document.getElementById("lockBtn");
  if (!button) return;

  button.textContent = "Logout";
  button.title = "Logout";
  button.setAttribute("aria-label", button.title);
  button.style.display = "flex";
}

function scrollToPageTop() {
  window.scrollTo({ top: 0, behavior: shouldReduceMotion() ? "auto" : "smooth" });
}

function updateScrollTopButton() {
  if (!els.scrollTopBtn) return;

  const isWidgetView = state.currentView !== "dashboard";
  const isScrolled = window.scrollY > 120;
  els.scrollTopBtn.classList.toggle("is-visible", isWidgetView && isScrolled);
}

function renderDashboard() {
  const totals = getTotals(state.cards);
  const swipeTotal = getSwipeTotal();
  const swipeCategoryTotals = getSwipeCategoryTotals();
  const rpPointsUsedTotal = getRpPointsUsedTotal();
  const rpSpendTotal = getRpSpendTotal();
  const rpPointsReceivedTotal = getRpPointsReceivedTotal();
  const loungeTotal = getLoungeVisitTotal();

  if (els.dashboardNetValue) {
    els.dashboardNetValue.textContent = formatMoney(totals.net);
    els.dashboardNetValue.style.color = totals.net > 0 ? "#10b981" : totals.net < 0 ? "#ef4444" : "#f8fafc";
  }

  if (els.dashboardNetHint) {
    els.dashboardNetHint.textContent = `${state.cards.length} ${state.cards.length === 1 ? "card" : "cards"} in portfolio`;
  }

  if (els.dashboardSwipeValue) {
    els.dashboardSwipeValue.innerHTML = `
      <div class="dashboard-swipe-breakdown" aria-label="Business and personal swipe spends">
        <div class="dashboard-swipe-item business" title="${escapeAttribute(`Business spends: ${formatMoney(swipeCategoryTotals.business)}`)}">
          <span>Business</span>
          <strong>${escapeHtml(formatMoney(swipeCategoryTotals.business))}</strong>
        </div>
        <div class="dashboard-swipe-item personal" title="${escapeAttribute(`Personal spends: ${formatMoney(swipeCategoryTotals.personal)}`)}">
          <span>Personal</span>
          <strong>${escapeHtml(formatMoney(swipeCategoryTotals.personal))}</strong>
        </div>
      </div>
    `;
  }

  if (els.dashboardSwipeHint) {
    els.dashboardSwipeHint.textContent = `${formatMoney(swipeTotal)} total | ${state.swipes.length} ${state.swipes.length === 1 ? "entry" : "entries"}`;
  }

  if (els.dashboardLoungeValue) {
    els.dashboardLoungeValue.textContent = formatMoney(loungeTotal);
  }

  if (els.dashboardLoungeHint) {
    els.dashboardLoungeHint.textContent = `${state.loungeVisits.length} ${state.loungeVisits.length === 1 ? "visit" : "visits"} logged`;
  }

  if (els.dashboardRpValue) {
    els.dashboardRpValue.textContent = formatPoints(rpPointsUsedTotal);
  }

  if (els.dashboardRpHint) {
    els.dashboardRpHint.textContent = `${state.rpSpends.length} ${state.rpSpends.length === 1 ? "entry" : "entries"} | ${formatPoints(rpPointsUsedTotal)} used`;
  }
}

function renderCardDropdowns() {
  renderCardSelect(els.swipeCardSelect);
  renderCardSelect(els.rpCardSelect);
  renderCardSelect(els.spentCardSelect);
  renderCardSelect(els.loungeCardSelect);
  updateSwipeCardFilter();
}

function renderCardSelect(select) {

  if (!select) return;

  const currentValue = select.value;
  const isRpCardSelect = select === els.rpCardSelect;
  const voucherPlatforms = [
    { value: "CRED", label: "CRED" },
    { value: "Shopwise", label: "Shopwise" },
    { value: "Maximize", label: "Maximize" },
    { value: "Neucoins", label: "Tata Neucoins" },
    { value: "Tata Neu Voucher", label: "Tata Neu Gift Voucher" },
    { value: "Axis Rewards", label: "Axis Rewards" },
  ];

  if (!state.cards.length && !isRpCardSelect) {
    select.innerHTML =
      `<option value="">Add cards in portfolio first</option>`;
    select.disabled = true;
    return;
  }

  select.disabled = false;

  const options = [];

  if (isRpCardSelect) {
    options.push(`<option value="">Select card or platform</option>`);
    options.push(
      ...voucherPlatforms.map(
        (platform) => `
      <option value="${escapeAttribute(platform.value)}">
        ${escapeHtml(platform.label)}
      </option>`
      )
    );
  } else {
    options.push(`<option value="">Select card</option>`);
  }

  if (state.cards.length) {
    options.push(
      ...state.cards
        .slice()
        .sort((a, b) => formatCardName(a).localeCompare(formatCardName(b)))
        .map(
          (card) => `
      <option value="${escapeAttribute(card.id)}">
        ${escapeHtml(formatCardName(card))}
      </option>`
        )
    );
  }

  select.innerHTML = options.join("");

  const validCard = state.cards.some((card) => card.id === currentValue);
  const validPlatform = isRpCardSelect && voucherPlatforms.some((platform) => platform.value === currentValue);

  if (currentValue && (validCard || validPlatform)) {
    select.value = currentValue;
  } else {
    select.selectedIndex = 0;
  }
}
async function addSwipeFromForm() {
  const cardSelect = els.swipeCardSelect;
  const amountInput = els.swipeAmount;
  const typeSelect = els.swipeTypeSelect;
  const fySelect = els.swipeFySelect;
  const cardId = cardSelect?.value || "";

  if (!cardId) {
    showToast("Select a card first.");
    return;
  }

  const amount = toNumber(amountInput?.value);

  if (amount <= 0) {
    showToast("Enter valid amount.");
    return;
  }

  const editingId = els.editingSwipeId?.value || "";
  const existingIndex = editingId
    ? state.swipes.findIndex((item) => item.id === editingId)
    : -1;
  const category = normalizeSwipeCategory(els.swipeCategorySelect?.value);

  const swipe = {
    id: editingId || createId(),
    cardId,
    amount,
    type: typeSelect?.value === "E" ? "E" : "F",
    financialYear: normalizeFinancialYear(fySelect?.value),
    category,
    spentFor: els.swipeSpentFor?.value.trim() || "",
    createdAt: existingIndex >= 0
      ? state.swipes[existingIndex].createdAt
      : new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    state.swipes[existingIndex] = swipe;
  } else {
    state.swipes.push(swipe);
  }

  await saveState();
  render();
  resetSwipeForm();

  showToast(`${category === "personal" ? "Personal" : "Business"} swipe ${editingId ? "updated" : "added"}.`);
}
function resetSwipeForm() {

  if (els.swipeAmount) {
    els.swipeAmount.value = "";
  }

  if (els.swipeSpentFor) {
    els.swipeSpentFor.value = "";
  }

  if (els.editingSwipeId) {
    els.editingSwipeId.value = "";
  }

  if (els.addSwipeBtn) {
    els.addSwipeBtn.textContent = "Add Swipe";
  }

  if (els.swipeCardSelect) {
    els.swipeCardSelect.selectedIndex = 0;
  }

  if (els.swipeCategorySelect) {
    els.swipeCategorySelect.value = "business";
  }

  if (els.swipeTypeSelect) {
    els.swipeTypeSelect.selectedIndex = 0;
  }

  if (els.swipeFySelect) {
    els.swipeFySelect.selectedIndex = 0;
  }

  if (els.editingSwipeId) {
    els.editingSwipeId.value = "";
}

  if (els.clearSwipeBtn && els.clearSwipeBtn.id !== "cancelSwipeBtn") {
    els.clearSwipeBtn.style.display = "none";
  }
}

function resetPortfolioFilters() {
  state.search = "";
  state.statusFilter = "all";
  state.sort = "netAsc";

  if (els.searchInput) els.searchInput.value = "";
  if (els.statusFilter) els.statusFilter.value = "all";
  if (els.sortSelect) els.sortSelect.value = "netAsc";

  updateSortColor();
  renderCards();
}

function resetSwipeFilters() {
  if (els.swipeFyFilter) els.swipeFyFilter.value = "all";
  if (els.swipeCategoryFilter) els.swipeCategoryFilter.value = "all";
  if (els.swipeTypeFilter) els.swipeTypeFilter.value = "all";
  if (els.swipeSortFilter) els.swipeSortFilter.value = "newest";
  if (els.swipeCardFilter) els.swipeCardFilter.value = "all";
  state.swipeSearch = "";
  if (els.swipeSearchInput) els.swipeSearchInput.value = "";
  renderSwipes();
}

function resetLoungeFilters() {
  if (els.loungeCardFilter) els.loungeCardFilter.value = "all";
  if (els.loungeTypeFilter) els.loungeTypeFilter.value = "all";
  renderLoungeVisits();
}

function handleSwipeAction(event) {
  const button = event.target.closest("[data-swipe-action]");
  if (!button) return;

  const swipe = state.swipes.find((s) => s.id === button.dataset.id);
  if (!swipe) return;

  if (button.dataset.swipeAction === "edit") {
    populateSwipeForm(swipe);
    return;
  }

  if (button.dataset.swipeAction === "delete") {
    state.swipes = state.swipes.filter((swipe) => swipe.id !== button.dataset.id);
    saveState();
    render();
    showToast("Swipe deleted.");
  }
}

function populateSwipeForm(swipe) {

  const cardSelect = els.swipeCardSelect;

  const amountInput = els.swipeAmount;

  const typeSelect = els.swipeTypeSelect;

  const fySelect = els.swipeFySelect;

  // Store editing ID
  if (els.editingSwipeId) {

    els.editingSwipeId.value =
      swipe.id || "";

    // VERY IMPORTANT
    // preserve category during update

    els.editingSwipeId.dataset.category =
      normalizeSwipeCategory(swipe.category);
  }

  if (els.swipeCategorySelect) {
    els.swipeCategorySelect.value = normalizeSwipeCategory(swipe.category);
  }

  // Card
  if (cardSelect) {
    cardSelect.value =
      swipe.cardId || "";
  }

  // Amount
  if (amountInput) {
    amountInput.value =
      swipe.amount || "";
  }

  // Type
  if (typeSelect) {
    typeSelect.value =
      swipe.type || "F";
  }

  // Financial year
  if (fySelect) {
    fySelect.value =
      swipe.financialYear || "";
  }

  // Spent-for note
  if (els.swipeSpentFor) {

    els.swipeSpentFor.value =
      swipe.spentFor || "";
  }

  // Button label
  if (els.addSwipeBtn) {
    els.addSwipeBtn.textContent =
      "Update Swipe";
  }
}

function renderSwipes() {
  if (!els.swipesTable) return;

  renderSwipeProgress();
  els.swipesTable.innerHTML = "";

  if (state.swipes.length > 0) {
    const head = document.createElement("div");
    head.className = "table-head";
    head.innerHTML = `
      <span>Swipe Details</span>
      <span>Amount</span>
      <span>Swipe Type</span>
      <span>Type</span>
      <span></span>
    `;
    els.swipesTable.appendChild(head);
  }

  if (!state.swipes.length) {
    if (els.swipeFilteredTotal) els.swipeFilteredTotal.textContent = "Total: " + formatMoney(0);
    els.swipesTable.appendChild(createEmptyState("No swipes logged", "Add big spends from cards in your portfolio."));
    return;
  }

  const selectedFy = els.swipeFyFilter?.value || "all";
  const selectedCategory = els.swipeCategoryFilter?.value || "all";
  const selectedType = els.swipeTypeFilter?.value || "all";
  const selectedSort = els.swipeSortFilter?.value || "newest";
  const selectedCard = els.swipeCardFilter?.value || "all";
  const searchQuery = state.swipeSearch?.trim().toLowerCase() || "";

  const visibleSwipes = state.swipes.filter((swipe) => {
    const matchesFy = selectedFy === "all" || swipe.financialYear === selectedFy;
    const matchesCategory = selectedCategory === "all" || normalizeSwipeCategory(swipe.category) === selectedCategory;
    const matchesType = selectedType === "all" || swipe.type === selectedType;
    const matchesCard = selectedCard === "all" || swipe.cardId === selectedCard;

    const card = getCardById(swipe.cardId) || {};
    const swipeText = [
      card.name,
      card.issuer,
      swipe.spentFor,
      swipe.financialYear,
      swipe.category,
      swipe.type === "E" ? "emi" : "full swipe",
      swipe.amount ? formatMoney(swipe.amount) : "",
    ].join(" ").toLowerCase();
    // Match text fields
    let matchesSearch = !searchQuery || swipeText.includes(searchQuery);

    // If search contains digits, also try matching against the raw numeric amount (e.g. "500" or "1500.50")
    if (!matchesSearch && searchQuery) {
      const numericQuery = searchQuery.replace(/[^0-9.\-]/g, "");
      if (numericQuery) {
        const amtStr = String(toNumber(swipe.amount));
        if (amtStr.includes(numericQuery)) {
          matchesSearch = true;
        }
      }
    }
    return matchesFy && matchesCategory && matchesType && matchesCard && matchesSearch;
  });

  // Sort logic
  const sortedSwipes = [...visibleSwipes].sort((a, b) => {
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    return selectedSort === "newest" ? dateB - dateA : dateA - dateB;
  });

  const visibleTotal = sortedSwipes.reduce((sum, swipe) => sum + toNumber(swipe.amount), 0);

  if (els.swipeFilteredTotal) {
    els.swipeFilteredTotal.textContent = `${selectedFy === "all" ? "All FY" : selectedFy} Total: ${formatMoney(visibleTotal)}`;
  }

  if (!visibleSwipes.length) {
    const label = selectedCategory === "all" ? "" : `${selectedCategory} `;
    els.swipesTable.appendChild(createEmptyState(`No ${label}swipes match these filters`, "Change the filters or add a swipe for this category."));
    return;
  }

  const shouldShowAllSwipes = Boolean(state.swipeSearch && state.swipeSearch.trim() !== "");
  const totalSwipes = sortedSwipes.length;
  const visibleCountSwipes = shouldShowAllSwipes ? totalSwipes : (swipesAllExpanded ? totalSwipes : INITIAL_VISIBLE_CARDS);
  const renderSwipeRow = (swipe) => {
    const title = normalizeSwipeCategory(swipe.category) === "personal" ? "Personal" : "Business";
    return `
      <article class="card-row">
        <div class="card-name">
          <strong>${escapeHtml(formatCardName(getCardById(swipe.cardId)))}</strong>
          <span class="card-meta" style="display: block; margin-top: 2px;">${escapeHtml(swipe.financialYear)} | ${title}${swipe.spentFor ? ` | ${escapeHtml(swipe.spentFor)}` : ""}</span>
        </div>
        <div class="money-cell">
          <span class="cell-label">Amount</span>
          <strong>${escapeHtml(formatMoney(swipe.amount))}</strong>
        </div>
        <span class="card-meta" style="font-size: 12px; color: #cbd5e1;">${swipe.type === 'E' ? 'EMI' : 'Full Swipe'}</span>
        <span class="status-pill ${title === 'Personal' ? 'profit' : 'loss'}">${title}</span>
        <div class="row-actions">
          <button class="icon-button subtle" type="button" data-swipe-action="edit" data-id="${escapeAttribute(swipe.id)}" title="Edit swipe" aria-label="Edit swipe">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
          <button class="icon-button subtle" type="button" data-swipe-action="delete" data-id="${escapeAttribute(swipe.id)}" title="Delete swipe" aria-label="Delete swipe">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" />
            </svg>
          </button>
        </div>
      </article>
    `;
  };
  const rowsToRender = sortedSwipes.slice(0, visibleCountSwipes);
  els.swipesTable.innerHTML = rowsToRender.map(renderSwipeRow).join("");

  if (!shouldShowAllSwipes && !swipesAllExpanded && totalSwipes > visibleCountSwipes) {
    renderLoadMoreIn(els.swipesTable, totalSwipes - visibleCountSwipes, () => {
      swipesAllExpanded = true;
      renderSwipes();
    });
  } else {
    removeLoadMoreIn(els.swipesTable);
  }
}

function renderSwipeProgress() {
  if (!els.swipeProgressPlaceholder) return;

  const totals = getSwipeCategoryTotals();
  const total = totals.business + totals.personal;

  if (total <= 0) {
    els.swipeProgressPlaceholder.innerHTML = `
      <div class="swipe-progress-summary is-empty" title="${escapeAttribute(`Total spends: ${formatMoney(0)}`)}" data-tooltip="${escapeAttribute(`Total spends: ${formatMoney(0)}`)}">
        <div class="swipe-progress-legend">
          <span><i class="business"></i>Business</span>
          <span><i class="personal"></i>Personal</span>
        </div>
        <div class="swipe-progress-track is-empty">
          <span>No swipes yet</span>
        </div>
      </div>
    `;
    return;
  }

  const businessPercent = (totals.business / total) * 100;
  const personalPercent = (totals.personal / total) * 100;
  const businessLabel = `${Math.round(businessPercent)}%`;
  const personalLabel = `${Math.round(personalPercent)}%`;

  els.swipeProgressPlaceholder.innerHTML = `
    <div class="swipe-progress-summary" title="${escapeAttribute(`Total spends: ${formatMoney(total)}`)}" data-tooltip="${escapeAttribute(`Total spends: ${formatMoney(total)}`)}">
      <div class="swipe-progress-legend">
        <span><i class="business"></i>Business</span>
        <span><i class="personal"></i>Personal</span>
      </div>
      <div class="swipe-progress-track">
        <div class="swipe-progress-segment business" style="width:${businessPercent.toFixed(2)}%;" title="${escapeAttribute(`Business spends: ${formatMoney(totals.business)}`)}">
          ${businessPercent >= 12 ? `<span>${escapeHtml(businessLabel)}</span>` : ""}
        </div>
        <div class="swipe-progress-segment personal" style="width:${personalPercent.toFixed(2)}%;" title="${escapeAttribute(`Personal spends: ${formatMoney(totals.personal)}`)}">
          ${personalPercent >= 12 ? `<span>${escapeHtml(personalLabel)}</span>` : ""}
        </div>
      </div>
    </div>
  `;
}

function updateSwipeCardFilter() {
  if (!els.swipeCardFilter) return;
  const currentSelection = els.swipeCardFilter.value;
  
  els.swipeCardFilter.innerHTML = '<option value="all">All Cards</option>';
  
  state.cards.slice().sort((a, b) => formatCardName(a).localeCompare(formatCardName(b))).forEach(card => {
    const option = document.createElement('option');
    option.value = card.id;
    option.textContent = formatCardName(card);
    els.swipeCardFilter.appendChild(option);
  });
  
  if ([...els.swipeCardFilter.options].some(opt => opt.value === currentSelection)) {
    els.swipeCardFilter.value = currentSelection;
  }
}

function getCurrentRpPaidValue() {
  return getRpSpendPaidValue({
    pointsValue: els.rpPointsValue?.value,
    redemptionCharges: els.rpRedemptionCharges?.value,
    cardPaid: els.rpCardPaid?.value,
    voucherPaid: els.rpVoucherPaid?.value,
  });
}

function updateRpPaidValue() {
  if (!els.rpPaidValue) return;
  els.rpPaidValue.value = formatMoney(getCurrentRpPaidValue());
}

async function saveRpSpendFromForm(event) {
  event?.preventDefault();

  const cardId = els.rpCardSelect?.value || "";
  if (!cardId) {
    showToast("Select a card first.");
    return;
  }

  const productName = els.rpProductName?.value.trim() || "";
  if (!productName) {
    showToast("Enter product name.");
    els.rpProductName?.focus();
    return;
  }

  const editingId = els.editingRpSpendId?.value || "";
  const existingIndex = editingId
    ? state.rpSpends.findIndex((item) => item.id === editingId)
    : -1;
  const purchaseId = existingIndex >= 0
    ? state.rpSpends[existingIndex].purchaseId || state.rpSpends[existingIndex].id
    : els.editingRpPurchaseId?.value || createId();

  const rpSpend = normalizeRpSpend({
    id: editingId || createId(),
    purchaseId,
    cardId,
    points: els.rpPoints?.value,
    pointsValue: els.rpPointsValue?.value,
    redemptionCharges: els.rpRedemptionCharges?.value,
    cardPaid: els.rpCardPaid?.value,
    voucherPaid: els.rpVoucherPaid?.value,
    purchasedFrom: els.rpPurchasedFrom?.value.trim() || "",
    productName,
    productValue: els.rpProductValue?.value,
    pointsReceived: els.rpPointsReceived?.value,
    createdAt: existingIndex >= 0
      ? state.rpSpends[existingIndex].createdAt
      : new Date().toISOString(),
  });

  const hasAnyValue = [
    rpSpend.points,
    rpSpend.pointsValue,
    rpSpend.redemptionCharges,
    rpSpend.cardPaid,
    rpSpend.voucherPaid,
    rpSpend.productValue,
    rpSpend.pointsReceived,
  ].some((value) => toNumber(value) > 0);

  if (!hasAnyValue) {
    showToast("Enter points, value, card amount, voucher amount, or product value.");
    return;
  }

  if (existingIndex >= 0) {
    // Determine previous product-level points for this purchase (before overwrite)
    const purchaseId = state.rpSpends[existingIndex].purchaseId || state.rpSpends[existingIndex].id;
    const priorRep = state.rpSpends.find((row) => (row.purchaseId || row.id) === purchaseId && toNumber(row.pointsReceived) > 0);
    const priorPoints = priorRep ? toNumber(priorRep.pointsReceived) : 0;

    // Update the edited row
    state.rpSpends[existingIndex] = rpSpend;

    // If pointsReceived changed compared to prior group value, propagate it.
    const newPoints = toNumber(rpSpend.pointsReceived);
    const shouldSyncPoints = newPoints !== priorPoints;

    syncRpProductFieldsForPurchase(rpSpend, shouldSyncPoints);
  } else {
    state.rpSpends.push(rpSpend);
  }

  await saveState();
  render();

  if (editingId) {
    resetRpSpendForm();
    showToast("RP spend updated.");
    return;
  }

  const addAnotherRow = await showRpSpendConfirmModal();

  if (addAnotherRow) {
    prepareNextRpPaymentRow(rpSpend);
    showToast("Add the next RP payment row.");
  } else {
    resetRpSpendForm();
    showToast("RP spend saved.");
  }
}

function resetRpSpendForm() {
  if (els.editingRpSpendId) els.editingRpSpendId.value = "";
  if (els.editingRpPurchaseId) els.editingRpPurchaseId.value = "";
  clearRpPaymentFields();
  [
    els.rpPurchasedFrom,
    els.rpProductName,
    els.rpProductValue,
    els.rpPointsReceived,
  ].forEach((input) => {
    if (input) input.value = "";
  });

  if (els.saveRpSpendBtn) els.saveRpSpendBtn.textContent = "Add RP Spend";
  updateRpPaidValue();
  refreshAllFieldStates();
}

let rpSpendConfirmResolver = null;

function showRpSpendConfirmModal() {
  if (!els.rpConfirmModal) {
    return Promise.resolve(
      confirm(
        "Payment row saved. Add another voucher, points, or card payment row for this same product?\n\nOK = Add another row\nCancel = Finish and clear form"
      )
    );
  }

  els.rpConfirmModal.style.display = "flex";
  els.rpConfirmModal.focus?.();

  return new Promise((resolve) => {
    rpSpendConfirmResolver = resolve;
  });
}

function handleRpSpendConfirm(addAnother) {
  if (!els.rpConfirmModal) return;

  els.rpConfirmModal.style.display = "none";

  if (typeof rpSpendConfirmResolver === "function") {
    rpSpendConfirmResolver(addAnother);
    rpSpendConfirmResolver = null;
  }
}

function clearRpPaymentFields() {
  [
    els.rpPoints,
    els.rpPointsValue,
    els.rpRedemptionCharges,
    els.rpCardPaid,
    els.rpVoucherPaid,
  ].forEach((input) => {
    if (input) input.value = "";
  });

  if (els.rpCardSelect) els.rpCardSelect.selectedIndex = 0;
  updateRpPaidValue();
  refreshAllFieldStates();
}

function prepareNextRpPaymentRow(previousRow) {
  if (els.editingRpSpendId) els.editingRpSpendId.value = "";
  if (els.editingRpPurchaseId) els.editingRpPurchaseId.value = previousRow.purchaseId || previousRow.id || "";
  if (els.rpPurchasedFrom) els.rpPurchasedFrom.value = previousRow.purchasedFrom || "";
  if (els.rpProductName) els.rpProductName.value = previousRow.productName || "";
  if (els.rpProductValue) els.rpProductValue.value = previousRow.productValue || "";
  // Do not pre-fill points received for subsequent payment rows to avoid
  // duplicating the same product-level points across multiple rows.
  if (els.rpPointsReceived) els.rpPointsReceived.value = "";
  if (els.saveRpSpendBtn) els.saveRpSpendBtn.textContent = "Add Payment Row";
  clearRpPaymentFields();
  els.rpCardSelect?.focus();
}

function syncRpProductFieldsForPurchase(sourceRow, syncPoints = false) {
  const purchaseId = sourceRow.purchaseId || sourceRow.id;
  state.rpSpends = state.rpSpends.map((row) => {
    if ((row.purchaseId || row.id) !== purchaseId || row.id === sourceRow.id) return row;

    const updated = {
      ...row,
      purchasedFrom: sourceRow.purchasedFrom,
      productName: sourceRow.productName,
      productValue: sourceRow.productValue,
    };

    if (syncPoints) {
      // Propagate the pointsReceived change to all rows for the same purchase
      updated.pointsReceived = sourceRow.pointsReceived;
    }

    return updated;
  });
}

function handleRpSpendAction(event) {
  const button = event.target.closest("[data-rp-spend-action]");
  if (!button) return;

  const action = button.dataset.rpSpendAction;

  // Item-level actions (edit/delete) use data-id
  if (action === "edit" || action === "delete") {
    const rpSpend = state.rpSpends.find((item) => item.id === button.dataset.id);
    if (!rpSpend) return;

    if (action === "edit") {
      populateRpSpendForm(rpSpend);
      window.scrollTo({ top: 0, behavior: shouldReduceMotion() ? "auto" : "smooth" });
      return;
    }

    if (action === "delete") {
      state.rpSpends = state.rpSpends.filter((item) => item.id !== rpSpend.id);
      saveState();
      render();
      showToast("RP spend deleted.");
      return;
    }
  }

  // Group-level actions use data-purchase-id
  if (action === "add-to-group") {
    const pid = button.dataset.purchaseId;
    if (!pid) return;
    const rep = state.rpSpends.find((row) => (row.purchaseId || row.id) === pid);
    if (!rep) return;
    // Prepare the form to add another payment row for this product
    prepareNextRpPaymentRow(rep);
    // Ensure the purchaseId is set so the new row attaches to the group
    if (els.editingRpPurchaseId) els.editingRpPurchaseId.value = pid;
    if (els.saveRpSpendBtn) els.saveRpSpendBtn.textContent = "Add Payment Row";
    window.scrollTo({ top: 0, behavior: shouldReduceMotion() ? "auto" : "smooth" });
    return;
  }

  if (action === "delete-group") {
    const pid = button.dataset.purchaseId;
    if (!pid) return;
    state.rpSpends = state.rpSpends.filter((item) => (item.purchaseId || item.id) !== pid);
    saveState();
    render();
    showToast("Product and its payment rows deleted.");
    return;
  }
}

function populateRpSpendForm(rpSpend) {
  if (els.editingRpSpendId) els.editingRpSpendId.value = rpSpend.id || "";
  if (els.rpCardSelect) els.rpCardSelect.value = rpSpend.cardId || "";
  if (els.rpPoints) els.rpPoints.value = rpSpend.points || "";
  if (els.rpPointsValue) els.rpPointsValue.value = rpSpend.pointsValue || "";
  if (els.rpRedemptionCharges) els.rpRedemptionCharges.value = rpSpend.redemptionCharges || "";
  if (els.rpCardPaid) els.rpCardPaid.value = rpSpend.cardPaid || "";
  if (els.rpVoucherPaid) els.rpVoucherPaid.value = rpSpend.voucherPaid || "";
  if (els.rpPurchasedFrom) els.rpPurchasedFrom.value = rpSpend.purchasedFrom || "";
  if (els.rpProductName) els.rpProductName.value = rpSpend.productName || "";
  if (els.rpProductValue) els.rpProductValue.value = rpSpend.productValue || "";
  // If this specific row doesn't have pointsReceived set, try to find the
  // purchase-level value from any row sharing the same purchaseId so editing
  // any row for the product will pre-fill the original Neucoins value.
  if (els.rpPointsReceived) {
    const thisPurchaseId = rpSpend.purchaseId || rpSpend.id;
    const rep = state.rpSpends.find((row) => (row.purchaseId || row.id) === thisPurchaseId && toNumber(row.pointsReceived) > 0);
    els.rpPointsReceived.value = (rpSpend.pointsReceived || (rep && rep.pointsReceived)) || "";
  }
  if (els.saveRpSpendBtn) els.saveRpSpendBtn.textContent = "Update RP Spend";
  updateRpPaidValue();
  refreshAllFieldStates();
}

function renderRpSpends() {
  if (!els.rpSpendsTable) return;

  updateRpPaidValue();
  els.rpSpendsTable.innerHTML = "";

  if (!state.rpSpends.length) {
    els.rpSpendsTable.appendChild(
      createEmptyState("No RP spends logged", "Add reward-point purchases with card, voucher, and points value details.")
    );
    return;
  }

  const head = document.createElement("div");
  head.className = "table-head";
  head.innerHTML = `
    <span>Product Details</span>
    <span>Card / Platform</span>
    <span>Earned Points</span>
    <span>Paid Value</span>
    <span>Points Used</span>
    <span></span>
  `;
  els.rpSpendsTable.appendChild(head);

  // Group spends by purchaseId
  const groups = {};
  state.rpSpends.forEach(spend => {
    const pid = spend.purchaseId || spend.id;
    if (!groups[pid]) {
      groups[pid] = {
        purchaseId: pid,
        items: [],
        latestDate: spend.createdAt,
        productName: spend.productName,
        purchasedFrom: spend.purchasedFrom,
        productValue: spend.productValue,
        pointsReceived: spend.pointsReceived
      };
    }
    groups[pid].items.push(spend);
    if (new Date(spend.createdAt) > new Date(groups[pid].latestDate)) {
      groups[pid].latestDate = spend.createdAt;
    }
  });

  const sortedGroups = Object.values(groups).sort((a, b) => new Date(b.latestDate) - new Date(a.latestDate));
  const totalGroups = sortedGroups.length;
  const visibleCount = rpSpendsAllExpanded ? totalGroups : INITIAL_VISIBLE_CARDS;
  const groupsToRender = sortedGroups.slice(0, visibleCount);

  groupsToRender.forEach((group) => {
    const row = document.createElement("article");
    row.className = "card-row rp-spend-row";
    
    const totalPaidValue = group.items.reduce((sum, item) => sum + getRpSpendPaidValue(item), 0);
    const totalPoints = group.items.reduce((sum, item) => sum + toNumber(item.points), 0);
    // Treat pointsReceived as a product-level value (one value per purchase),
    // do not sum across payment rows to avoid multiplying the same Neucoins.
    const totalEarned = toNumber(group.pointsReceived);

    row.innerHTML = `
      <div class="card-name">
        <strong style="min-width:0;">${escapeHtml(group.productName || "Untitled product")}</strong>
        <span class="card-meta" style="display: block; margin-bottom: 8px;">
          ${escapeHtml(group.purchasedFrom || "N/A")}
        </span>
      </div>
      <div class="money-cell">
        <span class="cell-label">Card / Platform</span>
        <div class="benefit-breakdown" style="margin-top: 4px;">
          ${group.items.map(item => `
            <div class="benefit-line">
              <span class="benefit-line-name">${escapeHtml(formatRpSourceName(item.cardId))}</span>
              <span class="benefit-line-meta">
                ${toNumber(item.points) > 0 ? `${formatPoints(item.points)} (${formatMoney(item.pointsValue)})` : ''}
                ${toNumber(item.cardPaid) > 0 ? ` Card: ${formatMoney(item.cardPaid)}` : ''}
                ${toNumber(item.voucherPaid) > 0 ? `Voucher: ${formatMoney(item.voucherPaid)}` : ''}
              </span>
              <div class="row-actions inline-actions">
                <button class="icon-button subtle" type="button" data-rp-spend-action="edit" data-id="${escapeAttribute(item.id)}"><svg viewBox="0 0 24 24" width="14"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg></button>
                <button class="icon-button subtle" type="button" data-rp-spend-action="delete" data-id="${escapeAttribute(item.id)}"><svg viewBox="0 0 24 24" width="14"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></svg></button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="money-cell">
        <span class="cell-label">Earned Points</span>
        <strong style="color:#10b981">+${formatPoints(totalEarned)}</strong>
      </div>
      <div class="money-cell">
        <span class="cell-label">Consolidated Paid</span>
        <strong>${formatMoney(totalPaidValue)}</strong>
        <span class="card-meta">Value: ${formatMoney(group.productValue)}</span>
      </div>
      <div class="money-cell">
        <span class="cell-label">Total Points</span>
        <strong>${formatPoints(totalPoints)}</strong>
      </div>
      <div class="money-cell rp-spend-actions-cell">
        <span class="cell-label">Actions</span>
        <div class="row-actions" style="justify-content:flex-end;">
          <button class="icon-button subtle" type="button" data-rp-spend-action="add-to-group" data-purchase-id="${escapeAttribute(group.purchaseId)}" title="Add payment to this product"><svg viewBox="0 0 24 24" width="14"><path d="M12 5v14M5 12h14" /></svg></button>
          <button class="icon-button subtle" type="button" data-rp-spend-action="delete-group" data-purchase-id="${escapeAttribute(group.purchaseId)}" title="Delete entire product"><svg viewBox="0 0 24 24" width="14"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></svg></button>
        </div>
      </div>
    `;
    els.rpSpendsTable.appendChild(row);
  });

  if (!rpSpendsAllExpanded && totalGroups > visibleCount) {
    renderLoadMoreIn(els.rpSpendsTable, totalGroups - visibleCount, () => {
      rpSpendsAllExpanded = true;
      renderRpSpends();
    });
  } else {
    removeLoadMoreIn(els.rpSpendsTable);
  }
}

  function updateLoungeCalculatedValue() {
  if (!els.loungeCalculatedValue) return;

  const members = toNumber(els.loungeMembers?.value) || 1;
  const perPerson = toNumber(els.loungeVisitValue?.value);

  const domesticCount = state.loungeVisits.filter(v => v.loungeType === "Domestic").length;
  const intlCount = state.loungeVisits.filter(v => v.loungeType === "International").length;

  const currentFormTotal = members * perPerson;
  const existingLoungeTotalValue = getLoungeVisitTotal();
  const combinedTotal = currentFormTotal + existingLoungeTotalValue;

  els.loungeCalculatedValue.textContent =
    `Domestic: ${domesticCount}   |   International: ${intlCount}   |   Total Benefits: ${formatMoney(combinedTotal)}`;
}


async function saveLoungeVisitFromForm(event) {

  event.preventDefault();

  const members =
    toNumber(els.loungeMembers?.value) || 1;

  const perPerson =
    toNumber(els.loungeVisitValue?.value);

  const total = members * perPerson;

  const loungeType = els.loungeTypeSelect?.value || "Domestic";

  const visit = {
    id: els.editingLoungeVisitId?.value || createId(),

    cardId: els.loungeCardSelect?.value || "",

    loungeType: loungeType,

    airport:
      document.getElementById("loungeAirport")?.value.trim() || "",

    members,

    perPerson,

    total,
    createdAt: state.loungeVisits.find(v => v.id === (els.editingLoungeVisitId?.value))?.createdAt || new Date().toISOString(),
    date:
  els.loungeVisitDate?.value
    ? `${els.loungeVisitDate.value}T00:00:00`
    : new Date().toISOString(),
  };

  const existingIndex = state.loungeVisits.findIndex(
    (item) => item.id === visit.id
  );

  if (existingIndex >= 0) {
    state.loungeVisits[existingIndex] = visit;
  } else {
    state.loungeVisits.push(visit);
  }
  
  console.log("Lounge visits after save:", state.loungeVisits);
  
syncLoungeBenefitsFromVisits();
await saveState();
render();
resetLoungeVisitForm();
showToast("Benefit saved");
}

function handleLoungeAction(event) {
  const button = event.target.closest("[data-lounge-action]");
  if (!button) return;

  const visit = state.loungeVisits.find((item) => item.id === button.dataset.id);
  if (!visit) return;

  if (button.dataset.loungeAction === "edit") {
    populateLoungeVisitForm(visit);
    return;
  }

  if (button.dataset.loungeAction === "delete") {
    state.loungeVisits = state.loungeVisits.filter((item) => item.id !== visit.id);
    syncLoungeBenefitsFromVisits();
    saveState();
    render();
    showToast("Benefit Removed.");
  }
}

function populateLoungeVisitForm(visit) {
  if (els.editingLoungeVisitId) els.editingLoungeVisitId.value = visit.id;
  if (els.loungeCardSelect) els.loungeCardSelect.value = visit.cardId;
  if (els.loungeTypeSelect) els.loungeTypeSelect.value = visit.loungeType || "";
  if (els.loungeMembers) els.loungeMembers.value = visit.members || "";
  if (els.loungeAirport) els.loungeAirport.value = visit.airport || "";
  if (els.loungeVisitDate) els.loungeVisitDate.value = visit.date ? visit.date.split('T')[0] : "";
  if (els.loungeVisitValue) {
    els.loungeVisitValue.value = visit.perPerson || "";
  }
  if (els.saveLoungeVisitBtn) els.saveLoungeVisitBtn.textContent = "Update Visit";
  updateLoungeCalculatedValue();
}

function resetLoungeVisitForm() {
  if (els.editingLoungeVisitId) els.editingLoungeVisitId.value = "";
  if (els.loungeMembers) els.loungeMembers.value = "";
  if (els.loungeVisitValue) els.loungeVisitValue.value = "";
  if (els.loungeAirport) els.loungeAirport.value = "";
  if (els.loungeVisitDate) els.loungeVisitDate.value = "";
  if (els.loungeTypeSelect) {
    els.loungeTypeSelect.value = "";
    els.loungeTypeSelect.selectedIndex = 0;
  }
  if (els.loungeCardSelect) {
    els.loungeCardSelect.selectedIndex = 0;
  }
  if (els.saveLoungeVisitBtn) els.saveLoungeVisitBtn.textContent = "Add Visit";
  updateLoungeCalculatedValue();
}

async function saveLoungeBenefitFromForm(event) {
  event.preventDefault();
  
  const cardId = els.loungeCardSelect?.value;
  const type = els.loungeBenefitType?.value || "Lounge Access";
  const label = els.loungeBenefitLabel?.value.trim() || "Lounge Benefit";
  const amount = toNumber(els.loungeBenefitValue?.value);

  if (!cardId) {
    showToast("Select a card first.");
    return;
  }
  if (amount <= 0) {
    showToast("Enter a valid benefit value.");
    return;
  }

  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;

  // Create a manual lounge benefit entry
  const benefit = {
    id: `manual-lounge-${createId()}`,
    type: type,
    valueType: "cash",
    label: label,
    amount: amount
  };

  if (!card.benefits) card.benefits = [];
  card.benefits.push(benefit);

  await saveState();
  render();
  resetLoungeBenefitForm();
  showToast("Lounge benefit added to card.");
}

function resetLoungeBenefitForm() {
  if (els.loungeBenefitLabel) els.loungeBenefitLabel.value = "";
  if (els.loungeBenefitValue) els.loungeBenefitValue.value = "";
  if (els.loungeBenefitType) els.loungeBenefitType.selectedIndex = 0;
}

function syncLoungeBenefitsFromVisits() {
  // Group lounge visit totals by cardId and by benefit category
  const totalsByCard = {};
  state.loungeVisits.forEach((visit) => {
    if (!visit.cardId) return;

    // Determine category key and readable type/label
    const lt = (visit.loungeType || "").toString();
    let key = "airport-lounge";
    let typeLabel = "Airport Lounge";

    if (lt.includes("Golf")) {
      key = "golf";
      typeLabel = "Golf";
    } else if (lt.includes("Restaurant")) {
      key = "restaurant";
      typeLabel = "Airport Restaurant";
    } else if (lt.includes("Spa")) {
      key = "spa";
      typeLabel = "Spa";
    } else if (/meet\s*&\s*greet/i.test(lt) || lt.toLowerCase().includes("meet")) {
      key = "meet-greet";
      typeLabel = "Meet & Greet";
    } else if (lt.toLowerCase().includes("transfer")) {
      key = "airport-transfer";
      typeLabel = "Airport Transfer";
    } else if (lt === "International") {
      key = "airport-lounge";
      typeLabel = "International Lounge";
    }

    totalsByCard[visit.cardId] = totalsByCard[visit.cardId] || {};
    totalsByCard[visit.cardId][key] = (totalsByCard[visit.cardId][key] || 0) + toNumber(visit.total);
    // store label for key so we can reuse it later (first occurrence wins)
    totalsByCard[visit.cardId][`__label__${key}`] = totalsByCard[visit.cardId][`__label__${key}`] || typeLabel;
  });

  state.cards = state.cards.map((card) => {
    let benefits = (card.benefits || []).filter((b) => !String(b.id || "").startsWith("lounge-auto-"));
    const totals = totalsByCard[card.id] || {};

    Object.keys(totals).forEach((k) => {
      if (k.startsWith("__label__")) return;
      const amount = totals[k] || 0;
      if (amount > 0) {
        const label = totals[`__label__${k}`] || "Lounge Visits";
        benefits.push({
          id: `lounge-auto-${card.id}-${k}`,
          type: label,
          valueType: "cash",
          label: `${label} (Auto)`,
          amount: amount,
        });
      }
    });

    return { ...card, benefits };
  });
}

function updateLoungeCardFilter() {
  if (!els.loungeCardFilter) return;
  const currentSelection = els.loungeCardFilter.value;
  
  els.loungeCardFilter.innerHTML = '<option value="all">All Cards</option>';
  
  const cardNames = [...new Set(state.cards.map(card => formatCardName(card)))].sort();
  
  cardNames.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    els.loungeCardFilter.appendChild(option);
  });
  
  if ([...els.loungeCardFilter.options].some(opt => opt.value === currentSelection)) {
    els.loungeCardFilter.value = currentSelection;
  }
}

function renderLoungeVisits() {
  if (!els.loungeTable) return;

  els.loungeTable.innerHTML = "";
  updateLoungeCalculatedValue();
  renderLoungeChart();

  if (state.loungeVisits.length > 0) {
    const head = document.createElement("div");

    head.className = "table-head";

    head.innerHTML = `
      <span>Visit Details</span>
      <span>Members</span>
      <span>Total Value</span>
      <span>Airport / Golf Course</span>
      <span></span>
    `;

    els.loungeTable.appendChild(head);
  }

  if (!state.loungeVisits.length) {
    els.loungeTable.appendChild(
      createEmptyState(
        "No lounge visits logged",
        "Add lounge visits to sync benefits into your portfolio."
      )
    );

    return;
  }

  const filterValue = els.loungeCardFilter?.value || "all";
  const typeFilterValue = els.loungeTypeFilter?.value || "all";

  const visibleVisits = state.loungeVisits
    .slice()
    .filter((visit) => filterValue === "all" || formatCardName(getCardById(visit.cardId)) === filterValue)
    .filter((visit) => typeFilterValue === "all" || visit.loungeType === typeFilterValue)
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  if (!visibleVisits.length) {
    els.loungeTable.appendChild(
      createEmptyState(
        "No visits match these filters",
        "Change the card or type filter to see more visits."
      )
    );
    return;
  }

  const totalVisits = visibleVisits.length;
  const visibleCountLounge = loungeAllExpanded ? totalVisits : INITIAL_VISIBLE_CARDS;
  const visitsToRender = visibleVisits.slice(0, visibleCountLounge);

  visitsToRender.forEach((visit) => {

      const row = document.createElement("article");

      row.className = "card-row";

      row.innerHTML = `

        <div class="card-name">

          <strong>
            ${escapeHtml(formatCardName(getCardById(visit.cardId)))}
          </strong>

          <span class="card-meta">
            ${escapeHtml(visit.loungeType)}
            |
            ${escapeHtml(
              visit.loungeType?.includes("Golf") ? "Golf" :
              visit.loungeType?.includes("Restaurant") ? "Restaurant" :
              visit.loungeType?.includes("Spa") ? "Spa" :
              (/meet\s*&\s*greet/i.test(visit.loungeType || "") || (visit.loungeType || "").toLowerCase().includes("meet")) ? "Meet & Greet" :
              (visit.loungeType || "").toLowerCase().includes("transfer") ? "Airport Transfer" :
              visit.loungeType === "International" ? "International Lounge" : "Airport Lounge"
            )}
            |
            ${escapeHtml(formatDateTime(visit.date))}
          </span>
        </div>

        <div class="money-cell">
          <span class="cell-label">Members</span>

          <strong>
            ${escapeHtml(String(visit.members))}
          </strong>
        </div>

        <div class="money-cell">
          <span class="cell-label">Total</span>

          <strong>
            ${escapeHtml(formatMoney(visit.total || (visit.members * visit.perPerson)))}
          </strong>
        </div>

        <div class="money-cell">
          <span class="cell-label">Airport</span>

          <strong>
            ${escapeHtml(visit.airport || "N/A")}
          </strong>
        </div>

        <div class="row-actions">

          <button
            class="icon-button subtle"
            type="button"
            data-lounge-action="edit"
            data-id="${escapeAttribute(visit.id)}"
            title="Edit lounge visit"
            aria-label="Edit lounge visit"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>

          <button
            class="icon-button subtle"
            type="button"
            data-lounge-action="delete"
            data-id="${escapeAttribute(visit.id)}"
            title="Delete lounge visit"
            aria-label="Delete lounge visit"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" />
            </svg>
          </button>

        </div>
      `;

      els.loungeTable.appendChild(row);
    });

  if (!loungeAllExpanded && totalVisits > visibleCountLounge) {
    renderLoadMoreIn(els.loungeTable, totalVisits - visibleCountLounge, () => {
      loungeAllExpanded = true;
      renderLoungeVisits();
    });
  } else {
    removeLoadMoreIn(els.loungeTable);
  }
}

function renderLoungeChart() {
  const canvas = document.getElementById("loungeChartCanvas");
  if (!canvas) return;

  // Calculate lounge visit totals by card
  const totalsByCard = {};
  const cardIds = new Set();

  state.loungeVisits.forEach((visit) => {
    if (!visit.cardId) return;
    cardIds.add(visit.cardId);
    totalsByCard[visit.cardId] = (totalsByCard[visit.cardId] || 0) + toNumber(visit.total);
  });

  // If no visits, show empty state
  if (Object.keys(totalsByCard).length === 0) {
    if (loungeChartInstance) {
      loungeChartInstance.destroy();
      loungeChartInstance = null;
    }
    return;
  }

  // Prepare chart data
  const labels = Array.from(cardIds).map((cardId) => {
    const card = getCardById(cardId);
    return card ? card.name : "Unknown";
  });

  const data = Array.from(cardIds).map((cardId) => totalsByCard[cardId]);

  // Color palette for pie chart
  const colors = [
    "rgba(34, 197, 94, 0.8)",
    "rgba(59, 130, 246, 0.8)",
    "rgba(249, 115, 22, 0.8)",
    "rgba(239, 68, 68, 0.8)",
    "rgba(168, 85, 247, 0.8)",
    "rgba(236, 72, 153, 0.8)",
    "rgba(6, 182, 212, 0.8)",
    "rgba(202, 138, 4, 0.8)",
  ];

  const backgroundColors = labels.map((_, index) => colors[index % colors.length]);
  const borderColors = backgroundColors.map((color) => color.replace("0.8", "1"));

  const chartData = {
    labels: labels,
    datasets: [
      {
        data: data,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: "#cbd5e1",
          font: {
            size: 12,
            weight: "600",
          },
          padding: 12,
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: "rgba(30, 41, 59, 0.95)",
        titleColor: "#f8fafc",
        bodyColor: "#cbd5e1",
        borderColor: "#475569",
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: function (context) {
            return `${context.label}: ${formatMoney(context.parsed)}`;
          },
        },
      },
    },
  };

  if (loungeChartInstance) {
    loungeChartInstance.data = chartData;
    loungeChartInstance.update();
  } else {
    loungeChartInstance = new Chart(canvas, {
      type: "doughnut",
      data: chartData,
      options: chartOptions,
    });
  }
}

function syncLoungeBenefitsFromVisits() {
  // Update each card's benefits based on lounge visits
  state.cards = state.cards.map((card) => {
    // Filter out existing auto-generated lounge benefits to avoid duplicates
    let benefits = (card.benefits || []).filter((benefit) => {
      return !(benefit.id && String(benefit.id).startsWith("lounge-"));
    });

    // Group visits by type for this card
    const cardVisits = state.loungeVisits.filter(v => v.cardId === card.id);
    
    if (cardVisits.length > 0) {
      const groupedBenefits = {};

      // Group visits by loungeType
      cardVisits.forEach((visit) => {
        const benefitType = visit.loungeType || "Domestic";
        if (!groupedBenefits[benefitType]) {
          groupedBenefits[benefitType] = 0;
        }
        groupedBenefits[benefitType] += toNumber(visit.total);
      });

      // Create benefit for each type
      Object.entries(groupedBenefits).forEach(([benefitType, amount]) => {
        let displayLabel = benefitType;
        let benefitTypeLabel = benefitType;

        // Convert stored values into readable labels
        switch (benefitType) {
          case "Domestic":
            displayLabel = "Domestic Lounge";
            benefitTypeLabel = "Airport Lounge";
            break;
          case "International":
            displayLabel = "International Lounge";
            benefitTypeLabel = "Airport Lounge";
            break;
          case "Domestic_Golf":
            displayLabel = "Domestic Golf";
            benefitTypeLabel = "Golf";
            break;
          case "International_Golf":
            displayLabel = "International Golf";
            benefitTypeLabel = "Golf";
            break;
          case "Domestic_Restaurant":
            displayLabel = "Domestic Restaurant";
            benefitTypeLabel = "Airport Restaurant";
            break;
          case "International_Restaurant":
            displayLabel = "International Restaurant";
            benefitTypeLabel = "Airport Restaurant";
            break;
        }

        benefits.push({
          id: `lounge-${card.id}-${benefitType}`,
          type: benefitTypeLabel,
          valueType: "cash",
          label: displayLabel,
          amount,
        });
      });
    }

    return {
      ...card,
      benefits,
    };
  });
}

function render() {
  // Always sync lounge benefits to ensure all cards have correct lounge benefits
  syncLoungeBenefitsFromVisits();
  renderDashboard();
  renderSummary();
  renderBenefitsEditor();
  renderCards();
  renderCategories();
  renderCardDropdowns();
  renderSwipes();
  renderRpSpends();
  renderLoungeVisits();
  updateLoungeCardFilter();
}

function renderSummary() {
  const totals = getTotals(state.cards);
  const cardCount = state.cards.length;
  const coverage = totals.deficit ? Math.min(100, (totals.surplus / totals.deficit) * 100) : totals.surplus ? 100 : 0;
  const uncovered = Math.max(0, totals.deficit - totals.surplus);
  const surplusAfterRecovery = Math.max(0, totals.surplus - totals.deficit);

  els.feeValue.textContent = formatMoney(totals.fees);
  els.feeHint.textContent = `Total fees for ${cardCount} ${cardCount === 1 ? "card" : "cards"}`;
  els.feeValue.style.cursor = "pointer";
  els.feeValue.title = "Click to view fee breakdown";
  els.pointsValue.textContent = formatPoints(totals.points);
  els.pointsValue.style.cursor = "pointer";
els.pointsValue.title = "Click to view point breakdown";
  els.pointsHint.textContent = `Total unredeemed points across all cards`;
  els.benefitValue.textContent = formatMoney(totals.benefits);
  els.benefitValue.style.cursor = "pointer";
  els.benefitValue.title = "Click to view benefit breakdown";
  els.benefitHint.textContent = `Total value recovered from ${totals.cashBenefitCount} items`;
  els.netValue.style.color = totals.net > 0 ? "#10b981" : totals.net < 0 ? "#ef4444" : "#f8fafc";
  els.netValue.textContent = formatMoney(totals.net);
  els.netHint.textContent = cardCount 
    ? totals.net >= 0
      ? `${formatMoney(surplusAfterRecovery)} net profit after fees`
      : `${formatMoney(Math.abs(totals.net))} short of break-even`
    : "No cards added";
  els.coverageValue.textContent = `${Math.round(coverage)}%`;
  els.coverageHint.textContent = totals.deficit
    ? uncovered
      ? `${formatMoney(uncovered)} loss gap remaining`
      : `${formatMoney(surplusAfterRecovery)} surplus remaining`
    : "No deficits yet";

  els.portfolioCount.textContent = `${cardCount} ${cardCount === 1 ? "card" : "cards"}`;
  els.recoveryBar.style.width = `${coverage}%`;

  if (!cardCount) {
    els.recoveryTitle.textContent = "Portfolio Status";
    els.recoveryText.textContent = "Add cards to see your total fee recovery and point inventory.";
  } else if (!totals.deficit) {
    els.recoveryTitle.textContent = "Fully Recovered";
    els.recoveryText.textContent = `All card fees are covered by redemptions. Total net: ${formatMoney(totals.net)}.`;
  } else if (uncovered === 0) {
    els.recoveryTitle.textContent = "Portfolio Profitable";
    els.recoveryText.textContent = `Profitable cards cover the fees of others. Net: ${formatMoney(totals.net)}.`;
  } else {
    els.recoveryTitle.textContent = "Fee Recovery Gap";
    els.recoveryText.textContent = `${formatMoney(totals.surplus)} surplus covers part of ${formatMoney(totals.deficit)} in losses.`;
  }
}

function showPointsPopup() {
  const pointCards = state.cards.filter((card) => {
    const totals = getCardTotals(card);
    return totals.points > 0;
  });

  if (!pointCards.length) {
    alert("No unredeemed points available.");
    return;
  }

  const popup = document.createElement("div");
  popup.className = "points-popup-overlay";

  popup.innerHTML = `
    <div class="points-popup">
      <div class="points-popup-header">
        <h3>Total Unredeemed Points</h3>
        <button class="close-popup">&times;</button>
      </div>

      <div class="points-popup-body">
        ${pointCards
          .map((card) => {
            const totals = getCardTotals(card);

            return `
              <div class="points-popup-row">
                <div>
                  <strong>${escapeHtml(card.name)}</strong>
                  <div class="points-popup-issuer">
                    ${escapeHtml(card.issuer || "")}
                  </div>
                </div>

                <div class="points-popup-points">
                  ${escapeHtml(formatPoints(totals.points))}
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  popup.querySelector(".close-popup").addEventListener("click", () => {
    popup.remove();
  });

  popup.addEventListener("click", (e) => {
    if (e.target === popup) {
      popup.remove();
    }
  });
}

function showPointsPopup() {
  const modal = document.getElementById("pointsModal");
  const content = document.getElementById("pointsModalContent");

  const pointCards = state.cards.filter((card) => {
    return card.benefits.some(b => isPointBenefit(b));
  }).sort((a, b) => {
    const totalsA = getCardTotals(a);
    const totalsB = getCardTotals(b);
    return totalsB.points - totalsA.points;
  });

  if (!pointCards.length) {
    content.innerHTML = `
      <div style="text-align:center; padding:20px; color:#94a3b8;">
        No unredeemed points available
      </div>
    `;
  } else {
    content.innerHTML = pointCards.map((card) => {
      const totals = getCardTotals(card);

      return `
        <div style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          padding:14px 0;
          border-bottom:1px solid #334155;
        ">
          <div>
            <div style="font-weight:700; color:#f8fafc; font-size:14px; margin-bottom:4px;">
              ${escapeHtml(card.issuer || "Bank")} | ${escapeHtml(card.name)}
            </div>
          </div>

          <div style="
            font-weight:700;
            color:#10b981;
            font-size:16px;
          ">
            ${escapeHtml(formatPoints(totals.points))}
          </div>
        </div>
      `;
    }).join("");
  }

  modal.style.display = "flex";
}

function showFeePopup() {
  const modal = document.getElementById("pointsModal");
  const content = document.getElementById("pointsModalContent");
  const title = modal.querySelector("h3");
  if (title) title.textContent = "Total Fees Breakdown";

  const feeCards = state.cards.filter((card) => {
    const totals = getCardTotals(card);
    return totals.fees > 0;
  }).sort((a, b) => {
    const totalsA = getCardTotals(a);
    const totalsB = getCardTotals(b);
    return totalsB.fees - totalsA.fees;
  });

  if (!feeCards.length) {
    content.innerHTML = `
      <div style="text-align:center; padding:20px; color:#94a3b8;">
        No fees recorded
      </div>
    `;
  } else {
    content.innerHTML = feeCards.map((card) => {
      const totals = getCardTotals(card);
        const currentFee = toNumber(card.annualFee) + toNumber(card.taxFee);
        const otherFees = [...(card.previousAnnualFees || []), ...(card.futureAnnualFees || [])];

        let feeHtml = "";
        if (currentFee > 0) {
          const joiningMonth = card.memberSince ? `Joining Fee - ${formatMonthYear(card.memberSince)}` : "Joining Fee - Joining";
          feeHtml += `<div>${joiningMonth}: ${formatMoney(currentFee)}</div>`;
        }

        for (let i = 0; i < otherFees.length; i += 2) {
          const pair = otherFees.slice(i, i + 2);
          const rowText = pair.map((f) => `${formatMonthYear(f.month)}: ${formatMoney(f.amount)}`).join(" | ");
          feeHtml += `<div>${rowText}</div>`;
        }

      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 0; border-bottom:1px solid #334155;">
          <div style="flex: 1;">
            <div style="font-weight:700; color:#f8fafc; font-size:14px; margin-bottom:4px;">
              ${escapeHtml(card.issuer || "Bank")} | ${escapeHtml(card.name)}
            </div>
            <div style="font-family:inherit; font-size:12px; color:#94a3b8; line-height:1.6;">
              ${feeHtml || "No breakdown available"}
            </div>
          </div>
          <div style="font-weight:700; color:#10b981; font-size:16px; margin-left:15px; white-space:nowrap;">
            ${escapeHtml(formatMoney(totals.fees))}
          </div>
        </div>
      `;
    }).join("");
  }
  content.style.maxHeight = "60vh";
  content.style.overflowY = "auto";
  modal.style.display = "flex";
}

function showCashPopup() {
  const modal = document.getElementById("pointsModal");
  const content = document.getElementById("pointsModalContent");
  const title = modal.querySelector("h3");
  if (title) title.textContent = "Total Value Recovered";

  const cashCards = state.cards.filter((card) => {
    const totals = getCardTotals(card);
    return totals.benefits > 0;
  }).sort((a, b) => {
    const totalsA = getCardTotals(a);
    const totalsB = getCardTotals(b);
    return totalsB.benefits - totalsA.benefits;
  });

  if (!cashCards.length) {
    content.innerHTML = `
      <div style="text-align:center; padding:20px; color:#94a3b8;">
        No monetary benefits recovered
      </div>
    `;
  } else {
    content.innerHTML = cashCards.map((card) => {
      const totals = getCardTotals(card);

      return `
        <div style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          padding:14px 0;
          border-bottom:1px solid #334155;
        ">
          <div>
            <div style="font-weight:700; color:#f8fafc; font-size:14px; margin-bottom:4px;">
              ${escapeHtml(card.issuer || "Bank")} | ${escapeHtml(card.name)}
            </div>
          </div>

          <div style="
            font-weight:700;
            color:#10b981;
            font-size:16px;
          ">
            ${escapeHtml(formatMoney(totals.benefits))}
          </div>
        </div>
      `;
    }).join("");
  }

  modal.style.display = "flex";
}

function renderBenefitsEditor() {
  els.benefitRows.innerHTML = "";

  draftBenefits.forEach((benefit, index) => {
    const row = document.createElement("div");
    row.className = "benefit-row";
    row.dataset.index = String(index);
    row.setAttribute("data-index", index);
    row.innerHTML = `
      <label class="field benefit-type-field">
        <span>Type</span>
        <select data-benefit-field="type">
          ${benefitTypes.map((type) => `<option value="${escapeHtml(type)}"${benefit.type === type ? " selected" : ""}>${escapeHtml(type)}</option>`).join("")}
        </select>
      </label>
      <label class="field">
        <span>Benefit</span>
        <input data-benefit-field="label" type="text" value="${escapeAttribute(benefit.label)}" placeholder="e.g. 5000 Pts / Amazon Voucher" autocomplete="off" />
      </label>
      <label class="field">
        <span>Value type</span>
        <select data-benefit-field="valueType">
          <option value=""${!benefit.valueType ? " selected" : ""}></option>
          ${benefitValueTypes.map((type) => `<option value="${escapeAttribute(type.value)}"${benefit.valueType === type.value ? " selected" : ""}>${escapeHtml(type.label)}</option>`).join("")}
        </select>
      </label>
      <label class="field">
        <span>Value</span>
        <input data-benefit-field="amount" type="number" min="0" step="any" inputmode="decimal" value="${benefit.amount || ""}" placeholder="0.00" />
      </label>
      <button class="icon-button subtle" type="button" data-remove-benefit="${index}" title="Remove benefit" aria-label="Remove benefit">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14" />
        </svg>
      </button>
    `;
    els.benefitRows.appendChild(row);
  });
}

function renderCards() {
  const cards = getFilteredCards();
  els.cardsTable.innerHTML = "";

  // No cards at all
  if (!state.cards.length) {
    els.cardsTable.appendChild(createEmptyState("No cards in portfolio", "Add your first card or load the example portfolio."));
    removeLoadMore();
    return;
  }

  // No matches after filtering/search
  if (!cards.length) {
    els.cardsTable.appendChild(createEmptyState("No matching cards", "Adjust search, status, or sort filters."));
    removeLoadMore();
    return;
  }

  const head = document.createElement("div");
  head.className = "table-head";
  head.innerHTML = `
    <span>Card Details</span>
    <span>Fees</span>
    <span>Value & Points</span>
    <span>Net</span>
    <span>Status</span>
    <span></span>
  `;
  els.cardsTable.appendChild(head);

  // Determine how many cards to render initially.
  // If user has typed a search, show all matching cards so search finds hidden items.
  const shouldShowAll = Boolean(state.search && state.search.trim() !== "");
  const visibleCount = shouldShowAll ? cards.length : (cardsAllExpanded ? cards.length : INITIAL_VISIBLE_CARDS);

  // Render only the visible subset
  cards.slice(0, visibleCount).forEach((card) => {
    const totals = getCardTotals(card);
    const status = getStatus(totals.net);
    const netColor = totals.net > 0 ? "#10b981" : totals.net < 0 ? "#ef4444" : "#f8fafc";
    
    const isBusiness = card.notes && card.notes.toUpperCase() === "E";
    const isPersonal = card.notes && card.notes.toUpperCase() === "F";
    
    const feeBreakdown = formatFeeBreakdown(card);
    const meta = [
      card.issuer,
      card.memberSince && `Member since: ${formatMonthYear(card.memberSince)}`,
      feeBreakdown,
    ]
      .filter(Boolean)
      .join(" | ");
    const row = document.createElement("article");
    row.className = `card-row ${card.isGreyedOut ? "greyed-out" : ""}`;
    if (card.isGreyedOut) row.style.opacity = "0.4";
    row.innerHTML = `
      <div class="card-name">
        <div style="display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;">
          <strong>${escapeHtml(card.name || "Untitled card")}</strong>
          <span class="card-meta" style="margin-top: 0;">${escapeHtml(meta || "Issuer not set")}</span>
          ${isBusiness ? `<span class="status-pill loss" style="font-size: 10px; padding: 1px 6px; margin-left: 4px;">Business</span>` : ''}
          ${isPersonal ? `<span class="status-pill profit" style="font-size: 10px; padding: 1px 6px; margin-left: 4px;">Personal</span>` : ''}
        </div>
        ${formatCardBenefitsHtml(card)}
      </div>
      <div class="money-cell">
        <span class="cell-label">Fees</span>
        <strong>${formatMoney(totals.fees)}</strong>
      </div>
      <div class="money-cell">
        <span class="cell-label">Value/Points</span>
        ${formatBenefitSplitHtml(totals.benefits, totals.points)}
      </div>
      <div class="money-cell">
        <span class="cell-label">Net</span>
        <strong style="color: ${netColor}">${formatMoney(totals.net)}</strong>
      </div>
      <span class="status-pill ${status.key}">${status.label}</span>
      <div class="row-actions">
        <button class="icon-button subtle" type="button" data-action="toggle-grey" data-id="${escapeAttribute(card.id)}" title="Mute/Unmute card" aria-label="Mute card">
          <svg viewBox="0 0 24 24" aria-hidden="true" style="fill: ${card.isGreyedOut ? "#94a3b8" : "none"}; stroke: currentColor;">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/><line x1="1" y1="1" x2="23" y2="23" style="display: ${card.isGreyedOut ? "block" : "none"}"/>
          </svg>
        </button>
        <button class="icon-button subtle" type="button" data-action="edit" data-id="${escapeAttribute(card.id)}" title="Edit card" aria-label="Edit card">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
        <button class="icon-button subtle" type="button" data-action="duplicate" data-id="${escapeAttribute(card.id)}" title="Duplicate card" aria-label="Duplicate card">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 8h10v12H8zM6 16H4V4h12v2" />
          </svg>
        </button>
        <button class="icon-button subtle" type="button" data-action="delete" data-id="${escapeAttribute(card.id)}" title="Delete card" aria-label="Delete card">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" />
          </svg>
        </button>
      </div>
    `;
    els.cardsTable.appendChild(row);
  });

  // If not showing all and there are more cards, render a Load more button
  if (!shouldShowAll && !cardsAllExpanded && cards.length > visibleCount) {
    renderLoadMore(cards.length - visibleCount);
  } else {
    removeLoadMore();
  }
}

function renderLoadMore(remaining) {
  removeLoadMore();
  const container = document.createElement('div');
  container.id = 'loadMoreContainer';
  container.style.cssText = 'display:flex; justify-content:center; padding:12px 0;';
  const btn = document.createElement('button');
  btn.className = 'ghost-button';
  btn.type = 'button';
  btn.textContent = `Load more (${remaining})`;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Loading...';
    // expand and re-render (we already have the full data in `state.cards`)
    cardsAllExpanded = true;
    renderCards();
  });
  container.appendChild(btn);
  els.cardsTable.parentNode?.insertBefore(container, els.cardsTable.nextSibling);
}

function removeLoadMore() {
  const existing = document.getElementById('loadMoreContainer');
  if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
}

// Generic helpers for other tables (swipes, lounge)
function renderLoadMoreIn(containerEl, remaining, onExpand) {
  if (!containerEl) return;
  removeLoadMoreIn(containerEl);
  const container = document.createElement('div');
  container.className = 'load-more-container';
  container.style.cssText = 'display:flex; justify-content:center; padding:12px 0;';
  const btn = document.createElement('button');
  btn.className = 'ghost-button';
  btn.type = 'button';
  btn.textContent = `Load more (${remaining})`;
  btn.addEventListener('click', () => {
    btn.disabled = true;
    btn.textContent = 'Loading...';
    try {
      onExpand && onExpand();
    } finally {
      removeLoadMoreIn(containerEl);
    }
  });
  container.appendChild(btn);
  containerEl.appendChild(container);
}

function removeLoadMoreIn(containerEl) {
  if (!containerEl) return;
  const existing = containerEl.querySelector('.load-more-container');
  if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
}

function enforceVisibleLimitIn(containerEl, visibleCount, expanded) {
  if (!containerEl) return;
  const rows = Array.from(containerEl.querySelectorAll('.card-row'));
  rows.forEach((row, idx) => {
    if (expanded) {
      row.style.display = '';
    } else {
      row.style.display = idx < visibleCount ? '' : 'none';
    }
  });
}

function renderCategories() {
  const totalsByCategory = new Map(benefitTypes.map((type) => [type, { cash: 0, points: 0 }]));
  state.cards.forEach((card) => {
    card.benefits.forEach((benefit) => {
      const current = totalsByCategory.get(benefit.type) || { cash: 0, points: 0 };
      if (isPointBenefit(benefit)) {
        current.points += toNumber(benefit.amount);
      } else {
        current.cash += toNumber(benefit.amount);
      }
      totalsByCategory.set(benefit.type, current);
    });
  });

  const rows = Array.from(totalsByCategory.entries())
    .filter(([, total]) => total.cash > 0 || total.points > 0)
    .sort((a, b) => b[1].cash - a[1].cash || b[1].points - a[1].points);
  const grandCashTotal = rows.reduce((sum, [, total]) => sum + total.cash, 0);
  const grandPointsTotal = rows.reduce((sum, [, total]) => sum + total.points, 0);
  els.categoryTotal.textContent = formatMixedValue(grandCashTotal, grandPointsTotal);
  els.categoryBars.innerHTML = "";

  if (!rows.length) {
    els.categoryBars.appendChild(createEmptyState("No benefit value yet", "Benefit categories appear after saving card benefits."));
    return;
  }

  const colors = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];
  let currentPercent = 0;
  const linearParts = [];

  const chartContainer = document.createElement("div");
  chartContainer.className = "benefits-chart-container";
  chartContainer.style.display = "flex";
  chartContainer.style.flexDirection = "column";
  chartContainer.style.alignItems = "center";
  chartContainer.style.gap = "24px";
  chartContainer.style.padding = "20px 0";

  const legendContainer = document.createElement("div");
  legendContainer.style.cssText = "width:100%; display:flex; flex-wrap:wrap; gap:12px 20px; justify-content:center; margin-top:8px;";

  rows.forEach(([type, total], i) => {
    const color = colors[i % colors.length];
    const share = grandCashTotal ? (total.cash / grandCashTotal) * 100 : (1 / rows.length) * 100;
    
    linearParts.push(`${color} ${currentPercent}% ${currentPercent + share}%`);
    currentPercent += share;

    const item = document.createElement("div");
    item.style.cssText = "display:flex; align-items:center; gap:8px; font-size:13px;";
    item.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <i style="width:12px; height:12px; border-radius:2px; background:${color}; display:inline-block;"></i>
        <span style="color:#94a3b8;">${escapeHtml(type)}</span>
      </div>
      <strong style="color:#f8fafc;">${escapeHtml(formatMixedValue(total.cash, total.points))}</strong>
    `;
    legendContainer.appendChild(item);
  });

  const bar = document.createElement("div");
  bar.style.width = "100%";
  bar.style.height = "12px";
  bar.style.borderRadius = "6px";
  bar.style.position = "relative";
  bar.style.background = `linear-gradient(to right, ${linearParts.join(", ")})`;
  bar.style.boxShadow = "inset 0 1px 3px rgba(0,0,0,0.3)";
  bar.style.border = "1px solid rgba(255,255,255,0.05)";

  bar.addEventListener("mousemove", (e) => {
    const rect = bar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = (x / rect.width) * 100;

    let cumulativePercent = 0;
    let found = false;

    rows.forEach(([type, total]) => {
      const share = grandCashTotal ? (total.cash / grandCashTotal) * 100 : (1 / rows.length) * 100;
      const endRange = cumulativePercent + share;

      if (percent >= cumulativePercent && percent < endRange) {
        const valueText = formatMixedValue(total.cash, total.points);
        const shareText = share.toFixed(1);
        bar.title = `${type}: ${valueText} (${shareText}%)`;
        found = true;
      }
      cumulativePercent += share;
    });
    if (!found) bar.title = "";
  });

  chartContainer.appendChild(bar);
  chartContainer.appendChild(legendContainer);
  els.categoryBars.appendChild(chartContainer);
}

function getFilteredCards() {
  return state.cards
    .filter((card) => {
      const totals = getCardTotals(card);
      const status = getStatus(totals.net).key;
      const matchesText = [card.name, card.issuer, card.notes].join(" ").toLowerCase().includes(state.search);
      const matchesStatus = state.statusFilter === "all" || state.statusFilter === status;
      return matchesText && matchesStatus;
    })
    .sort((a, b) => {
      const totalsA = getCardTotals(a);
      const totalsB = getCardTotals(b);
      if (state.sort === "netDesc") return (totalsB.net || 0) - (totalsA.net || 0);
      if (state.sort === "netAsc") return (totalsA.net || 0) - (totalsB.net || 0);
      if (state.sort === "feeDesc") return (totalsB.fees || 0) - (totalsA.fees || 0);
      if (state.sort === "benefitDesc") return (totalsB.benefits || 0) - (totalsA.benefits || 0);
      if (state.sort === "pointsDesc") return (totalsB.points || 0) - (totalsA.points || 0);
      if (state.sort === "nameAsc") return (a.name || "").localeCompare(b.name || "");
      return 0;
    });
}

async function saveCardFromForm(event) 
{
  event.preventDefault();
  syncDraftBenefitsFromDom();
  syncPreviousFeeFromForm();
  syncFutureFeeFromForm();

  const card = normalizeCard({
    id: els.editingId.value || createId(),
    name: els.cardName.value.trim(),
    issuer: els.issuerName.value.trim(),
    annualFee: els.annualFee.value,
    taxFee: els.taxFee.value,
    memberSince: els.memberSince.value.trim(),
    previousAnnualFees: draftPreviousAnnualFees,
    futureAnnualFees: draftFutureAnnualFees,
    targetValue: els.targetValue?.value || "",
    notes: els.notes.value.trim(),
    benefits: draftBenefits.filter(
      (benefit) => benefit.label.trim() || toNumber(benefit.amount) > 0
    ),
  });

  if (!card.name) {
    showToast("Card name is required.");
    els.cardName.focus();
    return;
  }

  const existingIndex = state.cards.findIndex((item) => item.id === card.id);

  if (existingIndex >= 0) {
    state.cards[existingIndex] = card;
    showToast("Card updated.");
  } else {
    state.cards.push(card);
    showToast("Card added.");
  }

  syncLoungeBenefitsFromVisits();
  console.log("🔥 Saving to Firebase...", state.cards);

  await saveState();   

  resetForm();
  render();
}
function handleCardAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const card = state.cards.find((item) => item.id === button.dataset.id);
  if (!card) return;

  if (button.dataset.action === "edit") {
    populateForm(card);
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (button.dataset.action === "toggle-grey") {
    card.isGreyedOut = !card.isGreyedOut;
    saveState();
    render();
    return;
  }

  if (button.dataset.action === "duplicate") {
    const copy = normalizeCard({
      ...card,
      id: createId(),
      name: `${card.name} copy`,
      benefits: card.benefits.map((benefit) => ({ ...benefit, id: createId() })),
    });
    state.cards.push(copy);
    syncLoungeBenefitsFromVisits();
    saveState();
    render();
    showToast("Card duplicated.");
    return;
  }

  if (button.dataset.action === "delete") {
    const confirmed = confirm(`Delete ${card.name}?`);
    if (!confirmed) return;
    state.cards = state.cards.filter((item) => item.id !== card.id);
    state.swipes = state.swipes.filter((swipe) => swipe.cardId !== card.id);
    state.rpSpends = state.rpSpends.filter((rpSpend) => rpSpend.cardId !== card.id);
    state.loungeVisits = state.loungeVisits.filter((visit) => visit.cardId !== card.id);
    syncLoungeBenefitsFromVisits();
    if (els.editingId.value === card.id) resetForm();
    saveState();
    render();
    showToast("Card deleted.");
  }
}

function populateForm(card) {
  els.formTitle.textContent = "Edit card";
  els.editingId.value = card.id;
  els.cardName.value = card.name;
  els.issuerName.value = card.issuer;
  els.annualFee.value = card.annualFee || "";
  els.taxFee.value = card.taxFee || "";
  els.memberSince.value = card.memberSince || "";
  if (els.previousFeeDate) {
    els.previousFeeDate.value = "";
  }
  els.prevYearFee.value = "";
  draftPreviousAnnualFees = Array.isArray(card.previousAnnualFees)
    ? card.previousAnnualFees.map((fee) => ({ ...fee }))
    : [];
  draftFutureAnnualFees = Array.isArray(card.futureAnnualFees)
    ? card.futureAnnualFees.map((fee) => ({ ...fee }))
    : [];
  toggleFutureFeeFields(true);
  if (els.futureFeeDate) {
    els.futureFeeDate.value = "";
  }
  if (els.futureAnnualFee) {
    els.futureAnnualFee.value = "";
  }
  if (els.targetValue) {
    els.targetValue.value = card.targetValue || "";
  }
  els.notes.value = card.notes;

  // ✅ set benefits FIRST
  draftBenefits = Array.isArray(card.benefits) && card.benefits.length > 0
    ? card.benefits.map((b) => ({ ...b, id: b.id || createId() }))
    : [];

  // ✅ THEN render
  renderBenefitsEditor();

  // ✅ THEN toggle fee field (no sync inside it)
  togglePreviousFeeField();
}

function resetForm() {
  els.formTitle.textContent = "Add card";
  els.editingId.value = "";
  els.cardForm.reset();
  draftBenefits = [];
  draftPreviousAnnualFees = [];
  renderBenefitsEditor();
  togglePreviousFeeField();
  toggleFutureFeeFields(false);
}

function addBenefitDraft() {
  syncDraftBenefitsFromDom();
  draftBenefits.push(createBlankBenefit());
  renderBenefitsEditor();
}

function updateDraftBenefit(event) {
  const fieldEl = event.target.closest("[data-benefit-field]");
  if (!fieldEl) return;

  const row = fieldEl.closest(".benefit-row");
  const index = Number(row?.dataset.index);
  if (!Number.isInteger(index) || !draftBenefits[index]) return;

  const fieldName = fieldEl.dataset.benefitField;
  draftBenefits[index][fieldName] = fieldName === "amount" ? toNumber(fieldEl.value) : fieldEl.value;
}

function removeBenefitDraft(event) {
  const button = event.target.closest("[data-remove-benefit]");
  if (!button) return;

  syncDraftBenefitsFromDom();
  const index = Number(button.dataset.removeBenefit);
  draftBenefits.splice(index, 1);
  renderBenefitsEditor();
}

function syncDraftBenefitsFromDom() {
  draftBenefits = Array.from(els.benefitRows.querySelectorAll(".benefit-row")).map((row) => {
    const type = row.querySelector('[data-benefit-field="type"]').value;
    const valueType = row.querySelector('[data-benefit-field="valueType"]').value;
    const label = row.querySelector('[data-benefit-field="label"]').value.trim();
    const amount = toNumber(row.querySelector('[data-benefit-field="amount"]').value);
    return {
      id: draftBenefits[Number(row.dataset.index)]?.id || createId(),
      type,
      valueType,
      label,
      amount,
    };
  });
}

function exportPortfolio() {
  const payload = {
    exportedAt: new Date().toISOString(),
    currency: state.currency,
    cards: state.cards,
    swipes: state.swipes,
    rpSpends: state.rpSpends,
    loungeVisits: state.loungeVisits,
  };
  try {
    localStorage.setItem(storageKey + "-backup", JSON.stringify(payload));
  } catch (e) {
    console.warn("Could not save local backup", e);
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `credit-card-portfolio-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Portfolio exported and saved locally.");
}

function importPortfolio(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      if (!Array.isArray(data.cards)) throw new Error("Missing cards");

      state.currency = data.currency || state.currency;
      state.cards = data.cards.map(normalizeCard);
      state.swipes = (data.swipes || []).map(normalizeSwipe);
      state.rpSpends = (data.rpSpends || []).map(normalizeRpSpend);
      state.loungeVisits = (data.loungeVisits || []).map(normalizeLoungeVisit);
      syncLoungeBenefitsFromVisits();
      saveState();
      resetForm();
      render();
      showToast("Portfolio imported.");
    } catch (error) {
      showToast("Import failed. Use a portfolio JSON export.");
    } finally {
      els.importFile.value = "";
    }
  };
  reader.readAsText(file);
}



function startRealtimeSync() {
  const { doc } = window.firebaseFns;

  onSnapshot(doc(window.db, "portfolio", "userData"), (snap) => {
    if (snap.exists()) {
      const data = snap.data();

      state.currency = data.currency || "INR";
      state.cards = (data.cards || []).map(normalizeCard);
      state.swipes = (data.swipes || []).map(normalizeSwipe);
      state.rpSpends = (data.rpSpends || []).map(normalizeRpSpend);
      state.loungeVisits = (data.loungeVisits || []).map(normalizeLoungeVisit);
      syncLoungeBenefitsFromVisits();

      console.log("🔄 Real-time update", state.cards);

      render();
    }
  });
}

function getTotals(cards) {
  return cards.reduce(
    (totals, card) => {
      const cardTotals = getCardTotals(card);
      totals.fees += cardTotals.fees;
      totals.benefits += cardTotals.benefits;
      totals.points += cardTotals.points;
      totals.net += cardTotals.net;
      totals.surplus += Math.max(0, cardTotals.net);
      totals.deficit += Math.max(0, -cardTotals.net);
      totals.benefitCount += card.benefits.length;
      totals.cashBenefitCount += cardTotals.cashBenefitCount;
      totals.pointBenefitCount += cardTotals.pointBenefitCount;
      return totals;
    },
    {
      fees: 0,
      benefits: 0,
      points: 0,
      net: 0,
      surplus: 0,
      deficit: 0,
      benefitCount: 0,
      cashBenefitCount: 0,
      pointBenefitCount: 0,
    }
  );
}

function getCardTotals(card) {
  let fees = toNumber(card.annualFee) + toNumber(card.taxFee) + getPreviousAnnualFeeTotal(card) + getFutureAnnualFeeTotal(card);

  const benefits = card.benefits.reduce((sum, benefit) => (isPointBenefit(benefit) ? sum : sum + toNumber(benefit.amount)), 0);
  const points = card.benefits.reduce((sum, benefit) => (isPointBenefit(benefit) ? sum + toNumber(benefit.amount) : sum), 0);
  const cashBenefitCount = card.benefits.filter((benefit) => !isPointBenefit(benefit)).length;
  const pointBenefitCount = card.benefits.filter(isPointBenefit).length;
  return {
    fees,
    benefits,
    points,
    cashBenefitCount,
    pointBenefitCount,
    net: benefits - fees,
  };
}

function getPreviousAnnualFeeTotal(card) {
  return (card.previousAnnualFees || []).reduce((sum, fee) => sum + toNumber(fee.amount), 0);
}

function getFutureAnnualFeeTotal(card) {
  return (card.futureAnnualFees || []).reduce((sum, fee) => sum + toNumber(fee.amount), 0);
}

function getSwipeTotal() {
  return state.swipes.reduce((sum, swipe) => sum + toNumber(swipe.amount), 0);
}

function getSwipeCategoryTotals() {
  return state.swipes.reduce(
    (totals, swipe) => {
      const category = normalizeSwipeCategory(swipe.category);
      totals[category] += toNumber(swipe.amount);
      return totals;
    },
    { business: 0, personal: 0 }
  );
}

function getRpSpendPaidValue(rpSpend) {
  return toNumber(rpSpend.pointsValue) +
    toNumber(rpSpend.redemptionCharges) +
    toNumber(rpSpend.cardPaid) +
    toNumber(rpSpend.voucherPaid);
}

function getRpSpendTotal() {
  return state.rpSpends.reduce((sum, rpSpend) => sum + getRpSpendPaidValue(rpSpend), 0);
}

function getRpPointsUsedTotal() {
  return state.rpSpends.reduce((sum, rpSpend) => sum + toNumber(rpSpend.points), 0);
}

function getRpPointsReceivedTotal() {
  // Sum pointsReceived per purchase group (one value per purchase),
  // so multiple payment rows don't multiply the same Neucoins.
  const groups = {};
  state.rpSpends.forEach((spend) => {
    const pid = spend.purchaseId || spend.id;
    if (!groups[pid]) {
      groups[pid] = toNumber(spend.pointsReceived || 0);
    }
  });

  return Object.values(groups).reduce((sum, v) => sum + v, 0);
}

function getLoungeVisitTotal() {
  return state.loungeVisits.reduce((sum, visit) => sum + toNumber(visit.total), 0);
}

function getCardById(cardId) {
  return state.cards.find((card) => card.id === cardId);
}

function getStatus(net) { 
  if (net > 0) return { key: "profit", label: "Profit" };
  if (net < 0) return { key: "loss", label: "Loss" };
  return { key: "breakeven", label: "Recovered" };
}

function createEmptyState(title, copy) {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.innerHTML = `
    <div class="empty-icon" aria-hidden="true"></div>
    <h3>${escapeHtml(title)}</h3>
    <p class="empty-copy">${escapeHtml(copy)}</p>
  `;
  return empty;
}

function createBlankBenefit() {
  return {
    id: createId(),
    type: "Points Redeemed",
    valueType: "cash",
    label: "",
    amount: 0,
  };
}

function normalizeBenefitValueType(valueType) {
  return valueType === "points" ? "points" : "cash";
}

function isPointBenefit(benefit) {
  return normalizeBenefitValueType(benefit.valueType) === "points";
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toNumber(value) {
  const number = parseFloat(value);
  return !isNaN(number) && isFinite(number) ? Math.max(0, number) : 0;
}

function normalizeMonth(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}/.test(text) ? text.slice(0, 7) : "";
}

function normalizeFinancialYear(value) {
  const allowedYears = ["FY 24-25", "FY 25-26", "FY 26-27", "FY 27-28", "FY 28-29", "FY 29-30"];
  return allowedYears.includes(value) ? value : "FY 25-26";
}

function formatMonthYear(value) {
  const normalized = normalizeMonth(value);
  if (!normalized) return "";

  const [year, month] = normalized.split("-").map(Number);
  const date = new Date(year, month - 1, 1);

  return date.toLocaleString(undefined, {
    month: "short",
    year: "numeric",
  });
}

function formatCardName(card) {
  if (!card) return "Card not found";
  return [card.issuer, card.name].filter(Boolean).join(" | ") || "Untitled card";
}

function formatRpSourceName(sourceId) {
  const platformNames = {
    CRED: "CRED",
    Shopwise: "Shopwise",
    Maximize: "Maximize",
    Neucoins: "Neucoins",
    "Axis Rewards": "Axis Rewards",
  };

  if (platformNames[sourceId]) return platformNames[sourceId];

  const card = getCardById(sourceId);
  return formatCardName(card);
}

function formatDateTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatFeeBreakdown(card) {
  const currentFee = toNumber(card.annualFee) + toNumber(card.taxFee);
  const previousFee = getPreviousAnnualFeeTotal(card);
  const upcomingFee = getFutureAnnualFeeTotal(card);
  const parts = [];

  if (currentFee > 0) {
    parts.push(`Joining: ${formatMoney(currentFee)}`);
  }

  if (previousFee > 0) {
    card.previousAnnualFees.forEach((fee) => {
      const dateLabel = formatMonthYear(fee.month);
      parts.push(`${dateLabel}: ${formatMoney(fee.amount)}`);
    });
  }

  if (upcomingFee > 0) {
    card.futureAnnualFees.forEach((fee) => {
      const dateLabel = formatMonthYear(fee.month);
      parts.push(`${dateLabel}: ${formatMoney(fee.amount)}`);
    });
  }

  return parts.length ? parts.join(" | ") : "No fee recorded";
}

function formatMoney(value) {
  const sign = value < 0 ? "-" : "";
  const amount = Math.abs(value);
  return `${sign}${state.currency} ${amount.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

function formatPoints(value) {
  const sign = value < 0 ? "-" : "";
  const amount = Math.abs(value);
  const label = amount === 1 ? "pt" : "pts";
  return `${sign}${amount.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })} ${label}`;
}

function formatBenefitValue(benefit) {
  return isPointBenefit(benefit) ? formatPoints(benefit.amount) : formatMoney(benefit.amount);
}

function formatMixedValue(cash, points) {
  const parts = [];
  if (cash > 0) parts.push(formatMoney(cash));
  if (points > 0) parts.push(formatPoints(points));
  return parts.length ? parts.join(" + ") : formatMoney(0);
}

function formatMixedValueHtml(cash, points) {
  if (cash > 0 && points > 0) {
    return `<strong>${escapeHtml(formatMoney(cash))}</strong><span class="value-subline">${escapeHtml(formatPoints(points))}</span>`;
  }

  if (points > 0) {
    return `<strong>${escapeHtml(formatPoints(points))}</strong>`;
  }

  return `<strong>${escapeHtml(formatMoney(cash))}</strong>`;
}

function formatBenefitSplitHtml(cash, points) { 
  const cashLine = `<span class="value-row"><span>Total</span><strong>${escapeHtml(formatMoney(cash))}</strong></span>`;
  const pointsLine = `<span class="value-row"><span>Unredeemed</span><strong>${escapeHtml(formatPoints(points))}</strong></span>`;
  return `${cashLine}${pointsLine}`;
}

function formatCardBenefitsHtml(card) {
  if (!card.benefits.length) {
    return `<div class="benefit-breakdown muted-breakdown">No points or redemptions logged</div>`;
  }

  return `
    <div class="benefit-breakdown">
      ${card.benefits
        .map((benefit) => {
          const impactLabel = isPointBenefit(benefit) ? "Points" : "Monetary";
          const name = benefit.label || benefit.type;
          return `
            <span class="benefit-line">
              <span class="benefit-line-name">${escapeHtml(name)}</span>
              <span class="benefit-line-meta">${escapeHtml(benefit.type)} | ${escapeHtml(impactLabel)}</span>
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
    showView(state.currentView);
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
    showView(state.currentView);
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
  updateAppBackButton();

  // clear session
  sessionStorage.removeItem("unlocked");

  // hide app
  document.getElementById("app").style.display = "none";

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
