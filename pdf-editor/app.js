"use strict";

(() => {
  const elements = {
    addPdfButton: document.getElementById("addPdfButton"),
    canvas: document.getElementById("pdfCanvas"),
    canvasArea: document.getElementById("canvasArea"),
    chooseFileButton: document.getElementById("chooseFileButton"),
    deleteButton: document.getElementById("deleteButton"),
    dismissNotice: document.getElementById("dismissNotice"),
    downloadButton: document.getElementById("downloadButton"),
    emptyDocument: document.getElementById("emptyDocument"),
    eraseModeButton: document.getElementById("eraseModeButton"),
    editorHint: document.getElementById("editorHint"),
    fileInput: document.getElementById("fileInput"),
    fileName: document.getElementById("fileName"),
    loadingMessage: document.getElementById("loadingMessage"),
    loadingState: document.getElementById("loadingState"),
    nextButton: document.getElementById("nextButton"),
    notice: document.getElementById("notice"),
    pageCount: document.getElementById("pageCount"),
    pageList: document.getElementById("pageList"),
    pagePosition: document.getElementById("pagePosition"),
    pageStage: document.getElementById("pageStage"),
    previousButton: document.getElementById("previousButton"),
    reopenButton: document.getElementById("reopenButton"),
    rotateButton: document.getElementById("rotateButton"),
    selectionBox: document.getElementById("selectionBox"),
    sidebarEmpty: document.getElementById("sidebarEmpty"),
    textModeButton: document.getElementById("textModeButton"),
    textSize: document.getElementById("textSize"),
    annotationText: document.getElementById("annotationText"),
    unlockModeButton: document.getElementById("unlockModeButton"),
    zoomInButton: document.getElementById("zoomInButton"),
    zoomOutButton: document.getElementById("zoomOutButton"),
    zoomValue: document.getElementById("zoomValue"),
    unlockPanel: document.getElementById("unlockPanel"),
    unlockFileInput: document.getElementById("unlockFileInput"),
    unlockFileName: document.getElementById("unlockFileName"),
    unlockPassword: document.getElementById("unlockPassword"),
    unlockSubmit: document.getElementById("unlockSubmit"),
    unlockClose: document.getElementById("unlockClose"),
    toast: document.getElementById("toast"),
    welcomeCard: document.getElementById("welcomeCard"),
  };

  const state = {
    bytes: null,
    document: null,
    fileName: "",
    unlockFile: null,
    pages: [],
    currentPage: 0,
    viewport: null,
    openToken: 0,
    mode: null,
    dragPage: null,
    dragStart: null,
    toastTimer: null,
    renderToken: 0,
    zoom: 1.08,
  };

  if (!window.pdfjsLib || !window.PDFLib) {
    showError("The PDF tools could not load. Check your internet connection and reload this page.");
    return;
  }

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  elements.addPdfButton.addEventListener("click", openFilePicker);
  elements.chooseFileButton.addEventListener("click", openFilePicker);
  elements.reopenButton.addEventListener("click", openFilePicker);
  elements.fileInput.addEventListener("change", onFileSelected);
  elements.previousButton.addEventListener("click", () => selectPage(state.currentPage - 1));
  elements.nextButton.addEventListener("click", () => selectPage(state.currentPage + 1));
  elements.rotateButton.addEventListener("click", rotatePage);
  elements.deleteButton.addEventListener("click", deletePage);
  elements.downloadButton.addEventListener("click", downloadPdf);
  elements.textModeButton.addEventListener("click", () => setMode(state.mode === "text" ? null : "text"));
  elements.eraseModeButton.addEventListener("click", () => setMode(state.mode === "erase" ? null : "erase"));
  elements.dismissNotice.addEventListener("click", () => {
    elements.notice.hidden = true;
  });
  elements.unlockModeButton.addEventListener("click", () => {
    elements.unlockPanel.hidden = !elements.unlockPanel.hidden;
    if (!elements.unlockPanel.hidden) elements.unlockPassword.focus();
  });
  elements.unlockFileInput.addEventListener("change", onUnlockFileSelected);
  elements.unlockClose.addEventListener("click", () => {
    elements.unlockPanel.hidden = true;
    elements.unlockPassword.value = "";
  });
  elements.unlockPanel.addEventListener("submit", removePdfPassword);
  elements.zoomInButton.addEventListener("click", () => changeZoom(0.15));
  elements.zoomOutButton.addEventListener("click", () => changeZoom(-0.15));

  elements.canvas.addEventListener("pointerdown", onCanvasPointerDown);
  elements.canvas.addEventListener("pointermove", onCanvasPointerMove);
  elements.canvas.addEventListener("pointerup", onCanvasPointerUp);
  elements.canvas.addEventListener("pointercancel", clearSelection);
  elements.canvas.addEventListener("pointerleave", (event) => {
    if (state.mode === "erase" && state.dragStart && event.buttons === 0) clearSelection();
  });

  for (const eventName of ["dragenter", "dragover"]) {
    document.addEventListener(eventName, (event) => {
      event.preventDefault();
    });
  }
  document.addEventListener("drop", (event) => {
    event.preventDefault();
    const file = [...event.dataTransfer.files].find((item) => item.type === "application/pdf" || item.name.toLowerCase().endsWith(".pdf"));
    if (file) openFile(file);
    else if (event.dataTransfer.files.length) showError("Please drop a PDF file.");
  });

  window.addEventListener("resize", () => {
    if (state.pages.length) renderCurrentPage();
  });

  if (new URLSearchParams(window.location.search).get("tool") === "unlock") {
    elements.unlockPanel.hidden = false;
  }

  function openFilePicker() {
    elements.fileInput.click();
  }

  async function onFileSelected() {
    const [file] = elements.fileInput.files;
    elements.fileInput.value = "";
    if (file) await openFile(file);
  }

  async function openFile(file) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      showError("Please choose a PDF file.");
      return;
    }

    const openToken = ++state.openToken;
    setLoading(true, "Opening your PDF…");
    state.document = null;
    state.pages = [];
    state.currentPage = 0;
    state.bytes = null;
    state.fileName = file.name;
    state.unlockFile = file;
    elements.fileName.textContent = file.name;
    elements.unlockFileName.textContent = file.name;
    elements.unlockPassword.value = "";
    setMode(null);
    updateInterface();

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdf = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
      if (openToken !== state.openToken) return;
      state.bytes = bytes;
      state.document = pdf;
      state.pages = Array.from({ length: pdf.numPages }, (_, sourceIndex) => ({
        sourceIndex,
        rotation: 0,
        annotations: [],
      }));
      state.fileName = file.name;
      state.currentPage = 0;
      elements.fileName.textContent = file.name;
      elements.notice.hidden = false;
      updateInterface();
      await renderCurrentPage();
      renderThumbnails();
    } catch (error) {
      if (openToken !== state.openToken) return;
      state.document = null;
      state.bytes = null;
      state.pages = [];
      state.fileName = "";
      elements.fileName.textContent = "No document open";
      updateInterface();
      if (error?.name === "PasswordException") {
        elements.unlockPanel.hidden = false;
        elements.unlockFileName.textContent = file.name;
        state.unlockFile = file;
        showError("This PDF is password-protected. Use the password-removal tool with a password you know.");
        return;
      }
      showError(error && error.message ? `Could not open this PDF: ${error.message}` : "Could not open this PDF.");
    } finally {
      if (openToken === state.openToken) setLoading(false);
    }
  }

  async function renderCurrentPage() {
    const pageData = state.pages[state.currentPage];
    if (!pageData || !state.document) return;

    const renderToken = ++state.renderToken;
    try {
      const page = await state.document.getPage(pageData.sourceIndex + 1);
      if (renderToken !== state.renderToken || pageData !== state.pages[state.currentPage]) return;

      const availableWidth = Math.max(200, elements.canvasArea.clientWidth - 72);
      const availableHeight = Math.max(240, elements.canvasArea.clientHeight - 66);
      const rotation = normalizeRotation(page.rotate + pageData.rotation);
      const unitViewport = page.getViewport({ scale: 1, rotation });
      const fitScale = Math.min(1.65, availableWidth / unitViewport.width, availableHeight / unitViewport.height);
      const scale = fitScale * state.zoom;
      const viewport = page.getViewport({ scale, rotation });
      state.viewport = viewport;
      const canvas = elements.canvas;
      const context = canvas.getContext("2d", { alpha: false });
      const pixelRatio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));

      canvas.width = Math.ceil(viewport.width * pixelRatio);
      canvas.height = Math.ceil(viewport.height * pixelRatio);
      canvas.style.width = `${Math.ceil(viewport.width)}px`;
      canvas.style.height = `${Math.ceil(viewport.height)}px`;
      canvas.dataset.pixelRatio = String(pixelRatio);
      elements.pageStage.hidden = false;
      elements.welcomeCard.hidden = true;
      elements.emptyDocument.hidden = true;

      await page.render({
        canvasContext: context,
        viewport,
        transform: [pixelRatio, 0, 0, pixelRatio, 0, 0],
      }).promise;
      if (renderToken !== state.renderToken) return;
      context.save();
      context.scale(pixelRatio, pixelRatio);
      drawAnnotations(context, viewport, pageData.annotations);
      context.restore();
      canvas.dataset.scale = String(scale);
      canvas.dataset.rotation = String(rotation);
      updateInterface();
    } catch (error) {
      showError(error && error.message ? `Could not render this page: ${error.message}` : "Could not render this page.");
    }
  }

  function drawAnnotations(context, viewport, annotations) {
    for (const annotation of annotations) {
      if (annotation.type === "cover") {
        const first = viewport.convertToViewportPoint(annotation.x, annotation.y);
        const second = viewport.convertToViewportPoint(annotation.x + annotation.width, annotation.y + annotation.height);
        context.fillStyle = "#fff";
        context.fillRect(
          Math.min(first[0], second[0]),
          Math.min(first[1], second[1]),
          Math.abs(second[0] - first[0]),
          Math.abs(second[1] - first[1])
        );
      } else {
        const [x, y] = viewport.convertToViewportPoint(annotation.x, annotation.y);
        context.save();
        context.translate(x, y);
        context.rotate(-viewport.rotation * Math.PI / 180);
        context.fillStyle = "#171717";
        context.font = `${annotation.size * viewport.scale}px Arial, sans-serif`;
        context.textBaseline = "alphabetic";
        context.fillText(annotation.text, 0, 0);
        context.restore();
      }
    }
  }

  function changeZoom(delta) {
    if (!state.pages.length) return;
    state.zoom = Math.min(2.4, Math.max(0.65, state.zoom + delta));
    renderCurrentPage();
  }

  async function renderThumbnails() {
    elements.pageList.replaceChildren();
    elements.sidebarEmpty.hidden = state.pages.length > 0;

    for (const [index, pageData] of state.pages.entries()) {
      const item = document.createElement("li");
      item.className = `page-item${index === state.currentPage ? " is-current" : ""}`;
      item.draggable = true;
      item.dataset.index = String(index);
      item.setAttribute("aria-label", `Page ${index + 1}`);

      const thumb = document.createElement("canvas");
      thumb.className = "page-thumbnail";
      thumb.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.className = "page-label";
      label.textContent = `Page ${index + 1}`;
      item.append(thumb, label);
      elements.pageList.append(item);

      item.addEventListener("click", () => selectPage(index));
      item.addEventListener("dragstart", (event) => {
        state.dragPage = index;
        item.classList.add("is-dragging");
        event.dataTransfer.effectAllowed = "move";
      });
      item.addEventListener("dragend", () => {
        state.dragPage = null;
        item.classList.remove("is-dragging");
      });
      item.addEventListener("dragover", (event) => event.preventDefault());
      item.addEventListener("drop", (event) => {
        event.preventDefault();
        const targetIndex = Number(item.dataset.index);
        if (state.dragPage !== null && state.dragPage !== targetIndex) movePage(state.dragPage, targetIndex);
      });

      drawThumbnail(thumb, pageData).catch((error) => {
        showError(error && error.message ? `Could not render a page thumbnail: ${error.message}` : "Could not render a page thumbnail.");
      });
    }

    updateInterface();
  }

  async function drawThumbnail(canvas, pageData) {
    if (!state.document) return;
    const page = await state.document.getPage(pageData.sourceIndex + 1);
    const rotation = normalizeRotation(page.rotate + pageData.rotation);
    const unitViewport = page.getViewport({ scale: 1, rotation });
    const viewport = page.getViewport({ scale: 120 / unitViewport.width, rotation });
    const context = canvas.getContext("2d", { alpha: false });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: context, viewport }).promise;
    drawAnnotations(context, viewport, pageData.annotations);
  }

  function selectPage(index) {
    if (!state.pages.length) return;
    state.currentPage = Math.max(0, Math.min(index, state.pages.length - 1));
    setMode(null);
    updateInterface();
    renderCurrentPage();
    renderThumbnails();
  }

  function movePage(fromIndex, toIndex) {
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= state.pages.length || toIndex >= state.pages.length) return;
    const [movedPage] = state.pages.splice(fromIndex, 1);
    state.pages.splice(toIndex, 0, movedPage);
    if (state.currentPage === fromIndex) state.currentPage = toIndex;
    else if (fromIndex < state.currentPage && toIndex >= state.currentPage) state.currentPage -= 1;
    else if (fromIndex > state.currentPage && toIndex <= state.currentPage) state.currentPage += 1;
    updateInterface();
    renderCurrentPage();
    renderThumbnails();
  }

  function rotatePage() {
    const page = state.pages[state.currentPage];
    if (!page) return;
    page.rotation = normalizeRotation(page.rotation + 90);
    renderCurrentPage();
    renderThumbnails();
  }

  function deletePage() {
    if (!state.pages.length) return;
    state.pages.splice(state.currentPage, 1);
    if (state.currentPage >= state.pages.length) state.currentPage = Math.max(0, state.pages.length - 1);
    setMode(null);
    updateInterface();
    if (state.pages.length) {
      renderCurrentPage();
      renderThumbnails();
    } else {
      ++state.renderToken;
      elements.pageStage.hidden = true;
      elements.emptyDocument.hidden = false;
      elements.sidebarEmpty.hidden = false;
      elements.pageList.replaceChildren();
    }
  }

  function setMode(mode) {
    state.mode = mode;
    elements.canvas.classList.toggle("mode-text", mode === "text");
    elements.canvas.classList.toggle("mode-erase", mode === "erase");
    elements.textModeButton.classList.toggle("is-active", mode === "text");
    elements.eraseModeButton.classList.toggle("is-active", mode === "erase");
    elements.selectionBox.hidden = true;
    if (mode === "text") {
      elements.editorHint.textContent = "Click on the page to place your text.";
      elements.annotationText.focus();
    } else if (mode === "erase") {
      elements.editorHint.textContent = "Drag over the printed number to cover it with white.";
    } else {
      elements.editorHint.textContent = "Your PDF is processed locally in this browser.";
    }
  }

  function onCanvasPointerDown(event) {
    if (!state.mode || !state.pages[state.currentPage]) return;
    const point = canvasPoint(event);

    if (state.mode === "text") {
      const text = elements.annotationText.value.trim();
      if (!text) {
        showError("Type the text you want to add before clicking the page.");
        elements.annotationText.focus();
        return;
      }
      const size = Number(elements.textSize.value);
      if (!Number.isFinite(size) || size < 6 || size > 96) {
        showError("Choose a text size from 6 to 96 points.");
        elements.textSize.focus();
        return;
      }
      const page = state.pages[state.currentPage];
      page.annotations.push({
        type: "text",
        ...viewportToPdf(point.x, point.y),
        text,
        size,
      });
      setMode(null);
      renderCurrentPage();
      renderThumbnails();
      showToast("Text added. Download the PDF to save your changes.");
      return;
    }

    if (state.mode === "erase") {
      event.preventDefault();
      elements.canvas.setPointerCapture(event.pointerId);
      state.dragStart = point;
      elements.selectionBox.hidden = false;
      updateSelection(point);
    }
  }

  function onCanvasPointerMove(event) {
    if (state.mode !== "erase" || !state.dragStart) return;
    updateSelection(canvasPoint(event));
  }

  function onCanvasPointerUp(event) {
    if (state.mode !== "erase" || !state.dragStart) return;
    const end = canvasPoint(event);
    const start = state.dragStart;
    clearSelection();

    if (Math.abs(end.x - start.x) < 3 || Math.abs(end.y - start.y) < 3) {
      showError("Drag a rectangle around the printed page number to cover it.");
      return;
    }

    const topLeft = viewportToPdf(Math.min(start.x, end.x), Math.min(start.y, end.y));
    const topRight = viewportToPdf(Math.max(start.x, end.x), Math.min(start.y, end.y));
    const bottomLeft = viewportToPdf(Math.min(start.x, end.x), Math.max(start.y, end.y));
    const bottomRight = viewportToPdf(Math.max(start.x, end.x), Math.max(start.y, end.y));
    const page = state.pages[state.currentPage];
    const points = [topLeft, topRight, bottomLeft, bottomRight];
    const xValues = points.map((point) => point.x);
    const yValues = points.map((point) => point.y);
    page.annotations.push({
      type: "cover",
      x: Math.min(...xValues),
      y: Math.min(...yValues),
      width: Math.max(...xValues) - Math.min(...xValues),
      height: Math.max(...yValues) - Math.min(...yValues),
    });
    setMode(null);
    renderCurrentPage();
    renderThumbnails();
    showToast("Area covered. This is visual masking, not secure redaction.");
  }

  function canvasPoint(event) {
    const bounds = elements.canvas.getBoundingClientRect();
    const pixelRatio = Number(elements.canvas.dataset.pixelRatio) || 1;
    return {
      x: (event.clientX - bounds.left) * (elements.canvas.width / pixelRatio / bounds.width),
      y: (event.clientY - bounds.top) * (elements.canvas.height / pixelRatio / bounds.height),
    };
  }

  function viewportToPdf(x, y) {
    if (!state.viewport) return { x: 0, y: 0 };
    const [pdfX, pdfY] = state.viewport.convertToPdfPoint(x, y);
    return { x: pdfX, y: pdfY };
  }

  function updateSelection(point) {
    if (!state.dragStart) return;
    const start = state.dragStart;
    const pixelRatio = Number(elements.canvas.dataset.pixelRatio) || 1;
    const scaleX = elements.canvas.clientWidth / (elements.canvas.width / pixelRatio);
    const scaleY = elements.canvas.clientHeight / (elements.canvas.height / pixelRatio);
    const left = Math.min(start.x, point.x) * scaleX;
    const top = Math.min(start.y, point.y) * scaleY;
    const width = Math.abs(point.x - start.x) * scaleX;
    const height = Math.abs(point.y - start.y) * scaleY;
    Object.assign(elements.selectionBox.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    });
  }

  function clearSelection() {
    state.dragStart = null;
    elements.selectionBox.hidden = true;
  }

  function onUnlockFileSelected() {
    const [file] = elements.unlockFileInput.files;
    elements.unlockFileInput.value = "";
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      showError("Please choose a PDF file.");
      return;
    }
    state.unlockFile = file;
    elements.unlockFileName.textContent = file.name;
    elements.unlockPassword.value = "";
  }

  async function removePdfPassword(event) {
    event.preventDefault();
    const file = state.unlockFile;
    const password = elements.unlockPassword.value;
    if (!file) {
      showError("Choose a password-protected PDF first.");
      elements.unlockFileInput.click();
      return;
    }
    if (!password) {
      showError("Enter the current PDF password.");
      elements.unlockPassword.focus();
      return;
    }

    elements.unlockSubmit.disabled = true;
    setLoading(true, "Unlocking and rebuilding PDF pages…");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const source = await pdfjsLib.getDocument({ data: bytes.slice(), password }).promise;
      const output = await PDFLib.PDFDocument.create();

      for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber += 1) {
        elements.loadingMessage.textContent = `Rebuilding page ${pageNumber} of ${source.numPages}…`;
        const page = await source.getPage(pageNumber);
        const unitViewport = page.getViewport({ scale: 1 });
        // Password removal must rebuild each page as an image because the
        // encrypted source page cannot be copied directly by PDF-Lib. Use a
        // high-resolution render so text and fine print do not become visibly
        // pixelated in the downloaded PDF.
        const pixelScale = Math.min(
          3.5,
          9000 / unitViewport.width,
          9000 / unitViewport.height,
          Math.sqrt(40000000 / (unitViewport.width * unitViewport.height))
        );
        const viewport = page.getViewport({ scale: pixelScale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvasContext: canvas.getContext("2d", { alpha: false }), viewport }).promise;
        // JPEG keeps the rebuilt, password-removed PDF close to the 1 MB
        // target while retaining a high visual quality for statement text.
        const imageBlob = await canvasToBlob(canvas, "image/jpeg", 0.96);
        const image = await output.embedJpg(await imageBlob.arrayBuffer());
        const outputPage = output.addPage([unitViewport.width, unitViewport.height]);
        outputPage.drawImage(image, {
          x: 0,
          y: 0,
          width: unitViewport.width,
          height: unitViewport.height,
        });
        canvas.width = 1;
        canvas.height = 1;
        page.cleanup();
      }

      const result = await output.save();
      downloadBytes(result, outputFileName(file.name), "application/pdf");
      elements.unlockPassword.value = "";
      showToast("Unlocked PDF downloaded. Its pages are images; selectable text and links are not preserved.");
    } catch (error) {
      if (error?.name === "PasswordException") {
        showError("The password was incorrect, or this PDF uses an unsupported protection method.");
      } else {
        showError(error && error.message ? `Could not remove this password: ${error.message}` : "Could not remove this password.");
      }
    } finally {
      setLoading(false);
      elements.unlockSubmit.disabled = false;
    }
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not convert a PDF page to an image."));
      }, type, quality);
    });
  }

  function downloadBytes(bytes, fileName, type) {
    const blobUrl = URL.createObjectURL(new Blob([bytes], { type }));
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }

  async function downloadPdf() {
    if (!state.bytes || !state.pages.length || !window.PDFLib) return;
    elements.downloadButton.disabled = true;
    setLoading(true, "Preparing your edited PDF…");
    try {
      const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;
      const source = await PDFDocument.load(state.bytes);
      const output = await PDFDocument.create();
      const font = await output.embedFont(StandardFonts.Helvetica);

      for (const pageData of state.pages) {
        const [copiedPage] = await output.copyPages(source, [pageData.sourceIndex]);
        const baseRotation = copiedPage.getRotation().angle;
        copiedPage.setRotation(degrees(normalizeRotation(baseRotation + pageData.rotation)));

        for (const annotation of pageData.annotations) {
          if (annotation.type === "cover") {
            copiedPage.drawRectangle({
              x: annotation.x,
              y: annotation.y,
              width: annotation.width,
              height: annotation.height,
              color: rgb(1, 1, 1),
              borderWidth: 0,
            });
          } else {
            copiedPage.drawText(annotation.text, {
              x: annotation.x,
              y: annotation.y,
              size: annotation.size,
              font,
              color: rgb(0.09, 0.09, 0.09),
            });
          }
        }
        output.addPage(copiedPage);
      }

      const result = await output.save();
      downloadBytes(result, outputFileName(state.fileName), "application/pdf");
      showToast("Your edited PDF has been downloaded.");
    } catch (error) {
      showError(error && error.message ? `Could not save this PDF: ${error.message}` : "Could not save this PDF.");
    } finally {
      setLoading(false);
      updateInterface();
    }
  }

  function outputFileName(name) {
    const stem = name.replace(/\.pdf$/i, "") || "document";
    return `${stem}-edited.pdf`;
  }

  function updateInterface() {
    const hasDocument = Boolean(state.document);
    const hasPages = state.pages.length > 0;
    const current = state.pages[state.currentPage];

    elements.pageCount.textContent = hasDocument
      ? `${state.pages.length} ${state.pages.length === 1 ? "page" : "pages"}`
      : "Open a PDF to get started";
    elements.pagePosition.textContent = current ? `${state.currentPage + 1} / ${state.pages.length}` : "— / —";
    elements.previousButton.disabled = !current || state.currentPage === 0;
    elements.nextButton.disabled = !current || state.currentPage === state.pages.length - 1;
    elements.rotateButton.disabled = !current;
    elements.deleteButton.disabled = !current;
    elements.textModeButton.disabled = !current;
    elements.eraseModeButton.disabled = !current;
    elements.annotationText.disabled = !current;
    elements.textSize.disabled = !current;
    elements.downloadButton.disabled = !hasPages;
    elements.zoomInButton.disabled = !hasPages || state.zoom >= 2.4;
    elements.zoomOutButton.disabled = !hasPages || state.zoom <= 0.65;
    elements.zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
    elements.welcomeCard.hidden = hasDocument;
    elements.emptyDocument.hidden = !hasDocument || hasPages;
    elements.pageStage.hidden = !hasPages;
    elements.sidebarEmpty.hidden = hasPages;
    elements.pageList.querySelectorAll(".page-item").forEach((item, index) => {
      item.classList.toggle("is-current", index === state.currentPage);
      item.querySelector(".page-label").textContent = `Page ${index + 1}`;
      item.setAttribute("aria-label", `Page ${index + 1}`);
    });
  }

  function setLoading(isLoading, message) {
    elements.loadingState.hidden = !isLoading;
    elements.loadingMessage.textContent = message || "";
    if (isLoading) elements.loadingState.style.position = "absolute";
    if (isLoading) elements.loadingState.style.inset = "0";
    if (isLoading) elements.loadingState.style.zIndex = "2";
    if (isLoading) elements.loadingState.style.background = "#202832dd";
    if (isLoading) elements.downloadButton.disabled = true;
  }

  function normalizeRotation(angle) {
    return ((angle % 360) + 360) % 360;
  }

  function showError(message) {
    showToast(message, 5500);
  }

  function showToast(message, duration = 3200) {
    window.clearTimeout(state.toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    state.toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), duration);
  }
})();
