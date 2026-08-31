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
const welcomeBenefitPointsType = "Welcome Benefit (Points)";

// Unique issuer banks extracted from the supplied card names. Existing short
// labels are normalized to these display values when cards are loaded.
const issuerBankOptions = [
  "American Express",
  "Axis Bank",
  "Bank of Baroda",
  "Citibank",
  "Federal Bank",
  "HDFC Bank",
  "HSBC",
  "ICICI Bank",
  "IDFC",
  "IndusInd Bank",
  "Yes Bank",
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
  pprManualPoints: [],
  loungeVisits: [],
  loungeCardLimits: [],
  intlTravelTrips: [],
  aiTrainer: {
    examples: [],
    updatedAt: "",
  },
  search: "",
  swipeSearch: "",
  rpSpendSearch: "",
  rpSpendUnredeemedOnly: false,
  statusFilter: "all",
  sort: "netAsc",
  currentView: normalizeViewName(sessionStorage.getItem("currentView")),
};

let draftBenefits = [];
let draftPreviousAnnualFees = [];
let draftFutureAnnualFees = [];
let toastTimer = null;
let loungeChartInstance = null;
let chartJsLoadPromise = null;
let aiModalResolver = null;
let aiModalMode = null;
let aiPendingIntent = null;
let aiPendingResolver = null;
let aiCommandQueue = Promise.resolve();
let pointsModalReturnView = null;
let intlTravelDetailTripId = "";
let intlTravelEditorReturnTripId = "";
let intlTravelEditingExpenseId = "";
let intlTravelEditingConversionId = "";
let intlTravelFormOpen = false;
let intlTravelDraggingExpenseId = "";
let intlTravelExpensesAllExpanded = false;
let pprManualEditingId = "";
const INITIAL_VISIBLE_INTL_TRAVEL_RECORDS = 10;

// Client-side rendering limits to improve initial load performance
const INITIAL_VISIBLE_CARDS = 20;
let cardsAllExpanded = false; // set true when user clicks "Load more"
let swipesAllExpanded = false;
let rpSpendsAllExpanded = false;
let loungeAllExpanded = false;

const els = {};
// Reuse expensive point/fee calculations while a single render is building
// several views and summaries. The cache is cleared as soon as that render
// finishes, so it cannot make state changes stale.
let renderDerivedCache = null;

window.addEventListener("chartjsready", () => {
  if (state.currentView === "lounge" && typeof renderLoungeChart === "function") {
    renderLoungeChart();
  }
});

function ensureChartJsLoaded() {
  if (typeof window.Chart !== "undefined") return Promise.resolve(window.Chart);
  if (chartJsLoadPromise) return chartJsLoadPromise;

  chartJsLoadPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-lounge-chart-library="true"]');
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.Chart), { once: true });
      existingScript.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js";
    script.async = true;
    script.dataset.loungeChartLibrary = "true";
    script.addEventListener("load", () => {
      window.dispatchEvent(new Event("chartjsready"));
      resolve(window.Chart);
    }, { once: true });
    script.addEventListener("error", () => {
      chartJsLoadPromise = null;
      reject(new Error("Chart library could not be loaded."));
    }, { once: true });
    document.head.appendChild(script);
  });

  return chartJsLoadPromise;
}

function getRenderCacheMap(name) {
  if (!renderDerivedCache) return null;
  if (!renderDerivedCache[name]) renderDerivedCache[name] = new Map();
  return renderDerivedCache[name];
}

document.addEventListener("DOMContentLoaded", async () => {
  
  cacheElements();
  await loadState();
  renderIssuerOptions();
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
    axisProgramField: document.getElementById("axisProgramField"),
    axisProgram: document.getElementById("axisProgram"),
    annualFee: document.getElementById("annualFee"),
    taxFee: document.getElementById("taxFee"),
    isLtf: document.getElementById("isLtf"),
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
    intlTravelView: document.getElementById("intlTravelView"),
    appPageTitle: document.getElementById("appPageTitle"),
    dashboardNetValue: document.getElementById("dashboardNetValue"),
    dashboardNetHint: document.getElementById("dashboardNetHint"),
    dashboardDateLabel: document.getElementById("dashboardDateLabel"),
    dashboardGreetingLead: document.getElementById("dashboardGreetingLead"),
    dashboardHeroPoints: document.getElementById("dashboardHeroPoints"),
    dashboardHeroNet: document.getElementById("dashboardHeroNet"),
    dashboardHeroStatus: document.getElementById("dashboardHeroStatus"),
    dashboardPortfolioFeeValue: document.getElementById("dashboardPortfolioFeeValue"),
    dashboardPortfolioPointsValue: document.getElementById("dashboardPortfolioPointsValue"),
    dashboardPortfolioRecoveryValue: document.getElementById("dashboardPortfolioRecoveryValue"),
    dashboardSwipeValue: document.getElementById("dashboardSwipeValue"),
    dashboardSwipeHint: document.getElementById("dashboardSwipeHint"),
    dashboardSwipeBusinessBar: document.getElementById("dashboardSwipeBusinessBar"),
    dashboardSwipePersonalBar: document.getElementById("dashboardSwipePersonalBar"),
    dashboardSwipeBusinessLabel: document.getElementById("dashboardSwipeBusinessLabel"),
    dashboardSwipePersonalLabel: document.getElementById("dashboardSwipePersonalLabel"),
    dashboardSwipeBusinessValue: document.getElementById("dashboardSwipeBusinessValue"),
    dashboardSwipePersonalValue: document.getElementById("dashboardSwipePersonalValue"),
    dashboardLoungeValue: document.getElementById("dashboardLoungeValue"),
    dashboardLoungeHint: document.getElementById("dashboardLoungeHint"),
    dashboardLoungeVisitTypes: document.getElementById("dashboardLoungeVisitTypes"),
    dashboardLoungeAccessMethods: document.getElementById("dashboardLoungeAccessMethods"),
    dashboardLoungeLatestVisit: document.getElementById("dashboardLoungeLatestVisit"),
    dashboardRpValue: document.getElementById("dashboardRpValue"),
    dashboardRpHint: document.getElementById("dashboardRpHint"),
    dashboardPprValue: document.getElementById("dashboardPprValue"),
    dashboardPprHint: document.getElementById("dashboardPprHint"),
    dashboardPprPrograms: document.getElementById("dashboardPprPrograms"),
    dashboardPprEntries: document.getElementById("dashboardPprEntries"),
    dashboardIntlTravelValue: document.getElementById("dashboardIntlTravelValue"),
    dashboardIntlTravelHint: document.getElementById("dashboardIntlTravelHint"),
    dashboardTopBalancesList: document.getElementById("dashboardTopBalancesList"),
    dashboardUpcomingList: document.getElementById("dashboardUpcomingList"),
    dashboardInsightTitle: document.getElementById("dashboardInsightTitle"),
    dashboardInsightText: document.getElementById("dashboardInsightText"),
    dashboardInsightButton: document.getElementById("dashboardInsightButton"),
    pprWidgetHint: document.getElementById("pprWidgetHint"),
    pprWidgetTotal: document.getElementById("pprWidgetTotal"),
    pprWidgetCount: document.getElementById("pprWidgetCount"),
    pprWidgetList: document.getElementById("pprWidgetList"),
    pprValueModal: document.getElementById("pprValueModal"),
    pprValueModalTitle: document.getElementById("pprValueModalTitle"),
    pprValueModalPartner: document.getElementById("pprValueModalPartner"),
    pprRedemptionBatchField: document.getElementById("pprRedemptionBatchField"),
    pprRedemptionBatchSelect: document.getElementById("pprRedemptionBatchSelect"),
    pprRedemptionPreview: document.getElementById("pprRedemptionPreview"),
    pprRedeemPointsInput: document.getElementById("pprRedeemPointsInput"),
    pprValueInput: document.getElementById("pprValueInput"),
    pprValueModalCancelBtn: document.getElementById("pprValueModalCancelBtn"),
    pprValueModalDeleteBtn: document.getElementById("pprValueModalDeleteBtn"),
    pprValueModalSaveBtn: document.getElementById("pprValueModalSaveBtn"),
    addPprManualPointsBtn: document.getElementById("addPprManualPointsBtn"),
    pprManualModal: document.getElementById("pprManualModal"),
    pprManualModalTitle: document.getElementById("pprManualModalTitle"),
    pprManualPartnerSelect: document.getElementById("pprManualPartnerSelect"),
    pprManualPointsInput: document.getElementById("pprManualPointsInput"),
    pprManualValueInput: document.getElementById("pprManualValueInput"),
    pprManualNotesInput: document.getElementById("pprManualNotesInput"),
    pprManualDateInput: document.getElementById("pprManualDateInput"),
    pprManualCancelBtn: document.getElementById("pprManualCancelBtn"),
    pprManualSaveBtn: document.getElementById("pprManualSaveBtn"),
    redeemPointsModal: document.getElementById("redeemPointsModal"),
    redeemPointsModalTitle: document.getElementById("redeemPointsModalTitle"),
    redeemPointsModalCard: document.getElementById("redeemPointsModalCard"),
    redeemPointsInputLabel: document.getElementById("redeemPointsInputLabel"),
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
    openIntlTravelBtn: document.getElementById("openIntlTravelBtn"),
    backFromPortfolioBtn: document.getElementById("backFromPortfolioBtn"),
    backFromSwipesBtn: document.getElementById("backFromSwipesBtn"),
    backFromRpSpendsBtn: document.getElementById("backFromRpSpendsBtn"),
    backFromPprBtn: document.getElementById("backFromPprBtn"),
    backFromLoungeBtn: document.getElementById("backFromLoungeBtn"),
    backFromIntlTravelBtn: document.getElementById("backFromIntlTravelBtn"),
    addIntlTravelExpenseBtn: document.getElementById("addIntlTravelExpenseBtn"),
    intlTravelHomeView: document.getElementById("intlTravelHomeView"),
    intlTravelTripCards: document.getElementById("intlTravelTripCards"),
    intlTravelTripCount: document.getElementById("intlTravelTripCount"),
    intlTravelExpenseForm: document.getElementById("intlTravelExpenseForm"),
    intlTravelExpenseFormTitle: document.getElementById("intlTravelExpenseFormTitle"),
    intlTravelDestination: document.getElementById("intlTravelDestination"),
    intlTravelExpenseDate: document.getElementById("intlTravelExpenseDate"),
    intlTravelCategory: document.getElementById("intlTravelCategory"),
    intlTravelDescription: document.getElementById("intlTravelDescription"),
    intlTravelCurrency: document.getElementById("intlTravelCurrency"),
    intlTravelLocalAmount: document.getElementById("intlTravelLocalAmount"),
    intlTravelInrAmount: document.getElementById("intlTravelInrAmount"),
    intlTravelPaymentMethod: document.getElementById("intlTravelPaymentMethod"),
    intlTravelPaymentSource: document.getElementById("intlTravelPaymentSource"),
    intlTravelPaymentSourceCardSelect: document.getElementById("intlTravelPaymentSourceCardSelect"),
    intlTravelExpenseType: document.getElementById("intlTravelExpenseType"),
    intlTravelPhase: document.getElementById("intlTravelPhase"),
    intlTravelRefundMethodField: document.getElementById("intlTravelRefundMethodField"),
    intlTravelRefundMethod: document.getElementById("intlTravelRefundMethod"),
    intlTravelMarkupFee: document.getElementById("intlTravelMarkupFee"),
    intlTravelNotes: document.getElementById("intlTravelNotes"),
    saveIntlTravelExpenseBtn: document.getElementById("saveIntlTravelExpenseBtn"),
    cancelIntlTravelExpenseBtn: document.getElementById("cancelIntlTravelExpenseBtn"),
    clearIntlTravelExpenseBtn: document.getElementById("clearIntlTravelExpenseBtn"),
    intlTravelDetailView: document.getElementById("intlTravelDetailView"),
    backToIntlTravelHomeBtn: document.getElementById("backToIntlTravelHomeBtn"),
    intlTravelDetailTitle: document.getElementById("intlTravelDetailTitle"),
    intlTravelDetailSummary: document.getElementById("intlTravelDetailSummary"),
    intlTravelCurrencySummary: document.getElementById("intlTravelCurrencySummary"),
    intlTravelTypeFilter: document.getElementById("intlTravelTypeFilter"),
    intlTravelCategoryFilter: document.getElementById("intlTravelCategoryFilter"),
    intlTravelPaymentFilter: document.getElementById("intlTravelPaymentFilter"),
    intlTravelTripNotesBtn: document.getElementById("intlTravelTripNotesBtn"),
    intlTravelTripNotesForm: document.getElementById("intlTravelTripNotesForm"),
    intlTravelTripNotesInput: document.getElementById("intlTravelTripNotesInput"),
    cancelIntlTravelTripNotesBtn: document.getElementById("cancelIntlTravelTripNotesBtn"),
    saveIntlTravelTripNotesBtn: document.getElementById("saveIntlTravelTripNotesBtn"),
    addIntlTravelConversionBtn: document.getElementById("addIntlTravelConversionBtn"),
    intlTravelConversionForm: document.getElementById("intlTravelConversionForm"),
    intlTravelConversionFormTitle: document.getElementById("intlTravelConversionFormTitle"),
    saveIntlTravelConversionBtn: document.getElementById("saveIntlTravelConversionBtn"),
    cancelIntlTravelConversionBtn: document.getElementById("cancelIntlTravelConversionBtn"),
    intlTravelConversionDate: document.getElementById("intlTravelConversionDate"),
    intlTravelConversionCurrency: document.getElementById("intlTravelConversionCurrency"),
    intlTravelConversionLocalAmount: document.getElementById("intlTravelConversionLocalAmount"),
    intlTravelConversionInrAmount: document.getElementById("intlTravelConversionInrAmount"),
    intlTravelConversionNotes: document.getElementById("intlTravelConversionNotes"),
    addIntlTravelDetailExpenseBtn: document.getElementById("addIntlTravelDetailExpenseBtn"),
    intlTravelExpenseTable: document.getElementById("intlTravelExpenseTable"),
    exportBtn: document.getElementById("exportBtn"),
    importBtn: document.getElementById("importBtn"),
    lockBtn: document.getElementById("lockBtn"),
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
    loungeAccessMethod: document.getElementById("loungeAccessMethod"),
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
    loungeBenefitNotesModal: document.getElementById("loungeBenefitNotesModal"),
    loungeBenefitNotesTitle: document.getElementById("loungeBenefitNotesTitle"),
    loungeBenefitNotesSubtitle: document.getElementById("loungeBenefitNotesSubtitle"),
    loungeBenefitNotesForm: document.getElementById("loungeBenefitNotesForm"),
    loungeBenefitNotesId: document.getElementById("loungeBenefitNotesId"),
    loungeBenefitNotesInput: document.getElementById("loungeBenefitNotesInput"),
    closeLoungeBenefitNotesBtn: document.getElementById("closeLoungeBenefitNotesBtn"),
    cancelLoungeBenefitNotesBtn: document.getElementById("cancelLoungeBenefitNotesBtn"),
    addLoungeLimitBtn: document.getElementById("addLoungeLimitBtn"),
    viewLoungeLimitsBtn: document.getElementById("viewLoungeLimitsBtn"),
    loungeLimitEntryModal: document.getElementById("loungeLimitEntryModal"),
    loungeLimitEntryTitle: document.getElementById("loungeLimitEntryTitle"),
    closeLoungeLimitEntryBtn: document.getElementById("closeLoungeLimitEntryBtn"),
    loungeLimitForm: document.getElementById("loungeLimitForm"),
    editingLoungeLimitId: document.getElementById("editingLoungeLimitId"),
    loungeLimitCardSelect: document.getElementById("loungeLimitCardSelect"),
    loungeLimitCreditTotal: document.getElementById("loungeLimitCreditTotal"),
    loungeLimitPriorityTotal: document.getElementById("loungeLimitPriorityTotal"),
    saveLoungeLimitBtn: document.getElementById("saveLoungeLimitBtn"),
    clearLoungeLimitBtn: document.getElementById("clearLoungeLimitBtn"),
    loungeLimitsModal: document.getElementById("loungeLimitsModal"),
    closeLoungeLimitsBtn: document.getElementById("closeLoungeLimitsBtn"),
    loungeLimitsTable: document.getElementById("loungeLimitsTable"),
    rpSpendUnredeemedOnly: document.getElementById("rpSpendUnredeemedOnly"),
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
    document.body.classList.add("card-editor-open");
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
  const dashboardHeroAction = e.target.closest?.("[data-dashboard-hero-action]");
  if (dashboardHeroAction) {
    if (dashboardHeroAction.dataset.dashboardHeroAction === "points") {
      showPointsPopup();
    } else if (dashboardHeroAction.dataset.dashboardHeroAction === "net") {
      showCashPopup();
    }
    return;
  }

  if (e.target.id === "pointsValue") {
    showPointsPopup();
  }

  const cardBenefitsButton = e.target.closest?.("[data-cash-benefits-card-id]");
  if (cardBenefitsButton) {
    showCardBenefitsPopup(cardBenefitsButton.dataset.cashBenefitsCardId);
  }

  if (e.target.id === "closePointsModal" || e.target.id === "closePointsModalFooter") {
    closePointsModal();
  }

  if (e.target.id === "pointsModal") {
    closePointsModal();
  }
});

document.addEventListener("keydown", (e) => {
  const dashboardHeroAction = e.target.closest?.("[data-dashboard-hero-action]");
  if (!dashboardHeroAction || (e.key !== "Enter" && e.key !== " ")) return;

  e.preventDefault();
  dashboardHeroAction.click();
});

  els.clearFormBtn.addEventListener("click", () => {
    resetForm();
    document.body.classList.remove("card-editor-open");
  });
  els.issuerName?.addEventListener("change", updateAxisProgramField);
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
  els.openIntlTravelBtn?.addEventListener("click", () => showView("intlTravel"));
  els.dashboardView?.addEventListener("click", handleDashboardStudioAction);
  document.querySelector(".widget-v2-sidebar")?.addEventListener("click", handleDashboardStudioAction);
  els.backFromPortfolioBtn?.addEventListener("click", () => showView("dashboard"));
  els.backFromSwipesBtn?.addEventListener("click", () => showView("dashboard"));
  els.backFromRpSpendsBtn?.addEventListener("click", () => showView("dashboard"));
  els.backFromPprBtn?.addEventListener("click", () => showView("dashboard"));
  els.pprValueModalCancelBtn?.addEventListener("click", closePprValueModal);
  els.pprValueModalSaveBtn?.addEventListener("click", savePprPartnerValue);
  els.pprValueModalDeleteBtn?.addEventListener("click", deleteSelectedPprRedemption);
  els.pprRedemptionBatchSelect?.addEventListener("change", updatePprRedemptionModalSelection);
  [els.pprRedeemPointsInput, els.pprValueInput].forEach((input) => {
    input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        savePprPartnerValue();
      }
    });
  });
  els.pprValueModal?.addEventListener("click", (event) => {
    if (event.target === els.pprValueModal) {
      closePprValueModal();
    }
  });
  els.addPprManualPointsBtn?.addEventListener("click", () => openPprManualPointsModal());
  els.pprManualCancelBtn?.addEventListener("click", closePprManualPointsModal);
  els.pprManualSaveBtn?.addEventListener("click", savePprManualPoints);
  els.pprManualModal?.addEventListener("click", (event) => {
    if (event.target === els.pprManualModal) {
      closePprManualPointsModal();
    }
  });
  [els.pprManualPointsInput, els.pprManualValueInput, els.pprManualDateInput].forEach((input) => {
    input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        savePprManualPoints();
      }
    });
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
      showPprPartnerDetails(row.dataset.partnerName || "Partner", row.dataset.pprScope || "all");
    }
  });
  els.backFromLoungeBtn?.addEventListener("click", () => showView("dashboard"));
  els.backFromIntlTravelBtn?.addEventListener("click", () => showView("dashboard"));
  els.addIntlTravelExpenseBtn?.addEventListener("click", () => openIntlTravelExpenseForm());
  els.addIntlTravelDetailExpenseBtn?.addEventListener("click", () => openIntlTravelExpenseForm(intlTravelDetailTripId));
  els.intlTravelTripNotesBtn?.addEventListener("click", openIntlTravelTripNotesForm);
  els.cancelIntlTravelTripNotesBtn?.addEventListener("click", closeIntlTravelTripNotesForm);
  els.intlTravelTripNotesForm?.addEventListener("submit", saveIntlTravelTripNotes);
  els.addIntlTravelConversionBtn?.addEventListener("click", () => openIntlTravelConversionForm());
  els.cancelIntlTravelConversionBtn?.addEventListener("click", closeIntlTravelConversionForm);
  els.intlTravelConversionForm?.addEventListener("submit", saveIntlTravelConversionFromForm);
  els.intlTravelCurrencySummary?.addEventListener("click", handleIntlTravelConversionAction);
  els.intlTravelPaymentSourceCardSelect?.addEventListener("change", () => {
    const card = state.cards.find((item) => item.id === els.intlTravelPaymentSourceCardSelect.value);
    if (card && els.intlTravelPaymentSource) {
      els.intlTravelPaymentSource.value = formatCardName(card);
    }
  });
  els.intlTravelPaymentSource?.addEventListener("input", () => {
    syncIntlTravelPaymentSourceCardSelect(els.intlTravelPaymentSource.value);
  });
  els.intlTravelPhase?.addEventListener("change", updateIntlTravelRefundMethodVisibility);
  els.intlTravelTypeFilter?.addEventListener("change", () => {
    handleIntlTravelDetailFilterChange();
  });
  els.intlTravelCategoryFilter?.addEventListener("change", handleIntlTravelDetailFilterChange);
  els.intlTravelPaymentFilter?.addEventListener("change", handleIntlTravelDetailFilterChange);
  els.cancelIntlTravelExpenseBtn?.addEventListener("click", closeIntlTravelExpenseForm);
  els.clearIntlTravelExpenseBtn?.addEventListener("click", resetIntlTravelExpenseForm);
  els.intlTravelExpenseForm?.addEventListener("submit", saveIntlTravelExpenseFromForm);
  els.backToIntlTravelHomeBtn?.addEventListener("click", showIntlTravelHome);
  els.intlTravelTripCards?.addEventListener("click", handleIntlTravelTripAction);
  els.intlTravelTripCards?.addEventListener("keydown", handleIntlTravelTripKeydown);
  els.intlTravelExpenseTable?.addEventListener("click", handleIntlTravelExpenseAction);
  els.intlTravelExpenseTable?.addEventListener("dragstart", handleIntlTravelExpenseDragStart);
  els.intlTravelExpenseTable?.addEventListener("dragover", handleIntlTravelExpenseDragOver);
  els.intlTravelExpenseTable?.addEventListener("drop", handleIntlTravelExpenseDrop);
  els.intlTravelExpenseTable?.addEventListener("dragend", handleIntlTravelExpenseDragEnd);
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
  els.rpSpendUnredeemedOnly?.addEventListener("change", handleRpSpendUnredeemedFilterChange);
  els.rpSpendUnredeemedOnly?.addEventListener("input", handleRpSpendUnredeemedFilterChange);
  els.addSwipeBtn?.addEventListener("click", addSwipeFromForm);
  els.exportBtn?.addEventListener("click", exportPortfolio);
  els.importBtn?.addEventListener("click", () => els.importFile?.click());
  els.importFile?.addEventListener("change", importPortfolio);
  els.clearSwipeBtn?.addEventListener("click", resetSwipeForm);
  els.swipesTable?.addEventListener("click", handleSwipeAction);
  [els.rpPointsValue, els.rpRedemptionCharges, els.rpCardPaid, els.rpVoucherPaid].forEach((input) => {
    input?.addEventListener("input", updateRpPaidValue);
  });
  els.rpPoints?.addEventListener("input", populatePartnerProgramReceivedPoints);
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
    populatePartnerProgramReceivedPoints();
    updateRpPointsReceivedFieldState();
    updatePartnerTransferDetailsButton();
    refreshAllFieldStates();
  });
  els.saveRpSpendBtn?.addEventListener("click", saveRpSpendFromForm);
  els.clearRpSpendBtn?.addEventListener("click", () => {
    resetRpSpendForm();
    document.body.classList.remove("rp-entry-open");
  });
  document.getElementById("toggleRpEntryBtn")?.addEventListener("click", () => {
    document.body.classList.toggle("rp-entry-open");
    if (document.body.classList.contains("rp-entry-open")) {
      requestAnimationFrame(() => els.rpCardSelect?.focus());
    }
  });
  els.rpConfirmOkBtn?.addEventListener("click", () => handleRpSpendConfirm(true));
  els.rpConfirmCancelBtn?.addEventListener("click", () => handleRpSpendConfirm(false));
  els.rpSpendsTable?.addEventListener("click", handleRpSpendAction);
  updateRpPointsReceivedFieldState();
  els.loungeMembers?.addEventListener("input", updateLoungeCalculatedValue);
  els.loungeVisitValue?.addEventListener("input", updateLoungeCalculatedValue);
  els.saveLoungeVisitBtn?.addEventListener("click", saveLoungeVisitFromForm);
  els.clearLoungeVisitBtn?.addEventListener("click", resetLoungeVisitForm);
  els.loungeTable?.addEventListener("click", handleLoungeAction);
  document.getElementById("toggleLoungeEntryBtn")?.addEventListener("click", () => {
    document.body.classList.toggle("lounge-entry-open");
    if (document.body.classList.contains("lounge-entry-open")) {
      requestAnimationFrame(() => els.loungeCardSelect?.focus());
    }
  });
  els.loungeBenefitNotesForm?.addEventListener("submit", saveLoungeBenefitNotes);
  els.closeLoungeBenefitNotesBtn?.addEventListener("click", closeLoungeBenefitNotesModal);
  els.cancelLoungeBenefitNotesBtn?.addEventListener("click", closeLoungeBenefitNotesModal);
  els.loungeBenefitNotesModal?.addEventListener("click", (event) => {
    if (event.target === els.loungeBenefitNotesModal) closeLoungeBenefitNotesModal();
  });
  els.saveLoungeBenefitBtn?.addEventListener("click", saveLoungeBenefitFromForm);
  els.clearLoungeBenefitBtn?.addEventListener("click", resetLoungeBenefitForm);
  els.loungeCardFilter?.addEventListener("change", () => { loungeAllExpanded = false; renderLoungeVisits(); });
  els.loungeTypeFilter?.addEventListener("change", () => { loungeAllExpanded = false; renderLoungeVisits(); });
  els.addLoungeLimitBtn?.addEventListener("click", () => openLoungeLimitForm());
  els.viewLoungeLimitsBtn?.addEventListener("click", openLoungeLimitsPopup);
  els.closeLoungeLimitEntryBtn?.addEventListener("click", closeLoungeLimitEntryModal);
  els.closeLoungeLimitsBtn?.addEventListener("click", closeLoungeLimitsPopup);
  els.loungeLimitEntryModal?.addEventListener("click", (event) => {
    if (event.target === els.loungeLimitEntryModal) closeLoungeLimitEntryModal();
  });
  els.loungeLimitsModal?.addEventListener("click", (event) => {
    if (event.target === els.loungeLimitsModal) closeLoungeLimitsPopup();
  });
  els.loungeLimitForm?.addEventListener("submit", saveLoungeLimitFromForm);
  els.loungeLimitCardSelect?.addEventListener("change", handleLoungeLimitCardChange);
  els.clearLoungeLimitBtn?.addEventListener("click", () => resetLoungeLimitForm(true));
  els.loungeLimitsTable?.addEventListener("click", handleLoungeLimitTableAction);
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
      state.pprManualPoints = (data.pprManualPoints || data.manualPprPoints || []).map(normalizePprManualPoint);
      state.loungeVisits = (data.loungeVisits || []).map(normalizeLoungeVisit);
      state.loungeCardLimits = (data.loungeCardLimits || data.loungeLimits || []).map(normalizeLoungeCardLimit);
      state.intlTravelTrips = (data.intlTravelTrips || data.intlTrips || []).map(normalizeIntlTravelTrip);
      state.aiTrainer = normalizeAiTrainer(data.aiTrainer);
      const migratedLegacyRp = migrateLegacyPointsRedeemedBenefitsToRpSpends();
      const removedDuplicateLegacyRp = removeDuplicateLegacyRpSpends();
      const migratedWelcomePoints = ensureWelcomeBenefitPointFields();
      syncLoungeBenefitsFromVisits();
      if (migratedLegacyRp || removedDuplicateLegacyRp || migratedWelcomePoints) {
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
    pprManualPoints: state.pprManualPoints,
    loungeVisits: state.loungeVisits,
    loungeCardLimits: state.loungeCardLimits,
    intlTravelTrips: state.intlTravelTrips,
    aiTrainer: state.aiTrainer,
  });

  console.log("✅ Saved to Firebase");
}

function normalizeCard(card) {
  const storedAxisProgram = card.axisProgram
    ?? card.axisProgramType
    ?? card.axisCardProgram
    ?? card.axisRewardProgram
    ?? card.rewardProgram;

  return {
    id: card.id || createId(),
    name: card.name || "",
    issuer: normalizeIssuerBank(card.issuer),
    axisProgram: normalizeAxisProgram(storedAxisProgram),
    annualFee: toNumber(card.annualFee),
    taxFee: toNumber(card.taxFee),
    isLtf: !!(card.isLtf ?? card.isLTF ?? card.ltf ?? card.lifeTimeFree),
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
          valueType: benefit.type === welcomeBenefitPointsType
            ? "cash"
            : normalizeBenefitValueType(benefit.valueType),
          label: benefit.label || "",
          amount: toNumber(benefit.amount),
          pointsAmount: toNumber(benefit.pointsAmount),
          addedAt: benefit.addedAt || "",
          ...(Object.prototype.hasOwnProperty.call(benefit, "originalPoints")
            ? { originalPoints: toNumber(benefit.originalPoints) }
            : {}),
        }))
      : [],
  };
}

function normalizeAxisProgram(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[|/]+/g, " ")
    .replace(/\s+/g, " ");

  if (
    /\bedge\s+rewards?\b/.test(normalized)
    || normalized === "reward"
    || normalized === "rewards"
    || normalized === "axis reward"
    || normalized === "axis rewards"
  ) {
    return "Edge Rewards";
  }
  if (
    /\bedge\s+miles?\b/.test(normalized)
    || normalized === "mile"
    || normalized === "miles"
    || normalized === "axis mile"
    || normalized === "axis miles"
  ) {
    return "Edge Miles";
  }
  if (
    normalized === "cashback"
    || normalized === "cash back"
    || normalized === "axis cashback"
    || normalized === "axis cash back"
  ) {
    return "Cashback";
  }
  return "";
}

function normalizeIssuerBank(value) {
  const raw = String(value || "").trim();
  const normalized = raw.toLowerCase().replace(/[.']/g, "").replace(/\s+/g, " ");
  const aliases = {
    "axis": "Axis Bank",
    "axis bank": "Axis Bank",
    "axis bank ltd": "Axis Bank",
    "axis bank limited": "Axis Bank",
    "axis bank pvt ltd": "Axis Bank",
    "axis bank private limited": "Axis Bank",
    "american express": "American Express",
    "bank of baroda": "Bank of Baroda",
    "bank of india": "Bank of India",
    "citibank": "Citibank",
    "citi bank": "Citibank",
    "corpb ank": "CorpBank",
    "corpbank": "CorpBank",
    "corporation bank": "CorpBank",
    "federal": "Federal Bank",
    "federal bank": "Federal Bank",
    "hdfc": "HDFC Bank",
    "hdfc bank": "HDFC Bank",
    "hsbc": "HSBC",
    "icici": "ICICI Bank",
    "icici bank": "ICICI Bank",
    "idfc": "IDFC",
    "idfc first bank": "IDFC",
    "indian overseas bank": "Indian Overseas Bank",
    "indusind": "IndusInd Bank",
    "indusind bank": "IndusInd Bank",
    "syndicate": "Syndicate Bank",
    "syndicate bank": "Syndicate Bank",
    "union bank": "Union Bank of India",
    "union bank of india": "Union Bank of India",
    "vijaya bank": "Vijaya Bank",
  };
  return aliases[normalized] || raw;
}

function isAxisIssuer(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[.']/g, "")
    .replace(/\s+/g, " ");
  return /^axis(?:\s+bank)?(?:\s+(?:pvt\s+)?(?:ltd|limited))?$/i.test(normalized);
}

function getAxisProgram(card) {
  const program = normalizeAxisProgram(
    card?.axisProgram
      ?? card?.axisProgramType
      ?? card?.axisCardProgram
      ?? card?.axisRewardProgram
      ?? card?.rewardProgram
  );

  // An explicit Edge classification is authoritative. This also keeps older
  // records working when their issuer was stored as "Axis" or another legacy
  // Axis label that is not the current dropdown value.
  if (program === "Edge Rewards" || program === "Edge Miles") return program;
  if (!isAxisIssuer(card?.issuer)) return "";
  return program || "Cashback";
}

function renderIssuerOptions(selectedValue = null) {
  if (!els.issuerName) return;

  const existingIssuers = state.cards
    .map((card) => normalizeIssuerBank(card.issuer))
    .filter(Boolean);
  const values = [...new Set([...issuerBankOptions, ...existingIssuers])]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  const currentValue = normalizeIssuerBank(selectedValue ?? els.issuerName.value);

  els.issuerName.innerHTML = [
    '<option value="">Select issuer bank</option>',
    ...values.map((issuer) => `<option value="${escapeAttribute(issuer)}">${escapeHtml(issuer)}</option>`),
  ].join("");

  if (currentValue && !values.includes(currentValue)) {
    const option = document.createElement("option");
    option.value = currentValue;
    option.textContent = currentValue;
    els.issuerName.appendChild(option);
  }

  els.issuerName.value = currentValue || "";
  updateAxisProgramField();
}

function updateAxisProgramField() {
  const isAxis = isAxisIssuer(els.issuerName?.value);
  if (els.axisProgramField) els.axisProgramField.hidden = !isAxis;
  if (els.axisProgram) {
    els.axisProgram.disabled = !isAxis;
    if (!isAxis) els.axisProgram.value = "";
  }
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
  const hasPointsReceivedField = Object.prototype.hasOwnProperty.call(spend, "pointsReceived")
    || Object.prototype.hasOwnProperty.call(spend, "neucoinsPointsReceived");
  const normalizedPointsReceived = toNumber(spend.pointsReceived ?? spend.neucoinsPointsReceived);
  const isPartnerRecord = spend.partnerProgram === true || spend.cardId === partnerProgramPlatformValue;
  // An Unredeemed Points balance is only created by the explicit checkbox in
  // the RP Spend form. Older RP rows did not save redemption metadata, and
  // inferring an unredeemed balance from their empty value fields caused
  // completed redemptions to appear as Unredeemed Points in card details.
  const isExplicitUnredeemedRecord = spend.unredeemedPointsRecord === true
    || spend.isUnredeemedPointsRecord === true
    || spend.unredeemed === true;
  const isLegacyRedeemedProduct = !isPartnerRecord
    && !isExplicitUnredeemedRecord
    && rawPoints > 0
    && baseRedeemedPoints <= 0;
  const normalizedRedeemedPoints = isLegacyRedeemedProduct ? rawPoints : baseRedeemedPoints;
  const parsedRatio = parsePartnerTransferRatio(partnerTransferRatio);
  const inferredPartnerSourcePoints = isPartnerRecord && parsedRatio && normalizedPointsReceived > 0
    ? (normalizedPointsReceived * parsedRatio.from) / parsedRatio.to
    : 0;
  const hasSplitRedemptionModel = spend.redemptionModel === "split-v2"
    || String(id).startsWith("legacy-")
    || isLegacyRedeemedProduct;
  // Partner rows must keep points in the originating-card unit. Older rows
  // could store the converted partner amount in `points`; use the explicit
  // redeemed amount first, then infer the source amount from the ratio when
  // pointsReceived is available.
  const normalizedPartnerPoints = isPartnerRecord
    ? (normalizedRedeemedPoints > 0
      ? normalizedRedeemedPoints
      : inferredPartnerSourcePoints > 0
        ? inferredPartnerSourcePoints
        : rawPoints)
    : 0;
  const normalizedPoints = isPartnerRecord
    ? normalizedPartnerPoints
    : !hasSplitRedemptionModel && normalizedRedeemedPoints > 0
      ? rawPoints + normalizedRedeemedPoints
      : rawPoints;
  const partnerTransferPoints = isPartnerRecord
    ? normalizedPartnerPoints
    : normalizedRedeemedPoints > 0 ? normalizedRedeemedPoints : normalizedPoints;
  // An explicitly blank/zero value must stay blank/zero. Only older records
  // that never had this field use the historical ratio-based fallback.
  const autoPointsReceived = hasPointsReceivedField
    ? normalizedPointsReceived
    : normalizedPointsReceived > 0
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
    unredeemedPointsRecord: isExplicitUnredeemedRecord,
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
    neucoinsSourceCardId: spend.neucoinsSourceCardId || "",
    partnerTransferRatio,
    partnerRedeemedPoints: toNumber(spend.partnerRedeemedPoints),
    pprRedemptions: Array.isArray(spend.pprRedemptions)
      ? spend.pprRedemptions.map(normalizePprRedemptionAllocation)
      : [],
    productName: spend.productName || spend.product || "",
    productValue: toNumber(spend.productValue),
    pointsReceived: autoPointsReceived,
    pointsReceivedProvided: spend.pointsReceivedProvided === true || hasPointsReceivedField,
    redeemedAt: spend.redeemedAt || spend.redemptionUpdatedAt || "",
    createdAt: spend.createdAt || new Date().toISOString(),
  };
}

function normalizePprManualPoint(entry = {}) {
  return {
    id: entry.id || createId(),
    partnerName: String(entry.partnerName || entry.partner || entry.purchasedFrom || "").trim(),
    points: toNumber(entry.points ?? entry.pointsAdded ?? entry.partnerPoints),
    value: toNumber(entry.value ?? entry.pointsValue ?? entry.monetaryValue),
    redeemedPoints: toNumber(entry.redeemedPoints),
    redeemedValue: toNumber(entry.redeemedValue),
    redemptions: Array.isArray(entry.redemptions)
      ? entry.redemptions.map(normalizePprRedemptionAllocation)
      : [],
    notes: String(entry.notes || "").trim(),
    date: entry.date || "",
    createdAt: entry.createdAt || new Date().toISOString(),
  };
}

function normalizePprRedemptionAllocation(allocation = {}) {
  const rawId = String(allocation.id || "").trim();
  const id = rawId || createId();
  return {
    id,
    // New records persist a batch identifier. Earlier records used
    // `${redemptionId}-${allocationIndex}`, so infer their batch without
    // losing compatibility with existing saved portfolios.
    redemptionId: String(allocation.redemptionId || allocation.batchId || (rawId ? rawId.replace(/-\d+$/, "") : id)).trim(),
    points: toNumber(allocation.points),
    value: toNumber(allocation.value),
    createdAt: allocation.createdAt || new Date().toISOString(),
  };
}

function isUnredeemedPointsRecord(rpSpend) {
  return rpSpend?.unredeemedPointsRecord === true;
}

function isLegacyInferredUnredeemedRecord(rpSpend) {
  // Before the explicit balance workflow, older redemption rows could be
  // saved with this flag by inference. Real manual balances are initialized
  // by the current checkbox flow and carry this marker.
  return isUnredeemedPointsRecord(rpSpend)
    && rpSpend?.unredeemedBalanceInitialized !== true;
}

function getRpSpendRedeemedSourceCardId(rpSpend) {
  if (!rpSpend) return "";
  if (isPartnerProgramRpSpend(rpSpend)) {
    return String(rpSpend.originatingCardId || "").trim();
  }
  if (rpSpend.cardId === "Neucoins") {
    // New Neucoins records keep the selected Tata Neu card. Older records
    // fall back to the existing Tata Neu card resolver.
    return String(rpSpend.neucoinsSourceCardId || getNeuPortfolioCardId()).trim();
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

function getNeucoinsSourceCards() {
  return state.cards
    .filter((card) => /tata\s+neu\s+(?:infinity|plus)/i.test(card.name || ""))
    .sort((a, b) => formatCardName(a).localeCompare(formatCardName(b)));
}

function getRpRedeemedPortfolioCardId(sourceCardId) {
  if (sourceCardId === "Neucoins") {
    return getNeuPortfolioCardId();
  }

  return sourceCardId;
}

function isRpRedeemedAutoBenefit(benefit) {
  return String(benefit?.id || "").startsWith(rpRedeemedBenefitPrefix);
}

function extractNumericPointsFromBenefitLabel(label) {
  const text = String(label || "").trim().replaceAll(",", "");
  const match = text.match(/^(\d+(?:\.\d+)?)\s*(?:pts?|points?)?$/i);
  return match ? toNumber(match[1]) : 0;
}

function getWelcomeBenefitPoints(benefit) {
  if (!benefit || benefit.type !== welcomeBenefitPointsType) return 0;

  const explicitPoints = toNumber(benefit.pointsAmount);
  if (explicitPoints > 0) return explicitPoints;

  const storedOriginalPoints = toNumber(benefit.originalPoints);
  if (storedOriginalPoints > 0) return storedOriginalPoints;

  return extractNumericPointsFromBenefitLabel(benefit.label);
}

function getCardRedemptionRows(cardId, excludeId = "") {
  const cache = !excludeId ? getRenderCacheMap("redemptionRows") : null;
  if (cache && cardId && cache.has(cardId)) return cache.get(cardId);

  const rows = state.rpSpends
    .map((rpSpend, index) => ({ rpSpend, index }))
    .filter(({ rpSpend }) => rpSpend.id !== excludeId)
    .filter(({ rpSpend }) => !isUnredeemedPointsRecord(rpSpend))
    .filter(({ rpSpend }) => getRpSpendRedeemedSourceCardId(rpSpend) === cardId)
    .filter(({ rpSpend }) => getRpSpendRedemptionAmount(rpSpend) > 0);

  const result = rows.sort((a, b) => {
    const dateDifference = new Date(a.rpSpend.createdAt || 0) - new Date(b.rpSpend.createdAt || 0);
    return dateDifference || a.index - b.index;
  }).map(({ rpSpend }) => rpSpend);

  if (cache) cache.set(cardId, result);
  return result;
}

function getCardNormalPointsBaseline(card) {
  if (!card?.id) return 0;

  const sourceRecord = getUnredeemedPointsSourceRecord(card.id);
  if (sourceRecord) return toNumber(sourceRecord.points);

  const manualSources = (card.benefits || []).filter((benefit) =>
    benefit?.type === "Unredeemed Points"
    && isPointBenefit(benefit)
    && !isRpRedeemedAutoBenefit(benefit)
  );

  if (!manualSources.length) {
    // Auto benefits are presentation-only snapshots created by
    // syncRpRedeemedBenefitsFromSpends(). They must never become a new source
    // balance on the next render, otherwise redeemed points can re-enter the
    // Unredeemed total. Only an explicit RP Spend balance record or a manual
    // non-auto card benefit is authoritative.
    return 0;
  }

  return manualSources.reduce((sum, benefit) => {
    const storedOriginalPoints = toNumber(benefit.originalPoints);
    if (storedOriginalPoints > 0) {
      return sum + storedOriginalPoints;
    }

    // Legacy manual Unredeemed Points rows were directly reduced when a
    // redemption was saved. Add those historical redemptions back once so the
    // new allocation ledger can recalculate the balance without double-
    // deducting them.
    const currentAmount = toNumber(benefit.amount);
    const historicalRedemptions = getCardRedemptionRows(card.id)
      .reduce((points, rpSpend) => points + getRpSpendRedemptionAmount(rpSpend), 0);
    return sum + currentAmount + historicalRedemptions;
  }, 0);
}

function ensureManualPointsBaselines() {
  state.cards = state.cards.map((card) => {
    const cardBenefits = Array.isArray(card.benefits) ? card.benefits : [];
    const needsBaseline = cardBenefits.some((benefit) =>
      benefit?.type === "Unredeemed Points"
      && isPointBenefit(benefit)
      && !isRpRedeemedAutoBenefit(benefit)
      && toNumber(benefit.originalPoints) <= 0
    );

    if (!needsBaseline) return card;

    const redemptionPoints = getCardRedemptionRows(card.id)
      .reduce((sum, rpSpend) => sum + getRpSpendRedemptionAmount(rpSpend), 0);
    let changed = false;
    const benefits = cardBenefits.map((benefit) => {
      if (
        benefit?.type !== "Unredeemed Points"
        || !isPointBenefit(benefit)
        || isRpRedeemedAutoBenefit(benefit)
        || toNumber(benefit.originalPoints) > 0
      ) {
        return benefit;
      }

      changed = true;
      return {
        ...benefit,
        originalPoints: toNumber(benefit.amount) + redemptionPoints,
      };
    });

    return changed ? { ...card, benefits } : card;
  });
}

function ensureWelcomeBenefitPointFields() {
  let changed = false;
  state.cards = state.cards.map((card) => {
    let cardChanged = false;
    const benefits = (card.benefits || []).map((benefit) => {
      if (benefit?.type !== welcomeBenefitPointsType || toNumber(benefit.pointsAmount) > 0) {
        return benefit;
      }

      const legacyPoints = extractNumericPointsFromBenefitLabel(benefit.label);
      if (legacyPoints <= 0) return benefit;

      cardChanged = true;
      changed = true;
      return { ...benefit, pointsAmount: legacyPoints };
    });

    return cardChanged ? { ...card, benefits } : card;
  });
  return changed;
}

function getRpSpendRedemptionTimestamp(rpSpend) {
  const directCardDebit = isPartnerProgramRpSpend(rpSpend)
    ? Math.min(getPartnerProgramSourcePoints(rpSpend), toNumber(rpSpend?.redeemedPoints))
    : toNumber(rpSpend?.redeemedPoints);
  if (directCardDebit > 0) {
    return rpSpend?.redeemedAt || rpSpend?.createdAt || "";
  }

  const pprHistory = Array.isArray(rpSpend?.pprRedemptions)
    ? rpSpend.pprRedemptions.map(normalizePprRedemptionAllocation)
    : [];
  const latestPprRedemption = pprHistory
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];
  return latestPprRedemption?.createdAt || rpSpend?.redeemedAt || rpSpend?.createdAt || "";
}

function getCardPointAllocation(card) {
  const cardId = card?.id || "";
  const cache = getRenderCacheMap("pointAllocations");
  if (cache && cardId && cache.has(cardId)) return cache.get(cardId);

  const welcomeSources = (card?.benefits || [])
    .filter((benefit) => benefit?.type === welcomeBenefitPointsType)
    .sort((a, b) => {
      const aAddedAt = a.addedAt ? new Date(a.addedAt).getTime() : 0;
      const bAddedAt = b.addedAt ? new Date(b.addedAt).getTime() : 0;
      return aAddedAt - bAddedAt;
    });
  const welcomePoints = welcomeSources.reduce((sum, benefit) => sum + getWelcomeBenefitPoints(benefit), 0);
  const welcomeValue = welcomeSources.reduce((sum, benefit) => sum + toNumber(benefit.amount), 0);
  const normalPoints = getCardNormalPointsBaseline(card);
  const rows = getCardRedemptionRows(card?.id || "");

  const welcomeRedeemedBySource = new Map();
  let welcomeRedeemedPoints = 0;
  let normalRedeemedPoints = 0;
  let welcomeRedeemedValue = 0;
  let normalRedeemedValue = 0;

  rows.forEach((rpSpend) => {
    const redemptionPoints = getRpSpendRedemptionAmount(rpSpend);
    const redemptionValue = toNumber(rpSpend.pointsValue);
    let welcomePart = 0;
    let remainingRedemptionPoints = redemptionPoints;

    welcomeSources.forEach((benefit) => {
      if (remainingRedemptionPoints <= 0) return;

      const addedAt = benefit.addedAt ? new Date(benefit.addedAt).getTime() : 0;
      // Use the time points were actually redeemed. A partner contribution can
      // be created before the card receives a Welcome Benefit and redeemed
      // later; using the old contribution date would skip those welcome points.
      const redemptionAt = new Date(getRpSpendRedemptionTimestamp(rpSpend) || 0).getTime();
      if (addedAt > 0 && redemptionAt < addedAt) return;

      const sourcePoints = getWelcomeBenefitPoints(benefit);
      const sourceRedeemedPoints = welcomeRedeemedBySource.get(benefit.id) || 0;
      const availableSourcePoints = Math.max(0, sourcePoints - sourceRedeemedPoints);
      const sourcePart = Math.min(remainingRedemptionPoints, availableSourcePoints);
      if (sourcePart <= 0) return;

      welcomeRedeemedBySource.set(benefit.id, sourceRedeemedPoints + sourcePart);
      welcomePart += sourcePart;
      remainingRedemptionPoints -= sourcePart;
    });

    const normalPart = Math.min(
      remainingRedemptionPoints,
      Math.max(0, normalPoints - normalRedeemedPoints)
    );

    welcomeRedeemedPoints += welcomePart;
    normalRedeemedPoints += normalPart;

    if (redemptionPoints > 0) {
      welcomeRedeemedValue += redemptionValue * (welcomePart / redemptionPoints);
      // Keep the full entered monetary value represented even if old data has
      // more redemptions than the recorded point sources.
      normalRedeemedValue += redemptionValue - (redemptionValue * (welcomePart / redemptionPoints));
    }
  });

  const welcomeRemainingPoints = Math.max(0, welcomePoints - welcomeRedeemedPoints);
  const normalRemainingPoints = Math.max(0, normalPoints - normalRedeemedPoints);
  const welcomeRemainingValue = Math.max(0, welcomeValue - welcomeRedeemedValue);

  const allocation = {
    welcomePoints,
    welcomeValue,
    welcomeRedeemedPoints,
    welcomeRedeemedValue,
    welcomeRemainingPoints,
    welcomeRemainingValue,
    normalPoints,
    normalRedeemedPoints,
    normalRedeemedValue,
    normalRemainingPoints,
    redeemedPoints: welcomeRedeemedPoints + normalRedeemedPoints,
    redeemedValue: welcomeRedeemedValue + normalRedeemedValue,
    totalUnredeemedPoints: welcomeRemainingPoints + normalRemainingPoints,
  };

  if (cache && cardId) cache.set(cardId, allocation);
  return allocation;
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

    if (!legacyBenefits.length) return card;

    const groupedLegacyBenefits = new Map();
    legacyBenefits.forEach((benefit) => {
      const amount = toNumber(benefit.amount);
      const pointsAmount = isPointBenefit(benefit)
        ? amount
        : toNumber(benefit.pointsAmount);
      // A redeemed-points entry remains valid when its monetary value is 0.
      // Only discard a legacy row when both its points and value are empty.
      if (amount <= 0 && pointsAmount <= 0) return;

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
        entry.points += pointsAmount;
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
        points: entry.points,
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

  if (migratedRows.length) state.rpSpends = [...state.rpSpends, ...migratedRows];
  return changed;
}

function removeDuplicateLegacyRpSpends() {
  const duplicateIds = new Set();
  const isLegacyMigrationRow = (rpSpend) => String(rpSpend?.id || "").startsWith("legacy-");

  state.rpSpends
    .filter((rpSpend) => isLegacyMigrationRow(rpSpend) || isLegacyInferredUnredeemedRecord(rpSpend))
    .forEach((legacyRow) => {
      const sourceCardId = getRpSpendRedeemedSourceCardId(legacyRow);
      const legacyPoints = getRpSpendTotalPoints(legacyRow);
      const legacyPointsValue = toNumber(legacyRow.pointsValue);
      if (!sourceCardId || legacyPoints <= 0 || legacyPointsValue < 0) return;

      // A previous migration can leave a summary row alongside the detailed
      // product-payment rows it summarizes. When both the point total and the
      // entered points value match exactly, retain the detailed rows and drop
      // only that duplicate summary so it cannot become an unredeemed source.
      const detailedRows = state.rpSpends.filter((rpSpend) =>
        rpSpend.id !== legacyRow.id
        && !isLegacyMigrationRow(rpSpend)
        && !isPartnerProgramRpSpend(rpSpend)
        && !isUnredeemedPointsRecord(rpSpend)
        && getRpSpendRedeemedSourceCardId(rpSpend) === sourceCardId
      );
      const detailedPoints = detailedRows.reduce(
        (sum, rpSpend) => sum + getRpSpendRedemptionAmount(rpSpend),
        0
      );
      const detailedPointsValue = detailedRows.reduce(
        (sum, rpSpend) => sum + toNumber(rpSpend.pointsValue),
        0
      );

      if (
        Math.abs(detailedPoints - legacyPoints) < 0.0001
        && Math.abs(detailedPointsValue - legacyPointsValue) < 0.0001
      ) {
        duplicateIds.add(legacyRow.id);
      }
    });

  if (!duplicateIds.size) return false;
  state.rpSpends = state.rpSpends.filter((rpSpend) => !duplicateIds.has(rpSpend.id));
  return true;
}

function syncRpRedeemedBenefitsFromSpends() {
  ensureWelcomeBenefitPointFields();
  ensureManualPointsBaselines();
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
    const redeemedPoints = getRpSpendRedemptionAmount(rpSpend);
    const hasUnredeemedSource = Boolean(getUnredeemedPointsSourceRecord(sourceCardId));

    if (isUnredeemedPointsRecord(rpSpend)) {
      cardTotals.unredeemedPoints += totalPoints;
    } else if (isPartnerProgramRpSpend(rpSpend)) {
      // Deduct only source-card points. Converted airline/hotel points are
      // represented separately by pointsReceived.
      cardTotals.redeemedPoints += redeemedPoints;
      if (hasUnredeemedSource) cardTotals.unredeemedPoints -= redeemedPoints;
    } else {
      cardTotals.unredeemedPoints += Math.max(0, totalPoints - redeemedPoints);
      cardTotals.redeemedPoints += redeemedPoints;
      if (hasUnredeemedSource) cardTotals.unredeemedPoints -= redeemedPoints;
    }

    const redeemedValueRatio = isPartnerProgramRpSpend(rpSpend)
      ? 1
      : totalPoints > 0 ? redeemedPoints / totalPoints : 0;
    cardTotals.redeemedValue += toNumber(rpSpend.pointsValue) * redeemedValueRatio;
    totalsByCard[portfolioCardId] = cardTotals;
  });

  state.cards = state.cards.map((card) => {
    const benefits = (card.benefits || []).filter((benefit) => !isRpRedeemedAutoBenefit(benefit));
    const cardTotals = totalsByCard[card.id];
    const allocation = getCardPointAllocation(card);
    const hasPointSources = Boolean(
      allocation.welcomePoints > 0
      || allocation.normalPoints > 0
    );
    // Unredeemed points must come only from the authoritative allocation.
    // Never infer a new balance from ordinary redemption rows.
    const unredeemedPoints = allocation.normalRemainingPoints;
    const normalRedeemedPoints = hasPointSources
      ? allocation.normalRedeemedPoints
      : Math.max(0, cardTotals?.redeemedPoints || 0);
    const normalRedeemedValue = hasPointSources
      ? allocation.normalRedeemedValue
      : Math.max(0, cardTotals?.redeemedValue || 0);

    if (unredeemedPoints > 0) {
      benefits.push({
        id: `${rpRedeemedBenefitPrefix}points-${card.id}`,
        type: "Unredeemed Points",
        valueType: "points",
        label: "Unredeemed Points",
        amount: unredeemedPoints,
        originalPoints: allocation.normalPoints,
      });
    }

    if (normalRedeemedValue > 0 || normalRedeemedPoints > 0) {
      benefits.push({
        id: `${rpRedeemedBenefitPrefix}cash-${card.id}`,
        type: "Points Redeemed",
        valueType: "cash",
        label: hasPointSources && allocation.welcomePoints > 0
          ? "Normal Points Redeemed"
          : "Points Redeemed",
        amount: normalRedeemedValue,
        pointsAmount: normalRedeemedPoints,
      });
    }

    return { ...card, benefits };
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
    accessMethod: normalizeLoungeAccessMethod(visit.accessMethod),
    airport: visit.airport || "",
    notes: String(visit.notes || "").trim(),
    members,
    perPerson,
    date: visit.date || visit.createdAt?.split('T')[0] || "",
    total,
    createdAt: visit.createdAt || new Date().toISOString(),
  };
}

function normalizeLoungeAccessMethod(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "credit card" || normalized === "creditcard") return "Credit Card";
  if (normalized === "priority pass" || normalized === "prioritypass") return "Priority Pass";
  if (normalized === "dreamfolks" || normalized === "dream folks") return "DreamFolks";
  return "";
}

function normalizeLoungeCardLimit(limit) {
  return {
    id: limit?.id || createId(),
    cardId: String(limit?.cardId || "").trim(),
    totalCreditCardVisits: String(limit?.totalCreditCardVisits || "").trim(),
    totalPriorityPassDreamfolks: String(
      limit?.totalPriorityPassDreamfolks
      || limit?.priorityPassDreamfolksTotal
      || limit?.totalPriorityPassDreamfolksUsage
      || ""
    ).trim(),
    createdAt: limit?.createdAt || new Date().toISOString(),
    updatedAt: limit?.updatedAt || limit?.createdAt || new Date().toISOString(),
  };
}

function normalizeIntlTravelExpense(expense) {
  const rawExpenseType = String(expense?.expenseType || "Personal").trim() || "Personal";
  return {
    id: expense?.id || createId(),
    date: typeof expense?.date === "string" ? expense.date : "",
    category: String(expense?.category || "Other").trim() || "Other",
    description: String(expense?.description || expense?.merchant || "").trim(),
    currency: String(expense?.currency || expense?.localCurrency || "INR").trim().toUpperCase() || "INR",
    localAmount: toNumber(expense?.localAmount ?? expense?.foreignAmount),
    inrAmount: toNumber(expense?.inrAmount ?? expense?.inr),
    paymentMethod: String(expense?.paymentMethod || "Cash").trim() || "Cash",
    paymentSource: String(expense?.paymentSource || "").trim(),
    expenseType: rawExpenseType === "Friend" ? "Friends" : rawExpenseType,
    phase: String(expense?.phase || "On-trip").trim() || "On-trip",
    refundMethod: String(expense?.refundMethod || expense?.refundedBy || "").trim(),
    markupFee: toNumber(expense?.markupFee ?? expense?.fxFee),
    notes: String(expense?.notes || "").trim(),
    displayOrder: Number.isFinite(Number(expense?.displayOrder)) ? Number(expense.displayOrder) : null,
    manualBeforeId: String(expense?.manualBeforeId || "").trim(),
    manualAfterId: String(expense?.manualAfterId || "").trim(),
    manualOrder: Number.isFinite(Number(expense?.manualOrder)) ? Number(expense.manualOrder) : null,
    createdAt: expense?.createdAt || new Date().toISOString(),
  };
}

function normalizeIntlTravelConversion(conversion) {
  return {
    id: conversion?.id || createId(),
    date: typeof conversion?.date === "string" ? conversion.date : "",
    currency: String(conversion?.currency || "INR").trim().toUpperCase() || "INR",
    localAmount: toNumber(conversion?.localAmount ?? conversion?.amount),
    inrAmount: toNumber(conversion?.inrAmount ?? conversion?.inr),
    notes: String(conversion?.notes || "").trim(),
    createdAt: conversion?.createdAt || new Date().toISOString(),
  };
}

function normalizeIntlTravelTrip(trip) {
  return {
    id: trip?.id || createId(),
    destination: String(trip?.destination || trip?.name || "Untitled destination").trim() || "Untitled destination",
    notes: String(trip?.notes || "").trim(),
    createdAt: trip?.createdAt || new Date().toISOString(),
    expenses: Array.isArray(trip?.expenses) ? trip.expenses.map(normalizeIntlTravelExpense) : [],
    conversions: Array.isArray(trip?.conversions) ? trip.conversions.map(normalizeIntlTravelConversion) : [],
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

function scheduleVisualAssets(view = state.currentView) {
  const app = document.getElementById("app");
  if (!app || app.style.display === "none") return;

  app.dataset.visualAssetsView = view;
  app.removeAttribute("data-visual-assets-ready");

  const activate = () => {
    if (state.currentView !== view || app.style.display === "none") return;
    app.setAttribute("data-visual-assets-ready", "true");
  };

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(activate, { timeout: 700 });
  } else {
    window.setTimeout(activate, 0);
  }
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
  intlTravelExpensesAllExpanded = false;
  // Remove any leftover load-more UI
  removeLoadMore();
  removeLoadMoreIn(els.swipesTable);
  removeLoadMoreIn(els.rpSpendsTable);
  removeLoadMoreIn(els.loungeTable);
  removeLoadMoreIn(els.intlTravelExpenseTable);

  if (els.dashboardView) els.dashboardView.style.display = nextView === "dashboard" ? "block" : "none";
  if (els.portfolioView) els.portfolioView.style.display = nextView === "portfolio" ? "block" : "none";
  if (els.swipesView) els.swipesView.style.display = nextView === "swipes" ? "block" : "none";
  if (els.rpSpendsView) els.rpSpendsView.style.display = nextView === "rpSpends" ? "block" : "none";
  if (els.pprView) els.pprView.style.display = nextView === "ppr" ? "block" : "none";
  if (els.loungeView) els.loungeView.style.display = nextView === "lounge" ? "block" : "none";
  if (els.intlTravelView) els.intlTravelView.style.display = nextView === "intlTravel" ? "block" : "none";
  scheduleVisualAssets(nextView);
  updateAppHeaderTitle(nextView);
  syncActiveViewClasses();
  animateActiveView(nextView);

  if (nextView === "portfolio" && previousView !== "portfolio") {
    resetPortfolioFilters(false);
  }

  if (nextView === "swipes" && previousView !== "swipes") {
    resetSwipeFilters(false);
  }

  if (nextView === "rpSpends" && previousView !== "rpSpends") {
    resetRpSpendFilters(false);
  }

  if (nextView === "lounge" && previousView !== "lounge") {
    resetLoungeFilters(false);
  }

  if (nextView === "lounge") {
    ensureChartJsLoaded().catch((error) => console.warn(error.message));
  }

  if (nextView === "intlTravel") {
    if (previousView !== "intlTravel") {
      intlTravelDetailTripId = "";
      intlTravelFormOpen = false;
      intlTravelEditorReturnTripId = "";
      intlTravelEditingExpenseId = "";
      intlTravelEditingConversionId = "";
    }
  }

  // Hidden pages no longer redraw after every state change. Render the page
  // being opened now so its totals and records are always current.
  renderVisibleView(nextView, true);

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
  // Read-only searches must be resolved from the current query and current
  // application data.  A previously saved command must never turn a search
  // into a data-entry intent or leak its values into the search.
  const trainerHint = action === "search"
    ? { confidence: 0 }
    : inferAiTrainerHints(query);
  const cardMatch = resolveCardFromQuery(query, knowledge);
  const changeValues = extractAiChangeValues(query);
  const resolvedCard = cardMatch.card || (action === "search" ? null : trainerHint.card) || null;

  return {
    rawQuery: query,
    normalizedQuery: normalized,
    action,
    module: module || (action === "search" ? "portfolio" : trainerHint.module) || "portfolio",
    card: resolvedCard,
    cardCandidates: cardMatch.candidates,
    amount: changeValues.toAmount || extractAmount(query) || trainerHint.amount || 0,
    matchAmount: changeValues.fromAmount || 0,
    points: changeValues.toPoints || extractPoints(query) || trainerHint.points || 0,
    matchPoints: changeValues.fromPoints || 0,
    pointsValue: changeValues.toValue || extractAiMoneyValue(query) || trainerHint.pointsValue || 0,
    matchPointsValue: changeValues.fromValue || 0,
    pointsReceived: extractAiLabeledNumber(query, ["received", "credited", "earned"]) || 0,
    partnerName: extractPartnerName(query, resolvedCard, knowledge) || "",
    partnerTransferRatio: extractPartnerTransferRatio(query),
    pointsMetric: extractAiPointsMetric(normalized),
    category: extractSwipeCategory(query) || trainerHint.category || "",
    swipeType: extractSwipeType(query) || trainerHint.swipeType || "",
    financialYear: extractFinancialYear(query) || trainerHint.financialYear || "",
    spentFor: extractSpentFor(query, cardMatch.card || trainerHint.card, knowledge) || trainerHint.spentFor || "",
    productName: normalizeAiSpecificText(extractProductName(query, cardMatch.card || trainerHint.card, knowledge)) || trainerHint.productName || "",
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
  const hasSearchCue = /\b(tell me|show|search|find|list|display|view|inspect|check|review|lookup|look up|what(?:'s| is)?|how many|how much|where|which|total|balance|remaining|available)\b/.test(normalizedQuery) || /\b(this fy|current fy|this year|current year)\b/.test(normalizedQuery);
  // “Redeemed” is normally a search/filter word (for example, “show
  // redeemed points”), not an instruction to create a redemption.  Explicit
  // data-entry commands are still handled below, while numeric redemption
  // phrases fall through to the add heuristic.
  const hasAddCue = /\b(add|log|record|update|edit|change)\b/.test(normalizedQuery);
  if (/\b(update|edit|change)\b/.test(normalizedQuery)) return "update";
  if (/\b(add|log|record)\b/.test(normalizedQuery)) return "add";
  if (hasSearchCue && !hasAddCue) return "search";
  if (/\bswipe\b/.test(normalizedQuery) && /\d/.test(normalizedQuery) && !/\b(total|my|how many|show|search|fee|emi|fy|spend|spends|spent|balance|remaining|available)\b/.test(normalizedQuery)) return "add";
  if (/\blounge\b|\bvisit\b/.test(normalizedQuery) && (/\d+\s*members?\b/.test(normalizedQuery) || /\bworth\b/.test(normalizedQuery) || /\bvalue\b/.test(normalizedQuery)) && !hasSearchCue) return "add";
  if (/\b(points|miles)\b/.test(normalizedQuery) && /\d/.test(normalizedQuery) && !/\b(total|my|how many|show|search|fee|emi|fy|spend|spends|spent|balance|remaining|available)\b/.test(normalizedQuery)) return "add";
  return "search";
}

function detectAiModule(normalizedQuery, action) {
  const isPartnerTransfer = /\b(partner|airline|hotel|accor|marriott|emirates|miles transfer|points transfer)\b/.test(normalizedQuery)
    || (/\btransfer\b/.test(normalizedQuery) && (/\b(points?|miles?)\b/.test(normalizedQuery) || /\d+(?:\.\d+)?\s*:\s*\d+(?:\.\d+)?/.test(normalizedQuery)));
  if (isPartnerTransfer) return "rpSpends";
  if (/\b(lounge|visit|airport|golf|restaurant|spa|meet greet|transfer)\b/.test(normalizedQuery)) return "lounge";
  if (/\b(redeem|redeemed|redemption|voucher|miles|rp spend|reward spend|points spend|points spent|points received|purchased from|product)\b/.test(normalizedQuery)) return "rpSpends";
  if (/\b(swipe|swipes|spend|spends|spending|spent|expense|expenses|transaction|transactions|emi|full swipe|spent for|business|personal)\b/.test(normalizedQuery)) return "swipes";
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

function extractAiLabeledNumber(text, labels = []) {
  const labelPattern = labels.map((label) => escapeRegex(label)).join("|");
  if (!labelPattern) return 0;
  const match = String(text || "").match(new RegExp(`\\b(?:${labelPattern})\\b\\s*(?:is|of|=|:)?\\s*(?:₹|rs\\.?|inr\\s*)?([\\d,]+(?:\\.\\d+)?)`, "i"));
  return match ? toNumber(match[1].replace(/,/g, "")) : 0;
}

function extractAiChangeValues(text) {
  const normalized = normalizeAiText(text);
  const match = normalized.match(/(?:from|old|currently)\s+(?:₹|rs\.?|inr\s*)?([\d,]+(?:\.\d+)?)\s+(?:to|as|into)\s+(?:₹|rs\.?|inr\s*)?([\d,]+(?:\.\d+)?)/i)
    || normalized.match(/(?:₹|rs\.?|inr\s*)?([\d,]+(?:\.\d+)?)\s+(?:points?|miles?|spend|swipe|amount)\s+(?:to|as|into)\s+(?:₹|rs\.?|inr\s*)?([\d,]+(?:\.\d+)?)/i)
    || normalized.match(/\b(?:change|update|edit)\b.*?(?:₹|rs\.?|inr\s*)?([\d,]+(?:\.\d+)?).*?\bto\s+(?:₹|rs\.?|inr\s*)?([\d,]+(?:\.\d+)?)/i);
  if (!match) return { fromAmount: 0, toAmount: 0, fromPoints: 0, fromValue: 0 };

  const fromValue = toNumber(match[1].replace(/,/g, ""));
  const toValue = toNumber(match[2].replace(/,/g, ""));
  const before = normalized.slice(0, match.index || 0);
  const isPoints = /\b(points?|miles?)\b/.test(before.slice(-24)) || /\b(points?|miles?)\b/.test(match[0]);
  const isValue = /\b(value|worth|cash|amount|inr|rupees?)\b/.test(before.slice(-24)) || /\b(value|worth|cash|amount|inr|rupees?)\b/.test(match[0]);

  return {
    fromAmount: isPoints || isValue ? 0 : fromValue,
    toAmount: isPoints || isValue ? 0 : toValue,
    fromPoints: isPoints ? fromValue : 0,
    fromValue: isValue ? fromValue : 0,
    toPoints: isPoints ? toValue : 0,
    toValue: isValue ? toValue : 0,
  };
}

function extractAiMoneyValue(text) {
  return extractAiLabeledNumber(text, ["value", "worth", "cash", "amount", "monetary value"])
    || extractWorthValue(text);
}

function extractPartnerTransferRatio(text) {
  const match = String(text || "").match(/\b(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)\b/);
  return match ? `${match[1]}:${match[2]}` : "";
}

function extractPartnerName(text, card, knowledge = buildAiKnowledgeBase()) {
  const normalized = normalizeAiText(text);
  const knownPartner = Array.from(new Set(state.rpSpends
    .map((rpSpend) => String(rpSpend.partnerName || "").trim())
    .filter(Boolean)))
    .sort((a, b) => b.length - a.length)
    .find((partner) => normalized.includes(normalizeAiText(partner)));
  if (knownPartner) return knownPartner;

  const match = normalized.match(/\b(?:to|partner)\s+(.+?)(?=\s+(?:at|with|ratio|value|worth|from|using|for)\b|$)/i);
  if (!match) return "";

  const candidate = cleanAiResidual(stripKnownPhrases(match[1], [
    card?.name,
    card?.issuer,
    formatCardName(card),
    ...(knowledge?.phrases || []),
  ]));

  return /^(?:\d|points?|received|program)\b/.test(candidate) ? "" : candidate;
}

function extractAiPointsMetric(normalizedQuery) {
  if (/\b(unredeemed|available|remaining|balance)\b/.test(normalizedQuery)) return "unredeemed";
  if (/\b(received|credited|partner points|points earned)\b/.test(normalizedQuery)) return "received";
  if (/\b(used|spent|redeemed|deducted)\b/.test(normalizedQuery)) return "used";
  if (/\b(earned|added|credited to card)\b/.test(normalizedQuery)) return "earned";
  return "total";
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

function getAiFinancialYearOptions() {
  const current = getCurrentFinancialYearLabel();
  const match = current.match(/FY\s*(\d{2})-(\d{2})/i);
  if (!match) return [current];

  const start = Number(match[1]);
  return [-2, -1, 0, 1, 2].map((offset) => {
    const year = (start + offset + 100) % 100;
    const next = (year + 1) % 100;
    return `FY ${String(year).padStart(2, "0")}-${String(next).padStart(2, "0")}`;
  });
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
    add(rpSpend.partnerName);
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
          matchPoints: toNumber(example?.matchPoints),
          pointsValue: toNumber(example?.pointsValue),
          matchPointsValue: toNumber(example?.matchPointsValue),
          pointsReceived: toNumber(example?.pointsReceived),
          amount: toNumber(example?.amount),
          matchAmount: toNumber(example?.matchAmount),
          partnerName: String(example?.partnerName || "").trim(),
          partnerTransferRatio: String(example?.partnerTransferRatio || "").trim(),
          pointsMetric: String(example?.pointsMetric || "").trim(),
          createdAt: example?.createdAt || new Date().toISOString(),
        }))
        // Search history is not training data.  Ignore any older read-only
        // examples that may already exist in a saved Firebase document.
        .filter((example) => example.normalizedQuery && example.action !== "search" && example.queryKind !== "readonly")
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
  // Only confirmed add/update commands are useful for filling command
  // defaults.  Historical read-only examples are intentionally ignored so
  // they cannot affect search results or data-entry parsing.
  const examples = Array.isArray(trainer?.examples)
    ? trainer.examples.filter((example) => example?.action === "add" || example?.action === "update")
    : [];

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
    matchPoints: best.matchPoints || 0,
    pointsValue: best.pointsValue || 0,
    matchPointsValue: best.matchPointsValue || 0,
    pointsReceived: best.pointsReceived || 0,
    amount: best.amount || 0,
    matchAmount: best.matchAmount || 0,
    partnerName: best.partnerName || "",
    partnerTransferRatio: best.partnerTransferRatio || "",
    pointsMetric: best.pointsMetric || "",
  };
}

function recordAiTrainingExample(resolved, savedRecord) {
  const query = String(resolved?.rawQuery || "").trim();
  if (!query || !["add", "update"].includes(resolved?.action)) return;

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
        matchPoints: toNumber(resolved.matchPoints),
        pointsValue: toNumber(resolved.pointsValue || savedRecord?.pointsValue),
        matchPointsValue: toNumber(resolved.matchPointsValue),
        pointsReceived: toNumber(resolved.pointsReceived || savedRecord?.pointsReceived),
        amount: toNumber(resolved.amount || savedRecord?.amount),
        matchAmount: toNumber(resolved.matchAmount),
        partnerName: String(resolved.partnerName || savedRecord?.partnerName || "").trim(),
        partnerTransferRatio: String(resolved.partnerTransferRatio || savedRecord?.partnerTransferRatio || "").trim(),
        pointsMetric: String(resolved.pointsMetric || "").trim(),
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

function normalizeAiSpecificText(value) {
  const text = String(value || "").trim();
  if (/^(spend|spends|reward spend|redemption|redeemed|points|miles|value|purchase|booking|at|to|using|with|partner)$/i.test(text)) return "";
  return text;
}

function extractSpentFor(text, card, knowledge = buildAiKnowledgeBase()) {
  const normalized = normalizeAiText(text);
  const explicit = normalized.match(/\b(?:spent for|for)\s+(.+?)(?=\s+(?:in\s+fy|fy\s*\d{2}|on|using|with|from|to)\b|$)/);
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
      const card = getRpSpendDisplayCard(rpSpend);
      const text = [
        "rp spend reward spend redemption",
        formatCardName(card),
        formatRpSourceName(rpSpend.cardId),
        rpSpend.productName,
        rpSpend.purchasedFrom,
        rpSpend.partnerName,
        rpSpend.partnerTransferRatio,
        rpSpend.points,
        rpSpend.redeemedPoints,
        rpSpend.pointsReceived,
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

  // Searching is read-only.  Do not write the query, its interpretation, or
  // any derived values into the portfolio or the local command trainer.
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

  if (intent?.module === "rpSpends" || looksLikeRpReadOnlyQuery(normalizedQuery)) {
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
  return /\b(annual fee|card fee|membership fee|total points|unredeemed points|membership rewards|mr points|points available|benefits?|cashback|statement credit|net profit|portfolio)\b/.test(normalizedQuery);
}

function looksLikeSwipeReadOnlyQuery(normalizedQuery) {
  return /\b(swipe|swipes|spend|spends|spending|expense|expenses|transaction|transactions|emi|full swipe|business spends?|personal spends?)\b/.test(normalizedQuery);
}

function looksLikeRpReadOnlyQuery(normalizedQuery) {
  return /\b(rp spend|reward points? spent|reward spend|points spend|points spent|points used|points value|points received|partner points|redeem|redeemed|voucher|purchase|partner|airline|hotel)\b/.test(normalizedQuery);
}

function looksLikeLoungeReadOnlyQuery(normalizedQuery) {
  // “Benefits” by itself is a portfolio metric.  It becomes a lounge query
  // only when the user also names a lounge/visit/access type.
  return /\b(lounge|lounges|visit|visits|airport lounge|priority pass|dreamfolks|golf|restaurant|spa|meet greet|airport transfer)\b/.test(normalizedQuery);
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
  const category = swipeCategory ? normalizeSwipeCategory(swipeCategory) : "";
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
  const wantsPointsUsed = intent?.pointsMetric === "used"
    || /\b(points used|points spent|how many points|total rp points|rp points)\b/.test(normalizedQuery);
  const wantsPointsReceived = intent?.pointsMetric === "received"
    || /\b(points received|partner points|credited|points earned)\b/.test(normalizedQuery)
    || (intent?.module === "rpSpends" && /\b(points?|miles?)\b/.test(normalizedQuery) && !/\b(value|cash|amount|spend|spent|redeem)\b/.test(normalizedQuery));
  const wantsPointsValue = /\b(points value|redeemed value|monetary value|value of points)\b/.test(normalizedQuery);
  const matches = state.rpSpends
    .filter((rpSpend) => !card || isRpSpendForCard(rpSpend, card.id))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const totalValue = matches.reduce((sum, rpSpend) => sum + getRpSpendPaidValue(rpSpend), 0);
  const totalPointsUsed = matches.reduce((sum, rpSpend) => sum + getRpSpendRedemptionAmount(rpSpend), 0);
  const totalPointsReceived = matches.reduce((sum, rpSpend) => sum + (isPartnerProgramRpSpend(rpSpend) ? getPartnerProgramPoints(rpSpend) : 0), 0);
  const totalPointsValue = matches.reduce((sum, rpSpend) => sum + toNumber(rpSpend.pointsValue), 0);

  const intentLabel = wantsPointsReceived
    ? (card ? `${intentLabelCard} partner points received` : "Total partner points received")
    : wantsPointsUsed
    ? (card ? `${intentLabelCard} RP points used` : "Total RP points used")
    : (card ? `${intentLabelCard} RP spend value` : "Total RP spend value");

  const primaryValue = wantsPointsReceived
    ? formatPoints(totalPointsReceived)
    : wantsPointsUsed
      ? formatPoints(totalPointsUsed)
      : wantsPointsValue
        ? formatMoney(totalPointsValue)
        : formatMoney(totalValue);

  return {
    title: "RP Spends",
    subtitle: "Exact RP spend totals from saved reward spends",
    metricKey: wantsPointsReceived ? "rp.pointsReceived" : wantsPointsUsed ? "rp.pointsUsed" : wantsPointsValue ? "rp.pointsValue" : "rp.value",
    queryKind: "readonly",
    intentLabel,
    scopeLabel: card ? intentLabelCard : "all RP spends",
    primaryValue,
    primaryMeta: wantsPointsReceived || wantsPointsUsed
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
          const card = getRpSpendDisplayCard(rpSpend);
          const pointsLabel = isPartnerProgramRpSpend(rpSpend)
            ? `Source ${formatPoints(getRpSpendRedemptionAmount(rpSpend))} | Received ${formatPoints(getPartnerProgramPoints(rpSpend))}`
            : `Points ${formatPoints(getRpSpendTotalPoints(rpSpend))}`;
          return `
            <div class="ai-result-card">
              <strong>${escapeHtml(card ? formatCardName(card) : formatRpSourceName(rpSpend.cardId))}</strong>
              <div class="ai-result-meta">${escapeHtml(rpSpend.productName || "Reward spend")} | ${escapeHtml(rpSpend.purchasedFrom || "Card / voucher")}</div>
              <div class="ai-result-meta">${escapeHtml(pointsLabel)} | Value ${escapeHtml(formatMoney(getRpSpendPaidValue(rpSpend)))}</div>
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

function isRpSpendForCard(rpSpend, cardId) {
  const targetCardId = String(cardId || "").trim();
  if (!targetCardId) return true;
  return rpSpend?.cardId === targetCardId
    || getRpSpendRedeemedSourceCardId(rpSpend) === targetCardId;
}

function getRpSpendDisplayCard(rpSpend) {
  const sourceCardId = getRpSpendRedeemedSourceCardId(rpSpend);
  return getCardById(sourceCardId) || getCardById(rpSpend?.cardId) || null;
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
              <div class="ai-result-meta">${escapeHtml(isPartnerProgramRpSpend(rpSpend) ? `Source ${formatPoints(getRpSpendRedemptionAmount(rpSpend))} | Received ${formatPoints(getPartnerProgramPoints(rpSpend))}` : `Points ${formatPoints(getRpSpendTotalPoints(rpSpend))}`)} | Value ${escapeHtml(formatMoney(getRpSpendPaidValue(rpSpend)))}</div>
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
      scrollToPageTop();
    }
    return;
  }

  if (button.dataset.aiOpen === "swipe-edit") {
    const swipe = state.swipes.find((item) => item.id === button.dataset.swipeId);
    if (swipe) {
      closeAiModal();
      showView("swipes");
      populateSwipeForm(swipe);
      scrollToPageTop();
    }
    return;
  }

  if (button.dataset.aiOpen === "rp-edit") {
    const rpSpend = state.rpSpends.find((item) => item.id === button.dataset.rpId);
    if (rpSpend) {
      closeAiModal();
      showView("rpSpends");
      populateRpSpendForm(rpSpend);
      scrollToPageTop();
    }
    return;
  }

  if (button.dataset.aiOpen === "lounge-edit") {
    const visit = state.loungeVisits.find((item) => item.id === button.dataset.loungeId);
    if (visit) {
      closeAiModal();
      showView("lounge");
      populateLoungeVisitForm(visit);
      scrollToPageTop();
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

  if (resolved.action === "update") {
    const existing = await resolveAiUpdateCandidate(
      resolved,
      findSwipeMatchesForIntent(resolved),
      formatAiSwipeCandidate,
      "Which swipe should I update?",
      "More than one swipe matches. Select the exact saved record."
    );
    if (!existing) return null;
    resolved.existingId = existing.id;
    resolved.existingRecord = existing;
  }

  if (!resolved.category) {
    resolved.category = resolved.existingRecord?.category || await showAiPrompt({
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
    resolved.swipeType = resolved.existingRecord?.type || await showAiPrompt({
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
    const financialYearOptions = getAiFinancialYearOptions();
    resolved.financialYear = resolved.existingRecord?.financialYear || await showAiPrompt({
      title: "Financial year",
      message: "Select the financial year for the swipe.",
      options: financialYearOptions.map((value) => ({ value, label: value })),
      value: getCurrentFinancialYearLabel(),
    });
  }
  if (!resolved.financialYear) return null;

  if (!resolved.amount) {
    const amountValue = await showAiPrompt({
      title: "Swipe amount",
      message: resolved.action === "update" ? "Enter the new swipe value." : "Enter the swipe value.",
      type: "number",
      placeholder: "25000",
    });
    resolved.amount = toNumber(amountValue);
  }
  if (!resolved.amount) return null;

  if (normalizeSwipeCategory(resolved.category) === "personal" && !resolved.spentFor) {
    if (resolved.existingRecord?.spentFor) {
      resolved.spentFor = resolved.existingRecord.spentFor;
    } else {
      const spentForSuggestions = getAiSuggestedSpentFor(resolved.card, resolved.category);
      resolved.spentFor = await showAiPrompt({
        title: "Spent for",
        message: "This is mandatory for personal swipes.",
        type: "text",
        placeholder: "e.g. Laptop, Rent",
        suggestions: spentForSuggestions,
      });
    }
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

  let isPartnerProgram = isAiPartnerRpCommand(resolved);

  if (resolved.action === "update") {
    const existing = await resolveAiUpdateCandidate(
      resolved,
      findRpMatchesForIntent(resolved),
      formatAiRpCandidate,
      "Which RP spend should I update?",
      "More than one RP spend matches. Select the exact saved record."
    );
    if (!existing) return null;
    resolved.existingId = existing.id;
    resolved.existingRecord = existing;
    if (isPartnerProgramRpSpend(existing)) {
      isPartnerProgram = true;
      if (!resolved.partnerName) resolved.partnerName = existing.partnerName;
      if (!resolved.partnerTransferRatio) resolved.partnerTransferRatio = existing.partnerTransferRatio;
    }

    const normalizedUpdate = normalizeAiText(resolved.rawQuery || "");
    const explicitlyChangesPoints = /\b\d[\d,]*(?:\.\d+)?\s*(?:points?|miles?)\b/.test(normalizedUpdate)
      || /\bpoints?\s+(?:from|to|used|spent|redeemed)\b/.test(normalizedUpdate);
    const explicitlyChangesValue = /\b(?:value|worth|cash|monetary value)\s+(?:from|to|of|is|=)/.test(normalizedUpdate)
      || resolved.matchPointsValue > 0;
    if (!explicitlyChangesPoints) resolved.points = getRpSpendTotalPoints(existing);
    if (!explicitlyChangesValue) resolved.pointsValue = toNumber(existing.pointsValue);
  }

  if (isPartnerProgram && !resolved.partnerName) {
    resolved.partnerName = await showAiPrompt({
      title: "Partner program",
      message: "Enter the airline or hotel partner name.",
      type: "text",
      placeholder: "e.g. Accor, Marriott, Emirates",
    });
  }
  if (isPartnerProgram && !resolved.partnerName) return null;

  if (isPartnerProgram && !resolved.partnerTransferRatio) {
    resolved.partnerTransferRatio = await showAiPrompt({
      title: "Transfer ratio",
      message: "Enter the partner transfer ratio, for example 1:2.",
      type: "text",
      placeholder: "1:2",
    });
  }
  if (isPartnerProgram && !parsePartnerTransferRatio(resolved.partnerTransferRatio)) {
    showToast("Enter a valid partner transfer ratio such as 1:2.");
    return null;
  }

  if (isPartnerProgram && (!resolved.productName || normalizeAiText(resolved.productName).includes(normalizeAiText(resolved.partnerName)))) {
    resolved.productName = resolved.existingRecord?.productName || resolved.partnerName;
  }

  if (!resolved.productName) {
    resolved.productName = resolved.existingRecord?.productName || (isPartnerProgram ? resolved.partnerName : await showAiPrompt({
      title: "Product name",
      message: "Tell me what this RP spend is for.",
      type: "text",
      placeholder: "e.g. Atlas miles",
    }));
  }
  if (!resolved.productName) return null;

  if (!resolved.points) {
    const pointsValue = await showAiPrompt({
      title: "Points used",
      message: "Enter the source-card points used.",
      type: "number",
      placeholder: "6000",
    });
    resolved.points = toNumber(pointsValue);
  }
  if (!resolved.points) return null;

  if (!resolved.pointsValue && !resolved.cardPaid && !resolved.voucherPaid && !resolved.redemptionCharges) {
    resolved.pointsValue = await showAiPrompt({
      title: "Value paid",
      message: isPartnerProgram
        ? "Enter the manual monetary value of the partner points."
        : "Enter the cash value paid for this reward spend.",
      type: "number",
      placeholder: "9000",
      required: isPartnerProgram ? true : false,
    });
    resolved.pointsValue = toNumber(resolved.pointsValue);
  }

  if (isPartnerProgram) {
    resolved.partnerProgram = true;
    resolved.pointsReceived = computePartnerTransferPoints(resolved.points, parsePartnerTransferRatio(resolved.partnerTransferRatio));
  }

  return resolved;
}

function isAiPartnerRpCommand(intent) {
  const normalized = normalizeAiText(intent?.rawQuery || "");
  return Boolean(intent?.partnerName || intent?.partnerTransferRatio)
    || /\b(partner|airline|hotel|transfer|miles transfer|points transfer)\b/.test(normalized);
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
  const isPartnerProgram = Boolean(resolved.partnerProgram || resolved.partnerName || resolved.partnerTransferRatio);
  const pointsLine = isPartnerProgram
    ? `Source points ${formatPoints(resolved.points)} | Partner points received ${formatPoints(resolved.pointsReceived || computePartnerTransferPoints(resolved.points, parsePartnerTransferRatio(resolved.partnerTransferRatio)))} | Ratio ${resolved.partnerTransferRatio}`
    : `Points ${formatPoints(resolved.points)}`;
  return `
    <div class="ai-search-results">
      <section class="ai-search-section">
        <div class="ai-result-card">
          <strong>${escapeHtml(formatCardName(resolved.card))}</strong>
          <div class="ai-result-meta">${escapeHtml(resolved.productName || resolved.partnerName || "")}</div>
          <div class="ai-result-meta">${escapeHtml(pointsLine)} | Value ${escapeHtml(formatMoney(resolved.pointsValue || 0))}</div>
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
  return findSwipeMatchesForIntent(intent)[0] || null;
}

function findSwipeMatchesForIntent(intent) {
  const cardId = intent.card?.id || "";
  const matchAmount = toNumber(intent.matchAmount);
  const candidates = state.swipes.filter((swipe) => {
    if (cardId && swipe.cardId !== cardId) return false;
    if (intent.category && normalizeSwipeCategory(swipe.category) !== normalizeSwipeCategory(intent.category)) return false;
    if (intent.swipeType && swipe.type !== intent.swipeType) return false;
    if (intent.financialYear && normalizeFinancialYear(swipe.financialYear) !== normalizeFinancialYear(intent.financialYear)) return false;
    if (matchAmount > 0 && toNumber(swipe.amount) !== matchAmount) return false;
    if (intent.action !== "update" && !matchAmount && intent.amount && toNumber(swipe.amount) !== toNumber(intent.amount)) return false;
    if (intent.spentFor && normalizeAiText(swipe.spentFor) !== normalizeAiText(intent.spentFor)) return false;
    return true;
  });

  return candidates.sort((a, b) => getSwipeCreatedTime(b) - getSwipeCreatedTime(a));
}

function findRpMatchForIntent(intent) {
  return findRpMatchesForIntent(intent)[0] || null;
}

function findRpMatchesForIntent(intent) {
  const cardId = intent.card?.id || "";
  const matchPoints = toNumber(intent.matchPoints);
  const matchPointsValue = toNumber(intent.matchPointsValue);
  const candidates = state.rpSpends.filter((rpSpend) => {
    if (cardId && !isRpSpendForCard(rpSpend, cardId)) return false;
    if (intent.productName && normalizeAiText(rpSpend.productName) !== normalizeAiText(intent.productName)) return false;
    if (intent.purchasedFrom && normalizeAiText(rpSpend.purchasedFrom || rpSpend.partnerName) !== normalizeAiText(intent.purchasedFrom)) return false;
    if (intent.partnerName && normalizeAiText(rpSpend.partnerName || rpSpend.purchasedFrom) !== normalizeAiText(intent.partnerName)) return false;
    if (matchPoints > 0 && getRpSpendTotalPoints(rpSpend) !== matchPoints && getRpSpendRedemptionAmount(rpSpend) !== matchPoints) return false;
    if (matchPointsValue > 0 && toNumber(rpSpend.pointsValue) !== matchPointsValue) return false;
    if (intent.action !== "update" && !matchPoints && intent.points && getRpSpendTotalPoints(rpSpend) !== toNumber(intent.points)) return false;
    return true;
  });

  return candidates.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function formatAiSwipeCandidate(swipe) {
  const card = getCardById(swipe.cardId);
  return `${formatCardName(card)} | ${formatMoney(swipe.amount)} | ${normalizeSwipeCategory(swipe.category) === "personal" ? "Personal" : "Business"} | ${swipe.spentFor || "No spent-for note"} | ${swipe.financialYear || "No FY"}`;
}

function formatAiRpCandidate(rpSpend) {
  const card = getRpSpendDisplayCard(rpSpend);
  const source = card ? formatCardName(card) : formatRpSourceName(rpSpend.cardId);
  const partner = rpSpend.partnerName ? ` | ${rpSpend.partnerName}` : "";
  return `${source}${partner} | ${rpSpend.productName || "Reward spend"} | ${formatPoints(getRpSpendTotalPoints(rpSpend))} | ${formatMoney(toNumber(rpSpend.pointsValue))}`;
}

async function resolveAiUpdateCandidate(intent, candidates, formatCandidate, title, message) {
  if (intent.action !== "update") return null;
  if (!candidates.length) {
    showToast("No matching record found. Add more identifying details such as amount, product, merchant, or FY.");
    return null;
  }
  if (candidates.length === 1) return candidates[0];

  const selectedId = await showAiPrompt({
    title,
    message,
    options: candidates.slice(0, 8).map((candidate) => ({
      value: candidate.id,
      label: formatCandidate(candidate),
    })),
  });

  return candidates.find((candidate) => candidate.id === selectedId) || null;
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
  const existing = resolved.action === "update"
    ? state.swipes.find((item) => item.id === resolved.existingId) || findSwipeMatchForIntent(resolved)
    : null;
  const swipe = normalizeSwipe({
    id: existing?.id || createId(),
    cardId: resolved.card?.id || existing?.cardId || "",
    amount: resolved.amount || existing?.amount,
    type: resolved.swipeType || existing?.type,
    financialYear: normalizeFinancialYear(resolved.financialYear || existing?.financialYear),
    category: normalizeSwipeCategory(resolved.category || existing?.category),
    spentFor: resolved.spentFor || existing?.spentFor || "",
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
  const existing = resolved.action === "update"
    ? state.rpSpends.find((item) => item.id === resolved.existingId) || findRpMatchForIntent(resolved)
    : null;
  const card = resolved.card;
  const portfolioCard = card?.id ? getCardById(card.id) : null;
  const enteredPoints = toNumber(resolved.points);
  const isPartnerProgram = Boolean(resolved.partnerProgram || resolved.partnerName || resolved.partnerTransferRatio);
  const isPortfolioCard = Boolean(portfolioCard) && !isPartnerProgram;
  const partnerSourceCard = isPartnerProgram ? portfolioCard : null;
  let redeemedPoints = 0;

  if ((isPortfolioCard || partnerSourceCard) && enteredPoints > 0) {
    const priorRedeemedPoints = existing
      && getRpSpendRedeemedSourceCardId(existing) === card.id
      ? Math.min(getRpSpendTotalPoints(existing), toNumber(existing.redeemedPoints))
      : 0;
    const availablePoints = getCardUnredeemedPoints(partnerSourceCard || portfolioCard) + priorRedeemedPoints;

    if (enteredPoints > availablePoints) {
      showToast(`You can redeem up to ${formatPoints(availablePoints)} from ${formatCardShortName(partnerSourceCard || portfolioCard)}.`);
      return false;
    }

    redeemedPoints = enteredPoints;
  }

  const partnerRatio = isPartnerProgram ? parsePartnerTransferRatio(resolved.partnerTransferRatio) : null;
  const partnerPointsReceived = isPartnerProgram
    ? computePartnerTransferPoints(enteredPoints, partnerRatio)
    : 0;

  const rpSpend = normalizeRpSpend({
    id: existing?.id || createId(),
    purchaseId: existing?.purchaseId || existing?.id || createId(),
    cardId: isPartnerProgram ? partnerProgramPlatformValue : card.id,
    points: resolved.points || existing?.points,
    redeemedPoints,
    unredeemedPointsRecord: false,
    pointsValue: resolved.pointsValue || (existing?.pointsValue || 0),
    redemptionCharges: resolved.redemptionCharges || existing?.redemptionCharges || 0,
    cardPaid: resolved.cardPaid || existing?.cardPaid || 0,
    voucherPaid: resolved.voucherPaid || existing?.voucherPaid || 0,
    partnerProgram: isPartnerProgram,
    partnerName: isPartnerProgram ? resolved.partnerName : "",
    purchasedFrom: isPartnerProgram ? resolved.partnerName : (resolved.purchasedFrom || existing?.purchasedFrom || ""),
    originatingCardId: isPartnerProgram ? card.id : "",
    partnerTransferRatio: isPartnerProgram ? resolved.partnerTransferRatio : "",
    productName: resolved.productName || existing?.productName,
    pointsReceived: isPartnerProgram ? partnerPointsReceived : existing?.pointsReceived,
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

  if ((isPortfolioCard || partnerSourceCard) && enteredPoints > 0) {
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
  return [els.dashboardView, els.portfolioView, els.swipesView, els.rpSpendsView, els.pprView, els.loungeView, els.intlTravelView].filter(Boolean);
}

function handleDashboardStudioAction(event) {
  const navTarget = event.target.closest?.("[data-dashboard-nav]");
  if (navTarget) {
    const view = navTarget.dataset.dashboardNav;
    if (view) showView(view);
    return;
  }

  const actionTarget = event.target.closest?.("[data-dashboard-action]");
  if (actionTarget) {
    const action = actionTarget.dataset.dashboardAction;
    if (action === "export") els.exportBtn?.click();
    if (action === "import") els.importBtn?.click();
    if (action === "logout") els.lockBtn?.click();
    return;
  }

  const focusTarget = event.target.closest?.("[data-dashboard-focus]");
  if (focusTarget?.dataset.dashboardFocus === "ai") {
    els.aiCommandInput?.focus();
  }
}

function syncActiveViewClasses() {
  const viewMap = {
    dashboard: els.dashboardView,
    portfolio: els.portfolioView,
    swipes: els.swipesView,
    rpSpends: els.rpSpendsView,
    ppr: els.pprView,
    lounge: els.loungeView,
    intlTravel: els.intlTravelView,
  };

  if (document.body) {
    document.body.dataset.view = state.currentView;
  }

  Object.entries(viewMap).forEach(([name, view]) => {
    view?.classList.toggle("is-active-view", name === state.currentView);
  });

  document.querySelectorAll("[data-dashboard-nav]").forEach((button) => {
    const isActive = button.dataset.dashboardNav === state.currentView;
    button.classList.toggle("is-active", isActive);
    if (isActive) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
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
    intlTravel: els.intlTravelView,
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

function setWidgetValueState(element, value) {
  if (!element) return;

  const stateKey = toNumber(value) > 0 ? "profit" : "loss";
  element.dataset.valueState = stateKey;

  const card = element.closest(".metric-card");
  if (!card) return;

  card.classList.remove("profit", "loss", "breakeven");
  card.classList.add(stateKey);
}

function normalizeViewName(view) {
  return ["dashboard", "portfolio", "swipes", "rpSpends", "ppr", "lounge", "intlTravel"].includes(view) ? view : "dashboard";
}

function renderDashboard() {
  const totals = getTotals(state.cards);
  const swipeTotal = getSwipeTotal();
  const swipeCategoryTotals = getSwipeCategoryTotals();
  const rpPointsUsageTotals = getRpPointsUsageTotals();
  const pprSummary = getPprSummary();
  const loungeTotal = getLoungeVisitTotal();
  const intlTravelTotals = getIntlTravelTotals();
  const portfolioRecovery = totals.deficit
    ? Math.min(100, (totals.surplus / totals.deficit) * 100)
    : totals.surplus
      ? 100
      : 0;
  const businessShare = swipeTotal > 0 ? (swipeCategoryTotals.business / swipeTotal) * 100 : 0;
  const personalShare = swipeTotal > 0 ? (swipeCategoryTotals.personal / swipeTotal) * 100 : 0;
  const formatShare = (value) => `${toNumber(value).toFixed(1).replace(/\.0$/, "")}%`;
  const loungeBenefitVisits = state.loungeVisits.filter(isLoungeBenefitVisit);
  const loungeVisitTypes = ["Domestic", "International"]
    .filter((type) => loungeBenefitVisits.some((visit) => visit.loungeType === type));
  const loungeAccessMethods = Array.from(new Set(
    loungeBenefitVisits
      .map((visit) => normalizeLoungeAccessMethod(visit.accessMethod))
      .filter(Boolean)
  ));
  const latestLoungeVisit = loungeBenefitVisits
    .slice()
    .sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0))[0];
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";

  if (els.dashboardDateLabel) {
    const dateLabel = new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    }).format(now);
    els.dashboardDateLabel.textContent = `Portfolio pulse · ${dateLabel}`;
  }

  if (els.dashboardGreetingLead) {
    els.dashboardGreetingLead.textContent = `${greeting}, Sarav.`;
  }

  if (els.dashboardNetValue) {
    els.dashboardNetValue.textContent = formatMoney(totals.net);
    els.dashboardNetValue.style.removeProperty("color");
    els.dashboardNetValue.dataset.valueState = totals.net > 0 ? "profit" : totals.net < 0 ? "loss" : "neutral";
    setWidgetValueState(els.dashboardNetValue, totals.net);
  }

  if (els.dashboardNetHint) {
    els.dashboardNetHint.textContent = `${state.cards.length} active ${state.cards.length === 1 ? "card" : "cards"} · Fees and benefits consolidated · Individual card drill-down retained`;
  }

  if (els.dashboardPortfolioFeeValue) {
    els.dashboardPortfolioFeeValue.textContent = formatMoney(totals.fees);
  }

  if (els.dashboardPortfolioPointsValue) {
    els.dashboardPortfolioPointsValue.textContent = formatPoints(rpPointsUsageTotals.notSpent);
  }

  if (els.dashboardPortfolioRecoveryValue) {
    els.dashboardPortfolioRecoveryValue.textContent = `${Math.round(portfolioRecovery)}%`;
  }

  if (els.dashboardHeroPoints) {
    els.dashboardHeroPoints.textContent = formatPoints(rpPointsUsageTotals.notSpent);
  }

  if (els.dashboardHeroNet) {
    els.dashboardHeroNet.textContent = formatMoney(totals.net);
    els.dashboardHeroNet.dataset.valueState = totals.net > 0 ? "profit" : totals.net < 0 ? "loss" : "neutral";
  }

  if (els.dashboardHeroStatus) {
    els.dashboardHeroStatus.textContent = totals.net > 0
      ? "Portfolio profitable"
      : totals.net < 0
        ? "Portfolio under recovery"
        : "Portfolio at break-even";
  }

  if (els.dashboardSwipeValue) {
    els.dashboardSwipeValue.textContent = formatMoney(swipeTotal);
  }

  if (els.dashboardSwipeHint) {
    els.dashboardSwipeHint.textContent = `${state.swipes.length} recorded ${state.swipes.length === 1 ? "spend" : "spends"}`;
  }

  if (els.dashboardSwipeBusinessBar) {
    els.dashboardSwipeBusinessBar.style.width = `${businessShare}%`;
  }

  if (els.dashboardSwipePersonalBar) {
    els.dashboardSwipePersonalBar.style.width = `${personalShare}%`;
  }

  if (els.dashboardSwipeBusinessLabel) {
    els.dashboardSwipeBusinessLabel.textContent = `Business · ${formatShare(businessShare)}`;
  }

  if (els.dashboardSwipePersonalLabel) {
    els.dashboardSwipePersonalLabel.textContent = `Personal · ${formatShare(personalShare)}`;
  }

  if (els.dashboardSwipeBusinessValue) {
    els.dashboardSwipeBusinessValue.textContent = formatMoney(swipeCategoryTotals.business);
  }

  if (els.dashboardSwipePersonalValue) {
    els.dashboardSwipePersonalValue.textContent = formatMoney(swipeCategoryTotals.personal);
  }

  if (els.dashboardLoungeValue) {
    els.dashboardLoungeValue.textContent = formatMoney(loungeTotal);
  }

  if (els.dashboardLoungeHint) {
    els.dashboardLoungeHint.textContent = `${loungeBenefitVisits.length} lounge ${loungeBenefitVisits.length === 1 ? "record" : "records"}`;
  }

  if (els.dashboardLoungeVisitTypes) {
    els.dashboardLoungeVisitTypes.textContent = loungeVisitTypes.length
      ? loungeVisitTypes.join(" + ")
      : "No visits recorded";
  }

  if (els.dashboardLoungeAccessMethods) {
    els.dashboardLoungeAccessMethods.textContent = loungeAccessMethods.length
      ? loungeAccessMethods.join(" · ")
      : "Not entered";
  }

  if (els.dashboardLoungeLatestVisit) {
    els.dashboardLoungeLatestVisit.textContent = latestLoungeVisit
      ? formatLoungeUsageDate(latestLoungeVisit.date || latestLoungeVisit.createdAt)
      : "Not entered";
  }

  if (els.dashboardRpValue) {
    els.dashboardRpValue.innerHTML = `
      <div class="dashboard-v2-points-item">
        <span>Redeemed</span>
        <strong>${escapeHtml(formatPoints(rpPointsUsageTotals.spent))}</strong>
        <small>Includes redemptions recorded at zero monetary value</small>
      </div>
      <div class="dashboard-v2-points-item">
        <span>Unredeemed</span>
        <strong>${escapeHtml(formatPoints(rpPointsUsageTotals.notSpent))}</strong>
        <small>Includes remaining welcome-benefit points</small>
      </div>
      <div class="dashboard-v2-points-detail">
        <span>Total points recorded</span>
        <strong>${escapeHtml(formatPoints(rpPointsUsageTotals.spent + rpPointsUsageTotals.notSpent))}</strong>
      </div>
      <div class="dashboard-v2-points-detail">
        <span>Axis grouping</span>
        <strong>Edge Rewards + Edge Miles</strong>
      </div>
    `;
  }

  if (els.dashboardRpHint) {
    els.dashboardRpHint.textContent = "";
  }

  if (els.dashboardPprValue) {
    els.dashboardPprValue.textContent = formatPoints(pprSummary.totalPoints);
  }

  if (els.dashboardPprHint) {
    els.dashboardPprHint.textContent = `${pprSummary.partnerCount} ${pprSummary.partnerCount === 1 ? "program" : "programs"} consolidated`;
  }

  if (els.dashboardPprPrograms) {
    const programNames = pprSummary.partnerRows.map((row) => row.partnerName).slice(0, 3);
    els.dashboardPprPrograms.textContent = programNames.length ? programNames.join(" · ") : "No programs";
  }

  if (els.dashboardPprEntries) {
    els.dashboardPprEntries.textContent = `${pprSummary.purchaseCount} ${pprSummary.purchaseCount === 1 ? "entry" : "entries"}`;
  }

  if (els.dashboardIntlTravelValue) {
    els.dashboardIntlTravelValue.textContent = `${intlTravelTotals.tripCount} ${intlTravelTotals.tripCount === 1 ? "trip" : "trips"}`;
  }

  if (els.dashboardIntlTravelHint) {
    els.dashboardIntlTravelHint.textContent = `${intlTravelTotals.expenseCount} ${intlTravelTotals.expenseCount === 1 ? "expense" : "expenses"}`;
  }

  renderDashboardTopBalances();
  renderDashboardUpcoming();
}

function getDashboardTopBalanceCards(limit = 4) {
  return state.cards
    .map((card) => ({ card, points: getCardUnredeemedPoints(card) }))
    .sort((a, b) => b.points - a.points || formatCardName(a.card).localeCompare(formatCardName(b.card)))
    .slice(0, Math.max(0, limit));
}

function getDashboardCardProgramLabel(card) {
  const axisProgram = getAxisProgram(card);
  const issuer = normalizeIssuerBank(card?.issuer || "");
  return axisProgram && axisProgram !== "Cashback"
    ? `${issuer} | ${axisProgram}`
    : issuer || "Issuer not set";
}

function renderDashboardTopBalances() {
  if (!els.dashboardTopBalancesList) return;

  const rows = getDashboardTopBalanceCards();
  if (!rows.length) {
    els.dashboardTopBalancesList.innerHTML = `
      <div class="dashboard-v2-empty-row">
        <strong>No cards yet</strong>
        <span>Add a card to see live balances here.</span>
      </div>
    `;
    return;
  }

  els.dashboardTopBalancesList.innerHTML = rows.map(({ card, points }) => `
    <div class="dashboard-v2-balance-row">
      <span class="dashboard-v2-card-symbol" aria-hidden="true">
        <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /></svg>
      </span>
      <span class="dashboard-v2-balance-copy">
        <strong>${escapeHtml(card?.name || formatCardName(card))}</strong>
        <small>${escapeHtml(getDashboardCardProgramLabel(card))}</small>
      </span>
      <strong>${escapeHtml(formatPoints(points))}</strong>
    </div>
  `).join("");
}

function getDashboardUpcomingFees(limit = 3) {
  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return state.cards
    .flatMap((card) => (card.futureAnnualFees || []).map((fee) => {
      const month = normalizeMonth(fee.month);
      const date = month ? new Date(`${month}-01T00:00:00`) : null;
      return { card, fee, month, date };
    }))
    .filter(({ date }) => date && !Number.isNaN(date.getTime()) && date >= currentMonth)
    .sort((a, b) => a.date - b.date || formatCardName(a.card).localeCompare(formatCardName(b.card)))
    .slice(0, Math.max(0, limit));
}

function renderDashboardUpcoming() {
  if (!els.dashboardUpcomingList) return;

  const upcomingFees = getDashboardUpcomingFees();
  if (!upcomingFees.length) {
    els.dashboardUpcomingList.innerHTML = `
      <div class="dashboard-v2-empty-row">
        <strong>No upcoming fee records</strong>
        <span>Add a future annual fee from a card entry to see it here.</span>
      </div>
    `;
    return;
  }

  els.dashboardUpcomingList.innerHTML = upcomingFees.map(({ card, fee, month, date }) => {
    const monthLabel = new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
    const yearLabel = new Intl.DateTimeFormat("en-US", { year: "2-digit" }).format(date);
    return `
      <div class="dashboard-v2-upcoming-row">
        <time datetime="${escapeAttribute(month)}">
          <span>${escapeHtml(monthLabel)}</span>
          <strong>${escapeHtml(yearLabel)}</strong>
        </time>
        <span>
          <strong>${escapeHtml(card?.name || formatCardName(card))}</strong>
          <small>Annual fee · ${escapeHtml(formatMoney(fee.amount))}</small>
        </span>
      </div>
    `;
  }).join("");
}

function renderDashboardInsight() {
  if (!els.dashboardInsightTitle || !els.dashboardInsightText || !els.dashboardInsightButton) return;

  const welcomeCards = state.cards
    .map((card) => ({ card, allocation: getCardPointAllocation(card) }))
    .filter(({ allocation }) => allocation.welcomeRemainingPoints > 0)
    .sort((a, b) => b.allocation.welcomeRemainingPoints - a.allocation.welcomeRemainingPoints);

  if (welcomeCards.length) {
    const { card, allocation } = welcomeCards[0];
    els.dashboardInsightTitle.textContent = "Welcome benefits ready";
    els.dashboardInsightText.textContent = `${formatCardName(card)} still has ${formatPoints(allocation.welcomeRemainingPoints)} available to use.`;
    els.dashboardInsightButton.textContent = "Open Reward Points";
    els.dashboardInsightButton.dataset.dashboardNav = "rpSpends";
    return;
  }

  const topBalance = getDashboardTopBalanceCards(1)[0];
  if (topBalance) {
    els.dashboardInsightTitle.textContent = "Highest spendable balance";
    els.dashboardInsightText.textContent = `${formatCardName(topBalance.card)} currently leads with ${formatPoints(topBalance.points)} ready to use.`;
    els.dashboardInsightButton.textContent = "Open Portfolio";
    els.dashboardInsightButton.dataset.dashboardNav = "portfolio";
    return;
  }

  els.dashboardInsightTitle.textContent = "Everything is mapped";
  els.dashboardInsightText.textContent = "Your portfolio is ready for the next reward decision.";
  els.dashboardInsightButton.textContent = "Open Reward Points";
  els.dashboardInsightButton.dataset.dashboardNav = "rpSpends";
}

function formatIntlTravelAmount(value) {
  return toNumber(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function isIntlTravelRefund(expense) {
  return expense?.phase === "Refund / Adjustment";
}

function getIntlTravelExpenseLocalAmount(expense) {
  return toNumber(expense?.localAmount);
}

function getIntlTravelExpenseInrAmount(expense) {
  return toNumber(expense?.inrAmount) + toNumber(expense?.markupFee);
}

function getIntlTravelRegularExpenses(expenses = []) {
  return expenses.filter((expense) => !isIntlTravelRefund(expense));
}

function formatIntlTravelCurrencyAmount(currency, amount) {
  const value = toNumber(amount);
  return `${value < 0 ? "-" : ""}${currency} ${formatIntlTravelAmount(Math.abs(value))}`;
}

function getIntlTravelTripTotal(trip) {
  return getIntlTravelRegularExpenses(trip?.expenses || [])
    .reduce((sum, expense) => sum + getIntlTravelExpenseInrAmount(expense), 0);
}

function getIntlTravelTotals() {
  const trips = Array.isArray(state.intlTravelTrips) ? state.intlTravelTrips : [];
  const expenses = trips.flatMap((trip) => trip.expenses || []);
  const regularExpenses = getIntlTravelRegularExpenses(expenses);
  return {
    tripCount: trips.length,
    expenseCount: expenses.length,
    expenseInr: regularExpenses.reduce((sum, expense) => sum + toNumber(expense.inrAmount), 0),
    markupInr: regularExpenses.reduce((sum, expense) => sum + toNumber(expense.markupFee), 0),
    totalInr: regularExpenses.reduce((sum, expense) => sum + getIntlTravelExpenseInrAmount(expense), 0),
  };
}

function getIntlTravelTripCurrencies(trip) {
  return getIntlTravelCurrencyTotals(trip?.expenses || [])
    .sort((a, b) => b.localAmount - a.localAmount)
    .map(({ currency, localAmount }) => formatIntlTravelCurrencyAmount(currency, localAmount))
    .join(" | ");
}

function getIntlTravelCurrencyTotals(expenses = []) {
  const totals = new Map();
  getIntlTravelRegularExpenses(expenses).forEach((expense) => {
    const currency = expense.currency || "INR";
    const current = totals.get(currency) || { currency, localAmount: 0, inrAmount: 0 };
    current.localAmount += getIntlTravelExpenseLocalAmount(expense);
    current.inrAmount += getIntlTravelExpenseInrAmount(expense);
    totals.set(currency, current);
  });
  return Array.from(totals.values());
}

function getIntlTravelPhaseTotals(expenses = []) {
  const phases = [
    { key: "Pre-trip booking", label: "Pre-trip" },
    { key: "On-trip", label: "On-trip" },
    { key: "Refund / Adjustment", label: "Refund / Adjustment" },
  ];

  return phases.map((phase) => {
    const phaseExpenses = expenses.filter((expense) => expense.phase === phase.key);
    return {
      ...phase,
      expenses: phaseExpenses,
      totalInr: phaseExpenses.reduce((sum, expense) => sum + getIntlTravelExpenseInrAmount(expense), 0),
      currencies: phase.key === "Refund / Adjustment"
        ? getIntlTravelCurrencyTotalsIncludingRefunds(phaseExpenses)
        : getIntlTravelCurrencyTotals(phaseExpenses),
    };
  });
}

function getIntlTravelCurrencyTotalsIncludingRefunds(expenses = []) {
  const totals = new Map();
  expenses.forEach((expense) => {
    const currency = expense.currency || "INR";
    const current = totals.get(currency) || { currency, localAmount: 0, inrAmount: 0 };
    current.localAmount += getIntlTravelExpenseLocalAmount(expense);
    current.inrAmount += getIntlTravelExpenseInrAmount(expense);
    totals.set(currency, current);
  });
  return Array.from(totals.values());
}

function getIntlTravelPaymentLabel(expense) {
  return [
    expense.paymentMethod,
    expense.paymentSource,
    expense.refundMethod ? `Refund: ${expense.refundMethod}` : "",
  ].filter(Boolean).join(" | ");
}

function setIntlTravelFilterOptions(select, values, allLabel) {
  if (!select) return;
  const currentValue = select.value;
  const uniqueValues = [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  select.innerHTML = [
    `<option value="all">${escapeHtml(allLabel)}</option>`,
    ...uniqueValues.map((value) => `<option value="${escapeAttribute(value)}">${escapeHtml(value)}</option>`),
  ].join("");
  select.value = uniqueValues.includes(currentValue) ? currentValue : "all";
}

function renderIntlTravelDetailFilterOptions(trip) {
  const expenses = trip?.expenses || [];
  setIntlTravelFilterOptions(
    els.intlTravelTypeFilter,
    expenses.map((expense) => expense.expenseType),
    "All types"
  );
  setIntlTravelFilterOptions(
    els.intlTravelCategoryFilter,
    expenses.map((expense) => expense.category),
    "All categories"
  );
  setIntlTravelFilterOptions(
    els.intlTravelPaymentFilter,
    expenses.map(getIntlTravelPaymentLabel),
    "All payments"
  );
}

function handleIntlTravelDetailFilterChange() {
  intlTravelExpensesAllExpanded = false;
  const trip = state.intlTravelTrips.find((item) => item.id === intlTravelDetailTripId);
  if (trip) renderIntlTravelDetail(trip);
}

function openIntlTravelTripNotesForm() {
  const trip = state.intlTravelTrips.find((item) => item.id === intlTravelDetailTripId);
  if (!trip || !els.intlTravelTripNotesForm) return;

  closeIntlTravelConversionForm();
  els.intlTravelTripNotesInput.value = trip.notes || "";
  els.intlTravelTripNotesForm.style.display = "block";
  els.intlTravelTripNotesInput.focus();
}

function closeIntlTravelTripNotesForm() {
  if (els.intlTravelTripNotesForm) els.intlTravelTripNotesForm.style.display = "none";
}

async function saveIntlTravelTripNotes(event) {
  event.preventDefault();
  const trip = state.intlTravelTrips.find((item) => item.id === intlTravelDetailTripId);
  if (!trip) return;

  trip.notes = els.intlTravelTripNotesInput?.value.trim() || "";
  closeIntlTravelTripNotesForm();
  await saveState();
  render();
  showToast("Trip notes saved.");
}

function compareIntlTravelExpensesByDate(a, b) {
  const parseExpenseDate = (value) => {
    const text = String(value || "").trim();
    if (!text) return 0;
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return Date.parse(`${text}T00:00:00`);
    const dayFirstMatch = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (dayFirstMatch) {
      const [, day, month, year] = dayFirstMatch;
      return Date.parse(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00`);
    }
    return Date.parse(text) || 0;
  };

  const aTime = parseExpenseDate(a.date);
  const bTime = parseExpenseDate(b.date);
  if (aTime && bTime) return aTime - bTime;
  if (aTime) return -1;
  if (bTime) return 1;
  return (Date.parse(a.createdAt || "") || 0) - (Date.parse(b.createdAt || "") || 0);
}

function getIntlTravelExpenseDisplayOrder(trip) {
  const expenses = [...(trip?.expenses || [])];
  const pinnedExpenses = expenses
    .filter((expense) => expense.manualBeforeId || expense.manualAfterId)
    .sort((a, b) => (a.manualOrder || 0) - (b.manualOrder || 0));
  const orderedExpenses = expenses
    .filter((expense) => !expense.manualBeforeId && !expense.manualAfterId)
    .sort(compareIntlTravelExpensesByDate);
  const pendingPinnedExpenses = [...pinnedExpenses];

  while (pendingPinnedExpenses.length) {
    let inserted = false;

    for (let index = 0; index < pendingPinnedExpenses.length; index += 1) {
      const expense = pendingPinnedExpenses[index];
      const anchorId = expense.manualAfterId || expense.manualBeforeId;
      const anchorIndex = orderedExpenses.findIndex((item) => item.id === anchorId);
      if (anchorIndex < 0) continue;

      const insertIndex = expense.manualAfterId ? anchorIndex + 1 : anchorIndex;
      orderedExpenses.splice(insertIndex, 0, expense);
      pendingPinnedExpenses.splice(index, 1);
      inserted = true;
      break;
    }

    if (!inserted) orderedExpenses.push(pendingPinnedExpenses.shift());
  }

  return orderedExpenses;
}

function getNextIntlTravelManualOrder(trip) {
  return (trip?.expenses || []).reduce(
    (highest, expense) => Math.max(highest, Number(expense.manualOrder) || 0),
    0
  ) + 1;
}

function handleIntlTravelExpenseDragStart(event) {
  const row = event.target.closest?.(".intl-travel-expense-row");
  if (!row) return;

  intlTravelDraggingExpenseId = row.dataset.expenseId || "";
  row.classList.add("is-dragging");
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", intlTravelDraggingExpenseId);
  }
}

function handleIntlTravelExpenseDragOver(event) {
  const row = event.target.closest?.(".intl-travel-expense-row");
  if (!row || !intlTravelDraggingExpenseId || row.dataset.expenseId === intlTravelDraggingExpenseId) return;

  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  event.currentTarget.querySelectorAll(".intl-travel-expense-row.is-drag-over").forEach((item) => {
    item.classList.remove("is-drag-over");
  });
  row.classList.add("is-drag-over");
}

async function handleIntlTravelExpenseDrop(event) {
  const row = event.target.closest?.(".intl-travel-expense-row");
  const sourceId = intlTravelDraggingExpenseId || event.dataTransfer?.getData("text/plain") || "";
  if (!row || !sourceId || row.dataset.expenseId === sourceId || !intlTravelDetailTripId) return;

  event.preventDefault();
  const trip = state.intlTravelTrips.find((item) => item.id === intlTravelDetailTripId);
  if (!trip) return;

  const sourceExpense = trip.expenses.find((expense) => expense.id === sourceId);
  const targetExpense = trip.expenses.find((expense) => expense.id === row.dataset.expenseId);
  if (!sourceExpense || !targetExpense) return;

  const targetRect = row.getBoundingClientRect();
  const placeAfterTarget = event.clientY > targetRect.top + targetRect.height / 2;
  sourceExpense.manualBeforeId = placeAfterTarget ? "" : targetExpense.id;
  sourceExpense.manualAfterId = placeAfterTarget ? targetExpense.id : "";
  sourceExpense.manualOrder = getNextIntlTravelManualOrder(trip);
  sourceExpense.displayOrder = null;
  intlTravelDraggingExpenseId = "";

  await saveState();
  render();
  showToast("Expense order saved.");
}

function handleIntlTravelExpenseDragEnd() {
  intlTravelDraggingExpenseId = "";
  els.intlTravelExpenseTable?.querySelectorAll(".is-dragging, .is-drag-over").forEach((item) => {
    item.classList.remove("is-dragging", "is-drag-over");
  });
}

function getIntlTravelTripDateLabel(trip) {
  const dates = [...new Set((trip?.expenses || []).map((expense) => expense.date).filter(Boolean))].sort();
  if (!dates.length) return "";
  return dates.length === 1 ? dates[0] : `${dates[0]} to ${dates[dates.length - 1]}`;
}

function getIntlTravelTripSortTime(trip) {
  const dates = (trip?.expenses || []).map((expense) => expense.createdAt || expense.date).filter(Boolean);
  return dates.length ? Math.max(...dates.map((value) => Date.parse(value) || 0)) : Date.parse(trip?.createdAt || "") || 0;
}

function renderIntlTravel() {
  renderIntlTravelTripCards();

  if (intlTravelFormOpen) {
    els.intlTravelHomeView.style.display = "none";
    els.intlTravelDetailView.style.display = "none";
    els.intlTravelExpenseForm.style.display = "block";
    return;
  }

  if (intlTravelDetailTripId) {
    showIntlTravelDetail(intlTravelDetailTripId);
    return;
  }

  els.intlTravelHomeView.style.display = "block";
  els.intlTravelExpenseForm.style.display = "none";
  els.intlTravelDetailView.style.display = "none";
}

function renderIntlTravelTripCards() {
  if (!els.intlTravelTripCards) return;

  const trips = [...(state.intlTravelTrips || [])].sort((a, b) => getIntlTravelTripSortTime(b) - getIntlTravelTripSortTime(a));
  els.intlTravelTripCount.textContent = `${trips.length} ${trips.length === 1 ? "trip" : "trips"}`;

  if (!trips.length) {
    els.intlTravelTripCards.innerHTML = `
      <div class="intl-travel-empty-state">
        <div class="empty-icon" aria-hidden="true"></div>
        <h3>No international trips yet</h3>
        <p class="empty-copy">Add a destination and your first expense to start tracking local currency and INR together.</p>
      </div>
    `;
    return;
  }

  els.intlTravelTripCards.innerHTML = trips.map((trip) => {
    const expenseCount = trip.expenses.length;
    const dateLabel = getIntlTravelTripDateLabel(trip);
    const currencyLabel = getIntlTravelTripCurrencies(trip);
    return `
      <article class="intl-travel-trip-card" data-intl-trip-id="${escapeAttribute(trip.id)}" tabindex="0" role="button" aria-label="Open ${escapeAttribute(trip.destination)} expenses">
        <div class="intl-travel-trip-card-topline">
          <span class="eyebrow">Destination</span>
          <span class="intl-travel-trip-arrow" aria-hidden="true">&#8599;</span>
        </div>
        <h3>${escapeHtml(trip.destination)}</h3>
        ${dateLabel ? `<p class="intl-travel-trip-date">${escapeHtml(dateLabel)}</p>` : ""}
        <div class="intl-travel-trip-total">${escapeHtml(formatMoney(getIntlTravelTripTotal(trip)))}</div>
        <div class="intl-travel-trip-meta">${expenseCount} ${expenseCount === 1 ? "expense" : "expenses"}</div>
        ${currencyLabel ? `<div class="intl-travel-trip-currencies">${escapeHtml(currencyLabel)}</div>` : ""}
        <span class="intl-travel-view-label">View expenses</span>
      </article>
    `;
  }).join("");
}

function handleIntlTravelTripAction(event) {
  const tripCard = event.target.closest?.("[data-intl-trip-id]");
  if (!tripCard) return;
  showIntlTravelDetail(tripCard.dataset.intlTripId);
}

function handleIntlTravelTripKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  const tripCard = event.target.closest?.("[data-intl-trip-id]");
  if (!tripCard) return;
  event.preventDefault();
  showIntlTravelDetail(tripCard.dataset.intlTripId);
}

function showIntlTravelHome() {
  intlTravelDetailTripId = "";
  intlTravelExpensesAllExpanded = false;
  intlTravelFormOpen = false;
  intlTravelEditorReturnTripId = "";
  intlTravelEditingExpenseId = "";
  intlTravelEditingConversionId = "";
  if (els.intlTravelTypeFilter) els.intlTravelTypeFilter.value = "all";
  if (els.intlTravelCategoryFilter) els.intlTravelCategoryFilter.value = "all";
  if (els.intlTravelPaymentFilter) els.intlTravelPaymentFilter.value = "all";
  closeIntlTravelConversionForm();
  closeIntlTravelTripNotesForm();
  resetIntlTravelExpenseForm();
  renderIntlTravelTripCards();
  if (els.intlTravelHomeView) els.intlTravelHomeView.style.display = "block";
  if (els.intlTravelExpenseForm) els.intlTravelExpenseForm.style.display = "none";
  if (els.intlTravelDetailView) els.intlTravelDetailView.style.display = "none";
}

function showIntlTravelDetail(tripId) {
  const trip = state.intlTravelTrips.find((item) => item.id === tripId);
  if (!trip) return showIntlTravelHome();

  intlTravelDetailTripId = trip.id;
  intlTravelExpensesAllExpanded = false;
  intlTravelFormOpen = false;
  intlTravelEditorReturnTripId = "";
  intlTravelEditingExpenseId = "";
  intlTravelEditingConversionId = "";
  if (els.intlTravelTypeFilter) els.intlTravelTypeFilter.value = "all";
  if (els.intlTravelCategoryFilter) els.intlTravelCategoryFilter.value = "all";
  if (els.intlTravelPaymentFilter) els.intlTravelPaymentFilter.value = "all";
  closeIntlTravelTripNotesForm();
  if (els.intlTravelHomeView) els.intlTravelHomeView.style.display = "none";
  if (els.intlTravelExpenseForm) els.intlTravelExpenseForm.style.display = "none";
  if (els.intlTravelDetailView) els.intlTravelDetailView.style.display = "block";
  renderIntlTravelDetail(trip);
}

function renderIntlTravelCurrencySummary(trip, expenses) {
  if (!els.intlTravelCurrencySummary) return;

  const currencyTotals = getIntlTravelCurrencyTotals(expenses);
  const phaseTotals = getIntlTravelPhaseTotals(expenses);
  const conversions = Array.isArray(trip.conversions) ? trip.conversions : [];
  els.intlTravelCurrencySummary.innerHTML = `
    <div class="intl-travel-currency-summary-heading">
      <div>
        <p class="eyebrow">Spend overview</p>
        <h4>Spent across currencies</h4>
      </div>
      <span>${currencyTotals.length} ${currencyTotals.length === 1 ? "currency" : "currencies"}</span>
    </div>
    ${currencyTotals.length ? `
      <div class="intl-travel-currency-card-grid">
        ${currencyTotals.map(({ currency, localAmount, inrAmount }) => `
          <article class="intl-travel-currency-card">
            <span>${escapeHtml(currency)}</span>
            <strong>${escapeHtml(formatIntlTravelCurrencyAmount(currency, localAmount))}</strong>
            <small>INR equivalent ${escapeHtml(formatMoney(inrAmount))}</small>
          </article>
        `).join("")}
      </div>
    ` : `
      <p class="intl-travel-currency-empty">No expenses match this type filter.</p>
    `}
    <div class="intl-travel-phase-summary">
      <div class="intl-travel-currency-summary-heading">
        <div>
          <p class="eyebrow">Travel phase</p>
          <h4>Spend by phase</h4>
        </div>
      </div>
      <div class="intl-travel-phase-card-grid">
        ${phaseTotals.map((phase) => `
          <article class="intl-travel-phase-card">
            <span>${escapeHtml(phase.label)}</span>
            <strong>${escapeHtml(formatMoney(phase.totalInr))}</strong>
            <small>${phase.expenses.length} ${phase.expenses.length === 1 ? "expense" : "expenses"}</small>
            <em>${escapeHtml(phase.currencies.length
              ? phase.currencies.map(({ currency, localAmount }) => formatIntlTravelCurrencyAmount(currency, localAmount)).join(" | ")
              : "No values entered")}</em>
          </article>
        `).join("")}
      </div>
    </div>
    ${conversions.length ? `
      <div class="intl-travel-conversion-history">
        <div class="intl-travel-currency-summary-heading">
          <div>
            <p class="eyebrow">Saved entries</p>
            <h4>Converted currency</h4>
          </div>
          <span>${conversions.length} ${conversions.length === 1 ? "entry" : "entries"}</span>
        </div>
        <div class="intl-travel-conversion-list">
          ${conversions.slice().sort((a, b) => (Date.parse(b.createdAt || "") || 0) - (Date.parse(a.createdAt || "") || 0)).map((conversion) => `
            <div class="intl-travel-conversion-row">
              <span>${escapeHtml(conversion.date || "")}</span>
              <strong>${escapeHtml(`${conversion.currency} ${formatIntlTravelAmount(conversion.localAmount)}`)}</strong>
              <b>${escapeHtml(formatMoney(conversion.inrAmount))}</b>
              <small>${escapeHtml(conversion.notes || "Converted currency")}</small>
              <div class="row-actions intl-travel-conversion-row-actions">
                <button class="icon-button subtle" type="button" data-intl-travel-conversion-action="edit" data-conversion-id="${escapeAttribute(conversion.id)}" title="Edit conversion" aria-label="Edit conversion">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                </button>
                <button class="icon-button subtle" type="button" data-intl-travel-conversion-action="delete" data-conversion-id="${escapeAttribute(conversion.id)}" title="Delete conversion" aria-label="Delete conversion">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></svg>
                </button>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    ` : ""}
  `;
}

function renderIntlTravelDetail(trip) {
  if (!trip || !els.intlTravelExpenseTable) return;

  renderIntlTravelDetailFilterOptions(trip);
  const selectedType = els.intlTravelTypeFilter?.value || "all";
  const selectedCategory = els.intlTravelCategoryFilter?.value || "all";
  const selectedPayment = els.intlTravelPaymentFilter?.value || "all";
  const expenses = selectedType === "all"
    ? trip.expenses
    : trip.expenses.filter((expense) => expense.expenseType === selectedType);
  const filteredExpenses = expenses.filter((expense) => {
    const paymentLabel = getIntlTravelPaymentLabel(expense);
    return (selectedCategory === "all" || expense.category === selectedCategory)
      && (selectedPayment === "all" || paymentLabel === selectedPayment);
  });
  const regularFilteredExpenses = getIntlTravelRegularExpenses(filteredExpenses);
  const total = regularFilteredExpenses.reduce((sum, expense) => sum + getIntlTravelExpenseInrAmount(expense), 0);
  const markupTotal = regularFilteredExpenses.reduce((sum, expense) => sum + toNumber(expense.markupFee), 0);
  const activeFilters = [
    selectedType !== "all" ? selectedType : "",
    selectedCategory !== "all" ? selectedCategory : "",
    selectedPayment !== "all" ? selectedPayment : "",
  ].filter(Boolean);
  els.intlTravelDetailTitle.textContent = trip.destination;
  els.intlTravelDetailSummary.innerHTML = `
    <span>${filteredExpenses.length} ${filteredExpenses.length === 1 ? "expense" : "expenses"}${activeFilters.length ? ` · ${escapeHtml(activeFilters.join(" · "))}` : ""}</span>
    <strong>${escapeHtml(formatMoney(total))} total</strong>
    ${markupTotal ? `<span>${escapeHtml(formatMoney(markupTotal))} fees</span>` : ""}
    ${trip.notes ? `<span class="intl-travel-trip-note-summary">Notes: ${escapeHtml(trip.notes)}</span>` : ""}
  `;
  renderIntlTravelCurrencySummary(trip, filteredExpenses);
  if (els.intlTravelConversionForm) els.intlTravelConversionForm.style.display = "none";
  if (els.intlTravelExpenseTable) els.intlTravelExpenseTable.style.display = "grid";

  if (!filteredExpenses.length) {
    removeLoadMoreIn(els.intlTravelExpenseTable);
    els.intlTravelExpenseTable.innerHTML = `
      <div class="intl-travel-empty-state">
        <h3>${activeFilters.length ? "No matching expenses" : "No expenses recorded"}</h3>
        <p class="empty-copy">${activeFilters.length ? "Choose different filters to see more expenses." : "Add the first expense for this destination."}</p>
      </div>
    `;
    return;
  }

  const displayOrder = getIntlTravelExpenseDisplayOrder(trip);
  const sortedExpenses = displayOrder.filter((expense) => filteredExpenses.includes(expense));
  const totalExpenseRecords = sortedExpenses.length;
  const visibleExpenseCount = intlTravelExpensesAllExpanded
    ? totalExpenseRecords
    : Math.min(INITIAL_VISIBLE_INTL_TRAVEL_RECORDS, totalExpenseRecords);
  const expensesToRender = sortedExpenses.slice(0, visibleExpenseCount);

  els.intlTravelExpenseTable.innerHTML = `
    <div class="intl-travel-expense-head">
      <span aria-label="Drag to reorder">Order</span>
      <span>Date</span>
      <span>Expense</span>
      <span>Category</span>
      <span>Local value</span>
      <span>INR value</span>
      <span>Payment</span>
      <span>Type</span>
      <span>Notes</span>
      <span></span>
    </div>
    ${expensesToRender.map((expense) => `
      <article class="intl-travel-expense-row" draggable="true" data-expense-id="${escapeAttribute(expense.id)}">
        <span class="intl-travel-drag-handle" title="Drag to reorder" aria-label="Drag to reorder">⠿</span>
        <span class="intl-travel-cell intl-travel-date-cell">${escapeHtml(expense.date || "")}</span>
        <div class="intl-travel-cell intl-travel-description-cell">
          <strong>${escapeHtml(expense.description || "Untitled expense")}</strong>
          ${expense.phase ? `<span>${escapeHtml(expense.phase)}</span>` : ""}
        </div>
        <span class="intl-travel-cell">${escapeHtml(expense.category)}</span>
        <strong class="intl-travel-cell intl-travel-local-value">${escapeHtml(formatIntlTravelCurrencyAmount(expense.currency, getIntlTravelExpenseLocalAmount(expense)))}</strong>
        <strong class="intl-travel-cell intl-travel-inr-value">${escapeHtml(formatMoney(getIntlTravelExpenseInrAmount(expense)))}</strong>
        <span class="intl-travel-cell">${escapeHtml([expense.paymentMethod, expense.paymentSource, expense.refundMethod ? `Refund: ${expense.refundMethod}` : ""].filter(Boolean).join(" | "))}</span>
        <span class="intl-travel-cell">${escapeHtml(expense.expenseType)}</span>
        <span class="intl-travel-cell intl-travel-notes-cell">${escapeHtml(expense.notes)}</span>
        <div class="row-actions intl-travel-row-actions">
          <button class="icon-button subtle" type="button" data-intl-travel-action="edit-expense" data-expense-id="${escapeAttribute(expense.id)}" title="Edit expense" aria-label="Edit expense">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
          </button>
          <button class="icon-button subtle" type="button" data-intl-travel-action="delete-expense" data-expense-id="${escapeAttribute(expense.id)}" title="Delete expense" aria-label="Delete expense">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></svg>
          </button>
        </div>
      </article>
    `).join("")}
  `;

  if (!intlTravelExpensesAllExpanded && totalExpenseRecords > visibleExpenseCount) {
    renderLoadMoreIn(els.intlTravelExpenseTable, totalExpenseRecords - visibleExpenseCount, () => {
      intlTravelExpensesAllExpanded = true;
      renderIntlTravelDetail(trip);
    });
  } else {
    removeLoadMoreIn(els.intlTravelExpenseTable);
  }
}

function openIntlTravelConversionForm(conversionId = "") {
  const trip = state.intlTravelTrips.find((item) => item.id === intlTravelDetailTripId);
  if (!trip || !els.intlTravelConversionForm) return;

  intlTravelEditingConversionId = conversionId || "";
  els.intlTravelConversionForm.reset();
  if (els.intlTravelConversionCurrency) els.intlTravelConversionCurrency.value = "";

  const conversion = conversionId
    ? (trip.conversions || []).find((item) => item.id === conversionId)
    : null;
  if (conversion) {
    els.intlTravelConversionDate.value = conversion.date || "";
    els.intlTravelConversionCurrency.value = conversion.currency || "INR";
    els.intlTravelConversionLocalAmount.value = conversion.localAmount ?? "";
    els.intlTravelConversionInrAmount.value = conversion.inrAmount ?? "";
    els.intlTravelConversionNotes.value = conversion.notes || "";
  }
  if (els.intlTravelConversionFormTitle) {
    els.intlTravelConversionFormTitle.textContent = conversion ? "Edit converted currency" : "Enter converted currency";
  }
  if (els.saveIntlTravelConversionBtn) {
    els.saveIntlTravelConversionBtn.textContent = conversion ? "Save changes" : "Save conversion";
  }
  els.intlTravelConversionForm.style.display = "block";
  if (els.intlTravelExpenseTable) els.intlTravelExpenseTable.style.display = "none";
  els.intlTravelConversionLocalAmount?.focus();
}

function closeIntlTravelConversionForm() {
  intlTravelEditingConversionId = "";
  if (els.intlTravelConversionForm) els.intlTravelConversionForm.style.display = "none";
  if (els.intlTravelExpenseTable) els.intlTravelExpenseTable.style.display = "grid";
}

async function saveIntlTravelConversionFromForm(event) {
  event.preventDefault();

  const editingConversionId = intlTravelEditingConversionId;
  const trip = state.intlTravelTrips.find((item) => item.id === intlTravelDetailTripId);
  if (!trip) return;

  const localAmount = toNumber(els.intlTravelConversionLocalAmount?.value);
  const inrAmount = toNumber(els.intlTravelConversionInrAmount?.value);
  if (!els.intlTravelConversionCurrency?.value) {
    showToast("Select a currency.");
    els.intlTravelConversionCurrency?.focus();
    return;
  }
  if (localAmount <= 0 || inrAmount <= 0) {
    showToast("Enter both the currency amount and converted INR amount.");
    return;
  }

  if (!Array.isArray(trip.conversions)) trip.conversions = [];
  const conversionData = {
    id: editingConversionId || createId(),
    date: els.intlTravelConversionDate?.value || "",
    currency: els.intlTravelConversionCurrency?.value || "INR",
    localAmount,
    inrAmount,
    notes: els.intlTravelConversionNotes?.value.trim() || "",
  };

  if (editingConversionId) {
    const conversionIndex = trip.conversions.findIndex((item) => item.id === editingConversionId);
    if (conversionIndex < 0) {
      showToast("The conversion could not be found.");
      return;
    }
    conversionData.createdAt = trip.conversions[conversionIndex].createdAt;
    trip.conversions[conversionIndex] = normalizeIntlTravelConversion(conversionData);
  } else {
    conversionData.createdAt = new Date().toISOString();
    trip.conversions.push(normalizeIntlTravelConversion(conversionData));
  }

  intlTravelEditingConversionId = "";
  await saveState();
  render();
  showToast(editingConversionId ? "Currency conversion updated." : "Currency conversion saved.");
}

async function handleIntlTravelConversionAction(event) {
  const button = event.target.closest?.("[data-intl-travel-conversion-action]");
  if (!button || !intlTravelDetailTripId) return;

  const trip = state.intlTravelTrips.find((item) => item.id === intlTravelDetailTripId);
  const conversion = trip?.conversions?.find((item) => item.id === button.dataset.conversionId);
  if (!trip || !conversion) return;

  if (button.dataset.intlTravelConversionAction === "edit") {
    openIntlTravelConversionForm(conversion.id);
    scrollToPageTop();
    return;
  }

  if (button.dataset.intlTravelConversionAction !== "delete") return;
  if (!window.confirm(`Delete ${conversion.currency} conversion?`)) return;

  trip.conversions = trip.conversions.filter((item) => item.id !== conversion.id);
  await saveState();
  render();
  showToast("Currency conversion deleted.");
}

function openIntlTravelExpenseForm(tripId = "", expenseId = "") {
  intlTravelDetailTripId = "";
  intlTravelEditorReturnTripId = tripId || "";
  intlTravelEditingExpenseId = expenseId || "";
  intlTravelFormOpen = true;
  resetIntlTravelExpenseForm();

  const trip = tripId ? state.intlTravelTrips.find((item) => item.id === tripId) : null;
  const expense = trip && expenseId ? trip.expenses.find((item) => item.id === expenseId) : null;
  if (trip) {
    els.intlTravelDestination.value = trip.destination;
    els.intlTravelDestination.readOnly = true;
  } else {
    els.intlTravelDestination.readOnly = false;
  }

  if (expense) {
    els.intlTravelExpenseDate.value = expense.date || "";
    els.intlTravelCategory.value = expense.category || "Other";
    els.intlTravelDescription.value = expense.description || "";
    els.intlTravelCurrency.value = expense.currency || "INR";
    els.intlTravelLocalAmount.value = expense.localAmount ?? "";
    els.intlTravelInrAmount.value = expense.inrAmount ?? "";
    els.intlTravelPaymentMethod.value = expense.paymentMethod || "Cash";
    els.intlTravelPaymentSource.value = expense.paymentSource || "";
    syncIntlTravelPaymentSourceCardSelect(expense.paymentSource || "");
    els.intlTravelExpenseType.value = expense.expenseType || "Personal";
    els.intlTravelPhase.value = expense.phase || "On-trip";
    els.intlTravelRefundMethod.value = expense.refundMethod || "";
    els.intlTravelMarkupFee.value = expense.markupFee || "";
    els.intlTravelNotes.value = expense.notes || "";
  }
  updateIntlTravelRefundMethodVisibility();

  if (els.intlTravelExpenseFormTitle) {
    els.intlTravelExpenseFormTitle.textContent = expense ? "Edit Trip Expense" : "Add new Trip Expense";
  }
  if (els.saveIntlTravelExpenseBtn) {
    els.saveIntlTravelExpenseBtn.textContent = expense ? "Save changes" : "Save expense";
  }

  els.intlTravelHomeView.style.display = "none";
  els.intlTravelDetailView.style.display = "none";
  els.intlTravelExpenseForm.style.display = "block";
  els.intlTravelDestination.focus();
}

function closeIntlTravelExpenseForm() {
  const returnTripId = intlTravelEditorReturnTripId;
  if (returnTripId) showIntlTravelDetail(returnTripId);
  else showIntlTravelHome();
}

function resetIntlTravelExpenseForm() {
  if (!els.intlTravelExpenseForm) return;
  const returnTripId = intlTravelEditorReturnTripId;
  els.intlTravelExpenseForm.reset();
  els.intlTravelDestination.readOnly = false;
  if (els.intlTravelCurrency) els.intlTravelCurrency.value = "";
  if (els.intlTravelPaymentMethod) els.intlTravelPaymentMethod.value = "";
  if (els.intlTravelPaymentSourceCardSelect) els.intlTravelPaymentSourceCardSelect.value = "";
  if (els.intlTravelExpenseType) els.intlTravelExpenseType.value = "";
  if (els.intlTravelPhase) els.intlTravelPhase.value = "";
  if (els.intlTravelRefundMethod) els.intlTravelRefundMethod.value = "";
  updateIntlTravelRefundMethodVisibility();
  if (returnTripId) {
    const trip = state.intlTravelTrips.find((item) => item.id === returnTripId);
    if (trip) {
      els.intlTravelDestination.value = trip.destination;
      els.intlTravelDestination.readOnly = true;
    }
  }
}

function syncIntlTravelPaymentSourceCardSelect(paymentSource = "") {
  if (!els.intlTravelPaymentSourceCardSelect) return;
  const normalizedSource = String(paymentSource).trim().toLowerCase();
  const matchingCard = state.cards.find((card) => {
    const cardName = formatCardName(card).trim().toLowerCase();
    return card.id === paymentSource || (normalizedSource && cardName === normalizedSource);
  });
  els.intlTravelPaymentSourceCardSelect.value = matchingCard ? matchingCard.id : "";
}

function updateIntlTravelRefundMethodVisibility() {
  const isRefund = els.intlTravelPhase?.value === "Refund / Adjustment";
  if (els.intlTravelRefundMethodField) {
    els.intlTravelRefundMethodField.style.display = isRefund ? "grid" : "none";
  }
  if (els.intlTravelRefundMethod) {
    els.intlTravelRefundMethod.required = isRefund;
    if (!isRefund) els.intlTravelRefundMethod.value = "";
  }
}

async function saveIntlTravelExpenseFromForm(event) {
  event.preventDefault();

  const editingExpenseId = intlTravelEditingExpenseId;

  const destination = els.intlTravelDestination.value.trim();
  const description = els.intlTravelDescription.value.trim();
  const localAmount = toNumber(els.intlTravelLocalAmount.value);
  const inrAmount = toNumber(els.intlTravelInrAmount.value);

  if (!els.intlTravelCategory.value || !els.intlTravelCurrency.value || !els.intlTravelPaymentMethod.value || !els.intlTravelExpenseType.value || !els.intlTravelPhase.value) {
    showToast("Select all required expense dropdowns.");
    return;
  }

  if (!destination) {
    showToast("Name of destination is required.");
    els.intlTravelDestination.focus();
    return;
  }
  if (els.intlTravelPhase.value === "Refund / Adjustment" && !els.intlTravelRefundMethod.value) {
    showToast("Select how the refund was received.");
    els.intlTravelRefundMethod.focus();
    return;
  }
  if (!description) {
    showToast("Merchant or description is required.");
    els.intlTravelDescription.focus();
    return;
  }
  if (localAmount <= 0 || inrAmount <= 0) {
    showToast("Enter both local and INR amounts.");
    return;
  }

  let trip = intlTravelEditorReturnTripId
    ? state.intlTravelTrips.find((item) => item.id === intlTravelEditorReturnTripId)
    : state.intlTravelTrips.find((item) => item.destination.toLowerCase() === destination.toLowerCase());

  if (!trip) {
    if (editingExpenseId) {
      showToast("The expense could not be found.");
      return;
    }
    trip = normalizeIntlTravelTrip({ id: createId(), destination, expenses: [] });
    state.intlTravelTrips.push(trip);
  }

  const expenseData = {
    id: editingExpenseId || createId(),
    date: els.intlTravelExpenseDate.value || "",
    category: els.intlTravelCategory.value,
    description,
    currency: els.intlTravelCurrency.value,
    localAmount,
    inrAmount,
    paymentMethod: els.intlTravelPaymentMethod.value,
    paymentSource: els.intlTravelPaymentSource.value.trim(),
    expenseType: els.intlTravelExpenseType.value,
    phase: els.intlTravelPhase.value,
    refundMethod: els.intlTravelPhase.value === "Refund / Adjustment" ? els.intlTravelRefundMethod.value : "",
    markupFee: els.intlTravelMarkupFee.value,
    notes: els.intlTravelNotes.value.trim(),
  };

  if (editingExpenseId) {
    const expenseIndex = trip.expenses.findIndex((item) => item.id === editingExpenseId);
    if (expenseIndex < 0) {
      showToast("The expense could not be found.");
      return;
    }
    const existingExpense = trip.expenses[expenseIndex];
    expenseData.createdAt = existingExpense.createdAt;
    if (existingExpense.date === expenseData.date) {
      expenseData.manualBeforeId = existingExpense.manualBeforeId || "";
      expenseData.manualAfterId = existingExpense.manualAfterId || "";
      expenseData.manualOrder = existingExpense.manualOrder ?? null;
    } else {
      expenseData.manualBeforeId = "";
      expenseData.manualAfterId = "";
      expenseData.manualOrder = null;
    }
    expenseData.displayOrder = null;
    trip.expenses[expenseIndex] = normalizeIntlTravelExpense(expenseData);
  } else {
    expenseData.createdAt = new Date().toISOString();
    trip.expenses.push(normalizeIntlTravelExpense(expenseData));
  }

  const returnTripId = intlTravelEditorReturnTripId;
  intlTravelEditorReturnTripId = "";
  intlTravelEditingExpenseId = "";
  intlTravelFormOpen = false;
  intlTravelDetailTripId = returnTripId || "";
  await saveState();
  render();
  showToast(editingExpenseId ? "Trip expense updated." : "Trip expense saved.");
}

async function handleIntlTravelExpenseAction(event) {
  const button = event.target.closest?.("[data-intl-travel-action]");
  if (!button || !intlTravelDetailTripId) return;

  const trip = state.intlTravelTrips.find((item) => item.id === intlTravelDetailTripId);
  if (!trip) return;
  const expense = trip.expenses.find((item) => item.id === button.dataset.expenseId);
  if (!expense) return;

  if (button.dataset.intlTravelAction === "edit-expense") {
    openIntlTravelExpenseForm(trip.id, expense.id);
    scrollToPageTop();
    return;
  }

  if (button.dataset.intlTravelAction !== "delete-expense") return;
  if (!window.confirm(`Delete ${expense.description || "this expense"}?`)) return;

  trip.expenses = trip.expenses.filter((item) => item.id !== expense.id);
  await saveState();
  render();
  showToast("Trip expense deleted.");
}

function renderCardDropdowns() {
  renderCardSelect(els.swipeCardSelect);
  renderCardSelect(els.rpCardSelect);
  renderCardSelect(els.spentCardSelect);
  renderCardSelect(els.loungeCardSelect);
  renderCardSelect(els.loungeLimitCardSelect);
  renderCardSelect(els.intlTravelPaymentSourceCardSelect);
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
      updateRpPointsReceivedFieldState();
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
    populatePartnerProgramReceivedPoints();
    updateRpPointsReceivedFieldState();
    updatePartnerTransferDetailsButton();
    refreshAllFieldStates();
    return;
  }

  if (select.value === "Neucoins") {
    const selectedSourceCardId = await showNeucoinsSourceCardPrompt({
      selectedCardId: select.dataset.neucoinsSourceCardId || "",
    });

    if (!selectedSourceCardId) {
      select.value = "";
      delete select.dataset.neucoinsSourceCardId;
      refreshAllFieldStates();
      return;
    }

    select.dataset.neucoinsSourceCardId = selectedSourceCardId;
    updateRpPointsReceivedFieldState();
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
  delete select.dataset.neucoinsSourceCardId;

  updateRpPointsReceivedFieldState();
  updatePartnerTransferDetailsButton();
  refreshAllFieldStates();
}

function showNeucoinsSourceCardPrompt({ selectedCardId = "" } = {}) {
  const neuCards = getNeucoinsSourceCards();
  if (!neuCards.length) {
    showToast("Add Tata Neu Infinity or Tata Neu Plus before redeeming Neucoins.");
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    aiModalResolver = resolve;
    const promptId = "neucoinsSourceCardPrompt";
    const errorId = "neucoinsSourceCardPromptError";
    const defaultCardId = neuCards.some((card) => card.id === selectedCardId)
      ? selectedCardId
      : neuCards[0].id;

    openAiModal({
      mode: "customPrompt",
      title: "Redeem Tata Neucoins",
      subtitle: "Choose the Tata Neu card whose unredeemed balance should be used.",
      bodyHtml: `
        <div class="ai-prompt-shell" style="gap:16px;">
          <div>
            <p class="ai-prompt-title">Neucoins source card</p>
            <p class="ai-prompt-copy">The entered Neucoins will be validated against and deducted from the selected card's Unredeemed Points.</p>
          </div>
          <div role="radiogroup" aria-label="Tata Neu card" style="display:grid; gap:10px;">
            ${neuCards.map((card) => `
              <label style="display:flex; align-items:center; gap:10px; padding:12px; border:1px solid rgba(148,163,184,0.24); border-radius:10px; cursor:pointer;">
                <input type="radio" name="${promptId}" value="${escapeAttribute(card.id)}"${card.id === defaultCardId ? " checked" : ""} />
                <span>${escapeHtml(formatCardName(card))} <small style="color:#94a3b8;">(${escapeHtml(formatPoints(getCardUnredeemedPoints(card)))} unredeemed)</small></span>
              </label>
            `).join("")}
          </div>
          <div id="${errorId}" class="ai-result-meta" style="display:none; color:#fca5a5;"></div>
        </div>
      `,
      footerHtml: `
        <button type="button" id="neucoinsSourceCardPromptCancelBtn" class="ghost-button">Cancel</button>
        <button type="button" id="neucoinsSourceCardPromptConfirmBtn" class="primary-button">Use this card</button>
      `,
    });

    const cancelBtn = document.getElementById("neucoinsSourceCardPromptCancelBtn");
    const confirmBtn = document.getElementById("neucoinsSourceCardPromptConfirmBtn");
    const errorEl = document.getElementById(errorId);

    cancelBtn?.addEventListener("click", () => resolveAiModal(null));
    confirmBtn?.addEventListener("click", () => {
      const selected = document.querySelector(`input[name="${promptId}"]:checked`);
      const sourceCardId = String(selected?.value || "").trim();
      if (!getNeucoinsSourceCards().some((card) => card.id === sourceCardId)) {
        if (errorEl) {
          errorEl.textContent = "Select Tata Neu Infinity or Tata Neu Plus.";
          errorEl.style.display = "block";
        }
        return;
      }
      resolveAiModal(sourceCardId);
    });
  });
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

function updatePartnerProgramOriginInfo(selectEl, infoEl) {
  if (!selectEl || !infoEl) return;

  const card = getCardById(selectEl.value);
  if (!card) {
    infoEl.style.display = "none";
    infoEl.innerHTML = "";
    return;
  }

  // Keep this as the card's current balance for the duration of the popup.
  // In-dialog redemptions are still tracked separately for validation, but
  // should not make this baseline value change immediately.
  const unredeemedPoints = getCardUnredeemedPoints(card);
  infoEl.style.display = "grid";
  infoEl.innerHTML = `
    <div style="font-size:0.78rem; font-weight:800; text-transform:uppercase; color:#94a3b8;">Current Unredeemed Points</div>
    <strong style="font-size:1.4rem; color:#f8fafc;">${escapeHtml(formatPoints(unredeemedPoints))}</strong>
    <p style="margin:0; color:#94a3b8; font-size:0.88rem; line-height:1.45;">
      You are about to redeem points from this card.
      If these points have been transferred to a partner program, save the RP spend to update the card's Unredeemed Points.
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

function isPartnerProgramFormEntry() {
  return els.rpCardSelect?.value === partnerProgramPlatformValue
    || Boolean(els.rpPurchasedFrom?.dataset.partnerProgramAuto === "true");
}

function updateRpPointsReceivedFieldState() {
  const input = els.rpPointsReceived;
  if (!input) return;

  const isPartnerProgram = isPartnerProgramFormEntry();
  input.readOnly = isPartnerProgram;
  input.title = isPartnerProgram
    ? "Calculated from the source-card points and partner transfer ratio."
    : "Optional for normal RP spends.";
}

function populatePartnerProgramReceivedPoints() {
  if (els.rpCardSelect?.value !== partnerProgramPlatformValue || !els.rpPointsReceived) return;

  const transferPoints = toNumber(els.rpPoints?.value);
  const ratio = parsePartnerTransferRatio(els.rpPartnerTransferRatio?.value || "");
  if (transferPoints <= 0 || !ratio) {
    els.rpPointsReceived.value = "";
    refreshFieldState(els.rpPointsReceived);
    return;
  }

  const earnedPoints = computePartnerTransferPoints(transferPoints, ratio);
  if (earnedPoints <= 0) {
    els.rpPointsReceived.value = "";
    refreshFieldState(els.rpPointsReceived);
    return;
  }

  els.rpPointsReceived.value = String(earnedPoints);
  refreshFieldState(els.rpPointsReceived);
}

function showPartnerProgramTransferPrompt(initial = {}) {
  return new Promise((resolve) => {
    aiModalResolver = resolve;
    const partnerNameId = "partnerProgramPromptPartnerName";
    const existingPartnerId = "partnerProgramPromptExistingPartner";
    const originatingCardId = "partnerProgramPromptOriginatingCard";
    const ratioId = "partnerProgramPromptRatio";
    const infoId = "partnerProgramPromptInfo";
    const errorId = "partnerProgramPromptError";
    const existingPartnerNames = getPprExistingPartnerNames();
    const initialPartnerName = String(initial.partnerName || "").trim();
    const matchedExistingPartner = existingPartnerNames.find(
      (partnerName) => normalizePprPartnerName(partnerName) === normalizePprPartnerName(initialPartnerName)
    ) || "";
    const initialNewPartnerName = matchedExistingPartner ? "" : initialPartnerName;
    const partnerOptions = existingPartnerNames
      .map((partnerName) => (
        `<option value="${escapeAttribute(partnerName)}"${partnerName === matchedExistingPartner ? " selected" : ""}>${escapeHtml(partnerName)}</option>`
      ))
      .join("");

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
          <div class="partner-name-picker-grid">
            <label class="field">
              <span>Existing partner</span>
              <select id="${existingPartnerId}">
                <option value=""${matchedExistingPartner ? "" : " selected"}>Select</option>
                ${partnerOptions}
              </select>
            </label>
            <label class="field">
              <span>New partner name</span>
              <input id="${partnerNameId}" type="text" placeholder="e.g. Marriott, Emirates" value="${escapeAttribute(initialNewPartnerName)}" autocomplete="off"${matchedExistingPartner ? " disabled" : ""} />
            </label>
          </div>
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
        <button type="button" id="partnerProgramPromptRemoveBtn" class="ghost-button">Remove points</button>
        <button type="button" id="partnerProgramPromptRedeemBtn" class="ghost-button">Redeem</button>
        <button type="button" id="partnerProgramPromptConfirmBtn" class="primary-button">Continue</button>
      `,
    });

    const partnerNameInput = document.getElementById(partnerNameId);
    const existingPartnerSelect = document.getElementById(existingPartnerId);
    const ratioInput = document.getElementById(ratioId);
    const originatingCardSelect = document.getElementById(originatingCardId);
    const infoEl = document.getElementById(infoId);
    const errorEl = document.getElementById(errorId);
    const cancelBtn = document.getElementById("partnerProgramPromptCancelBtn");
    const removeBtn = document.getElementById("partnerProgramPromptRemoveBtn");
    const redeemBtn = document.getElementById("partnerProgramPromptRedeemBtn");
    const confirmBtn = document.getElementById("partnerProgramPromptConfirmBtn");

    // Redemptions are held in the form until Update RP Spend is clicked.
    const pendingRedemptionsByCard = {};
    const getSelectedPartnerName = () => (
      String(existingPartnerSelect?.value || "").trim()
      || String(partnerNameInput?.value || "").trim()
    );
    const syncPartnerNameFields = () => {
      if (!partnerNameInput) return;
      const hasExistingPartner = Boolean(String(existingPartnerSelect?.value || "").trim());
      partnerNameInput.disabled = hasExistingPartner;
      partnerNameInput.setAttribute("aria-disabled", hasExistingPartner ? "true" : "false");
      if (!hasExistingPartner) partnerNameInput.focus();
    };
    const refreshInfo = () => {
      updatePartnerProgramOriginInfo(originatingCardSelect, infoEl);
    };

    existingPartnerSelect?.addEventListener("change", syncPartnerNameFields);

    cancelBtn?.addEventListener("click", () => resolveAiModal(null));
    removeBtn?.addEventListener("click", async () => {
      const currentPoints = toNumber(els.rpPoints?.value);
      if (currentPoints <= 0) {
        showToast("There are no partner points to remove.");
        return;
      }

      const sourceCard = getCardById(String(originatingCardSelect?.value || "").trim())
        || { issuer: "Partner program", name: getSelectedPartnerName() || "redemption" };
      const removePoints = await showRedeemPointsPrompt({
        card: sourceCard,
        availablePoints: currentPoints,
        mode: "remove",
      });

      if (removePoints == null) return;

      const updatedTotalPoints = Math.max(0, currentPoints - removePoints);
      const currentRedeemedPoints = toNumber(els.rpRedeemedPoints?.value);
      if (els.rpPoints) els.rpPoints.value = String(updatedTotalPoints);
      if (els.rpRedeemedPoints) {
        els.rpRedeemedPoints.value = String(Math.max(0, currentRedeemedPoints - removePoints));
      }

      // Keep an intentionally blank received-points field blank. When a value
      // exists, adjust it by the same transfer ratio as the removed points.
      const currentReceivedText = String(els.rpPointsReceived?.value || "").trim();
      const partnerRatio = parsePartnerTransferRatio(ratioInput?.value || els.rpPartnerTransferRatio?.value || "");
      if (els.rpPointsReceived && currentReceivedText && partnerRatio) {
        const updatedReceived = Math.max(
          0,
          toNumber(currentReceivedText) - computePartnerTransferPoints(removePoints, partnerRatio)
        );
        els.rpPointsReceived.value = updatedReceived > 0 ? String(updatedReceived) : "";
      }

      pendingRedemptionsByCard[String(originatingCardSelect?.value || "").trim()] = Math.max(
        0,
        toNumber(pendingRedemptionsByCard[String(originatingCardSelect?.value || "").trim()]) - removePoints
      );
      showToast(`Removed ${formatPoints(removePoints)} from this partner redemption.`);
    });
    redeemBtn?.addEventListener("click", async () => {
      const sourceCardId = String(originatingCardSelect?.value || "").trim();
      const sourceCard = getCardById(sourceCardId);

      if (!sourceCard) {
        showToast("Select an originating card first.");
        originatingCardSelect?.focus();
        return;
      }

      const alreadyPendingPoints = toNumber(pendingRedemptionsByCard[sourceCardId]);
      const editingId = String(els.editingRpSpendId?.value || "").trim();
      const editingRow = editingId ? state.rpSpends.find((item) => item.id === editingId) : null;
      const priorEditingRedemption = editingRow
        && getRpSpendRedeemedSourceCardId(editingRow) === sourceCardId
        ? getRpSpendRedemptionAmount(editingRow)
        : 0;
      // When editing an existing RP spend, add that row's old redemption back
      // before validating the replacement amount. Other saved redemptions and
      // redemptions already entered in this popup remain part of the limit.
      const availablePoints = Math.max(
        0,
        getCardUnredeemedPoints(sourceCard)
        + priorEditingRedemption
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

      showToast(`Redeemed ${formatPoints(redeemPoints)} from ${formatCardShortName(sourceCard)}. Remaining: ${formatPoints(availablePoints - redeemPoints)}.`);
    });
    confirmBtn?.addEventListener("click", () => {
      const partnerName = getSelectedPartnerName();
      const ratio = String(ratioInput?.value || "").trim();

      if (errorEl) errorEl.style.display = "none";

      if (!partnerName) {
        if (errorEl) {
          errorEl.textContent = "Partner name is required.";
          errorEl.style.display = "block";
        }
        if (existingPartnerSelect?.value) {
          existingPartnerSelect.focus();
        } else {
          partnerNameInput?.focus();
        }
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
    if (matchedExistingPartner) {
      ratioInput?.focus();
    } else {
      partnerNameInput?.focus();
    }
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
  const resolvedCard = typeof card === "string" ? getCardById(cardId) : card;
  if (resolvedCard) return getCardPointAllocation(resolvedCard).totalUnredeemedPoints;

  const sourceRecord = getUnredeemedPointsSourceRecord(cardId);
  return sourceRecord ? getUnredeemedSourceBalance(sourceRecord) : 0;
}

function getRpSpendRedemptionAmount(rpSpend) {
  if (!rpSpend || isUnredeemedPointsRecord(rpSpend)) return 0;

  if (isPartnerProgramRpSpend(rpSpend)) {
    // redeemedPoints is the source-card amount explicitly consumed in RP
    // Spends to create/credit the partner balance. partnerRedeemedPoints is
    // the partner balance subsequently consumed in PPR. They represent the
    // same underlying card points, so use the larger source-card equivalent
    // instead of ignoring the RP Spends debit or counting both twice.
    const sourcePoints = getPartnerProgramSourcePoints(rpSpend);
    const rpSpendCardDebit = Math.min(sourcePoints, toNumber(rpSpend.redeemedPoints));
    const partnerRedeemedPoints = toNumber(rpSpend.partnerRedeemedPoints);
    const pprCardDebit = partnerRedeemedPoints > 0
      ? getPartnerProgramCardDebitPoints(rpSpend, partnerRedeemedPoints)
      : 0;
    const recordedCardDebit = Math.max(rpSpendCardDebit, pprCardDebit);
    if (recordedCardDebit > 0) return recordedCardDebit;

    // Retain direct RP Spend redemptions created before the PPR allocation
    // fields existed. A positive recorded value means the complete transfer
    // was redeemed there; otherwise the transfer remains unredeemed until PPR
    // records a partial or full redemption.
    return toNumber(rpSpend.pointsValue) > 0
      ? getPartnerProgramSourcePoints(rpSpend)
      : 0;
  }

  const totalPoints = getRpSpendTotalPoints(rpSpend);
  if (totalPoints <= 0) return 0;

  // Point redemption is independent of monetary value. In particular, a
  // redemption with pointsValue === 0 must still consume points and be
  // allocated to Welcome Benefits Redeemed before normal points are used.
  const redeemedPoints = toNumber(rpSpend.redeemedPoints);
  if (redeemedPoints > 0) {
    return Math.min(totalPoints, redeemedPoints);
  }

  // An unchecked Add RP Spend row against a source with an Unredeemed Points
  // record is a product redemption. The same applies to legacy card rows
  // attached to a Welcome Benefit (Points) source.
  const sourceCardId = getRpSpendRedeemedSourceCardId(rpSpend);
  const sourceCard = getCardById(sourceCardId);
  const hasPointSource = Boolean(getUnredeemedPointsSourceRecord(sourceCardId))
    || Boolean(sourceCard?.benefits?.some((benefit) => benefit?.type === welcomeBenefitPointsType));
  if (hasPointSource) {
    return totalPoints;
  }

  return 0;
}

function restoreRpSpendRedemption(rpSpend) {
  // Point balances are now derived from the original welcome/normal point
  // sources plus the saved redemption ledger. Editing or deleting a row must
  // not mutate the source benefit itself.
  return getRpSpendRedemptionAmount(rpSpend);
}

function restoreCardPointRedemption(cardId, pointsToRestore) {
  const points = toNumber(pointsToRestore);
  if (!cardId || points <= 0) return;

  const cardIndex = state.cards.findIndex((card) => card.id === cardId);
  if (cardIndex < 0) return;

  const card = state.cards[cardIndex];
  const benefits = [...(card.benefits || [])];
  const benefitIndex = benefits.findIndex((benefit) =>
    benefit?.type === "Unredeemed Points"
    && isPointBenefit(benefit)
    && !isRpRedeemedAutoBenefit(benefit)
  );

  if (benefitIndex >= 0) {
    benefits[benefitIndex] = {
      ...benefits[benefitIndex],
      amount: toNumber(benefits[benefitIndex].amount) + points,
    };
  } else {
    benefits.push({
      id: `restored-rp-points-${createId()}`,
      type: "Unredeemed Points",
      valueType: "points",
      label: "Unredeemed Points",
      amount: points,
    });
  }

  state.cards[cardIndex] = { ...card, benefits };
}

function applyCardPointRedemption(cardId, redeemPoints) {
  const pointsToRedeem = toNumber(redeemPoints);
  if (pointsToRedeem <= 0) return { ok: false, error: "Enter a valid number of points." };

  const card = getCardById(cardId);
  const currentUnredeemed = getCardUnredeemedPoints(card || cardId);
  if (!card) return { ok: false, error: "Selected source has no Unredeemed Points record." };

  // The save handlers validate before inserting/replacing the RP row. At this
  // point the row is already in state, so validating again would count the new
  // redemption twice and reject valid saves.
  return { ok: true, currentUnredeemed: currentUnredeemed - pointsToRedeem };
}

let redeemPointsModalContext = null;

function showRedeemPointsPrompt({ card, availablePoints, mode = "redeem" }) {
  return new Promise((resolve) => {
    redeemPointsModalContext = {
      cardId: card?.id || "",
      availablePoints: toNumber(availablePoints),
      mode,
      resolve,
    };

    if (els.redeemPointsModalTitle) {
      els.redeemPointsModalTitle.textContent = mode === "remove" ? "Remove Points" : "Redeem Points";
    }
    if (els.redeemPointsModalCard) {
      const balanceLabel = mode === "remove" ? "Current points in this redemption" : "Current unredeemed";
      els.redeemPointsModalCard.textContent = `Card: ${formatCardShortName(card)} | ${balanceLabel}: ${formatPoints(availablePoints)}`;
    }
    if (els.redeemPointsInputLabel) {
      els.redeemPointsInputLabel.textContent = mode === "remove" ? "Points to Remove" : "Points to Redeem";
    }
    if (els.redeemPointsConfirmBtn) {
      els.redeemPointsConfirmBtn.textContent = mode === "remove" ? "Remove" : "Redeem";
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
      const actionLabel = redeemPointsModalContext.mode === "remove" ? "remove" : "redeem";
      els.redeemPointsError.textContent = `You can ${actionLabel} up to ${formatPoints(availablePoints)}.`;
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
  const categoryValue = els.swipeCategorySelect?.value || "";
  const typeValue = typeSelect?.value || "";
  const financialYearValue = fySelect?.value || "";

  if (!categoryValue) {
    showToast("Select a category first.");
    els.swipeCategorySelect?.focus();
    return;
  }

  if (!typeValue) {
    showToast("Select a swipe type first.");
    els.swipeTypeSelect?.focus();
    return;
  }

  if (!financialYearValue) {
    showToast("Select a financial year first.");
    els.swipeFySelect?.focus();
    return;
  }

  const category = normalizeSwipeCategory(categoryValue);
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
    type: typeValue === "E" ? "E" : "F",
    financialYear: normalizeFinancialYear(financialYearValue),
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
    els.swipeCategorySelect.value = "";
  }

  refreshSwipeSpentForRequirement();

  if (els.swipeTypeSelect) {
    els.swipeTypeSelect.value = "";
  }

  if (els.swipeFySelect) {
    els.swipeFySelect.value = "";
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

function resetPortfolioFilters(shouldRender = true) {
  state.search = "";
  state.statusFilter = "all";
  state.sort = "netAsc";

  if (els.searchInput) els.searchInput.value = "";
  if (els.statusFilter) els.statusFilter.value = "all";
  if (els.sortSelect) els.sortSelect.value = "netAsc";

  updateSortColor();
  if (shouldRender) renderCards();
}

function resetSwipeFilters(shouldRender = true) {
  if (els.swipeFyFilter) els.swipeFyFilter.value = "all";
  if (els.swipeCategoryFilter) els.swipeCategoryFilter.value = "all";
  if (els.swipeTypeFilter) els.swipeTypeFilter.value = "all";
  if (els.swipeCardFilter) els.swipeCardFilter.value = "all";
  state.swipeSearch = "";
  if (els.swipeSearchInput) els.swipeSearchInput.value = "";
  swipesAllExpanded = false;
  if (shouldRender) renderSwipes();
}

function resetRpSpendFilters(shouldRender = true) {
  state.rpSpendSearch = "";
  state.rpSpendUnredeemedOnly = false;
  if (els.rpSpendSearchInput) els.rpSpendSearchInput.value = "";
  if (els.rpSpendUnredeemedOnly) els.rpSpendUnredeemedOnly.value = "all";
  rpSpendsAllExpanded = false;
  if (shouldRender) renderRpSpends();
}

function handleRpSpendUnredeemedFilterChange() {
  state.rpSpendUnredeemedOnly = els.rpSpendUnredeemedOnly?.value === "unredeemed";
  rpSpendsAllExpanded = false;
  renderRpSpends();
}

function resetLoungeFilters(shouldRender = true) {
  if (els.loungeCardFilter) els.loungeCardFilter.value = "all";
  if (els.loungeTypeFilter) els.loungeTypeFilter.value = "all";
  if (shouldRender) renderLoungeVisits();
}

function getLoungeCardLimit(cardId) {
  return state.loungeCardLimits.find((limit) => limit.cardId === cardId) || null;
}

function openLoungeLimitForm(cardId = "", editExisting = false) {
  if (!els.loungeLimitEntryModal) return;

  resetLoungeLimitForm(false);
  if (cardId && els.loungeLimitCardSelect) {
    els.loungeLimitCardSelect.value = cardId;
  }
  if (editExisting) {
    const limit = getLoungeCardLimit(cardId);
    if (limit && els.editingLoungeLimitId) {
      els.editingLoungeLimitId.value = limit.id;
      populateLoungeLimitForm();
    }
  }
  els.loungeLimitEntryModal.style.display = "flex";
  window.setTimeout(() => els.loungeLimitCardSelect?.focus(), 0);
}

function populateLoungeLimitForm() {
  const cardId = els.loungeLimitCardSelect?.value || "";
  const editingId = els.editingLoungeLimitId?.value || "";
  const limit = editingId
    ? state.loungeCardLimits.find((item) => item.id === editingId && item.cardId === cardId)
    : null;

  if (els.loungeLimitCreditTotal) {
    els.loungeLimitCreditTotal.value = limit?.totalCreditCardVisits || "";
  }
  if (els.loungeLimitPriorityTotal) {
    els.loungeLimitPriorityTotal.value = limit?.totalPriorityPassDreamfolks || "";
  }

  const card = getCardById(cardId);
  if (els.loungeLimitEntryTitle) {
    els.loungeLimitEntryTitle.textContent = limit
      ? `Edit ${card?.name || formatCardName(card)} Lounge Limit`
      : "Add Card Lounge Limit";
  }
  if (els.saveLoungeLimitBtn) {
    els.saveLoungeLimitBtn.textContent = limit ? "Update Lounge Limit" : "Save Lounge Limit";
  }
}

function resetLoungeLimitForm(keepCard = false) {
  if (els.editingLoungeLimitId) els.editingLoungeLimitId.value = "";
  if (!keepCard && els.loungeLimitCardSelect) {
    els.loungeLimitCardSelect.selectedIndex = 0;
  }
  if (els.loungeLimitCreditTotal) els.loungeLimitCreditTotal.value = "";
  if (els.loungeLimitPriorityTotal) els.loungeLimitPriorityTotal.value = "";
  if (els.loungeLimitEntryTitle) els.loungeLimitEntryTitle.textContent = "Add Card Lounge Limit";
  if (els.saveLoungeLimitBtn) els.saveLoungeLimitBtn.textContent = "Save Lounge Limit";
}

function handleLoungeLimitCardChange() {
  if (els.editingLoungeLimitId?.value) {
    resetLoungeLimitForm(true);
  }
}

function closeLoungeLimitEntryModal() {
  if (els.loungeLimitEntryModal) els.loungeLimitEntryModal.style.display = "none";
}

function openLoungeLimitsPopup() {
  if (!els.loungeLimitsModal) return;
  renderLoungeLimitsTable();
  els.loungeLimitsModal.style.display = "flex";
  window.setTimeout(() => els.closeLoungeLimitsBtn?.focus(), 0);
}

function closeLoungeLimitsPopup() {
  if (els.loungeLimitsModal) els.loungeLimitsModal.style.display = "none";
}

async function saveLoungeLimitFromForm(event) {
  event.preventDefault();

  const cardId = els.loungeLimitCardSelect?.value || "";
  const values = {
    totalCreditCardVisits: els.loungeLimitCreditTotal?.value.trim() || "",
    totalPriorityPassDreamfolks: els.loungeLimitPriorityTotal?.value.trim() || "",
  };

  if (!cardId || !getCardById(cardId)) {
    showToast("Select a card first.");
    return;
  }

  const editingId = els.editingLoungeLimitId?.value || "";
  const isEdit = Boolean(editingId);

  if (!isEdit && !Object.values(values).some(Boolean)) {
    showToast("Enter at least one lounge-limit detail.");
    return;
  }

  const existingIndex = state.loungeCardLimits.findIndex((limit) => limit.cardId === cardId);
  const existing = existingIndex >= 0 ? state.loungeCardLimits[existingIndex] : null;
  const now = new Date().toISOString();

  if (isEdit && existingIndex >= 0 && existing?.id === editingId) {
    state.loungeCardLimits[existingIndex] = normalizeLoungeCardLimit({
      ...existing,
      ...values,
      id: editingId,
      cardId,
      createdAt: existing.createdAt || now,
      updatedAt: now,
    });
  } else {
    const record = normalizeLoungeCardLimit({
      ...existing,
      totalCreditCardVisits: appendLoungeLimitText(existing?.totalCreditCardVisits, values.totalCreditCardVisits),
      totalPriorityPassDreamfolks: appendLoungeLimitText(existing?.totalPriorityPassDreamfolks, values.totalPriorityPassDreamfolks),
      id: existing?.id || createId(),
      cardId,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    });

    if (existingIndex >= 0) {
      state.loungeCardLimits[existingIndex] = record;
    } else {
      state.loungeCardLimits.push(record);
    }
  }

  await saveState();
  render();
  if (isEdit) {
    closeLoungeLimitEntryModal();
    showToast("Card lounge limit updated.");
  } else {
    resetLoungeLimitForm(true);
    showToast("Lounge limit entry added. You can add another entry.");
  }
}

function appendLoungeLimitText(existingValue, newValue) {
  const existing = String(existingValue || "").trim();
  const next = String(newValue || "").trim();
  return [existing, next].filter(Boolean).join("\n");
}

function isLoungeBenefitVisit(visit) {
  return visit?.loungeType === "Domestic" || visit?.loungeType === "International";
}

function getLoungeUsageRecords(cardId, accessMethods) {
  const methodSet = new Set(accessMethods.filter(Boolean));
  return state.loungeVisits
    .filter((visit) => (
      visit.cardId === cardId
      && isLoungeBenefitVisit(visit)
      && methodSet.has(visit.accessMethod)
    ))
    .slice()
    .sort((a, b) => new Date(a.date || a.createdAt || 0) - new Date(b.date || b.createdAt || 0));
}

function formatLoungeUsageDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Date not entered";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatLoungeUsageType(loungeType) {
  return loungeType === "International" ? "International Lounge" : "Domestic Lounge";
}

function renderLoungeUsageCell(cardId, ...accessMethods) {
  const records = getLoungeUsageRecords(cardId, accessMethods);
  if (!records.length) {
    return `<span class="lounge-limit-empty">No usage entered</span>`;
  }

  return `
    <div class="lounge-usage-records">
      ${records.map((visit) => {
        const members = toNumber(visit.members) || 1;
        const location = visit.airport || "Location not entered";
        return `
          <div class="lounge-usage-record">
            <strong>${escapeHtml(formatLoungeUsageType(visit.loungeType))}</strong>
            <span>${escapeHtml(formatLoungeUsageDate(visit.date || visit.createdAt))}</span>
            <span>${escapeHtml(location)} | ${escapeHtml(String(members))} ${members === 1 ? "member" : "members"}</span>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderLoungeLimitsTable() {
  if (!els.loungeLimitsTable) return;

  const cards = state.cards
    .slice()
    .sort((a, b) => formatCardName(a).localeCompare(formatCardName(b)));

  if (!cards.length) {
    els.loungeLimitsTable.innerHTML = `
      <div class="empty-state">
        <h3>No cards in portfolio</h3>
        <p class="empty-copy">Add cards in the portfolio first, then enter their lounge limits here.</p>
      </div>
    `;
    return;
  }

  const renderEditableLimitCell = (cardId, value, field, label) => `
    <button
      type="button"
      class="lounge-limit-cell-edit"
      data-lounge-limit-edit="${escapeAttribute(cardId)}"
      data-lounge-limit-field="${escapeAttribute(field)}"
      title="Edit ${escapeAttribute(label)}"
      aria-label="Edit ${escapeAttribute(label)}"
    >
      ${value
        ? `<div class="lounge-limit-cell">${escapeHtml(value)}</div>`
        : `<span class="lounge-limit-empty">Not entered</span>`}
    </button>
  `;

  els.loungeLimitsTable.innerHTML = `
    <table class="lounge-limits-table">
      <thead>
        <tr>
          <th>Card</th>
          <th>Total Credit Card visit per year</th>
          <th>Credit Card usage</th>
          <th>Total Priority Pass / Dreamfolks</th>
          <th>Priority Pass / Dreamfolks usage</th>
        </tr>
      </thead>
      <tbody>
        ${cards.map((card) => {
          const limit = getLoungeCardLimit(card.id);
          const label = formatCardName(card);
          return `
            <tr>
              <td>
                <button type="button" class="lounge-limit-card-link" data-lounge-limit-edit="${escapeAttribute(card.id)}" title="Edit lounge limit">
                  ${escapeHtml(label)}
                </button>
              </td>
              <td>${renderEditableLimitCell(card.id, limit?.totalCreditCardVisits, "totalCreditCardVisits", "Total Credit Card visit per year")}</td>
              <td>${renderLoungeUsageCell(card.id, "Credit Card")}</td>
              <td>${renderEditableLimitCell(card.id, limit?.totalPriorityPassDreamfolks, "totalPriorityPassDreamfolks", "Total Priority Pass / Dreamfolks")}</td>
              <td>${renderLoungeUsageCell(card.id, "Priority Pass", "DreamFolks")}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function handleLoungeLimitTableAction(event) {
  const button = event.target.closest("[data-lounge-limit-edit]");
  if (!button) return;

  closeLoungeLimitsPopup();
  openLoungeLimitForm(button.dataset.loungeLimitEdit || "", true);

  const field = button.dataset.loungeLimitField || "";
  if (field === "totalCreditCardVisits" || field === "totalPriorityPassDreamfolks") {
    window.setTimeout(() => {
      const input = field === "totalCreditCardVisits"
        ? els.loungeLimitCreditTotal
        : els.loungeLimitPriorityTotal;
      input?.focus();
      if (typeof input?.setSelectionRange === "function") {
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }, 0);
  }
}

function handleSwipeAction(event) {
  const button = event.target.closest("[data-swipe-action]");
  if (!button) return;

  const swipe = state.swipes.find((s) => s.id === button.dataset.id);
  if (!swipe) return;

  if (button.dataset.swipeAction === "edit") {
    populateSwipeForm(swipe);
    scrollToPageTop();
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
  // Keep the column header that was appended above; replacing innerHTML here
  // removed it whenever at least one swipe existed.
  els.swipesTable.insertAdjacentHTML("beforeend", rowsToRender.map(renderSwipeRow).join(""));

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

  if (!isPartnerProgram && !productName) {
    showToast("Enter product name.");
    els.rpProductName?.focus();
    return;
  }

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
  const selectedPortfolioCard = !isPartnerProgram ? getCardById(selectedCardId) : null;
  const isNeucoinsRedemption = selectedCardId === "Neucoins";
  const neucoinsSourceCardId = isNeucoinsRedemption
    ? String(els.rpCardSelect?.dataset.neucoinsSourceCardId || existingSpend?.neucoinsSourceCardId || getNeuPortfolioCardId()).trim()
    : "";
  const neucoinsSourceCard = getCardById(neucoinsSourceCardId);
  // A portfolio card, or Neucoins linked to a Tata Neu card, can contribute
  // points to a product redemption. Other voucher/platform rows cannot.
  const isCardProductSpend = Boolean(selectedPortfolioCard);
  const keepPointsUnredeemed = Boolean(els.rpUnredeemedPoints?.checked);
  const existingIsUnredeemedRecord = isUnredeemedPointsRecord(existingSpend);
  const isUnredeemedRecord = Boolean(selectedCardId && !isPartnerProgram && keepPointsUnredeemed);
  const priorPartnerRedeemedPoints = isPartnerProgram && existingSpend
    ? toNumber(existingSpend.redeemedPoints)
    : 0;
  const currentPartnerRedeemedPoints = isPartnerProgram
    ? toNumber(els.rpRedeemedPoints?.value)
    : 0;
  const usedRedeemPopup = isPartnerProgram
    && currentPartnerRedeemedPoints > priorPartnerRedeemedPoints;
  const partnerRedeemedPointsForSpend = usedRedeemPopup
    ? currentPartnerRedeemedPoints
    : enteredPoints;

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

  const existingUnredeemedSource = isUnredeemedRecord
    ? getUnredeemedPointsSourceRecord(selectedCardId, existingSpend?.id || "")
    : null;

  // A card keeps one authoritative normal-points source row. When another
  // Unredeemed Points entry is added, treat the entered amount as a new points
  // credit and merge it into that source. Do not rebuild the source from all
  // historical redemptions: that would also add already-redeemed Welcome
  // Benefit points back into the normal balance.
  if (isUnredeemedRecord && existingUnredeemedSource && !existingSpend) {
    if (enteredPoints <= 0) {
      showToast("Enter the unredeemed points to add.");
      els.rpPoints?.focus();
      return;
    }

    existingUnredeemedSource.points = toNumber(existingUnredeemedSource.points) + enteredPoints;
    existingUnredeemedSource.unredeemedPointsRecord = true;
    existingUnredeemedSource.unredeemedBalanceInitialized = true;
    existingUnredeemedSource.redemptionModel = "split-v2";

    syncRpRedeemedBenefitsFromSpends();
    await saveState();
    render();
    resetRpSpendForm();
    showToast(`Added ${formatPoints(enteredPoints)} to the card's unredeemed points.`);
    return;
  }

  if (isNeucoinsRedemption && !neucoinsSourceCard) {
    showToast("Choose Tata Neu Infinity or Tata Neu Plus for this Neucoins redemption.");
    return;
  }

  const redeemedSourceCardId = isPartnerProgram
    ? originatingCardId
    : (isCardProductSpend || isNeucoinsRedemption) && !keepPointsUnredeemed
      ? (isNeucoinsRedemption ? neucoinsSourceCardId : selectedCardId)
      : "";

  const redeemedPointsForSpend = isPartnerProgram
    ? partnerRedeemedPointsForSpend
    : (isCardProductSpend || isNeucoinsRedemption) && !keepPointsUnredeemed
    ? enteredPoints
    : isUnredeemedRecord
      ? 0
      // Voucher, Neucoins, and other platform rows record points redeemed
      // without being sourced from or deducted from a portfolio card.
      : enteredPoints;
  const currentNormalBalanceBeforeEdit = isUnredeemedRecord && existingIsUnredeemedRecord
    ? selectedPortfolioCard
      ? getCardPointAllocation(selectedPortfolioCard).normalRemainingPoints
      : getRpSpendRemainingPoints(existingSpend)
    : 0;
  const storedPoints = isUnredeemedRecord
    ? existingIsUnredeemedRecord
      // The editor shows the current normal-points balance. Adjust the saved
      // source only by the difference, preserving prior normal-point credits
      // without folding Welcome Benefit redemptions into this source.
      ? Math.max(
        0,
        toNumber(existingSpend.points) + enteredPoints - currentNormalBalanceBeforeEdit
      )
      : enteredPoints
    : els.rpPoints?.value;
  const priorSavedRedeemedPoints = toNumber(existingSpend?.redeemedPoints);
  const redemptionPointsChanged = redeemedPointsForSpend !== priorSavedRedeemedPoints;
  const redeemedAt = redeemedPointsForSpend > 0
    ? redemptionPointsChanged
      ? new Date().toISOString()
      : existingSpend?.redeemedAt || existingSpend?.createdAt || new Date().toISOString()
    : "";

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
    neucoinsSourceCardId,
    partnerTransferRatio: isPartnerProgram ? partnerTransferRatio : "",
    partnerRedeemedPoints: isPartnerProgram
      ? toNumber(existingSpend?.partnerRedeemedPoints)
      : 0,
    pprRedemptions: isPartnerProgram && Array.isArray(existingSpend?.pprRedemptions)
      ? existingSpend.pprRedemptions
      : [],
    productName,
    productValue: els.rpProductValue?.value,
    pointsReceived: els.rpPointsReceived?.value,
    redeemedAt,
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

  const isClearedExistingPartnerSpend = Boolean(
    existingSpend
    && isPartnerProgram
    && enteredPoints === 0
  );
  if (!hasAnyValue && !(isUnredeemedRecord && enteredPoints === 0) && !isClearedExistingPartnerSpend) {
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

  // Partner Program redemptions are validated inside the Partner Details
  // popup. The save handler must not apply the product-purchase balance check
  // to them; product rows continue to use this validation here.
  if (!isPartnerProgram && redemptionAmount > 0) {
    if (!redemptionSourceCard) {
      showToast("Select a valid originating card for this redemption.");
      return;
    }

    const currentUnredeemed = getCardUnredeemedPoints(redemptionSourceCard);
    const additionalPointsRequired = Math.max(0, redemptionAmount - priorRedemptionAmount);
    if (additionalPointsRequired > currentUnredeemed) {
      showToast(`Only ${formatPoints(currentUnredeemed)} more can be redeemed from ${formatCardShortName(redemptionSourceCard)}.`);
      els.rpPoints?.focus();
      return;
    }
  }

  if (existingIndex >= 0) {
    // Restore the old redemption before applying the edited row's new amount.
    restoreRpSpendRedemption(existingSpend);

    // Update the edited row
    state.rpSpends[existingIndex] = rpSpend;

    if (!isPartnerProgram) {
      // Product purchases may have multiple payment rows for one purchase.
      const purchaseId = state.rpSpends[existingIndex].purchaseId || state.rpSpends[existingIndex].id;
      const priorRep = state.rpSpends.find((row) => (row.purchaseId || row.id) === purchaseId && toNumber(row.pointsReceived) > 0);
      const priorPoints = priorRep ? toNumber(priorRep.pointsReceived) : 0;
      const newPoints = toNumber(rpSpend.pointsReceived);
      const shouldSyncPoints = newPoints !== priorPoints;
      syncRpProductFieldsForPurchase(rpSpend, shouldSyncPoints);
    }
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

  syncRpRedeemedBenefitsFromSpends();
  await saveState();
  render();

  if (editingId) {
    resetRpSpendForm();
    showToast("RP spend updated.");
    return;
  }

  if (isPartnerProgram) {
    resetRpSpendForm();
    showToast("Partner program RP spend saved.");
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
  updateRpPointsReceivedFieldState();
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
  delete els.rpCardSelect?.dataset.neucoinsSourceCardId;
  if (els.rpOriginatingCardId) els.rpOriginatingCardId.value = "";
  updateRpPointsReceivedFieldState();
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
      updated.pointsReceivedProvided = sourceRow.pointsReceivedProvided === true;
    }

    return updated;
  });
}

function handleRpSpendAction(event) {
  const manualButton = event.target.closest("[data-ppr-manual-action]");
  if (manualButton) {
    const entry = getPprManualPointEntries().find((item) => item.id === manualButton.dataset.id);
    if (!entry) return;

    if (manualButton.dataset.pprManualAction === "edit") {
      openPprManualPointsModal(entry.partnerName, entry);
      return;
    }

    if (manualButton.dataset.pprManualAction === "delete") {
      if (!window.confirm(`Delete manual partner points for ${entry.partnerName}?`)) return;
      state.pprManualPoints = (state.pprManualPoints || []).filter((item) => item.id !== entry.id);
      saveState();
      render();
      showToast("Manual partner points deleted.");
      return;
    }
  }

  const button = event.target.closest("[data-rp-spend-action]");
  if (!button) return;

  const action = button.dataset.rpSpendAction;

  // Item-level actions (edit/delete) use data-id
  if (action === "edit" || action === "delete") {
    const rpSpend = state.rpSpends.find((item) => item.id === button.dataset.id);
    if (!rpSpend) return;

    if (action === "edit") {
      populateRpSpendForm(rpSpend);
      scrollToPageTop();
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
  document.body.classList.add("rp-entry-open");
  if (els.editingRpSpendId) els.editingRpSpendId.value = rpSpend.id || "";
  if (els.rpCardSelect) {
    els.rpCardSelect.value = rpSpend.cardId || "";
    if (rpSpend.cardId === "Neucoins") {
      els.rpCardSelect.dataset.neucoinsSourceCardId = rpSpend.neucoinsSourceCardId || getNeuPortfolioCardId();
    } else {
      delete els.rpCardSelect.dataset.neucoinsSourceCardId;
    }
  }
  if (els.rpPoints) {
    if (isUnredeemedPointsRecord(rpSpend)) {
      const sourceCard = getCardById(rpSpend.cardId);
      // Edit the balance users actually see in the card allocation. The raw
      // source row cannot be used here because it subtracts every historical
      // redemption, including redemptions allocated to Welcome Benefits.
      const currentNormalBalance = sourceCard
        ? getCardPointAllocation(sourceCard).normalRemainingPoints
        : getRpSpendRemainingPoints(rpSpend);
      els.rpPoints.value = currentNormalBalance || "";
    } else {
      els.rpPoints.value = getRpSpendTotalPoints(rpSpend) || "";
    }
  }
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
  updateRpPointsReceivedFieldState();
  if (isPartnerProgramRpSpend(rpSpend)) {
    populatePartnerProgramReceivedPoints();
  }
  if (els.saveRpSpendBtn) els.saveRpSpendBtn.textContent = "Update RP Spend";
  
  // Show info message for partner programs about row-level values and the
  // consolidated partner widget.
  if (isPartnerProgramRpSpend(rpSpend) && (rpSpend.partnerName || rpSpend.purchasedFrom)) {
    showToast("Note: Redeemed value is stored per redemption; the partner widget consolidates it.");
  }
  
  updateRpPaidValue();
  updatePartnerTransferDetailsButton();
  refreshAllFieldStates();
}

function renderManualPartnerPointsInRpSpends(entries) {
  if (!els.rpSpendsTable || !entries.length) return;

  const section = document.createElement("section");
  section.className = "rp-manual-partner-section";
  section.innerHTML = `
    <div class="rp-manual-partner-heading">
      <div>
        <span class="eyebrow">PARTNER POINTS</span>
        <strong>Manual Partner Points</strong>
      </div>
      <span>${entries.length} ${entries.length === 1 ? "entry" : "entries"}</span>
    </div>
    <div class="table-head rp-manual-partner-table-head">
      <span>Partner Details</span>
      <span>Source</span>
      <span>Points Added</span>
      <span>Remaining</span>
      <span>Redeemed</span>
      <span>Date</span>
      <span></span>
    </div>
    ${entries.map((entry) => {
      const totalPoints = toNumber(entry.points);
      const redeemedPoints = Math.min(totalPoints, toNumber(entry.redeemedPoints));
      const remainingPoints = Math.max(0, totalPoints - redeemedPoints);
      return `
        <article class="card-row rp-spend-row rp-manual-partner-row">
          <div class="card-name">
            <strong>${escapeHtml(entry.partnerName)}</strong>
            <span class="card-meta">${escapeHtml(entry.notes || "Partner-specific points")}</span>
          </div>
          <div class="money-cell">
            <span class="cell-label">Source</span>
            <strong>Manual</strong>
          </div>
          <div class="money-cell">
            <span class="cell-label">Points Added</span>
            <strong>${escapeHtml(formatPoints(totalPoints))}</strong>
          </div>
          <div class="money-cell">
            <span class="cell-label">Remaining</span>
            <strong>${escapeHtml(formatPoints(remainingPoints))}</strong>
          </div>
          <div class="money-cell">
            <span class="cell-label">Redeemed</span>
            <strong>${escapeHtml(formatPoints(redeemedPoints))}</strong>
          </div>
          <div class="money-cell">
            <span class="cell-label">Date</span>
            <strong>${escapeHtml(entry.date ? formatDateTime(entry.date) : "Not entered")}</strong>
          </div>
          <div class="money-cell rp-spend-actions-cell">
            <span class="cell-label">Actions</span>
            <div class="row-actions">
              <button class="icon-button subtle" type="button" data-ppr-manual-action="edit" data-id="${escapeAttribute(entry.id)}" title="Edit manual partner points" aria-label="Edit manual partner points">
                <svg viewBox="0 0 24 24" width="14"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
              </button>
              <button class="icon-button subtle" type="button" data-ppr-manual-action="delete" data-id="${escapeAttribute(entry.id)}" title="Delete manual partner points" aria-label="Delete manual partner points">
                <svg viewBox="0 0 24 24" width="14"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></svg>
              </button>
            </div>
          </div>
        </article>
      `;
    }).join("")}
  `;
  els.rpSpendsTable.appendChild(section);
}

function renderRpSpends() {
  if (!els.rpSpendsTable) return;

  const rpRenderTotals = getRpPointsUsageTotals();
  const rpRenderRedeemed = document.getElementById("rpRenderRedeemed");
  const rpRenderUnredeemed = document.getElementById("rpRenderUnredeemed");
  if (rpRenderRedeemed) rpRenderRedeemed.textContent = formatPoints(rpRenderTotals.spent);
  if (rpRenderUnredeemed) rpRenderUnredeemed.textContent = formatPoints(rpRenderTotals.notSpent);

  updateRpPaidValue();
  if (els.rpSpendUnredeemedOnly) {
    els.rpSpendUnredeemedOnly.value = state.rpSpendUnredeemedOnly ? "unredeemed" : "all";
  }
  els.rpSpendsTable.innerHTML = "";

  const searchQuery = state.rpSpendSearch?.trim().toLowerCase() || "";
  const showUnredeemedOnly = Boolean(state.rpSpendUnredeemedOnly);
  const filteredManualEntries = getPprManualPointEntries()
    .filter((entry) => {
      const remainingPoints = Math.max(0, toNumber(entry.points) - toNumber(entry.redeemedPoints));
      if (showUnredeemedOnly && remainingPoints <= 0) return false;
      if (!searchQuery) return true;
      return [entry.partnerName, entry.notes, entry.date, entry.points, entry.redeemedPoints]
        .join(" ")
        .toLowerCase()
        .includes(searchQuery);
    })
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  if (!state.rpSpends.length && !filteredManualEntries.length) {
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
  const filteredGroups = sortedGroups.filter((group) => {
    // The filter should show the saved Unredeemed Points record even after
    // its balance reaches zero. A zero balance is still useful history and
    // must not make the card disappear from this view.
    if (showUnredeemedOnly && !group.items.some((item) => isUnredeemedPointsRecord(item))) {
      return false;
    }

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
  if (!totalGroups && !filteredManualEntries.length) {
    els.rpSpendsTable.appendChild(
      createEmptyState(
        searchQuery ? "No matching RP spends" : showUnredeemedOnly ? "No unredeemed RP spends" : "No RP spends logged",
        searchQuery
          ? "Try a different product, brand, card, points, or value."
          : showUnredeemedOnly
            ? "Turn off the filter to see all RP spends."
            : "Add reward-point purchases with card, voucher, and points value details."
      )
    );
    return;
  }

  if (totalGroups) {
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
  }

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
    // Partner-program earned points are derived from the transferred points
    // and ratio when the optional received-points field is blank. Keep the
    // received value product-level so multiple payment rows do not multiply it.
    const totalEarned = group.items.some(isPartnerProgramRpSpend)
      ? getPartnerProgramPurchaseEarnedPoints(group.items)
      : toNumber(group.pointsReceived);
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
          ${group.items.map((item) => {
            const sourceCard = getRpSpendDisplayCard(item);
            const sourceAllocation = isUnredeemedPointsRecord(item) && sourceCard
              ? getCardPointAllocation(sourceCard)
              : null;
            const displayPoints = getRpSpendTotalPoints(item) > 0
              ? getRpSpendDisplayPoints(item)
              : 0;
            const showWelcomeBenefits = Boolean(sourceAllocation?.welcomeRemainingPoints > 0);

            return `
            <div class="benefit-line">
              <span class="benefit-line-name rp-spend-source-name">
                <span class="rp-spend-source-name-text">${escapeHtml(formatRpSourceName(item.cardId))}</span>
                ${showWelcomeBenefits ? '<small class="rp-welcome-balance-label">+ Welcome Benefits</small>' : ''}
              </span>
              <span class="benefit-line-meta">
                ${displayPoints > 0 ? `${formatPoints(displayPoints)}` : ''}
                ${toNumber(item.cardPaid) > 0 ? ` Card: ${formatMoney(item.cardPaid)}` : ''}
                ${toNumber(item.voucherPaid) > 0 ? `Voucher: ${formatMoney(item.voucherPaid)}` : ''}
              </span>
              ${isPartnerProgramRpSpend(item) ? `<span class="card-meta" style="display:block; margin-top:4px;">Card: ${escapeHtml(getContributingCardLabel(item))}</span>` : ""}
              <div class="row-actions inline-actions">
                <button class="icon-button subtle" type="button" data-rp-spend-action="edit" data-id="${escapeAttribute(item.id)}"><svg viewBox="0 0 24 24" width="14"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg></button>
                <button class="icon-button subtle" type="button" data-rp-spend-action="delete" data-id="${escapeAttribute(item.id)}"><svg viewBox="0 0 24 24" width="14"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></svg></button>
              </div>
            </div>
          `;
          }).join('')}
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

  renderManualPartnerPointsInRpSpends(filteredManualEntries);
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
  const editingId = els.editingLoungeVisitId?.value || "";
  const existingVisit = state.loungeVisits.find((item) => item.id === editingId);

  const loungeType = els.loungeTypeSelect?.value || "Domestic";
  const accessMethod = normalizeLoungeAccessMethod(els.loungeAccessMethod?.value || "");

  if (!els.loungeCardSelect?.value) {
    showToast("Select a card first.");
    return;
  }

  if (!accessMethod) {
    showToast("Select an access method.");
    return;
  }

  const visit = {
    id: els.editingLoungeVisitId?.value || createId(),

    cardId: els.loungeCardSelect?.value || "",

    loungeType: loungeType,

    accessMethod,

    airport:
      document.getElementById("loungeAirport")?.value.trim() || "",

    notes: existingVisit?.notes || "",

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

function getLoungeBenefitLabel(visit) {
  const labels = {
    Domestic: "Domestic Lounge",
    International: "International Lounge",
    Domestic_Golf: "Domestic Golf",
    International_Golf: "International Golf",
    Domestic_Restaurant: "Domestic Restaurant",
    International_Restaurant: "International Restaurant",
    Domestic_Spa: "Domestic Spa",
    International_Spa: "International Spa",
    Meet_Greet: "Meet & Greet",
    Airport_Transfer: "Airport Transfer",
  };

  const type = String(visit?.loungeType || "Benefit");
  return labels[type] || type.replace(/_/g, " ");
}

function openLoungeBenefitNotesModal(visit) {
  if (!els.loungeBenefitNotesModal) return;

  if (els.loungeBenefitNotesId) els.loungeBenefitNotesId.value = visit.id;
  if (els.loungeBenefitNotesInput) els.loungeBenefitNotesInput.value = visit.notes || "";
  if (els.loungeBenefitNotesTitle) {
    els.loungeBenefitNotesTitle.textContent = `${getLoungeBenefitLabel(visit)} Notes`;
  }
  if (els.loungeBenefitNotesSubtitle) {
    const card = getCardById(visit.cardId);
    const accessMethod = visit.accessMethod || "Access method not set";
    els.loungeBenefitNotesSubtitle.textContent = `${formatCardName(card)} | ${accessMethod}`;
  }

  els.loungeBenefitNotesModal.style.display = "flex";
  window.setTimeout(() => els.loungeBenefitNotesInput?.focus(), 0);
}

function closeLoungeBenefitNotesModal() {
  if (els.loungeBenefitNotesModal) els.loungeBenefitNotesModal.style.display = "none";
}

async function saveLoungeBenefitNotes(event) {
  event.preventDefault();

  const id = els.loungeBenefitNotesId?.value || "";
  const visit = state.loungeVisits.find((item) => item.id === id);
  if (!visit) {
    closeLoungeBenefitNotesModal();
    return;
  }

  visit.notes = els.loungeBenefitNotesInput?.value.trim() || "";
  await saveState();
  closeLoungeBenefitNotesModal();
  render();
  showToast("Benefit notes saved.");
}

function handleLoungeAction(event) {
  const button = event.target.closest("[data-lounge-action]");
  if (!button) return;

  const visit = state.loungeVisits.find((item) => item.id === button.dataset.id);
  if (!visit) return;

  if (button.dataset.loungeAction === "edit") {
    populateLoungeVisitForm(visit);
    scrollToPageTop();
    return;
  }

  if (button.dataset.loungeAction === "notes") {
    openLoungeBenefitNotesModal(visit);
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
  document.body.classList.add("lounge-entry-open");
  if (els.editingLoungeVisitId) els.editingLoungeVisitId.value = visit.id;
  if (els.loungeCardSelect) els.loungeCardSelect.value = visit.cardId;
  if (els.loungeTypeSelect) els.loungeTypeSelect.value = visit.loungeType || "";
  if (els.loungeAccessMethod) els.loungeAccessMethod.value = visit.accessMethod || "";
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
  if (els.loungeAccessMethod) {
    els.loungeAccessMethod.value = "";
    els.loungeAccessMethod.selectedIndex = 0;
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

  const loungeRenderVisits = state.loungeVisits.filter(isLoungeBenefitVisit);
  const loungeRenderValue = document.getElementById("loungeRenderValue");
  const loungeRenderUsage = document.getElementById("loungeRenderUsage");
  const loungeRenderInternational = document.getElementById("loungeRenderInternational");
  const loungeRenderDomestic = document.getElementById("loungeRenderDomestic");
  if (loungeRenderValue) loungeRenderValue.textContent = formatMoney(getLoungeVisitTotal());
  if (loungeRenderUsage) loungeRenderUsage.textContent = `${loungeRenderVisits.length} ${loungeRenderVisits.length === 1 ? "visit" : "visits"}`;
  if (loungeRenderInternational) {
    const count = loungeRenderVisits.filter((visit) => visit.loungeType === "International").length;
    loungeRenderInternational.textContent = `${count} ${count === 1 ? "visit" : "visits"}`;
  }
  if (loungeRenderDomestic) {
    const count = loungeRenderVisits.filter((visit) => visit.loungeType === "Domestic").length;
    loungeRenderDomestic.textContent = `${count} ${count === 1 ? "visit" : "visits"}`;
  }

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
      <span>Date</span>
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

      const notesActionLabel = visit.notes ? "Edit benefit notes" : "Add benefit notes";
      const notesButtonClass = visit.notes ? "icon-button subtle has-note" : "icon-button subtle";

      row.innerHTML = `

        <div class="card-name">

          <strong>
            ${escapeHtml(formatCardName(getCardById(visit.cardId)))}
          </strong>

          <span class="card-meta">
            ${escapeHtml(visit.accessMethod || "Access method not set")}
            |
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

        <div class="money-cell">
          <span class="cell-label">Date</span>

          <strong>
            ${escapeHtml(formatLoungeUsageDate(visit.date || visit.createdAt))}
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
            class="${notesButtonClass}"
            type="button"
            data-lounge-action="notes"
            data-id="${escapeAttribute(visit.id)}"
            title="${notesActionLabel}"
            aria-label="${notesActionLabel}"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" />
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
  // Chart.js is a deferred, non-critical dependency. Keep the rest of the
  // lounge widget usable if the CDN is still loading or temporarily unavailable.
  if (typeof window.Chart === "undefined") {
    if (state.currentView === "lounge") {
      ensureChartJsLoaded().catch((error) => console.warn(error.message));
    }
    return;
  }

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
  const visitsByCard = new Map();
  state.loungeVisits.forEach((visit) => {
    const cardVisits = visitsByCard.get(visit.cardId) || [];
    cardVisits.push(visit);
    visitsByCard.set(visit.cardId, cardVisits);
  });

  // Update each card's benefits based on lounge visits
  state.cards = state.cards.map((card) => {
    // Filter out existing auto-generated lounge benefits to avoid duplicates
    let benefits = (card.benefits || []).filter((benefit) => {
      return !(benefit.id && String(benefit.id).startsWith("lounge-"));
    });

    // Group visits by type for this card
    const cardVisits = visitsByCard.get(card.id) || [];
    
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
  // Derived benefits are synchronized first because those routines can update
  // the card objects. Only cache after that work is complete.
  renderDerivedCache = null;
  syncRpRedeemedBenefitsFromSpends();
  // Always sync lounge benefits to ensure all cards have correct lounge benefits
  syncLoungeBenefitsFromVisits();
  renderDerivedCache = {};

  try {
    updateAppHeaderTitle(state.currentView);
    renderCardDropdowns();
    renderVisibleView(state.currentView, false);
  } finally {
    renderDerivedCache = null;
  }
}

function renderVisibleView(view = state.currentView, includeDropdowns = false) {
  const ownsCache = !renderDerivedCache;
  if (ownsCache) renderDerivedCache = {};

  try {
    if (includeDropdowns) renderCardDropdowns();

    switch (normalizeViewName(view)) {
      case "portfolio":
        renderSummary();
        renderBenefitsEditor();
        renderCards();
        renderCategories();
        break;
      case "swipes":
        renderSwipes();
        break;
      case "rpSpends":
        renderRpSpends();
        break;
      case "ppr":
        renderPprWidget();
        break;
      case "lounge":
        renderLoungeVisits();
        renderLoungeLimitsTable();
        updateLoungeCardFilter();
        break;
      case "intlTravel":
        renderIntlTravel();
        break;
      case "dashboard":
      default:
        renderDashboard();
        break;
    }
  } finally {
    if (ownsCache) renderDerivedCache = null;
  }
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
  els.benefitValue.textContent = formatMoney(totals.cashBenefitsNet);
  els.benefitValue.style.cursor = "pointer";
  els.benefitValue.title = "Click to view net cash-benefit breakdown";
  els.benefitValue.style.color = totals.cashBenefitsNet > 0 ? "#10b981" : "#ef4444";
  setWidgetValueState(els.benefitValue, totals.cashBenefitsNet);
  els.benefitHint.textContent = `Net cash benefits after fees across ${cardCount} ${cardCount === 1 ? "card" : "cards"}`;
  els.netValue.style.color = totals.net > 0 ? "#10b981" : "#ef4444";
  setWidgetValueState(els.netValue, totals.net);
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

  els.portfolioCount.textContent = `${cardCount} ${cardCount === 1 ? "Card" : "Cards"}`;
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

function closePointsModal() {
  const modal = document.getElementById("pointsModal");
  if (pointsModalReturnView === "cash") {
    pointsModalReturnView = null;
    showCashPopup();
    return;
  }

  pointsModalReturnView = null;
  if (modal) modal.style.display = "none";
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
  pointsModalReturnView = null;
  modal.classList.remove("cash-benefits-modal");
  const title = modal.querySelector("h3");
  if (title) title.textContent = "Total Unredeemed Points";

  const pointCards = state.cards
    .map((card) => ({ card, points: getCardUnredeemedPoints(card) }))
    .filter(({ points }) => points > 0)
    .sort((a, b) => b.points - a.points);

  const axisGroups = ["Edge Rewards", "Edge Miles"].map((program) => ({
    program,
    cards: pointCards.filter(({ card }) => getAxisProgram(card) === program),
  }));
  const groupedAxisCardIds = new Set(
    axisGroups.flatMap((group) => group.cards.map(({ card }) => card.id))
  );
  const individualCards = pointCards.filter(({ card }) => !groupedAxisCardIds.has(card.id));

  const renderIndividualCard = ({ card, points }) => `
    <div class="points-popup-row">
      <div>
        <div class="points-popup-card-name">${escapeHtml(card.issuer || "Bank")} | ${escapeHtml(card.name)}</div>
        ${getAxisProgram(card) === "Cashback" && isAxisIssuer(card.issuer)
          ? '<div class="points-popup-issuer">Axis Cashback</div>'
          : ""}
      </div>
      <div class="points-popup-points">${escapeHtml(formatPoints(points))}</div>
    </div>
  `;

  const renderAxisGroup = ({ program, cards }) => {
    const total = cards.reduce((sum, item) => sum + item.points, 0);
    return `
      <section class="points-popup-group" data-points-group>
        <button type="button" class="points-popup-group-toggle" data-points-group-toggle aria-expanded="false">
          <span class="points-popup-group-label">
            <strong>Axis ${escapeHtml(program)}</strong>
            <small>${cards.length} ${cards.length === 1 ? "card" : "cards"}</small>
          </span>
          <span class="points-popup-group-total">
            <span>${escapeHtml(formatPoints(total))}</span>
            <span class="points-popup-group-chevron" aria-hidden="true">⌄</span>
          </span>
        </button>
        <div class="points-popup-group-items" hidden>
          ${cards.length
            ? cards.map(renderIndividualCard).join("")
            : '<div class="points-popup-group-empty">No cards are classified under this Axis program yet.</div>'}
        </div>
      </section>
    `;
  };

  if (!pointCards.length) {
    content.innerHTML = `
      <div style="text-align:center; padding:20px; color:#94a3b8;">
        No unredeemed points available
      </div>
    `;
  } else {
    content.innerHTML = [
      axisGroups.map(renderAxisGroup).join(""),
      individualCards.map(renderIndividualCard).join(""),
    ].join("");
  }

  modal.style.display = "flex";

  content.querySelectorAll("[data-points-group-toggle]").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const group = toggle.closest("[data-points-group]");
      const items = group?.querySelector(".points-popup-group-items");
      if (!items) return;
      const isExpanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!isExpanded));
      items.hidden = isExpanded;
      group.classList.toggle("is-expanded", !isExpanded);
    });
  });
}

function showFeePopup() {
  const modal = document.getElementById("pointsModal");
  const content = document.getElementById("pointsModalContent");
  pointsModalReturnView = null;
  modal.classList.remove("cash-benefits-modal");
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
  pointsModalReturnView = null;
  modal.classList.add("cash-benefits-modal");
  if (title) title.textContent = "Net Cash Benefits";

  const cashCards = [...state.cards].sort((a, b) => {
    const totalsA = getCardTotals(a);
    const totalsB = getCardTotals(b);
    return totalsB.cashBenefitNet - totalsA.cashBenefitNet;
  });

  if (!cashCards.length) {
    content.innerHTML = `
      <div class="cash-benefit-popup-empty" style="text-align:center; padding:20px; color:#94a3b8;">
        No cards in portfolio
      </div>
    `;
  } else {
    content.innerHTML = cashCards.map((card) => {
      const totals = getCardTotals(card);
      const status = getStatus(totals.cashBenefitNet);
      const valueColor = totals.cashBenefitNet > 0 ? "#10b981" : totals.cashBenefitNet < 0 ? "#ef4444" : "#f8fafc";

      return `
        <article class="cash-benefit-popup-row${card.isGreyedOut ? " is-greyed-out" : ""}">
          <div class="cash-benefit-popup-card">
            <div class="cash-benefit-popup-name">
              ${escapeHtml(card.issuer || "Bank")} | ${escapeHtml(card.name)}
            </div>
            <div class="cash-benefit-popup-card-actions">
              <span class="status-pill ${status.key}">
                ${escapeHtml(status.label)}
              </span>
              <button class="cash-benefit-show-btn" type="button" data-cash-benefits-card-id="${escapeAttribute(card.id)}">
                Show benefits
              </button>
            </div>
          </div>

          <div class="cash-benefit-popup-value" style="color:${valueColor};">
            ${escapeHtml(formatMoney(totals.cashBenefitNet))}
          </div>
        </article>
      `;
    }).join("");
  }

  modal.style.display = "flex";
}

function getBenefitSourceLabel(benefit) {
  const benefitId = String(benefit?.id || "");
  if (benefitId.startsWith("lounge-")) return "Lounge / Other Benefits";
  if (benefitId.startsWith(rpRedeemedBenefitPrefix) && benefit?.type === "Unredeemed Points") {
    return "RP Spends / Unredeemed Points";
  }
  if (benefitId.startsWith(rpRedeemedBenefitPrefix)) return "RP Spends / Redeemed Value";
  return "Card Benefits";
}

function getCardBenefitRecords(card) {
  const records = (card?.benefits || [])
    .filter((benefit) => toNumber(benefit.amount) !== 0)
    .map((benefit) => ({
      benefit,
      amount: toNumber(benefit.amount),
      source: getBenefitSourceLabel(benefit),
    }));

  // Welcome-point redemptions are allocated from RP Spends, but their
  // monetary value is intentionally not stored as a normal card benefit.
  // Add the derived value here so the Net P/L benefits popup shows the same
  // value that is included in the card's Net P/L calculation.
  const welcomeRedeemedValue = getCardPointAllocation(card).welcomeRedeemedValue;
  if (welcomeRedeemedValue > 0) {
    records.push({
      benefit: {
        id: `${rpRedeemedBenefitPrefix}welcome-value-${card.id}`,
        type: "Welcome Benefits Redeemed",
        valueType: "cash",
        label: "Welcome Benefits Redeemed",
      },
      amount: welcomeRedeemedValue,
      source: "RP Spends / Welcome Benefit",
    });
  }

  return records.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}

function showCardBenefitsPopup(cardId) {
  const modal = document.getElementById("pointsModal");
  const content = document.getElementById("pointsModalContent");
  const title = modal.querySelector("h3");
  const card = state.cards.find((item) => item.id === cardId);
  if (!card) return;

  pointsModalReturnView = "cash";
  const records = getCardBenefitRecords(card);
  const monetaryTotal = records
    .filter(({ benefit }) => !isPointBenefit(benefit))
    .reduce((sum, item) => sum + item.amount, 0);

  modal.classList.add("cash-benefits-modal");
  if (title) title.textContent = `${formatCardName(card)} Benefits`;

  if (!records.length) {
    content.innerHTML = `
      <div class="cash-benefit-popup-empty" style="text-align:center; padding:20px; color:#94a3b8;">
        No benefits recorded for this card
      </div>
    `;
  } else {
    content.innerHTML = `
      <div class="cash-benefit-card-detail-summary">
        <span>${records.length} benefit ${records.length === 1 ? "record" : "records"} from all connected widgets</span>
        <strong>${escapeHtml(formatMoney(monetaryTotal))}</strong>
      </div>
      ${records.map(({ benefit, amount, source }) => `
        <article class="cash-benefit-detail-record">
          <div class="cash-benefit-popup-name">${escapeHtml(benefit.label || benefit.type || "Benefit")}</div>
          <span class="cash-benefit-detail-source">${escapeHtml(source)}${isPointBenefit(benefit) ? " - Points" : " - Monetary"}</span>
          <strong class="cash-benefit-detail-value ${amount < 0 ? "is-loss" : ""}">
            ${escapeHtml(isPointBenefit(benefit) ? formatPoints(amount) : formatMoney(amount))}
          </strong>
        </article>
      `).join("")}
    `;
  }

  modal.style.display = "flex";
}

function renderBenefitsEditor() {
  els.benefitRows.innerHTML = "";

  draftBenefits.forEach((benefit, index) => {
    const welcomePoints = benefit.type === welcomeBenefitPointsType
      ? (toNumber(benefit.pointsAmount) || extractNumericPointsFromBenefitLabel(benefit.label))
      : 0;
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
    row.className = `benefit-row${benefit.type === welcomeBenefitPointsType ? " has-points-field" : ""}`;
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
      ${benefit.type === welcomeBenefitPointsType ? `
        <label class="field benefit-points-field">
          <span>Points</span>
          <input data-benefit-field="pointsAmount" type="number" min="0" step="any" inputmode="decimal" value="${welcomePoints || ""}" placeholder="Welcome points" />
        </label>
      ` : ""}
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
    const netColor = totals.net > 0 ? "#10b981" : "#ef4444";
    
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
        <strong class="card-net-value ${status.key}" style="color: ${netColor}">${formatMoney(totals.net)}</strong>
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

  const editingCardId = els.editingId.value;
  const existingCard = editingCardId
    ? state.cards.find((item) => item.id === editingCardId)
    : null;

  const cardBenefits = draftBenefits.filter(
    (benefit) => !isRpRedeemedAutoBenefit(benefit)
      && (benefit.label.trim() || toNumber(benefit.amount) > 0 || toNumber(benefit.pointsAmount) > 0)
  );
  const existingBenefitIds = new Set((existingCard?.benefits || []).map((benefit) => benefit.id));
  const welcomeBenefitAddedAt = new Date().toISOString();
  const savedCardBenefits = cardBenefits.map((benefit) => (
    benefit.type === welcomeBenefitPointsType
      && !existingBenefitIds.has(benefit.id)
      && !benefit.addedAt
      ? { ...benefit, addedAt: welcomeBenefitAddedAt }
      : benefit
  ));

  const card = normalizeCard({
    id: editingCardId || createId(),
    name: els.cardName.value.trim(),
    issuer: els.issuerName.value.trim(),
    axisProgram: isAxisIssuer(els.issuerName.value)
      ? (normalizeAxisProgram(els.axisProgram?.value) || "Cashback")
      : "",
    annualFee: els.annualFee.value,
    taxFee: els.taxFee.value,
    isLtf: !!els.isLtf?.checked,
    isGreyedOut: !!existingCard?.isGreyedOut,
    memberSince: els.memberSince.value.trim(),
    previousAnnualFees: draftPreviousAnnualFees,
    futureAnnualFees: draftFutureAnnualFees,
    targetValue: els.targetValue?.value || "",
    notes: els.notes.value.trim(),
    benefits: savedCardBenefits,
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
  document.body.classList.remove("card-editor-open");
  render();
}
function handleCardAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const card = state.cards.find((item) => item.id === button.dataset.id);
  if (!card) return;

  if (button.dataset.action === "edit") {
    populateForm(card);
    document.body.classList.add("card-editor-open");
    scrollToPageTop();
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
    state.loungeCardLimits = state.loungeCardLimits.filter((limit) => limit.cardId !== card.id);
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
  renderIssuerOptions(card.issuer);
  els.axisProgram.value = getAxisProgram(card) === "Cashback" ? "" : getAxisProgram(card);
  updateAxisProgramField();
  els.annualFee.value = card.annualFee || "";
  els.taxFee.value = card.taxFee || "";
  if (els.isLtf) {
    els.isLtf.checked = !!card.isLtf;
  }
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
  renderIssuerOptions("");
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
  draftBenefits[index][fieldName] = ["amount", "pointsAmount"].includes(fieldName)
    ? toNumber(fieldEl.value)
    : fieldEl.value;

  if (fieldName === "type") {
    if (draftBenefits[index].type === welcomeBenefitPointsType) {
      draftBenefits[index].valueType = "cash";
    }
    renderBenefitsEditor();
  }
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
    const pointsField = row.querySelector('[data-benefit-field="pointsAmount"]');
    return {
      ...draftBenefits[Number(row.dataset.index)],
      id: draftBenefits[Number(row.dataset.index)]?.id || createId(),
      type,
      valueType,
      label,
      amount,
      pointsAmount: pointsField
        ? toNumber(pointsField.value)
        : toNumber(draftBenefits[Number(row.dataset.index)]?.pointsAmount),
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
    pprManualPoints: state.pprManualPoints,
    loungeVisits: state.loungeVisits,
    loungeCardLimits: state.loungeCardLimits,
    intlTravelTrips: state.intlTravelTrips,
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
      state.pprManualPoints = (data.pprManualPoints || data.manualPprPoints || []).map(normalizePprManualPoint);
      state.loungeVisits = (data.loungeVisits || []).map(normalizeLoungeVisit);
      state.loungeCardLimits = (data.loungeCardLimits || data.loungeLimits || []).map(normalizeLoungeCardLimit);
      state.intlTravelTrips = (data.intlTravelTrips || data.intlTrips || []).map(normalizeIntlTravelTrip);
      migrateLegacyPointsRedeemedBenefitsToRpSpends();
      removeDuplicateLegacyRpSpends();
      ensureWelcomeBenefitPointFields();
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
      state.pprManualPoints = (data.pprManualPoints || data.manualPprPoints || []).map(normalizePprManualPoint);
      state.loungeVisits = (data.loungeVisits || []).map(normalizeLoungeVisit);
      state.loungeCardLimits = (data.loungeCardLimits || data.loungeLimits || []).map(normalizeLoungeCardLimit);
      state.intlTravelTrips = (data.intlTravelTrips || data.intlTrips || []).map(normalizeIntlTravelTrip);
      migrateLegacyPointsRedeemedBenefitsToRpSpends();
      removeDuplicateLegacyRpSpends();
      ensureWelcomeBenefitPointFields();
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
      totals.cashBenefitsNet += cardTotals.cashBenefitNet;
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
      cashBenefitsNet: 0,
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
  const cache = getRenderCacheMap("cardTotals");
  if (cache && card?.id && cache.has(card.id)) return cache.get(card.id);

  let fees = toNumber(card.annualFee) + toNumber(card.taxFee) + getPreviousAnnualFeeTotal(card) + getFutureAnnualFeeTotal(card);

  const benefits = card.benefits.reduce((sum, benefit) => (isPointBenefit(benefit) ? sum : sum + toNumber(benefit.amount)), 0);
  // RP Spend monetary values are split between Welcome Benefit points and
  // normal points by getCardPointAllocation(). The normal-point portion is
  // already mirrored into the auto "Points Redeemed" benefit above, but the
  // welcome-point portion is intentionally kept out of card.benefits so it
  // cannot be double-counted. Include that portion directly in Net P/L.
  const welcomeRedeemedValue = getCardPointAllocation(card).welcomeRedeemedValue;
  const cashBenefitNet = benefits + welcomeRedeemedValue - fees;
  const points = getCardUnredeemedPoints(card);
  const cashBenefitCount = card.benefits.filter((benefit) => !isPointBenefit(benefit)).length;
  const pointBenefitCount = card.benefits.filter(isPointBenefit).length;
  const totals = {
    fees,
    benefits,
    welcomeRedeemedValue,
    cashBenefitNet,
    points,
    cashBenefitCount,
    pointBenefitCount,
    net: cashBenefitNet,
  };

  if (cache && card?.id) cache.set(card.id, totals);
  return totals;
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
  if (isPartnerProgramRpSpend(rpSpend)) {
    return getPartnerProgramSourcePoints(rpSpend);
  }

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
    const sourceCard = getRpSpendDisplayCard(rpSpend);
    if (sourceCard) {
      // The RP source row stores the manually entered normal balance. The
      // card allocation also contains any remaining Welcome Benefit points,
      // so the detail row must display the combined balance.
      return getCardPointAllocation(sourceCard).totalUnredeemedPoints;
    }
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
  const portfolioCardIds = new Set(state.cards.map((card) => String(card.id || "")));
  const totals = {
    spent: 0,
    // Card balances are derived from the full point allocation, so this
    // includes both normal unredeemed points and Welcome Benefit (Points).
    notSpent: state.cards.reduce((sum, card) => sum + getCardUnredeemedPoints(card), 0),
  };

  state.rpSpends.forEach((rpSpend) => {
    if (isUnredeemedPointsRecord(rpSpend)) {
      // A source record attached to a portfolio card is already included in
      // that card's allocation. Keep standalone/platform records visible too.
      if (!portfolioCardIds.has(String(rpSpend.cardId || ""))) {
        totals.notSpent += getRpSpendRemainingPoints(rpSpend);
      }
      return;
    }

    totals.spent += getRpSpendRedemptionAmount(rpSpend);
  });

  return totals;
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

function getPartnerProgramSourcePoints(rpSpend) {
  if (!isPartnerProgramRpSpend(rpSpend)) return 0;

  const explicitRedeemedPoints = toNumber(rpSpend?.redeemedPoints);
  if (explicitRedeemedPoints > 0) return explicitRedeemedPoints;

  const points = toNumber(rpSpend?.points);
  const receivedPoints = toNumber(rpSpend?.pointsReceived);
  const ratio = parsePartnerTransferRatio(rpSpend?.partnerTransferRatio);
  if (ratio && receivedPoints > 0) {
    const inferredSourcePoints = (receivedPoints * ratio.from) / ratio.to;
    if (inferredSourcePoints > 0) return inferredSourcePoints;
  }

  return points;
}

function getPartnerProgramPoints(rpSpend) {
  const receivedPoints = toNumber(rpSpend?.pointsReceived || 0);
  if (receivedPoints > 0) return receivedPoints;
  const ratio = parsePartnerTransferRatio(rpSpend?.partnerTransferRatio);
  const partnerTransferPoints = getPartnerProgramSourcePoints(rpSpend);
  if (ratio && partnerTransferPoints > 0) {
    return computePartnerTransferPoints(partnerTransferPoints, ratio);
  }
  return partnerTransferPoints;
}

function getPartnerProgramCardDebitPoints(rpSpend, partnerPoints) {
  const points = Math.max(0, toNumber(partnerPoints));
  if (points <= 0) return 0;

  const ratio = parsePartnerTransferRatio(rpSpend?.partnerTransferRatio);
  if (ratio) {
    return points * (ratio.from / ratio.to);
  }

  // Ratios are normally recorded for partner transfers. For older records
  // without one, use the saved source/partner-point relationship so a partial
  // partner redemption still debits only its matching card share.
  const totalPartnerPoints = getPartnerProgramPoints(rpSpend);
  const totalSourcePoints = getPartnerProgramSourcePoints(rpSpend);
  if (totalPartnerPoints > 0 && totalSourcePoints > 0) {
    return points * (totalSourcePoints / totalPartnerPoints);
  }

  return points;
}

function getPartnerProgramPurchaseEarnedPoints(items = []) {
  const partnerItems = items.filter(isPartnerProgramRpSpend);
  if (!partnerItems.length) return 0;

  // Every partner row is a transfer from one originating card. Sum the
  // resulting partner points row by row so a transfer with an explicit
  // received-points value does not hide later card contributions in the same
  // partner group.
  return partnerItems.reduce((sum, item) => sum + getPartnerProgramPoints(item), 0);
}

function getPprCardContributionSources(partnerName = "") {
  const normalizedFilter = normalizePprPartnerName(partnerName);
  const sources = [];
  state.rpSpends.forEach((spend, stateIndex) => {
    if (!isPartnerProgramRpSpend(spend)) return;

    const spendPartnerName = String(spend.partnerName || spend.purchasedFrom || "Partner").trim() || "Partner";
    if (normalizedFilter && normalizePprPartnerName(spendPartnerName) !== normalizedFilter) return;

    // A partner transfer is an individual contribution from one originating
    // card. Never re-split it by purchaseId: multiple cards can legitimately
    // share a purchase group, while each row still has its own partner-point
    // balance. Re-splitting here was the reason a partial PPR redemption could
    // consume an entire card contribution.
    const sourcePoints = Math.max(0, getPartnerProgramPoints(spend));
    if (sourcePoints <= 0) return;

    const explicitlyRedeemed = Math.max(0, toNumber(spend.partnerRedeemedPoints));
    // A value entered in RP Spends means that transfer was already redeemed
    // there. PPR-created partial redemptions always carry an explicit point
    // count, including when their monetary value is zero.
    const redeemedPoints = explicitlyRedeemed > 0
      ? Math.min(sourcePoints, explicitlyRedeemed)
      : toNumber(spend.pointsValue) > 0
        ? sourcePoints
        : 0;

    sources.push({
      purchaseId: spend.purchaseId || spend.id,
      partnerName: spendPartnerName,
      spend,
      stateIndex,
      sourcePoints,
      redeemedPoints,
      remainingPoints: Math.max(0, sourcePoints - redeemedPoints),
      createdAt: spend.createdAt || "",
    });
  });

  return sources.sort((a, b) => {
    const dateDifference = new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    return dateDifference || a.stateIndex - b.stateIndex;
  });
}

function getPprPurchaseGroups() {
  const groups = new Map();

  getPprCardContributionSources().forEach((source) => {
    const existing = groups.get(source.purchaseId) || {
      purchaseId: source.purchaseId,
      partnerName: source.partnerName,
      partnerPoints: 0,
      partnerValue: 0,
      partnerRedeemedPoints: 0,
      latestDate: source.createdAt || "",
    };
    existing.partnerPoints += source.sourcePoints;
    existing.partnerRedeemedPoints += source.redeemedPoints;
    existing.partnerValue += toNumber(source.spend.pointsValue);
    if (new Date(source.createdAt || 0) > new Date(existing.latestDate || 0)) {
      existing.latestDate = source.createdAt || existing.latestDate;
    }
    groups.set(source.purchaseId, existing);
  });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    partnerRedeemedPoints: Math.min(group.partnerPoints, group.partnerRedeemedPoints),
  }));
}

function getPprManualPointEntries() {
  return (state.pprManualPoints || [])
    .map(normalizePprManualPoint)
    .filter((entry) => entry.partnerName && (
      toNumber(entry.points) > 0
      || toNumber(entry.value) > 0
      || entry.notes
      || entry.date
    ));
}

function normalizePprPartnerName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function getPprExistingPartnerNames() {
  const names = new Map();
  getPprPurchaseGroups().forEach((group) => {
    const partnerName = String(group.partnerName || "").trim();
    const key = normalizePprPartnerName(partnerName);
    if (key && !names.has(key)) names.set(key, partnerName);
  });
  getPprManualPointEntries().forEach((entry) => {
    const partnerName = String(entry.partnerName || "").trim();
    const key = normalizePprPartnerName(partnerName);
    if (key && !names.has(key)) names.set(key, partnerName);
  });
  return Array.from(names.values()).sort((a, b) => a.localeCompare(b));
}

function getPprRedemptionBatchId(allocation = {}) {
  return normalizePprRedemptionAllocation(allocation).redemptionId;
}

function getPprRedemptionBatches(partnerName = "") {
  const normalizedPartnerName = normalizePprPartnerName(partnerName);
  if (!normalizedPartnerName) return [];

  const batches = new Map();
  const ensureBatch = (allocation, displayPartnerName) => {
    const normalizedAllocation = normalizePprRedemptionAllocation(allocation);
    const redemptionId = normalizedAllocation.redemptionId;
    const existing = batches.get(redemptionId) || {
      id: redemptionId,
      partnerName: displayPartnerName,
      createdAt: normalizedAllocation.createdAt,
      points: 0,
      value: 0,
      allocations: [],
    };
    if (new Date(normalizedAllocation.createdAt || 0) < new Date(existing.createdAt || 0)) {
      existing.createdAt = normalizedAllocation.createdAt;
    }
    batches.set(redemptionId, existing);
    return { batch: existing, allocation: normalizedAllocation };
  };

  state.rpSpends.forEach((spend) => {
    if (!isPartnerProgramRpSpend(spend)) return;
    const displayPartnerName = String(spend.partnerName || spend.purchasedFrom || "Partner").trim() || "Partner";
    if (normalizePprPartnerName(displayPartnerName) !== normalizedPartnerName) return;

    (Array.isArray(spend.pprRedemptions) ? spend.pprRedemptions : []).forEach((history) => {
      const { batch, allocation } = ensureBatch(history, displayPartnerName);
      const card = getCardById(getRpSpendRedeemedSourceCardId(spend));
      const cardDebitPoints = getPartnerProgramCardDebitPoints(spend, allocation.points);
      batch.points += allocation.points;
      batch.value += allocation.value;
      batch.allocations.push({
        type: "card",
        spendId: spend.id,
        allocationId: allocation.id,
        points: allocation.points,
        value: allocation.value,
        cardDebitPoints,
        sourceLabel: card ? formatCardName(card) : "Card contribution",
      });
    });
  });

  getPprManualPointEntries()
    .filter((entry) => normalizePprPartnerName(entry.partnerName) === normalizedPartnerName)
    .forEach((entry) => {
      (Array.isArray(entry.redemptions) ? entry.redemptions : []).forEach((history) => {
        const { batch, allocation } = ensureBatch(history, entry.partnerName);
        batch.points += allocation.points;
        batch.value += allocation.value;
        batch.allocations.push({
          type: "manual",
          entryId: entry.id,
          allocationId: allocation.id,
          points: allocation.points,
          value: allocation.value,
          cardDebitPoints: 0,
          sourceLabel: "Manual partner points",
        });
      });
    });

  return Array.from(batches.values())
    .map((batch) => ({
      ...batch,
      points: toNumber(batch.points),
      value: Math.round((toNumber(batch.value) + Number.EPSILON) * 100) / 100,
    }))
    .filter((batch) => batch.points > 0)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function getPprRedemptionBatch(partnerName, redemptionId) {
  return getPprRedemptionBatches(partnerName)
    .find((batch) => batch.id === redemptionId) || null;
}

function restorePprRedemptionBatch(partnerName, redemptionId) {
  const batch = getPprRedemptionBatch(partnerName, redemptionId);
  if (!batch) {
    return { redeemedPoints: 0, redeemedValue: 0, allocations: [], error: "That PPR redemption could not be found." };
  }

  const roundCurrency = (amount) => Math.round((toNumber(amount) + Number.EPSILON) * 100) / 100;
  state.rpSpends.forEach((spend) => {
    if (!isPartnerProgramRpSpend(spend)) return;
    const displayPartnerName = String(spend.partnerName || spend.purchasedFrom || "Partner").trim() || "Partner";
    if (normalizePprPartnerName(displayPartnerName) !== normalizePprPartnerName(partnerName)) return;

    const history = Array.isArray(spend.pprRedemptions) ? spend.pprRedemptions : [];
    const removed = history
      .map(normalizePprRedemptionAllocation)
      .filter((allocation) => allocation.redemptionId === redemptionId);
    if (!removed.length) return;

    const removedPoints = removed.reduce((sum, allocation) => sum + allocation.points, 0);
    const removedValue = removed.reduce((sum, allocation) => sum + allocation.value, 0);
    spend.partnerRedeemedPoints = Math.max(0, toNumber(spend.partnerRedeemedPoints) - removedPoints);
    // pointsValue can also contain an RP Spends redemption value. Subtract
    // only this PPR batch, leaving unrelated hotel/product redemptions intact.
    spend.pointsValue = roundCurrency(Math.max(0, toNumber(spend.pointsValue) - removedValue));
    spend.pprRedemptions = history
      .map(normalizePprRedemptionAllocation)
      .filter((allocation) => allocation.redemptionId !== redemptionId);
  });

  state.pprManualPoints = (state.pprManualPoints || []).map((entry) => {
    if (normalizePprPartnerName(entry.partnerName) !== normalizePprPartnerName(partnerName)) return entry;
    const history = Array.isArray(entry.redemptions) ? entry.redemptions : [];
    const removed = history
      .map(normalizePprRedemptionAllocation)
      .filter((allocation) => allocation.redemptionId === redemptionId);
    if (!removed.length) return entry;

    const removedPoints = removed.reduce((sum, allocation) => sum + allocation.points, 0);
    const removedValue = removed.reduce((sum, allocation) => sum + allocation.value, 0);
    return {
      ...entry,
      redeemedPoints: Math.max(0, toNumber(entry.redeemedPoints) - removedPoints),
      redeemedValue: roundCurrency(Math.max(0, toNumber(entry.redeemedValue) - removedValue)),
      redemptions: history
        .map(normalizePprRedemptionAllocation)
        .filter((allocation) => allocation.redemptionId !== redemptionId),
    };
  });

  return {
    redeemedPoints: batch.points,
    redeemedValue: batch.value,
    allocations: batch.allocations,
    restored: true,
  };
}

function getPprSummary() {
  const purchaseGroups = getPprPurchaseGroups().filter((group) => toNumber(group.partnerPoints) > 0);
  const manualEntries = getPprManualPointEntries();
  const partnerMap = new Map();

  const ensurePartnerEntry = (partnerName) => {
    const displayName = String(partnerName || "Partner").trim() || "Partner";
    const key = normalizePprPartnerName(displayName);
    const existing = partnerMap.get(key);
    if (existing) return existing;

    const entry = {
      partnerName: displayName,
      points: 0,
      value: 0,
      purchases: 0,
      redeemedPoints: 0,
      redeemedValue: 0,
      redeemedPurchases: 0,
      cardRedeemedPoints: 0,
      cardRedeemedValue: 0,
      manualRedeemedPoints: 0,
      manualRedeemedValue: 0,
      unredeemedPoints: 0,
      unredeemedValue: 0,
      unredeemedPurchases: 0,
      cardUnredeemedPoints: 0,
      cardUnredeemedValue: 0,
      manualUnredeemedPoints: 0,
      manualUnredeemedValue: 0,
      manualPurchases: 0,
    };
    partnerMap.set(key, entry);
    return entry;
  };

  purchaseGroups.forEach((group) => {
    const entry = ensurePartnerEntry(group.partnerName);

    const groupPoints = toNumber(group.partnerPoints);
    const groupValue = toNumber(group.partnerValue);
    const groupRedeemedPoints = Math.min(groupPoints, toNumber(group.partnerRedeemedPoints));
    const groupUnredeemedPoints = Math.max(0, groupPoints - groupRedeemedPoints);
    entry.points += groupPoints;
    entry.value += groupValue;
    entry.purchases += 1;

    if (groupRedeemedPoints > 0) {
      entry.redeemedPoints += groupRedeemedPoints;
      entry.redeemedValue += groupValue;
      entry.redeemedPurchases += 1;
      entry.cardRedeemedPoints += groupRedeemedPoints;
      entry.cardRedeemedValue += groupValue;
    }
    if (groupUnredeemedPoints > 0) {
      entry.unredeemedPoints += groupUnredeemedPoints;
      entry.unredeemedValue += groupRedeemedPoints > 0 ? 0 : groupValue;
      entry.unredeemedPurchases += 1;
      entry.cardUnredeemedPoints += groupUnredeemedPoints;
      entry.cardUnredeemedValue += groupRedeemedPoints > 0 ? 0 : groupValue;
    }
  });

  manualEntries.forEach((manualEntry) => {
    const entry = ensurePartnerEntry(manualEntry.partnerName);

    const manualPoints = toNumber(manualEntry.points);
    const manualRedeemedPoints = Math.min(manualPoints, toNumber(manualEntry.redeemedPoints));
    const manualUnredeemedPoints = Math.max(0, manualPoints - manualRedeemedPoints);
    const manualUnredeemedValue = manualPoints > 0
      ? toNumber(manualEntry.value) * (manualUnredeemedPoints / manualPoints)
      : toNumber(manualEntry.value);
    entry.points += manualPoints;
    entry.value += manualUnredeemedValue;
    entry.purchases += 1;
    entry.redeemedPoints += manualRedeemedPoints;
    entry.redeemedValue += toNumber(manualEntry.redeemedValue);
    entry.redeemedPurchases += manualRedeemedPoints > 0 ? 1 : 0;
    entry.manualRedeemedPoints += manualRedeemedPoints;
    entry.manualRedeemedValue += toNumber(manualEntry.redeemedValue);
    entry.unredeemedPoints += manualUnredeemedPoints;
    entry.unredeemedValue += manualUnredeemedValue;
    entry.unredeemedPurchases += manualUnredeemedPoints > 0 ? 1 : 0;
    entry.manualUnredeemedPoints += manualUnredeemedPoints;
    entry.manualUnredeemedValue += manualUnredeemedValue;
    entry.manualPurchases += 1;
  });

  const partnerRows = Array.from(partnerMap.values()).sort((a, b) => b.points - a.points || a.partnerName.localeCompare(b.partnerName));
  const redeemedRows = partnerRows
    .filter((row) => row.redeemedPoints > 0)
    .map((row) => ({
      ...row,
      points: row.redeemedPoints,
      value: row.redeemedValue,
      purchases: row.redeemedPurchases,
    }))
    .sort((a, b) => b.points - a.points || a.partnerName.localeCompare(b.partnerName));
  const unredeemedRows = partnerRows
    .filter((row) => row.unredeemedPoints > 0)
    .map((row) => ({
      ...row,
      points: row.unredeemedPoints,
      value: row.unredeemedValue,
      purchases: row.unredeemedPurchases,
    }))
    .sort((a, b) => b.points - a.points || a.partnerName.localeCompare(b.partnerName));
  // The dashboard/PPR headline is the live partner balance. Redeemed points
  // remain visible in the Redeemed table but no longer inflate this balance.
  const totalPoints = partnerRows.reduce((sum, row) => sum + row.unredeemedPoints, 0);

  return {
    totalPoints,
    lifetimePoints: partnerRows.reduce((sum, row) => sum + row.points, 0),
    purchaseCount: purchaseGroups.length + manualEntries.length,
    partnerCount: partnerRows.length,
    partnerRows,
    redeemedRows,
    unredeemedRows,
  };
}

function planPprRedemptionAllocations(contributions, requestedPoints, totalRedeemedValue) {
  const totalAvailablePoints = contributions.reduce(
    (sum, contribution) => sum + Math.max(0, toNumber(contribution.points)),
    0
  );
  const selectedPoints = Math.min(Math.max(0, toNumber(requestedPoints)), totalAvailablePoints);
  if (selectedPoints <= 0) {
    return { redeemedPoints: 0, redeemedValue: 0, allocations: [] };
  }

  const roundCurrency = (amount) => Math.round((toNumber(amount) + Number.EPSILON) * 100) / 100;
  const allocations = [];
  let remainingPoints = selectedPoints;
  contributions.forEach((contribution) => {
    if (remainingPoints <= 0) return;
    const points = Math.min(Math.max(0, toNumber(contribution.points)), remainingPoints);
    if (points <= 0) return;
    allocations.push({ ...contribution, points });
    remainingPoints -= points;
  });

  let allocatedValue = 0;
  allocations.forEach((allocation, index) => {
    const isLast = index === allocations.length - 1;
    allocation.value = isLast
      ? roundCurrency(totalRedeemedValue - allocatedValue)
      : roundCurrency(totalRedeemedValue * (allocation.points / selectedPoints));
    allocatedValue = roundCurrency(allocatedValue + allocation.value);
  });

  return {
    redeemedPoints: selectedPoints,
    redeemedValue: roundCurrency(totalRedeemedValue),
    allocations,
  };
}

function distributePartnerRedeemedValue(partnerName, totalRedeemedValue, scope = "all", pointsToRedeem = null, options = {}) {
  if (!partnerName || totalRedeemedValue < 0 || scope === "redeemed") {
    return { redeemedPoints: 0, redeemedValue: 0, allocations: [] };
  }

  const normalizedPartnerName = normalizePprPartnerName(partnerName);
  const cardSources = getPprCardContributionSources(partnerName)
    .filter((source) => source.remainingPoints > 0);

  // Keep every contribution from the first card together before moving to
  // the next card. The first appearance of a card establishes Card A, Card B,
  // and so on; manual points are always consumed after every card source.
  const cardBuckets = new Map();
  cardSources.forEach((source) => {
    const cardKey = String(source.spend.originatingCardId || source.spend.id || "");
    const bucket = cardBuckets.get(cardKey) || [];
    bucket.push(source);
    cardBuckets.set(cardKey, bucket);
  });

  const contributions = [];
  cardBuckets.forEach((sources) => {
    sources.forEach((source) => {
      contributions.push({
        type: "card",
        spend: source.spend,
        sourcePoints: source.sourcePoints,
        points: source.remainingPoints,
      });
    });
  });

  getPprManualPointEntries()
    .filter((entry) => normalizePprPartnerName(entry.partnerName) === normalizedPartnerName)
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
    .forEach((entry) => {
      const availablePoints = Math.max(0, toNumber(entry.points) - toNumber(entry.redeemedPoints));
      if (availablePoints > 0) {
        contributions.push({ type: "manual", entry, points: availablePoints });
      }
    });

  const totalAvailablePoints = contributions.reduce((sum, contribution) => sum + contribution.points, 0);
  const requestedPoints = pointsToRedeem == null ? totalAvailablePoints : toNumber(pointsToRedeem);
  const plan = planPprRedemptionAllocations(contributions, requestedPoints, totalRedeemedValue);
  if (plan.redeemedPoints <= 0) {
    return { redeemedPoints: 0, redeemedValue: 0, allocations: [] };
  }

  // PPR redemptions are also card-point redemptions for card-originated
  // contributions. Validate the exact, ratio-adjusted debit before changing
  // any partner or card-ledger records. Visibility/eye state does not affect
  // this calculation: hidden cards retain the same point balance rules.
  const pendingDebitsByCard = new Map();
  plan.allocations.forEach((allocation) => {
    if (allocation.type !== "card") return;
    const cardId = getRpSpendRedeemedSourceCardId(allocation.spend);
    if (!cardId || !getCardById(cardId)) return;
    const currentCardDebit = getRpSpendRedemptionAmount(allocation.spend);
    const nextPartnerRedeemedPoints = Math.min(
      getPartnerProgramPoints(allocation.spend),
      toNumber(allocation.spend.partnerRedeemedPoints) + allocation.points
    );
    const nextPprCardDebit = getPartnerProgramCardDebitPoints(
      allocation.spend,
      nextPartnerRedeemedPoints
    );
    // RP Spends may already have consumed the full source-card transfer. A
    // later PPR redemption consumes that partner balance but must not debit the
    // same card points again. Legacy unconsumed transfers still add only their
    // genuinely incremental PPR debit.
    const incrementalDebit = Math.max(0, nextPprCardDebit - currentCardDebit);
    if (incrementalDebit <= 0) return;
    pendingDebitsByCard.set(cardId, (pendingDebitsByCard.get(cardId) || 0) + incrementalDebit);
  });

  for (const [cardId, debitPoints] of pendingDebitsByCard) {
    const card = getCardById(cardId);
    const availablePoints = getCardUnredeemedPoints(card);
    if (debitPoints > availablePoints) {
      return {
        redeemedPoints: 0,
        redeemedValue: 0,
        allocations: [],
        error: `Only ${formatPoints(availablePoints)} can be redeemed from ${formatCardShortName(card)}.`,
      };
    }
  }

  const roundCurrency = (amount) => Math.round((toNumber(amount) + Number.EPSILON) * 100) / 100;
  const redemptionId = String(options.redemptionId || createId());
  const redeemedAt = options.createdAt || new Date().toISOString();
  const savedAllocations = [];

  plan.allocations.forEach((allocation, index) => {
    const value = allocation.value;
    const historyEntry = normalizePprRedemptionAllocation({
      id: `${redemptionId}-${index + 1}`,
      redemptionId,
      points: allocation.points,
      value,
      createdAt: redeemedAt,
    });

    if (allocation.type === "card") {
      allocation.spend.partnerRedeemedPoints = Math.min(
        allocation.sourcePoints,
        toNumber(allocation.spend.partnerRedeemedPoints) + allocation.points
      );
      allocation.spend.pointsValue = roundCurrency(toNumber(allocation.spend.pointsValue) + value);
      allocation.spend.pprRedemptions = [
        ...(Array.isArray(allocation.spend.pprRedemptions) ? allocation.spend.pprRedemptions : []),
        historyEntry,
      ];
      savedAllocations.push({ type: "card", spendId: allocation.spend.id, ...historyEntry });
      return;
    }

    state.pprManualPoints = (state.pprManualPoints || []).map((entry) => {
      if (entry.id !== allocation.entry.id) return entry;
      return {
        ...entry,
        redeemedPoints: Math.min(
          toNumber(entry.points),
          toNumber(entry.redeemedPoints) + allocation.points
        ),
        redeemedValue: roundCurrency(toNumber(entry.redeemedValue) + value),
        redemptions: [
          ...(Array.isArray(entry.redemptions) ? entry.redemptions : []),
          historyEntry,
        ],
      };
    });
    savedAllocations.push({ type: "manual", entryId: allocation.entry.id, ...historyEntry });
  });

  return {
    redeemedPoints: plan.redeemedPoints,
    redeemedValue: plan.redeemedValue,
    allocations: savedAllocations,
  };
}

function updatePartnerRedeemedValue(partnerName, totalRedeemedValue) {
  const normalizedPartnerName = normalizePprPartnerName(partnerName);
  const nextRedeemedValue = toNumber(totalRedeemedValue);

  // In PPR, a redemption is only retained when it has a monetary value.
  // Setting the value to zero reverses the partner-point redemption and puts
  // the points back into Unredeemed. The originating card balance restores at
  // the same time because its partial debit is derived from this PPR ledger.
  if (nextRedeemedValue <= 0) {
    let restoredPoints = 0;

    getPprCardContributionSources(partnerName).forEach((source) => {
      restoredPoints += source.redeemedPoints;
      source.spend.partnerRedeemedPoints = 0;
      source.spend.pointsValue = 0;
      source.spend.pprRedemptions = [];
    });

    state.pprManualPoints = (state.pprManualPoints || []).map((entry) => {
      if (normalizePprPartnerName(entry.partnerName) !== normalizedPartnerName) return entry;
      restoredPoints += Math.min(toNumber(entry.points), toNumber(entry.redeemedPoints));
      return {
        ...entry,
        redeemedPoints: 0,
        redeemedValue: 0,
        redemptions: [],
      };
    });

    return {
      redeemedPoints: restoredPoints,
      redeemedValue: 0,
      allocations: [],
      restored: true,
    };
  }

  const cardSources = getPprCardContributionSources(partnerName)
    .filter((source) => source.redeemedPoints > 0)
    .map((source) => ({
      type: "card",
      spend: source.spend,
      points: source.redeemedPoints,
    }));
  const manualSources = getPprManualPointEntries()
    .filter((entry) => normalizePprPartnerName(entry.partnerName) === normalizePprPartnerName(partnerName))
    .map((entry) => ({
      type: "manual",
      entry,
      points: Math.min(toNumber(entry.points), toNumber(entry.redeemedPoints)),
    }))
    .filter((source) => source.points > 0);
  const plan = planPprRedemptionAllocations(
    [...cardSources, ...manualSources],
    [...cardSources, ...manualSources].reduce((sum, source) => sum + source.points, 0),
    nextRedeemedValue
  );
  if (!plan.redeemedPoints) return plan;

  const roundCurrency = (amount) => Math.round((toNumber(amount) + Number.EPSILON) * 100) / 100;
  const redistributeHistory = (history, value) => {
    const entries = Array.isArray(history) ? history.map(normalizePprRedemptionAllocation) : [];
    const totalPoints = entries.reduce((sum, entry) => sum + entry.points, 0);
    if (totalPoints <= 0) return entries;
    let allocated = 0;
    return entries.map((entry, index) => {
      const nextValue = index === entries.length - 1
        ? roundCurrency(value - allocated)
        : roundCurrency(value * (entry.points / totalPoints));
      allocated = roundCurrency(allocated + nextValue);
      return { ...entry, value: nextValue };
    });
  };

  plan.allocations.forEach((allocation) => {
    if (allocation.type === "card") {
      allocation.spend.pointsValue = allocation.value;
      allocation.spend.pprRedemptions = redistributeHistory(allocation.spend.pprRedemptions, allocation.value);
      return;
    }
    state.pprManualPoints = (state.pprManualPoints || []).map((entry) => entry.id === allocation.entry.id
      ? {
        ...entry,
        redeemedValue: allocation.value,
        redemptions: redistributeHistory(entry.redemptions, allocation.value),
      }
      : entry);
  });

  return plan;
}

function updatePprRedemptionBatch(partnerName, redemptionId, nextPoints, nextValue) {
  const currentBatch = getPprRedemptionBatch(partnerName, redemptionId);
  if (!currentBatch) {
    return { redeemedPoints: 0, redeemedValue: 0, allocations: [], error: "That PPR redemption could not be found." };
  }

  const requestedPoints = toNumber(nextPoints);
  const requestedValue = toNumber(nextValue);
  const rpSpendsSnapshot = JSON.parse(JSON.stringify(state.rpSpends));
  const manualPointsSnapshot = JSON.parse(JSON.stringify(state.pprManualPoints || []));
  const restored = restorePprRedemptionBatch(partnerName, redemptionId);
  if (restored.error) return restored;

  // A zero point count or value means this batch is no longer redeemed. This
  // reverses only the selected PPR batch and does not touch RP Spends rows.
  if (requestedPoints <= 0 || requestedValue <= 0) {
    return restored;
  }

  const result = distributePartnerRedeemedValue(
    partnerName,
    requestedValue,
    "unredeemed",
    requestedPoints,
    { redemptionId, createdAt: currentBatch.createdAt }
  );
  if (result.error || result.redeemedPoints !== requestedPoints) {
    state.rpSpends = rpSpendsSnapshot;
    state.pprManualPoints = manualPointsSnapshot;
    return {
      redeemedPoints: 0,
      redeemedValue: 0,
      allocations: [],
      error: result.error || `Only ${formatPoints(result.redeemedPoints)} could be allocated. No changes were saved.`,
    };
  }

  return { ...result, updated: true };
}

let pprValueModalPartnerName = null;
let pprValueModalScope = "all";
let pprValueModalAvailablePoints = 0;
let pprValueModalAction = "edit";

function getPprPartnerUnredeemedPoints(partnerName) {
  const row = getPprSummary().unredeemedRows
    .find((item) => normalizePprPartnerName(item.partnerName) === normalizePprPartnerName(partnerName));
  return toNumber(row?.points);
}

function formatPprBatchOption(batch, index) {
  const dateLabel = batch.createdAt ? formatDateTime(batch.createdAt) : `Redemption ${index + 1}`;
  const sourceLabels = [...new Set(batch.allocations.map((allocation) => allocation.sourceLabel).filter(Boolean))];
  const sourceLabel = sourceLabels.length ? sourceLabels.join(", ") : "PPR redemption";
  return `${sourceLabel} | ${dateLabel} | ${formatPoints(batch.points)} | ${formatMoney(batch.value)}`;
}

function renderPprRedemptionPreview(batch) {
  if (!els.pprRedemptionPreview) return;
  if (!batch) {
    els.pprRedemptionPreview.style.display = "none";
    els.pprRedemptionPreview.innerHTML = "";
    return;
  }

  els.pprRedemptionPreview.style.display = "block";
  els.pprRedemptionPreview.innerHTML = `
    <strong>${pprValueModalAction === "delete" ? "Points that will be restored" : "Allocated sources"}</strong>
    <div class="ppr-redemption-preview-list">
      ${batch.allocations.map((allocation) => `
        <div class="ppr-redemption-preview-row">
          <span>${escapeHtml(allocation.sourceLabel)}</span>
          <span>${escapeHtml(formatPoints(allocation.points))}${allocation.type === "card" && allocation.cardDebitPoints !== allocation.points ? ` <small>(${escapeHtml(formatPoints(allocation.cardDebitPoints))} card points)</small>` : ""}</span>
        </div>
      `).join("")}
    </div>
    <p>Only this PPR redemption is changed. RP Spends hotel and product redemptions remain untouched.</p>
  `;
}

function updatePprRedemptionModalSelection() {
  if (pprValueModalScope !== "redeemed") return;
  const redemptionId = els.pprRedemptionBatchSelect?.value || "";
  const batch = getPprRedemptionBatch(pprValueModalPartnerName, redemptionId);
  if (!batch) return;

  pprValueModalAvailablePoints = batch.points + getPprPartnerUnredeemedPoints(pprValueModalPartnerName);
  if (els.pprRedeemPointsInput) {
    els.pprRedeemPointsInput.value = String(batch.points);
    els.pprRedeemPointsInput.max = String(pprValueModalAvailablePoints);
  }
  if (els.pprValueInput) els.pprValueInput.value = String(batch.value);
  renderPprRedemptionPreview(batch);
}

function showPprValueModal(partnerName, currentValue = 0, scope = "all", availablePoints = 0, action = "edit") {
  pprValueModalPartnerName = partnerName;
  pprValueModalScope = scope;
  pprValueModalAvailablePoints = toNumber(availablePoints);
  pprValueModalAction = action;

  const isRedeemedBatchAction = scope === "redeemed";
  const batches = isRedeemedBatchAction ? getPprRedemptionBatches(partnerName) : [];
  if (isRedeemedBatchAction && !batches.length) {
    showToast(`No PPR-created redemption is available for ${partnerName}. Edit RP Spends redemptions in Reward Points.`);
    pprValueModalPartnerName = null;
    return;
  }

  if (els.pprValueModalTitle) {
    els.pprValueModalTitle.textContent = isRedeemedBatchAction
      ? action === "delete" ? "Delete PPR Redemption" : "Edit PPR Redemption"
      : "Enter Redeemed Value";
  }
  if (els.pprValueModalPartner) {
    els.pprValueModalPartner.textContent = `Partner: ${partnerName}`;
  }

  if (els.pprRedemptionBatchField) {
    els.pprRedemptionBatchField.style.display = isRedeemedBatchAction ? "block" : "none";
  }
  if (els.pprRedemptionBatchSelect) {
    els.pprRedemptionBatchSelect.innerHTML = batches.map((batch, index) => (
      `<option value="${escapeAttribute(batch.id)}">${escapeHtml(formatPprBatchOption(batch, index))}</option>`
    )).join("");
  }

  const showInputs = !isRedeemedBatchAction || action !== "delete";
  if (els.pprRedeemPointsInput) {
    els.pprRedeemPointsInput.closest(".field")?.style.setProperty("display", showInputs ? "block" : "none");
    els.pprRedeemPointsInput.value = isRedeemedBatchAction ? "" : "";
    els.pprRedeemPointsInput.max = String(pprValueModalAvailablePoints);
  }
  if (els.pprValueInput) {
    els.pprValueInput.closest(".field")?.style.setProperty("display", showInputs ? "block" : "none");
    els.pprValueInput.value = currentValue > 0 ? currentValue : "";
  }
  if (els.pprValueModalDeleteBtn) {
    els.pprValueModalDeleteBtn.style.display = isRedeemedBatchAction && action === "delete" ? "inline-flex" : "none";
  }
  if (els.pprValueModalSaveBtn) {
    els.pprValueModalSaveBtn.style.display = action === "delete" ? "none" : "inline-flex";
    els.pprValueModalSaveBtn.textContent = isRedeemedBatchAction ? "Save changes" : "Save & Distribute";
  }

  if (isRedeemedBatchAction) {
    updatePprRedemptionModalSelection();
  } else {
    renderPprRedemptionPreview(null);
  }

  if (els.pprValueModal) els.pprValueModal.style.display = "flex";
  if (showInputs) {
    (isRedeemedBatchAction ? els.pprRedeemPointsInput : els.pprRedeemPointsInput)?.focus();
  } else {
    els.pprRedemptionBatchSelect?.focus();
  }
}

function closePprValueModal() {
  if (els.pprValueModal) els.pprValueModal.style.display = "none";
  pprValueModalPartnerName = null;
  pprValueModalScope = "all";
  pprValueModalAvailablePoints = 0;
  pprValueModalAction = "edit";
}

function savePprPartnerValue() {
  if (!pprValueModalPartnerName) return;

  const pointsToRedeem = toNumber(els.pprRedeemPointsInput?.value || 0);
  const value = toNumber(els.pprValueInput?.value || 0);

  if (pointsToRedeem > pprValueModalAvailablePoints) {
    showToast(`You can redeem up to ${formatPoints(pprValueModalAvailablePoints)}.`);
    els.pprRedeemPointsInput?.focus();
    return;
  }

  if (pprValueModalScope === "unredeemed" && pointsToRedeem <= 0) {
    showToast("Enter the points to redeem.");
    els.pprRedeemPointsInput?.focus();
    return;
  }
  if (pprValueModalScope === "unredeemed" && value <= 0) {
    showToast("Enter a monetary value to redeem points. The points remain unredeemed.");
    els.pprValueInput?.focus();
    return;
  }

  const redemptionId = els.pprRedemptionBatchSelect?.value || "";
  const result = pprValueModalScope === "redeemed"
    ? updatePprRedemptionBatch(pprValueModalPartnerName, redemptionId, pointsToRedeem, value)
    : distributePartnerRedeemedValue(
      pprValueModalPartnerName,
      value,
      pprValueModalScope,
      pointsToRedeem || null
    );
  if (result?.error) {
    showToast(result.error);
    return;
  }
  if (!result?.redeemedPoints) {
    showToast("No unredeemed partner points are available.");
    return;
  }

  const partnerName = pprValueModalPartnerName;
  const wasRedeemedEdit = pprValueModalScope === "redeemed";
  syncRpRedeemedBenefitsFromSpends();
  saveState();
  render();
  closePprValueModal();

  showToast(result.restored
    ? `${formatPoints(result.redeemedPoints)} restored to unredeemed for ${partnerName}.`
    : wasRedeemedEdit
      ? `Updated ${formatPoints(result.redeemedPoints)} for ${partnerName}.`
      : `Redeemed ${formatPoints(result.redeemedPoints)} from ${partnerName}. ${formatMoney(result.redeemedValue)} was allocated across the consumed sources.`);
}

function deleteSelectedPprRedemption() {
  if (!pprValueModalPartnerName || pprValueModalScope !== "redeemed") return;
  const redemptionId = els.pprRedemptionBatchSelect?.value || "";
  const batch = getPprRedemptionBatch(pprValueModalPartnerName, redemptionId);
  if (!batch) {
    showToast("Select a PPR redemption to delete.");
    return;
  }
  if (!window.confirm(`Delete this ${formatPoints(batch.points)} redemption and restore its points to the original sources?`)) return;

  const partnerName = pprValueModalPartnerName;
  const result = restorePprRedemptionBatch(partnerName, redemptionId);
  if (result.error) {
    showToast(result.error);
    return;
  }
  syncRpRedeemedBenefitsFromSpends();
  saveState();
  render();
  closePprValueModal();
  showToast(`${formatPoints(result.redeemedPoints)} restored to the original ${partnerName} sources.`);
}

function populatePprManualPartnerOptions(selectedPartnerName = "") {
  if (!els.pprManualPartnerSelect) return;

  const partnerNames = getPprExistingPartnerNames();
  const selected = String(selectedPartnerName || "").trim();
  els.pprManualPartnerSelect.innerHTML = partnerNames.length
    ? partnerNames.map((partnerName) => (
      `<option value="${escapeAttribute(partnerName)}"${partnerName === selected ? " selected" : ""}>${escapeHtml(partnerName)}</option>`
    )).join("")
    : '<option value="">No partners available</option>';

  if (selected && !partnerNames.includes(selected)) {
    els.pprManualPartnerSelect.insertAdjacentHTML(
      "afterbegin",
      `<option value="${escapeAttribute(selected)}" selected>${escapeHtml(selected)}</option>`
    );
  }
}

function openPprManualPointsModal(partnerName = "", entry = null) {
  const availablePartners = getPprExistingPartnerNames();
  if (!availablePartners.length && !partnerName) {
    showToast("Add a partner program first.");
    return;
  }

  const manualEntry = entry ? normalizePprManualPoint(entry) : null;
  pprManualEditingId = manualEntry?.id || "";
  populatePprManualPartnerOptions(manualEntry?.partnerName || partnerName || availablePartners[0] || "");
  if (els.pprManualModalTitle) els.pprManualModalTitle.textContent = manualEntry ? "Edit Partner Points" : "Add Partner Points";
  if (els.pprManualSaveBtn) els.pprManualSaveBtn.textContent = manualEntry ? "Save changes" : "Add points";
  if (els.pprManualPointsInput) els.pprManualPointsInput.value = manualEntry ? String(manualEntry.points) : "";
  if (els.pprManualValueInput) els.pprManualValueInput.value = manualEntry ? String(manualEntry.value) : "";
  if (els.pprManualNotesInput) els.pprManualNotesInput.value = manualEntry?.notes || "";
  if (els.pprManualDateInput) els.pprManualDateInput.value = manualEntry?.date || "";
  if (els.pprManualModal) els.pprManualModal.style.display = "flex";
  els.pprManualPointsInput?.focus();
}

function closePprManualPointsModal() {
  if (els.pprManualModal) els.pprManualModal.style.display = "none";
  pprManualEditingId = "";
}

function savePprManualPoints() {
  const isEditing = Boolean(pprManualEditingId);
  const partnerName = String(els.pprManualPartnerSelect?.value || "").trim();
  const points = toNumber(els.pprManualPointsInput?.value || 0);
  const existingEntry = isEditing
    ? (state.pprManualPoints || []).find((entry) => entry.id === pprManualEditingId)
    : null;
  const value = toNumber(els.pprManualValueInput?.value || 0);
  const notes = String(els.pprManualNotesInput?.value || "").trim();
  const date = String(els.pprManualDateInput?.value || "").trim();

  if (!partnerName) {
    showToast("Select a partner first.");
    els.pprManualPartnerSelect?.focus();
    return;
  }

  if (points < 0) {
    showToast("Points cannot be negative.");
    return;
  }

  if (value < 0) {
    showToast("Monetary value cannot be negative.");
    return;
  }

  const alreadyRedeemedPoints = toNumber(existingEntry?.redeemedPoints);
  if (isEditing && points < alreadyRedeemedPoints) {
    showToast(`Points cannot be lower than the already redeemed ${formatPoints(alreadyRedeemedPoints)}.`);
    els.pprManualPointsInput?.focus();
    return;
  }

  const updatedEntry = normalizePprManualPoint({
    id: pprManualEditingId || createId(),
    partnerName,
    points,
    value,
    redeemedPoints: alreadyRedeemedPoints,
    redeemedValue: toNumber(existingEntry?.redeemedValue),
    redemptions: Array.isArray(existingEntry?.redemptions) ? existingEntry.redemptions : [],
    notes,
    date,
    createdAt: pprManualEditingId
      ? (state.pprManualPoints || []).find((entry) => entry.id === pprManualEditingId)?.createdAt
      : new Date().toISOString(),
  });
  state.pprManualPoints = pprManualEditingId
    ? (state.pprManualPoints || []).map((entry) => entry.id === pprManualEditingId ? updatedEntry : entry)
    : [
      ...(state.pprManualPoints || []),
      updatedEntry,
    ];

  saveState();
  closePprManualPointsModal();
  render();
  showToast(isEditing ? "Partner points updated." : "Partner points added.");
}

function renderPprWidget() {
  const summary = getPprSummary();

  const pprRenderPrograms = document.getElementById("pprRenderPrograms");
  const pprRenderRedeemed = document.getElementById("pprRenderRedeemed");
  const pprRenderUnredeemed = document.getElementById("pprRenderUnredeemed");
  const redeemedPartnerPoints = summary.redeemedRows.reduce((sum, row) => sum + toNumber(row.points), 0);
  const unredeemedPartnerPoints = summary.unredeemedRows.reduce((sum, row) => sum + toNumber(row.points), 0);
  if (pprRenderPrograms) pprRenderPrograms.textContent = String(summary.partnerCount);
  if (pprRenderRedeemed) pprRenderRedeemed.textContent = formatPoints(redeemedPartnerPoints);
  if (pprRenderUnredeemed) pprRenderUnredeemed.textContent = formatPoints(unredeemedPartnerPoints);

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

  const renderPprTable = ({ rows, title, pointsHeader, valueHeader, statusLabel, statusColor, scope, emptyText }) => {
    const tableRows = rows.length
      ? rows.map((row) => {
        const distributableValue = scope === "unredeemed"
          ? toNumber(row.cardUnredeemedValue)
          : scope === "redeemed"
            ? toNumber(row.cardRedeemedValue) + toNumber(row.manualRedeemedValue)
            : toNumber(row.value);
        const addManualButton = scope === "unredeemed"
          ? `
              <button class="icon-button subtle ppr-add-manual-points" data-partner-name="${escapeAttribute(row.partnerName)}" title="Add manual partner points" aria-label="Add manual partner points" style="padding: 4px;">
                <svg viewBox="0 0 24 24" width="14">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            `
          : "";
        const deleteRedemptionButton = scope === "redeemed"
          ? `
              <button class="icon-button subtle ppr-delete-redemption" data-partner-name="${escapeAttribute(row.partnerName)}" data-ppr-scope="redeemed" title="Delete a PPR redemption" aria-label="Delete a PPR redemption" style="padding:4px;">
                <svg viewBox="0 0 24 24" width="14"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></svg>
              </button>
            `
          : "";
        return `
        <article class="card-row ppr-partner-row" data-partner-name="${escapeAttribute(row.partnerName)}" data-ppr-scope="${escapeAttribute(scope)}" tabindex="0" role="button" aria-label="View details for ${escapeAttribute(row.partnerName)}" style="padding: 10px 12px; gap: 0; align-items: center; margin: 0;">
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
          <div class="money-cell" style="min-width: 82px; padding: 0 6px; justify-content: center;">
            <div class="row-actions inline-actions" style="gap: 4px;">
              <button class="icon-button subtle ppr-edit-value" data-partner-name="${escapeAttribute(row.partnerName)}" data-current-value="${distributableValue}" data-ppr-points="${escapeAttribute(row.points)}" data-ppr-scope="${scope}" title="Enter redeemed value" aria-label="Enter redeemed value" style="padding: 4px;">
                <span class="ppr-rupee-icon" aria-hidden="true">₹</span>
              </button>
              ${deleteRedemptionButton}
              ${addManualButton}
            </div>
          </div>
        </article>
      `;
      }).join("")
      : `<div class="ppr-table-empty">${escapeHtml(emptyText)}</div>`;

    return `
      <section class="ppr-summary-table-panel" aria-label="${escapeAttribute(title)}">
        <div class="ppr-summary-table-title">${escapeHtml(title)}</div>
        <div class="cards-table ppr-table">
          <div class="table-head" style="padding: 10px 12px; gap: 0; margin: 0; margin-bottom: 0;">
            <span style="flex: 1; padding: 0 6px;">PARTNER DETAILS</span>
            <span style="min-width: 112px; padding: 0 6px; text-align: center;">${escapeHtml(pointsHeader)}</span>
            <span style="min-width: 112px; padding: 0 6px; text-align: center;">${escapeHtml(valueHeader)}</span>
            <span style="min-width: 84px; padding: 0 6px; text-align: center;">STATUS</span>
            <span style="min-width: 82px; padding: 0 6px; text-align: center;"></span>
          </div>
          ${tableRows}
        </div>
      </section>
    `;
  };

  els.pprWidgetList.innerHTML = `
    <div class="ppr-summary-tables-grid">
      ${renderPprTable({
        rows: summary.redeemedRows,
        title: "Redeemed Partner Points",
        pointsHeader: "REDEEMED POINTS",
        valueHeader: "REDEEMED VALUE",
        statusLabel: "Redeemed",
        statusColor: "#10b981",
        scope: "redeemed",
        emptyText: "No redeemed partner points yet.",
      })}
      ${renderPprTable({
        rows: summary.unredeemedRows,
        title: "Unredeemed Partner Points",
        pointsHeader: "UNREDEEMED POINTS",
        valueHeader: "UNREDEEMED VALUE",
        statusLabel: "Unredeemed",
        statusColor: "#f59e0b",
        scope: "unredeemed",
        emptyText: "No unredeemed partner points.",
      })}
    </div>
  `;
}

function closePprDetailsModal() {
  if (els.pprDetailsModal) els.pprDetailsModal.style.display = "none";
}

function getPprPartnerDetailGroups(partnerName, scope = "all") {
  const displayPartnerName = String(partnerName || "").trim();
  if (!displayPartnerName) return [];

  const groups = new Map();
  getPprCardContributionSources(displayPartnerName).forEach((source) => {
    const displayPoints = scope === "redeemed"
      ? source.redeemedPoints
      : scope === "unredeemed"
        ? source.remainingPoints
        : source.sourcePoints;
    if (displayPoints <= 0) return;

    const displayValue = scope === "unredeemed" ? 0 : toNumber(source.spend.pointsValue);
    const existing = groups.get(source.purchaseId) || {
      purchaseId: source.purchaseId,
      productName: source.spend.productName || "Reward spend",
      purchasedFrom: source.spend.purchasedFrom || source.partnerName || displayPartnerName,
      latestDate: source.createdAt || "",
      points: 0,
      value: 0,
      items: [],
    };
    existing.points += displayPoints;
    existing.value += displayValue;
    existing.items.push({
      ...source.spend,
      pprDisplayPoints: displayPoints,
      pprDisplayValue: displayValue,
    });
    if (new Date(source.createdAt || 0) > new Date(existing.latestDate || 0)) {
      existing.latestDate = source.createdAt || existing.latestDate;
    }
    groups.set(source.purchaseId, existing);
  });

  const manualGroups = getPprManualPointEntries()
    .filter((entry) => normalizePprPartnerName(entry.partnerName) === normalizePprPartnerName(displayPartnerName))
    .map((entry) => {
      const entryPoints = toNumber(entry.points);
      const redeemedPoints = Math.min(entryPoints, toNumber(entry.redeemedPoints));
      const remainingPoints = Math.max(0, entryPoints - redeemedPoints);
      const points = scope === "redeemed"
        ? redeemedPoints
        : scope === "unredeemed"
          ? remainingPoints
          : entryPoints;
      if (points <= 0) return null;

      const remainingValue = entryPoints > 0
        ? toNumber(entry.value) * (remainingPoints / entryPoints)
        : toNumber(entry.value);
      const value = scope === "redeemed"
        ? toNumber(entry.redeemedValue)
        : scope === "unredeemed"
          ? remainingValue
          : remainingValue + toNumber(entry.redeemedValue);
      return {
        purchaseId: `manual-${entry.id}`,
        productName: "Manual partner points",
        purchasedFrom: displayPartnerName,
        latestDate: entry.createdAt || "",
        points,
        value,
        isManual: true,
        allowManualActions: true,
        manualEntry: entry,
        items: [],
      };
    })
    .filter(Boolean);

  return [...Array.from(groups.values()), ...manualGroups]
    .sort((a, b) => new Date(b.latestDate || 0) - new Date(a.latestDate || 0));
}

function handlePprWidgetAction(event) {
  const addManualButton = event.target.closest(".ppr-add-manual-points");
  if (addManualButton) {
    event.stopPropagation();
    openPprManualPointsModal(addManualButton.dataset.partnerName || "");
    return;
  }

  const deleteRedemptionButton = event.target.closest(".ppr-delete-redemption");
  if (deleteRedemptionButton) {
    event.stopPropagation();
    showPprValueModal(
      deleteRedemptionButton.dataset.partnerName || "",
      0,
      "redeemed",
      0,
      "delete"
    );
    return;
  }

  const editButton = event.target.closest(".ppr-edit-value");
  if (editButton) {
    event.stopPropagation();
    const partnerName = editButton.dataset.partnerName || "";
    const currentValue = toNumber(editButton.dataset.currentValue);
    const scope = editButton.dataset.pprScope || "all";
    const availablePoints = toNumber(editButton.dataset.pprPoints);
    showPprValueModal(partnerName, currentValue, scope, availablePoints);
    return;
  }

  const row = event.target.closest(".ppr-partner-row");
  if (!row) return;

  showPprPartnerDetails(row.dataset.partnerName || row.textContent || "Partner", row.dataset.pprScope || "all");
}

function showPprPartnerDetails(partnerName, scope = "all") {
  const detailGroups = getPprPartnerDetailGroups(partnerName, scope);
  const getDetailGroupPoints = (group) => toNumber(group.points);
  const getDetailGroupValue = (group) => toNumber(group.value);
  const totalPoints = detailGroups.reduce((sum, group) => sum + getDetailGroupPoints(group), 0);
  const totalValue = detailGroups.reduce((sum, group) => sum + getDetailGroupValue(group), 0);
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
    const scopeLabel = scope === "redeemed" ? "redeemed" : scope === "unredeemed" ? "unredeemed" : "recorded";
    els.pprDetailsModalSubtitle.textContent = `${totalEntries} ${totalEntries === 1 ? "entry" : "entries"} | ${formatPoints(totalPoints)} ${scopeLabel} | ${formatMoney(totalValue)}`;
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
        const groupPoints = getDetailGroupPoints(group);
        const groupValue = getDetailGroupValue(group);
        const groupCardLabels = group.isManual ? ["Manual entry"] : getGroupCardLabels(group);
        const manualDate = group.isManual && group.manualEntry?.date
          ? `<div class="ppr-detail-meta">${escapeHtml(formatDateTime(group.manualEntry.date))}</div>`
          : "";
        const manualNotes = group.isManual && group.manualEntry?.notes
          ? `<div class="ppr-detail-meta">${escapeHtml(group.manualEntry.notes)}</div>`
          : "";
        return `
          <article class="ppr-detail-card">
            <div class="ppr-detail-card-head">
              <div>
                <strong>${escapeHtml(group.productName || "Reward spend")}</strong>
                <div class="ppr-detail-meta">${group.isManual ? "Partner-specific points" : `Contributed by: ${escapeHtml(groupCardLabels.join(", "))}`}</div>
                ${manualDate}
                ${manualNotes}
              </div>
              <div class="ppr-detail-actions">
                <div class="ppr-detail-badges">
                <span>${escapeHtml(formatPoints(groupPoints))}</span>
                <span>${escapeHtml(formatMoney(groupValue))}</span>
                </div>
                ${group.isManual && group.allowManualActions ? `<div class="ppr-detail-manual-actions">
                  <button type="button" class="ghost-button" data-ppr-edit-manual="${escapeAttribute(group.manualEntry.id)}">Edit</button>
                  <button type="button" class="icon-button subtle" data-ppr-delete-manual="${escapeAttribute(group.manualEntry.id)}" title="Delete manual partner points" aria-label="Delete manual partner points">
                    <svg viewBox="0 0 24 24" width="14"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></svg>
                  </button>
                </div>` : ""}
              </div>
            </div>
            ${group.isManual ? "" : `<div class="ppr-detail-items">
              ${group.items.map((item) => `
                <div class="ppr-detail-item">
                  <div>
                    <strong>${escapeHtml(item.productName || "Reward spend")}</strong>
                    <div class="ppr-detail-meta">${escapeHtml(getContributingCardLabel(item))}</div>
                    <div class="ppr-detail-meta">
                      ${escapeHtml(formatPoints(item.pprDisplayPoints))} | ${escapeHtml(formatMoney(item.pprDisplayValue))} redeemed value
                    </div>
                  </div>
                  <button type="button" class="ghost-button" data-ppr-open-rp="${escapeAttribute(item.id)}">Open RP spend</button>
                </div>
              `).join("")}
            </div>`}
          </article>
        `;
      }).join("");
    }
  }

  if (els.pprDetailsModal) els.pprDetailsModal.style.display = "flex";
}

function handlePprDetailsAction(event) {
  const deleteManualButton = event.target.closest("[data-ppr-delete-manual]");
  if (deleteManualButton) {
    const entryId = deleteManualButton.dataset.pprDeleteManual;
    const entry = getPprManualPointEntries().find((item) => item.id === entryId);
    if (!entry || !window.confirm(`Delete manual partner points for ${entry.partnerName}?`)) return;

    state.pprManualPoints = (state.pprManualPoints || []).filter((item) => item.id !== entryId);
    saveState();
    closePprDetailsModal();
    render();
    showToast("Manual partner points deleted.");
    return;
  }

  const editManualButton = event.target.closest("[data-ppr-edit-manual]");
  if (editManualButton) {
    const entry = getPprManualPointEntries().find((item) => item.id === editManualButton.dataset.pprEditManual);
    if (entry) {
      closePprDetailsModal();
      openPprManualPointsModal(entry.partnerName, entry);
    }
    return;
  }

  const button = event.target.closest("[data-ppr-open-rp]");
  if (!button) return;

  const rpSpend = state.rpSpends.find((item) => item.id === button.dataset.pprOpenRp);
  if (!rpSpend) return;

  closePprDetailsModal();
  showView("rpSpends");
  populateRpSpendForm(rpSpend);
  scrollToPageTop();
}

function getViewTitle(view) {
  switch (normalizeViewName(view)) {
    case "portfolio":
      return "Card Portfolio";
    case "swipes":
      return "Swipes";
    case "rpSpends":
      return "Reward Points";
    case "ppr":
      return "Partner Program Rewards";
    case "lounge":
      return "Airport Lounge / Other Benefits";
    case "intlTravel":
      return "International Travel Expenses";
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
  const cache = getRenderCacheMap("cardsById");
  if (cache && cardId && cache.has(cardId)) return cache.get(cardId);

  const card = state.cards.find((item) => item.id === cardId);
  if (cache && cardId) cache.set(cardId, card);
  return card;
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
    pointsAmount: 0,
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

  if (parts.length) return parts.join(" | ");
  return card.isLtf ? "LTF" : "No fee recorded";
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

function formatMixedValueHtml(cash, points, pointsFirst = false) {
  if (cash > 0 && points > 0) {
    return pointsFirst
      ? `<strong>${escapeHtml(formatPoints(points))}</strong><span class="value-subline">${escapeHtml(formatMoney(cash))}</span>`
      : `<strong>${escapeHtml(formatMoney(cash))}</strong><span class="value-subline">${escapeHtml(formatPoints(points))}</span>`;
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
  const allocation = getCardPointAllocation(card);
  const hasWelcomePoints = card.benefits.some((benefit) => benefit?.type === welcomeBenefitPointsType);
  const visibleBenefits = card.benefits.filter((benefit) =>
    benefit?.type !== welcomeBenefitPointsType
    && !(benefit?.type === "Unredeemed Points" && isPointBenefit(benefit) && !isRpRedeemedAutoBenefit(benefit))
  );

  if (!visibleBenefits.length && !hasWelcomePoints) {
    return `<div class="benefit-breakdown muted-breakdown">No points or redemptions logged</div>`;
  }

  const welcomeLines = hasWelcomePoints ? `
    <span class="benefit-line benefit-line-derived">
      <span class="benefit-line-name" style="font-style: italic;">Welcome Benefits Remaining</span>
      <span class="benefit-line-meta" style="background: rgba(96, 165, 250, 0.12); padding: 2px 8px; border-radius: 12px; font-style: italic;">Welcome Benefit (Points) | Remaining</span>
      <span class="benefit-line-value">${formatMixedValueHtml(allocation.welcomeRemainingValue, allocation.welcomeRemainingPoints)}</span>
    </span>
    <span class="benefit-line benefit-line-derived${allocation.welcomeRedeemedPoints > 0 ? " benefit-line-redeemed" : ""}">
      <span class="benefit-line-name" style="font-style: italic;">Welcome Benefits Redeemed</span>
      <span class="benefit-line-meta" style="background: rgba(16, 185, 129, 0.12); padding: 2px 8px; border-radius: 12px; font-style: italic;">Welcome Benefit (Points) | Redeemed</span>
      <span class="benefit-line-value">${formatMixedValueHtml(allocation.welcomeRedeemedValue, allocation.welcomeRedeemedPoints, true)}</span>
    </span>
  ` : "";

  return `
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
