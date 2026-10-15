const express = require('express');
const axios = require('axios');
const sharp = require('sharp');
require('dotenv').config();

const router = express.Router();

// Lazy-load the background removal module
let removeBackgroundFn = null;
async function getRemoveBackground() {
  if (!removeBackgroundFn) {
    const mod = await import('@imgly/background-removal-node');
    removeBackgroundFn = mod.removeBackground;
  }
  return removeBackgroundFn;
}

// ============================================================================
// STAGE 1: PROMPT INTENT CLASSIFIER
// ============================================================================
const SCENE_KEYWORDS = [
  'sunrise', 'sunset', 'landscape', 'skyline', 'cityscape', 'horizon',
  'ocean', 'mountain', 'forest', 'beach', 'desert', 'underwater', 'space',
  'galaxy', 'nebula', 'aurora', 'northern lights', 'night sky', 'starry',
  'weather', 'storm', 'rain', 'snow', 'clouds', 'atmosphere', 'panorama',
  'valley', 'canyon', 'waterfall', 'river', 'lake', 'island', 'volcano',
  'field', 'meadow', 'garden', 'jungle', 'swamp', 'cave', 'ruins',
  'alley', 'street view', 'rooftop', 'window view', 'balcony view',
  'dawn', 'dusk', 'twilight', 'moonlight', 'midnight', 'golden hour',
  'in the dark', 'at night', 'in the rain', 'in the sky', 'in the distance'
];

const SUBJECT_KEYWORDS = [
  'dog', 'cat', 'wolf', 'tiger', 'lion', 'dragon', 'snake', 'cobra', 'eagle',
  'hawk', 'raven', 'skull', 'skeleton', 'reaper', 'samurai', 'ninja', 'ronin',
  'knight', 'warrior', 'robot', 'cyborg', 'mecha', 'demon', 'oni', 'angel',
  'statue', 'car', 'motorcycle', 'astronaut', 'alien', 'monster', 'bear',
  'panda', 'fox', 'kitsune', 'shark', 'octopus', 'phoenix', 'ramen', 'sword',
  'katana', 'rose', 'flower', 'lotus', 'mask', 'helmet', 'character', 'mascot'
];

const TYPOGRAPHIC_KEYWORDS = [
  'font', 'text', 'letter', 'lettering', 'typography', 'quote', 'saying',
  'word', 'words', 'slogan', 'write', 'written', 'calligraphy', 'script',
  'gothic letters', 'retro font', 'bold text', 'graffiti text', 'neon text',
  'in gothic', 'in cursive', 'handwritten', 'typeface'
];

function classifyPrompt(userPrompt) {
  const lower = userPrompt.toLowerCase();

  for (const kw of TYPOGRAPHIC_KEYWORDS) {
    if (lower.includes(kw)) return 'TYPOGRAPHIC';
  }

  let sceneScore = 0;
  for (const kw of SCENE_KEYWORDS) {
    if (lower.includes(kw)) sceneScore++;
  }

  let subjectScore = 0;
  for (const kw of SUBJECT_KEYWORDS) {
    if (lower.includes(kw)) subjectScore++;
  }

  if (sceneScore >= 1 && subjectScore === 0) return 'SCENE';

  return 'SUBJECT';
}

// ============================================================================
// STAGE 2: ART DIRECTOR PROMPT BUILDER (#808080 Mid-Gray Background)
// ============================================================================
function buildArtDirectorPrompt(userPrompt, category) {
  const clean = userPrompt
    .replace(/\b(t-shirt|tshirt|shirt|hoodie|mockup|mannequin|apparel)\b/gi, '')
    .trim();

  switch (category) {
    case 'SUBJECT':
      return {
        prompt: `${clean}, highly detailed digital illustration, streetwear graphic art style, dynamic pose, organic irregular silhouette, floating in empty space, sharp clean edges, rich vibrant colors, professional vector quality, isolated on a flat uniform solid #808080 neutral gray background`,
        category: 'SUBJECT'
      };

    case 'SCENE':
      return {
        prompt: `${clean}, epic widescreen panoramic composition rendered as a detailed graphic illustration, horizontal band artwork, dramatic cinematic lighting, rich saturated colors, painterly style, artwork edges dissolve and fade softly into flat uniform solid pure black, soft painterly edge fade, vignette dissolve into black at all borders, on a flat uniform solid pure black background #000000`,
        category: 'SCENE'
      };

    case 'TYPOGRAPHIC':
      return {
        prompt: `${clean}, bold custom typography, graphic lettering design, decorative text composition, streetwear fashion typography, clean readable letters, sharp edges, professional quality, isolated on a flat uniform solid #808080 neutral gray background`,
        category: 'TYPOGRAPHIC'
      };

    default:
      return {
        prompt: `${clean}, detailed digital illustration, streetwear graphic art style, organic irregular silhouette, floating in empty space, isolated on a flat uniform solid #808080 neutral gray background`,
        category: 'SUBJECT'
      };
  }
}

// ============================================================================
// STAGE 3: 100% HUGGING FACE GENERATION (Flux Primary -> SDXL Fallback)
// ============================================================================
async function generateWithHuggingFace(engineeredPrompt, modelEndpoint) {
  const HF_TOKEN = process.env.HUGGINGFACE_KEY?.trim();
  const API_URL = `https://router.huggingface.co/hf-inference/models/${modelEndpoint}`;

  const response = await axios.post(
    API_URL,
    { inputs: engineeredPrompt },
    {
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'image/png'
      },
      responseType: 'arraybuffer',
      timeout: 120000,
    }
  );

  return Buffer.from(response.data);
}

async function generateImage(engineeredPrompt) {
  // Try Primary Model: FLUX.1-schnell (Best for text and streetwear graphics)
  try {
    console.log('   → Trying Primary: Hugging Face FLUX.1-schnell...');
    const buffer = await generateWithHuggingFace(engineeredPrompt, 'black-forest-labs/FLUX.1-schnell');
    console.log('   ✓ FLUX.1-schnell succeeded');
    return buffer;
  } catch (hfError) {
    const status = hfError.response?.status;
    console.log(`   ⚠ FLUX failed (${status || 'network'}). Switching to Fallback...`);

    if (status === 503) {
      console.log('   ⏳ FLUX model cold-starting, waiting 10 seconds...');
      await new Promise(r => setTimeout(r, 10000));
    }
  }

  // Try Fallback Model: SDXL (Rock solid, highly reliable architecture)
  console.log('   → Trying Fallback: Hugging Face SDXL...');
  const buffer = await generateWithHuggingFace(engineeredPrompt, 'stabilityai/stable-diffusion-xl-base-1.0');
  console.log('   ✓ SDXL succeeded');
  return buffer;
}

// ============================================================================
// STAGES 5-6: ALPHA DECONTAMINATION + BFS INTERIOR LOCK + FEATHERING
// ============================================================================
function decontaminateAndLockAlpha(rawPixels, alphaPixels, width, height) {
  const output = new Uint8Array(rawPixels.length);

  const BG_R = rawPixels[0] || 128;
  const BG_G = rawPixels[1] || 128;
  const BG_B = rawPixels[2] || 128;

  // Pass 1: Un-premultiply edge color correction
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const neuralAlpha = alphaPixels[idx + 3];

    if (neuralAlpha === 0) {
      output[idx] = 0; output[idx + 1] = 0; output[idx + 2] = 0; output[idx + 3] = 0;
    } else if (neuralAlpha === 255) {
      output[idx] = rawPixels[idx]; output[idx + 1] = rawPixels[idx + 1]; output[idx + 2] = rawPixels[idx + 2]; output[idx + 3] = 255;
    } else {
      const a = neuralAlpha / 255.0;
      const oneMinusA = 1.0 - a;

      output[idx] = Math.min(255, Math.max(0, Math.round((rawPixels[idx] - BG_R * oneMinusA) / a)));
      output[idx + 1] = Math.min(255, Math.max(0, Math.round((rawPixels[idx + 1] - BG_G * oneMinusA) / a)));
      output[idx + 2] = Math.min(255, Math.max(0, Math.round((rawPixels[idx + 2] - BG_B * oneMinusA) / a)));
      output[idx + 3] = neuralAlpha;
    }
  }

  // Pass 2: 8-connected BFS
  const isExterior = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0, tail = 0;

  const tryEnqueue = (x, y) => {
    const pos = y * width + x;
    if (!isExterior[pos] && alphaPixels[pos * 4 + 3] < 128) {
      isExterior[pos] = 1; queue[tail++] = pos;
    }
  };

  for (let x = 0; x < width; x++) { tryEnqueue(x, 0); tryEnqueue(x, height - 1); }
  for (let y = 0; y < height; y++) { tryEnqueue(0, y); tryEnqueue(width - 1, y); }

  while (head < tail) {
    const pos = queue[head++];
    const x = pos % width;
    const y = (pos - x) / width;

    if (x > 0) tryEnqueue(x - 1, y);
    if (x < width - 1) tryEnqueue(x + 1, y);
    if (y > 0) tryEnqueue(x, y - 1);
    if (y < height - 1) tryEnqueue(x, y + 1);
    if (x > 0 && y > 0) tryEnqueue(x - 1, y - 1);
    if (x < width - 1 && y > 0) tryEnqueue(x + 1, y - 1);
    if (x > 0 && y < height - 1) tryEnqueue(x - 1, y + 1);
    if (x < width - 1 && y < height - 1) tryEnqueue(x + 1, y + 1);
  }

  // Pass 3: Apply lock
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const idx = i * 4;

      if (isExterior[i]) {
        output[idx] = 0; output[idx + 1] = 0; output[idx + 2] = 0; output[idx + 3] = 0;
      } else {
        const touchesExterior = (x > 0 && isExterior[i - 1]) || (x < width - 1 && isExterior[i + 1]) || (y > 0 && isExterior[i - width]) || (y < height - 1 && isExterior[i + width]);
        if (!touchesExterior) {
          output[idx] = rawPixels[idx]; output[idx + 1] = rawPixels[idx + 1]; output[idx + 2] = rawPixels[idx + 2]; output[idx + 3] = 255;
        }
      }
    }
  }

  // Pass 4: Feathering
  const finalOutput = new Uint8Array(output);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const pos = y * width + x;
      if (!isExterior[pos] && output[pos * 4 + 3] > 200) {
        let extCount = 0;
        extCount += isExterior[pos - 1] ? 1 : 0; extCount += isExterior[pos + 1] ? 1 : 0;
        extCount += isExterior[pos - width] ? 1 : 0; extCount += isExterior[pos + width] ? 1 : 0;
        extCount += isExterior[pos - width - 1] ? 1 : 0; extCount += isExterior[pos - width + 1] ? 1 : 0;
        extCount += isExterior[pos + width - 1] ? 1 : 0; extCount += isExterior[pos + width + 1] ? 1 : 0;

        if (extCount > 0) {
          finalOutput[pos * 4 + 3] = Math.max(0, Math.round(output[pos * 4 + 3] * (1 - extCount * 0.10)));
        }
      }
    }
  }

  return finalOutput;
}

// ============================================================================
// STAGE 7: TIGHT CROP + PADDING NORMALIZATION
// ============================================================================
async function tightCropWithPadding(pixelData, width, height, padding = 20) {
  let minX = width, minY = height, maxX = 0, maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (pixelData[idx + 3] > 15) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return sharp(Buffer.from(pixelData), { raw: { width, height, channels: 4 } }).png().toBuffer();
  }

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  return sharp(Buffer.from(pixelData), { raw: { width, height, channels: 4 } })
    .extract({ left: minX, top: minY, width: cropW, height: cropH })
    .extend({ top: padding, bottom: padding, left: padding, right: padding, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

// ============================================================================
// MAIN PIPELINE ENDPOINT
// ============================================================================
router.post('/generate', async (req, res) => {
  try {
    const { prompt } = req.body;

    const category = classifyPrompt(prompt);
    console.log(`\n🧠 Stage 1 — Prompt classified as: ${category}`);

    const artDirected = buildArtDirectorPrompt(prompt, category);
    console.log(`✨ Stage 2 — Art Director prompt:\n   "${artDirected.prompt}"`);

    console.log('🎨 Stage 3 — Generating artwork...');
    const rawImageBuffer = await generateImage(artDirected.prompt);
    console.log(`   ✓ Received ${(rawImageBuffer.length / 1024).toFixed(0)}KB image`);

    // Ensure it's a PNG and wrap it in a Blob for the neural matting
    const normalizedPngBuffer = await sharp(rawImageBuffer).png().toBuffer();
    const inputBlob = new Blob([normalizedPngBuffer], { type: 'image/png' });

    console.log('🔬 Stage 4 — Running server-side neural background segmentation...');
    const removeBackground = await getRemoveBackground();
    const segmentedBlob = await removeBackground(inputBlob, {
      model: 'medium',
      output: { format: 'image/png', quality: 1.0 },
    });
    const segmentedBuffer = Buffer.from(await segmentedBlob.arrayBuffer());
    console.log('   ✓ Neural segmentation complete');

    const original = await sharp(normalizedPngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const segmented = await sharp(segmentedBuffer).resize(original.info.width, original.info.height).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    console.log('🧪 Stages 5-6 — Alpha decontamination, BFS interior lock, contour feathering...');
    const cleanedPixels = decontaminateAndLockAlpha(original.data, segmented.data, original.info.width, original.info.height);
    console.log('   ✓ Edge decontamination complete');

    console.log('✂️ Stage 7 — Tight cropping and padding normalization...');
    const finalPng = await tightCropWithPadding(cleanedPixels, original.info.width, original.info.height, 20);
    
    const base64Image = `data:image/png;base64,${finalPng.toString('base64')}`;

    console.log('✅ Pipeline complete — sending clean transparent cutout to frontend.');
    res.json({
      imageUrl: base64Image,
      category: artDirected.category,
    });

  } catch (error) {
    console.error('❌ Pipeline Error:', error.message || error);
    res.status(500).json({ error: 'Failed to process design pipeline.' });
  }
});

module.exports = router;