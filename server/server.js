require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Bypass para erro de certificado (fetch failed)
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const fs = require('fs');
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json({ 
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize face-api, tfjs, and napi-rs canvas
const sharp = require('sharp');
const tf = require('@tensorflow/tfjs');
require('@tensorflow/tfjs-backend-wasm');
const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');
const { Canvas: NapiCanvas, Image, ImageData, loadImage } = require('@napi-rs/canvas');

// Subclass NapiCanvas to provide default width/height so native Rust bindings don't crash when instantiated without args
class WrappedCanvas extends NapiCanvas {
  constructor(width, height) {
    const w = typeof width === 'number' ? width : 300;
    const h = typeof height === 'number' ? height : 150;
    super(w, h);
  }
}

// Monkey patch face-api.js environment
faceapi.env.monkeyPatch({ Canvas: WrappedCanvas, Image, ImageData });

// Helper to download face-api weights if they don't exist
const downloadWeights = async () => {
  const weightsDir = path.join(__dirname, 'weights');
  if (!fs.existsSync(weightsDir)) {
    fs.mkdirSync(weightsDir);
  }
  const files = [
    'ssd_mobilenetv1_model-weights_manifest.json',
    'ssd_mobilenetv1_model.bin',
    'face_landmark_68_model-weights_manifest.json',
    'face_landmark_68_model.bin',
    'face_recognition_model-weights_manifest.json',
    'face_recognition_model.bin'
  ];
  const baseUrl = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model/';
  for (const file of files) {
    const filePath = path.join(weightsDir, file);
    if (!fs.existsSync(filePath)) {
      console.log(`[FaceAPI] Baixando peso: ${file}...`);
      const response = await fetch(baseUrl + file);
      if (!response.ok) {
        throw new Error(`Falha ao baixar peso ${file}: ${response.statusText}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(filePath, buffer);
      console.log(`[FaceAPI] Peso ${file} salvo com sucesso.`);
    }
  }
};

let isModelLoaded = false;
const loadModel = async () => {
  if (isModelLoaded) return;
  
  try {
    console.log('[FaceAPI] Inicializando backend WASM do TensorFlow.js...');
    await tf.setBackend('wasm');
    await tf.ready();
    console.log('[FaceAPI] Backend WASM pronto:', tf.getBackend());
  } catch (error) {
    console.error('[FaceAPI] Erro ao inicializar o backend WASM do TFJS:', error);
    throw error;
  }

  await downloadWeights();
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(path.join(__dirname, 'weights'));
  await faceapi.nets.faceLandmark68Net.loadFromDisk(path.join(__dirname, 'weights'));
  await faceapi.nets.faceRecognitionNet.loadFromDisk(path.join(__dirname, 'weights'));
  isModelLoaded = true;
  console.log('[FaceAPI] Modelos de detecção, landmarks e reconhecimento facial carregados!');
};

// Get face landmarks and descriptors
const getFaceDescriptor = async (imageBuffer) => {
  const img = await loadImage(imageBuffer);
  const detection = await faceapi.detectSingleFace(img)
    .withFaceLandmarks()
    .withFaceDescriptor();
  return detection ? detection.descriptor : null;
};

// Check if original and generated faces are different
const isFaceDifferent = (descriptor1, descriptor2) => {
  if (!descriptor1 || !descriptor2) return true;
  const distance = faceapi.euclideanDistance(descriptor1, descriptor2);
  console.log(`[Validation] Distância Euclidiana entre faces: ${distance.toFixed(4)}`);
  return distance > 0.6; // standard threshold
};

// Prepare photo by cropping the face with a 60% margin and resizing
const preparePhoto = async (photoBuffer) => {
  await loadModel();
  
  const img = await loadImage(photoBuffer);
  const detection = await faceapi.detectSingleFace(img);
  
  if (!detection) {
    throw new Error("Foto sem rosto visível");
  }
  
  const { x, y, width, height } = detection.box;
  const margin = 0.60;
  const extraW = width * margin;
  const extraH = height * margin;

  let cropX = Math.round(x - extraW / 2);
  let cropY = Math.round(y - extraH / 2);
  let cropW = Math.round(width + extraW);
  let cropH = Math.round(height + extraH);

  // Clamp coordinates
  if (cropX < 0) {
    cropW += cropX;
    cropX = 0;
  }
  if (cropY < 0) {
    cropH += cropY;
    cropY = 0;
  }
  if (cropX + cropW > img.width) {
    cropW = img.width - cropX;
  }
  if (cropY + cropH > img.height) {
    cropH = img.height - cropY;
  }

  if (cropW <= 0 || cropH <= 0) {
    throw new Error("Recorte de face inválido.");
  }

  const croppedBuffer = await sharp(photoBuffer)
    .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
    .resize({
      width: 768,
      height: 1024,
      fit: 'cover',
      position: 'center'
    })
    .jpeg({ quality: 92 })
    .toBuffer();

  return croppedBuffer.toString('base64');
};

const getCountryCode = (clubUpper) => {
  if (clubUpper.includes('ARGENTINA')) return 'ARG';
  if (clubUpper.includes('PORTUGAL')) return 'POR';
  if (clubUpper.includes('FRANCA') || clubUpper.includes('FRANÇA')) return 'FRA';
  if (clubUpper.includes('COREIA') || clubUpper.includes('KOREA')) return 'KOR';
  if (clubUpper.includes('ESPANHA') || clubUpper.includes('SPAIN')) return 'ESP';
  if (clubUpper.includes('NORUEGA') || clubUpper.includes('NORWAY')) return 'NOR';
  return 'BRA';
};

const getCountryConfig = (countryCode) => {
  const configs = {
    ARG: {
      bgDescription: "sky blue and white vertical stripes",
      flag: "Argentina",
      jerseyDescription: "sky blue and white striped Argentina national team shirt with black collar"
    },
    POR: {
      bgDescription: "red and green background graphic",
      flag: "Portugal",
      jerseyDescription: "red Portugal national team shirt with green details"
    },
    FRA: {
      bgDescription: "blue background with white and red shapes",
      flag: "France",
      jerseyDescription: "navy blue France national team shirt with white logo"
    },
    KOR: {
      bgDescription: "red background with black and white shapes",
      flag: "South Korea",
      jerseyDescription: "red South Korea national team shirt"
    },
    ESP: {
      bgDescription: "red background with yellow shapes",
      flag: "Spain",
      jerseyDescription: "red Spain national team shirt with yellow details"
    },
    NOR: {
      bgDescription: "red background with blue and white cross shapes",
      flag: "Norway",
      jerseyDescription: "red Norway national team shirt with blue details"
    },
    BRA: {
      bgDescription: "turquoise with green '26' graphic and yellow shape",
      flag: "Brazil",
      jerseyDescription: "yellow Brazil national team shirt with green collar (CBF Nike style)"
    }
  };
  return configs[countryCode] || configs.BRA;
};

const formatStats = (height, weight) => {
  let formattedHeight = '1,50 m';
  if (height) {
    const cleanHeight = height.toString().replace(/\D/g, '');
    if (cleanHeight.length === 3) {
      formattedHeight = `${cleanHeight[0]},${cleanHeight.slice(1)} m`;
    } else if (cleanHeight.length === 2) {
      formattedHeight = `0,${cleanHeight} m`;
    } else {
      formattedHeight = `${cleanHeight} m`;
    }
  }

  let formattedWeight = '35 kg';
  if (weight) {
    const cleanWeight = weight.toString().replace(/\D/g, '');
    formattedWeight = `${cleanWeight} kg`;
  }
  return `${formattedHeight} | ${formattedWeight}`;
};

const getReferenceTemplateBase64 = (countryCode) => {
  const possiblePaths = [
    `D:\\STUDIOVIVA\\imagens\\referencia_${countryCode}.png`,
    path.join(__dirname, 'templates', `referencia_${countryCode}.png`),
    `D:\\STUDIOVIVA\\imagens\\referencia.png`,
    path.join(__dirname, 'template.png')
  ];

  for (const targetPath of possiblePaths) {
    if (fs.existsSync(targetPath)) {
      console.log(`[Config] Usando template de referência em: ${targetPath}`);
      return fs.readFileSync(targetPath).toString('base64');
    }
  }
  throw new Error("Nenhum template de referência encontrado.");
};

// SSE stream decoding
const decodeStream = async (response) => {
  const decoder = new TextDecoder();
  let buffer = "";
  let imageBase64 = null;
  let mimeType = "image/png";

  const stream = response.body;
  if (typeof stream[Symbol.asyncIterator] === 'function') {
    for await (const chunk of stream) {
      buffer += decoder.decode(chunk, { stream: true });
      const result = parseBuffer(buffer);
      buffer = result.buffer;
      if (result.imageBase64) {
        imageBase64 = result.imageBase64;
        mimeType = result.mimeType;
      }
    }
  } else {
    const reader = stream.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const result = parseBuffer(buffer);
      buffer = result.buffer;
      if (result.imageBase64) {
        imageBase64 = result.imageBase64;
        mimeType = result.mimeType;
      }
    }
  }
  return { imageBase64, mimeType };
};

const parseBuffer = (buffer) => {
  const lines = buffer.split(/\r?\n/);
  const remainingBuffer = lines.pop() ?? "";
  let imageBase64 = null;
  let mimeType = "image/png";
  
  for (const line of lines) {
    if (!line.startsWith("data:")) continue;
    const raw = line.slice(5).trim();
    if (!raw || raw === "[DONE]") continue;
    try {
      const json = JSON.parse(raw);
      const parts = json?.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part?.inlineData?.data) {
          imageBase64 = part.inlineData.data;
          mimeType = part.inlineData.mimeType ?? "image/png";
        }
      }
    } catch (e) {}
  }
  return { buffer: remainingBuffer, imageBase64, mimeType };
};

// Call Gemini API streaming endpoint with auto model fallback and error retries
const callGeminiWithRetry = async (payload, apiKey) => {
  const models = ['gemini-3.1-flash-image', 'gemini-2.5-flash-image'];
  let currentModelIndex = 0;
  
  while (currentModelIndex < models.length) {
    const modelName = models[currentModelIndex];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${apiKey}`;
    
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`[Gemini] Tentativa ${attempts} de ${maxAttempts} com modelo ${modelName}...`);
      
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        
        const status = response.status;
        
        if (status === 200) {
          const result = await decodeStream(response);
          if (result.imageBase64) {
            return result;
          } else {
            console.warn(`[Gemini] Status 200 mas sem dados de imagem para ${modelName}.`);
            break; // trigger fallback to next model
          }
        }
        
        if (status === 400) {
          const errText = await response.text();
          console.error(`[Gemini] Erro 400:`, errText);
          if (errText.includes("SAFETY") || errText.includes("PROHIBITED")) {
            const safetyError = new Error("Foto bloqueada pelo sistema de segurança. Use foto frontal, rosto visível, sem outras pessoas.");
            safetyError.isSafety = true;
            throw safetyError;
          }
          throw new Error(`Erro 400: ${errText}`);
        }
        
        if (status === 404 || status === 410) {
          console.warn(`[Gemini] Modelo ${modelName} indisponível (HTTP ${status}). Fallback...`);
          break; // break inner attempts to switch model
        }
        
        if (status === 429) {
          console.warn(`[Gemini] Limite de requisições excedido (429). Tentando novamente em 2s...`);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        
        if (status >= 500) {
          console.warn(`[Gemini] Erro de rede/servidor (HTTP ${status}). Re-tentando em 1s...`);
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        
        const errText = await response.text();
        throw new Error(`Erro HTTP ${status}: ${errText}`);
        
      } catch (err) {
        console.error(`[Gemini] Falha na tentativa ${attempts} com ${modelName}:`, err.message);
        if (err.isSafety) throw err;
        
        if (attempts >= maxAttempts) {
          console.error(`[Gemini] Esgotadas tentativas para o modelo ${modelName}.`);
        } else {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
    currentModelIndex++;
  }
  throw new Error("Todos os modelos e tentativas falharam na geração.");
};

// Check image visual similarity using a fast grayscale average absolute difference
const isImageTooSimilar = async (imgBuffer1, imgBuffer2) => {
  try {
    const bytes1 = await sharp(imgBuffer1).resize(8, 8).grayscale().raw().toBuffer();
    const bytes2 = await sharp(imgBuffer2).resize(8, 8).grayscale().raw().toBuffer();
    
    let diffSum = 0;
    for (let i = 0; i < 64; i++) {
      diffSum += Math.abs(bytes1[i] - bytes2[i]);
    }
    const avgDiff = diffSum / 64;
    console.log(`[Validation] Diferença média visual com o template: ${avgDiff.toFixed(3)}`);
    return avgDiff < 1.5; // less than ~0.5% diff
  } catch (err) {
    console.error("Erro na comparação de similaridade:", err);
    return false;
  }
};

// Verify if the generated image has a valid face
const validateGeneratedFace = async (generatedBuffer) => {
  try {
    const img = await loadImage(generatedBuffer);
    const detection = await faceapi.detectSingleFace(img);
    return !!detection;
  } catch (err) {
    console.error("Erro ao validar face da figurinha gerada:", err);
    return false;
  }
};

// Main generator endpoint
app.post('/api/generate-sticker', async (req, res) => {
  try {
    const { name, weight, height, club, photo, day, month, year, email } = req.body;

    if (!photo) {
      return res.status(400).json({ error: 'Nenhuma foto enviada.' });
    }

    console.log(`Recebendo requisição para: ${name}, ${weight}kg, ${height}cm, ${club}`);

    // ========================================================
    // 1. PRE-PROCESS PHOTO (FACE CROP)
    // ========================================================
    let croppedPhotoBase64;
    let originalFaceDescriptor = null;
    let originalPhotoBuffer = null;
    
    try {
      const commaIndex = photo.indexOf(',');
      const base64Data = commaIndex !== -1 ? photo.slice(commaIndex + 1) : photo;
      const rawPhotoBuffer = Buffer.from(base64Data, 'base64');
      
      // Standardize the photo format to PNG via sharp for 100% compatibility with the canvas loader (handles WebP, JPEG, etc. robustly)
      originalPhotoBuffer = await sharp(rawPhotoBuffer).png().toBuffer();
      
      await loadModel();
      originalFaceDescriptor = await getFaceDescriptor(originalPhotoBuffer);
      
      croppedPhotoBase64 = await preparePhoto(originalPhotoBuffer);
    } catch (err) {
      console.error("[Pre-process] Falha no pré-processamento:", err.message);
      if (err.message === "Foto sem rosto visível") {
        return res.status(400).json({ error: "Foto sem rosto visível. Certifique-se de usar uma foto frontal, com boa iluminação." });
      }
      return res.status(400).json({ error: "Erro ao processar foto: " + err.message });
    }

    // ========================================================
    // 2. CONSTRUCT PROMPT & CONSTANTS
    // ========================================================
    const birthDate = (day && month && year) ? `${day}-${month}-${year}` : '1-1-2010';
    const nameUpper = (name || '').toUpperCase().trim();
    const clubUpper = (club || 'BRASIL').toUpperCase().trim();
    const statsLine = `${birthDate} | ${formatStats(height, weight)}`;
    
    const countryCode = getCountryCode(clubUpper);
    const config = getCountryConfig(countryCode);
    
    const referenceTemplateBase64 = getReferenceTemplateBase64(countryCode);
    const referenceTemplateBuffer = Buffer.from(referenceTemplateBase64, 'base64');

    const mainPrompt = `TASK: Produce a 2026 FIFA World Cup Panini collectible sticker that is VISUALLY INDISTINGUISHABLE from the supplied reference. You receive TWO images:
1) FACELESS REFERENCE STICKER — the official Panini sticker template with the original player's face removed. GROUND TRUTH for every visual element except the face and the name-plate text.
2) PHOTO — the real person whose face replaces the reference player's face.

TREAT THE REFERENCE AS A TEMPLATE. Copy it pixel-for-pixel. Do NOT redesign, restyle, simplify, "improve", re-illustrate, or paraphrase any visual element. The following must be reproduced IDENTICALLY:
  • Turquoise background color (#2DBFC8 family).
  • The huge "26" graphic in the upper-left → middle area, in country colors: ${config.bgDescription}.
  • The white FIFA World Cup 2026 trophy + "FIFA" mark in the UPPER-RIGHT corner.
  • The circular ${config.flag} flag badge on the RIGHT side at mid-height.
  • The vertical 3-letter country code "${countryCode}" outlined (hollow letters) along the RIGHT edge.
  • The Panini red-and-yellow logo badge at the bottom-right, overlapping the name plate.

FACE & HEAD (CRITICAL): The reference template has a light blue / pale-turquoise "head silhouette" placeholder. This placeholder is a GUIDE ONLY — it MUST be completely removed. Replace the entire placeholder area with the real person's actual head, hair, ears and neck from PHOTO (2), seamlessly integrated against the turquoise (#2DBFC8) background. Do NOT keep, trace, outline, or partially preserve the lighter-blue head silhouette. Do NOT render a floating face inside a colored egg/oval/bubble. Do NOT leave any pale-blue halo or ring. The final head must look like a normal photographed head placed naturally on the turquoise background.

PRESERVE THE REAL PERSON'S IDENTITY with maximum fidelity: exact skin tone, exact age, exact hairstyle and hair color, exact facial proportions, exact eye color and shape, exact nose shape, exact mouth, exact eyebrows, exact facial hair if any. Treat the face as a PHOTOGRAPHIC INSERT from PHOTO (2), not a stylized illustration. Do NOT stylize. Do NOT cartoonize. Do NOT 3D-render. Do NOT smooth skin. Do NOT change age. Do NOT change ethnicity. Never create Lionel Messi, Cristiano Ronaldo, Neymar, Mbappé, Haaland, Son or any other footballer likeness.

JERSEY & BODY: Torso wears a ${config.jerseyDescription} — visible shoulders, chest with team crest, collar. If photo (2) shows only head/face, generate shoulders/torso below the neck and dress them in the jersey. Match skin tone exactly to PHOTO (2). Match lighting and shadow direction.

BODY MUST MATCH THE REAL AGE: use apparent age in PHOTO (2) AND stats (${statsLine}) to decide body type. Child = narrower shoulders, slim neck, child anatomy. Adult = athletic adult proportions. Never paste a child's head on adult body or vice versa.

NAME PLATE — ABSOLUTE COLOR RULE: The name plate is NEVER white, cream, light gray or beige. Both bands are SOLID TEAL.
  • BAND 1 (upper, larger): rounded rectangle filled with TEAL #3FA7B0.
  • BAND 2 (lower, narrower): rounded rectangle filled with DARKER TEAL #2E8A93.
  Text in BOTH bands is pure WHITE (#FFFFFF), Panini condensed sans-serif.
  BAND 1 Line A — LARGE BOLD WHITE uppercase: "${nameUpper}"
  BAND 1 Line B — smaller regular WHITE: "${statsLine}" (check spelling letter-by-letter to ensure it matches exactly: ${[...nameUpper].join('-')} for name, and ${[...clubUpper].join('-')} for country. Do not transpose characters)
  BAND 2 — single centered WHITE bold uppercase: "${clubUpper}"

HARD CONSTRAINTS:
  • Do NOT add, remove, resize, recolor, or reposition any decorative element from the reference.
  • Do NOT invent extra text (no club, no jersey number, no position, no signature).
  • Do NOT add borders, frames, watermarks, drop shadows.
  • ABSOLUTELY NO text overlays beyond what is described. NEVER write "PREVIEW", "SAMPLE", "DEMO", "DRAFT", "WATERMARK", "MOCKUP".
  • OUTPUT FORMAT IS MANDATORY 3:4 PORTRAIT (~900x1200 pixels). NEVER deliver square or landscape.
  • The "26" appears EXACTLY ONCE on the background.

OUTPUT: A single 3:4 portrait premium collectible sticker. Every design element matches the reference; only the face and the name-plate text are new. The face must look photographically real and clearly identifiable as the person in PHOTO (2).`;

    // ========================================================
    // 3. BUILD PAYLOAD
    // ========================================================
    const payload = {
      contents: [{
        role: "user",
        parts: [
          { text: "IMAGE 1 BELOW = FACELESS REFERENCE STICKER TEMPLATE. Copy ONLY its layout, background, '26' graphic, flag, country code, jersey style, Panini badge and name plate. The turquoise head silhouette is only a placeholder and MUST be replaced." },
          { inlineData: { mimeType: "image/png", data: referenceTemplateBase64 } },
          { text: "IMAGE 2 BELOW = CUSTOMER FACE PHOTO. This is the ONLY source for the final person's face, skin tone, age, hairstyle and identity. Put this person into the empty turquoise placeholder from IMAGE 1." },
          { inlineData: { mimeType: "image/jpeg", data: croppedPhotoBase64 } },
          { text: mainPrompt },
          { text: "FINAL REMINDER: IMAGE 1 has NO valid face. The output MUST show the customer from IMAGE 2 inside the sticker template. Never recreate Lionel Messi, Cristiano Ronaldo, or any reference-player likeness." }
        ]
      }],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"]
      }
    };

    // ========================================================
    // 4. CALL API & VALIDATE
    // ========================================================
    let pipelineAttempts = 0;
    const maxPipelineAttempts = 2;
    let generatedImageBase64 = null;
    let responseMimeType = 'image/png';
    
    while (pipelineAttempts < maxPipelineAttempts) {
      pipelineAttempts++;
      console.log(`[Pipeline] Geração - Tentativa ${pipelineAttempts} de ${maxPipelineAttempts}...`);
      
      try {
        const apiKey = process.env.GEMINI_API_KEY || 'SUA_CHAVE_AQUI';
        const result = await callGeminiWithRetry(payload, apiKey);
        
        generatedImageBase64 = result.imageBase64;
        responseMimeType = result.mimeType;
        
        const generatedBuffer = Buffer.from(generatedImageBase64, 'base64');
        
        // Validation 1: Aspect ratio (should be >= 1.15)
        const metadata = await sharp(generatedBuffer).metadata();
        const aspect = metadata.height / metadata.width;
        console.log(`[Validation] Aspect ratio da figurinha gerada: ${aspect.toFixed(3)}`);
        if (aspect < 1.15) {
          console.warn("[Validation] Fail - Figurinha gerada não tem proporção vertical.");
          continue;
        }
        
        // Validation 2: Compare with template to verify it was modified
        const tooSimilar = await isImageTooSimilar(generatedBuffer, referenceTemplateBuffer);
        if (tooSimilar) {
          console.warn("[Validation] Fail - Figurinha é idêntica ao template sem edições.");
          continue;
        }
        
        // Validation 3: Check if there's a face in the generated image
        const hasFace = await validateGeneratedFace(generatedBuffer);
        if (!hasFace) {
          console.warn("[Validation] Fail - Nenhuma face detectada na figurinha gerada.");
          continue;
        }
        
        // Validation 4: Check facial embedding similarity
        const generatedFaceDescriptor = await getFaceDescriptor(generatedBuffer);
        if (originalFaceDescriptor && generatedFaceDescriptor) {
          const faceDiff = isFaceDifferent(originalFaceDescriptor, generatedFaceDescriptor);
          if (faceDiff) {
            console.warn("[Validation] Fail - Face gerada é muito diferente do rosto original.");
            continue;
          }
        }
        
        console.log("[Pipeline] Sucesso! Validações concluídas com êxito.");
        break;
        
      } catch (err) {
        if (err.isSafety) {
          return res.status(400).json({ error: err.message });
        }
        console.error(`[Pipeline] Erro na tentativa ${pipelineAttempts}:`, err.message);
        if (pipelineAttempts >= maxPipelineAttempts) {
          return res.status(500).json({ error: 'Erro ao gerar figurinha na API do Gemini: ' + err.message });
        }
      }
    }

    if (!generatedImageBase64) {
      return res.status(500).json({ error: 'Falha ao validar e gerar figurinha após retentativas.' });
    }

    const finalImageBase64 = `data:${responseMimeType};base64,${generatedImageBase64}`;
    
    // ========================================================
    // 5. SAVE ORDER LEAD
    // ========================================================
    const orderId = 'order_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const leadData = {
      orderId,
      name: name || '',
      email: email || '',
      birthday: `${day || ''}/${month || ''}/${year || ''}`,
      club: club || '',
      weight: weight || '',
      height: height || '',
      generatedImage: finalImageBase64,
      status: "unpaid",
      createdAt: new Date().toISOString()
    };

    try {
      const ordersDir = getOrdersDir();
      fs.writeFileSync(
        path.join(ordersDir, `order_${orderId}.json`),
        JSON.stringify(leadData, null, 2),
        'utf8'
      );
      console.log(`Lead salvo com sucesso: order_${orderId}.json`);
    } catch (err) {
      console.error("Erro ao salvar lead de figurinha gerada:", err);
    }

    return res.json({ success: true, imageUrl: finalImageBase64, orderId, aiResponse: "Sticker gerado e validado." });

  } catch (error) {
    console.error('Erro na geração:', error);
    res.status(500).json({ error: 'Erro interno ao gerar figurinha.' });
  }
});

// ========================================================
// PAYMENT ENDPOINTS
// ========================================================

// Helper to ensure orders directory exists
const getOrdersDir = () => {
  const dir = path.join(__dirname, 'orders');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  return dir;
};

// Resend Email Sending Helper
const sendConfirmationEmail = async (orderId) => {
  try {
    const ordersDir = getOrdersDir();
    const orderPath = path.join(ordersDir, `${orderId}.json`);

    if (!fs.existsSync(orderPath)) {
      console.log(`[Email] Pedido ${orderId} não encontrado no sistema local.`);
      return { success: false, message: 'Pedido não encontrado' };
    }

    const orderData = JSON.parse(fs.readFileSync(orderPath, 'utf8'));

    let statusUpdated = false;
    if (orderData.status !== 'paid') {
      orderData.status = 'paid';
      orderData.paidAt = new Date().toISOString();
      statusUpdated = true;
    }

    // Sync to original order_xxx.json lead file
    if (orderData.orderId) {
      const leadPath = path.join(ordersDir, `order_${orderData.orderId}.json`);
      if (fs.existsSync(leadPath)) {
        try {
          const leadData = JSON.parse(fs.readFileSync(leadPath, 'utf8'));
          const updatedLead = {
            ...leadData,
            ...orderData,
            status: 'paid',
            paidAt: orderData.paidAt || new Date().toISOString()
          };
          fs.writeFileSync(leadPath, JSON.stringify(updatedLead, null, 2), 'utf8');
          console.log(`[Sync] Lead order_${orderData.orderId}.json atualizado para PAID.`);
        } catch (syncErr) {
          console.error(`[Sync] Erro ao sincronizar lead:`, syncErr);
        }
      }
    }

    if (statusUpdated) {
      fs.writeFileSync(orderPath, JSON.stringify(orderData, null, 2), 'utf8');
    }

    if (orderData.emailSent) {
      console.log(`[Email] E-mail já enviado anteriormente para o pedido ${orderId}.`);
      return { success: true, message: 'E-mail já enviado' };
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey || resendApiKey.startsWith('placeholder') || resendApiKey === '') {
      console.warn("[Email] Resend API Key não configurada. E-mail não enviado.");
      return { success: false, message: 'Resend API Key não configurada' };
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const replyToEmail = process.env.RESEND_REPLY_TO;
    const toEmail = orderData.email;
    const customerName = orderData.name || 'Cliente';

    console.log(`[Email] Iniciando envio de e-mail para ${toEmail} do pedido ${orderId}...`);

    // Compile order bumps list & links
    const bumpsList = orderData.selectedBumps || [];
    let htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff; color: #1f2937;">
        <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #f3f4f6; padding-bottom: 20px;">
          <h2 style="color: #2541B2; margin: 0; font-size: 24px; font-weight: bold; text-transform: uppercase;">Gooool! Pagamento Confirmado! ⚽</h2>
          <p style="color: #4b5563; font-size: 16px; margin: 8px 0 0 0;">Sua figurinha oficial e produtos digitais chegaram.</p>
        </div>
        
        <p style="font-size: 16px; line-height: 1.5; color: #1f2937;">Olá, <strong>${customerName}</strong>!</p>
        <p style="font-size: 16px; line-height: 1.5; color: #4b5563;">Obrigado por comprar conosco! Seu pagamento foi processado com sucesso. Em anexo a este e-mail, você encontrará a sua <strong>Figurinha da Copa 2026</strong> personalizada em alta resolução e pronta para impressão!</p>
    `;

    // Check if they purchased ALL 5 bumps
    const boughtAllBumps = bumpsList.length >= 5 && bumpsList.every(Boolean);

    if (boughtAllBumps) {
      htmlContent += `
        <div style="background-color: #f0fdf4; border: 2px dashed #10b981; padding: 18px; border-radius: 12px; margin: 24px 0; text-align: center;">
          <h4 style="margin: 0 0 8px 0; color: #065f46; font-size: 18px; font-weight: bold;">🏆 Acesso Completo Liberado!</h4>
          <p style="margin: 0 0 16px 0; color: #047857; font-size: 14.5px; line-height: 1.4;">
            Identificamos que você comprou o combo completo. Você pode baixar todos os seus arquivos digitais de uma vez na nossa pasta exclusiva do Google Drive:
          </p>
          <a href="https://drive.google.com/drive/folders/1Xp1A2tkRiarLOrnCUHKfPSzuWDzd978B?usp=sharing" target="_blank" style="display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2);">Acessar Pasta no Google Drive</a>
        </div>
      `;
    } else {
      // Show individual links based on selection
      let itemsHtml = '';
      
      const bumpLinks = [
        { name: 'Pacote figurinha COPA 2026 - PDF IMPRESSÃO', url: 'https://drive.google.com/file/d/1LeRUYOmDEUGr_iR132MzzhQQ9Vi1_uTO/view?usp=sharing' },
        { name: 'Álbum da Copa de Casal 2026 - Dia dos Namorados (PDF Editável)', url: 'https://drive.google.com/file/d/1_RFkdbqtB9mz_GHCgNTBKtrZAX8EJmTb/view?usp=sharing' },
        { name: 'FIGURINHAS DA SELEÇÃO BRASILEIRA 2026 - PDF Impressão', url: 'https://drive.google.com/file/d/1v9JbPGulLQ_CAxskgunB1RKoCghNb25c/view?usp=drive_link' },
        { name: 'Edição Especial: TODAS figurinhas do Neymar (HOLO e Normais) (PDF)', url: 'https://drive.google.com/file/d/1maQGGJRmVUdrIGwnkaLUUglxWbluYADH/view?usp=drive_link' },
        { name: 'COMBO - TODAS FIGURINHAS DA COPA 2026 (PDF)', url: 'https://drive.google.com/file/d/1NEnJx5PQxF2EWE4KjTxAczWGmzi_Xk56/view?usp=drive_link' }
      ];

      bumpLinks.forEach((bump, index) => {
        if (bumpsList[index]) {
          itemsHtml += `
            <li style="margin-bottom: 16px; color: #1f2937; line-height: 1.4;">
              <span style="font-size: 15px; font-weight: bold;">${bump.name}</span><br/>
              👉 <a href="${bump.url}" target="_blank" style="color: #2541B2; text-decoration: underline; font-size: 14px; font-weight: bold;">Clique aqui para baixar</a>
            </li>
          `;
        }
      });

      if (itemsHtml) {
        htmlContent += `
          <div style="background-color: #f3f4f8; border-left: 4px solid #2541B2; padding: 20px; border-radius: 10px; margin: 24px 0;">
            <h4 style="margin: 0 0 14px 0; color: #1f2937; font-size: 16px; font-weight: bold;">📚 Seus Produtos Digitais Adquiridos:</h4>
            <ul style="padding-left: 20px; margin: 0;">
              ${itemsHtml}
            </ul>
          </div>
        `;
      }
    }

    htmlContent += `
        <div style="margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center;">
          <p style="font-size: 14px; color: #6b7280; margin: 0 0 8px 0;">Precisa de suporte ou tem alguma dúvida? Responda a este e-mail.</p>
          <p style="font-size: 13px; color: #9ca3af; margin: 0;">Figurinhas da Copa 2026 - Todos os direitos reservados.</p>
        </div>
      </div>
    `;

    // Prepare attachments
    const attachments = [];
    if (orderData.generatedImage && orderData.generatedImage.startsWith('data:')) {
      try {
        const parts = orderData.generatedImage.split(';base64,');
        const content = parts[1];
        const contentType = parts[0].split(':')[1] || 'image/png';
        attachments.push({
          content,
          filename: 'figurinha.png',
          type: contentType
        });
      } catch (err) {
        console.error("[Email] Erro ao extrair anexo de imagem:", err);
      }
    }

    // Plain text version of the email for better deliverability
    let plainTextContent = `Olá, ${customerName}!\n\n`;
    plainTextContent += `Obrigado por comprar conosco! Seu pagamento foi processado com sucesso.\n`;
    plainTextContent += `Em anexo a este e-mail, você encontrará a sua Figurinha da Copa 2026 personalizada em alta resolução.\n\n`;
    
    if (boughtAllBumps) {
      plainTextContent += `Você adquiriu o acesso completo! Baixe todos os seus arquivos na pasta do Google Drive:\n`;
      plainTextContent += `https://drive.google.com/drive/folders/1Xp1A2tkRiarLOrnCUHKfPSzuWDzd978B?usp=sharing\n`;
    } else {
      let itemsText = '';
      const bumpLinks = [
        { name: 'Pacote figurinha COPA 2026 - PDF IMPRESSÃO', url: 'https://drive.google.com/file/d/1LeRUYOmDEUGr_iR132MzzhQQ9Vi1_uTO/view?usp=sharing' },
        { name: 'Álbum da Copa de Casal 2026 - Dia dos Namorados (PDF Editável)', url: 'https://drive.google.com/file/d/1_RFkdbqtB9mz_GHCgNTBKtrZAX8EJmTb/view?usp=sharing' },
        { name: 'FIGURINHAS DA SELEÇÃO BRASILEIRA 2026 - PDF Impressão', url: 'https://drive.google.com/file/d/1v9JbPGulLQ_CAxskgunB1RKoCghNb25c/view?usp=drive_link' },
        { name: 'Edição Especial: TODAS figurinhas do Neymar (HOLO e Normais) (PDF)', url: 'https://drive.google.com/file/d/1maQGGJRmVUdrIGwnkaLUUglxWbluYADH/view?usp=drive_link' },
        { name: 'COMBO - TODAS FIGURINHAS DA COPA 2026 (PDF)', url: 'https://drive.google.com/file/d/1NEnJx5PQxF2EWE4KjTxAczWGmzi_Xk56/view?usp=drive_link' }
      ];
      
      bumpLinks.forEach((bump, index) => {
        if (bumpsList[index]) {
          itemsText += `- ${bump.name}: ${bump.url}\n`;
        }
      });
      
      if (itemsText) {
        plainTextContent += `Seus Produtos Digitais Adquiridos:\n${itemsText}\n`;
      }
    }
    
    plainTextContent += `\nPrecisa de suporte? Responda a este e-mail.\n`;

    // Call Resend REST API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        reply_to: replyToEmail || undefined,
        subject: '⚽ Sua figurinha oficial e produtos digitais chegaram!',
        html: htmlContent,
        text: plainTextContent,
        attachments
      })
    });

    const emailResult = await response.json();
    console.log(`[Email] Resposta da API do Resend para o pedido ${orderId}:`, emailResult);

    if (emailResult.id) {
      // Mark as sent
      orderData.emailSent = true;
      orderData.emailSentAt = new Date().toISOString();
      orderData.resendEmailId = emailResult.id;
      fs.writeFileSync(orderPath, JSON.stringify(orderData, null, 2), 'utf8');
      console.log(`[Email] E-mail enviado com sucesso para ${toEmail} (ID Resend: ${emailResult.id})`);
      return { success: true, emailId: emailResult.id };
    } else {
      console.error(`[Email] Falha no envio do e-mail:`, emailResult);
      return { success: false, error: emailResult };
    }
  } catch (err) {
    console.error(`[Email] Erro crítico no envio do e-mail do pedido ${orderId}:`, err);
    return { success: false, error: err.message };
  }
};

// Facebook Conversions API Helper
const sendFacebookPurchaseEvent = async (orderId) => {
  try {
    const ordersDir = getOrdersDir();
    const orderPath = path.join(ordersDir, `${orderId}.json`);

    if (!fs.existsSync(orderPath)) {
      console.log(`[FB-CAPI] Pedido ${orderId} não encontrado no sistema local.`);
      return { success: false, message: 'Pedido não encontrado' };
    }

    const orderData = JSON.parse(fs.readFileSync(orderPath, 'utf8'));

    if (orderData.fbEventSent) {
      console.log(`[FB-CAPI] Evento de compra do Facebook já enviado para o pedido ${orderId}.`);
      return { success: true, message: 'Evento já enviado' };
    }

    const pixelId = process.env.FACEBOOK_PIXEL_ID;
    const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;

    if (!pixelId || !accessToken || pixelId === '' || accessToken === '' || pixelId.includes('placeholder')) {
      console.warn("[FB-CAPI] Facebook Pixel ID ou Access Token não configurados. Evento não enviado.");
      return { success: false, message: 'Não configurado' };
    }

    const sha256 = (str) => {
      if (!str) return undefined;
      return crypto.createHash('sha256').update(str.trim().toLowerCase()).digest('hex');
    };

    let cleanPhone = (orderData.phone || '').trim().replace(/\D/g, '');
    if (cleanPhone && !cleanPhone.startsWith('55') && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
      cleanPhone = '55' + cleanPhone;
    }

    const nameParts = (orderData.name || '').trim().toLowerCase().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    console.log(`[FB-CAPI] Enviando evento de Purchase para o Pixel ${pixelId} (Pedido: ${orderId})...`);

    const fbData = {
      data: [
        {
          event_name: 'Purchase',
          event_time: Math.floor(Date.now() / 1000),
          action_source: 'website',
          user_data: {
            em: sha256(orderData.email) ? [sha256(orderData.email)] : undefined,
            ph: sha256(cleanPhone) ? [sha256(cleanPhone)] : undefined,
            fn: sha256(firstName) ? [sha256(firstName)] : undefined,
            ln: sha256(lastName) ? [sha256(lastName)] : undefined
          },
          custom_data: {
            currency: 'BRL',
            value: (orderData.amount || 1290) / 100
          }
        }
      ]
    };

    const response = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(fbData)
    });

    const fbResult = await response.json();
    console.log(`[FB-CAPI] Resposta da API do Facebook para o pedido ${orderId}:`, fbResult);

    if (fbResult.events_received && fbResult.events_received > 0) {
      orderData.fbEventSent = true;
      orderData.fbEventSentAt = new Date().toISOString();
      orderData.fbTraceId = fbResult.fbtrace_id;
      fs.writeFileSync(orderPath, JSON.stringify(orderData, null, 2), 'utf8');
      console.log(`[FB-CAPI] Evento de compra enviado com sucesso! (Trace ID: ${fbResult.fbtrace_id})`);
      return { success: true, traceId: fbResult.fbtrace_id };
    } else {
      console.error(`[FB-CAPI] Falha ao enviar evento para o Facebook:`, fbResult);
      return { success: false, error: fbResult };
    }
  } catch (err) {
    console.error(`[FB-CAPI] Erro crítico no envio do evento de compra do Facebook (Pedido: ${orderId}):`, err);
    return { success: false, error: err.message };
  }
};

// 1. ABACATE PAY - CREATE PIX BILLING
app.post('/api/payment/pix/create', async (req, res) => {
  try {
    const { name, email, cpf, phone, amount, selectedBumps, generatedImage, orderId } = req.body;
    
    const ordersDir = getOrdersDir();
    let leadData = {};
    if (orderId) {
      const leadPath = path.join(ordersDir, `order_${orderId}.json`);
      if (fs.existsSync(leadPath)) {
        try {
          leadData = JSON.parse(fs.readFileSync(leadPath, 'utf8'));
        } catch (err) {
          console.error(`Erro ao carregar lead order_${orderId}.json:`, err);
        }
      }
    }

    // Check if API key is set
    const apiKey = process.env.ABACATEPAY_API_KEY;
    if (!apiKey || apiKey.includes('placeholder')) {
      console.warn("Abacate Pay API key is missing or placeholder. Using simulated payment response.");
      
      const mockId = 'mock_pix_' + Date.now();
      const updatedOrder = {
        ...leadData,
        orderId: orderId || leadData.orderId || '',
        paymentId: mockId,
        name: name || leadData.name || '',
        email: email || leadData.email || '',
        cpf: cpf || leadData.cpf || '',
        phone: phone || leadData.phone || '',
        selectedBumps: selectedBumps || leadData.selectedBumps || [false, false, false, false, false],
        generatedImage: leadData.generatedImage || generatedImage || '',
        amount: amount || 1290,
        isMock: true,
        emailSent: false,
        paymentMethod: 'pix',
        status: 'pending',
        createdAt: leadData.createdAt || new Date().toISOString(),
        paymentCreatedAt: new Date().toISOString()
      };

      fs.writeFileSync(
        path.join(ordersDir, `${mockId}.json`),
        JSON.stringify(updatedOrder, null, 2)
      );

      if (orderId) {
        fs.writeFileSync(
          path.join(ordersDir, `order_${orderId}.json`),
          JSON.stringify({ ...updatedOrder, status: 'pending' }, null, 2)
        );
      }

      // Return a simulated/mock PIX payment for testing
      return res.json({
        success: true,
        isMock: true,
        data: {
          id: mockId,
          status: 'PENDING',
          brCode: '00020126580014BR.GOV.BCB.PIX0136mock-pix-copia-e-cola-key-12.90',
          brCodeBase64: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><rect width="150" height="150" fill="%23e8fdf0"/><rect x="5" y="5" width="140" height="140" fill="none" stroke="%2300b050" stroke-width="2"/><text x="75" y="65" font-family="Arial" font-size="12" font-weight="bold" fill="%2300b050" text-anchor="middle">MOCK PIX QR CODE</text><text x="75" y="85" font-family="Arial" font-size="9" fill="%23666" text-anchor="middle">Aprovado em 10 segundos...</text></svg>'
        }
      });
    }

    const finalAmount = amount || 1290;
    console.log(`Criando cobrança PIX no Abacate Pay para ${name} (${email}) no valor de R$ ${finalAmount/100}`);
    
    const externalId = 'order_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

    // Call Abacate Pay Transparent Checkout API
    const response = await fetch('https://api.abacatepay.com/v2/transparents/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        method: 'PIX',
        data: {
          amount: finalAmount,
          description: 'Figurinha da Copa 2026',
          externalId,
          metadata: {
            name,
            email,
            cpf
          }
        }
      })
    });

    const result = await response.json();
    console.log("Resposta do Abacate Pay:", result);

    if (result.success && result.data) {
      // Save order details to local orders directory
      const billingId = result.data.id;
      const updatedOrder = {
        ...leadData,
        orderId: orderId || leadData.orderId || '',
        paymentId: billingId,
        name: name || leadData.name || '',
        email: email || leadData.email || '',
        cpf: cpf || leadData.cpf || '',
        phone: phone || leadData.phone || '',
        selectedBumps: selectedBumps || leadData.selectedBumps || [false, false, false, false, false],
        generatedImage: leadData.generatedImage || generatedImage || '',
        amount: finalAmount,
        isMock: false,
        emailSent: false,
        paymentMethod: 'pix',
        status: 'pending',
        createdAt: leadData.createdAt || new Date().toISOString(),
        paymentCreatedAt: new Date().toISOString()
      };

      fs.writeFileSync(
        path.join(ordersDir, `${billingId}.json`),
        JSON.stringify(updatedOrder, null, 2)
      );

      if (orderId) {
        fs.writeFileSync(
          path.join(ordersDir, `order_${orderId}.json`),
          JSON.stringify({ ...updatedOrder, status: 'pending' }, null, 2)
        );
      }

      return res.json({
        success: true,
        isMock: false,
        data: result.data
      });
    } else {
      console.error("Falha ao criar cobrança no Abacate Pay:", result);
      return res.status(400).json({ error: result.error || 'Erro ao gerar cobrança PIX' });
    }
  } catch (err) {
    console.error("Erro no endpoint /api/payment/pix/create:", err);
    res.status(500).json({ error: 'Erro interno ao criar PIX: ' + err.message });
  }
});

// 2. ABACATE PAY - CHECK PIX STATUS
app.get('/api/payment/pix/status/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (id.startsWith('mock_pix_')) {
      const createdTime = parseInt(id.replace('mock_pix_', ''), 10);
      const isPaid = (Date.now() - createdTime) > 10000;
      if (isPaid) {
        // Trigger simulated success email and FB Conversion Event
        sendConfirmationEmail(id);
        sendFacebookPurchaseEvent(id);
      }
      return res.json({
        success: true,
        isMock: true,
        status: isPaid ? 'PAID' : 'PENDING'
      });
    }

    const apiKey = process.env.ABACATEPAY_API_KEY;
    if (!apiKey || apiKey.includes('placeholder')) {
      return res.status(400).json({ error: 'Chave de API do Abacate Pay não configurada' });
    }

    const response = await fetch(`https://api.abacatepay.com/v2/transparents/check?id=${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    const result = await response.json();
    if (result.success && result.data) {
      if (result.data.status === 'PAID') {
        // Trigger actual success email and FB Conversion Event
        sendConfirmationEmail(id);
        sendFacebookPurchaseEvent(id);
      }
      return res.json({
        success: true,
        isMock: false,
        status: result.data.status // PENDING, PAID, EXPIRED, CANCELLED
      });
    } else {
      console.error("Falha ao checar status no Abacate Pay:", result);
      return res.status(400).json({ error: result.error || 'Erro ao checar status do PIX' });
    }
  } catch (err) {
    console.error("Erro no endpoint /api/payment/pix/status:", err);
    res.status(500).json({ error: 'Erro interno ao checar status: ' + err.message });
  }
});

// 3. STRIPE - CREATE PAYMENT INTENT
app.post('/api/payment/stripe/create-intent', async (req, res) => {
  try {
    const { email, name, phone, amount, selectedBumps, generatedImage, orderId } = req.body;

    const ordersDir = getOrdersDir();
    let leadData = {};
    if (orderId) {
      const leadPath = path.join(ordersDir, `order_${orderId}.json`);
      if (fs.existsSync(leadPath)) {
        try {
          leadData = JSON.parse(fs.readFileSync(leadPath, 'utf8'));
        } catch (err) {
          console.error(`Erro ao carregar lead order_${orderId}.json:`, err);
        }
      }
    }

    const finalAmount = amount || 1290;
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey || stripeKey.includes('placeholder')) {
      console.warn("Stripe secret key is missing or placeholder. Using simulated clientSecret.");
      
      const mockId = 'mock_stripe_' + Date.now();
      const updatedOrder = {
        ...leadData,
        orderId: orderId || leadData.orderId || '',
        paymentId: mockId,
        name: name || leadData.name || '',
        email: email || leadData.email || '',
        phone: phone || leadData.phone || '',
        selectedBumps: selectedBumps || leadData.selectedBumps || [false, false, false, false, false],
        generatedImage: leadData.generatedImage || generatedImage || '',
        amount: finalAmount,
        isMock: true,
        emailSent: false,
        paymentMethod: 'card',
        status: 'pending',
        createdAt: leadData.createdAt || new Date().toISOString(),
        paymentCreatedAt: new Date().toISOString()
      };

      fs.writeFileSync(
        path.join(ordersDir, `${mockId}.json`),
        JSON.stringify(updatedOrder, null, 2)
      );

      if (orderId) {
        fs.writeFileSync(
          path.join(ordersDir, `order_${orderId}.json`),
          JSON.stringify({ ...updatedOrder, status: 'pending' }, null, 2)
        );
      }

      return res.json({
        success: true,
        isMock: true,
        clientSecret: 'mock_stripe_secret_' + Date.now(),
        mockOrderId: mockId
      });
    }

    console.log(`Criando Payment Intent no Stripe no valor de R$ ${finalAmount/100} (${email})`);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalAmount,
      currency: 'brl',
      payment_method_types: ['card'],
      receipt_email: email,
      metadata: {
        description: 'Figurinha da Copa 2026',
        name: name || ''
      }
    });

    // Save order details to local orders directory
    const paymentIntentId = paymentIntent.id;
    const updatedOrder = {
      ...leadData,
      orderId: orderId || leadData.orderId || '',
      paymentId: paymentIntentId,
      name: name || leadData.name || '',
      email: email || leadData.email || '',
      phone: phone || leadData.phone || '',
      selectedBumps: selectedBumps || leadData.selectedBumps || [false, false, false, false, false],
      generatedImage: leadData.generatedImage || generatedImage || '',
      amount: finalAmount,
      isMock: false,
      emailSent: false,
      paymentMethod: 'card',
      status: 'pending',
      createdAt: leadData.createdAt || new Date().toISOString(),
      paymentCreatedAt: new Date().toISOString()
    };

    fs.writeFileSync(
      path.join(ordersDir, `${paymentIntentId}.json`),
      JSON.stringify(updatedOrder, null, 2)
    );

    if (orderId) {
      fs.writeFileSync(
        path.join(ordersDir, `order_${orderId}.json`),
        JSON.stringify({ ...updatedOrder, status: 'pending' }, null, 2)
      );
    }

    return res.json({
      success: true,
      isMock: false,
      clientSecret: paymentIntent.client_secret
    });
  } catch (err) {
    console.error("Erro no endpoint /api/payment/stripe/create-intent:", err);
    res.status(500).json({ error: 'Erro interno ao criar intenção Stripe: ' + err.message });
  }
});

// 4. DEVELOPMENT SIMULATOR ENDPOINT (TESTING ONLY)
app.post('/api/payment/simulate-success/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const emailResult = await sendConfirmationEmail(id);
    const fbResult = await sendFacebookPurchaseEvent(id);
    res.json({ success: true, emailResult, fbResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================================================
// WEBHOOK ENDPOINTS
// ========================================================

// 1. STRIPE WEBHOOK RECEIVER
app.post('/api/payment/stripe/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (endpointSecret && sig) {
      // Validate signature
      event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    } else {
      // Dev mode: process unverified payload
      console.warn("Stripe webhook secret or signature missing. Processing payload without verification (dev mode).");
      event = req.body;
    }
  } catch (err) {
    console.error(`Stripe Webhook signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`Recebendo webhook do Stripe. Tipo de evento: ${event.type}`);

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    console.log(`Pagamento aprovado via Stripe (ID: ${paymentIntent.id}, Valor: R$ ${paymentIntent.amount/100})`);
    
    // Extract customer details from metadata
    const metadata = paymentIntent.metadata || {};
    const email = paymentIntent.receipt_email || metadata.email || 'desconhecido@email.com';
    const name = metadata.name || 'Cliente Stripe';
    
    console.log(`Dados do cliente Stripe - Nome: ${name}, Email: ${email}`);

    // Trigger email send and FB Conversion Event
    sendConfirmationEmail(paymentIntent.id);
    sendFacebookPurchaseEvent(paymentIntent.id);

    // Log the successful purchase
    try {
      const logDir = path.join(__dirname, 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir);
      }
      const logMsg = `[STRIPE] ${new Date().toISOString()} | ID: ${paymentIntent.id} | Email: ${email} | Nome: ${name} | Valor: R$ ${paymentIntent.amount/100}\n`;
      fs.appendFileSync(path.join(logDir, 'compras-aprovadas.txt'), logMsg);
      console.log("Compra gravada em logs/compras-aprovadas.txt com sucesso!");
    } catch (e) {
      console.error("Erro ao salvar log de compra Stripe:", e);
    }
  }

  res.json({ received: true });
});

// 2. ABACATE PAY WEBHOOK RECEIVER
app.post('/api/payment/pix/webhook', async (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const secret = process.env.ABACATEPAY_WEBHOOK_SECRET;

  try {
    if (secret && signature) {
      // Validate HMAC-SHA256 signature
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(req.rawBody);
      const digest = hmac.digest('hex');

      const signatureBuffer = Buffer.from(signature, 'hex');
      const digestBuffer = Buffer.from(digest, 'hex');

      if (signatureBuffer.length !== digestBuffer.length || !crypto.timingSafeEqual(signatureBuffer, digestBuffer)) {
        console.error("Signature verification failed for Abacate Pay webhook");
        return res.status(400).send("Webhook signature verification failed");
      }
    } else {
      console.warn("Abacate Pay webhook secret or signature missing. Processing payload without verification (dev mode).");
    }

    const { event, data } = req.body;
    console.log(`Recebendo webhook do Abacate Pay. Evento: ${event}`);

    if ((event === 'billing.paid' || event === 'transparent.completed') && data) {
      console.log(`Pagamento aprovado via PIX Abacate Pay (ID: ${data.id}, Valor: R$ ${data.amount/100})`);
      
      // Extract metadata
      const metadata = data.metadata || {};
      const email = metadata.email || 'desconhecido@email.com';
      const name = metadata.name || 'Cliente PIX';
      const cpf = metadata.cpf || 'Não Informado';

      console.log(`Dados do cliente PIX - Nome: ${name}, Email: ${email}, CPF: ${cpf}`);

      // Trigger email send and FB Conversion Event
      sendConfirmationEmail(data.id);
      sendFacebookPurchaseEvent(data.id);

      // Log the successful purchase
      try {
        const logDir = path.join(__dirname, 'logs');
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir);
        }
        const logMsg = `[PIX] ${new Date().toISOString()} | ID: ${data.id} | Email: ${email} | Nome: ${name} | CPF: ${cpf} | Valor: R$ ${data.amount/100}\n`;
        fs.appendFileSync(path.join(logDir, 'compras-aprovadas.txt'), logMsg);
        console.log("Compra gravada em logs/compras-aprovadas.txt com sucesso!");
      } catch (e) {
        console.error("Erro ao salvar log de compra PIX:", e);
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("Erro ao processar webhook do Abacate Pay:", err);
    res.status(500).send("Internal Server Error");
  }
});

// ========================================================
// ADMIN ENDPOINTS
// ========================================================
app.get('/api/admin/orders', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || authHeader !== 'Bearer 240374') {
      return res.status(401).json({ error: 'Acesso não autorizado.' });
    }

    const ordersDir = getOrdersDir();
    const files = fs.readdirSync(ordersDir);
    const orders = [];

    const leadFiles = files.filter(f => f.startsWith('order_') && f.endsWith('.json'));
    const otherFiles = files.filter(f => !f.startsWith('order_') && f.endsWith('.json'));

    const processedOrderIds = new Set();

    for (const file of leadFiles) {
      try {
        const filePath = path.join(ordersDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        orders.push(data);
        if (data.orderId) {
          processedOrderIds.add(data.orderId);
        }
      } catch (err) {
        console.error(`Erro ao ler arquivo ${file}:`, err);
      }
    }

    for (const file of otherFiles) {
      try {
        const filePath = path.join(ordersDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        if (!data.orderId || !processedOrderIds.has(data.orderId)) {
          orders.push({
            orderId: data.orderId || file.replace('.json', ''),
            name: data.name || 'Cliente antigo',
            email: data.email || '',
            cpf: data.cpf || '',
            phone: data.phone || '',
            generatedImage: data.generatedImage || '',
            selectedBumps: data.selectedBumps || [false, false, false, false, false],
            amount: data.amount || 0,
            status: data.emailSent ? 'paid' : (data.isMock ? 'pending' : 'paid'),
            paymentMethod: data.paymentMethod || (data.cpf ? 'pix' : 'card'),
            createdAt: data.createdAt || data.emailSentAt || new Date(fs.statSync(filePath).mtime).toISOString(),
            isMock: data.isMock || false
          });
        }
      } catch (err) {
        console.error(`Erro ao ler arquivo legacy ${file}:`, err);
      }
    }

    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, orders });
  } catch (error) {
    console.error("Erro na listagem do admin:", error);
    res.status(500).json({ error: 'Erro ao listar pedidos.' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`Server rodando na porta ${PORT}`);
  try {
    await loadModel();
  } catch (err) {
    console.error("Falha ao inicializar FaceAPI no startup:", err);
  }
});
