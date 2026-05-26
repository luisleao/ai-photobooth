const REQUIRED_PHOTOS = 2;

const state = {
  stream: null,
  photos: [],
  isCapturing: false,
  isGenerating: false,
  downloadUrl: null,
};

const elements = {
  video: document.querySelector('#cameraVideo'),
  canvas: document.querySelector('#captureCanvas'),
  cameraEmpty: document.querySelector('#cameraEmpty'),
  countdown: document.querySelector('#countdown'),
  cameraStatus: document.querySelector('#cameraStatus'),
  cameraSelect: document.querySelector('#cameraSelect'),
  participantName: document.querySelector('#participantName'),
  startCameraButton: document.querySelector('#startCameraButton'),
  captureButton: document.querySelector('#captureButton'),
  retakeButton: document.querySelector('#retakeButton'),
  generatePdfButton: document.querySelector('#generatePdfButton'),
  downloadLink: document.querySelector('#downloadLink'),
  photoCounter: document.querySelector('#photoCounter'),
  photoStrip: document.querySelector('#photoStrip'),
  message: document.querySelector('#message'),
};

elements.startCameraButton.addEventListener('click', () => {
  startCamera(elements.cameraSelect.value).catch(handleCameraError);
});

elements.cameraSelect.addEventListener('change', () => {
  if (state.stream) {
    startCamera(elements.cameraSelect.value).catch(handleCameraError);
  }
});

elements.captureButton.addEventListener('click', () => {
  captureSequence().catch((error) => {
    setMessage(error.message || 'Falha ao capturar fotos.');
    setCapturing(false);
  });
});

elements.retakeButton.addEventListener('click', () => {
  clearPhotos();
  setMessage('Pronto para uma nova sequencia.');
});

elements.generatePdfButton.addEventListener('click', () => {
  generatePdf().catch((error) => {
    setMessage(error.message || 'Falha ao gerar PDF.');
    setGenerating(false);
  });
});

if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
  setMessage('Este navegador nao disponibiliza captura de camera.');
  elements.cameraStatus.textContent = 'Camera indisponivel';
} else {
  startCamera().catch(handleCameraError);
}

renderStrip();

async function startCamera(deviceId = '') {
  stopCamera();
  elements.cameraStatus.textContent = 'Solicitando camera';
  setMessage('Aguardando permissao da camera.');

  const constraints = {
    audio: false,
    video: {
      width: { ideal: 1280 },
      height: { ideal: 960 },
      facingMode: 'user',
    },
  };

  if (deviceId) {
    constraints.video.deviceId = { exact: deviceId };
    delete constraints.video.facingMode;
  }

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  state.stream = stream;
  elements.video.srcObject = stream;
  await elements.video.play();

  elements.cameraEmpty.classList.add('is-hidden');
  elements.captureButton.disabled = false;
  elements.cameraStatus.textContent = 'Camera ativa';
  setMessage('Camera pronta.');

  await loadCameraOptions();
}

function stopCamera() {
  if (!state.stream) {
    return;
  }

  state.stream.getTracks().forEach((track) => track.stop());
  state.stream = null;
}

async function loadCameraOptions() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoInputs = devices.filter((device) => device.kind === 'videoinput');
  const selectedValue = elements.cameraSelect.value;

  elements.cameraSelect.innerHTML = '<option value="">Padrao</option>';

  videoInputs.forEach((device, index) => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.textContent = device.label || `Camera ${index + 1}`;
    elements.cameraSelect.append(option);
  });

  if (selectedValue && videoInputs.some((device) => device.deviceId === selectedValue)) {
    elements.cameraSelect.value = selectedValue;
  }
}

async function captureSequence() {
  if (!state.stream || state.isCapturing) {
    return;
  }

  clearPhotos();
  setCapturing(true);
  setMessage('Capturando sequencia.');

  for (let index = 0; index < REQUIRED_PHOTOS; index += 1) {
    await runCountdown(3);
    state.photos.push(captureFrame());
    renderStrip();

    if (index < REQUIRED_PHOTOS - 1) {
      setMessage(`Foto ${index + 1} capturada. Proxima em instantes.`);
      await sleep(850);
    }
  }

  setCapturing(false);
  setMessage('Duas fotos capturadas. O teste A/B atual nao usa imagem.');
}

function captureFrame() {
  const canvas = elements.canvas;
  const context = canvas.getContext('2d');
  const targetWidth = 1200;
  const targetHeight = 900;

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  drawVideoCover(context, elements.video, targetWidth, targetHeight);
  return canvas.toDataURL('image/jpeg', 0.92);
}

function drawVideoCover(context, video, targetWidth, targetHeight) {
  const sourceWidth = video.videoWidth || targetWidth;
  const sourceHeight = video.videoHeight || targetHeight;
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;

  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  let cropX = 0;
  let cropY = 0;

  if (sourceRatio > targetRatio) {
    cropWidth = sourceHeight * targetRatio;
    cropX = (sourceWidth - cropWidth) / 2;
  } else {
    cropHeight = sourceWidth / targetRatio;
    cropY = (sourceHeight - cropHeight) / 2;
  }

  context.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, targetWidth, targetHeight);
}

async function runCountdown(seconds) {
  elements.countdown.hidden = false;

  for (let value = seconds; value > 0; value -= 1) {
    elements.countdown.textContent = String(value);
    await sleep(680);
  }

  elements.countdown.textContent = '';
  elements.countdown.hidden = true;
}

async function generatePdf() {
  if (state.isGenerating) {
    return;
  }

  setGenerating(true);
  setMessage('Gerando teste forte A/B 50 LPI.');

  const response = await fetch('/api/photobooth/cards', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      participantName: elements.participantName.value.trim() || 'Participante',
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || 'Falha ao gerar PDF.');
  }

  const blob = await response.blob();

  if (state.downloadUrl) {
    URL.revokeObjectURL(state.downloadUrl);
  }

  state.downloadUrl = URL.createObjectURL(blob);
  elements.downloadLink.href = state.downloadUrl;
  elements.downloadLink.download = buildPdfFilename();
  elements.downloadLink.hidden = false;

  setGenerating(false);
  setMessage('PDF gerado.');
}

function buildPdfFilename() {
  const name = (elements.participantName.value.trim() || 'participante')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'participante';

  return `${name}-lenticular-cards.pdf`;
}

function clearPhotos() {
  state.photos = [];
  renderStrip();
  elements.downloadLink.hidden = true;

  if (state.downloadUrl) {
    URL.revokeObjectURL(state.downloadUrl);
    state.downloadUrl = null;
  }
}

function renderStrip() {
  elements.photoStrip.innerHTML = '';

  for (let index = 0; index < REQUIRED_PHOTOS; index += 1) {
    const item = document.createElement('li');
    item.className = 'photo-slot';

    if (state.photos[index]) {
      const image = document.createElement('img');
      image.alt = `Foto ${index + 1}`;
      image.src = state.photos[index];
      item.append(image);
    } else {
      const label = document.createElement('span');
      label.textContent = String(index + 1);
      item.append(label);
    }

    elements.photoStrip.append(item);
  }

  elements.photoCounter.textContent = `${state.photos.length}/${REQUIRED_PHOTOS}`;
  elements.retakeButton.disabled = state.photos.length === 0 || state.isCapturing;
  elements.generatePdfButton.disabled = state.isGenerating;
}

function setCapturing(value) {
  state.isCapturing = value;
  elements.captureButton.disabled = value || !state.stream;
  elements.startCameraButton.disabled = value;
  elements.cameraSelect.disabled = value;
  renderStrip();
}

function setGenerating(value) {
  state.isGenerating = value;
  elements.generatePdfButton.textContent = value ? 'Gerando PDF' : 'Gerar teste forte A/B';
  renderStrip();
}

function handleCameraError(error) {
  elements.cameraEmpty.classList.remove('is-hidden');
  elements.captureButton.disabled = true;
  elements.cameraStatus.textContent = 'Camera bloqueada';
  setMessage(error && error.name === 'NotAllowedError'
    ? 'Permissao de camera negada.'
    : 'Nao foi possivel iniciar a camera.');
}

function setMessage(value) {
  elements.message.textContent = value;
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
