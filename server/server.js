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

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'SUA_CHAVE_AQUI');

// Remove multer since we will accept JSON with base64
app.post('/api/generate-sticker', async (req, res) => {
  try {
    const { name, weight, height, club, photo, day, month, year } = req.body;

    if (!photo) {
      return res.status(400).json({ error: 'Nenhuma foto enviada.' });
    }

    const base64Data = photo.replace(/^data:image\/\w+;base64,/, "");
    const photoBuffer = Buffer.from(base64Data, 'base64');

    console.log(`Recebendo requisição para: ${name}, ${weight}kg, ${height}cm, ${club}, Nascimento: ${day}/${month}/${year}`);

    // ========================================================
    // 1. CONSTRUINDO O PROMPT DA I.A. (Com seus parâmetros dinâmicos)
    // ========================================================
    const birthDate = (day && month && year) ? `${day}-${month}-${year}` : '1-1-2010';
    const nameUpper = (name || '').toUpperCase().trim();
    const nameSpelled = [...nameUpper].join('-');
    const clubUpper = (club || 'BRASIL').toUpperCase().trim();
    const clubSpelled = [...clubUpper].join('-');

    // Format height to standard meters (e.g. 175 -> 1,75 m)
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

    // Format weight to kg (e.g. 75 -> 75 kg)
    let formattedWeight = '35 kg';
    if (weight) {
      const cleanWeight = weight.toString().replace(/\D/g, '');
      formattedWeight = `${cleanWeight} kg`;
    }
    const dynamicPrompt = `
TASK: Produce a 2026 FIFA World Cup Panini collectible sticker that is VISUALLY INDISTINGUISHABLE from the supplied reference. You receive TWO images:

1) FACELESS REFERENCE STICKER — the official Panini sticker template with the original player's face removed. This is the GROUND TRUTH for every visual element except the face and the name-plate text.

2) PHOTO — the real person whose face replaces the reference player's face.



TREAT THE REFERENCE AS A TEMPLATE. Copy it pixel-for-pixel. Do NOT redesign, restyle, simplify, "improve", re-illustrate, or paraphrase any visual element. The following must be reproduced IDENTICALLY in size, position, color, proportion and rendering style:

• Turquoise background color (#2DBFC8 family).

• The huge "26" graphic occupying the upper-left → middle area, in the EXACT country colors of the reference (turquoise with green '26' graphic and yellow shape). Same font weight, same outline, same overlap with the figure, same crop bleeding off the left edge.

• The white FIFA World Cup 2026 trophy + "FIFA" mark in the UPPER-RIGHT corner — same size and position as the reference.

• The circular Brazil flag badge on the RIGHT side at roughly mid-height — same diameter, same position, same flag rendering.

• The vertical 3-letter country code "BRA" outlined (open / hollow letters) along the RIGHT edge — same height, same hollow stroke style as the reference. IMPORTANT: The letters must be ordered vertically from top to bottom starting with 'B' at the top, 'R' in the middle, and 'A' at the bottom (reading B-R-A from top to bottom, exactly like the reference). Do NOT reverse the letters to 'ARB' or 'A-R-B'.

• The Panini red-and-yellow logo badge at the bottom-right, OVERLAPPING the name plate exactly like the reference.

• The bottom name plate — see structure below.



FACE & HEAD (CRITICAL - MAXIMUM likeness fidelity): 
The face, head, hair, haircut, hair color, facial features, eyes, nose, mouth, skin tone, facial expression, and exact age of the person MUST be a 100% identical match to PHOTO (2). 
Do NOT blend the face or hair of the person in PHOTO (2) with the reference template's placeholder face, head, or hair. 
The template is ONLY a reference for background graphics and jersey style; the entire head (including hairstyle, hairline, ears, facial hair, facial shape) must be copied directly and identically from the person in PHOTO (2). 
Ensure the hairstyle is exactly that of the person in PHOTO (2), without altering its shape, volume, length, or color.
The final output must preserve the absolute likeness and identity of the person in PHOTO (2) without any modification to their face or head features.




JERSEY & BODY PROPORTIONS (MANDATORY): Torso wears a yellow Brazil national team shirt with green collar (CBF Nike style) — visible shoulders, chest with team crest, and collar. If photo (2) shows only head/face, realistically generate shoulders/torso below the neck and dress them in the jersey, blending skin tone and lighting seamlessly. Never deliver a head-only sticker.

BODY MUST MATCH THE REAL AGE OF THE PERSON IN THE PHOTO. Use the apparent age in PHOTO (2) AND the provided stats (Date of creation | height | weight) — especially birth date and height — to decide the correct body type. NEVER paste a child's head on an adult's body and NEVER paste an adult's head on a child's body. Concretely:

• CHILD (under ~12 yrs / height under ~1.50m): narrower, rounder shoulders, slim neck, smaller torso, slightly larger head-to-body ratio (child anatomy ~1:5/1:6, not adult 1:7/1:8). The jersey is a kid-sized fit — looser, with no defined adult musculature, no broad athletic chest, no visible pecs/biceps, no adult jawline shadows on the neck.

• TEEN (~13–17): in-between proportions, slimmer than an adult athlete, no exaggerated muscle.

• ADULT (18+): normal adult athletic proportions appropriate to the height/weight.

Match skin tone exactly to the face from PHOTO (2). Match lighting and shadow direction so head and body look photographed together — never composited. If the head in the output looks visibly out of scale with the body, the sticker is WRONG and must be redone.



NAME PLATE — ABSOLUTE COLOR RULE (HIGHEST PRIORITY, overrides anything else): the name plate is NEVER white. NEVER cream. NEVER light gray. NEVER beige. NEVER any light or pale color. If you are about to render a white plate, STOP and recolor it to teal before outputting. Both bands are SOLID TEAL — slightly darker and more desaturated than the turquoise sticker background, identical to the plates on the Demian (BRA), Messi (ARG) and Cristiano Ronaldo reference stickers.

Exact colors to use:

• BAND 1 (upper, larger, full plate width): rounded rectangle filled with TEAL #3FA7B0 (a muted teal, clearly darker than the #2DBFC8 background, no white, no gradient, no glow).

• BAND 2 (lower, narrower, flush under band 1): rounded rectangle filled with DARKER TEAL #2E8A93.

Text in BOTH bands is pure WHITE (#FFFFFF), Panini condensed sans-serif, sharp and high-contrast against the teal fill. White text is the ONLY light element on the plate.

BAND 1 contents (two stacked lines, both centered):

• Line A — LARGE BOLD WHITE uppercase: "${nameUpper}" (IMPORTANT: Check spelling letter-by-letter to ensure it matches exactly. You MUST write exactly these letters in this order: ${nameSpelled}. Do not transpose characters).

• Line B — smaller regular-weight WHITE: "${birthDate} | ${formattedHeight} | ${formattedWeight}" (Render this stats line exactly as written, double checking character by character).

Render Line B EXACTLY as written: keep the " | " separators, the hyphens in the date and the comma in the height. Do NOT translate, reformat, abbreviate, or omit. If empty, leave Line B blank but keep the teal band the same height.

BAND 2 contents:

• Single centered line, WHITE bold uppercase: "${clubUpper}" (IMPORTANT: You MUST write the name exactly, checking letter-by-letter. You MUST render exactly these letters in this order: ${clubSpelled}. Do NOT transpose, swap, omit, or add any letters. For example, if it is "INTERNACIONAL", write it exactly as I-N-T-E-R-N-A-C-I-O-N-A-L, do NOT write "INTERNACAINAL". If it is "CORINTHIANS", write it exactly as C-O-R-I-N-T-H-I-A-N-S, do NOT write "CORINTHINAS" or swap any letters).

The Panini red/yellow badge overlaps the right edge of both bands, just like the reference.

FORBIDDEN on the name plate: white fills, cream fills, light gray fills, ivory fills, off-white fills, light gradients, glossy white highlights large enough to read as a white plate. If any band looks closer to white than to teal in the output, the sticker is WRONG and must be regenerated.



HARD CONSTRAINTS:

• Do NOT add, remove, resize, recolor, or reposition any decorative element from the reference.

• Do NOT invent extra text (no club, no age, no jersey number, no position, no signature, no slogan).

• Do NOT add borders, frames, watermarks, drop shadows or "Panini-style" embellishments that aren't already in the reference.

• ABSOLUTELY NO text overlays anywhere on the sticker other than what is explicitly described in this prompt. NEVER stamp, tile, repeat or write the words "PRÉVIA", "PREVIA", "PREVIEW", "SAMPLE", "DEMO", "DRAFT", "WATERMARK", "MOCKUP", "RASCUNHO", or any similar label. NEVER tile any word diagonally over the figure, jersey, face or background. The ONLY readable text allowed on the entire sticker is: "FIFA", the vertical country code "BRA", the player name "${nameUpper}", the stats line "${birthDate} | ${formattedHeight} | ${formattedWeight}", the country name "${clubUpper}", "Panini", "CBF/BRASIL" (or equivalent crest text on the jersey) and any text already baked into the reference template — nothing else.

• FACE PLACEMENT: the real person's face from PHOTO (2) MUST fully fill the turquoise head silhouette of the reference. Do NOT leave the head silhouette empty, do NOT fill it with text, patterns or repeated words. If you cannot place the face, regenerate — never substitute it with text.

• Do NOT change the aspect ratio or crop. The output image aspect ratio MUST match the exact aspect ratio of the template image in IMAGE (1) (which is approximately 0.67).

• OUTPUT FORMAT MUST MATCH the template's aspect ratio of approximately 0.67 (taller and narrower than 3:4, roughly 900x1350 pixels). NEVER add any vertical or horizontal white bars, borders, margins, or padding on the left or right edges of the image. The sticker background must extend fully to the left and right edges.

• The "26" appears EXACTLY ONCE on the background — never duplicated, never repeated in the upper-right corner, never as a smaller secondary "26" anywhere. The big numerals are background graphics, not stamps.



OUTPUT: A single 2:3 portrait premium collectible sticker that looks like an authentic Panini 2026 sticker of this person — every design element matches the reference; only the face and the name-plate text are new.
`;

    console.log("Prompt Gerado para a IA:\n", dynamicPrompt);

    // ========================================================
    // 2. CHAMANDO A API REAL DO GEMINI
    // ========================================================
    try {
      // Tenta usar o modelo gemini-2.5-flash-image para ler as imagens e gerar a saída
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash-image",
        generationConfig: {
          imageConfig: {
            aspectRatio: "2:3"
          }
        }
      }); 
      
      const imageParts = [];

      // Se existir o template.png, a gente anexa junto no prompt como imagem 1 (FACELESS REFERENCE STICKER)
      try {
        const templateBuffer = fs.readFileSync(path.join(__dirname, 'template.png'));
        imageParts.push({
          inlineData: {
            data: templateBuffer.toString("base64"),
            mimeType: "image/png"
          }
        });
      } catch (err) {
        console.log("Arquivo template.png não encontrado.");
      }

      // Adiciona a foto do cliente como imagem 2 (PHOTO)
      imageParts.push({
        inlineData: {
          data: photoBuffer.toString("base64"),
          mimeType: "image/jpeg"
        }
      });

      console.log("Enviando prompt para a API...");
      const result = await model.generateContent([dynamicPrompt, ...imageParts]);
      const response = await result.response;
      
      console.log("Resposta da IA recebida!");

      let base64Image = null;
      let mimeType = 'image/png';
      let textResponse = '';

      if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            base64Image = part.inlineData.data;
            mimeType = part.inlineData.mimeType || 'image/png';
          } else if (part.text) {
            textResponse += part.text;
          }
        }
      }

      if (base64Image) {
        const finalImageBase64 = `data:${mimeType};base64,${base64Image}`;
        console.log("Imagem gerada pela IA com sucesso!");
        return res.json({ success: true, imageUrl: finalImageBase64, aiResponse: textResponse });
      }

      console.log("Nenhuma imagem gerada pela IA. Usando fallback da foto original.");
      // Fallback: Retorna a própria foto enviada pelo usuário para ser estilizada como figurinha
      const finalImageBase64 = `data:image/jpeg;base64,${photoBuffer.toString("base64")}`;
      return res.json({ success: true, imageUrl: finalImageBase64, aiResponse: textResponse });

    } catch (apiError) {
      console.error('Erro na chamada da API do Gemini:', apiError);
      return res.status(500).json({ error: 'Erro ao gerar na API da IA: ' + apiError.message });
    }

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
    const { name, email, cpf, phone, amount, selectedBumps, generatedImage } = req.body;
    
    // Check if API key is set
    const apiKey = process.env.ABACATEPAY_API_KEY;
    if (!apiKey || apiKey.includes('placeholder')) {
      console.warn("Abacate Pay API key is missing or placeholder. Using simulated payment response.");
      
      const mockId = 'mock_pix_' + Date.now();
      const ordersDir = getOrdersDir();
      fs.writeFileSync(
        path.join(ordersDir, `${mockId}.json`),
        JSON.stringify({ name, email, cpf, phone, selectedBumps, generatedImage, amount: amount || 1290, isMock: true, emailSent: false }, null, 2)
      );

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
      const ordersDir = getOrdersDir();
      fs.writeFileSync(
        path.join(ordersDir, `${billingId}.json`),
        JSON.stringify({ name, email, cpf, phone, selectedBumps, generatedImage, amount: finalAmount, isMock: false, emailSent: false }, null, 2)
      );

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
    const { email, name, phone, amount, selectedBumps, generatedImage } = req.body;

    const finalAmount = amount || 1290;
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey || stripeKey.includes('placeholder')) {
      console.warn("Stripe secret key is missing or placeholder. Using simulated clientSecret.");
      
      const mockId = 'mock_stripe_' + Date.now();
      const ordersDir = getOrdersDir();
      fs.writeFileSync(
        path.join(ordersDir, `${mockId}.json`),
        JSON.stringify({ name, email, phone, selectedBumps, generatedImage, amount: finalAmount, isMock: true, emailSent: false }, null, 2)
      );

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
    const ordersDir = getOrdersDir();
    fs.writeFileSync(
      path.join(ordersDir, `${paymentIntentId}.json`),
      JSON.stringify({ name, email, phone, selectedBumps, generatedImage, amount: finalAmount, isMock: false, emailSent: false }, null, 2)
    );

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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server rodando na porta ${PORT}`);
});
