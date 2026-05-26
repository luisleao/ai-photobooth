const PDFDocument = require('pdfkit');
const sharp = require('sharp');

const LENTICULAR_LPI = 50;
const OUTPUT_RASTER_DPI = 600;
const PHASE_TEST_OPTIONS = [
  {
    id: 'phase-0',
    title: '50 LPI / phase +0 px',
    phasePx: 0,
    lpi: 50,
    reverse: false,
  },
  {
    id: 'phase-1',
    title: '50 LPI / phase +1 px',
    phasePx: 1,
    lpi: 50,
    reverse: false,
  },
  {
    id: 'phase-2',
    title: '50 LPI / phase +2 px',
    phasePx: 2,
    lpi: 50,
    reverse: false,
  },
  {
    id: 'phase-3',
    title: '50 LPI / phase +3 px',
    phasePx: 3,
    lpi: 50,
    reverse: false,
  },
  {
    id: 'phase-4',
    title: '50 LPI / phase +4 px',
    phasePx: 4,
    lpi: 50,
    reverse: false,
  },
  {
    id: 'phase-5',
    title: '50 LPI / phase +5 px',
    phasePx: 5,
    lpi: 50,
    reverse: false,
  },
];
const LPI_SWEEP_OPTIONS = [
  {
    id: 'lpi-48',
    title: '48.0 LPI / scale check',
    phasePx: 0,
    lpi: 48,
    reverse: false,
  },
  {
    id: 'lpi-49',
    title: '49.0 LPI / scale check',
    phasePx: 0,
    lpi: 49,
    reverse: false,
  },
  {
    id: 'lpi-49-5',
    title: '49.5 LPI / scale check',
    phasePx: 0,
    lpi: 49.5,
    reverse: false,
  },
  {
    id: 'lpi-50',
    title: '50.0 LPI / nominal',
    phasePx: 0,
    lpi: 50,
    reverse: false,
  },
  {
    id: 'lpi-50-5',
    title: '50.5 LPI / scale check',
    phasePx: 0,
    lpi: 50.5,
    reverse: false,
  },
  {
    id: 'lpi-51',
    title: '51.0 LPI / scale check',
    phasePx: 0,
    lpi: 51,
    reverse: false,
  },
  {
    id: 'lpi-52',
    title: '52.0 LPI / scale check',
    phasePx: 0,
    lpi: 52,
    reverse: false,
  },
];
const LENTICULAR_DISPLAY_OPTIONS = PHASE_TEST_OPTIONS;
const PRINTER_DPI = 300;
const REQUIRED_FRAME_COUNT = 2;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const POINTS_PER_INCH = 72;
const LETTER = {
  width: 8.5 * POINTS_PER_INCH,
  height: 11 * POINTS_PER_INCH,
};
const CARD = {
  width: 2.5 * POINTS_PER_INCH,
  height: 3.5 * POINTS_PER_INCH,
};
const BAND = {
  x: 54,
  width: LETTER.width - 108,
};

async function createLenticularCardsPdf({
  participantName = 'A/B calibration',
}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 0,
      autoFirstPage: true,
      bufferPages: false,
      info: {
        Title: 'AI Photobooth A/B Lenticular Calibration',
        Author: 'AI Photobooth',
        Subject: '50 LPI A/B lenticular calibration cards',
      },
    });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    drawLetterBackground(doc);
    drawCalibrationPage(doc, {
      participantName,
      title: '50 LPI phase test',
      subtitle: 'Strong A/B color bands. Find the row with the cleanest red-to-cyan flip.',
      options: PHASE_TEST_OPTIONS,
      bandHeight: 76,
      startY: 91,
      gap: 22,
      footer: 'Page 1: nominal 50 LPI with phase offsets in 600-DPI source pixels.',
    }).then(() => {
      doc.addPage({ size: 'LETTER', margin: 0 });
      drawLetterBackground(doc);
      return drawCalibrationPage(doc, {
        participantName,
        title: '50 LPI pitch sweep',
        subtitle: 'If phase rows are weak, use this page to find whether printer scaling shifts the effective pitch.',
        options: LPI_SWEEP_OPTIONS,
        bandHeight: 66,
        startY: 88,
        gap: 16,
        footer: 'Page 2: nearby pitch values. The strongest row reveals the practical print scale.',
      });
    }).then(() => {
      doc.end();
    }).catch(reject);
  });
}

function drawLetterBackground(doc) {
  doc.save();
  doc.rect(0, 0, LETTER.width, LETTER.height).fill('#ffffff');
  doc.restore();
}

async function drawCalibrationPage(doc, {
  participantName,
  title,
  subtitle,
  options,
  bandHeight,
  startY,
  gap,
  footer,
}) {
  drawCalibrationTitle(doc, {
    participantName,
    title,
    subtitle,
  });

  const bands = await Promise.all(options.map(async (option) => createInterlacedArtImage({
    option,
    widthPt: BAND.width,
    heightPt: bandHeight,
  })));

  options.forEach((option, index) => {
    const y = startY + index * (bandHeight + gap);

    drawCalibrationBand(doc, {
      x: BAND.x,
      y,
      width: BAND.width,
      height: bandHeight,
      option,
      image: bands[index],
    });
  });

  drawSheetFooter(doc, footer);
}

function drawCalibrationTitle(doc, {
  participantName,
  title,
  subtitle,
}) {
  doc.save();
  doc.fillColor('#17191f');
  doc.font('Helvetica-Bold').fontSize(17).text(title, 54, 31, {
    width: 330,
  });
  doc.font('Helvetica').fontSize(8).fillColor('#4f5663').text(cleanName(participantName), 54, 53, {
    width: 330,
  });
  doc.font('Helvetica').fontSize(8).fillColor('#7b5f1e').text(subtitle, 330, 31, {
    width: 228,
    align: 'right',
  });
  doc.restore();
}

function drawCalibrationBand(doc, {
  x,
  y,
  width,
  height,
  image,
  option,
}) {
  doc.save();
  doc.roundedRect(x, y, width, height, 4).fillAndStroke('#ffffff', '#101318');
  doc.image(image.buffer, x, y, {
    width,
    height,
  });
  doc.roundedRect(x, y, width, height, 4).lineWidth(0.8).stroke('#101318');
  drawAlignmentRuler(doc, {
    x,
    y,
    width,
    height,
    lpi: option.lpi,
  });
  drawBandLabel(doc, {
    x,
    y,
    width,
    height,
    option,
  });
  doc.restore();
}

function drawBandLabel(doc, {
  x,
  y,
  width,
  height,
  option,
}) {
  const labelWidth = 156;

  doc.save();
  doc.rect(x, y, labelWidth, 19).fill('#101318');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8).text(option.title, x + 7, y + 6, {
    width: labelWidth - 14,
  });
  doc.rect(x + width - 132, y + height - 18, 132, 18).fill('#ffffff');
  doc.fillColor('#101318').font('Helvetica').fontSize(7).text(`pitch ${(OUTPUT_RASTER_DPI / option.lpi).toFixed(2)} px/lens`, x + width - 126, y + height - 13, {
    width: 120,
    align: 'right',
  });
  doc.restore();
}

function drawAlignmentRuler(doc, art) {
  const tickStep = POINTS_PER_INCH / art.lpi;
  const majorStep = tickStep * 5;

  doc.save();
  doc.strokeColor('#101318').lineWidth(0.25);

  for (let x = art.x; x <= art.x + art.width; x += tickStep) {
    const isMajor = Math.abs(((x - art.x) / majorStep) - Math.round((x - art.x) / majorStep)) < 0.01;
    const tick = isMajor ? 7 : 3.2;

    doc.moveTo(x, art.y - tick).lineTo(x, art.y).stroke();
    doc.moveTo(x, art.y + art.height).lineTo(x, art.y + art.height + tick).stroke();
  }

  doc.restore();
}

async function createInterlacedArtImage({
  option,
  widthPt,
  heightPt,
}) {
  const frames = Array.from({ length: REQUIRED_FRAME_COUNT }, (_, sourceIndex) => ({ sourceIndex }));
  const orderedFrames = option.reverse ? frames.slice().reverse() : frames;
  const width = Math.max(frames.length, Math.round((widthPt / POINTS_PER_INCH) * OUTPUT_RASTER_DPI));
  const height = Math.max(1, Math.round((heightPt / POINTS_PER_INCH) * OUTPUT_RASTER_DPI));
  const pixelsPerLenticule = OUTPUT_RASTER_DPI / option.lpi;
  const resizedFrames = await Promise.all(orderedFrames.map(({ sourceIndex }) => createCalibrationFrame({
    sourceIndex,
    width,
    height,
  })));
  const output = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * width * 4;

    for (let x = 0; x < width; x += 1) {
      const phase = (((x + option.phasePx) / pixelsPerLenticule) % 1 + 1) % 1;
      const frameIndex = Math.min(frames.length - 1, Math.floor(phase * frames.length));
      const frame = resizedFrames[frameIndex];
      const offset = rowOffset + x * 4;

      output[offset] = frame[offset];
      output[offset + 1] = frame[offset + 1];
      output[offset + 2] = frame[offset + 2];
      output[offset + 3] = frame[offset + 3];
    }
  }

  const buffer = await sharp(output, {
    raw: {
      width,
      height,
      channels: 4,
    },
  })
    .png({
      compressionLevel: 9,
      adaptiveFiltering: false,
    })
    .toBuffer();

  return {
    buffer,
    width,
    height,
    pixelsPerInch: OUTPUT_RASTER_DPI,
    pixelsPerLenticule,
  };
}

async function createCalibrationFrame({
  sourceIndex,
  width,
  height,
}) {
  return sharp(Buffer.from(createCalibrationFrameSvg({
    width,
    height,
    label: sourceIndex === 0 ? 'A' : 'B',
    background: sourceIndex === 0 ? '#e6362e' : '#00a878',
    accent: sourceIndex === 0 ? '#ffcf33' : '#182a72',
    anchor: sourceIndex === 0 ? 'left' : 'right',
  })))
    .ensureAlpha()
    .raw()
    .toBuffer();
}

function createCalibrationFrameSvg({
  width,
  height,
  label,
  background,
  accent,
  anchor,
}) {
  const safeLabel = label === 'A' ? 'A' : 'B';
  const markerWidth = Math.round(width * 0.18);
  const markerHeight = Math.round(height * 0.5);
  const markerX = anchor === 'left' ? Math.round(width * 0.035) : width - markerWidth - Math.round(width * 0.035);
  const textX = markerX + markerWidth / 2;
  const largeX = anchor === 'left' ? Math.round(width * 0.36) : Math.round(width * 0.64);
  const largeAnchor = anchor === 'left' ? 'start' : 'end';
  const fontSize = Math.round(height * 0.9);
  const smallFont = Math.round(height * 0.16);
  const centerX = Math.round(width / 2);
  const centerY = Math.round(height / 2);
  const circleRadius = Math.round(Math.min(width, height) * 0.16);
  const rulerStep = Math.round(width / 12);
  const rulerTicks = Array.from({ length: 13 }, (_, index) => {
    const x = index * rulerStep;
    const tick = index % 2 === 0 ? Math.round(height * 0.09) : Math.round(height * 0.055);

    return `<line x1="${x}" y1="0" x2="${x}" y2="${tick}" stroke="#ffffff" stroke-width="5" stroke-opacity="0.9"/>
      <line x1="${x}" y1="${height}" x2="${x}" y2="${height - tick}" stroke="#ffffff" stroke-width="5" stroke-opacity="0.9"/>`;
  }).join('');
  const arrowX = anchor === 'left' ? Math.round(width * 0.08) : Math.round(width * 0.92);
  const arrowEndX = anchor === 'left' ? Math.round(width * 0.25) : Math.round(width * 0.75);

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="${background}"/>
      <rect x="0" y="0" width="${Math.round(width * 0.08)}" height="${height}" fill="${anchor === 'left' ? '#ffffff' : '#101318'}" fill-opacity="0.9"/>
      <rect x="${Math.round(width * 0.92)}" y="0" width="${Math.round(width * 0.08)}" height="${height}" fill="${anchor === 'left' ? '#101318' : '#ffffff'}" fill-opacity="0.9"/>
      <path d="M0 0 L${width} ${height} M${width} 0 L0 ${height}" stroke="#ffffff" stroke-width="11" stroke-opacity="0.7"/>
      <rect x="${markerX}" y="${Math.round(height * 0.08)}" width="${markerWidth}" height="${markerHeight}" rx="${Math.round(markerHeight * 0.12)}" fill="${accent}"/>
      <text x="${textX}" y="${Math.round(height * 0.29)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(markerHeight * 0.62)}" font-weight="800" fill="#ffffff">${safeLabel}</text>
      <circle cx="${centerX}" cy="${centerY}" r="${circleRadius}" fill="none" stroke="#ffffff" stroke-width="9"/>
      <line x1="${centerX - circleRadius * 2}" y1="${centerY}" x2="${centerX + circleRadius * 2}" y2="${centerY}" stroke="#ffffff" stroke-width="7"/>
      <line x1="${centerX}" y1="${centerY - circleRadius * 2}" x2="${centerX}" y2="${centerY + circleRadius * 2}" stroke="#ffffff" stroke-width="7"/>
      <text x="${largeX}" y="${Math.round(height * 0.79)}" text-anchor="${largeAnchor}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="900" fill="#ffffff" fill-opacity="0.98">${safeLabel}</text>
      <text x="${largeX}" y="${Math.round(height * 0.96)}" text-anchor="${largeAnchor}" font-family="Arial, Helvetica, sans-serif" font-size="${smallFont}" font-weight="800" fill="#ffffff">${anchor.toUpperCase()} VIEW</text>
      <line x1="${arrowX}" y1="${Math.round(height * 0.82)}" x2="${arrowEndX}" y2="${Math.round(height * 0.82)}" stroke="#ffffff" stroke-width="10"/>
      <polygon points="${arrowEndX},${Math.round(height * 0.82)} ${anchor === 'left' ? arrowEndX - 26 : arrowEndX + 26},${Math.round(height * 0.74)} ${anchor === 'left' ? arrowEndX - 26 : arrowEndX + 26},${Math.round(height * 0.9)}" fill="#ffffff"/>
      ${rulerTicks}
    </svg>
  `;
}

function drawSheetFooter(doc, footer) {
  doc.save();
  doc.fillColor('#5e6470').font('Helvetica').fontSize(7).text(`${footer} Generated by /api/photobooth/cards.`, 54, 760, {
    width: 504,
    align: 'center',
  });
  doc.restore();
}

function cleanName(value) {
  const text = String(value || 'Participante').trim().replace(/\s+/g, ' ');
  return text.slice(0, 40) || 'Participante';
}

module.exports = {
  LENTICULAR_LPI,
  LENTICULAR_DISPLAY_OPTIONS,
  PHASE_TEST_OPTIONS,
  LPI_SWEEP_OPTIONS,
  OUTPUT_RASTER_DPI,
  PRINTER_DPI,
  REQUIRED_FRAME_COUNT,
  MAX_PHOTO_BYTES,
  createLenticularCardsPdf,
};
