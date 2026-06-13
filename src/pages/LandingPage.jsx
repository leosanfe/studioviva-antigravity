import React from 'react';
import './LandingPage.css';

const LandingPage = ({ onStart }) => {
  // Lists for dynamic rendering
  const depoImages = Array.from({ length: 7 }, (_, i) => `/imagens/depo/depo${i + 1}.png`);
  
  // They have img1 to img13
  const galleryImages = Array.from({ length: 13 }, (_, i) => `/imagens/parte inferior/img${i + 1}.png`);

  return (
    <div className="landing-container">
      {/* Header Section */}
      <header className="landing-header">
        <h1>
          <span className="text-dark">TRANSFORME SEU FILHO EM UMA</span><br />
          <span className="text-blue">FIGURINHA PERSONALIZADA</span> <span className="text-dark">DA COPA DO MUNDO</span>
        </h1>
        
        <div className="badge">
          <span className="star">★</span>
          <span>+1.052 figurinhas já criadas</span>
        </div>
      </header>

      {/* Hero Image Section */}
      <section className="hero-section">
        {/* Images from 'centro site' folder */}
        <div className="hero-images-container">
          <img src="/imagens/centro site/c2.png" alt="Figurinha 2" className="hero-sticker back-left" />
          <img src="/imagens/centro site/c3.png" alt="Figurinha 3" className="hero-sticker back-right" />
          <img src="/imagens/centro site/c1.png" alt="Figurinha 1" className="hero-sticker front" />
        </div>
        
        <p className="hero-description">
          Responda algumas perguntas rápidas e veja como criar uma figurinha exclusiva, com o nome, foto e estilo do seu pequeno craque.
        </p>
        
        <button className="btn-primary" style={{ marginTop: '20px' }} onClick={onStart}>
          INICIAR
        </button>
      </section>

      {/* Testimonials Section */}
      <section className="testimonials-section">
        <h2><span className="text-blue">O QUE AS FAMÍLIAS ESTÃO DIZENDO</span></h2>
        
        <div className="marquee-wrapper">
          <div className="marquee-content testimonials-track">
            {depoImages.map((src, index) => (
              <img key={`depo1-${index}`} src={src} alt={`Depoimento ${index + 1}`} className="depo-image" />
            ))}
            {depoImages.map((src, index) => (
              <img key={`depo2-${index}`} src={src} alt={`Depoimento ${index + 1}`} className="depo-image" />
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="gallery-section">
        <h2><span className="text-blue">FIGURINHAS CRIADAS POR OUTRAS FAMÍLIAS</span></h2>
        
        <div className="marquee-wrapper">
          <div className="marquee-content gallery-track">
            {galleryImages.map((src, index) => (
              <img key={`gal1-${index}`} src={src} alt={`Figurinha Galeria ${index + 1}`} className="gallery-image" />
            ))}
            {galleryImages.map((src, index) => (
              <img key={`gal2-${index}`} src={src} alt={`Figurinha Galeria ${index + 1}`} className="gallery-image" />
            ))}
          </div>
        </div>
      </section>
      
      {/* Bottom CTA */}
      <section className="bottom-cta-section">
         <button className="btn-primary" style={{ marginBottom: '40px' }} onClick={onStart}>
          INICIAR
        </button>
      </section>

    </div>
  );
};

export default LandingPage;
