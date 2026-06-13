import React from 'react';
import './Step1.css';
import './Step4.css';

const Step4 = ({ onNext, onBack, formData }) => {
  const { name, photo, weight, height, club } = formData;

  return (
    <div className="step-container">
      {/* Top Progress Bar */}
      <div className="progress-header">
        <div className="progress-text">
          <span className="font-heading">Passo 4 de 4</span>
          <span className="font-heading">100%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: '100%' }}></div>
        </div>
      </div>

      <div className="step-card step4-card">
        <div className="card-header">
          <span className="emoji-icon">⚠️</span>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>
            <span className="text-blue">CONFIRA SEUS DADOS</span>
          </h2>
          <p className="subtitle" style={{marginBottom: '0.5rem', fontSize: '0.85rem'}}>
            A figurinha será gerada em breve. Revise os <span style={{fontFamily: 'var(--font-body)', fontStyle: 'italic'}}>dados</span> abaixo com atenção.
          </p>
          <p className="warning-highlight">
            Não fazemos alterações após a aprovação e pagamento.
          </p>
        </div>

        <div className="review-photo-section">
          <div className="review-photo-circle">
            {photo ? <img src={photo} alt="Sua Foto" /> : <div style={{width: '100%', height: '100%', backgroundColor: '#eee'}}></div>}
          </div>
          <div className="review-photo-text">
            VERIFIQUE SE O ROSTO ESTÁ PRÓXIMO
          </div>
        </div>

        <div className="review-data-box">
          <div className="review-row">
            <span className="review-label">NOME</span>
            <span className="review-value">{name || '---'}</span>
          </div>
          <div className="review-row">
            <span className="review-label">PESO</span>
            <span className="review-value">{weight ? `${weight} kg` : '---'}</span>
          </div>
          <div className="review-row">
            <span className="review-label">ALTURA</span>
            <span className="review-value">{height ? `${height} cm` : '---'}</span>
          </div>
          <div className="review-row">
            <span className="review-label">CLUBE</span>
            <span className="review-value">{club || '---'}</span>
          </div>
        </div>

        <button className="btn-primary step4-btn-primary" onClick={onNext}>
          ENTENDI, GERAR FIGURINHA ⚽
        </button>
        
        <button className="step4-btn-secondary" onClick={onBack}>
          CORRIGIR DADOS
        </button>

      </div>

      <div className="dots-container">
        <div className="dot active"></div>
        <div className="dot active"></div>
        <div className="dot active"></div>
        <div className="dot active"></div>
      </div>
    </div>
  );
};

export default Step4;
