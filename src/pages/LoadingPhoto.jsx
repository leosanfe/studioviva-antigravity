import React, { useState, useEffect } from 'react';
import './LoadingPhoto.css';

const LoadingPhoto = ({ onFinish }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Animate progress from 0 to 100 over ~2.5 seconds
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            onFinish();
          }, 300); // slight delay at 100% before transitioning
          return 100;
        }
        // Random increment between 3 and 8 for a slightly faster loading feel
        return prev + Math.floor(Math.random() * 6) + 3; 
      });
    }, 100);

    return () => clearInterval(interval);
  }, [onFinish]);

  return (
    <div className="loading-container">
      <div className="loading-card">
        <h2 className="loading-title text-blue">CARREGANDO FOTO</h2>
        
        <div className="gif-container">
          {/* We will use the gif the user provides here */}
          <img src="/imagens/gifloading.gif" alt="Carregando" className="loading-gif" />
        </div>

        <p className="loading-subtitle">Esse tem cara de jogador caro hein</p>

        <div className="loading-progress-container">
          <div className="progress-labels">
            <span className="loading-label text-blue">Carregando...</span>
            <span className="loading-percent text-blue">{progress}%</span>
          </div>
          <div className="loading-track">
            <div className="loading-fill" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingPhoto;
