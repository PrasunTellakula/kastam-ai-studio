const express = require('express');
const axios = require('axios');
const sharp = require('sharp');
require('dotenv').config();

const router = express.Router();

// ============================================================================
// STAGE 1 & 2: GROQ LLM ART DIRECTOR (Extracts clean text & prevents letterboxing)
// ============================================================================
async function buildArtDirectorPrompt(rawPrompt) {
  const cleanUserPrompt = rawPrompt
    .replace(/\b(t-shirt|tshirt|shirt|hoodie|mockup|mannequin|apparel)\b/gi, '')
    .trim();

  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (!groqKey) {
    throw new Error('Valid GROQ_API_KEY is missing from .env');
  }

  const systemPrompt = `You are a Principal Art Director for a premium streetwear brand.
Convert the user's raw input into a JSON object with "category" and a single detailed diffusion prompt (under 50 words).

CATEGORIES:
1. "TYPOGRAPHIC": If the user wants words/letters/slogans.
   - Extract the EXACT words intended, discarding conversational filler like "text that has", "print", "write".
   - Wrap the exact words in double quotes.
   - Format: 'Streetwear graphic typography displaying the text "[EXACT_TEXT]", bold collegiate varsity lettering, clean sharp vector letterforms, high contrast, solid opaque fills, floating freely with empty space between letters, no solid background slab, no grunge box behind text, isolated on a flat uniform solid #808080 neutral gray background'

2. "SCENE": If the user describes landscapes, sunrises, sunsets, nature, or city skylines.
   - NEVER use words like "widescreen", "panoramic", or "horizontal band" (these cause black letterbox bars).
   - Format: 'Stylized streetwear landscape graphic illustration of [concept], dramatic lighting, rich saturated colors, self-contained organic mountain and skyline composition with clean outer edges, no letterbox bars, isolated on a flat uniform solid #808080 neutral gray background'

3. "SUBJECT": For characters, animals, mascots, objects.
   - Format: '[concept], highly detailed digital illustration, streetwear graphic art style, dynamic pose, organic irregular silhouette floating in empty space, sharp clean edges, rich vibrant colors, isolated on a flat uniform solid #808080 neutral gray background'

Output ONLY valid JSON: {"category": "SUBJECT" | "SCENE" | "TYPOGRAPHIC", "prompt": "..."}`;

  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: 'openai/gpt-oss-20b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: cleanUserPrompt }
      ],
      response_format: { type: 'json_object' }
    },
    {
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return JSON.parse(response.data.choices[0].message.content);
}

// ============================================================================
// STAGE 3: CLOUDFLARE WORKERS AI (FLUX.1-schnell)
// ============================================================================
async function generateWithCloudflare(engineeredPrompt) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();

  if (!accountId || !apiToken) {
    throw new Error('Valid Cloudflare credentials missing from .env');
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`;

  const response = await axios.post(
    url,
    { prompt: engineeredPrompt },
    {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.data.success) {
    throw new Error(JSON.stringify(response.data.errors));
  }

  const base64Image = response.data.result.image;
  return Buffer.from(base64Image, 'base64');
}

// ============================================================================
// MAIN PIPELINE ENDPOINT
// ============================================================================
router.post('/generate', async (req, res) => {
  try {
    const { prompt } = req.body;

    console.log(`\n🧠 Stage 1 & 2 — Groq Art Director analyzing: "${prompt}"...`);
    const artDirected = await buildArtDirectorPrompt(prompt);
    
    console.log(`   ✓ Classified as: [${artDirected.category}]`);
    console.log(`✨ Art Director Prompt:\n   "${artDirected.prompt}"`);

    console.log('🎨 Stage 3 — Generating watermark-free artwork via Cloudflare Flux...');
    const rawImageBuffer = await generateWithCloudflare(artDirected.prompt);
    console.log(`   ✓ Received ${(rawImageBuffer.length / 1024).toFixed(0)}KB image`);

    // Ensure standard PNG format
    const normalizedPngBuffer = await sharp(rawImageBuffer).png().toBuffer();
    const base64Image = `data:image/png;base64,${normalizedPngBuffer.toString('base64')}`;

    console.log('✅ Sending #808080 artwork to frontend for universal neural matting.');
    res.json({
      imageUrl: base64Image,
      category: artDirected.category,
    });

  } catch (error) {
    const errorDetails = error.response?.data ? JSON.stringify(error.response.data) : error.message;
    console.error('❌ Pipeline Error:', errorDetails);
    res.status(500).json({ error: 'Failed to process design pipeline.' });
  }
});

module.exports = router;