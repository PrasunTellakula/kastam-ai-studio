const express = require('express');
const axios = require('axios');
const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;
const Design = require('../models/Design');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID?.trim(),
  key_secret: process.env.RAZORPAY_KEY_SECRET?.trim()
});
require('dotenv').config();

const router = express.Router();

// ============================================================================
// CLOUDINARY CONFIGURATION
// ============================================================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
  api_key: process.env.CLOUDINARY_API_KEY?.trim(),
  api_secret: process.env.CLOUDINARY_API_SECRET?.trim()
});

// ============================================================================
// STAGE 1 & 2: GROQ LLM ART DIRECTOR
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

  return Buffer.from(response.data.result.image, 'base64');
}

// ============================================================================
// ENDPOINT: GENERATE ARTWORK (/generate)
// ============================================================================
// NEW: AI Generation Rate Limiter (Max 5 requests per minute per IP)
const generateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 5, 
  message: { error: 'Too many designs generated from this IP. Please wait 60 seconds.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Inject the limiter as middleware before the async function
router.post('/generate', generateLimiter, async (req, res) => {
  try {
    const { prompt } = req.body;

    console.log(`\n🧠 Stage 1 & 2 — Groq Art Director analyzing: "${prompt}"...`);
    const artDirected = await buildArtDirectorPrompt(prompt);
    
    console.log(`   ✓ Classified as: [${artDirected.category}]`);
    console.log(`✨ Art Director Prompt:\n   "${artDirected.prompt}"`);

    console.log('🎨 Stage 3 — Generating watermark-free artwork via Cloudflare Flux...');
    const rawImageBuffer = await generateWithCloudflare(artDirected.prompt);
    console.log(`   ✓ Received ${(rawImageBuffer.length / 1024).toFixed(0)}KB image`);

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

// ============================================================================
// ENDPOINT: PUBLISH TO STOREFRONT (/save)
// ============================================================================
router.post('/save', async (req, res) => {
  try {
    const { frontPrompt, backPrompt, frontImage, backImage, color, userId, userName } = req.body;

    if (!frontImage && !backImage) {
      return res.status(400).json({ error: 'You must generate at least one design to publish.' });
    }

    let finalFrontUrl = null;
    let finalBackUrl = null;

    console.log('\n☁️ Uploading finished Base64 designs to Cloudinary CDN...');

    const uploadToCDN = async (base64String, side) => {
      const result = await cloudinary.uploader.upload(base64String, {
        folder: 'kastam_storefront',
        public_id: `kastam_${Date.now()}_${side}`,
      });
      return cloudinary.url(result.public_id, {
        secure: true,
        fetch_format: 'auto',
        quality: 'auto'
      });
    };

    if (frontImage) {
      finalFrontUrl = await uploadToCDN(frontImage, 'front');
      console.log(`   ✓ Front design uploaded: ${finalFrontUrl}`);
    }
    if (backImage) {
      finalBackUrl = await uploadToCDN(backImage, 'back');
      console.log(`   ✓ Back design uploaded: ${finalBackUrl}`);
    }

    console.log('💾 Saving document to MongoDB...');
    const newDesign = new Design({
      frontPrompt: frontPrompt || null,
      backPrompt: backPrompt || null,
      shirtColor: color,
      frontImageUrl: finalFrontUrl,
      backImageUrl: finalBackUrl,
      creatorId: userId || null,
      creatorName: userName || 'Anonymous'
    });

    await newDesign.save();

    console.log('✅ Successfully published to storefront!');
    res.status(201).json({ message: 'Design successfully published to the storefront!' });

  } catch (error) {
    console.error('❌ Database/Upload Error:', error);
    res.status(500).json({ error: 'Failed to publish design.' });
  }
});

// ============================================================================
// ENDPOINT: FETCH ALL STOREFRONT DESIGNS (/all)
// ============================================================================
router.get('/all', async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};

    if (search && search.trim() !== '') {
      const safeSearch = search.trim();
      console.log(`\n🔍 Storefront Search Triggered for: "${safeSearch}"`);
      
      // Native JavaScript RegExp (bypasses MongoDB $regex null-crashing bugs)
      const searchRegex = new RegExp(safeSearch, 'i');
      
      query = {
        $or: [
          { prompt: searchRegex },
          { frontPrompt: searchRegex },
          { backPrompt: searchRegex },
          { creatorName: searchRegex }
        ]
      };
    } else {
      console.log('\n📦 Fetching all designs (No search filter applied)');
    }

    const designs = await Design.find(query).sort({ createdAt: -1 });
    res.json(designs);
  } catch (error) {
    console.error('❌ Fetch Error:', error);
    res.status(500).json({ error: 'Failed to fetch storefront designs.' });
  }
});

// ============================================================================
// ENDPOINT: FETCH USER'S PRIVATE WARDROBE (/user/:userId)
// ============================================================================
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { search } = req.query;
    
    // Always filter by the specific user's ID
    let query = { creatorId: userId };

    if (search && search.trim() !== '') {
      const safeSearch = search.trim();
      console.log(`\n🔍 Wardrobe Search Triggered for: "${safeSearch}"`);
      
      // Native JavaScript RegExp bypasses MongoDB null-crashing bugs
      const searchRegex = new RegExp(safeSearch, 'i');

      // Use $and to ensure it only searches WITHIN this user's designs
      query = {
        $and: [
          { creatorId: userId },
          {
            $or: [
              { prompt: searchRegex },
              { frontPrompt: searchRegex },
              { backPrompt: searchRegex }
            ]
          }
        ]
      };
    } else {
      console.log(`\n📦 Fetching entire wardrobe for user: ${userId}`);
    }

    const userDesigns = await Design.find(query).sort({ createdAt: -1 });
    res.json(userDesigns);
  } catch (error) {
    console.error('❌ Wardrobe Fetch Error:', error);
    res.status(500).json({ error: 'Failed to fetch user wardrobe.' });
  }
});

// ============================================================================
// ENDPOINT: DELETE A DESIGN (/delete/:id)
// ============================================================================
router.delete('/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`\n🗑️ [DELETE ROUTE CONNECTED] Attempting to delete design ID: ${id}`);
    
    // Find the design and delete it
    const deletedDesign = await Design.findByIdAndDelete(id);
    
    if (!deletedDesign) {
      console.log(`   ❌ Failed: Design ${id} not found in MongoDB.`);
      return res.status(404).json({ error: 'Design not found.' });
    }

    console.log(`   ✅ Successfully deleted design: ${id}`);
    res.json({ message: 'Design successfully deleted.' });
  } catch (error) {
    console.error('❌ Delete Error:', error);
    res.status(500).json({ error: 'Failed to delete design.' });
  }
});

// ============================================================================
// ENDPOINT: CREATE PAYMENT ORDER (/order/create)
// ============================================================================
router.post('/order/create', async (req, res) => {
  try {
    const { material, designId, buyerId, useCredits } = req.body;

    const baseCost = material === 'premium' ? 700 : 500;
    const retailPrice = material === 'premium' ? 999 : 799;
    let finalPayable = retailPrice;
    let creditsApplied = 0;

    // RULE 1: THE HARD FLOOR. Max discount allowed protects base manufacturing cost.
    const maxDiscountAllowed = retailPrice - baseCost;

    if (useCredits && buyerId) {
      const User = require('../models/User');
      const buyer = await User.findById(buyerId);
      
      if (buyer && buyer.publishCredits > 0) {
        creditsApplied = Math.min(buyer.publishCredits, maxDiscountAllowed);
        finalPayable = retailPrice - creditsApplied;
      }
    }

    const options = {
      amount: finalPayable * 100, // Razorpay expects paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: { 
        designId, 
        buyerId: buyerId || 'guest',
        creditsApplied: creditsApplied.toString()
      } 
    };

    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    console.error('❌ Razorpay Order Error:', error);
    res.status(500).json({ error: 'Payment gateway failed.' });
  }
});

// ============================================================================
// ENDPOINT: VERIFY PAYMENT & DISTRIBUTE ROYALTIES (/order/verify)
// ============================================================================
router.post('/order/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, designId, buyerId, creditsApplied } = req.body;

    const secret = process.env.RAZORPAY_KEY_SECRET;
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    
    const expectedSignature = crypto.createHmac('sha256', secret).update(body.toString()).digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Transaction manipulated.' });
    }

    const User = require('../models/User'); 
    const appliedCreditValue = parseInt(creditsApplied) || 0;

    // 1. Deduct the used credits from the Buyer's wallet
    if (appliedCreditValue > 0 && buyerId && buyerId !== 'guest') {
      await User.findByIdAndUpdate(buyerId, {
        $inc: { publishCredits: -appliedCreditValue }
      });
    }

    // 2. Add royalties to the Creator
    const design = await Design.findById(designId);
    if (design && design.creatorId) {
      // RULE 2: NO DOUBLE DIPPING. Scale down the new minted royalty based on credits used.
      const standardMarkup = 299; 
      const cashPaidForMarkup = Math.max(0, standardMarkup - appliedCreditValue);
      const royaltyRatio = cashPaidForMarkup / standardMarkup;
      
      const effectiveRoyalty = Math.round(150 * royaltyRatio);

      if (effectiveRoyalty > 0) {
        await User.findByIdAndUpdate(design.creatorId, {
          $inc: { publishCredits: effectiveRoyalty }
        });
      }
    }

    res.json({ message: 'Payment verified and ledgers updated!' });
  } catch (error) {
    console.error('❌ Verification Error:', error);
    res.status(500).json({ error: 'Failed to verify payment.' });
  }
});

module.exports = router;