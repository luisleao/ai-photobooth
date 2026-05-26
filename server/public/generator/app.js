const form = document.querySelector('#generationForm');
const sourceInput = document.querySelector('#sourceImage');
const sourceModeButtons = [...document.querySelectorAll('[data-source-mode]')];
const uploadPane = document.querySelector('#uploadPane');
const cameraPane = document.querySelector('#cameraPane');
const cameraVideo = document.querySelector('#cameraVideo');
const openCameraButton = document.querySelector('#openCameraButton');
const captureCameraButton = document.querySelector('#captureCameraButton');
const stopCameraButton = document.querySelector('#stopCameraButton');
const captureCanvas = document.querySelector('#captureCanvas');
const fileName = document.querySelector('#fileName');
const preview = document.querySelector('#preview');
const generateButton = document.querySelector('#generateButton');
const statusPill = document.querySelector('#statusPill');
const resultsGrid = document.querySelector('#resultsGrid');
const message = document.querySelector('#message');
const compositionStage = document.querySelector('#compositionStage');
const compositionBackground = document.querySelector('#compositionBackground');
const compositionOverlay = document.querySelector('#compositionOverlay');
const compositionSubjectBox = document.querySelector('#compositionSubjectBox');
const compositionSubjectImage = document.querySelector('#compositionSubjectImage');
const saveCompositionButton = document.querySelector('#saveCompositionButton');
const resetCompositionButton = document.querySelector('#resetCompositionButton');
const compositionInputs = {
  background: form.elements.mainBackground,
  imageLeft: form.elements.mainImageLeft,
  imageTop: form.elements.mainImageTop,
  imageWidth: form.elements.mainImageWidth,
  imageHeight: form.elements.mainImageHeight,
  imageFit: form.elements.mainImageFit,
};

const MAIN_IMAGE_ID = '01-figurinha-principal';
const STICKER_SHEET_ID = 'sticker-sheet-3-5x6';
const MAIN_PRINT_WIDTH = 1181;
const MAIN_PRINT_HEIGHT = 1772;
const MIN_SUBJECT_SIZE = 100;
const SAVED_COMPOSITION_KEY = 'ai-photobooth.main-composition';
const STICKER_SHEET_SPEC = {
  id: STICKER_SHEET_ID,
  title: 'Sticker sheet 3.5x6',
  kind: 'sheet',
};
const DEFAULT_IMAGE_SPECS = [
  { id: '01-figurinha-principal', title: 'Figurinha Principal', kind: 'main' },
  { id: '02-grito-de-gol', title: 'O Grito de Gol', kind: 'sticker' },
  { id: '03-sufoco-dos-penaltis', title: 'O Sufoco dos Penaltis', kind: 'sticker' },
  { id: '04-pedindo-o-var', title: 'Pedindo o VAR', kind: 'sticker' },
  { id: '05-rei-da-torcida', title: 'O Rei da Torcida', kind: 'sticker' },
  { id: '06-hexa-vem', title: 'O Hexa Vem', kind: 'sticker' },
  { id: '07-cartao-vermelho', title: 'Cartao Vermelho', kind: 'sticker' },
  { id: '08-tristeza-pos-jogo', title: 'Tristeza Pos-Jogo', kind: 'sticker' },
  { id: '09-a-taca-e-nossa', title: 'A Taca e Nossa', kind: 'sticker' },
  { id: '10-hexa', title: 'Hexa', kind: 'sticker' },
  { id: '11-goooooool', title: 'GOOOOOOOL', kind: 'sticker' },
];

const state = {
  specs: DEFAULT_IMAGE_SPECS,
  isGenerating: false,
  runId: '',
  sourceMode: 'upload',
  selectedSourceFile: null,
  selectedSourceOrigin: '',
  previewUrl: '',
  cameraStream: null,
  mainCompositionDefaults: {
    background: '#000d25',
    imageLeft: 90,
    imageTop: 82,
    imageWidth: 990,
    imageHeight: 1485,
    imageFit: 'contain',
  },
  compositionDrag: null,
};

sourceModeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setSourceMode(button.dataset.sourceMode);
  });
});

sourceInput.addEventListener('change', () => {
  const file = sourceInput.files && sourceInput.files[0];

  if (!file) {
    fileName.textContent = 'Selecionar arquivo';
    if (state.sourceMode === 'upload') {
      clearSelectedSource();
    }
    return;
  }

  setSelectedSourceFile(file, file.name, 'upload');
});

openCameraButton.addEventListener('click', startCamera);
captureCameraButton.addEventListener('click', captureCameraPhoto);
stopCameraButton.addEventListener('click', stopCamera);
saveCompositionButton.addEventListener('click', saveCompositionSettings);
resetCompositionButton.addEventListener('click', resetCompositionSettings);
compositionSubjectBox.addEventListener('pointerdown', startCompositionDrag);
Object.values(compositionInputs).forEach((input) => {
  input.addEventListener('input', () => {
    if (input === compositionInputs.imageFit) {
      updateSubjectFit();
      return;
    }

    syncCompositionFromInputs();
  });
});
window.addEventListener('resize', syncCompositionFromInputs);
window.addEventListener('beforeunload', () => {
  stopCamera();
  revokePreviewUrl();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const file = state.selectedSourceFile;

  if (!file) {
    setMessage('Selecione uma imagem base.');
    return;
  }

  if (!state.specs.length) {
    await loadSpecs();
  }

  state.runId = '';
  setBusy(true);
  renderInitialResults();
  setItemStatus(STICKER_SHEET_ID, 'running', 'Aguardando figurinhas');
  setMessage(`Gerando 0/${state.specs.length}.`);

  try {
    const params = readParams();
    const mainSpec = getMainSpec();
    const secondarySpecs = state.specs.filter((spec) => spec.id !== mainSpec.id);
    let completedCount = 0;

    setItemStatus(mainSpec.id, 'running', 'Gerando principal');
    setMessage(`Gerando imagem principal: ${mainSpec.title}.`);

    const mainData = await generateOneImage({
      file,
      params,
      spec: mainSpec,
      runId: state.runId,
      includeSource: true,
    });

    state.runId = mainData.runId;
    updateResultItem(mainData.output);
    completedCount += 1;
    setMessage(`Concluidas ${completedCount}/${state.specs.length}. Gerando demais imagens em paralelo.`);

    secondarySpecs.forEach((spec) => {
      setItemStatus(spec.id, 'running', 'Gerando em paralelo');
    });

    const secondaryResults = await Promise.all(secondarySpecs.map(async (spec) => {
      try {
        const data = await generateOneImage({
          file,
          params,
          spec,
          runId: state.runId,
          includeSource: false,
        });

        updateResultItem(data.output);
        completedCount += 1;
        setMessage(`Concluidas ${completedCount}/${state.specs.length}.`);
        return { ok: true, spec };
      } catch (error) {
        setItemStatus(spec.id, 'error', 'Erro');
        return { ok: false, spec, error };
      }
    }));

    const failures = secondaryResults.filter((result) => !result.ok);

    if (failures.length) {
      const failedTitles = failures.map((result) => result.spec.title).slice(0, 3).join(', ');
      throw new Error(`Falha em ${failures.length} imagem(ns): ${failedTitles}.`);
    }

    setMessage(`${state.specs.length} imagens geradas com provider ${getCompletedProvider()}.`);
    statusPill.textContent = 'Concluido';
  } catch (error) {
    setMessage(error.message || 'Falha ao gerar imagens.');
    statusPill.textContent = 'Erro';
  } finally {
    setBusy(false);
  }
});

applyCompositionToInputs(state.mainCompositionDefaults);

loadSpecs().catch(() => {
  setMessage('Nao foi possivel carregar a lista de imagens.');
});

async function loadSpecs() {
  const response = await fetch('/api/photobooth/image-prompts');
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Falha ao carregar prompts.');
  }

  state.specs = data.specs && data.specs.length ? data.specs : DEFAULT_IMAGE_SPECS;
  applyMainCompositionConfig(data.mainComposition);
  setGenerateButtonLabel();
}

async function generateOneImage({
  file,
  params,
  spec,
  runId,
  includeSource,
}) {
  const payload = new FormData();
  payload.append('params', JSON.stringify(params));
  payload.append('specId', spec.id);

  if (includeSource) {
    payload.append('sourceImage', file);
  }

  if (runId) {
    payload.append('runId', runId);
  }

  const response = await fetch('/api/photobooth/generate-image', {
    method: 'POST',
    body: payload,
  });
  const data = await response.json();

  if (!response.ok) {
    setItemStatus(spec.id, 'error', 'Erro');
    throw new Error(data.message || `Falha ao gerar ${spec.title}.`);
  }

  return data;
}

function readParams() {
  const data = new FormData(form);

  return {
    participantName: data.get('participantName'),
    nickname: data.get('nickname'),
    jerseyNumber: data.get('jerseyNumber'),
    position: data.get('position'),
    country: data.get('country'),
    city: data.get('city'),
    edition: data.get('edition'),
    cardColors: data.get('cardColors'),
    personality: data.get('personality'),
    extraDetails: data.get('extraDetails'),
    mainBackground: data.get('mainBackground'),
    mainImageLeft: data.get('mainImageLeft'),
    mainImageTop: data.get('mainImageTop'),
    mainImageWidth: data.get('mainImageWidth'),
    mainImageHeight: data.get('mainImageHeight'),
    mainImageFit: data.get('mainImageFit'),
  };
}

function renderInitialResults() {
  resultsGrid.innerHTML = '';

  getResultSpecs().forEach((spec) => {
    const item = document.createElement('article');
    item.className = 'result-item is-pending';
    if (spec.kind === 'main') {
      item.classList.add('is-main');
    }
    if (spec.kind === 'sheet') {
      item.classList.add('is-sheet');
    }
    item.dataset.specId = spec.id;

    const thumb = document.createElement('div');
    thumb.className = 'result-thumb';
    thumb.innerHTML = '<span class="loader" aria-hidden="true"></span>';

    const body = document.createElement('div');
    const title = document.createElement('p');
    title.className = 'result-title';
    title.textContent = spec.title;

    const meta = document.createElement('p');
    meta.className = 'result-meta';
    meta.textContent = getPendingMeta(spec);

    const links = document.createElement('div');
    links.className = 'result-links';

    body.append(title, meta, links);
    item.append(thumb, body);
    resultsGrid.append(item);
  });
}

function updateResultItem(output) {
  const item = getResultItem(output.id);

  if (!item) {
    return;
  }

  item.classList.remove('is-pending', 'is-running', 'is-error');
  item.classList.add('is-complete');

  const files = output.files || [];
  const stickerSheetFile = files.find(isStickerSheetFile);
  const visibleFiles = files.filter((file) => !isStickerSheetFile(file));
  const subjectFile = files.find((file) => file.type === 'subject-png');
  const thumb = item.querySelector('.result-thumb');
  const previewFile = visibleFiles.find((file) => file.type === 'webp')
    || visibleFiles.find((file) => file.type === 'print-png')
    || visibleFiles[0]
    || files[0];

  if (!previewFile) {
    if (stickerSheetFile) {
      updateStickerSheetItem(stickerSheetFile, output.provider);
    }
    return;
  }

  if (output.id === MAIN_IMAGE_ID && subjectFile) {
    setCompositionSubjectImage(subjectFile.url);
  }

  thumb.innerHTML = '';

  const image = document.createElement('img');
  image.src = `${previewFile.url}?t=${Date.now()}`;
  image.alt = output.title;
  thumb.append(image);

  const title = item.querySelector('.result-title');
  title.textContent = `${output.title} · ${output.provider}`;

  const meta = item.querySelector('.result-meta');
  meta.textContent = 'Concluida';

  const links = item.querySelector('.result-links');
  links.innerHTML = '';

  visibleFiles.forEach((file) => {
    const link = document.createElement('a');
    link.href = file.url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = `${file.type} ${file.width}x${file.height}`;
    links.append(link);
  });

  if (stickerSheetFile) {
    updateStickerSheetItem(stickerSheetFile, output.provider);
  }
}

function updateStickerSheetItem(file, provider) {
  const item = getResultItem(STICKER_SHEET_ID);

  if (!item) {
    return;
  }

  item.classList.remove('is-pending', 'is-running', 'is-error');
  item.classList.add('is-complete');

  const thumb = item.querySelector('.result-thumb');
  thumb.innerHTML = '';

  const image = document.createElement('img');
  image.src = `${file.url}?t=${Date.now()}`;
  image.alt = STICKER_SHEET_SPEC.title;
  thumb.append(image);

  const title = item.querySelector('.result-title');
  title.textContent = `${STICKER_SHEET_SPEC.title} · ${provider || 'openai'}`;

  const meta = item.querySelector('.result-meta');
  meta.textContent = 'Grid pronto';

  const links = item.querySelector('.result-links');
  links.innerHTML = '';

  const link = document.createElement('a');
  link.href = file.url;
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.textContent = `${file.type} ${file.width}x${file.height}`;
  links.append(link);
}

function setItemStatus(specId, status, label) {
  const item = getResultItem(specId);

  if (!item) {
    return;
  }

  item.classList.remove('is-pending', 'is-running', 'is-complete', 'is-error');
  item.classList.add(`is-${status}`);

  const meta = item.querySelector('.result-meta');
  meta.textContent = label;
}

function getResultItem(specId) {
  return resultsGrid.querySelector(`[data-spec-id="${CSS.escape(specId)}"]`);
}

function getResultSpecs() {
  return [...state.specs, STICKER_SHEET_SPEC];
}

function getPendingMeta(spec) {
  if (spec.kind === 'main') {
    return 'Aguardando principal 10x15';
  }

  if (spec.kind === 'sheet') {
    return 'Aguardando grid 3.5x6';
  }

  return 'Aguardando PNG + WebP';
}

function isStickerSheetFile(file) {
  return file && typeof file.type === 'string' && file.type.startsWith('sticker-sheet');
}

function getMainSpec() {
  return state.specs.find((spec) => spec.id === MAIN_IMAGE_ID)
    || state.specs.find((spec) => spec.kind === 'main')
    || state.specs[0];
}

function getCompletedProvider() {
  const completeTitle = resultsGrid.querySelector('.is-complete .result-title');

  if (!completeTitle || !completeTitle.textContent.includes('·')) {
    return 'openai';
  }

  return completeTitle.textContent.split('·').pop().trim();
}

function applyMainCompositionConfig(config) {
  if (config && config.defaults) {
    state.mainCompositionDefaults = normalizeComposition(config.defaults);
  }

  if (config && config.backgroundImageUrl) {
    compositionBackground.src = `${config.backgroundImageUrl}?t=${Date.now()}`;
  }

  if (config && config.overlayImageUrl) {
    compositionOverlay.src = `${config.overlayImageUrl}?t=${Date.now()}`;
  }

  applyCompositionToInputs(readSavedComposition() || state.mainCompositionDefaults);
}

function readSavedComposition() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_COMPOSITION_KEY));
    return parsed && typeof parsed === 'object' ? normalizeComposition(parsed) : null;
  } catch (error) {
    return null;
  }
}

function saveCompositionSettings() {
  const layout = readCompositionInputs();
  localStorage.setItem(SAVED_COMPOSITION_KEY, JSON.stringify(layout));
  setMessage('Ajuste visual salvo para as proximas geracoes neste navegador.');
}

function resetCompositionSettings() {
  localStorage.removeItem(SAVED_COMPOSITION_KEY);
  applyCompositionToInputs(state.mainCompositionDefaults);
  setMessage('Ajuste visual restaurado para os valores do .env.');
}

function readCompositionInputs() {
  return normalizeComposition({
    background: compositionInputs.background.value,
    imageLeft: compositionInputs.imageLeft.value,
    imageTop: compositionInputs.imageTop.value,
    imageWidth: compositionInputs.imageWidth.value,
    imageHeight: compositionInputs.imageHeight.value,
    imageFit: compositionInputs.imageFit.value,
  });
}

function normalizeComposition(value = {}) {
  const imageWidth = clamp(readNumber(value.imageWidth, state.mainCompositionDefaults.imageWidth || 990), MIN_SUBJECT_SIZE, MAIN_PRINT_WIDTH);
  const imageHeight = clamp(readNumber(value.imageHeight, state.mainCompositionDefaults.imageHeight || 1485), MIN_SUBJECT_SIZE, MAIN_PRINT_HEIGHT);
  const imageLeft = clamp(readNumber(value.imageLeft, state.mainCompositionDefaults.imageLeft || 90), 0, MAIN_PRINT_WIDTH - imageWidth);
  const imageTop = clamp(readNumber(value.imageTop, state.mainCompositionDefaults.imageTop || 82), 0, MAIN_PRINT_HEIGHT - imageHeight);
  const imageFit = ['contain', 'cover', 'fill'].includes(value.imageFit) ? value.imageFit : 'contain';

  return {
    background: value.background || state.mainCompositionDefaults.background || '#000d25',
    imageLeft,
    imageTop,
    imageWidth,
    imageHeight,
    imageFit,
  };
}

function readNumber(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function applyCompositionToInputs(layout) {
  const normalized = normalizeComposition(layout);
  compositionInputs.background.value = normalized.background;
  compositionInputs.imageLeft.value = normalized.imageLeft;
  compositionInputs.imageTop.value = normalized.imageTop;
  compositionInputs.imageWidth.value = normalized.imageWidth;
  compositionInputs.imageHeight.value = normalized.imageHeight;
  compositionInputs.imageFit.value = normalized.imageFit;
  renderCompositionBox(normalized);
  updateSubjectFit();
}

function syncCompositionFromInputs() {
  applyCompositionToInputs(readCompositionInputs());
}

function renderCompositionBox(layout = readCompositionInputs()) {
  const scale = getCompositionScale();
  compositionStage.style.backgroundColor = layout.background;
  compositionSubjectBox.style.left = `${layout.imageLeft * scale.x}px`;
  compositionSubjectBox.style.top = `${layout.imageTop * scale.y}px`;
  compositionSubjectBox.style.width = `${layout.imageWidth * scale.x}px`;
  compositionSubjectBox.style.height = `${layout.imageHeight * scale.y}px`;
}

function updateSubjectFit() {
  compositionSubjectImage.style.objectFit = compositionInputs.imageFit.value === 'fill'
    ? 'fill'
    : compositionInputs.imageFit.value;
}

function getCompositionScale() {
  const rect = compositionStage.getBoundingClientRect();

  return {
    x: rect.width / MAIN_PRINT_WIDTH,
    y: rect.height / MAIN_PRINT_HEIGHT,
  };
}

function startCompositionDrag(event) {
  if (state.isGenerating) {
    return;
  }

  const handle = event.target.closest('[data-handle]');
  state.compositionDrag = {
    handle: handle ? handle.dataset.handle : '',
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startLayout: readCompositionInputs(),
  };

  compositionSubjectBox.setPointerCapture(event.pointerId);
  window.addEventListener('pointermove', moveCompositionDrag);
  window.addEventListener('pointerup', stopCompositionDrag);
  event.preventDefault();
}

function moveCompositionDrag(event) {
  const drag = state.compositionDrag;

  if (!drag) {
    return;
  }

  const scale = getCompositionScale();
  const dx = (event.clientX - drag.startX) / scale.x;
  const dy = (event.clientY - drag.startY) / scale.y;
  const next = resizeComposition(drag.startLayout, drag.handle, dx, dy);

  applyCompositionToInputs(next);
}

function stopCompositionDrag(event) {
  if (state.compositionDrag && state.compositionDrag.pointerId === event.pointerId) {
    try {
      compositionSubjectBox.releasePointerCapture(event.pointerId);
    } catch (error) {
      // Pointer capture may already be released by the browser.
    }
  }

  state.compositionDrag = null;
  window.removeEventListener('pointermove', moveCompositionDrag);
  window.removeEventListener('pointerup', stopCompositionDrag);
}

function resizeComposition(layout, handle, dx, dy) {
  const next = { ...layout };

  if (!handle) {
    next.imageLeft = layout.imageLeft + dx;
    next.imageTop = layout.imageTop + dy;
    return normalizeComposition(next);
  }

  const right = layout.imageLeft + layout.imageWidth;
  const bottom = layout.imageTop + layout.imageHeight;

  if (handle.includes('e')) {
    next.imageWidth = clamp(layout.imageWidth + dx, MIN_SUBJECT_SIZE, MAIN_PRINT_WIDTH - layout.imageLeft);
  }

  if (handle.includes('s')) {
    next.imageHeight = clamp(layout.imageHeight + dy, MIN_SUBJECT_SIZE, MAIN_PRINT_HEIGHT - layout.imageTop);
  }

  if (handle.includes('w')) {
    next.imageLeft = clamp(layout.imageLeft + dx, 0, right - MIN_SUBJECT_SIZE);
    next.imageWidth = right - next.imageLeft;
  }

  if (handle.includes('n')) {
    next.imageTop = clamp(layout.imageTop + dy, 0, bottom - MIN_SUBJECT_SIZE);
    next.imageHeight = bottom - next.imageTop;
  }

  return normalizeComposition(next);
}

function setCompositionSubjectImage(url) {
  compositionSubjectImage.src = `${url}?t=${Date.now()}`;
  compositionSubjectBox.classList.add('has-image');
}

function clearCompositionSubjectImage() {
  compositionSubjectImage.removeAttribute('src');
  compositionSubjectBox.classList.remove('has-image');
}

function setBusy(value) {
  state.isGenerating = value;
  generateButton.disabled = value;
  generateButton.textContent = value ? 'Gerando' : getGenerateButtonLabel();
  sourceInput.disabled = value;
  saveCompositionButton.disabled = value;
  resetCompositionButton.disabled = value;
  sourceModeButtons.forEach((button) => {
    button.disabled = value;
  });

  if (state.cameraStream) {
    setCameraButtons(true);
  } else {
    setCameraButtons(false);
  }

  if (value) {
    statusPill.textContent = 'Gerando';
  }
}

function setMessage(value) {
  message.textContent = value;
}

function setGenerateButtonLabel() {
  if (!state.isGenerating) {
    generateButton.textContent = getGenerateButtonLabel();
  }
}

function getGenerateButtonLabel() {
  return `Gerar ${state.specs.length} imagens`;
}

function setSourceMode(mode) {
  if (!['upload', 'camera'].includes(mode) || state.isGenerating) {
    return;
  }

  state.sourceMode = mode;

  sourceModeButtons.forEach((button) => {
    const isActive = button.dataset.sourceMode === mode;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  uploadPane.hidden = mode !== 'upload';
  uploadPane.classList.toggle('is-active', mode === 'upload');
  cameraPane.hidden = mode !== 'camera';
  cameraPane.classList.toggle('is-active', mode === 'camera');

  if (state.selectedSourceOrigin && state.selectedSourceOrigin !== mode) {
    sourceInput.value = '';
    fileName.textContent = 'Selecionar arquivo';
    clearSelectedSource();
  }

  if (mode === 'upload') {
    stopCamera();
  }
}

async function startCamera() {
  if (state.cameraStream || state.isGenerating) {
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setMessage('Webcam nao disponivel neste navegador.');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 1706 },
      },
    });

    state.cameraStream = stream;
    cameraVideo.srcObject = stream;
    await cameraVideo.play();
    setCameraButtons(true);
    setMessage('Camera pronta.');
  } catch (error) {
    setMessage('Nao foi possivel abrir a webcam.');
  }
}

function stopCamera() {
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach((track) => track.stop());
  }

  state.cameraStream = null;
  cameraVideo.srcObject = null;
  setCameraButtons(false);
}

function captureCameraPhoto() {
  if (!state.cameraStream || !cameraVideo.videoWidth || !cameraVideo.videoHeight) {
    setMessage('Abra a webcam antes de capturar.');
    return;
  }

  captureCanvas.width = cameraVideo.videoWidth;
  captureCanvas.height = cameraVideo.videoHeight;

  const context = captureCanvas.getContext('2d');
  context.drawImage(cameraVideo, 0, 0, captureCanvas.width, captureCanvas.height);

  captureCanvas.toBlob((blob) => {
    if (!blob) {
      setMessage('Nao foi possivel capturar a foto.');
      return;
    }

    const captureFile = new File([blob], `webcam-${Date.now()}.jpg`, {
      type: 'image/jpeg',
    });

    setSelectedSourceFile(captureFile, 'captura-webcam.jpg', 'camera');
    setMessage('Captura pronta.');
  }, 'image/jpeg', 0.9);
}

function setCameraButtons(isOpen) {
  openCameraButton.disabled = isOpen || state.isGenerating;
  captureCameraButton.disabled = !isOpen || state.isGenerating;
  stopCameraButton.disabled = !isOpen;
}

function setSelectedSourceFile(file, label, origin) {
  state.selectedSourceFile = file;
  state.selectedSourceOrigin = origin;
  fileName.textContent = label;
  revokePreviewUrl();
  state.previewUrl = URL.createObjectURL(file);
  preview.src = state.previewUrl;
  preview.hidden = false;
  clearCompositionSubjectImage();
}

function clearSelectedSource() {
  state.selectedSourceFile = null;
  state.selectedSourceOrigin = '';
  revokePreviewUrl();
  preview.hidden = true;
  preview.removeAttribute('src');
  clearCompositionSubjectImage();
}

function revokePreviewUrl() {
  if (state.previewUrl) {
    URL.revokeObjectURL(state.previewUrl);
  }

  state.previewUrl = '';
}
