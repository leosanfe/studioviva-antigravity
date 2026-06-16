import React, { useState, useEffect } from 'react';
import './LoadingPhoto.css';
import './GeneratingSticker.css';

const GeneratingSticker = ({ onFinish, formData, updateFormData }) => {
  const [progress, setProgress] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [apiDone, setApiDone] = useState(false);

  useEffect(() => {
    // Start API call
    const generate = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/generate-sticker`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        const data = await response.json();
        if (data.success && data.imageUrl) {
          updateFormData({ generatedImage: data.imageUrl, orderId: data.orderId });
        } else {
          console.error("Erro da API:", data.error);
          updateFormData({ apiError: data.error, apiResponse: data.aiResponse });
        }
      } catch (err) {
        console.error('Erro de conexão:', err);
        updateFormData({ apiError: 'Erro de conexão com o servidor local.' });
      } finally {
        setApiDone(true);
      }
    };
    generate();
  }, []); // Run once on mount

  useEffect(() => {
    // Inject vturb script
    const script = document.createElement("script");
    script.src = "https://scripts.converteai.net/0f04e29e-d4a0-44e0-93c7-c015600ffe38/players/6a2a2d802ca8c35d51f5d5d8/v4/player.js";
    script.async = true;
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          if (apiDone) {
            clearInterval(interval);
            setTimeout(() => {
              if (onFinish) onFinish();
            }, 500);
            return 100;
          } else {
            return 99; // Hold at 99% until API completes
          }
        }
        
        // Fast at start, extremely slow at the end (total ~100-120 seconds)
        let increment = 1;
        if (prev < 40) increment = Math.random() * 4 + 3; // Fast (3-7) -> ~8s
        else if (prev < 70) increment = Math.random() * 2 + 1; // Medium (1-3) -> ~15s
        else if (prev < 90) increment = Math.random() * 0.5 + 0.3; // Slow (0.3-0.8) -> ~40s
        else increment = Math.random() * 0.2 + 0.1; // Very slow (0.1-0.3) -> ~50s

        const nextProgress = prev + increment;
        return nextProgress > 100 ? 100 : nextProgress;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onFinish]);

  const displayProgress = Math.floor(progress);

  return (
    <div className="loading-container">
      <div className="loading-card gen-card">
        <h2 className="loading-title text-blue" style={{ marginBottom: '0.5rem' }}>GERANDO SUA FIGURINHA</h2>
        <p className="subtitle gen-subtitle">
          Não saia dessa tela, leva até <span style={{fontFamily: 'var(--font-body)', fontStyle: 'italic'}}>2 minutos</span>.
        </p>

        <div className="video-container" style={{ margin: '0.5rem auto', maxWidth: '200px' }}>
          <vturb-smartplayer 
            id="vid-6a2a2d802ca8c35d51f5d5d8" 
            style={{ display: 'block', margin: '0 auto', width: '100%', borderRadius: '16px', overflow: 'hidden' }}
          ></vturb-smartplayer>
        </div>

        <div className="promo-text" style={{ padding: '0.8rem' }}>
          <p className="text-blue" style={{ fontWeight: '700', fontSize: '0.9rem' }}>Adquira sua figurinha HOJE e concorra a</p>
          <h2 style={{ color: '#00a651', fontSize: '1.8rem', margin: '0.2rem 0', fontFamily: 'var(--font-heading)' }}>500 REAIS</h2>
          <p className="text-blue" style={{ fontWeight: '700', fontSize: '0.8rem' }}>no dia 1 de julho início dos jogos.</p>
        </div>

        <div className="loading-progress-container" style={{ marginTop: '1rem' }}>
          <div className="progress-labels">
            <span className="loading-label text-blue" style={{ fontWeight: '700' }}>{elapsedSeconds}s</span>
            <span className="loading-percent text-blue" style={{ fontWeight: '700' }}>{displayProgress}%</span>
          </div>
          <div className="loading-track">
            <div className="loading-fill" style={{ width: `${displayProgress}%`, transition: 'width 0.8s linear' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeneratingSticker;
