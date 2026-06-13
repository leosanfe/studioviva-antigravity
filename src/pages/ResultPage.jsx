import React, { useState, useEffect } from 'react';
import CheckoutForm from './CheckoutForm';
import './ResultPage.css';

const ResultPage = ({ formData }) => {
  const depoImages = Array.from({ length: 7 }, (_, i) => `/imagens/depo/depo${i + 1}.png`);
  const [currentDepoIndex, setCurrentDepoIndex] = useState(0);
  const [showCheckout, setShowCheckout] = useState(false);
  const [isPaid, setIsPaid] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDepoIndex((prev) => (prev + 1) % depoImages.length);
    }, 4000); // Slide every 4 seconds
    return () => clearInterval(interval);
  }, [depoImages.length]);

  useEffect(() => {
    if (isPaid) return;

    // Bloquear clique direito (menu de contexto) em toda a página de resultados
    const handleContextMenu = (e) => e.preventDefault();
    window.addEventListener('contextmenu', handleContextMenu);

    // Bloquear atalhos do DevTools (F12, Ctrl+Shift+I, etc.)
    const handleKeyDown = (e) => {
      // F12
      if (e.keyCode === 123) {
        e.preventDefault();
        return false;
      }
      // Ctrl+Shift+I ou Ctrl+Shift+C ou Ctrl+Shift+J
      if (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 67 || e.keyCode === 74)) {
        e.preventDefault();
        return false;
      }
      // Ctrl+U (Ver código fonte)
      if (e.ctrlKey && e.keyCode === 85) {
        e.preventDefault();
        return false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPaid]);

  const handleDownload = () => {
    if (!formData.generatedImage) return;
    
    const cleanName = (formData.name || 'copa-2026')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/[^a-z0-9]/g, '-'); // replace non-alphanumeric with dash
    const fileName = `figurinha-${cleanName}.png`;

    if (formData.generatedImage.startsWith('data:')) {
      try {
        const parts = formData.generatedImage.split(';base64,');
        const contentType = parts[0].split(':')[1];
        const raw = window.atob(parts[1]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);
        for (let i = 0; i < rawLength; ++i) {
          uInt8Array[i] = raw.charCodeAt(i);
        }
        const blob = new Blob([uInt8Array], { type: contentType });
        const blobUrl = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      } catch (err) {
        console.error("Erro ao converter base64 para Blob:", err);
        const link = document.createElement('a');
        link.href = formData.generatedImage;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } else {
      const link = document.createElement('a');
      link.href = formData.generatedImage;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (isPaid) {
    return (
      <div className="result-container success-mode">
        <a href="#" className="success-back-link" onClick={(e) => { e.preventDefault(); window.location.reload(); }}>
          ← Criar outra figurinha
        </a>

        <div className="success-header">
          <span className="success-pre-title">DOWNLOAD LIBERADO</span>
          <h1 className="success-title-main">SUA FIGURINHA<br/>TÁ PRONTA!</h1>
          <p className="success-subtitle-main">Pagamento confirmado. Baixe agora em alta resolução sem marca d'água.</p>
        </div>

        <div className="sticker-preview-wrapper" style={{ padding: '0', position: 'relative', overflow: 'hidden', borderRadius: '20px', border: '4px solid #fff', boxShadow: '0 8px 16px rgba(0,0,0,0.2)', maxWidth: '320px', width: '100%', margin: '0 auto' }}>
          {formData.generatedImage && (
             <img 
               src={formData.generatedImage} 
               alt="Sua Figurinha Gerada" 
               style={{ width: '100%', display: 'block' }} 
             />
          )}
        </div>

        <button className="success-download-btn" onClick={handleDownload}>
          📥 BAIXAR
        </button>

        <p className="success-info-footer">
          O link expira em 1 hora por segurança. Se precisar de outro, é só voltar aqui.
        </p>

        <p className="success-support-footer" onClick={() => window.open('https://wa.me/5511999999999', '_blank')}>
          Precisa de ajuda? Falar com suporte no WhatsApp
        </p>
      </div>
    );
  }

  if (showCheckout) {
    return (
      <CheckoutForm 
        formData={formData} 
        onSuccess={() => {
          setIsPaid(true);
          setShowCheckout(false);
        }} 
        onClose={() => setShowCheckout(false)} 
      />
    );
  }

  return (
    <div className={`result-container ${!isPaid ? 'has-floating-btn' : ''}`}>
      {formData.apiError && (
        <div style={{ background: '#ffcccc', color: '#cc0000', padding: '10px', borderRadius: '8px', marginBottom: '15px', textAlign: 'left', fontSize: '12px', border: '1px solid #cc0000' }}>
          <strong>Erro da IA:</strong> {formData.apiError}
          <br/><br/>
          <em>Detalhes: {formData.apiResponse || 'Verifique o terminal do Node.js'}</em>
        </div>
      )}
      <div className="sticker-preview-wrapper" style={{ padding: '0', position: 'relative', overflow: 'hidden', borderRadius: '20px', border: '4px solid #fff', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' }}>
        {formData.generatedImage ? (
           <>
             <img 
               src={formData.generatedImage} 
               alt="Sua Figurinha Gerada" 
               style={{ 
                 width: '100%', 
                 display: 'block', 
                 userSelect: isPaid ? 'auto' : 'none', 
                 pointerEvents: isPaid ? 'auto' : 'none' 
               }} 
               onContextMenu={(e) => !isPaid && e.preventDefault()}
               onDragStart={(e) => !isPaid && e.preventDefault()}
             />
             {/* Camada de Marca d'água */}
             {!isPaid && <div className="watermark-overlay" />}
             {/* Blocker invisível por cima para impedir interações e clique direito */}
             {!isPaid && (
               <div 
                 style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 15, cursor: 'default', background: 'transparent' }} 
                 onContextMenu={(e) => e.preventDefault()}
                 onDragStart={(e) => e.preventDefault()}
               />
             )}
           </>
        ) : formData.photo ? (
           <img src={formData.photo} alt="Sua Figurinha" />
        ) : (
          <div className="sticker-preview-fallback">
             <h2>[FIGURINHA]</h2>
             <p>{formData.name}</p>
          </div>
        )}
      </div>

      <h1 className="result-title">GOOLL!</h1>
      <h2 className="result-subtitle">Sua figurinha está pronta!</h2>
      
      <p className="result-text">
        Receba o arquivo digital para a impressão e participe do sorteio. <strong>Leia o regulamento em seu e-mail.</strong>
      </p>

      {isPaid ? (
        <div style={{ margin: '1.5rem 0' }}>
          <div style={{ color: '#00a651', fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
            ✓ PAGAMENTO APROVADO! Acesso Liberado.
          </div>
          <button className="btn-primary result-btn" onClick={handleDownload} style={{ backgroundColor: '#00a651', border: 'none' }}>
            BAIXAR MINHA FIGURINHA
          </button>
        </div>
      ) : (
        <>
          <div className="result-price">
            R$12,90
          </div>

          <div className="floating-footer-container">
            <button className="btn-primary result-btn floating-pulse-btn" onClick={() => setShowCheckout(true)}>
              RECEBER MINHA FIGURINHA
            </button>
          </div>
        </>
      )}

      <div className="access-text">
        <span style={{backgroundColor: '#00a651', color: 'white', borderRadius: '4px', padding: '0 4px', fontSize: '0.9rem'}}>✓</span> 
        ACESSO LIBERADO NA HORA
      </div>
      <div className="access-subtext">
        Recebimento na hora pelo site e todo material pelo e-mail.
      </div>

      {showCheckout && (
        <CheckoutForm 
          formData={formData} 
          onSuccess={() => {
            setIsPaid(true);
            setShowCheckout(false);
          }} 
          onClose={() => setShowCheckout(false)} 
        />
      )}

      <div className="testimonials-section">
        <h3 className="testimonials-title">DEPOIMENTO DE CLIENTES:</h3>
        <div className="testimonial-carousel-container">
          <div 
            className="testimonial-carousel-track" 
            style={{ transform: `translateX(-${currentDepoIndex * 100}%)` }}
          >
            {depoImages.map((src, index) => (
              <div key={index} className="testimonial-slide">
                <img src={src} alt={`Depoimento ${index + 1}`} />
              </div>
            ))}
          </div>
        </div>
        <div className="carousel-dots">
          {depoImages.map((_, index) => (
            <div 
              key={index} 
              className={`carousel-dot ${index === currentDepoIndex ? 'active' : ''}`}
              onClick={() => setCurrentDepoIndex(index)}
            ></div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ResultPage;
