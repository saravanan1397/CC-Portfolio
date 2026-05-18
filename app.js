const storageKey = "credit-card-portfolio-v1";

const benefitTypes = [
  "Welcome Benefit",
  "Points Redeemed",
  "Unredeemed Points",
  "Cashback / Statement Credit",
  "Milestone / Voucher",
  "Lounge Access",
  "Golf Lessons",
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
  search: "",
  statusFilter: "all",
  sort: "netAsc",
};

let draftBenefits = [];
let toastTimer = null;

const els = {};

document.addEventListener("DOMContentLoaded", async () => {
  
cacheElements();
await loadState();
bindEvents();
resetForm();
render();
});

function cacheElements() {
  Object.assign(els, {
    exportBtn: document.getElementById("exportBtn"),
    importBtn: document.getElementById("importBtn"),
    importFile: document.getElementById("importFile"),
    newCardBtn: document.getElementById("newCardBtn"),
    resetBtn: document.getElementById("resetBtn"),
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

    // 🔥 ADD THESE TWO LINES
    prevYearFee: document.getElementById("prevYearFee"),
    prevFeeContainer: document.getElementById("prevFeeContainer"),
  });
}

function bindEvents() {
  els.searchInput.addEventListener("input", () => {
    state.search = els.searchInput.value.trim().toLowerCase();
    renderCards();
  });

  els.statusFilter.addEventListener("change", () => {
    state.statusFilter = els.statusFilter.value;
    renderCards();
  });

  els.sortSelect.addEventListener("change", () => {
    state.sort = els.sortSelect.value;
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
  els.resetBtn.addEventListener("click", resetPortfolio);
  els.exportBtn.addEventListener("click", exportPortfolio);
  els.importBtn.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", importPortfolio);
  els.benefitRows.addEventListener("input", updateDraftBenefit);
  els.benefitRows.addEventListener("change", updateDraftBenefit);
  els.benefitRows.addEventListener("click", removeBenefitDraft);
  els.cardsTable.addEventListener("click", handleCardAction);
  els.memberSince.addEventListener("change", togglePreviousFeeField);
}

async function loadState() {
  try {
    const { doc, getDoc } = window.firebaseFns;

    const snap = await getDoc(doc(window.db, "portfolio", "userData"));

    if (snap.exists()) {
      const data = snap.data();

      state.currency = data.currency || "INR";
      state.cards = (data.cards || []).map(normalizeCard);

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
    memberSince: card.memberSince || "",
    prevYearFee: toNumber(card.prevYearFee || card.prevFee),
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

function togglePreviousFeeField() {
  const value = els.memberSince.value;

  console.log("Member since value:", value); // 🔍 debug

  if (!value) {
    els.prevFeeContainer.style.display = "none";
    return;
  }

  const selectedYear = parseInt(value.split("-")[0], 10);
  const currentYear = new Date().getFullYear();

  console.log("Selected:", selectedYear, "Current:", currentYear); // 🔍 debug

  if (selectedYear < currentYear) {
    els.prevFeeContainer.style.display = "block";
  } else {
    els.prevFeeContainer.style.display = "none";
    els.prevYearFee.value = "";
  }
}

function render() {
  renderSummary();
  renderBenefitsEditor();
  renderCards();
  renderCategories();
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
  els.netMetric.classList.toggle("profit", totals.net > 0);
  els.netMetric.classList.toggle("loss", totals.net < 0);
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
    const totals = getCardTotals(card);
    return totals.points > 0;
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
            <div style="font-weight:700; color:#f8fafc;">
              ${escapeHtml(card.name)}
            </div>

            <div style="
              font-size:13px;
              color:#94a3b8;
              margin-top:4px;
            ">
              ${escapeHtml(card.issuer || "")}
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
      const currentYearFee = toNumber(card.annualFee) + toNumber(card.taxFee);
      const prevFee = toNumber(card.prevYearFee);

      return `
        <div style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          padding:14px 0;
          border-bottom:1px solid #334155;
        ">
          <div>
            <div style="font-weight:700; color:#f8fafc;">
              ${escapeHtml(card.name)}
            </div>
            <div style="font-size:13px; color:#94a3b8; margin-top:4px;">
              ${escapeHtml(card.issuer || "")} ${prevFee > 0 ? `(Prev: ${formatMoney(prevFee)})` : ""}
            </div>
          </div>

          <div style="
            font-weight:700;
            color:#10b981;
            font-size:16px;
          ">
            ${escapeHtml(formatMoney(totals.fees))}
          </div>
        </div>
      `;
    }).join("");
  }
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
            <div style="font-weight:700; color:#f8fafc;">
              ${escapeHtml(card.name)}
            </div>
            <div style="font-size:13px; color:#94a3b8; margin-top:4px;">
              ${escapeHtml(card.issuer || "")}
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

  if (!state.cards.length) {
    els.cardsTable.appendChild(createEmptyState("No cards in portfolio", "Add your first card or load the example portfolio."));
    return;
  }

  if (!cards.length) {
    els.cardsTable.appendChild(createEmptyState("No matching cards", "Adjust search, status, or sort filters."));
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

  cards.forEach((card) => {
    const totals = getCardTotals(card);
    const status = getStatus(totals.net);
    
    const currentYearFee = toNumber(card.annualFee) + toNumber(card.taxFee);
    const feeBreakdown = card.prevYearFee > 0 
      ? `Current: ${formatMoney(currentYearFee)} | Prev: ${formatMoney(card.prevYearFee)}`
      : `Total: ${formatMoney(currentYearFee)}`;

    const meta = [
      card.issuer,
      card.memberSince && `Member since: ${card.memberSince} (${feeBreakdown})`,
    ]
      .filter(Boolean)
      .join(" | ");
    const row = document.createElement("article");
    row.className = "card-row";
    row.innerHTML = `
      <div class="card-name">
        <div style="display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;">
          <strong>${escapeHtml(card.name || "Untitled card")}</strong>
          <span class="card-meta" style="margin-top: 0;">${escapeHtml(meta || "Issuer not set")}</span>
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
        <strong>${formatMoney(totals.net)}</strong>
      </div>
      <span class="status-pill ${status.key}">${status.label}</span>
      <div class="row-actions">
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
  const gradientParts = [];

  const chartContainer = document.createElement("div");
  chartContainer.className = "benefits-pie-container";
  chartContainer.style.display = "flex";
  chartContainer.style.flexDirection = "column";
  chartContainer.style.alignItems = "center";
  chartContainer.style.gap = "24px";
  chartContainer.style.padding = "20px 0";

  const legendContainer = document.createElement("div");
  legendContainer.style.width = "100%";

  rows.forEach(([type, total], i) => {
    const color = colors[i % colors.length];
    const share = grandCashTotal ? (total.cash / grandCashTotal) * 100 : (1 / rows.length) * 100;
    
    gradientParts.push(`${color} ${currentPercent}% ${currentPercent + share}%`);
    currentPercent += share;

    const item = document.createElement("div");
    item.className = "category-row";
    item.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <i style="width:12px; height:12px; border-radius:2px; background:${color}; display:inline-block;"></i>
        <span>${escapeHtml(type)}</span>
      </div>
      <strong>${escapeHtml(formatMixedValue(total.cash, total.points))}</strong>
    `;
    legendContainer.appendChild(item);
  });

  const pie = document.createElement("div");
  pie.style.width = "220px";
  pie.style.height = "220px";
  pie.style.borderRadius = "50%";
  pie.style.position = "relative";
  pie.style.background = `conic-gradient(from 0deg, ${gradientParts.join(", ")})`;
  pie.style.boxShadow = "inset -10px -10px 20px rgba(0,0,0,0.3), 0 15px 25px rgba(0,0,0,0.4)";
  pie.style.transform = "rotateX(25deg)";
  pie.style.border = "1px solid rgba(255,255,255,0.1)";

  pie.addEventListener("mousemove", (e) => {
    const rect = pie.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;

    let cumulativePercent = 0;
    let found = false;

    rows.forEach(([type, total]) => {
      const share = grandCashTotal ? (total.cash / grandCashTotal) * 100 : (1 / rows.length) * 100;
      const startAngle = cumulativePercent * 3.6;
      const endAngle = (cumulativePercent + share) * 3.6;

      if (angle >= startAngle && angle < endAngle) {
        const valueText = formatMixedValue(total.cash, total.points);
        const shareText = share.toFixed(1);
        pie.title = `${type}: ${valueText} (${shareText}%)`;
        found = true;
      }
      cumulativePercent += share;
    });
    if (!found) pie.title = "";
  });

  chartContainer.appendChild(pie);
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

  const card = normalizeCard({
    id: els.editingId.value || createId(),
    name: els.cardName.value.trim(),
    issuer: els.issuerName.value.trim(),
    annualFee: els.annualFee.value,
    taxFee: els.taxFee.value,
    memberSince: els.memberSince.value.trim(),
    prevYearFee: els.prevYearFee.value,
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

  if (button.dataset.action === "duplicate") {
    const copy = normalizeCard({
      ...card,
      id: createId(),
      name: `${card.name} copy`,
      benefits: card.benefits.map((benefit) => ({ ...benefit, id: createId() })),
    });
    state.cards.push(copy);
    saveState();
    render();
    showToast("Card duplicated.");
    return;
  }

  if (button.dataset.action === "delete") {
    const confirmed = confirm(`Delete ${card.name}?`);
    if (!confirmed) return;
    state.cards = state.cards.filter((item) => item.id !== card.id);
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
  els.prevYearFee.value = card.prevYearFee || "";
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
  renderBenefitsEditor();
  togglePreviousFeeField();
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

function resetPortfolio() {
  if (!state.cards.length) {
    showToast("Portfolio is already empty.");
    return;
  }

  const confirmed = confirm("Reset the entire portfolio?");
  if (!confirmed) return;

  state.cards = [];
  saveState();
  resetForm();
  render();
  showToast("Portfolio reset.");
}

function exportPortfolio() {
  const payload = {
    exportedAt: new Date().toISOString(),
    currency: state.currency,
    cards: state.cards,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `credit-card-portfolio-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Portfolio exported.");
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
let fees = toNumber(card.annualFee) + toNumber(card.taxFee);

const memberYear = Number(card.memberSince?.split("-")[0]);
const currentYear = new Date().getFullYear();

if (memberYear && memberYear < currentYear) {
  fees += toNumber(card.prevYearFee);
}  const benefits = card.benefits.reduce((sum, benefit) => (isPointBenefit(benefit) ? sum : sum + toNumber(benefit.amount)), 0);
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

    const backBtn = document.getElementById("backBtn");
    if (backBtn) {
      backBtn.style.display = "block";
      backBtn.style.backgroundColor = "rgb(245, 158, 11)";
    }
    document.getElementById("lockScreen").style.display = "none";
    document.getElementById("app").style.display = "block";
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
    const backBtn = document.getElementById("backBtn");
    if (backBtn) {
      backBtn.style.display = "block";
      backBtn.style.backgroundColor = "rgb(245, 158, 11)";
    }
    document.getElementById("lockScreen").style.display = "none";
    document.getElementById("app").style.display = "block";
  }
});


function lockApp() {
  // clear session
  sessionStorage.removeItem("unlocked");

  // hide app
  document.getElementById("app").style.display = "none";
  if (document.getElementById("backBtn")) document.getElementById("backBtn").style.display = "none";

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
    btn.addEventListener("click", lockApp);
  }
});
