import React, { useState } from 'react';
import './Step1.css'; // Reusing general step styles
import './Step2.css';

const Step2 = ({ onNext, onBack, formData, updateFormData }) => {
  const { day, month, year, email } = formData;

  const days = Array.from({length: 31}, (_, i) => i + 1);
  const months = Array.from({length: 12}, (_, i) => i + 1);
  const currentYear = new Date().getFullYear();
  const years = Array.from({length: 100}, (_, i) => currentYear - i);

  return (
    <div className="step-container">
      {/* Top Progress Bar */}
      <div className="progress-header">
        <div className="progress-text">
          <span className="font-heading">Passo 2 de 4</span>
          <span className="font-heading">50%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: '50%' }}></div>
        </div>
      </div>

      <div className="step-card">
        <div className="card-header">
          <span className="emoji-icon">🎂</span>
          <h2>
            <span className="text-blue">DATA DE NASCIMENTO</span>
          </h2>
          <p className="subtitle">Pra calcular a <span style={{fontFamily: 'var(--font-body)'}}>idade</span> na figurinha</p>
        </div>

        <div className="date-dropdowns-container">
          <div className="dropdown-group">
            <label className="section-title text-blue">DIA</label>
            <select className="select-input" value={day} onChange={e => updateFormData({ day: e.target.value })}>
              <option value="">--</option>
              {days.map(d => <option key={d} value={String(d).padStart(2, '0')}>{String(d).padStart(2, '0')}</option>)}
            </select>
          </div>
          <div className="dropdown-group">
            <label className="section-title text-blue">MÊS</label>
            <select className="select-input" value={month} onChange={e => updateFormData({ month: e.target.value })}>
              <option value="">--</option>
              {months.map(m => <option key={m} value={String(m).padStart(2, '0')}>{String(m).padStart(2, '0')}</option>)}
            </select>
          </div>
          <div className="dropdown-group">
            <label className="section-title text-blue">ANO</label>
            <select className="select-input" value={year} onChange={e => updateFormData({ year: e.target.value })}>
              <option value="">--</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div className="input-group" style={{marginTop: '1.5rem'}}>
          <label className="section-title text-blue" style={{display: 'block', marginBottom: '0.5rem'}}>SEU MELHOR E-MAIL</label>
          <input 
            type="email" 
            placeholder="exemplo@email.com" 
            value={email}
            onChange={(e) => updateFormData({ email: e.target.value })}
            className="name-input"
            style={{ borderColor: email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '#ff3333' : '' }}
          />
          {email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && (
            <p style={{ color: '#ff3333', fontFamily: 'var(--font-body)', fontSize: '0.9rem', marginTop: '5px', marginBottom: '0' }}>
              Informe um e-mail válido
            </p>
          )}
        </div>

        <div className="buttons-row">
          <button className="btn-outline step-btn-half" onClick={onBack}>
            VOLTAR
          </button>
          <button 
            className="btn-primary step-btn-half" 
            onClick={onNext}
            disabled={!day || !month || !year || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)}
          >
            PRÓXIMO &rarr;
          </button>
        </div>
      </div>

      <div className="dots-container">
        <div className="dot active"></div>
        <div className="dot active"></div>
        <div className="dot"></div>
        <div className="dot"></div>
      </div>
    </div>
  );
};

export default Step2;
