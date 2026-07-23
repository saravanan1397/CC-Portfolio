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

const editableBenefitTypes = benefitTypes.filter((type) => type !== "Points Redeemed" && type !== "Unredeemed Points");
const editableBenefitValueTypes = benefitValueTypes.filter((type) => type.value !== "points");
const defaultManualBenefitType = "Cashback / Statement Credit";
const rpRedeemedBenefitPrefix = "rp-redeemed-";
const partnerProgramPlatformValue = "Hotel/Airline Partners";

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
  aiTrainer: {
    examples: [],
    updatedAt: "",
  },
  search: "",
  swipeSearch: "",
  rpSpendSearch: "",
  statusFilter: "all",
  sort: "netAsc",
  currentView: normalizeViewName(sessionStorage.getItem("currentView")),
};

let draftBenefits = [];
let draftPreviousAnnualFees = [];
let draftFutureAnnualFees = [];
let toastTimer = null;
let loungeChartInstance = null;
let aiModalResolver = null;
let aiModalMode = null;
let aiPendingIntent = null;
let aiPendingResolver = null;
let aiCommandQueue = Promise.resolve();

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
    pprView: document.getElementById("pprView"),
    loungeView: document.getElementById("loungeView"),
    appPageTitle: document.getElementById("appPageTitle"),
    dashboardNetValue: document.getElementById("dashboardNetValue"),
    dashboardNetHint: document.getElementById("dashboardNetHint"),
    dashboardSwipeValue: document.getElementById("dashboardSwipeValue"),
    dashboardSwipeHint: document.getElementById("dashboardSwipeHint"),
    dashboardLoungeValue: document.getElementById("dashboardLoungeValue"),
    dashboardLoungeHint: document.getElementById("dashboardLoungeHint"),
    dashboardRpValue: document.getElementById("dashboardRpValue"),
    dashboardRpHint: document.getElementById("dashboardRpHint"),
    dashboardPprValue: document.getElementById("dashboardPprValue"),
    dashboardPprHint: document.getElementById("dashboardPprHint"),
    pprWidgetHint: document.getElementById("pprWidgetHint"),
    pprWidgetTotal: document.getElementById("pprWidgetTotal"),
    pprWidgetCount: document.getElementById("pprWidgetCount"),
    pprWidgetList: document.getElementById("pprWidgetList"),
    pprValueModal: document.getElementById("pprValueModal"),
    pprValueModalTitle: document.getElementById("pprValueModalTitle"),
    pprValueModalPartner: document.getElementById("pprValueModalPartner"),
    pprValueInput: document.getElementById("pprValueInput"),
    pprValueModalCancelBtn: document.getElementById("pprValueModalCancelBtn"),
    pprValueModalSaveBtn: document.getElementById("pprValueModalSaveBtn"),
    redeemPointsModal: document.getElementById("redeemPointsModal"),
    redeemPointsModalTitle: document.getElementById("redeemPointsModalTitle"),
    redeemPointsModalCard: document.getElementById("redeemPointsModalCard"),
    redeemPointsInput: document.getElementById("redeemPointsInput"),
    redeemPointsError: document.getElementById("redeemPointsError"),
    redeemPointsCancelBtn: document.getElementById("redeemPointsCancelBtn"),
    redeemPointsConfirmBtn: document.getElementById("redeemPointsConfirmBtn"),
    pprDetailsModal: document.getElementById("pprDetailsModal"),
    pprDetailsModalTitle: document.getElementById("pprDetailsModalTitle"),
    pprDetailsModalSubtitle: document.getElementById("pprDetailsModalSubtitle"),
    pprDetailsModalBody: document.getElementById("pprDetailsModalBody"),
    pprDetailsModalCloseBtn: document.getElementById("pprDetailsModalCloseBtn"),
    aiCommandForm: document.getElementById("aiCommandForm"),
    aiCommandInput: document.getElementById("aiCommandInput"),
    aiCommandRunBtn: document.getElementById("aiCommandRunBtn"),
    openPortfolioBtn: document.getElementById("openPortfolioBtn"),
    openSwipesBtn: document.getElementById("openSwipesBtn"),
    openRpSpendsBtn: document.getElementById("openRpSpendsBtn"),
    openPprBtn: document.getElementById("openPprBtn"),
    editingSwipeId:document.getElementById("editingSwipeId"),
    openLoungeBtn: document.getElementById("openLoungeBtn"),
    backFromPortfolioBtn: document.getElementById("backFromPortfolioBtn"),
    backFromSwipesBtn: document.getElementById("backFromSwipesBtn"),
    backFromRpSpendsBtn: document.getElementById("backFromRpSpendsBtn"),
    backFromPprBtn: document.getElementById("backFromPprBtn"),
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
    swipeFilteredTotal: document.getElementById("swipeFilteredTotal"),
    swipeCardFilter: document.getElementById("swipeCardFilter"),
    swipeSearchInput: document.getElementById("swipeSearchInput"),
    rpSpendSearchInput: document.getElementById("rpSpendSearchInput"),
    addSwipeBtn: document.getElementById("addSwipeBtn"),
    clearSwipeBtn: document.getElementById("clearSwipeBtn") || document.getElementById("cancelSwipeBtn"),
    editingSwipeId: document.getElementById("editingSwipeId"), // Ensure this hidden input exists in HTML
    swipesTable: document.getElementById("swipesTable"),
    editingRpSpendId: document.getElementById("editingRpSpendId"),
    editingRpPurchaseId: document.getElementById("editingRpPurchaseId"),
    rpRedeemedPoints: document.getElementById("rpRedeemedPoints"),
    rpOriginatingCardId: document.getElementById("rpOriginatingCardId"),
    rpPartnerTransferRatio: document.getElementById("rpPartnerTransferRatio"),
    rpCardSelect: document.getElementById("rpCardSelect"),
    rpPoints: document.getElementById("rpPoints"),
    rpPointsValue: document.getElementById("rpPointsValue"),
    rpRedemptionCharges: document.getElementById("rpRedemptionCharges"),
    rpCardPaid: document.getElementById("rpCardPaid"),
    rpVoucherPaid: document.getElementById("rpVoucherPaid"),
    rpPurchasedFrom: document.getElementById("rpPurchasedFrom"),
    rpPartnerTransferBtn: document.getElementById("rpPartnerTransferBtn"),
    rpProductName: document.getElementById("rpProductName"),
    rpProductValue: document.getElementById("rpProductValue"),
     rpPointsReceived: document.getElementById("rpPointsReceived"),
     rpUnredeemedPoints: document.getElementById("rpUnredeemedPoints"),
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
    aiAssistModal: document.getElementById("aiAssistModal"),
    aiAssistModalTitle: document.getElementById("aiAssistModalTitle"),
    aiAssistModalSubtitle: document.getElementById("aiAssistModalSubtitle"),
    aiAssistModalBody: document.getElementById("aiAssistModalBody"),
    aiAssistModalFooter: document.getElementById("aiAssistModalFooter"),
    aiAssistCloseBtn: document.getElementById("aiAssistCloseBtn"),

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

  els.aiCommandForm?.addEventListener("submit", handleAiCommandSubmit);
  els.aiCommandInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAiCommandSubmit(event);
    }
  });
  document.addEventListener("click", (event) => {
    const sample = event.target.closest?.("[data-ai-sample]");
    if (!sample) return;
    if (els.aiCommandInput) {
      els.aiCommandInput.value = sample.dataset.aiSample || "";
      els.aiCommandInput.focus();
      els.aiCommandInput.select?.();
    }
  });
  els.aiAssistCloseBtn?.addEventListener("click", () => closeAiModal());
  els.aiAssistModal?.addEventListener("click", (event) => {
    if (event.target === els.aiAssistModal) {
      closeAiModal();
    }
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
  els.openPprBtn?.addEventListener("click", () => showView("ppr"));
  els.openLoungeBtn?.addEventListener("click", () => showView("lounge"));
  els.backFromPortfolioBtn?.addEventListener("click", () => showView("dashboard"));
  els.backFromSwipesBtn?.addEventListener("click", () => showView("dashboard"));
  els.backFromRpSpendsBtn?.addEventListener("click", () => showView("dashboard"));
  els.backFromPprBtn?.addEventListener("click", () => showView("dashboard"));
  els.pprValueModalCancelBtn?.addEventListener("click", () => {
    if (els.pprValueModal) els.pprValueModal.style.display = "none";
  });
  els.pprValueModalSaveBtn?.addEventListener("click", savePprPartnerValue);
  els.pprValueInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      savePprPartnerValue();
    }
  });
  els.pprValueModal?.addEventListener("click", (event) => {
    if (event.target === els.pprValueModal) {
      els.pprValueModal.style.display = "none";
    }
  });
  els.redeemPointsCancelBtn?.addEventListener("click", () => closeRedeemPointsModal());
  els.redeemPointsConfirmBtn?.addEventListener("click", () => saveRedeemedPointsFromModal());
  els.redeemPointsInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveRedeemedPointsFromModal();
    }
  });
  els.redeemPointsModal?.addEventListener("click", (event) => {
    if (event.target === els.redeemPointsModal) {
      closeRedeemPointsModal();
    }
  });
  els.pprDetailsModalCloseBtn?.addEventListener("click", () => closePprDetailsModal());
  els.pprDetailsModal?.addEventListener("click", (event) => {
    if (event.target === els.pprDetailsModal) {
      closePprDetailsModal();
    }
  });
  els.pprDetailsModalBody?.addEventListener("click", handlePprDetailsAction);
  els.pprWidgetList?.addEventListener("click", handlePprWidgetAction);
  els.pprWidgetList?.addEventListener("keydown", (event) => {
    const row = event.target.closest?.(".ppr-partner-row");
    if (!row) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      showPprPartnerDetails(row.dataset.partnerName || "Partner");
    }
  });
  els.backFromLoungeBtn?.addEventListener("click", () => showView("dashboard"));
  els.swipeCategorySelect?.addEventListener("change", refreshSwipeSpentForRequirement);
  els.swipeFyFilter?.addEventListener("change", () => { swipesAllExpanded = false; renderSwipes(); });
  els.swipeCategoryFilter?.addEventListener("change", () => { swipesAllExpanded = false; renderSwipes(); });
  els.swipeTypeFilter?.addEventListener("change", () => { swipesAllExpanded = false; renderSwipes(); });
  els.swipeCardFilter?.addEventListener("change", () => { swipesAllExpanded = false; renderSwipes(); });
  els.swipeSearchInput?.addEventListener("input", () => {
    state.swipeSearch = els.swipeSearchInput.value.trim().toLowerCase();
    swipesAllExpanded = false;
    renderSwipes();
  });
  els.rpSpendSearchInput?.addEventListener("input", () => {
    state.rpSpendSearch = els.rpSpendSearchInput.value.trim().toLowerCase();
    rpSpendsAllExpanded = false;
    renderRpSpends();
  });
  els.addSwipeBtn?.addEventListener("click", addSwipeFromForm);
  els.exportBtn?.addEventListener("click", exportPortfolio);
  els.importBtn?.addEventListener("click", () => els.importFile?.click());
  els.importFile?.addEventListener("change", importPortfolio);
  els.clearSwipeBtn?.addEventListener("click", resetSwipeForm);
  els.swipesTable?.addEventListener("click", handleSwipeAction);
  [els.rpPointsValue, els.rpRedemptionCharges, els.rpCardPaid, els.rpVoucherPaid].forEach((input) => {
    input?.addEventListener("input", updateRpPaidValue);
  });
  els.rpCardSelect?.addEventListener("change", handleRpCardSelectChange);
  els.rpPartnerTransferBtn?.addEventListener("click", async () => {
    const result = await showPartnerProgramTransferPrompt({
      partnerName: els.rpPurchasedFrom?.value.trim() || "",
      ratio: els.rpPartnerTransferRatio?.value || "",
      originatingCardId: els.rpOriginatingCardId?.value || "",
    });

    if (!result) return;

    if (els.rpCardSelect) {
      els.rpCardSelect.value = partnerProgramPlatformValue;
    }
    if (els.rpPurchasedFrom) {
      els.rpPurchasedFrom.value = result.partnerName;
      els.rpPurchasedFrom.dataset.partnerProgramAuto = "true";
    }
    if (els.rpPartnerTransferRatio) {
      els.rpPartnerTransferRatio.value = result.ratio || "";
    }
    if (els.rpOriginatingCardId) {
      els.rpOriginatingCardId.value = result.originatingCardId || "";
    }
    updatePartnerTransferDetailsButton();
    refreshAllFieldStates();
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
      state.aiTrainer = normalizeAiTrainer(data.aiTrainer);
      const migratedLegacyRp = migrateLegacyPointsRedeemedBenefitsToRpSpends();
      syncLoungeBenefitsFromVisits();
      if (migratedLegacyRp) {
        await saveState();
      }

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
    aiTrainer: state.aiTrainer,
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
          pointsAmount: toNumber(benefit.pointsAmount),
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
  const partnerTransferRatio = String(spend.partnerTransferRatio || spend.transferRatio || "").trim();
  const baseRedeemedPoints = toNumber(spend.redeemedPoints ?? spend.redeemed ?? spend.redeemedPointsTotal);
  const rawPoints = toNumber(spend.points);
  const pointsValue = toNumber(spend.pointsValue ?? spend.value);
  const redemptionCharges = toNumber(spend.redemptionCharges);
  const cardPaid = toNumber(spend.cardPaid);
  const voucherPaid = toNumber(spend.voucherPaid);
  const productValue = toNumber(spend.productValue);
  const normalizedPointsReceived = toNumber(spend.pointsReceived ?? spend.neucoinsPointsReceived);
  const isPartnerRecord = spend.partnerProgram === true || spend.cardId === partnerProgramPlatformValue;
  const hasExplicitUnredeemedFlag = [
    "unredeemedPointsRecord",
    "isUnredeemedPointsRecord",
    "unredeemed",
  ].some((key) => Object.prototype.hasOwnProperty.call(spend, key));
  const isLegacyUnredeemedRecord = !hasExplicitUnredeemedFlag
    && !isPartnerRecord
    && rawPoints > 0
    && baseRedeemedPoints <= 0
    && pointsValue <= 0
    && redemptionCharges <= 0
    && cardPaid <= 0
    && voucherPaid <= 0
    && productValue <= 0
    && normalizedPointsReceived <= 0;
  const isLegacyRedeemedProduct = !hasExplicitUnredeemedFlag
    && !isPartnerRecord
    && rawPoints > 0
    && baseRedeemedPoints <= 0
    && pointsValue > 0;
  const normalizedRedeemedPoints = isLegacyRedeemedProduct ? rawPoints : baseRedeemedPoints;
  const hasSplitRedemptionModel = spend.redemptionModel === "split-v2"
    || String(id).startsWith("legacy-")
    || isLegacyRedeemedProduct;
  const normalizedPoints = !hasSplitRedemptionModel && normalizedRedeemedPoints > 0
    ? rawPoints + normalizedRedeemedPoints
    : rawPoints;
  const parsedRatio = parsePartnerTransferRatio(partnerTransferRatio);
  const partnerTransferPoints = normalizedRedeemedPoints > 0 ? normalizedRedeemedPoints : normalizedPoints;
  const autoPointsReceived = normalizedPointsReceived > 0
    ? normalizedPointsReceived
    : partnerTransferRatio && parsedRatio && partnerTransferPoints > 0
    ? computePartnerTransferPoints(partnerTransferPoints, parsedRatio)
    : normalizedPointsReceived;

  return {
    id,
    purchaseId: spend.purchaseId || spend.productGroupId || id,
    cardId: spend.cardId || "",
    points: normalizedPoints,
    redeemedPoints: normalizedRedeemedPoints,
    unredeemedPointsRecord: spend.unredeemedPointsRecord === true
      || spend.isUnredeemedPointsRecord === true
      || spend.unredeemed === true
      || isLegacyUnredeemedRecord,
    unredeemedBalanceInitialized: spend.unredeemedBalanceInitialized === true,
    redemptionModel: "split-v2",
    pointsValue,
    redemptionCharges,
    cardPaid,
    voucherPaid,
    partnerProgram: isPartnerRecord,
    partnerName: spend.partnerName || spend.partner || spend.purchasedFrom || "",
    purchasedFrom: spend.purchasedFrom || "",
    originatingCardId: spend.originatingCardId || spend.sourceCardId || "",
    partnerTransferRatio,
    productName: spend.productName || spend.product || "",
    productValue: toNumber(spend.productValue),
    pointsReceived: autoPointsReceived,
    createdAt: spend.createdAt || new Date().toISOString(),
  };
}

function isRpRedeemedAutoBenefit(benefit) {
  return String(benefit?.id || "").startsWith(rpRedeemedBenefitPrefix);
}

function isUnredeemedPointsRecord(rpSpend) {
  return rpSpend?.unredeemedPointsRecord === true;
}

function getRpSpendRedeemedSourceCardId(rpSpend) {
  if (!rpSpend) return "";
  if (isPartnerProgramRpSpend(rpSpend)) {
    return String(rpSpend.originatingCardId || "").trim();
  }
  return String(rpSpend.cardId || "").trim();
}

function parsePartnerTransferRatio(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
  if (!match) return null;

  const from = toNumber(match[1]);
  const to = toNumber(match[2]);
  if (from <= 0 || to <= 0) return null;

  return { from, to };
}

function computePartnerTransferPoints(points, ratio) {
  const pointValue = toNumber(points);
  if (pointValue <= 0 || !ratio?.from || !ratio?.to) return 0;
  return (pointValue * ratio.to) / ratio.from;
}

function getNeuPortfolioCardId() {
  const exactNeuCard = state.cards.find((card) => /tata\s+neu\s+infinity/i.test(card.name || ""));
  if (exactNeuCard) return exactNeuCard.id;

  const fallbackNeuCard = state.cards.find((card) => /\bneu\b/i.test(card.name || ""));
  return fallbackNeuCard?.id || "";
}

function getRpRedeemedPortfolioCardId(sourceCardId) {
  if (sourceCardId === "Neucoins") {
    return getNeuPortfolioCardId();
  }

  return sourceCardId;
}

function isLegacyManualPointsRedeemedBenefit(benefit) {
  return benefit?.type === "Points Redeemed" && !isRpRedeemedAutoBenefit(benefit);
}

function migrateLegacyPointsRedeemedBenefitsToRpSpends() {
  const migratedRows = [];
  let changed = false;

  state.cards = state.cards.map((card) => {
    const benefits = Array.isArray(card.benefits) ? card.benefits : [];
    const legacyBenefits = benefits.filter(isLegacyManualPointsRedeemedBenefit);

    if (!legacyBenefits.length) {
      return card;
    }

    const groupedLegacyBenefits = new Map();

    legacyBenefits.forEach((benefit) => {
      const amount = toNumber(benefit.amount);
      if (amount <= 0) return;

      const label = String(benefit.label || "").trim();
      const key = label ? `label:${label.toLowerCase()}` : `benefit:${benefit.id || createId()}`;
      const entry = groupedLegacyBenefits.get(key) || {
        label: label || "Migrated Points Redeemed",
        points: 0,
        pointsValue: 0,
      };

      if (isPointBenefit(benefit)) {
        entry.points += amount;
      } else {
        entry.pointsValue += amount;
      }

      groupedLegacyBenefits.set(key, entry);
    });

    groupedLegacyBenefits.forEach((entry, key) => {
      if (entry.points <= 0 && entry.pointsValue <= 0) return;

      migratedRows.push(normalizeRpSpend({
        id: `legacy-${card.id}-${key}-${createId()}`,
        purchaseId: `legacy-${card.id}-${key}`,
        cardId: card.id,
        points: 0,
        redeemedPoints: entry.points,
        pointsValue: entry.pointsValue,
        purchasedFrom: "CC Portfolio",
        productName: entry.label,
        createdAt: new Date().toISOString(),
      }));
    });

    changed = true;
    return {
      ...card,
      benefits: benefits.filter((benefit) => !isLegacyManualPointsRedeemedBenefit(benefit)),
    };
  });

  if (migratedRows.length) {
    state.rpSpends = [...state.rpSpends, ...migratedRows];
  }

  return changed;
}

function syncRpRedeemedBenefitsFromSpends() {
  const totalsByCard = {};

  state.rpSpends.forEach((rpSpend) => {
    const sourceCardId = getRpSpendRedeemedSourceCardId(rpSpend);
    const portfolioCardId = getRpRedeemedPortfolioCardId(sourceCardId);
    if (!portfolioCardId) return;

    const cardTotals = totalsByCard[portfolioCardId] || {
      unredeemedPoints: 0,
      redeemedPoints: 0,
      redeemedValue: 0,
    };

    const totalPoints = getRpSpendTotalPoints(rpSpend);
    // Use the same redemption amount for Partner and Product rows. This also
    // supports existing Product rows that were saved before redeemedPoints was
    // recorded separately.
    const redeemedPoints = getRpSpendRedemptionAmount(rpSpend);
    const hasUnredeemedSource = Boolean(getUnredeemedPointsSourceRecord(sourceCardId));

    if (isUnredeemedPointsRecord(rpSpend)) {
      // This row is the source pool. Its displayed balance is reduced by the
      // redemption rows linked to the same source below.
      cardTotals.unredeemedPoints += totalPoints;
    } else if (isPartnerProgramRpSpend(rpSpend)) {
      // Partner Program points leave the originating card, including points typed directly into the form.
      cardTotals.redeemedPoints += totalPoints;
      if (hasUnredeemedSource) {
        cardTotals.unredeemedPoints -= totalPoints;
      }
    } else {
      cardTotals.unredeemedPoints += Math.max(0, totalPoints - redeemedPoints);
      cardTotals.redeemedPoints += redeemedPoints;
      if (hasUnredeemedSource) {
        cardTotals.unredeemedPoints -= redeemedPoints;
      }
    }

    // Points Value is only a redeemed value when the associated points were
    // actually redeemed. This keeps unredeemed points from appearing under
    // Points Redeemed in Card Details.
    const redeemedValueRatio = isPartnerProgramRpSpend(rpSpend)
      ? 1
      : totalPoints > 0
        ? redeemedPoints / totalPoints
        : 0;
    cardTotals.redeemedValue += toNumber(rpSpend.pointsValue) * redeemedValueRatio;

    totalsByCard[portfolioCardId] = cardTotals;
  });

  state.cards = state.cards.map((card) => {
    const benefits = (card.benefits || []).filter((benefit) => !isRpRedeemedAutoBenefit(benefit));
    const cardTotals = totalsByCard[card.id];

    if (cardTotals && cardTotals.unredeemedPoints > 0) {
      benefits.push({
        id: `${rpRedeemedBenefitPrefix}points-${card.id}`,
        type: "Unredeemed Points",
        valueType: "points",
        label: "Unredeemed Points",
        amount: Math.max(0, cardTotals.unredeemedPoints),
      });
    }

    if (cardTotals && (cardTotals.redeemedValue > 0 || cardTotals.redeemedPoints > 0)) {
      benefits.push({
        id: `${rpRedeemedBenefitPrefix}cash-${card.id}`,
        type: "Points Redeemed",
        valueType: "cash",
        label: "Points Redeemed",
        amount: cardTotals.redeemedValue,
        pointsAmount: cardTotals.redeemedPoints,
      });
    }

    return {
      ...card,
      benefits,
    };
  });
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
  const nextView = normalizeViewName(view);
  const previousView = state.currentView;
  state.currentView = nextView;
  sessionStorage.setItem("currentView", nextView);

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

  if (els.dashboardView) els.dashboardView.style.display = nextView === "dashboard" ? "block" : "none";
  if (els.portfolioView) els.portfolioView.style.display = nextView === "portfolio" ? "block" : "none";
  if (els.swipesView) els.swipesView.style.display = nextView === "swipes" ? "block" : "none";
  if (els.rpSpendsView) els.rpSpendsView.style.display = nextView === "rpSpends" ? "block" : "none";
  if (els.pprView) els.pprView.style.display = nextView === "ppr" ? "block" : "none";
  if (els.loungeView) els.loungeView.style.display = nextView === "lounge" ? "block" : "none";
  updateAppHeaderTitle(nextView);
  syncActiveViewClasses();
  animateActiveView(nextView);

  if (nextView === "portfolio" && previousView !== "portfolio") {
    resetPortfolioFilters();
  }

  if (nextView === "swipes" && previousView !== "swipes") {
    resetSwipeFilters();
  }

  if (nextView === "rpSpends" && previousView !== "rpSpends") {
    resetRpSpendFilters();
  }

  if (nextView === "lounge" && previousView !== "lounge") {
    resetLoungeFilters();
  }

  updateAppBackButton();
  updateScrollTopButton();

  window.scrollTo({ top: 0, behavior: shouldReduceMotion() ? "auto" : "smooth" });
}

function handleAiCommandSubmit(event) {
  event?.preventDefault();

  const query = els.aiCommandInput?.value.trim() || "";
  if (!query) {
    showToast("Type a search or command first.");
    return;
  }

  aiCommandQueue = aiCommandQueue
    .then(() => processAiCommand(query))
    .catch((error) => {
      console.error("AI command failed", error);
      showToast("Could not process that command.");
    });
}

async function processAiCommand(query) {
  const intent = interpretAiIntent(query);

  if (intent.action === "search") {
    await processAiReadOnlyCommand(intent);
    return;
  }

  if (intent.module === "swipes") {
    await processAiSwipeCommand(intent);
    return;
  }

  if (intent.module === "rpSpends") {
    await processAiRpCommand(intent);
    return;
  }

  if (intent.module === "lounge") {
    await processAiLoungeCommand(intent);
    return;
  }

  await processAiPortfolioCommand(intent);
}

function interpretAiIntent(query) {
  const normalized = normalizeAiText(query);
  const action = detectAiAction(normalized);
  const module = detectAiModule(normalized, action);
  const knowledge = buildAiKnowledgeBase();
  const trainerHint = inferAiTrainerHints(query);
  const cardMatch = resolveCardFromQuery(query, knowledge);

  return {
    rawQuery: query,
    normalizedQuery: normalized,
    action: action !== "search" ? action : (trainerHint.action || action),
    module: module || trainerHint.module || "portfolio",
    card: cardMatch.card || trainerHint.card || null,
    cardCandidates: cardMatch.candidates,
    amount: extractAmount(query) || trainerHint.amount || 0,
    points: extractPoints(query) || trainerHint.points || 0,
    pointsValue: extractWorthValue(query) || trainerHint.pointsValue || 0,
    category: extractSwipeCategory(query) || trainerHint.category || "",
    swipeType: extractSwipeType(query) || trainerHint.swipeType || "",
    financialYear: extractFinancialYear(query) || trainerHint.financialYear || "",
    spentFor: extractSpentFor(query, cardMatch.card || trainerHint.card, knowledge) || trainerHint.spentFor || "",
    productName: extractProductName(query, cardMatch.card || trainerHint.card, knowledge) || trainerHint.productName || "",
    purchasedFrom: extractPurchasedFrom(query, cardMatch.card || trainerHint.card, knowledge) || trainerHint.purchasedFrom || "",
    loungeType: extractLoungeType(query) || trainerHint.loungeType || "",
    members: extractMembers(query) || trainerHint.members || 0,
    airport: extractAirport(query, cardMatch.card || trainerHint.card, knowledge) || trainerHint.airport || "",
    knowledge,
    trainerHint,
    queryKind: trainerHint.queryKind || "",
    metric: trainerHint.metric || "",
    intentLabel: trainerHint.intentLabel || "",
    scope: trainerHint.scope || "",
  };
}

function detectAiAction(normalizedQuery) {
  const hasSearchCue = /\b(tell me|show|search|find|list|display|what(?:'s| is)?|how many|how much|where|which|total|balance|remaining|available)\b/.test(normalizedQuery) || /\b(this fy|current fy|this year|current year)\b/.test(normalizedQuery);
  const hasAddCue = /\b(add|log|record|redeem|redeemed|update|edit|change)\b/.test(normalizedQuery);
  if (/\b(update|edit|change)\b/.test(normalizedQuery)) return "update";
  if (/\b(add|log|record|redeem|redeemed)\b/.test(normalizedQuery)) return "add";
  if (hasSearchCue && !hasAddCue) return "search";
  if (/\bswipe\b/.test(normalizedQuery) && /\d/.test(normalizedQuery) && !/\b(total|my|how many|show|search|fee|emi|fy|spend|spends|spent|balance|remaining|available)\b/.test(normalizedQuery)) return "add";
  if (/\blounge\b|\bvisit\b/.test(normalizedQuery) && (/\d+\s*members?\b/.test(normalizedQuery) || /\bworth\b/.test(normalizedQuery) || /\bvalue\b/.test(normalizedQuery)) && !hasSearchCue) return "add";
  if (/\b(points|miles)\b/.test(normalizedQuery) && /\d/.test(normalizedQuery) && !/\b(total|my|how many|show|search|fee|emi|fy|spend|spends|spent|balance|remaining|available)\b/.test(normalizedQuery)) return "add";
  return "search";
}

function detectAiModule(normalizedQuery, action) {
  if (/\b(lounge|visit|airport|golf|restaurant|spa|meet greet|transfer)\b/.test(normalizedQuery)) return "lounge";
  if (/\b(swipe|swipes|spend|spends|spent|emi|full swipe|spent for|business|personal)\b/.test(normalizedQuery)) return "swipes";
  if (/\b(redeem|redeemed|voucher|miles|rp spend|points received|purchased from|product)\b/.test(normalizedQuery)) return "rpSpends";
  if (action === "add" && /\b(points|fee|annual|reward|rewards|membership rewards|mr)\b/.test(normalizedQuery)) return "portfolio";

  if (/\b(fee|annual fee|points|reward|rewards|membership rewards|mr|portfolio|benefit|card)\b/.test(normalizedQuery)) return "portfolio";
  return "portfolio";
}

function normalizeAiText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\bamex\b/g, "american express")
    .replace(/\bmr\b/g, "membership rewards")
    .replace(/\brewards?\b/g, "points")
    .replace(/\bcc\b/g, "credit card")
    .replace(/\bfy\s*([0-9]{2})\s*[-/ ]\s*([0-9]{2})\b/g, "fy $1 $2")
    .replace(/\bfy\s*([0-9]{2})\b/g, "fy $1 26")
    .replace(/[^a-z0-9.\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAmount(text) {
  const match = String(text || "").match(/(?:^|[^\d])(\d[\d,]*(?:\.\d+)?)(?!\d)/);
  return match ? toNumber(match[1].replace(/,/g, "")) : 0;
}

function extractPoints(text) {
  const normalized = normalizeAiText(text);
  const worthMatch = normalized.match(/\bworth\s+(\d[\d,]*(?:\.\d+)?)\b/);
  if (worthMatch) return toNumber(worthMatch[1].replace(/,/g, ""));
  return extractAmount(text);
}

function extractWorthValue(text) {
  const normalized = normalizeAiText(text);
  const worthMatch = normalized.match(/\bworth\s+(\d[\d,]*(?:\.\d+)?)\b/);
  return worthMatch ? toNumber(worthMatch[1].replace(/,/g, "")) : 0;
}

function extractFinancialYear(text) {
  const parsed = parseFinancialYearLabel(text);
  if (parsed) return parsed;

  const normalized = normalizeAiText(text);
  if (/\b(this fy|current fy|this year|current year)\b/.test(normalized)) {
    return getCurrentFinancialYearLabel();
  }

  const match = String(text || "").match(/\bfy\s*(\d{2})\b/i);
  if (!match) return "";
  const start = match[1];
  const end = String((Number(start) + 1) % 100).padStart(2, "0");
  return `FY ${start}-${end}`;
}

function extractSwipeCategory(text) {
  const normalized = normalizeAiText(text);
  if (/\bpersonal\b/.test(normalized)) return "personal";
  if (/\bbusiness\b/.test(normalized)) return "business";
  return "";
}

function extractSwipeType(text) {
  const normalized = normalizeAiText(text);
  if (/\bemi\b/.test(normalized)) return "E";
  if (/\bfull swipe\b/.test(normalized) || /\bfull\b/.test(normalized)) return "F";
  return "";
}

function extractMembers(text) {
  const normalized = normalizeAiText(text);
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*members?\b/);
  return match ? Math.max(1, Math.round(toNumber(match[1]))) : 0;
}

function extractLoungeType(text) {
  const normalized = normalizeAiText(text);
  if (/\binternational\b/.test(normalized)) return "International";
  if (/\bdomestic\b/.test(normalized)) return "Domestic";
  if (/\bgolf\b/.test(normalized)) return normalized.includes("international") ? "International_Golf" : "Domestic_Golf";
  if (/\brestaurant\b/.test(normalized)) return normalized.includes("international") ? "International_Restaurant" : "Domestic_Restaurant";
  if (/\bspa\b/.test(normalized)) return normalized.includes("international") ? "International_Spa" : "Domestic_Spa";
  if (/\bmeet greet\b/.test(normalized)) return "Meet_Greet";
  if (/\btransfer\b/.test(normalized)) return "Airport_Transfer";
  return "";
}

function extractResidualText(text, patterns) {
  let residual = ` ${String(text || "").trim()} `;
  patterns.forEach((pattern) => {
    residual = residual.replace(pattern, " ");
  });
  return residual.replace(/\s+/g, " ").trim();
}

function buildAiKnowledgeBase() {
  const phrases = [];
  const tokens = new Set();
  const tokenStopwords = new Set([
    "bank",
    "card",
    "credit",
    "debit",
    "finance",
    "financial",
    "limited",
    "ltd",
    "company",
    "co",
    "india",
    "indian",
    "visa",
    "mastercard",
    "express",
    "american",
    "reward",
    "rewards",
    "points",
    "membership",
    "cardholder",
  ]);
  const add = (value) => {
    const text = String(value || "").trim();
    if (!text) return;
    phrases.push(text);
    normalizeAiText(text)
      .split(" ")
      .filter((token) => token.length >= 3 && !tokenStopwords.has(token))
      .forEach((token) => tokens.add(token));
  };

  state.cards.forEach((card) => {
    add(card.name);
    add(card.issuer);
    add(formatCardName(card));
  });

  state.swipes.forEach((swipe) => {
    add(swipe.spentFor);
  });

  state.rpSpends.forEach((rpSpend) => {
    add(rpSpend.productName);
    add(rpSpend.purchasedFrom);
  });

  state.loungeVisits.forEach((visit) => {
    add(visit.airport);
    add(visit.loungeType);
  });

  return {
    phrases: Array.from(new Set(phrases))
      .sort((a, b) => b.length - a.length),
    tokens: Array.from(tokens)
      .sort((a, b) => b.length - a.length),
  };
}

function normalizeAiTrainer(trainer) {
  const examples = Array.isArray(trainer?.examples)
    ? trainer.examples
        .map((example) => ({
          query: String(example?.query || "").trim(),
          normalizedQuery: String(example?.normalizedQuery || normalizeAiText(example?.query || "")).trim(),
          action: String(example?.action || "").trim(),
          module: String(example?.module || "").trim(),
          queryKind: String(example?.queryKind || "").trim(),
          metric: String(example?.metric || "").trim(),
          intentLabel: String(example?.intentLabel || "").trim(),
          scope: String(example?.scope || "").trim(),
          cardId: String(example?.cardId || "").trim(),
          cardLabel: String(example?.cardLabel || "").trim(),
          category: String(example?.category || "").trim(),
          swipeType: String(example?.swipeType || "").trim(),
          financialYear: String(example?.financialYear || "").trim(),
          spentFor: String(example?.spentFor || "").trim(),
          productName: String(example?.productName || "").trim(),
          purchasedFrom: String(example?.purchasedFrom || "").trim(),
          loungeType: String(example?.loungeType || "").trim(),
          airport: String(example?.airport || "").trim(),
          members: toNumber(example?.members),
          points: toNumber(example?.points),
          pointsValue: toNumber(example?.pointsValue),
          amount: toNumber(example?.amount),
          createdAt: example?.createdAt || new Date().toISOString(),
        }))
        .filter((example) => example.normalizedQuery)
    : [];

  return {
    examples: examples.slice(-200),
    updatedAt: trainer?.updatedAt || "",
  };
}

function scoreAiTrainerExample(normalizedQuery, example) {
  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const exampleTokens = example.normalizedQuery.split(" ").filter(Boolean);
  const querySet = new Set(queryTokens);
  let score = 0;

  if (!normalizedQuery || !example.normalizedQuery) return 0;
  if (normalizedQuery === example.normalizedQuery) score += 10;
  if (normalizedQuery.includes(example.normalizedQuery) || example.normalizedQuery.includes(normalizedQuery)) score += 5;

  exampleTokens.forEach((token) => {
    if (querySet.has(token)) score += 1;
  });

  if (example.cardLabel && normalizedQuery.includes(normalizeAiText(example.cardLabel))) score += 2;
  if (example.intentLabel && normalizedQuery.includes(normalizeAiText(example.intentLabel))) score += 3;
  if (example.scope && normalizedQuery.includes(normalizeAiText(example.scope))) score += 1;
  if (example.spentFor && normalizedQuery.includes(normalizeAiText(example.spentFor))) score += 2;
  if (example.productName && normalizedQuery.includes(normalizeAiText(example.productName))) score += 2;
  if (example.airport && normalizedQuery.includes(normalizeAiText(example.airport))) score += 2;
  if (example.loungeType && normalizedQuery.includes(normalizeAiText(example.loungeType))) score += 1;
  if (example.financialYear && normalizedQuery.includes(normalizeAiText(example.financialYear))) score += 1;
  if (example.category && normalizedQuery.includes(normalizeAiText(example.category))) score += 1;
  if (example.swipeType && normalizedQuery.includes(normalizeAiText(example.swipeType === "E" ? "emi" : "full swipe"))) score += 1;

  return score;
}

function inferAiTrainerHints(query, trainer = state.aiTrainer) {
  const normalizedQuery = normalizeAiText(query);
  const examples = Array.isArray(trainer?.examples) ? trainer.examples : [];

  if (!normalizedQuery || !examples.length) {
    return { confidence: 0 };
  }

  const best = examples
    .map((example) => ({
      ...example,
      score: scoreAiTrainerExample(normalizedQuery, example),
    }))
    .sort((a, b) => b.score - a.score)[0];

  if (!best || best.score < 6) {
    return { confidence: best?.score || 0 };
  }

  const card = best.cardId ? getCardById(best.cardId) : findCardByLabel(best.cardLabel);

  return {
    confidence: best.score,
    action: best.action || "",
    module: best.module || "",
    queryKind: best.queryKind || "",
    metric: best.metric || "",
    intentLabel: best.intentLabel || "",
    scope: best.scope || "",
    card,
    cardId: best.cardId || card?.id || "",
    cardLabel: best.cardLabel || (card ? formatCardName(card) : ""),
    category: best.category || "",
    swipeType: best.swipeType || "",
    financialYear: best.financialYear || "",
    spentFor: best.spentFor || "",
    productName: best.productName || "",
    purchasedFrom: best.purchasedFrom || "",
    loungeType: best.loungeType || "",
    airport: best.airport || "",
    members: best.members || 0,
    points: best.points || 0,
    pointsValue: best.pointsValue || 0,
    amount: best.amount || 0,
  };
}

function recordAiTrainingExample(resolved, savedRecord) {
  const query = String(resolved?.rawQuery || "").trim();
  if (!query) return;

  const normalizedQuery = normalizeAiText(query);
  if (!normalizedQuery) return;

  const card = resolved.card || (savedRecord?.cardId ? getCardById(savedRecord.cardId) : null);
  const example = normalizeAiTrainer({
    examples: [
      {
        query,
        normalizedQuery,
        action: resolved.action || "",
        module: resolved.module || "",
        cardId: card?.id || resolved.cardId || savedRecord?.cardId || "",
        cardLabel: card ? formatCardName(card) : resolved.cardLabel || "",
        category: normalizeSwipeCategory(resolved.category || savedRecord?.category || ""),
        swipeType: resolved.swipeType || savedRecord?.type || "",
        financialYear: normalizeFinancialYear(resolved.financialYear || savedRecord?.financialYear || ""),
        spentFor: String(resolved.spentFor || savedRecord?.spentFor || "").trim(),
        productName: String(resolved.productName || savedRecord?.productName || "").trim(),
        purchasedFrom: String(resolved.purchasedFrom || savedRecord?.purchasedFrom || "").trim(),
        loungeType: String(resolved.loungeType || savedRecord?.loungeType || "").trim(),
        airport: String(resolved.airport || savedRecord?.airport || "").trim(),
        members: toNumber(resolved.members || savedRecord?.members),
        points: toNumber(resolved.points || savedRecord?.points),
        pointsValue: toNumber(resolved.pointsValue || savedRecord?.pointsValue),
        amount: toNumber(resolved.amount || savedRecord?.amount),
        createdAt: new Date().toISOString(),
      },
    ],
    updatedAt: new Date().toISOString(),
  });

  const key = `${example.examples[0].normalizedQuery}|${example.examples[0].action}|${example.examples[0].module}`;
  const existingIndex = state.aiTrainer.examples.findIndex((item) => `${item.normalizedQuery}|${item.action}|${item.module}` === key);
  if (existingIndex >= 0) {
    state.aiTrainer.examples[existingIndex] = example.examples[0];
  } else {
    state.aiTrainer.examples.push(example.examples[0]);
  }

  state.aiTrainer.examples = state.aiTrainer.examples
    .slice(-200);
  state.aiTrainer.updatedAt = example.updatedAt;
}

function getAiSuggestedSpentFor(card, category) {
  const targetCategory = normalizeSwipeCategory(category);
  const counts = new Map();

  state.swipes.forEach((swipe) => {
    if (targetCategory && normalizeSwipeCategory(swipe.category) !== targetCategory) return;
    if (card && swipe.cardId !== card.id) return;
    const spentFor = String(swipe.spentFor || "").trim();
    if (!spentFor) return;

    const key = normalizeAiText(spentFor);
    const entry = counts.get(key) || { text: spentFor, count: 0 };
    entry.count += 1;
    if (spentFor.length > entry.text.length) {
      entry.text = spentFor;
    }
    counts.set(key, entry);
  });

  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
    .slice(0, 6)
    .map((entry) => entry.text);
}

function stripKnownPhrases(text, phrases) {
  let output = String(text || "");
  (phrases || []).forEach((phrase) => {
    if (!phrase) return;
    output = output.replace(new RegExp(`\\b${escapeRegex(phrase)}\\b`, "gi"), " ");
  });
  return output.replace(/\s+/g, " ").trim();
}

function normalizeAiFreeText(text, card, knowledge = buildAiKnowledgeBase()) {
  return cleanAiResidual(stripKnownPhrases(text, [
    card?.name,
    card?.issuer,
    formatCardName(card),
    ...(knowledge?.phrases || []),
    ...(knowledge?.tokens || []),
  ]));
}

function cleanAiResidual(text) {
  return String(text || "")
    .replace(/\b(add|update|edit|change|record|log|search|find|show|my|the|a|an|for|of|to|in|on|and)\b/gi, " ")
    .replace(/\b(swipe|swipes|emi|full swipe|business|personal|lounge|visit|airport|golf|restaurant|spa|meet greet|transfer|product|purchase|purchased from|rp spend|reward spend|redeem|redeemed|points|miles|fee|annual fee|membership rewards|mr|card|bank|inr|rs|rupee|rupees|usd|eur|gbp|cad|aud|sgd)\b/gi, " ")
    .replace(/\bfy\s*\d{2}(?:\s*[-/ ]\s*\d{2})?\b/gi, " ")
    .replace(/\d[\d,]*(?:\.\d+)?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSpentFor(text, card, knowledge = buildAiKnowledgeBase()) {
  const normalized = normalizeAiText(text);
  const explicit = normalized.match(/\bspent for\s+(.+)$/);
  const sourceText = explicit ? explicit[1] : text;
  const residual = stripKnownPhrases(sourceText, [
    card?.name,
    card?.issuer,
    formatCardName(card),
    ...(knowledge?.phrases || []),
  ]);
  const truncated = residual.replace(/\b(?:inr|rs|rupees?|usd|eur|gbp|cad|aud|sgd)\b.*$/i, " ")
    .replace(/\b(?:fy\s*\d{2}(?:\s*[-/ ]\s*\d{2})?)\b.*$/i, " ")
    .replace(/\b(?:card|bank|swipe|emi|business|personal)\b.*$/i, " ");

  return cleanAiResidual(extractResidualText(truncated, [
    /\b(spent for)\b/gi,
    /\b(add|update|edit|change|record|log|swipe|emi|full swipe|business|personal|FY\s*\d{2}(?:[-/ ]\d{2})?)\b/gi,
  ]));
}

function extractProductName(text, card, knowledge = buildAiKnowledgeBase()) {
  const residual = stripKnownPhrases(text, [
    card?.name,
    card?.issuer,
    formatCardName(card),
    ...(knowledge?.phrases || []),
  ]);
  return cleanAiResidual(extractResidualText(residual, [
    /\b(add|update|edit|change|record|log|redeem|redeemed|points|miles|worth|purchase|purchased from|rp spend|voucher)\b/gi,
    /\d[\d,]*(?:\.\d+)?/g,
    /\bFY\s*\d{2}(?:[-/ ]\d{2})?\b/gi,
  ]));
}

function extractPurchasedFrom(text, card, knowledge = buildAiKnowledgeBase()) {
  const normalized = normalizeAiText(text);
  const match = normalized.match(/\bpurchased from\s+(.+)$/);
  if (!match) return "";
  return cleanAiResidual(stripKnownPhrases(match[1], [card?.name, card?.issuer, formatCardName(card), ...(knowledge?.phrases || [])]));
}

function extractAirport(text, card, knowledge = buildAiKnowledgeBase()) {
  const residual = stripKnownPhrases(text, [
    card?.name,
    card?.issuer,
    formatCardName(card),
    ...(knowledge?.phrases || []),
  ]);
  return cleanAiResidual(extractResidualText(residual, [
    /\b(add|update|edit|change|record|log|lounge|visit|airport|golf|restaurant|spa|meet greet|transfer|domestic|international)\b/gi,
    /\d[\d,]*(?:\.\d+)?\s*members?\b/gi,
    /\d[\d,]*(?:\.\d+)?/g,
  ]));
}

function resolveCardFromQuery(query, knowledge = buildAiKnowledgeBase()) {
  const normalized = normalizeAiText(query);
  const cards = state.cards.slice();
  if (!cards.length) {
    return { card: null, candidates: [] };
  }

  const candidatePhrases = (knowledge?.phrases || []).filter((phrase) => String(phrase || "").length >= 3);
  const nameMatches = cards.filter((card) => {
    const cardName = normalizeAiText(card.name);
    const issuerName = normalizeAiText(card.issuer);
    return (cardName && normalized.includes(cardName)) || (issuerName && normalized.includes(issuerName));
  });
  if (nameMatches.length === 1) {
    return { card: nameMatches[0], candidates: nameMatches };
  }

  if (nameMatches.length > 1) {
    return { card: nameMatches[0], candidates: nameMatches };
  }

  return {
    card: null,
    candidates: cards
      .map((card) => {
        const matchingKnownPhrases = candidatePhrases.filter((phrase) => normalizeAiText(formatCardName(card)).includes(normalizeAiText(phrase)));
        return {
          card,
          score: scoreAiText(`${formatCardName(card)} ${card.issuer || ""} ${matchingKnownPhrases.join(" ")}`, query),
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || formatCardName(a.card).localeCompare(formatCardName(b.card)))
      .map((item) => item.card)
      .slice(0, 6),
  };
}

function scoreAiText(text, query) {
  const normalizedText = normalizeAiText(text);
  const normalizedQuery = normalizeAiText(query);
  if (!normalizedText || !normalizedQuery) return 0;

  let score = normalizedText.includes(normalizedQuery) ? 8 : 0;
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  tokens.forEach((token) => {
    if (normalizedText.includes(token)) score += 1;
  });

  const numericQuery = normalizedQuery.replace(/[^0-9.]/g, "");
  if (numericQuery && normalizedText.includes(numericQuery)) {
    score += 2;
  }

  return score;
}

function buildAiSearchResults(query) {
  const cards = state.cards
    .map((card) => {
      const totals = getCardTotals(card);
      const text = [
        "card portfolio",
        card.name,
        card.issuer,
        card.notes,
        formatCardName(card),
        formatMoney(totals.fees),
        formatPoints(totals.points),
        formatMoney(totals.benefits),
        formatMoney(totals.net),
      ].join(" ");
      return { card, totals, score: scoreAiText(text, query) };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.totals.points - a.totals.points)
    .slice(0, 6);

  const swipes = state.swipes
    .map((swipe) => {
      const card = getCardById(swipe.cardId);
      const text = [
        "swipe",
        formatCardName(card),
        swipe.category,
        swipe.type === "E" ? "emi" : "full swipe",
        swipe.financialYear,
        swipe.spentFor,
        formatMoney(swipe.amount),
      ].join(" ");
      return { swipe, card, score: scoreAiText(text, query) };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || getSwipeCreatedTime(b.swipe) - getSwipeCreatedTime(a.swipe))
    .slice(0, 6);

  const rpSpends = state.rpSpends
    .map((rpSpend) => {
      const card = getCardById(rpSpend.cardId);
      const text = [
        "rp spend reward spend redemption",
        formatCardName(card),
        rpSpend.productName,
        rpSpend.purchasedFrom,
        rpSpend.points,
        rpSpend.pointsValue,
        rpSpend.redemptionCharges,
        rpSpend.cardPaid,
        rpSpend.voucherPaid,
      ].join(" ");
      return { rpSpend, card, score: scoreAiText(text, query) };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || getRpSpendPaidValue(b.rpSpend) - getRpSpendPaidValue(a.rpSpend))
    .slice(0, 6);

  const loungeVisits = state.loungeVisits
    .map((visit) => {
      const card = getCardById(visit.cardId);
      const text = [
        "lounge visit",
        formatCardName(card),
        visit.loungeType,
        visit.airport,
        visit.members,
        visit.perPerson,
        visit.total,
        visit.date,
      ].join(" ");
      return { visit, card, score: scoreAiText(text, query) };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || toNumber(b.visit.total) - toNumber(a.visit.total))
    .slice(0, 6);

  return { cards, swipes, rpSpends, loungeVisits };
}

async function processAiReadOnlyCommand(intent) {
  const report = await resolveAiReadOnlyIntent(intent);
  if (!report) {
    showAiSearchResults(intent.rawQuery);
    return;
  }

  recordAiReadOnlyTrainingExample(intent, report);
  try {
    await saveState();
  } catch (error) {
    console.warn("Could not persist read-only AI training example", error);
  }
  showAiReadOnlyResults(report);
}

async function resolveAiReadOnlyIntent(intent) {
  const rawQuery = String(intent?.rawQuery || "").trim();
  const normalizedQuery = String(intent?.normalizedQuery || normalizeAiText(rawQuery)).trim();
  const trainerHint = intent?.trainerHint || {};
  const currentFY = getCurrentFinancialYearLabel();
  const detectedFY = extractFinancialYear(rawQuery) || trainerHint.financialYear || "";
  const requestedCurrentFY = /\b(this fy|current fy|this year|current year)\b/.test(normalizedQuery);
  const financialYear = detectedFY
    ? normalizeFinancialYear(detectedFY)
    : (requestedCurrentFY ? currentFY : "");
  const card = intent?.card || trainerHint.card || null;
  const swipeCategory = extractSwipeCategory(rawQuery) || trainerHint.category || "";
  const swipeType = extractSwipeType(rawQuery) || trainerHint.swipeType || "";
  const intentLabelCard = card ? formatCardName(card) : "";

  if (looksLikeRpReadOnlyQuery(normalizedQuery)) {
    return buildRpReadOnlyReport({
      intent,
      card,
      intentLabelCard,
      normalizedQuery,
    });
  }

  if (looksLikeLoungeReadOnlyQuery(normalizedQuery)) {
    return buildLoungeReadOnlyReport({
      intent,
      card,
      intentLabelCard,
      normalizedQuery,
      financialYear,
    });
  }

  if (looksLikePortfolioReadOnlyQuery(normalizedQuery)) {
    return buildPortfolioReadOnlyReport({
      intent,
      card,
      intentLabelCard,
      normalizedQuery,
      financialYear,
    });
  }

  if (looksLikeSwipeReadOnlyQuery(normalizedQuery)) {
    const requiresCard = /\b(card|specific card|this card|that card|my card)\b/.test(normalizedQuery) && !card;
    let resolvedCard = card;

    if (requiresCard) {
      resolvedCard = await promptForCard(intent, "Which card?");
      if (!resolvedCard) return null;
    }

    return buildSwipeReadOnlyReport({
      intent,
      card: resolvedCard,
      intentLabelCard: resolvedCard ? formatCardName(resolvedCard) : intentLabelCard,
      normalizedQuery,
      financialYear,
      swipeCategory,
      swipeType,
    });
  }

  return null;
}

function looksLikePortfolioReadOnlyQuery(normalizedQuery) {
  return /\b(annual fee|card fee|membership fee|total points|unredeemed points|membership rewards|mr points|points available|benefits?|net profit|portfolio)\b/.test(normalizedQuery);
}

function looksLikeSwipeReadOnlyQuery(normalizedQuery) {
  return /\b(swipe|swipes|spend|spends|spent|emi|full swipe|business spends?|personal spends?)\b/.test(normalizedQuery);
}

function looksLikeRpReadOnlyQuery(normalizedQuery) {
  return /\b(rp spend|reward points? spent|reward spend|points used|points value|redeem|redeemed|voucher|purchase)\b/.test(normalizedQuery);
}

function looksLikeLoungeReadOnlyQuery(normalizedQuery) {
  return /\b(lounge|visit|visits|airport|golf|restaurant|spa|meet greet|transfer|benefits?)\b/.test(normalizedQuery);
}

function buildPortfolioReadOnlyReport({ intent, card, intentLabelCard, normalizedQuery }) {
  const cardTotals = card ? getCardTotals(card) : null;
  const totals = card ? cardTotals : getTotals(state.cards);
  const hasFeeCue = /\b(annual fee|card fee|membership fee|fee)\b/.test(normalizedQuery);
  const hasBenefitCue = /\b(benefit|benefits|cashback|credit)\b/.test(normalizedQuery) && !hasFeeCue;
  const hasNetCue = /\b(net|profit|pl|p\/l)\b/.test(normalizedQuery);
  const hasPointsCue = /\b(total points|unredeemed points|points available|membership rewards|mr points|\bpoints\b|\bmiles\b)\b/.test(normalizedQuery) && !hasFeeCue && !hasBenefitCue && !hasNetCue;
  const metricKey = hasFeeCue ? "portfolio.fees" : hasBenefitCue ? "portfolio.benefits" : hasNetCue ? "portfolio.net" : "portfolio.points";

  let primaryValue = formatPoints(totals.points);
  let primaryMeta = `${state.cards.length} ${state.cards.length === 1 ? "card" : "cards"} in portfolio`;
  let intentLabel = "Total unredeemed points";
  let sectionsHtml = "";

  if (hasFeeCue) {
    primaryValue = formatMoney(totals.fees);
    primaryMeta = card ? `Fee total for ${intentLabelCard}` : "Fee total across all cards";
    intentLabel = card ? `${intentLabelCard} annual fee` : "Total annual fees";
    sectionsHtml = buildPortfolioCardBreakdownHtml(card ? [card] : state.cards, "fees");
  } else if (hasBenefitCue) {
    primaryValue = formatMoney(totals.benefits);
    primaryMeta = card ? `Benefit value for ${intentLabelCard}` : "Benefit value across all cards";
    intentLabel = card ? `${intentLabelCard} benefits` : "Total benefits";
    sectionsHtml = buildPortfolioCardBreakdownHtml(card ? [card] : state.cards, "benefits");
  } else if (hasNetCue) {
    primaryValue = formatMoney(totals.net);
    primaryMeta = card ? `Net for ${intentLabelCard}` : "Net across all cards";
    intentLabel = card ? `${intentLabelCard} net value` : "Portfolio net value";
    sectionsHtml = buildPortfolioCardBreakdownHtml(card ? [card] : state.cards, "net");
  } else if (hasPointsCue) {
    primaryValue = formatPoints(totals.points);
    primaryMeta = card ? `Point total for ${intentLabelCard}` : "Unredeemed points across all cards";
    intentLabel = card ? `${intentLabelCard} total points` : "Total unredeemed points";
    sectionsHtml = buildPortfolioCardBreakdownHtml(card ? [card] : state.cards, "points");
  }

  return {
    title: "Credit Card Portfolio",
    subtitle: card ? `${intentLabelCard}` : "Using existing portfolio totals only",
    metricKey,
    queryKind: "readonly",
    intentLabel,
    scopeLabel: card ? intentLabelCard : "all cards",
    primaryValue,
    primaryMeta,
    interpretation: card ? `Exact portfolio data for ${intentLabelCard}.` : "Exact totals from saved portfolio data.",
    sectionsHtml,
  };
}

function buildSwipeReadOnlyReport({ intent, card, intentLabelCard, normalizedQuery, financialYear, swipeCategory, swipeType }) {
  const category = normalizeSwipeCategory(swipeCategory);
  const type = swipeType === "E" ? "E" : swipeType === "F" ? "F" : "";
  const hasFyCue = Boolean(financialYear);
  const isCurrentFy = /\b(this fy|current fy|this year|current year)\b/.test(normalizedQuery) && !extractFinancialYear(normalizedQuery);
  const effectiveFY = financialYear || (isCurrentFy ? getCurrentFinancialYearLabel() : "");
  const matches = state.swipes.filter((swipe) => {
    if (card && swipe.cardId !== card.id) return false;
    if (effectiveFY && normalizeFinancialYear(swipe.financialYear) !== effectiveFY) return false;
    if (category && normalizeSwipeCategory(swipe.category) !== category) return false;
    if (type && swipe.type !== type) return false;
    return true;
  }).sort((a, b) => getSwipeCreatedTime(b) - getSwipeCreatedTime(a));

  const total = matches.reduce((sum, swipe) => sum + toNumber(swipe.amount), 0);
  const titleParts = [];
  if (intentLabelCard) titleParts.push(intentLabelCard);
  if (category) titleParts.push(category === "business" ? "business" : "personal");
  if (type) titleParts.push(type === "E" ? "EMI" : "full swipe");
  if (effectiveFY) titleParts.push(effectiveFY);
  const intentLabel = titleParts.length ? `${titleParts.join(" ")} spends` : "Total swipe spends";
  const filtersLabel = [
    card ? intentLabelCard : "All cards",
    category ? (category === "business" ? "Business" : "Personal") : "All categories",
    type ? (type === "E" ? "EMI" : "Full swipe") : "All swipe types",
    effectiveFY || (hasFyCue ? financialYear : "All FY"),
  ].filter(Boolean).join(" | ");

  return {
    title: "Swipes",
    subtitle: "Exact spend total from saved swipe records",
    metricKey: "swipes.total",
    queryKind: "readonly",
    intentLabel,
    scopeLabel: filtersLabel,
    primaryValue: formatMoney(total),
    primaryMeta: `${matches.length} matching ${matches.length === 1 ? "swipe" : "swipes"}`,
    interpretation: `Filtered by ${filtersLabel}.`,
    sectionsHtml: buildSwipeBreakdownHtml(matches),
  };
}

function buildRpReadOnlyReport({ intent, card, intentLabelCard, normalizedQuery }) {
  const wantsPointsUsed = /\b(points used|points spent|how many points|total rp points|rp points)\b/.test(normalizedQuery);
  const matches = state.rpSpends
    .filter((rpSpend) => !card || rpSpend.cardId === card.id)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const totalValue = matches.reduce((sum, rpSpend) => sum + getRpSpendPaidValue(rpSpend), 0);
  const totalPoints = matches.reduce((sum, rpSpend) => sum + getRpSpendTotalPoints(rpSpend), 0);

  const intentLabel = wantsPointsUsed
    ? (card ? `${intentLabelCard} RP points used` : "Total RP points used")
    : (card ? `${intentLabelCard} RP spend value` : "Total RP spend value");

  return {
    title: "RP Spends",
    subtitle: "Exact RP spend totals from saved reward spends",
    metricKey: wantsPointsUsed ? "rp.pointsUsed" : "rp.value",
    queryKind: "readonly",
    intentLabel,
    scopeLabel: card ? intentLabelCard : "all RP spends",
    primaryValue: wantsPointsUsed ? formatPoints(totalPoints) : formatMoney(totalValue),
    primaryMeta: wantsPointsUsed
      ? `${matches.length} matching ${matches.length === 1 ? "entry" : "entries"}`
      : `${matches.length} payment row${matches.length === 1 ? "" : "s"}`,
    interpretation: card ? `Filtered to ${intentLabelCard}.` : "Using all saved RP spend records.",
    sectionsHtml: buildRpBreakdownHtml(matches),
  };
}

function buildLoungeReadOnlyReport({ intent, card, intentLabelCard, normalizedQuery, financialYear }) {
  const requestedCurrentFY = /\b(this fy|current fy|this year|current year)\b/.test(normalizedQuery) && !extractFinancialYear(normalizedQuery);
  const effectiveFY = financialYear || (requestedCurrentFY ? getCurrentFinancialYearLabel() : "");
  const matches = state.loungeVisits
    .filter((visit) => {
      if (card && visit.cardId !== card.id) return false;
      if (effectiveFY && getFinancialYearLabelFromDate(visit.date) !== effectiveFY) return false;
      return true;
    })
    .sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));

  const total = matches.reduce((sum, visit) => sum + toNumber(visit.total), 0);
  const intentLabel = card
    ? `${intentLabelCard} lounge benefits`
    : "Total lounge benefits";
  const scopeLabel = [
    card ? intentLabelCard : "All cards",
    effectiveFY || "All dates",
  ].join(" | ");

  return {
    title: "Lounge Benefits",
    subtitle: "Exact lounge value from saved lounge visit records",
    metricKey: "lounge.total",
    queryKind: "readonly",
    intentLabel,
    scopeLabel,
    primaryValue: formatMoney(total),
    primaryMeta: `${matches.length} lounge ${matches.length === 1 ? "visit" : "visits"}`,
    interpretation: effectiveFY ? `Filtered to ${effectiveFY}.` : "Using all saved lounge visit records.",
    sectionsHtml: buildLoungeBreakdownHtml(matches),
  };
}

function buildPortfolioCardBreakdownHtml(cards, field) {
  const rows = (cards || [])
    .map((card) => {
      const totals = getCardTotals(card);
      const valueNumber = field === "fees"
        ? toNumber(totals.fees)
        : field === "benefits"
          ? toNumber(totals.benefits)
          : field === "net"
            ? toNumber(totals.net)
            : toNumber(totals.points);
      if (field === "net" ? valueNumber === 0 : valueNumber <= 0) return "";

      const value = field === "fees"
        ? formatMoney(totals.fees)
        : field === "benefits"
          ? formatMoney(totals.benefits)
          : field === "net"
            ? formatMoney(totals.net)
            : formatPoints(totals.points);
      const meta = field === "fees"
        ? `Fees ${formatMoney(totals.fees)} | Benefits ${formatMoney(totals.benefits)} | Net ${formatMoney(totals.net)}`
        : field === "benefits"
          ? `Benefits ${formatMoney(totals.benefits)} | Points ${formatPoints(totals.points)}`
          : field === "net"
            ? `Net ${formatMoney(totals.net)} | Fees ${formatMoney(totals.fees)}`
            : `Points ${formatPoints(totals.points)} | Fees ${formatMoney(totals.fees)}`;
      return `
        <div class="ai-result-card">
          <strong>${escapeHtml(formatCardName(card))}</strong>
          <div class="ai-result-meta">${escapeHtml(meta)}</div>
          <div class="ai-result-meta">${escapeHtml(value)}</div>
          <div class="row-actions">
            <button type="button" class="ghost-button" data-ai-open="card-edit" data-card-id="${escapeAttribute(card.id)}">Open card</button>
          </div>
        </div>
      `;
    })
    .join("");

  return rows ? `
    <section class="ai-search-section">
      <h4>Card Breakdown</h4>
      <div class="ai-result-list">
        ${rows}
      </div>
    </section>
  ` : "";
}

function buildSwipeBreakdownHtml(swipes) {
  if (!swipes.length) {
    return `
      <section class="ai-search-section">
        <div class="empty-state">
          <h3>No matching swipes</h3>
          <p class="empty-copy">The filters are valid, but there are no saved swipe records for them.</p>
        </div>
      </section>
    `;
  }

  return `
    <section class="ai-search-section">
      <h4>Matching Swipes</h4>
      <div class="ai-result-list">
        ${swipes.slice(0, 8).map((swipe) => {
          const card = getCardById(swipe.cardId);
          return `
            <div class="ai-result-card">
              <strong>${escapeHtml(formatCardName(card))}</strong>
              <div class="ai-result-meta">${escapeHtml(swipe.financialYear)} | ${escapeHtml(normalizeSwipeCategory(swipe.category) === "personal" ? "Personal" : "Business")} | ${escapeHtml(swipe.type === "E" ? "EMI" : "Full Swipe")}</div>
              <div class="ai-result-meta">${escapeHtml(swipe.spentFor || "No spent-for note")} | ${escapeHtml(formatMoney(swipe.amount))}</div>
              <div class="row-actions">
                <button type="button" class="ghost-button" data-ai-open="swipe-edit" data-swipe-id="${escapeAttribute(swipe.id)}">Open swipe</button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function buildRpBreakdownHtml(rpSpends) {
  if (!rpSpends.length) {
    return `
      <section class="ai-search-section">
        <div class="empty-state">
          <h3>No matching RP spends</h3>
          <p class="empty-copy">There are no saved RP spend records for the selected filter.</p>
        </div>
      </section>
    `;
  }

  return `
    <section class="ai-search-section">
      <h4>Matching RP Spends</h4>
      <div class="ai-result-list">
        ${rpSpends.slice(0, 8).map((rpSpend) => {
          const card = getCardById(rpSpend.cardId);
          return `
            <div class="ai-result-card">
              <strong>${escapeHtml(formatCardName(card))}</strong>
              <div class="ai-result-meta">${escapeHtml(rpSpend.productName || "Reward spend")} | ${escapeHtml(rpSpend.purchasedFrom || "Card / voucher")}</div>
              <div class="ai-result-meta">Points ${escapeHtml(formatPoints(getRpSpendTotalPoints(rpSpend)))} | Value ${escapeHtml(formatMoney(getRpSpendPaidValue(rpSpend)))}</div>
              <div class="row-actions">
                <button type="button" class="ghost-button" data-ai-open="rp-edit" data-rp-id="${escapeAttribute(rpSpend.id)}">Open RP spend</button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function buildLoungeBreakdownHtml(visits) {
  if (!visits.length) {
    return `
      <section class="ai-search-section">
        <div class="empty-state">
          <h3>No matching lounge visits</h3>
          <p class="empty-copy">There are no saved lounge visit records for the selected filter.</p>
        </div>
      </section>
    `;
  }

  return `
    <section class="ai-search-section">
      <h4>Matching Lounge Visits</h4>
      <div class="ai-result-list">
        ${visits.slice(0, 8).map((visit) => {
          const card = getCardById(visit.cardId);
          return `
            <div class="ai-result-card">
              <strong>${escapeHtml(formatCardName(card))}</strong>
              <div class="ai-result-meta">${escapeHtml(visit.loungeType || "Lounge")} | ${escapeHtml(visit.airport || "Unknown airport")} | ${escapeHtml(String(visit.members || 1))} members</div>
              <div class="ai-result-meta">${escapeHtml(formatMoney(visit.total))} total${visit.date ? ` | ${escapeHtml(formatDateTime(visit.date))}` : ""}</div>
              <div class="row-actions">
                <button type="button" class="ghost-button" data-ai-open="lounge-edit" data-lounge-id="${escapeAttribute(visit.id)}">Open visit</button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function showAiReadOnlyResults(report) {
  openAiModal({
    mode: "search",
    title: report.title || "AI Search",
    subtitle: report.subtitle || "Exact results from application data",
    bodyHtml: `
      <div class="ai-search-results">
        <section class="ai-search-section">
          <h4>Interpreted Query</h4>
          <div class="ai-result-card">
            <strong>${escapeHtml(report.intentLabel || report.title || "Read-only query")}</strong>
            <div class="ai-result-meta">${escapeHtml(report.interpretation || "Using existing application data only.")}</div>
            <div class="ai-result-meta">${escapeHtml(report.scopeLabel || "")}</div>
          </div>
        </section>
        <section class="ai-search-section">
          <h4>Exact Result</h4>
          <div class="ai-result-card">
            <strong style="font-size: 1.4rem;">${escapeHtml(report.primaryValue || "0")}</strong>
            <div class="ai-result-meta">${escapeHtml(report.primaryMeta || "")}</div>
          </div>
        </section>
        ${report.sectionsHtml || ""}
      </div>
    `,
    footerHtml: `<button type="button" id="aiSearchCloseBtn" class="ghost-button">Close</button>`,
  });

  document.getElementById("aiSearchCloseBtn")?.addEventListener("click", () => closeAiModal());
}

function recordAiReadOnlyTrainingExample(intent, report) {
  const query = String(intent?.rawQuery || "").trim();
  if (!query) return;

  const normalizedQuery = normalizeAiText(query);
  if (!normalizedQuery) return;

  const card = intent?.card || null;
  const example = normalizeAiTrainer({
    examples: [
      {
        query,
        normalizedQuery,
        action: "search",
        module: intent?.module || "",
        queryKind: "readonly",
        metric: report?.metricKey || "",
        intentLabel: report?.intentLabel || "",
        scope: report?.scopeLabel || "",
        cardId: card?.id || "",
        cardLabel: card ? formatCardName(card) : "",
        category: normalizeSwipeCategory(intent?.category || ""),
        swipeType: intent?.swipeType || "",
        financialYear: String(intent?.financialYear || "").trim(),
        points: toNumber(intent?.points),
        pointsValue: toNumber(intent?.pointsValue),
        amount: toNumber(intent?.amount),
        createdAt: new Date().toISOString(),
      },
    ],
    updatedAt: new Date().toISOString(),
  });

  const key = `${example.examples[0].normalizedQuery}|${example.examples[0].action}|${example.examples[0].module}|${example.examples[0].metric}`;
  const existingIndex = state.aiTrainer.examples.findIndex((item) => `${item.normalizedQuery}|${item.action}|${item.module}|${item.metric || ""}` === key);
  if (existingIndex >= 0) {
    state.aiTrainer.examples[existingIndex] = example.examples[0];
  } else {
    state.aiTrainer.examples.push(example.examples[0]);
  }

  state.aiTrainer.examples = state.aiTrainer.examples.slice(-200);
  state.aiTrainer.updatedAt = example.updatedAt;
}

function showAiSearchResults(query) {
  const results = buildAiSearchResults(query);
  const totalResults = results.cards.length + results.swipes.length + results.rpSpends.length + results.loungeVisits.length;

  const sections = [];

  if (results.cards.length) {
    sections.push(`
      <section class="ai-search-section">
        <h4>Credit Card Portfolio</h4>
        <div class="ai-result-list">
          ${results.cards.map(({ card, totals }) => `
            <div class="ai-result-card">
              <strong>${escapeHtml(formatCardName(card))}</strong>
              <div class="ai-result-meta">Fee ${escapeHtml(formatMoney(totals.fees))} | Points ${escapeHtml(formatPoints(totals.points))} | Benefits ${escapeHtml(formatMoney(totals.benefits))} | Net ${escapeHtml(formatMoney(totals.net))}</div>
              <div class="row-actions">
                <button type="button" class="ghost-button" data-ai-open="card-edit" data-card-id="${escapeAttribute(card.id)}">Open card</button>
              </div>
            </div>
          `).join("")}
        </div>
      </section>
    `);
  }

  if (results.swipes.length) {
    sections.push(`
      <section class="ai-search-section">
        <h4>Swipes</h4>
        <div class="ai-result-list">
          ${results.swipes.map(({ swipe, card }) => `
            <div class="ai-result-card">
              <strong>${escapeHtml(formatCardName(card))}</strong>
              <div class="ai-result-meta">${escapeHtml(swipe.financialYear)} | ${escapeHtml(normalizeSwipeCategory(swipe.category) === "personal" ? "Personal" : "Business")} | ${escapeHtml(swipe.type === "E" ? "EMI" : "Full Swipe")} | ${escapeHtml(swipe.spentFor || "No spent-for note")}</div>
              <div class="ai-result-meta">${escapeHtml(formatMoney(swipe.amount))}</div>
              <div class="row-actions">
                <button type="button" class="ghost-button" data-ai-open="swipe-edit" data-swipe-id="${escapeAttribute(swipe.id)}">Open swipe</button>
              </div>
            </div>
          `).join("")}
        </div>
      </section>
    `);
  }

  if (results.rpSpends.length) {
    sections.push(`
      <section class="ai-search-section">
        <h4>RP Spends</h4>
        <div class="ai-result-list">
          ${results.rpSpends.map(({ rpSpend, card }) => `
            <div class="ai-result-card">
              <strong>${escapeHtml(formatCardName(card))}</strong>
              <div class="ai-result-meta">${escapeHtml(rpSpend.productName || "Reward spend")} | ${escapeHtml(rpSpend.purchasedFrom || "Card / voucher")} </div>
              <div class="ai-result-meta">Points ${escapeHtml(formatPoints(getRpSpendTotalPoints(rpSpend)))} | Value ${escapeHtml(formatMoney(getRpSpendPaidValue(rpSpend)))}</div>
              <div class="row-actions">
                <button type="button" class="ghost-button" data-ai-open="rp-edit" data-rp-id="${escapeAttribute(rpSpend.id)}">Open RP spend</button>
              </div>
            </div>
          `).join("")}
        </div>
      </section>
    `);
  }

  if (results.loungeVisits.length) {
    sections.push(`
      <section class="ai-search-section">
        <h4>Lounge Visits</h4>
        <div class="ai-result-list">
          ${results.loungeVisits.map(({ visit, card }) => `
            <div class="ai-result-card">
              <strong>${escapeHtml(formatCardName(card))}</strong>
              <div class="ai-result-meta">${escapeHtml(visit.loungeType || "Lounge")} | ${escapeHtml(visit.airport || "Unknown airport")} | ${escapeHtml(String(visit.members || 1))} members</div>
              <div class="ai-result-meta">${escapeHtml(formatMoney(visit.total))} total | ${escapeHtml(visit.date ? formatDateTime(visit.date) : "")}</div>
              <div class="row-actions">
                <button type="button" class="ghost-button" data-ai-open="lounge-edit" data-lounge-id="${escapeAttribute(visit.id)}">Open visit</button>
              </div>
            </div>
          `).join("")}
        </div>
      </section>
    `);
  }

  if (!totalResults) {
    sections.push(`
      <div class="empty-state">
        <h3>No direct matches</h3>
        <p class="empty-copy">Try a card name, bank name, module keyword, or one of the examples below.</p>
      </div>
    `);
  }

  openAiModal({
    mode: "search",
    title: "Search Results",
    subtitle: `${totalResults} match${totalResults === 1 ? "" : "es"} for "${query}"`,
    bodyHtml: `<div class="ai-search-results">${sections.join("")}</div>`,
    footerHtml: `<button type="button" id="aiSearchCloseBtn" class="ghost-button">Close</button>`,
  });

  document.getElementById("aiSearchCloseBtn")?.addEventListener("click", () => closeAiModal());
}

function handleAiModalBodyClick(event) {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.dataset.aiFill && document.getElementById("aiPromptInput")) {
    const input = document.getElementById("aiPromptInput");
    input.value = button.dataset.aiFill;
    input.focus();
    input.select?.();
    return;
  }

  if (button.dataset.aiOpen === "card-edit") {
    const card = state.cards.find((item) => item.id === button.dataset.cardId);
    if (card) {
      closeAiModal();
      showView("portfolio");
      populateForm(card);
      window.scrollTo({ top: 0, behavior: shouldReduceMotion() ? "auto" : "smooth" });
    }
    return;
  }

  if (button.dataset.aiOpen === "swipe-edit") {
    const swipe = state.swipes.find((item) => item.id === button.dataset.swipeId);
    if (swipe) {
      closeAiModal();
      showView("swipes");
      populateSwipeForm(swipe);
      window.scrollTo({ top: 0, behavior: shouldReduceMotion() ? "auto" : "smooth" });
    }
    return;
  }

  if (button.dataset.aiOpen === "rp-edit") {
    const rpSpend = state.rpSpends.find((item) => item.id === button.dataset.rpId);
    if (rpSpend) {
      closeAiModal();
      showView("rpSpends");
      populateRpSpendForm(rpSpend);
      window.scrollTo({ top: 0, behavior: shouldReduceMotion() ? "auto" : "smooth" });
    }
    return;
  }

  if (button.dataset.aiOpen === "lounge-edit") {
    const visit = state.loungeVisits.find((item) => item.id === button.dataset.loungeId);
    if (visit) {
      closeAiModal();
      showView("lounge");
      populateLoungeVisitForm(visit);
      window.scrollTo({ top: 0, behavior: shouldReduceMotion() ? "auto" : "smooth" });
    }
  }
}

function openAiModal({ mode, title, subtitle, bodyHtml, footerHtml }) {
  aiModalMode = mode;
  if (els.aiAssistModalTitle) els.aiAssistModalTitle.textContent = title || "AI";
  if (els.aiAssistModalSubtitle) els.aiAssistModalSubtitle.textContent = subtitle || "";
  if (els.aiAssistModalBody) {
    els.aiAssistModalBody.innerHTML = bodyHtml || "";
    els.aiAssistModalBody.onclick = handleAiModalBodyClick;
  }
  if (els.aiAssistModalFooter) {
    els.aiAssistModalFooter.innerHTML = footerHtml || "";
  }
  if (els.aiAssistModal) {
    els.aiAssistModal.style.display = "flex";
  }
}

function closeAiModal(result = null) {
  if (aiModalMode === "prompt" || aiModalMode === "confirm" || aiModalMode === "customPrompt") {
    resolveAiModal(result);
    return;
  }

  aiModalMode = null;
  if (els.aiAssistModal) els.aiAssistModal.style.display = "none";
  if (els.aiAssistModalBody) {
    els.aiAssistModalBody.innerHTML = "";
    els.aiAssistModalBody.onclick = null;
  }
  if (els.aiAssistModalFooter) els.aiAssistModalFooter.innerHTML = "";
}

function resolveAiModal(result) {
  const resolver = aiModalResolver;
  aiModalResolver = null;
  aiModalMode = null;
  if (els.aiAssistModal) els.aiAssistModal.style.display = "none";
  if (els.aiAssistModalBody) {
    els.aiAssistModalBody.innerHTML = "";
    els.aiAssistModalBody.onclick = null;
  }
  if (els.aiAssistModalFooter) els.aiAssistModalFooter.innerHTML = "";
  if (typeof resolver === "function") {
    resolver(result);
  }
}

function showAiPrompt(config) {
  return new Promise((resolve) => {
    aiModalResolver = resolve;
    const controlId = "aiPromptInput";
    const suggestionsHtml = Array.isArray(config.suggestions) && config.suggestions.length
      ? `<div class="ai-prompt-options">${config.suggestions.map((value) => `<button type="button" class="ai-option-chip" data-ai-fill="${escapeAttribute(value)}">${escapeHtml(value)}</button>`).join("")}</div>`
      : "";
    const controlHtml = config.options && config.options.length
      ? `<select id="${controlId}">${config.options.map((option) => `<option value="${escapeAttribute(option.value)}"${config.value === option.value ? " selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select>`
      : `<input id="${controlId}" type="${config.type === "number" ? "number" : "text"}" ${config.type === "number" ? 'min="0" step="0.01" inputmode="decimal"' : ""} placeholder="${escapeAttribute(config.placeholder || "")}" value="${escapeAttribute(config.value || "")}" autocomplete="off" />`;

    openAiModal({
      mode: "prompt",
      title: config.title || "Need more detail",
      subtitle: config.message || "Please fill the missing field.",
      bodyHtml: `
        <div class="ai-prompt-shell">
          <div>
            <p class="ai-prompt-title">${escapeHtml(config.title || "Missing information")}</p>
            <p class="ai-prompt-copy">${escapeHtml(config.message || "Please enter the missing detail.")}</p>
          </div>
          <div class="ai-prompt-input-row">
            ${controlHtml}
            ${suggestionsHtml}
            <div id="aiPromptError" class="ai-result-meta" style="display:none; color:#fca5a5;"></div>
          </div>
        </div>
      `,
      footerHtml: `
        <button type="button" id="aiPromptCancelBtn" class="ghost-button">Cancel</button>
        <button type="button" id="aiPromptConfirmBtn" class="primary-button">Continue</button>
      `,
    });

    const input = document.getElementById(controlId);
    const confirmBtn = document.getElementById("aiPromptConfirmBtn");
    const cancelBtn = document.getElementById("aiPromptCancelBtn");
    const errorEl = document.getElementById("aiPromptError");

    cancelBtn?.addEventListener("click", () => resolveAiModal(null));
    confirmBtn?.addEventListener("click", () => {
      const value = (input?.value || "").trim();
      if (config.required !== false && !value) {
        if (errorEl) {
          errorEl.textContent = config.errorMessage || "This field is required.";
          errorEl.style.display = "block";
        }
        input?.focus();
        return;
      }

      resolveAiModal(value);
    });

    input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        confirmBtn?.click();
      }
    });

    input?.focus();
  });
}

function showAiConfirm(config) {
  return new Promise((resolve) => {
    aiModalResolver = resolve;
    openAiModal({
      mode: "confirm",
      title: config.title || "Confirm action",
      subtitle: config.subtitle || "Review the interpreted values before saving.",
      bodyHtml: config.bodyHtml || "",
      footerHtml: `
        <button type="button" id="aiConfirmCancelBtn" class="ghost-button">${escapeHtml(config.cancelLabel || "Cancel")}</button>
        <button type="button" id="aiConfirmOkBtn" class="primary-button">${escapeHtml(config.confirmLabel || "Confirm")}</button>
      `,
    });

    document.getElementById("aiConfirmCancelBtn")?.addEventListener("click", () => resolveAiModal(false));
    document.getElementById("aiConfirmOkBtn")?.addEventListener("click", () => resolveAiModal(true));
  });
}

async function processAiSwipeCommand(intent) {
  const resolved = await collectAiSwipeCommand(intent);
  if (!resolved) return;

  const summary = buildAiSwipeSummary(resolved);
  const confirmed = await showAiConfirm({
    title: resolved.action === "update" ? "Confirm swipe update" : "Confirm swipe add",
    subtitle: "Review the swipe details before saving.",
    bodyHtml: summary,
    confirmLabel: "Confirm",
  });

  if (!confirmed) return;

  const updated = await saveAiSwipeRecord(resolved);
  showToast(updated ? "Swipe updated." : "Swipe added.");
}

async function processAiRpCommand(intent) {
  const resolved = await collectAiRpCommand(intent);
  if (!resolved) return;

  const confirmed = await showAiConfirm({
    title: resolved.action === "update" ? "Confirm RP spend update" : "Confirm RP spend add",
    subtitle: "Review the interpreted RP spend before saving.",
    bodyHtml: buildAiRpSummary(resolved),
    confirmLabel: "Confirm",
  });

  if (!confirmed) return;

  const updated = await saveAiRpRecord(resolved);
  showToast(updated ? "RP spend updated." : "RP spend saved.");
}

async function processAiLoungeCommand(intent) {
  const resolved = await collectAiLoungeCommand(intent);
  if (!resolved) return;

  const confirmed = await showAiConfirm({
    title: resolved.action === "update" ? "Confirm lounge update" : "Confirm lounge visit",
    subtitle: "Review the visit details before saving.",
    bodyHtml: buildAiLoungeSummary(resolved),
    confirmLabel: "Confirm",
  });

  if (!confirmed) return;

  const updated = await saveAiLoungeRecord(resolved);
  showToast(updated ? "Benefit updated." : "Benefit saved.");
}

async function processAiPortfolioCommand(intent) {
  const resolved = await collectAiPortfolioCommand(intent);
  if (!resolved) return;

  const confirmed = await showAiConfirm({
    title: "Confirm portfolio update",
    subtitle: "Review the interpreted card changes before saving.",
    bodyHtml: buildAiPortfolioSummary(resolved),
    confirmLabel: "Confirm",
  });

  if (!confirmed) return;

  await saveAiPortfolioRecord(resolved);
  showToast("Portfolio updated.");
}

async function collectAiSwipeCommand(intent) {
  const resolved = {
    ...intent,
    action: intent.action === "update" ? "update" : "add",
  };

  resolved.card = resolved.card || await promptForCard(intent, "Which card?");
  if (!resolved.card) return null;

  if (!resolved.category) {
    resolved.category = await showAiPrompt({
      title: "Business or Personal?",
      message: "Choose the swipe category.",
      options: [
        { value: "business", label: "Business" },
        { value: "personal", label: "Personal" },
      ],
      value: "business",
    });
  }
  if (!resolved.category) return null;

  if (!resolved.swipeType) {
    resolved.swipeType = await showAiPrompt({
      title: "Full Swipe or EMI?",
      message: "Choose how this swipe should be recorded.",
      options: [
        { value: "F", label: "Full Swipe" },
        { value: "E", label: "EMI" },
      ],
      value: "F",
    });
  }
  if (!resolved.swipeType) return null;

  if (!resolved.financialYear) {
    resolved.financialYear = await showAiPrompt({
      title: "Financial year",
      message: "Select the financial year for the swipe.",
      options: [
        { value: "FY 24-25", label: "FY 24-25" },
        { value: "FY 25-26", label: "FY 25-26" },
        { value: "FY 26-27", label: "FY 26-27" },
        { value: "FY 27-28", label: "FY 27-28" },
        { value: "FY 28-29", label: "FY 28-29" },
        { value: "FY 29-30", label: "FY 29-30" },
      ],
      value: "FY 25-26",
    });
  }
  if (!resolved.financialYear) return null;

  if (!resolved.amount) {
    const amountValue = await showAiPrompt({
      title: "Swipe amount",
      message: "Enter the swipe value.",
      type: "number",
      placeholder: "25000",
    });
    resolved.amount = toNumber(amountValue);
  }
  if (!resolved.amount) return null;

  if (normalizeSwipeCategory(resolved.category) === "personal" && !resolved.spentFor) {
    const spentForSuggestions = getAiSuggestedSpentFor(resolved.card, resolved.category);
    resolved.spentFor = await showAiPrompt({
      title: "Spent for",
      message: "This is mandatory for personal swipes.",
      type: "text",
      placeholder: "e.g. Laptop, Rent",
      suggestions: spentForSuggestions,
    });
  }

  resolved.spentFor = normalizeAiFreeText(resolved.spentFor, resolved.card, resolved.knowledge);
  if (normalizeSwipeCategory(resolved.category) === "personal" && !resolved.spentFor) return null;

  return resolved;
}

async function collectAiRpCommand(intent) {
  const resolved = {
    ...intent,
    action: intent.action === "update" ? "update" : "add",
  };

  resolved.card = resolved.card || await promptForCard(intent, "Which card?");
  if (!resolved.card) return null;

  if (!resolved.productName) {
    resolved.productName = await showAiPrompt({
      title: "Product name",
      message: "Tell me what this RP spend is for.",
      type: "text",
      placeholder: "e.g. Atlas miles",
    });
  }
  if (!resolved.productName) return null;

  if (!resolved.points) {
    const pointsValue = await showAiPrompt({
      title: "Points used",
      message: "Enter the points spent.",
      type: "number",
      placeholder: "6000",
    });
    resolved.points = toNumber(pointsValue);
  }
  if (!resolved.points) return null;

  if (!resolved.pointsValue && !resolved.cardPaid && !resolved.voucherPaid && !resolved.redemptionCharges) {
    resolved.pointsValue = await showAiPrompt({
      title: "Value paid",
      message: "Enter the cash value paid for this reward spend.",
      type: "number",
      placeholder: "9000",
      required: false,
    });
    resolved.pointsValue = toNumber(resolved.pointsValue);
  }

  return resolved;
}

async function collectAiLoungeCommand(intent) {
  const resolved = {
    ...intent,
    action: intent.action === "update" ? "update" : "add",
  };

  resolved.card = resolved.card || await promptForCard(intent, "Which card?");
  if (!resolved.card) return null;

  if (!resolved.loungeType) {
    resolved.loungeType = await showAiPrompt({
      title: "Benefit type",
      message: "Choose the lounge or benefit type.",
      options: [
        { value: "Domestic", label: "Domestic Lounge" },
        { value: "International", label: "International Lounge" },
        { value: "Domestic_Golf", label: "Domestic Golf" },
        { value: "International_Golf", label: "International Golf" },
        { value: "Domestic_Restaurant", label: "Domestic Restaurant" },
        { value: "International_Restaurant", label: "International Restaurant" },
        { value: "Domestic_Spa", label: "Domestic Spa" },
        { value: "International_Spa", label: "International Spa" },
        { value: "Meet_Greet", label: "Meet & Greet" },
        { value: "Airport_Transfer", label: "Airport Transfer" },
      ],
      value: "Domestic",
    });
  }
  if (!resolved.loungeType) return null;

  if (!resolved.members) {
    const membersValue = await showAiPrompt({
      title: "Members",
      message: "How many members used the benefit?",
      type: "number",
      placeholder: "3",
      value: "1",
    });
    resolved.members = Math.max(1, Math.round(toNumber(membersValue)));
  }
  if (!resolved.members) resolved.members = 1;

  if (!resolved.airport) {
    resolved.airport = await showAiPrompt({
      title: "Airport / location",
      message: "Enter the airport, golf course, or lounge location.",
      type: "text",
      placeholder: "Chennai",
    });
  }
  resolved.airport = normalizeAiFreeText(resolved.airport, resolved.card, resolved.knowledge);
  if (!resolved.airport) return null;

  if (!resolved.pointsValue) {
    const perPerson = await showAiPrompt({
      title: "Value per person",
      message: "Enter the per-person value for this lounge visit.",
      type: "number",
      placeholder: "1500",
    });
    resolved.pointsValue = toNumber(perPerson);
  }

  resolved.date = resolved.date || new Date().toISOString().slice(0, 10);
  return resolved;
}

async function collectAiPortfolioCommand(intent) {
  const resolved = {
    ...intent,
    action: intent.action === "update" ? "update" : "add",
  };

  resolved.card = resolved.card || await promptForCard(intent, "Which card?");
  if (!resolved.card) return null;

  if (!resolved.points) {
    const pointsValue = await showAiPrompt({
      title: "Points",
      message: "Enter the points to add.",
      type: "number",
      placeholder: "5000",
    });
    resolved.points = toNumber(pointsValue);
  }
  if (!resolved.points) return null;

  return resolved;
}

async function promptForCard(intent, title) {
  const candidates = (intent.cardCandidates || []).slice(0, 6);
  const suggestions = candidates.map((card) => formatCardName(card));
  const cardLabel = await showAiPrompt({
    title,
    message: suggestions.length ? "I found these matching cards. Type the exact card name or pick one below." : "Type the exact card name.",
    type: "text",
    placeholder: "Card name",
    suggestions,
  });
  if (!cardLabel) return null;

  const exact = findCardByLabel(cardLabel);
  if (exact) return exact;

  const fallback = findCardByLabel(intent.rawQuery) || findCardByLabel(intent.normalizedQuery);
  return fallback || null;
}

function findCardByLabel(label) {
  const normalized = normalizeAiText(label);
  const cards = state.cards.slice();
  const exactLabel = cards.find((card) => normalizeAiText(formatCardName(card)) === normalized || normalizeAiText(card.name) === normalized);
  if (exactLabel) return exactLabel;

  return null;
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripCardMentions(text, card) {
  let output = String(text || "").trim();
  if (!card) return output;

  [card.name, card.issuer, formatCardName(card)]
    .filter(Boolean)
    .forEach((part) => {
      output = output.replace(new RegExp(`\\b${escapeRegex(part)}\\b`, "gi"), " ");
    });

  return output.replace(/\s+/g, " ").trim();
}

function buildAiSwipeSummary(resolved) {
  return `
    <div class="ai-search-results">
      <section class="ai-search-section">
        <div class="ai-result-card">
          <strong>${escapeHtml(formatCardName(resolved.card))}</strong>
          <div class="ai-result-meta">${escapeHtml(normalizeSwipeCategory(resolved.category) === "personal" ? "Personal" : "Business")} | ${escapeHtml(resolved.swipeType === "E" ? "EMI" : "Full Swipe")} | ${escapeHtml(normalizeFinancialYear(resolved.financialYear))}</div>
          <div class="ai-result-meta">Amount ${escapeHtml(formatMoney(resolved.amount))}</div>
          ${normalizeSwipeCategory(resolved.category) === "personal" ? `<div class="ai-result-meta">Spent for ${escapeHtml(resolved.spentFor || "")}</div>` : ""}
        </div>
      </section>
    </div>
  `;
}

function buildAiRpSummary(resolved) {
  return `
    <div class="ai-search-results">
      <section class="ai-search-section">
        <div class="ai-result-card">
          <strong>${escapeHtml(formatCardName(resolved.card))}</strong>
          <div class="ai-result-meta">${escapeHtml(resolved.productName || "")}</div>
          <div class="ai-result-meta">Points ${escapeHtml(formatPoints(resolved.points))} | Value ${escapeHtml(formatMoney(resolved.pointsValue || 0))}</div>
        </div>
      </section>
    </div>
  `;
}

function buildAiLoungeSummary(resolved) {
  const perPerson = toNumber(resolved.pointsValue);
  const total = Math.max(1, toNumber(resolved.members) || 1) * perPerson;
  return `
    <div class="ai-search-results">
      <section class="ai-search-section">
        <div class="ai-result-card">
          <strong>${escapeHtml(formatCardName(resolved.card))}</strong>
          <div class="ai-result-meta">${escapeHtml(resolved.loungeType || "")} | ${escapeHtml(resolved.airport || "")}</div>
          <div class="ai-result-meta">${escapeHtml(String(resolved.members || 1))} members | ${escapeHtml(formatMoney(perPerson))} per person | ${escapeHtml(formatMoney(total))} total</div>
        </div>
      </section>
    </div>
  `;
}

function buildAiPortfolioSummary(resolved) {
  return `
    <div class="ai-search-results">
      <section class="ai-search-section">
        <div class="ai-result-card">
          <strong>${escapeHtml(formatCardName(resolved.card))}</strong>
          <div class="ai-result-meta">Add ${escapeHtml(formatPoints(resolved.points))} points</div>
        </div>
      </section>
    </div>
  `;
}

function findSwipeMatchForIntent(intent) {
  const cardId = intent.card?.id || "";
  const candidates = state.swipes.filter((swipe) => {
    if (cardId && swipe.cardId !== cardId) return false;
    if (intent.category && normalizeSwipeCategory(swipe.category) !== normalizeSwipeCategory(intent.category)) return false;
    if (intent.swipeType && swipe.type !== intent.swipeType) return false;
    if (intent.financialYear && normalizeFinancialYear(swipe.financialYear) !== normalizeFinancialYear(intent.financialYear)) return false;
    if (intent.amount && toNumber(swipe.amount) !== toNumber(intent.amount)) return false;
    return true;
  });

  return candidates.sort((a, b) => getSwipeCreatedTime(b) - getSwipeCreatedTime(a))[0] || null;
}

function findRpMatchForIntent(intent) {
  const cardId = intent.card?.id || "";
  const candidates = state.rpSpends.filter((rpSpend) => {
    if (cardId && rpSpend.cardId !== cardId) return false;
    if (intent.productName && normalizeAiText(rpSpend.productName) !== normalizeAiText(intent.productName)) return false;
    return true;
  });

  return candidates.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0] || null;
}

function findLoungeMatchForIntent(intent) {
  const cardId = intent.card?.id || "";
  const candidates = state.loungeVisits.filter((visit) => {
    if (cardId && visit.cardId !== cardId) return false;
    if (intent.airport && normalizeAiText(visit.airport) !== normalizeAiText(intent.airport)) return false;
    if (intent.loungeType && String(visit.loungeType || "") !== String(intent.loungeType || "")) return false;
    return true;
  });

  return candidates.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0] || null;
}

async function saveAiSwipeRecord(resolved) {
  const existing = resolved.action === "update" ? findSwipeMatchForIntent(resolved) : null;
  const swipe = normalizeSwipe({
    id: existing?.id || createId(),
    cardId: resolved.card.id,
    amount: resolved.amount,
    type: resolved.swipeType,
    financialYear: normalizeFinancialYear(resolved.financialYear),
    category: normalizeSwipeCategory(resolved.category),
    spentFor: normalizeSwipeCategory(resolved.category) === "personal" ? (resolved.spentFor || "") : (resolved.spentFor || ""),
    createdAt: existing?.createdAt || new Date().toISOString(),
  });

  if (existing) {
    const index = state.swipes.findIndex((item) => item.id === existing.id);
    if (index >= 0) state.swipes[index] = swipe;
  } else {
    state.swipes.push(swipe);
  }

  recordAiTrainingExample(resolved, swipe);
  await saveState();
  render();
  return Boolean(existing);
}

async function saveAiRpRecord(resolved) {
  const existing = resolved.action === "update" ? findRpMatchForIntent(resolved) : null;
  const card = resolved.card;
  const portfolioCard = card?.id ? getCardById(card.id) : null;
  const enteredPoints = toNumber(resolved.points);
  const isPortfolioCard = Boolean(portfolioCard);
  let redeemedPoints = 0;

  if (isPortfolioCard && enteredPoints > 0) {
    const priorRedeemedPoints = existing
      && existing.cardId === card.id
      && !isPartnerProgramRpSpend(existing)
      ? Math.min(getRpSpendTotalPoints(existing), toNumber(existing.redeemedPoints))
      : 0;
    const availablePoints = getCardUnredeemedPoints(portfolioCard) + priorRedeemedPoints;

    if (enteredPoints > availablePoints) {
      showToast(`You can redeem up to ${formatPoints(availablePoints)} from ${formatCardShortName(portfolioCard)}.`);
      return false;
    }

    redeemedPoints = enteredPoints;
  }

  const rpSpend = normalizeRpSpend({
    id: existing?.id || createId(),
    purchaseId: existing?.purchaseId || existing?.id || createId(),
    cardId: card.id,
    points: resolved.points,
    redeemedPoints,
    unredeemedPointsRecord: false,
    pointsValue: resolved.pointsValue,
    redemptionCharges: resolved.redemptionCharges || 0,
    cardPaid: resolved.cardPaid || 0,
    voucherPaid: resolved.voucherPaid || 0,
    purchasedFrom: resolved.purchasedFrom || "",
    productName: resolved.productName,
    createdAt: existing?.createdAt || new Date().toISOString(),
  });

  if (existing) {
    const index = state.rpSpends.findIndex((item) => item.id === existing.id);
    if (index >= 0) {
      restoreRpSpendRedemption(existing);
      state.rpSpends[index] = rpSpend;
    }
  } else {
    state.rpSpends.push(rpSpend);
  }

  if (isPortfolioCard && enteredPoints > 0) {
    const result = applyCardPointRedemption(card.id, enteredPoints);
    if (!result.ok) {
      showToast(result.error);
      return false;
    }
  }

  recordAiTrainingExample(resolved, rpSpend);
  await saveState();
  render();
  return Boolean(existing);
}

async function saveAiLoungeRecord(resolved) {
  const existing = resolved.action === "update" ? findLoungeMatchForIntent(resolved) : null;
  const members = Math.max(1, Math.round(toNumber(resolved.members) || 1));
  const perPerson = toNumber(resolved.pointsValue);
  const visit = normalizeLoungeVisit({
    id: existing?.id || createId(),
    cardId: resolved.card.id,
    loungeType: resolved.loungeType,
    airport: resolved.airport,
    members,
    perPerson,
    total: members * perPerson,
    date: resolved.date || new Date().toISOString(),
    createdAt: existing?.createdAt || new Date().toISOString(),
  });

  if (existing) {
    const index = state.loungeVisits.findIndex((item) => item.id === existing.id);
    if (index >= 0) state.loungeVisits[index] = visit;
  } else {
    state.loungeVisits.push(visit);
  }

  syncLoungeBenefitsFromVisits();
  recordAiTrainingExample(resolved, visit);
  await saveState();
  render();
  return Boolean(existing);
}

async function saveAiPortfolioRecord(resolved) {
  const card = resolved.card;
  const existingIndex = state.cards.findIndex((item) => item.id === card.id);
  if (existingIndex < 0) return;

  const pointsToAdd = toNumber(resolved.points);
  if (pointsToAdd > 0) {
    upsertAiAddedPointsRewardSpend(card, pointsToAdd);
  }

  syncRpRedeemedBenefitsFromSpends();
  syncLoungeBenefitsFromVisits();
  recordAiTrainingExample(resolved, state.cards[existingIndex]);
  await saveState();
  render();
}

function upsertAiAddedPointsRewardSpend(card, pointsToAdd) {
  const amount = toNumber(pointsToAdd);
  if (!card || amount <= 0) return;

  const targetName = normalizeAiText(formatCardName(card));
  const matchingRows = state.rpSpends
    .map((row, index) => {
      if (row.cardId && row.cardId !== card.id) return null;

      const productName = normalizeAiText(row.productName);
      const purchasedFrom = normalizeAiText(row.purchasedFrom);
      const rowCardName = normalizeAiText(formatRpSourceName(row.cardId));
      const matchesProductName =
        productName &&
        (productName === targetName ||
          productName.includes(targetName) ||
          targetName.includes(productName));
      const matchesPurchasedFrom =
        purchasedFrom &&
        (purchasedFrom === targetName ||
          purchasedFrom.includes(targetName) ||
          targetName.includes(purchasedFrom));
      const matchesCardName =
        rowCardName &&
        (rowCardName === targetName ||
          rowCardName.includes(targetName) ||
          targetName.includes(rowCardName));

      const score =
        (matchesProductName ? 6 : 0) +
        (matchesPurchasedFrom ? 4 : 0) +
        (matchesCardName ? 5 : 0) +
        (row.cardId === card.id ? 2 : 0);

      return score > 0 ? { row, index, score } : null;
    })
    .filter(Boolean)
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff) return scoreDiff;
      return new Date(b.row.createdAt || 0) - new Date(a.row.createdAt || 0) || b.index - a.index;
    });

  const existingIndex = matchingRows[0]?.index ?? -1;
  const existing = existingIndex >= 0 ? state.rpSpends[existingIndex] : null;
  const currentPoints = existing ? toNumber(existing.points) : 0;
  const purchaseId = existing?.purchaseId || existing?.id || `ai-added-points-${card.id}`;

  const rpSpend = normalizeRpSpend({
    ...(existing || {}),
    id: existing?.id || createId(),
    purchaseId,
    cardId: card.id,
    points: currentPoints + amount,
    pointsValue: existing ? existing.pointsValue : 0,
    redemptionCharges: existing ? existing.redemptionCharges : 0,
    cardPaid: existing ? existing.cardPaid : 0,
    voucherPaid: existing ? existing.voucherPaid : 0,
    purchasedFrom: existing?.purchasedFrom || "AI Search",
    productName: existing?.productName || formatCardName(card),
    createdAt: existing?.createdAt || new Date().toISOString(),
  });

  if (existingIndex >= 0) {
    state.rpSpends[existingIndex] = rpSpend;
  } else {
    state.rpSpends.push(rpSpend);
  }
}

function initUiEnhancements() {
  document.documentElement.classList.add("ui-revamp-ready");
  document.body?.classList.add("ui-enhanced");

  // Enhance Personal Tracker Header
  const header = document.querySelector('header h1, .app-header h1');
  if (header) {
    header.style.fontFamily = "'Orbitron', 'Segoe UI', sans-serif";
    header.style.letterSpacing = "2px";
    header.style.textTransform = "uppercase";
    header.style.background = "linear-gradient(to right, #fff, #3b82f6, #10b981)";
    header.style.webkitBackgroundClip = "text";
    header.style.webkitTextFillColor = "transparent";
    header.style.filter = "drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))";
    
    // Add a subtle animated glow effect
    header.animate([
      { filter: "drop-shadow(0 0 5px rgba(59, 130, 246, 0.3))" },
      { filter: "drop-shadow(0 0 15px rgba(16, 185, 129, 0.6))" },
      { filter: "drop-shadow(0 0 5px rgba(59, 130, 246, 0.3))" }
    ], { duration: 3000, iterations: Infinity });
  }

  getViews().forEach((view) => {
    view?.classList.add("app-view");
  });

  document.addEventListener("focusin", handleFieldFocus);
  document.addEventListener("focusout", handleFieldBlur);
  document.addEventListener("input", handleFieldValueChange);
  document.addEventListener("change", handleFieldValueChange);

  refreshAllFieldStates();
  syncActiveViewClasses();
  updateAppHeaderTitle(state.currentView);

  requestAnimationFrame(() => {
    document.body?.classList.add("ui-hydrated");
    animateActiveView(state.currentView);
  });
}

function getViews() {
  return [els.dashboardView, els.portfolioView, els.swipesView, els.rpSpendsView, els.pprView, els.loungeView].filter(Boolean);
}

function syncActiveViewClasses() {
  const viewMap = {
    dashboard: els.dashboardView,
    portfolio: els.portfolioView,
    swipes: els.swipesView,
    rpSpends: els.rpSpendsView,
    ppr: els.pprView,
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
    ppr: els.pprView,
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

function normalizeViewName(view) {
  return ["dashboard", "portfolio", "swipes", "rpSpends", "ppr", "lounge"].includes(view) ? view : "dashboard";
}

function renderDashboard() {
  const totals = getTotals(state.cards);
  const swipeTotal = getSwipeTotal();
  const swipeCategoryTotals = getSwipeCategoryTotals();
  const rpPointsUsageTotals = getRpPointsUsageTotals();
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
    els.dashboardSwipeHint.textContent = `${formatMoney(swipeTotal)} total`;
  }

  if (els.dashboardLoungeValue) {
    els.dashboardLoungeValue.textContent = formatMoney(loungeTotal);
  }

  if (els.dashboardLoungeHint) {
    els.dashboardLoungeHint.textContent = "";
  }

  if (els.dashboardRpValue) {
    els.dashboardRpValue.innerHTML = `
      <div class="dashboard-rp-breakdown" aria-label="Spent and not spent points used">
        <div class="dashboard-rp-item spent">
          <span>Spent</span>
          <strong>${escapeHtml(formatPoints(rpPointsUsageTotals.spent))}</strong>
        </div>
        <div class="dashboard-rp-item not-spent">
          <span>Not spent</span>
          <strong>${escapeHtml(formatPoints(rpPointsUsageTotals.notSpent))}</strong>
        </div>
      </div>
    `;
  }

  if (els.dashboardRpHint) {
    els.dashboardRpHint.textContent = "";
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
    { value: partnerProgramPlatformValue, label: "Hotel/Airline Partners" },
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

async function handleRpCardSelectChange(event) {
  const select = event?.target;
  if (!select) return;

  if (select.value === partnerProgramPlatformValue) {
    const result = await showPartnerProgramTransferPrompt({
      partnerName: els.rpPurchasedFrom?.value.trim() || "",
      ratio: els.rpPartnerTransferRatio?.value || "",
      originatingCardId: els.rpOriginatingCardId?.value || "",
    });

    if (!result) {
      select.value = "";
      if (els.rpPurchasedFrom) {
        els.rpPurchasedFrom.value = "";
        delete els.rpPurchasedFrom.dataset.partnerProgramAuto;
      }
      if (els.rpPartnerTransferRatio) {
        els.rpPartnerTransferRatio.value = "";
      }
      if (els.rpOriginatingCardId) {
        els.rpOriginatingCardId.value = "";
      }
      refreshAllFieldStates();
      return;
    }

    if (els.rpPurchasedFrom) {
      els.rpPurchasedFrom.value = result.partnerName;
      els.rpPurchasedFrom.dataset.partnerProgramAuto = "true";
    }
    if (els.rpPartnerTransferRatio) {
      els.rpPartnerTransferRatio.value = result.ratio || "";
    }
    if (els.rpOriginatingCardId) {
      els.rpOriginatingCardId.value = result.originatingCardId || "";
    }
    updatePartnerTransferDetailsButton();
    refreshAllFieldStates();
    return;
  }

  if (els.rpPurchasedFrom?.dataset.partnerProgramAuto === "true") {
    els.rpPurchasedFrom.value = "";
    delete els.rpPurchasedFrom.dataset.partnerProgramAuto;
  }
  if (els.rpOriginatingCardId) {
    els.rpOriginatingCardId.value = "";
  }

  updatePartnerTransferDetailsButton();
  refreshAllFieldStates();
}

function buildPartnerProgramOriginatingCardOptions(selectedCardId = "") {
  const sortedCards = state.cards
    .slice()
    .sort((a, b) => formatCardName(a).localeCompare(formatCardName(b)));

  if (!sortedCards.length) {
    return '<option value="">Add cards in portfolio first</option>';
  }

  const options = ['<option value="">No source card selected</option>'];
  sortedCards.forEach((card) => {
    options.push(
      `<option value="${escapeAttribute(card.id)}"${selectedCardId === card.id ? " selected" : ""}>${escapeHtml(formatCardName(card))}</option>`
    );
  });

  return options.join("");
}

function updatePartnerProgramOriginInfo(selectEl, infoEl, pendingRedeemedPoints = 0, editingRedemptionPoints = 0) {
  if (!selectEl || !infoEl) return;

  const card = getCardById(selectEl.value);
  if (!card) {
    infoEl.style.display = "none";
    infoEl.innerHTML = "";
    return;
  }

  const savedUnredeemedPoints = getCardUnredeemedPoints(card) + toNumber(editingRedemptionPoints);
  const unredeemedPoints = Math.max(0, savedUnredeemedPoints - toNumber(pendingRedeemedPoints));
  const pendingCopy = toNumber(pendingRedeemedPoints) > 0
    ? ` This includes ${formatPoints(pendingRedeemedPoints)} pending redemption.`
    : "";
  infoEl.style.display = "grid";
  infoEl.innerHTML = `
    <div style="font-size:0.78rem; font-weight:800; text-transform:uppercase; color:#94a3b8;">Current Unredeemed Points</div>
    <strong style="font-size:1.4rem; color:#f8fafc;">${escapeHtml(formatPoints(unredeemedPoints))}</strong>
    <p style="margin:0; color:#94a3b8; font-size:0.88rem; line-height:1.45;">
      You are about to redeem points from this card.
      If these points have been transferred to a partner program, save the RP spend to update the card's Unredeemed Points.${pendingCopy}
    </p>
  `;
}

function updatePartnerTransferDetailsButton() {
  if (!els.rpPartnerTransferBtn) return;

  const shouldShow = els.rpCardSelect?.value === partnerProgramPlatformValue
    || Boolean(els.rpOriginatingCardId?.value)
    || els.rpPurchasedFrom?.dataset.partnerProgramAuto === "true";

  els.rpPartnerTransferBtn.style.display = shouldShow ? "inline-flex" : "none";
}

function showPartnerProgramTransferPrompt(initial = {}) {
  return new Promise((resolve) => {
    aiModalResolver = resolve;
    const partnerNameId = "partnerProgramPromptPartnerName";
    const originatingCardId = "partnerProgramPromptOriginatingCard";
    const ratioId = "partnerProgramPromptRatio";
    const infoId = "partnerProgramPromptInfo";
    const errorId = "partnerProgramPromptError";

    openAiModal({
      mode: "customPrompt",
      title: "Partner name",
       subtitle: "Add the partner name, ratio, and originating card.",
      bodyHtml: `
        <div class="ai-prompt-shell" style="gap:16px;">
          <div>
            <p class="ai-prompt-title">Partner Program Transfer</p>
            <p class="ai-prompt-copy">Partner name, ratio, and originating card are required when redeeming points.</p>
          </div>
          <label class="field">
            <span>Partner name</span>
            <input id="${partnerNameId}" type="text" placeholder="e.g. Marriott, Emirates" value="${escapeAttribute(initial.partnerName || "")}" autocomplete="off" />
          </label>
          <label class="field">
            <span>Redemption Ratio (number1:number2)</span>
            <input id="${ratioId}" type="text" placeholder="e.g. 1:2 (1 point = 2 PPR value)" value="${escapeAttribute(initial.ratio || "")}" autocomplete="off" />
          </label>
          <label class="field">
            <span>Originating Card</span>
            <select id="${originatingCardId}">
              ${buildPartnerProgramOriginatingCardOptions(initial.originatingCardId || "")}
            </select>
          </label>
          <div id="${infoId}" style="display:none; padding:14px; border:1px solid rgba(96,165,250,0.22); border-radius:10px; background:rgba(15,23,42,0.78); gap:6px;"></div>
          <div id="${errorId}" class="ai-result-meta" style="display:none; color:#fca5a5;"></div>
        </div>
      `,
      footerHtml: `
        <button type="button" id="partnerProgramPromptCancelBtn" class="ghost-button">Cancel</button>
        <button type="button" id="partnerProgramPromptRedeemBtn" class="ghost-button">Redeem</button>
        <button type="button" id="partnerProgramPromptConfirmBtn" class="primary-button">Continue</button>
      `,
    });

    const partnerNameInput = document.getElementById(partnerNameId);
    const ratioInput = document.getElementById(ratioId);
    const originatingCardSelect = document.getElementById(originatingCardId);
    const infoEl = document.getElementById(infoId);
    const errorEl = document.getElementById(errorId);
    const cancelBtn = document.getElementById("partnerProgramPromptCancelBtn");
    const redeemBtn = document.getElementById("partnerProgramPromptRedeemBtn");
    const confirmBtn = document.getElementById("partnerProgramPromptConfirmBtn");

    // Redemptions are held in the form until Update RP Spend is clicked.
    const pendingRedemptionsByCard = {};
    const editingSpend = els.editingRpSpendId?.value
      ? state.rpSpends.find((item) => item.id === els.editingRpSpendId.value)
      : null;
    const getEditingRedemptionPoints = (cardId) => editingSpend
      && isPartnerProgramRpSpend(editingSpend)
      && getRpSpendRedeemedSourceCardId(editingSpend) === cardId
      ? getRpSpendRedemptionAmount(editingSpend)
      : 0;
    const refreshInfo = () => {
      const cardId = String(originatingCardSelect?.value || "").trim();
      updatePartnerProgramOriginInfo(
        originatingCardSelect,
        infoEl,
        pendingRedemptionsByCard[cardId] || 0,
        getEditingRedemptionPoints(cardId)
      );
    };

    cancelBtn?.addEventListener("click", () => resolveAiModal(null));
    redeemBtn?.addEventListener("click", async () => {
      const sourceCardId = String(originatingCardSelect?.value || "").trim();
      const sourceCard = getCardById(sourceCardId);

      if (!sourceCard) {
        showToast("Select an originating card first.");
        originatingCardSelect?.focus();
        return;
      }

      const alreadyPendingPoints = toNumber(pendingRedemptionsByCard[sourceCardId]);
      const availablePoints = Math.max(
        0,
        getCardUnredeemedPoints(sourceCard)
        + getEditingRedemptionPoints(sourceCardId)
        - alreadyPendingPoints
      );
      if (availablePoints <= 0) {
        showToast("No unredeemed points available for that card.");
        return;
      }

      const redeemPoints = await showRedeemPointsPrompt({
        card: sourceCard,
        availablePoints,
      });

      if (redeemPoints == null) return;
      const editingId = String(els.editingRpSpendId?.value || "").trim();
      const editingRow = editingId ? state.rpSpends.find((item) => item.id === editingId) : null;
      const totalPoints = toNumber(els.rpPoints?.value);
      const currentRedeemedPoints = toNumber(els.rpRedeemedPoints?.value);
      const updatedTotalPoints = totalPoints + redeemPoints;
      const totalRedeemedPoints = currentRedeemedPoints + redeemPoints;

      if (els.rpPoints) {
        els.rpPoints.value = String(updatedTotalPoints);
      }
      if (els.rpRedeemedPoints) {
        els.rpRedeemedPoints.value = String(totalRedeemedPoints);
      }
      pendingRedemptionsByCard[sourceCardId] = alreadyPendingPoints + redeemPoints;

      const partnerRatio = parsePartnerTransferRatio(ratioInput?.value || els.rpPartnerTransferRatio?.value || "");
      const currentPointsReceived = toNumber(els.rpPointsReceived?.value || editingRow?.pointsReceived || 0);
      const updatedPointsReceived = partnerRatio
        ? currentPointsReceived + computePartnerTransferPoints(redeemPoints, partnerRatio)
        : currentPointsReceived;
      if (els.rpPointsReceived && partnerRatio) {
        els.rpPointsReceived.value = String(updatedPointsReceived);
      }

      refreshInfo();
      showToast(`Redeemed ${formatPoints(redeemPoints)} from ${formatCardShortName(sourceCard)}. Remaining: ${formatPoints(availablePoints - redeemPoints)}.`);
    });
    confirmBtn?.addEventListener("click", () => {
      const partnerName = String(partnerNameInput?.value || "").trim();
      const ratio = String(ratioInput?.value || "").trim();

      if (errorEl) errorEl.style.display = "none";

      if (!partnerName) {
        if (errorEl) {
          errorEl.textContent = "Partner name is required.";
          errorEl.style.display = "block";
        }
        partnerNameInput?.focus();
        return;
      }

      if (!ratio) {
        if (errorEl) {
          errorEl.textContent = "Redemption ratio is required (e.g. 1:2).";
          errorEl.style.display = "block";
        }
        ratioInput?.focus();
        return;
      }

      if (!parsePartnerTransferRatio(ratio)) {
        if (errorEl) {
          errorEl.textContent = "Invalid ratio format. Use number1:number2 (e.g. 1:2).";
          errorEl.style.display = "block";
        }
        ratioInput?.focus();
        return;
      }

      resolveAiModal({
        partnerName,
        ratio,
        originatingCardId: String(originatingCardSelect?.value || "").trim(),
      });
    });

    partnerNameInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        ratioInput?.focus();
      }
    });

    ratioInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        confirmBtn?.click();
      }
    });

    originatingCardSelect?.addEventListener("change", refreshInfo);
    refreshInfo();
    partnerNameInput?.focus();
  });
}

function getUnredeemedPointsSourceRecord(cardId, excludeId = "") {
  return state.rpSpends.find((rpSpend) =>
    isUnredeemedPointsRecord(rpSpend)
    && rpSpend.cardId === cardId
    && rpSpend.id !== excludeId
  ) || null;
}

function getUnredeemedSourceConsumedPoints(sourceCardId, excludeId = "") {
  const cardId = String(sourceCardId || "").trim();
  if (!cardId) return 0;

  return state.rpSpends
    .filter((rpSpend) => rpSpend.id !== excludeId)
    .filter((rpSpend) => !isUnredeemedPointsRecord(rpSpend))
    .filter((rpSpend) => getRpSpendRedeemedSourceCardId(rpSpend) === cardId)
    .reduce((sum, rpSpend) => sum + getRpSpendRedemptionAmount(rpSpend), 0);
}

function getUnredeemedSourceBalance(sourceRecord, excludeId = "") {
  if (!sourceRecord) return 0;

  return Math.max(
    0,
    toNumber(sourceRecord.points) - getUnredeemedSourceConsumedPoints(sourceRecord.cardId, excludeId)
  );
}

function getCardUnredeemedPoints(card) {
  const cardId = typeof card === "string" ? card : card?.id;
  if (!cardId) return 0;

  const sourceRecord = getUnredeemedPointsSourceRecord(cardId);
  if (sourceRecord) {
    return getUnredeemedSourceBalance(sourceRecord);
  }

  if (typeof card === "string") return 0;
  if (!Array.isArray(card.benefits)) return 0;

  return card.benefits.reduce((sum, benefit) => {
    if (benefit?.type !== "Unredeemed Points") return sum;
    if (!isPointBenefit(benefit)) return sum;
    return sum + toNumber(benefit.amount);
  }, 0);
}

function getRpSpendRedemptionAmount(rpSpend) {
  if (!rpSpend || isUnredeemedPointsRecord(rpSpend)) return 0;

  const totalPoints = getRpSpendTotalPoints(rpSpend);
  if (isPartnerProgramRpSpend(rpSpend)) return totalPoints;

  // An unchecked Add RP Spend row against a source with an Unredeemed Points
  // record is a product redemption. Consume its entered points exactly as the
  // Partner Program flow consumes its entered points.
  const sourceCardId = getRpSpendRedeemedSourceCardId(rpSpend);
  if (getUnredeemedPointsSourceRecord(sourceCardId)) return totalPoints;

  return Math.min(totalPoints, toNumber(rpSpend.redeemedPoints));
}

function restoreRpSpendRedemption(rpSpend) {
  // Redemptions are derived from the saved rows. Deleting or replacing a row
  // automatically returns its points to the source balance after recalculation.
  return getRpSpendRedemptionAmount(rpSpend);
}

function applyCardPointRedemption(cardId, redeemPoints) {
  const pointsToRedeem = toNumber(redeemPoints);
  if (pointsToRedeem <= 0) {
    return { ok: false, error: "Enter a valid number of points." };
  }

  const sourceRecord = getUnredeemedPointsSourceRecord(cardId);
  const cardIndex = state.cards.findIndex((card) => card.id === cardId);
  const card = cardIndex >= 0 ? state.cards[cardIndex] : null;
  const currentUnredeemed = getCardUnredeemedPoints(card || cardId);
  if (pointsToRedeem > currentUnredeemed) {
    return {
      ok: false,
      error: `You can redeem up to ${formatPoints(currentUnredeemed)}.`,
    };
  }

  if (sourceRecord) {
    // Keep the checked row as the base points pool. The redeemed row is the
    // event that consumes points, just like a Partner Program redemption.
    return { ok: true, currentUnredeemed: currentUnredeemed - pointsToRedeem };
  }

  if (!card) {
    return { ok: false, error: "Selected source has no Unredeemed Points record." };
  }

  let remaining = pointsToRedeem;
  const updatedBenefits = (card.benefits || []).map((benefit) => {
    if (remaining <= 0) return benefit;
    if (benefit?.type !== "Unredeemed Points" || !isPointBenefit(benefit)) return benefit;

    const currentAmount = toNumber(benefit.amount);
    if (currentAmount <= 0) return benefit;

    const deducted = Math.min(currentAmount, remaining);
    remaining -= deducted;
    return {
      ...benefit,
      amount: currentAmount - deducted,
    };
  });

  if (remaining > 0) {
    return { ok: false, error: "Unable to apply the full redemption amount." };
  }

  state.cards[cardIndex] = {
    ...card,
    benefits: updatedBenefits,
  };

  return { ok: true, currentUnredeemed: currentUnredeemed - pointsToRedeem };
}

let redeemPointsModalContext = null;

function showRedeemPointsPrompt({ card, availablePoints }) {
  return new Promise((resolve) => {
    redeemPointsModalContext = {
      cardId: card?.id || "",
      availablePoints: toNumber(availablePoints),
      resolve,
    };

    if (els.redeemPointsModalTitle) {
      els.redeemPointsModalTitle.textContent = "Redeem Points";
    }
    if (els.redeemPointsModalCard) {
      els.redeemPointsModalCard.textContent = `Card: ${formatCardShortName(card)} | Current unredeemed: ${formatPoints(availablePoints)}`;
    }
    if (els.redeemPointsInput) {
      els.redeemPointsInput.value = "";
    }
    if (els.redeemPointsError) {
      els.redeemPointsError.style.display = "none";
      els.redeemPointsError.textContent = "";
    }
    if (els.redeemPointsModal) {
      els.redeemPointsModal.style.display = "flex";
    }
    setTimeout(() => els.redeemPointsInput?.focus(), 0);
  });
}

function closeRedeemPointsModal() {
  if (els.redeemPointsModal) {
    els.redeemPointsModal.style.display = "none";
  }
  if (els.redeemPointsError) {
    els.redeemPointsError.style.display = "none";
    els.redeemPointsError.textContent = "";
  }

  if (redeemPointsModalContext?.resolve) {
    redeemPointsModalContext.resolve(null);
  }
  redeemPointsModalContext = null;
}

function saveRedeemedPointsFromModal() {
  if (!redeemPointsModalContext) return;

  const pointsToRedeem = toNumber(els.redeemPointsInput?.value);
  const availablePoints = toNumber(redeemPointsModalContext.availablePoints);

  if (pointsToRedeem <= 0) {
    if (els.redeemPointsError) {
      els.redeemPointsError.textContent = "Enter a valid number of points.";
      els.redeemPointsError.style.display = "block";
    }
    els.redeemPointsInput?.focus();
    return;
  }

  if (pointsToRedeem > availablePoints) {
    if (els.redeemPointsError) {
      els.redeemPointsError.textContent = `You can redeem up to ${formatPoints(availablePoints)}.`;
      els.redeemPointsError.style.display = "block";
    }
    els.redeemPointsInput?.focus();
    return;
  }

  if (els.redeemPointsError) {
    els.redeemPointsError.style.display = "none";
    els.redeemPointsError.textContent = "";
  }

  const resolver = redeemPointsModalContext.resolve;
  redeemPointsModalContext = null;
  if (els.redeemPointsModal) {
    els.redeemPointsModal.style.display = "none";
  }
  if (typeof resolver === "function") {
    resolver(pointsToRedeem);
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
  const spentFor = els.swipeSpentFor?.value.trim() || "";

  if (category === "personal" && !spentFor) {
    showToast("Spent For is required for personal swipes.");
    els.swipeSpentFor?.focus();
    return;
  }

  const swipe = {
    id: editingId || createId(),
    cardId,
    amount,
    type: typeSelect?.value === "E" ? "E" : "F",
    financialYear: normalizeFinancialYear(fySelect?.value),
    category,
    spentFor,
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

  refreshSwipeSpentForRequirement();

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

function refreshSwipeSpentForRequirement() {
  if (!els.swipeSpentFor) return;

  const category = normalizeSwipeCategory(els.swipeCategorySelect?.value);
  const isPersonal = category === "personal";
  els.swipeSpentFor.required = isPersonal;
  els.swipeSpentFor.placeholder = isPersonal
    ? "Required for personal swipes"
    : "Optional for business swipes";
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
  if (els.swipeCardFilter) els.swipeCardFilter.value = "all";
  state.swipeSearch = "";
  if (els.swipeSearchInput) els.swipeSearchInput.value = "";
  swipesAllExpanded = false;
  renderSwipes();
}

function resetRpSpendFilters() {
  state.rpSpendSearch = "";
  if (els.rpSpendSearchInput) els.rpSpendSearchInput.value = "";
  rpSpendsAllExpanded = false;
  renderRpSpends();
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

  refreshSwipeSpentForRequirement();
}

function getSwipeCreatedTime(swipe) {
  const time = new Date(swipe.createdAt || 0).getTime();
  return Number.isNaN(time) ? null : time;
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
      formatDateTime(swipe.createdAt),
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
    const dateA = getSwipeCreatedTime(a) ?? 0;
    const dateB = getSwipeCreatedTime(b) ?? 0;
    return dateB - dateA;
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

  const selectedCardId = els.rpCardSelect?.value || "";
  if (!selectedCardId) {
    showToast("Select a card first.");
    return;
  }

  const productName = els.rpProductName?.value.trim() || "";
  if (!productName) {
    showToast("Enter product name.");
    els.rpProductName?.focus();
    return;
  }

  const partnerName = els.rpPurchasedFrom?.value.trim() || "";
  const originatingCardId = els.rpOriginatingCardId?.value || "";
  const partnerTransferRatio = els.rpPartnerTransferRatio?.value || "";
  const hasPartnerTransferDetails = Boolean(
    originatingCardId
    && partnerName
    && partnerTransferRatio
    && els.rpPurchasedFrom?.dataset.partnerProgramAuto === "true"
  );
  const isPartnerProgram = selectedCardId === partnerProgramPlatformValue || hasPartnerTransferDetails;
  // A source card belongs in Originating Card; the saved platform remains the partner program.
  const cardId = isPartnerProgram ? partnerProgramPlatformValue : selectedCardId;

  if (isPartnerProgram && els.rpCardSelect) {
    els.rpCardSelect.value = partnerProgramPlatformValue;
  }
  const pointsReceived = toNumber(els.rpPointsReceived?.value);

  if (isPartnerProgram && !partnerName) {
    showToast("Partner name is required.");
    els.rpPurchasedFrom?.focus();
    return;
  }

  if (isPartnerProgram && !partnerTransferRatio) {
    showToast("Redemption ratio is required for partner programs.");
    els.rpPartnerTransferRatio?.focus();
    return;
  }

  if (isPartnerProgram && toNumber(els.rpPoints?.value) > 0 && !originatingCardId) {
    showToast("Select the originating card for the redeemed points.");
    els.rpOriginatingCardId?.focus();
    return;
  }

  const editingId = els.editingRpSpendId?.value || "";
  const existingIndex = editingId
    ? state.rpSpends.findIndex((item) => item.id === editingId)
    : -1;
  const existingSpend = existingIndex >= 0 ? state.rpSpends[existingIndex] : null;
  const purchaseId = existingIndex >= 0
    ? state.rpSpends[existingIndex].purchaseId || state.rpSpends[existingIndex].id
    : els.editingRpPurchaseId?.value || createId();

  const enteredPoints = toNumber(els.rpPoints?.value);
  const isCardProductSpend = Boolean(selectedCardId && !isPartnerProgram);
  const keepPointsUnredeemed = Boolean(els.rpUnredeemedPoints?.checked);
  const existingIsUnredeemedRecord = isUnredeemedPointsRecord(existingSpend);
  const isUnredeemedRecord = Boolean(selectedCardId && !isPartnerProgram && keepPointsUnredeemed);

  if (keepPointsUnredeemed && (!selectedCardId || isPartnerProgram)) {
    showToast("Unredeemed Points can only be tracked against a selected card or platform.");
    return;
  }

  if (existingIsUnredeemedRecord && !isUnredeemedRecord) {
    showToast("Keep Unredeemed Points checked when editing the card's balance record.");
    return;
  }

  if (isUnredeemedRecord && existingSpend && !existingIsUnredeemedRecord && getRpSpendRedemptionAmount(existingSpend) > 0) {
    showToast("A record with redeemed points cannot be converted into the unredeemed balance record.");
    return;
  }

  if (isUnredeemedRecord && getUnredeemedPointsSourceRecord(selectedCardId, existingSpend?.id || "")) {
    showToast("This card already has one Unredeemed Points record. Edit that record instead.");
    return;
  }

  const redeemedSourceCardId = isPartnerProgram
    ? originatingCardId
    : isCardProductSpend && !keepPointsUnredeemed
      ? selectedCardId
      : "";

  const redeemedPointsForSpend = isCardProductSpend && !keepPointsUnredeemed
    ? enteredPoints
    : isUnredeemedRecord
      ? 0
      : els.rpRedeemedPoints?.value;
  const consumedBeforeSourceEdit = isUnredeemedRecord
    ? getUnredeemedSourceConsumedPoints(selectedCardId, existingSpend?.id || "")
    : 0;
  const storedPoints = isUnredeemedRecord
    ? enteredPoints + consumedBeforeSourceEdit
    : els.rpPoints?.value;

  const rpSpend = normalizeRpSpend({
    id: editingId || createId(),
    purchaseId,
    cardId,
    points: storedPoints,
    redeemedPoints: redeemedPointsForSpend,
    unredeemedPointsRecord: isUnredeemedRecord,
    unredeemedBalanceInitialized: isUnredeemedRecord
      || existingSpend?.unredeemedBalanceInitialized === true,
    redemptionModel: "split-v2",
    pointsValue: els.rpPointsValue?.value,
    redemptionCharges: els.rpRedemptionCharges?.value,
    cardPaid: els.rpCardPaid?.value,
    voucherPaid: els.rpVoucherPaid?.value,
    partnerProgram: isPartnerProgram,
    purchasedFrom: partnerName,
    partnerName,
    originatingCardId: isPartnerProgram ? originatingCardId : "",
    partnerTransferRatio: isPartnerProgram ? partnerTransferRatio : "",
    productName,
    productValue: els.rpProductValue?.value,
    pointsReceived: els.rpPointsReceived?.value,
    createdAt: existingIndex >= 0
      ? state.rpSpends[existingIndex].createdAt
      : new Date().toISOString(),
  });

  const hasAnyValue = [
    rpSpend.points,
    rpSpend.redeemedPoints,
    rpSpend.pointsValue,
    rpSpend.redemptionCharges,
    rpSpend.cardPaid,
    rpSpend.voucherPaid,
    rpSpend.productValue,
    rpSpend.pointsReceived,
  ].some((value) => toNumber(value) > 0);

  if (!hasAnyValue && !(isUnredeemedRecord && enteredPoints === 0)) {
    showToast("Enter points, value, card amount, voucher amount, or product value.");
    return;
  }

  const redemptionAmount = redeemedSourceCardId
    ? getRpSpendRedemptionAmount(rpSpend)
    : 0;
  const redemptionSourceCard = redeemedSourceCardId ? getCardById(redeemedSourceCardId) : null;
  const priorRedemptionAmount = existingSpend
    && redeemedSourceCardId
    && getRpSpendRedeemedSourceCardId(existingSpend) === redeemedSourceCardId
    ? getRpSpendRedemptionAmount(existingSpend)
    : 0;

  if (redemptionAmount > 0) {
    const redemptionSourceRecord = getUnredeemedPointsSourceRecord(redeemedSourceCardId);
    if (!redemptionSourceCard && !redemptionSourceRecord) {
      showToast("Select a valid originating card for this redemption.");
      return;
    }

    const availablePoints = getCardUnredeemedPoints(redemptionSourceCard || redeemedSourceCardId) + priorRedemptionAmount;
    if (redemptionAmount > availablePoints) {
      const sourceName = redemptionSourceCard
        ? formatCardShortName(redemptionSourceCard)
        : formatRpSourceName(redeemedSourceCardId);
      showToast(`You can redeem up to ${formatPoints(availablePoints)} from ${sourceName}.`);
      els.rpPoints?.focus();
      return;
    }
  }

  if (existingIndex >= 0) {
    // Determine previous product-level points for this purchase (before overwrite)
    const purchaseId = state.rpSpends[existingIndex].purchaseId || state.rpSpends[existingIndex].id;
    const priorRep = state.rpSpends.find((row) => (row.purchaseId || row.id) === purchaseId && toNumber(row.pointsReceived) > 0);
    const priorPoints = priorRep ? toNumber(priorRep.pointsReceived) : 0;

    // Restore the old redemption before applying the edited row's new amount.
    restoreRpSpendRedemption(existingSpend);

    // Update the edited row
    state.rpSpends[existingIndex] = rpSpend;

    // If pointsReceived changed compared to prior group value, propagate it.
    const newPoints = toNumber(rpSpend.pointsReceived);
    const shouldSyncPoints = newPoints !== priorPoints;

    syncRpProductFieldsForPurchase(rpSpend, shouldSyncPoints);
  } else {
    state.rpSpends.push(rpSpend);
  }

  if (redemptionAmount > 0) {
    const result = applyCardPointRedemption(redeemedSourceCardId, redemptionAmount);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
  }

  // Distribute redeemed value proportionally if this is a partner program with redeemed value
  if (isPartnerProgram && rpSpend.partnerName && toNumber(rpSpend.pointsValue) > 0) {
    distributePartnerRedeemedValue(rpSpend.partnerName, toNumber(rpSpend.pointsValue));
  }

  syncRpRedeemedBenefitsFromSpends();
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
  if (els.rpPurchasedFrom) {
    delete els.rpPurchasedFrom.dataset.partnerProgramAuto;
  }
  if (els.rpOriginatingCardId) {
    els.rpOriginatingCardId.value = "";
  }
  if (els.rpPartnerTransferRatio) {
    els.rpPartnerTransferRatio.value = "";
  }
  updatePartnerTransferDetailsButton();

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
    els.rpRedeemedPoints,
    els.rpPointsValue,
    els.rpRedemptionCharges,
    els.rpCardPaid,
    els.rpVoucherPaid,
  ].forEach((input) => {
    if (input) input.value = "";
  });

  if (els.rpUnredeemedPoints) els.rpUnredeemedPoints.checked = false;

  if (els.rpCardSelect) els.rpCardSelect.selectedIndex = 0;
  if (els.rpOriginatingCardId) els.rpOriginatingCardId.value = "";
  updatePartnerTransferDetailsButton();
  updateRpPaidValue();
  refreshAllFieldStates();
}

function prepareNextRpPaymentRow(previousRow) {
  if (els.editingRpSpendId) els.editingRpSpendId.value = "";
  if (els.editingRpPurchaseId) els.editingRpPurchaseId.value = previousRow.purchaseId || previousRow.id || "";
  if (els.rpPurchasedFrom) {
    els.rpPurchasedFrom.value = previousRow.partnerName || previousRow.purchasedFrom || "";
    if (isPartnerProgramRpSpend(previousRow)) {
      els.rpPurchasedFrom.dataset.partnerProgramAuto = "true";
    } else {
      delete els.rpPurchasedFrom.dataset.partnerProgramAuto;
    }
  }
  if (els.rpPartnerTransferRatio) {
    els.rpPartnerTransferRatio.value = previousRow.partnerTransferRatio || "";
  }
  if (els.rpProductName) els.rpProductName.value = previousRow.productName || "";
  if (els.rpProductValue) els.rpProductValue.value = previousRow.productValue || "";
  // Do not pre-fill points received for subsequent payment rows to avoid
  // duplicating the same product-level points across multiple rows.
  if (els.rpPointsReceived) els.rpPointsReceived.value = "";
  if (els.rpOriginatingCardId) {
    els.rpOriginatingCardId.value = previousRow.originatingCardId || "";
  }
  if (els.saveRpSpendBtn) els.saveRpSpendBtn.textContent = "Add Payment Row";
  clearRpPaymentFields();
  if (els.rpOriginatingCardId) {
    els.rpOriginatingCardId.value = previousRow.originatingCardId || "";
  }
  updatePartnerTransferDetailsButton();
  els.rpCardSelect?.focus();
}

function syncRpProductFieldsForPurchase(sourceRow, syncPoints = false) {
  const purchaseId = sourceRow.purchaseId || sourceRow.id;
  state.rpSpends = state.rpSpends.map((row) => {
    if ((row.purchaseId || row.id) !== purchaseId || row.id === sourceRow.id) return row;

    const updated = {
      ...row,
      partnerName: sourceRow.partnerName,
      purchasedFrom: sourceRow.purchasedFrom,
      originatingCardId: sourceRow.originatingCardId,
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
      restoreRpSpendRedemption(rpSpend);
      state.rpSpends = state.rpSpends.filter((item) => item.id !== rpSpend.id);
      syncRpRedeemedBenefitsFromSpends();
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
    state.rpSpends
      .filter((item) => (item.purchaseId || item.id) === pid)
      .forEach(restoreRpSpendRedemption);
    state.rpSpends = state.rpSpends.filter((item) => (item.purchaseId || item.id) !== pid);
    syncRpRedeemedBenefitsFromSpends();
    saveState();
    render();
    showToast("Product and its payment rows deleted.");
    return;
  }
}

function populateRpSpendForm(rpSpend) {
  if (els.editingRpSpendId) els.editingRpSpendId.value = rpSpend.id || "";
  if (els.rpCardSelect) els.rpCardSelect.value = rpSpend.cardId || "";
  if (els.rpPoints) els.rpPoints.value = isUnredeemedPointsRecord(rpSpend)
    ? getRpSpendRemainingPoints(rpSpend) || ""
    : getRpSpendTotalPoints(rpSpend) || "";
  if (els.rpRedeemedPoints) els.rpRedeemedPoints.value = rpSpend.redeemedPoints || "";
  if (els.rpUnredeemedPoints) {
    const totalPoints = getRpSpendTotalPoints(rpSpend);
    const redeemedPoints = Math.min(totalPoints, toNumber(rpSpend.redeemedPoints));
    els.rpUnredeemedPoints.checked = isUnredeemedPointsRecord(rpSpend)
      || (!isPartnerProgramRpSpend(rpSpend) && totalPoints > 0 && redeemedPoints < totalPoints);
  }
  if (els.rpPointsValue) {
    els.rpPointsValue.value = rpSpend.pointsValue ? toNumber(rpSpend.pointsValue).toFixed(2) : "";
  }
  if (els.rpRedemptionCharges) els.rpRedemptionCharges.value = rpSpend.redemptionCharges || "";
  if (els.rpCardPaid) els.rpCardPaid.value = rpSpend.cardPaid || "";
  if (els.rpVoucherPaid) els.rpVoucherPaid.value = rpSpend.voucherPaid || "";
  if (els.rpPurchasedFrom) {
    els.rpPurchasedFrom.value = rpSpend.partnerName || rpSpend.purchasedFrom || "";
    if (isPartnerProgramRpSpend(rpSpend)) {
      els.rpPurchasedFrom.dataset.partnerProgramAuto = "true";
    } else {
      delete els.rpPurchasedFrom.dataset.partnerProgramAuto;
    }
  }
  if (els.rpOriginatingCardId) {
    els.rpOriginatingCardId.value = rpSpend.originatingCardId || "";
  }
  if (els.rpPartnerTransferRatio) {
    els.rpPartnerTransferRatio.value = rpSpend.partnerTransferRatio || "";
  }
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
  
  // Show info message for partner programs about auto-distribution
  if (isPartnerProgramRpSpend(rpSpend) && (rpSpend.partnerName || rpSpend.purchasedFrom)) {
    showToast("Note: Redeemed value will be distributed proportionally across all cards contributing to this partner.");
  }
  
  updateRpPaidValue();
  updatePartnerTransferDetailsButton();
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
  const searchQuery = state.rpSpendSearch?.trim().toLowerCase() || "";
  const filteredGroups = sortedGroups.filter((group) => {
    if (!searchQuery) return true;

    const groupCardNames = group.items
      .map((item) => formatRpSourceName(item.cardId))
      .join(" ");

    const groupSearchText = [
      group.productName,
      group.purchasedFrom,
      groupCardNames,
      group.items.map((item) => item.partnerName || item.purchasedFrom).join(" "),
      group.items.map((item) => item.productName).join(" "),
      group.items.map((item) => item.points).join(" "),
      group.items.map((item) => item.redeemedPoints).join(" "),
      group.items.map((item) => item.pointsValue).join(" "),
      group.items.map((item) => item.cardPaid).join(" "),
      group.items.map((item) => item.voucherPaid).join(" "),
      group.items.map((item) => getRpSpendPaidValue(item)).join(" "),
      group.items.map((item) => item.productValue).join(" "),
      group.items.map((item) => item.pointsReceived).join(" "),
    ]
      .join(" ")
      .toLowerCase();

    let matchesSearch = groupSearchText.includes(searchQuery);

    if (!matchesSearch) {
      const numericQuery = searchQuery.replace(/[^0-9.\-]/g, "");
      if (numericQuery) {
        matchesSearch = group.items.some((item) => {
          const numericFields = [
            toNumber(item.points),
            toNumber(item.redeemedPoints),
            toNumber(item.pointsValue),
            toNumber(item.redemptionCharges),
            toNumber(item.cardPaid),
            toNumber(item.voucherPaid),
            toNumber(item.productValue),
            toNumber(item.pointsReceived),
            toNumber(getRpSpendPaidValue(item)),
          ].map((value) => String(value));
          return numericFields.some((value) => value.includes(numericQuery));
        });
      }
    }

    return matchesSearch;
  });

  const totalGroups = filteredGroups.length;
  if (!totalGroups) {
    els.rpSpendsTable.appendChild(
      createEmptyState(
        searchQuery ? "No matching RP spends" : "No RP spends logged",
        searchQuery
          ? "Try a different product, brand, card, points, or value."
          : "Add reward-point purchases with card, voucher, and points value details."
      )
    );
    return;
  }

  const head = document.createElement("div");
  head.className = "table-head";
  head.innerHTML = `
    <span>Product / Service Details</span>
    <span>Card / Platform</span>
    <span>Earned Points</span>
    <span>Points Value</span>
    <span>Paid Value</span>
    <span>Points Used</span>
    <span></span>
  `;
  els.rpSpendsTable.appendChild(head);

  const shouldShowAll = Boolean(searchQuery);
  const visibleCount = shouldShowAll ? totalGroups : (rpSpendsAllExpanded ? totalGroups : INITIAL_VISIBLE_CARDS);
  const groupsToRender = filteredGroups.slice(0, visibleCount);

  groupsToRender.forEach((group) => {
    const row = document.createElement("article");
    row.className = "card-row rp-spend-row";
    
    const totalPaidValue = group.items.reduce((sum, item) => sum + getRpSpendPaidValue(item), 0);
    const totalPointsUsed = group.items.reduce((sum, item) => {
      if (isUnredeemedPointsRecord(item)) return sum;
      return sum + getRpSpendRedemptionAmount(item);
    }, 0);
    const totalPointsValue = group.items.reduce((sum, item) => sum + toNumber(item.pointsValue), 0);
    // Treat pointsReceived as a product-level value (one value per purchase),
    // do not sum across payment rows to avoid multiplying the same Neucoins.
    const totalEarned = toNumber(group.pointsReceived);
    const getContributingCardLabel = (item) => {
      const card = getCardById(item.originatingCardId || item.sourceCardId || "");
      return card ? [card.issuer, card.name].filter(Boolean).join(" ").trim() : "NA";
    };

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
                ${getRpSpendTotalPoints(item) > 0 ? `${formatPoints(getRpSpendDisplayPoints(item))}` : ''}
                ${toNumber(item.cardPaid) > 0 ? ` Card: ${formatMoney(item.cardPaid)}` : ''}
                ${toNumber(item.voucherPaid) > 0 ? `Voucher: ${formatMoney(item.voucherPaid)}` : ''}
              </span>
              ${isPartnerProgramRpSpend(item) ? `<span class="card-meta" style="display:block; margin-top:4px;">Card: ${escapeHtml(getContributingCardLabel(item))}</span>` : ""}
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
        <span class="cell-label">Points Value</span>
        <strong>${formatMoney(totalPointsValue)}</strong>
      </div>
      <div class="money-cell">
        <span class="cell-label">Consolidated Paid</span>
        <strong>${formatMoney(totalPaidValue)}</strong>
        <span class="card-meta">Value: ${formatMoney(group.productValue)}</span>
      </div>
       <div class="money-cell">
         <span class="cell-label">Points Used</span>
         <strong>${formatPoints(totalPointsUsed)}</strong>
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

  if (!shouldShowAll && !rpSpendsAllExpanded && totalGroups > visibleCount) {
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
  syncRpRedeemedBenefitsFromSpends();
  // Always sync lounge benefits to ensure all cards have correct lounge benefits
  syncLoungeBenefitsFromVisits();
  updateAppHeaderTitle(state.currentView);
  renderDashboard();
  renderPprWidget();
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
    const typeOptions = [
      !editableBenefitTypes.includes(benefit.type) && benefit.type
        ? `<option value="${escapeAttribute(benefit.type)}" selected hidden>${escapeHtml(benefit.type)}</option>`
        : "",
      ...editableBenefitTypes.map((type) => `<option value="${escapeHtml(type)}"${benefit.type === type ? " selected" : ""}>${escapeHtml(type)}</option>`),
    ].join("");

    const valueTypeOptions = [
      !editableBenefitValueTypes.some((type) => type.value === benefit.valueType) && benefit.valueType
        ? `<option value="${escapeAttribute(benefit.valueType)}" selected hidden>${escapeHtml(benefit.valueType === "points" ? "Points (Unredeemed)" : benefit.valueType)}</option>`
        : "",
      `<option value=""${!benefit.valueType ? " selected" : ""}></option>`,
      ...editableBenefitValueTypes.map((type) => `<option value="${escapeAttribute(type.value)}"${benefit.valueType === type.value ? " selected" : ""}>${escapeHtml(type.label)}</option>`),
    ].join("");

    const row = document.createElement("div");
    row.className = "benefit-row";
    row.dataset.index = String(index);
    row.setAttribute("data-index", index);
    row.innerHTML = `
      <label class="field benefit-type-field">
        <span>Type</span>
        <select data-benefit-field="type">
          ${typeOptions}
        </select>
      </label>
      <label class="field">
        <span>Benefit</span>
        <input data-benefit-field="label" type="text" value="${escapeAttribute(benefit.label)}" placeholder="e.g. 5000 Pts / Amazon Voucher" autocomplete="off" />
      </label>
      <label class="field">
        <span>Value type</span>
        <select data-benefit-field="valueType">
          ${valueTypeOptions}
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
        ${formatBenefitSplitHtml(totals.benefits, getCardUnredeemedPoints(card))}
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
      (benefit) => !isRpRedeemedAutoBenefit(benefit) && (benefit.label.trim() || toNumber(benefit.amount) > 0 || toNumber(benefit.pointsAmount) > 0)
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
    ? card.benefits
      .filter((benefit) => !isRpRedeemedAutoBenefit(benefit))
      .map((b) => ({ ...b, id: b.id || createId() }))
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
      ...draftBenefits[Number(row.dataset.index)],
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
      migrateLegacyPointsRedeemedBenefitsToRpSpends();
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
      migrateLegacyPointsRedeemedBenefitsToRpSpends();
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

function getRpSpendTotalPoints(rpSpend) {
  const points = toNumber(rpSpend?.points);
  const redeemedPoints = toNumber(rpSpend?.redeemedPoints);
  const isSplitModel = rpSpend?.redemptionModel === "split-v2" || String(rpSpend?.id || "").startsWith("legacy-");
  return !isSplitModel && redeemedPoints > 0 ? points + redeemedPoints : points;
}

function getRpSpendRemainingPoints(rpSpend) {
  if (isUnredeemedPointsRecord(rpSpend)) {
    return getUnredeemedSourceBalance(rpSpend);
  }

  return Math.max(0, getRpSpendTotalPoints(rpSpend) - getRpSpendRedemptionAmount(rpSpend));
}

function getRpSpendDisplayPoints(rpSpend) {
  if (!rpSpend || isPartnerProgramRpSpend(rpSpend)) {
    return getRpSpendTotalPoints(rpSpend);
  }

  if (isUnredeemedPointsRecord(rpSpend)) {
    return getRpSpendRemainingPoints(rpSpend);
  }

  const redeemedPoints = getRpSpendRedemptionAmount(rpSpend);
  if (redeemedPoints > 0) {
    return redeemedPoints;
  }

  const sourceCardId = String(rpSpend.cardId || "").trim();
  if (!sourceCardId) return getRpSpendRemainingPoints(rpSpend);

  let pendingPartnerRedemptions = state.rpSpends
    .filter((item) => isPartnerProgramRpSpend(item)
      && getRpSpendRedeemedSourceCardId(item) === sourceCardId)
    .reduce((sum, item) => sum + getRpSpendTotalPoints(item), 0);

  const sourceRows = state.rpSpends
    .filter((item) => !isPartnerProgramRpSpend(item) && item.cardId === sourceCardId)
    .slice()
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

  for (const sourceRow of sourceRows) {
    const sourcePoints = getRpSpendRemainingPoints(sourceRow);
    const redeemedFromRow = Math.min(sourcePoints, pendingPartnerRedemptions);
    pendingPartnerRedemptions -= redeemedFromRow;

    if (sourceRow.id === rpSpend.id) {
      return Math.max(0, sourcePoints - redeemedFromRow);
    }
  }

  return getRpSpendRemainingPoints(rpSpend);
}

function getRpSpendTotal() {
  return state.rpSpends.reduce((sum, rpSpend) => sum + getRpSpendPaidValue(rpSpend), 0);
}

function getRpPointsUsedTotal() {
  return state.rpSpends.reduce((sum, rpSpend) => sum + getRpSpendRedemptionAmount(rpSpend), 0);
}

function getRpPointsUsageTotals() {
  return state.rpSpends.reduce(
    (totals, rpSpend) => {
      if (isUnredeemedPointsRecord(rpSpend)) return totals;

      const points = getRpSpendTotalPoints(rpSpend);
      const redeemedPoints = getRpSpendRedemptionAmount(rpSpend);
      totals.spent += redeemedPoints;
      totals.notSpent += Math.max(0, points - redeemedPoints);
      return totals;
    },
    { spent: 0, notSpent: 0 }
  );
}

function getRpPointsReceivedTotal() {
  // Sum pointsReceived per purchase group (one value per purchase),
  // so multiple payment rows don't multiply the same Neucoins.
  const groups = {};
  state.rpSpends.forEach((spend) => {
    const pid = spend.purchaseId || spend.id;
    const currentValue = toNumber(spend.pointsReceived || 0);
    if (!groups[pid] || (groups[pid] <= 0 && currentValue > 0)) {
      groups[pid] = currentValue;
    }
  });

  return Object.values(groups).reduce((sum, v) => sum + v, 0);
}

function isPartnerProgramRpSpend(rpSpend) {
  return rpSpend?.cardId === partnerProgramPlatformValue;
}

function getPartnerProgramPoints(rpSpend) {
  const receivedPoints = toNumber(rpSpend?.pointsReceived || 0);
  if (receivedPoints > 0) return receivedPoints;
  const ratio = parsePartnerTransferRatio(rpSpend?.partnerTransferRatio);
  const partnerTransferPoints = toNumber(rpSpend?.redeemedPoints) || getRpSpendTotalPoints(rpSpend);
  if (ratio && partnerTransferPoints > 0) {
    return computePartnerTransferPoints(partnerTransferPoints, ratio);
  }
  return partnerTransferPoints;
}

function getPprPurchaseGroups() {
  const groups = new Map();

  state.rpSpends.forEach((spend) => {
    if (!isPartnerProgramRpSpend(spend)) return;

    const purchaseId = spend.purchaseId || spend.id;
    const partnerName = String(spend.partnerName || spend.purchasedFrom || "Partner").trim() || "Partner";
    const existing = groups.get(purchaseId);
    const partnerPoints = getPartnerProgramPoints(spend);
    const partnerValue = toNumber(spend.pointsValue);

    if (!existing) {
      groups.set(purchaseId, {
        purchaseId,
        partnerName,
        partnerPoints,
        partnerValue,
        latestDate: spend.createdAt || "",
      });
      return;
    }

    if (existing.partnerPoints <= 0 && partnerPoints > 0) {
      existing.partnerPoints = partnerPoints;
    }
    existing.partnerValue += partnerValue;
    if (new Date(spend.createdAt || 0) > new Date(existing.latestDate || 0)) {
      existing.latestDate = spend.createdAt || existing.latestDate;
    }
    if (!existing.partnerName && partnerName) {
      existing.partnerName = partnerName;
    }
  });

  return Array.from(groups.values());
}

function getPprSummary() {
  const purchaseGroups = getPprPurchaseGroups().filter((group) => toNumber(group.partnerPoints) > 0);
  const partnerMap = new Map();

  purchaseGroups.forEach((group) => {
    const partnerName = group.partnerName || "Partner";
    const entry = partnerMap.get(partnerName) || {
      partnerName,
      points: 0,
      value: 0,
      purchases: 0,
    };

    entry.points += toNumber(group.partnerPoints);
    entry.value += toNumber(group.partnerValue);
    entry.purchases += 1;
    partnerMap.set(partnerName, entry);
  });

  const partnerRows = Array.from(partnerMap.values()).sort((a, b) => b.points - a.points || a.partnerName.localeCompare(b.partnerName));
  const totalPoints = partnerRows.reduce((sum, row) => sum + row.points, 0);

  return {
    totalPoints,
    purchaseCount: purchaseGroups.length,
    partnerCount: partnerRows.length,
    partnerRows,
  };
}

function distributePartnerRedeemedValue(partnerName, totalRedeemedValue) {
  if (!partnerName || totalRedeemedValue < 0) return;

  // Find all RP spends for this partner
  const partnerSpends = state.rpSpends.filter(spend => 
    isPartnerProgramRpSpend(spend) && 
    (spend.partnerName || spend.purchasedFrom) === partnerName
  );

  if (partnerSpends.length === 0) return;

  // Group by originatingCardId and calculate total points per card
  const cardContributions = {};
  let totalPartnerPoints = 0;

  partnerSpends.forEach(spend => {
    const originatingCardId = String(spend.originatingCardId || "").trim();
    if (!originatingCardId) return; // Skip if no originating card

    const spendPoints = getPartnerProgramPoints(spend);
    if (spendPoints <= 0) return;

    if (!cardContributions[originatingCardId]) {
      cardContributions[originatingCardId] = {
        points: 0,
        spends: []
      };
    }

    cardContributions[originatingCardId].points += spendPoints;
    cardContributions[originatingCardId].spends.push(spend);
    totalPartnerPoints += spendPoints;
  });

  if (totalPartnerPoints <= 0) return;

  // Distribute redeemed value proportionally (or set to 0 if clearing)
  Object.keys(cardContributions).forEach(originatingCardId => {
    const contribution = cardContributions[originatingCardId];
    const proportion = contribution.points / totalPartnerPoints;
    const cardRedeemedValue = totalRedeemedValue * proportion;

    // Replace previous value completely with new value (including 0)
    contribution.spends.forEach(spend => {
      spend.pointsValue = cardRedeemedValue;
    });
  });
}

let pprValueModalPartnerName = null;

function showPprValueModal(partnerName, currentValue = 0) {
  pprValueModalPartnerName = partnerName;
  
  if (els.pprValueModalTitle) {
    els.pprValueModalTitle.textContent = `Enter Redeemed Value`;
  }
  
  if (els.pprValueModalPartner) {
    els.pprValueModalPartner.textContent = `Partner: ${escapeHtml(partnerName)}`;
  }
  
  if (els.pprValueInput) {
    els.pprValueInput.value = currentValue > 0 ? currentValue : "";
    els.pprValueInput.focus();
  }
  
  if (els.pprValueModal) {
    els.pprValueModal.style.display = "flex";
  }
}

function savePprPartnerValue() {
  if (!pprValueModalPartnerName) return;
  
  const value = toNumber(els.pprValueInput?.value || 0);
  
  if (value < 0) {
    showToast("Redeemed value cannot be negative.");
    els.pprValueInput?.focus();
    return;
  }
  
  // Distribute the value proportionally (including 0 to clear)
  distributePartnerRedeemedValue(pprValueModalPartnerName, value);
  
  // Sync benefits and save
  syncRpRedeemedBenefitsFromSpends();
  saveState();
  render();
  
  // Close modal
  if (els.pprValueModal) {
    els.pprValueModal.style.display = "none";
  }
  
  const message = value > 0 
    ? `Redeemed value of ₹${formatMoney(value)} distributed across contributing cards.`
    : `Redeemed value cleared for ${pprValueModalPartnerName}.`;
  showToast(message);
  pprValueModalPartnerName = null;
}

function renderPprWidget() {
  const summary = getPprSummary();

  if (els.dashboardPprValue) {
    els.dashboardPprValue.textContent = formatPoints(summary.totalPoints);
  }

  if (els.dashboardPprHint) {
    els.dashboardPprHint.textContent = "";
  }

  if (els.pprWidgetTotal) {
    els.pprWidgetTotal.textContent = formatPoints(summary.totalPoints);
  }

  if (els.pprWidgetCount) {
    els.pprWidgetCount.textContent = String(summary.partnerCount);
  }

  if (els.pprWidgetHint) {
    els.pprWidgetHint.textContent = summary.purchaseCount
      ? `${summary.purchaseCount} partner entr${summary.purchaseCount === 1 ? "y" : "ies"} recorded.`
      : "Hotel and airline partner points entered through RP Spends.";
  }

  if (!els.pprWidgetList) return;

  if (!summary.purchaseCount) {
    els.pprWidgetList.innerHTML = `
      <div class="empty-state ppr-empty-state">
        <div class="empty-icon" aria-hidden="true"></div>
        <h3>No partner rewards yet</h3>
        <p class="empty-copy">Select Hotel/Airline Partners in RP Spends and enter the partner name to see rewards here.</p>
      </div>
    `;
    return;
  }

  if (!els.pprWidgetList) return;

  if (!summary.purchaseCount) {
    els.pprWidgetList.innerHTML = `
      <div class="empty-state ppr-empty-state">
        <div class="empty-icon" aria-hidden="true"></div>
        <h3>No partner rewards yet</h3>
        <p class="empty-copy">Select Hotel/Airline Partners in RP Spends and enter the partner name to see rewards here.</p>
      </div>
    `;
    return;
  }

  // Create table header
  let html = `
    <div class="cards-table ppr-table" style="width: 100%; gap: 0; margin: 0; max-width: 820px;">
      <div class="table-head" style="padding: 10px 12px; gap: 0; margin: 0; margin-bottom: 0;">
        <span style="flex: 1; padding: 0 6px;">PARTNER DETAILS</span>
        <span style="min-width: 112px; padding: 0 6px; text-align: center;">POINTS EARNED</span>
        <span style="min-width: 112px; padding: 0 6px; text-align: center;">REDEEMED VALUE</span>
        <span style="min-width: 84px; padding: 0 6px; text-align: center;">STATUS</span>
        <span style="min-width: 42px; padding: 0 6px; text-align: center;"></span>
      </div>
  `;

  // Add each partner row
  summary.partnerRows.forEach((row) => {
    const hasValue = toNumber(row.value) > 0;
    const statusLabel = hasValue ? "Redeemed" : "Pending";
    const statusColor = hasValue ? "#10b981" : "#f59e0b";
    
    html += `
      <article class="card-row ppr-partner-row" data-partner-name="${escapeAttribute(row.partnerName)}" tabindex="0" role="button" aria-label="View details for ${escapeAttribute(row.partnerName)}" style="padding: 10px 12px; gap: 0; align-items: center; margin: 0;">
        <div class="card-name" style="flex: 1; padding: 0 6px;">
          <strong style="min-width:0; font-size: 0.95rem;">${escapeHtml(row.partnerName)}</strong>
          <span class="card-meta" style="display: block; margin-top: 3px; font-size: 0.85rem;">${escapeHtml(`${row.purchases} ${row.purchases === 1 ? "entry" : "entries"}`)}</span>
        </div>
        
        <div class="money-cell" style="min-width: 112px; padding: 0 6px; text-align: center; flex-direction: row; gap: 6px;">
          <strong style="color: #10b981; font-size: 1rem;">${escapeHtml(formatPoints(row.points))}</strong>
        </div>
        
        <div class="money-cell" style="min-width: 112px; padding: 0 6px; text-align: center; flex-direction: row; gap: 6px;">
          <strong style="color: #3b82f6; font-size: 1rem;">${escapeHtml(formatMoney(row.value || 0))}</strong>
        </div>
        
        <div class="money-cell" style="min-width: 84px; padding: 0 6px; text-align: center; flex-direction: row; gap: 6px;">
          <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${statusColor};"></span>
          <span style="color: ${statusColor}; font-weight: 500; font-size: 0.9rem;">${statusLabel}</span>
        </div>
        
        <div class="money-cell" style="min-width: 42px; padding: 0 6px; justify-content: center;">
          <div class="row-actions inline-actions" style="gap: 4px;">
            <button class="icon-button subtle ppr-edit-value" data-partner-name="${escapeAttribute(row.partnerName)}" data-current-value="${row.value || 0}" title="Edit redeemed value" aria-label="Edit redeemed value" style="padding: 4px;">
              <svg viewBox="0 0 24 24" width="14">
                <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
          </div>
        </div>
      </article>
    `;
  });

  html += `</div>`;

  els.pprWidgetList.innerHTML = html;
}

function closePprDetailsModal() {
  if (els.pprDetailsModal) els.pprDetailsModal.style.display = "none";
}

function getPprPartnerDetailGroups(partnerName) {
  const normalizedPartnerName = String(partnerName || "").trim();
  if (!normalizedPartnerName) return [];

  const partnerSpends = state.rpSpends
    .filter((spend) => isPartnerProgramRpSpend(spend) && String(spend.partnerName || spend.purchasedFrom || "").trim() === normalizedPartnerName)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  const groups = new Map();
  partnerSpends.forEach((spend) => {
    const purchaseId = spend.purchaseId || spend.id;
    const existing = groups.get(purchaseId);
    if (!existing) {
      groups.set(purchaseId, {
        purchaseId,
        productName: spend.productName || "Reward spend",
        purchasedFrom: spend.purchasedFrom || spend.partnerName || normalizedPartnerName,
        latestDate: spend.createdAt || "",
        items: [spend],
      });
      return;
    }

    existing.items.push(spend);
    if (!existing.productName && spend.productName) existing.productName = spend.productName;
    if (!existing.purchasedFrom && (spend.partnerName || spend.purchasedFrom)) {
      existing.purchasedFrom = spend.partnerName || spend.purchasedFrom || normalizedPartnerName;
    }
    if (new Date(spend.createdAt || 0) > new Date(existing.latestDate || 0)) {
      existing.latestDate = spend.createdAt || existing.latestDate;
    }
  });

  return Array.from(groups.values()).sort((a, b) => new Date(b.latestDate || 0) - new Date(a.latestDate || 0));
}

function handlePprWidgetAction(event) {
  const editButton = event.target.closest(".ppr-edit-value");
  if (editButton) {
    event.stopPropagation();
    const partnerName = editButton.dataset.partnerName || "";
    const currentValue = toNumber(editButton.dataset.currentValue);
    showPprValueModal(partnerName, currentValue);
    return;
  }

  const row = event.target.closest(".ppr-partner-row");
  if (!row) return;

  showPprPartnerDetails(row.dataset.partnerName || row.textContent || "Partner");
}

function showPprPartnerDetails(partnerName) {
  const detailGroups = getPprPartnerDetailGroups(partnerName);
  const totalPoints = detailGroups.reduce((sum, group) => sum + group.items.reduce((groupSum, item) => groupSum + getPartnerProgramPoints(item), 0), 0);
  const totalValue = detailGroups.reduce((sum, group) => sum + group.items.reduce((groupSum, item) => groupSum + toNumber(item.pointsValue), 0), 0);
  const totalEntries = detailGroups.length;

  const getContributingCardLabel = (item) => {
    const card = getCardById(item.originatingCardId || item.sourceCardId || "");
    return card ? formatCardName(card) : "Card not found";
  };

  const getGroupCardLabels = (group) => {
    const labels = [...new Set(group.items.map((item) => getContributingCardLabel(item)).filter(Boolean))];
    return labels.length ? labels : ["Card not found"];
  };

  if (els.pprDetailsModalTitle) els.pprDetailsModalTitle.textContent = partnerName;
  if (els.pprDetailsModalSubtitle) {
    els.pprDetailsModalSubtitle.textContent = `${totalEntries} purchase ${totalEntries === 1 ? "entry" : "entries"} | ${formatPoints(totalPoints)} points | ${formatMoney(totalValue)} redeemed`;
  }

  if (els.pprDetailsModalBody) {
    if (!detailGroups.length) {
      els.pprDetailsModalBody.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon" aria-hidden="true"></div>
          <h3>No associated RP spends</h3>
          <p class="empty-copy">No RP spend entries were found for this partner.</p>
        </div>
      `;
    } else {
      els.pprDetailsModalBody.innerHTML = detailGroups.map((group) => {
        const groupPoints = group.items.reduce((sum, item) => sum + getPartnerProgramPoints(item), 0);
        const groupValue = group.items.reduce((sum, item) => sum + toNumber(item.pointsValue), 0);
        const groupCardLabels = getGroupCardLabels(group);
        return `
          <article class="ppr-detail-card">
            <div class="ppr-detail-card-head">
              <div>
                <strong>${escapeHtml(group.productName || "Reward spend")}</strong>
                <div class="ppr-detail-meta">Contributed by: ${escapeHtml(groupCardLabels.join(", "))}</div>
              </div>
              <div class="ppr-detail-badges">
                <span>${escapeHtml(formatPoints(groupPoints))}</span>
                <span>${escapeHtml(formatMoney(groupValue))}</span>
              </div>
            </div>
            <div class="ppr-detail-items">
              ${group.items.map((item) => `
                <div class="ppr-detail-item">
                  <div>
                    <strong>${escapeHtml(item.productName || "Reward spend")}</strong>
                    <div class="ppr-detail-meta">${escapeHtml(getContributingCardLabel(item))}</div>
                    <div class="ppr-detail-meta">
                      ${escapeHtml(formatPoints(getPartnerProgramPoints(item)))} | ${escapeHtml(formatMoney(getRpSpendPaidValue(item)))} paid
                    </div>
                  </div>
                  <button type="button" class="ghost-button" data-ppr-open-rp="${escapeAttribute(item.id)}">Open RP spend</button>
                </div>
              `).join("")}
            </div>
          </article>
        `;
      }).join("");
    }
  }

  if (els.pprDetailsModal) els.pprDetailsModal.style.display = "flex";
}

function handlePprDetailsAction(event) {
  const button = event.target.closest("[data-ppr-open-rp]");
  if (!button) return;

  const rpSpend = state.rpSpends.find((item) => item.id === button.dataset.pprOpenRp);
  if (!rpSpend) return;

  closePprDetailsModal();
  showView("rpSpends");
  populateRpSpendForm(rpSpend);
  window.scrollTo({ top: 0, behavior: shouldReduceMotion() ? "auto" : "smooth" });
}

function getViewTitle(view) {
  switch (normalizeViewName(view)) {
    case "portfolio":
      return "Portfolio";
    case "swipes":
      return "Swipes";
    case "rpSpends":
      return "RP Spends";
    case "ppr":
      return "Partner Program Rewards";
    case "lounge":
      return "Airport Lounge / Other Benefits";
    default:
      return "Personal Finance";
  }
}

function updateAppHeaderTitle(view = state.currentView) {
  if (els.appPageTitle) {
    els.appPageTitle.textContent = getViewTitle(view);
  }
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
    type: defaultManualBenefitType,
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

function parseFinancialYearLabel(value) {
  const text = String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const match = text.match(/\bfy\s*(\d{2}|\d{4})\s*[-/ ]\s*(\d{2}|\d{4})\b/);
  if (!match) return "";

  let start = match[1];
  let end = match[2];

  if (start.length === 4) start = start.slice(-2);
  if (end.length === 4) end = end.slice(-2);

  return `FY ${start}-${end}`;
}

function getFinancialYearLabelFromDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const startYear = month >= 4 ? year : year - 1;
  const endYear = startYear + 1;
  return `FY ${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
}

function getCurrentFinancialYearLabel(date = new Date()) {
  return getFinancialYearLabelFromDate(date) || "FY 25-26";
}

function normalizeFinancialYear(value) {
  const parsed = parseFinancialYearLabel(value);
  if (parsed) return parsed;
  const allowedYears = ["FY 24-25", "FY 25-26", "FY 26-27", "FY 27-28", "FY 28-29", "FY 29-30"];
  const text = String(value || "").trim();
  return allowedYears.includes(text) ? text : "FY 25-26";
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

function formatCardShortName(card) {
  if (!card) return "Card not found";
  return [card.issuer, card.name].filter(Boolean).join(" ").trim() || "Card not found";
}

function formatRpSourceName(sourceId) {
  const platformNames = {
    CRED: "CRED",
    Shopwise: "Shopwise",
    Maximize: "Maximize",
    Neucoins: "Neucoins",
    "Tata Neu Voucher": "Tata Neu Voucher",
    "Axis Rewards": "Axis Rewards",
    [partnerProgramPlatformValue]: "Hotel/Airline Partners",
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
          const isRedeemedMonetary = benefit?.type === "Points Redeemed" && !isPointBenefit(benefit) && toNumber(benefit.pointsAmount) > 0;
          const impactLabel = isPointBenefit(benefit) ? "Points" : "Monetary";
          const name = isRedeemedMonetary ? formatPoints(benefit.pointsAmount) : (benefit.label || benefit.type);
          return `
            <span class="benefit-line">
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
