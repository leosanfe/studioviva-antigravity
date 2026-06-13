import React, { useState, useRef, useEffect } from 'react';
import './Step1.css';
import './Step3.css';

const Step3 = ({ onNext, onBack, formData, updateFormData }) => {
  const { club, weight, height } = formData;
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const clubsList = [
    'Flamengo', 'Corinthians', 'Palmeiras', 'São Paulo', 
    'Santos', 'Vasco', 'Grêmio', 'Internacional'
  ];

  // Close dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleClubSelect = (selectedClub) => {
    updateFormData({ club: selectedClub });
    setShowDropdown(false);
  };

  return (
    <div className="step-container">
      {/* Top Progress Bar */}
      <div className="progress-header">
        <div className="progress-text">
          <span className="font-heading">Passo 3 de 4</span>
          <span className="font-heading">75%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: '75%' }}></div>
        </div>
      </div>

      <div className="step-card">
        <div className="card-header">
          <span className="emoji-icon">⭐</span>
          <h2>
            <span className="text-blue">CLUBE E DADOS</span>
          </h2>
          <p className="subtitle">O clube do coração e os dados pra figurinha</p>
        </div>

        <div className="input-group" style={{ marginBottom: '1rem' }} ref={dropdownRef}>
          <label className="section-title text-blue" style={{ display: 'block', marginBottom: '0.5rem' }}>CLUBE DO CORAÇÃO</label>
          <div className="dropdown-container">
            <input 
              type="text" 
              placeholder="Digite o nome do clube..." 
              value={club}
              onChange={(e) => {
                updateFormData({ club: e.target.value });
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              className="name-input dropdown-input"
            />
            {showDropdown && (
              <div className="custom-dropdown">
                {clubsList
                  .filter(c => c.toLowerCase().includes(club.toLowerCase()))
                  .map((c, index) => (
                    <div 
                      key={index} 
                      className="dropdown-item"
                      onClick={() => handleClubSelect(c)}
                    >
                      {c}
                    </div>
                ))}
                {clubsList.filter(c => c.toLowerCase().includes(club.toLowerCase())).length === 0 && (
                   <div 
                      className="dropdown-item"
                      onClick={() => handleClubSelect(club)}
                    >
                      Manter: "{club}"
                    </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="date-dropdowns-container" style={{ marginBottom: '2rem' }}>
          <div className="dropdown-group">
            <label className="section-title text-blue" style={{ marginBottom: '0.5rem' }}>PESO (KG)</label>
            <input 
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength="3"
              placeholder="ex: 25" 
              value={weight}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                updateFormData({ weight: val });
              }}
              className="name-input"
            />
          </div>
          <div className="dropdown-group">
            <label className="section-title text-blue" style={{ marginBottom: '0.5rem' }}>ALTURA (CM)</label>
            <input 
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength="3"
              placeholder="ex: 120" 
              value={height}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                updateFormData({ height: val });
              }}
              className="name-input"
            />
          </div>
        </div>

        <div className="buttons-row">
          <button className="btn-outline step-btn-half" onClick={onBack}>
            VOLTAR
          </button>
          <button 
            className="btn-primary step-btn-half" 
            onClick={onNext}
            disabled={!club || !weight || !height}
          >
            PRÓXIMO &rarr;
          </button>
        </div>
      </div>

      <div className="dots-container">
        <div className="dot active"></div>
        <div className="dot active"></div>
        <div className="dot active"></div>
        <div className="dot"></div>
      </div>
    </div>
  );
};

export default Step3;
