import React, { useState, useRef } from 'react';
import './Step1.css';

const Step1 = ({ onNext, formData, updateFormData }) => {
  const [showWarning, setShowWarning] = useState(false);
  const fileInputRef = useRef(null);

  const { name, photo } = formData;

  const handleBoxClick = () => {
    if (!photo) {
      setShowWarning(true);
    } else {
      // If photo already exists, just trigger change
      fileInputRef.current.click();
    }
  };

  const handleUnderstand = () => {
    setShowWarning(false);
    setTimeout(() => {
      fileInputRef.current.click();
    }, 300); // slight delay to allow modal fade out
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateFormData({ photo: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="step-container">
      {/* Top Progress Bar */}
      <div className="progress-header">
        <div className="progress-text">
          <span className="font-heading">Passo 1 de 4</span>
          <span className="font-heading">25%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: '25%' }}></div>
        </div>
      </div>

      {/* Main Card */}
      <div className="step-card">
        <div className="card-header">
          <span className="emoji-icon">✍️</span>
          <h2>
            <span className="text-blue">QUAL O NOME DO CRAQUE?</span>
          </h2>
          <p className="subtitle">O nome que vai aparecer na figurinha</p>
        </div>

        <div className="input-group">
          <input 
            type="text" 
            placeholder="Nome e sobrenome" 
            value={name}
            onChange={(e) => updateFormData({ name: e.target.value })}
            className="name-input"
          />
        </div>

        <div className="photo-section">
          <h3 className="section-title text-blue">FOTO DO CRAQUE</h3>
          
          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            style={{ display: 'none' }} 
          />

          {!photo ? (
            <div className="photo-options">
              <div className="photo-box dashed" onClick={handleBoxClick}>
                <span className="box-emoji">🖼️</span>
                <p>Enviar foto<br/><strong>DO ROSTO</strong>,<br/><em>não de corpo</em></p>
              </div>
              <div className="photo-box dashed" onClick={() => setShowWarning(true)}>
                <span className="box-emoji">📸</span>
                <p><strong>Câmera</strong></p>
              </div>
            </div>
          ) : (
            <div className="photo-selected-box" onClick={handleBoxClick}>
              <div className="photo-circle">
                <img src={photo} alt="Foto Selecionada" />
              </div>
              <p className="text-blue"><strong>Toque para trocar a foto</strong></p>
            </div>
          )}
        </div>

        <button 
          className="btn-primary step-btn" 
          onClick={onNext}
          disabled={!name || !photo}
        >
          PRÓXIMO &rarr;
        </button>
      </div>

      {/* Bottom Dots */}
      <div className="dots-container">
        <div className="dot active"></div>
        <div className="dot"></div>
        <div className="dot"></div>
        <div className="dot"></div>
      </div>

      {/* Warning Modal */}
      {showWarning && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="text-blue modal-title">AVISO</h2>
            <div className="modal-image-container">
              <img src="/imagens/fotoexemplo.png" alt="Exemplo" className="example-image" />
            </div>
            <p className="modal-text">
              A foto precisa ser <strong>somente da pessoa</strong>, sem outras pessoas no enquadramento.
            </p>
            <button className="btn-primary modal-btn" onClick={handleUnderstand}>
              ENTENDI
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Step1;
