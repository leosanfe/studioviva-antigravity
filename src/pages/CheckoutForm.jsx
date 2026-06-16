import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js';
import './CheckoutForm.css';

// Carrega o SDK público do Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder');

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const orderBumpsList = [
  { 
    id: 1, 
    name: 'Pacote figurinha COPA 2026 - PDF IMPRESSÃO', 
    price: 490, 
    priceDisplay: 'R$ 4,90', 
    desc: 'Pacote oficial da Copa 2026 em PDF pra imprimir e guardar sua figurinha personalizada dentro.', 
    banner: '1x de R$ 4,90',
    image: '/imagens/orders bump/bump-pacote.png'
  },
  { 
    id: 2, 
    name: 'Álbum da Copa de Casal 2026 - Dia dos Namorados (PDF Editável)', 
    price: 1990, 
    priceDisplay: 'R$ 19,90', 
    oldPriceDisplay: 'de R$ 29,90',
    discountTag: '-33% OFF',
    desc: 'Álbum ilustrado de memórias do casal — Memory Cup 2026. Kit digital editável no Canva: álbum completo, figurinhas e envelope.\nO link para fazer o download é enviado por e-mail, logo após a confirmação do pagamento.', 
    banner: '1x de R$ 19,90', 
    badge: '⏰ Oferta por tempo limitado',
    image: '/imagens/orders bump/bump-album-casal.png'
  },
  { 
    id: 3, 
    name: 'FIGURINHAS DA SELEÇÃO BRASILEIRA 2026 - PDF Impressão', 
    price: 1390, 
    priceDisplay: 'R$ 13,90', 
    desc: 'Todas as figurinhas para a impressão, esqueça repetições, complete ele com um clique.', 
    banner: '1x de R$ 13,90',
    image: '/imagens/orders bump/bump-selecao.png'
  },
  { 
    id: 4, 
    name: 'Edição Especial: TODAS figurinhas do Neymar (HOLO e Normais) (PDF)', 
    price: 990, 
    priceDisplay: 'R$ 9,90', 
    desc: 'Adquira a figurinha do fenômeno brasileiro.', 
    banner: '1x de R$ 9,90',
    image: '/imagens/orders bump/bump-neymar.png'
  },
  { 
    id: 5, 
    name: 'COMBO - TODAS FIGURINHAS DA COPA 2026 (Especiais Coca, Holo, Normais, Capas) (PDF)', 
    price: 4990, 
    priceDisplay: 'R$ 49,90', 
    desc: 'Todas as figurinhas da Copa 2026 — todos os jogadores, seleções, capas e edições especiais (Coca-Cola e Holográficas) em PDF pronto para impressão nos tamanhos originais.', 
    banner: '1x de R$ 49,90',
    image: '/imagens/orders bump/bump-combo.png'
  }
];

function CheckoutContent({ formData, onSuccess, onClose }) {
  const stripe = useStripe();
  const elements = useElements();

  const [paymentMethod, setPaymentMethod] = useState('card');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Timer Countdown State (starts at 08:00)
  const [secondsRemaining, setSecondsRemaining] = useState(480);
  const [timerText, setTimerText] = useState('08:00');

  // Order Bumps State
  const [selectedBumps, setSelectedBumps] = useState([false, false, false, false, false]);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState(formData.email || '');
  const [confirmEmail, setConfirmEmail] = useState(formData.email || '');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');

  // Stripe Card Details (for mockup synchronization)
  const [cardName, setCardName] = useState('');
  const [cardNumberText, setCardNumberText] = useState('•••• •••• •••• ••••');
  const [cardExpiryText, setCardExpiryText] = useState('MM/AA');
  const [cardCvvText, setCardCvvText] = useState('');
  const [installments, setInstallments] = useState('1');

  // PIX State
  const [pixData, setPixData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  // Countdown timer logic
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          return 480; // Reset back to 8 mins
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerInterval);
  }, []);

  useEffect(() => {
    const mins = Math.floor(secondsRemaining / 60).toString().padStart(2, '0');
    const secs = (secondsRemaining % 60).toString().padStart(2, '0');
    setTimerText(`${mins}:${secs}`);
  }, [secondsRemaining]);

  // Calculate pricing
  const basePrice = 1290; // R$ 12,90 em centavos
  const totalCents = basePrice + selectedBumps.reduce((sum, sel, idx) => sum + (sel ? orderBumpsList[idx].price : 0), 0);
  const totalReais = (totalCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Track InitiateCheckout on Facebook Pixel
  useEffect(() => {
    if (window.fbq) {
      window.fbq('track', 'InitiateCheckout', {
        value: totalCents / 100,
        currency: 'BRL'
      });
    }
  }, []);

  // PIX status polling
  useEffect(() => {
    let intervalId;
    if (pixData && pixData.id && !paymentSuccess) {
      const checkStatus = async () => {
        try {
          const res = await fetch(`${API_URL}/api/payment/pix/status/${pixData.id}`);
          const data = await res.json();
          if (data.success && data.status === 'PAID') {
            setPaymentSuccess(true);
            setTimeout(() => {
              onSuccess();
            }, 2000);
          }
        } catch (err) {
          console.error("Erro ao verificar status do PIX:", err);
        }
      };
      intervalId = setInterval(checkStatus, 4000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [pixData, paymentSuccess, onSuccess]);

  // Bloquear clique direito (menu de contexto), atalhos do DevTools e Print no checkout
  useEffect(() => {
    const handleContextMenu = (e) => e.preventDefault();
    window.addEventListener('contextmenu', handleContextMenu);

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
      // Ctrl+S (Salvar página)
      if (e.ctrlKey && e.keyCode === 83) {
        e.preventDefault();
        return false;
      }
      // Ctrl+P (Imprimir)
      if (e.ctrlKey && e.keyCode === 80) {
        e.preventDefault();
        return false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleCpfChange = (e) => {
    const rawVal = e.target.value;
    const formatted = rawVal
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      .substring(0, 14);
    setCpf(formatted);
  };

  const handlePhoneChange = (e) => {
    const rawVal = e.target.value;
    const formatted = rawVal
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .substring(0, 15);
    setPhone(formatted);
  };

  const toggleAllBumps = () => {
    const allSelected = selectedBumps.every(val => val === true);
    if (allSelected) {
      setSelectedBumps([false, false, false, false, false]);
    } else {
      setSelectedBumps([true, true, true, true, true]);
    }
  };

  const handleBumpChange = (index) => {
    setSelectedBumps(prev => {
      const copy = [...prev];
      copy[index] = !copy[index];
      return copy;
    });
  };

  const handleStripeCardChange = (e) => {
    if (e.empty) {
      setCardNumberText('•••• •••• •••• ••••');
      setCardExpiryText('MM/AA');
      setCardCvvText('');
    } else {
      // Elements handles internal card details. We can query some info if needed,
      // but Stripe secure iframes prevent raw card reading. We will show a placeholder credit card design.
      if (e.brand) {
        console.log("Card Brand: ", e.brand);
      }
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !confirmEmail || !cpf || !phone) {
      setError('Por favor, preencha todos os campos do cadastro.');
      return;
    }
    if (email.toLowerCase().trim() !== confirmEmail.toLowerCase().trim()) {
      setError('Os e-mails informados não coincidem.');
      return;
    }
    setError(null);
    setLoading(true);

    if (paymentMethod === 'pix') {
      // 1. Fluxo do PIX
      try {
        const res = await fetch(`${API_URL}/api/payment/pix/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name,
            email,
            cpf,
            phone,
            amount: totalCents,
            selectedBumps,
            generatedImage: formData.generatedImage,
            orderId: formData.orderId
          })
        });

        const data = await res.json();
        if (data.success && data.data) {
          setPixData(data.data);
        } else {
          setError(data.error || 'Erro ao gerar pagamento PIX.');
        }
      } catch (err) {
        console.error(err);
        setError('Erro de conexão ao tentar gerar PIX.');
      } finally {
        setLoading(false);
      }
    } else {
      // 2. Fluxo do Cartão de Crédito com Stripe
      if (!stripe || !elements) {
        setError('O módulo do Stripe não carregou corretamente.');
        setLoading(false);
        return;
      }

      try {
        const intentRes = await fetch(`${API_URL}/api/payment/stripe/create-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email,
            name,
            phone,
            amount: totalCents,
            selectedBumps,
            generatedImage: formData.generatedImage,
            orderId: formData.orderId
          })
        });

        const intentData = await intentRes.json();
        if (!intentData.success) {
          setError(intentData.error || 'Erro ao iniciar transação no Stripe.');
          setLoading(false);
          return;
        }

        if (intentData.isMock) {
          console.log("Mock Stripe - Confirmando pagamento simulado...");
          setTimeout(() => {
            setPaymentSuccess(true);
            setLoading(false);
            setTimeout(() => {
              onSuccess();
            }, 2000);
          }, 2000);
          return;
        }

        const cardElement = elements.getElement(CardNumberElement);
        const result = await stripe.confirmCardPayment(intentData.clientSecret, {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: cardName,
              email: email
            }
          }
        });

        if (result.error) {
          setError(result.error.message);
        } else if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
          setPaymentSuccess(true);
          setTimeout(() => {
            onSuccess();
          }, 2000);
        } else {
          setError('O pagamento com cartão não pôde ser verificado.');
        }
      } catch (err) {
        console.error(err);
        setError('Erro ao processar pagamento com cartão de crédito.');
      } finally {
        setLoading(false);
      }
    }
  };

  const copyToClipboard = () => {
    if (pixData && pixData.brCode) {
      navigator.clipboard.writeText(pixData.brCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const checkPaymentManual = async () => {
    if (!pixData || !pixData.id) return;
    setCheckingPayment(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/payment/pix/status/${pixData.id}`);
      const data = await res.json();
      if (data.success) {
        if (data.status === 'PAID') {
          setPaymentSuccess(true);
          setTimeout(() => {
            onSuccess();
          }, 2000);
        } else {
          setError('Pagamento ainda não confirmado. Aguarde alguns instantes e tente novamente.');
        }
      } else {
        setError(data.error || 'Erro ao verificar status do pagamento.');
      }
    } catch (err) {
      console.error("Erro manual:", err);
      setError('Erro de conexão ao verificar o pagamento.');
    } finally {
      setCheckingPayment(false);
    }
  };

  const selectedBumpsCount = selectedBumps.filter(Boolean).length;

  if (paymentSuccess) {
    return (
      <div className="checkout-page-container">
        <div className="checkout-card-wrapper" style={{ marginTop: '5rem', padding: '3rem 1.5rem', textAlign: 'center' }}>
          <div className="success-icon-wrapper" style={{ margin: '0 auto 1.5rem' }}>✓</div>
          <h3 className="success-title" style={{ fontSize: '1.8rem', color: '#00a651' }}>PAGAMENTO CONFIRMADO!</h3>
          <p className="success-text" style={{ fontSize: '1.1rem', margin: '1rem 0' }}>Sua figurinha oficial em alta resolução foi liberada para download.</p>
          <div className="pix-status-polling" style={{ color: '#00a651', fontWeight: 'bold' }}>
            Carregando sua figurinha desbloqueada...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-page-container">
      {/* Red Countdown Banner */}
      <div className="countdown-banner">
        <span>⏱</span> <strong>{timerText}</strong> A figurinha será excluída em breve.
      </div>

      {/* Yellow Header Promo */}
      <div className="checkout-promo-header" style={{ padding: '0 0 1.5rem 0', maxWidth: '780px', width: '100%', margin: '0.5rem auto' }}>
        <img 
          src="/imagens/acesso-imediato.png" 
          alt="Acesso Imediato Figurinhas" 
          style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
        />
      </div>

      {/* Checkout Wrapper Card */}
      <div className="checkout-card-wrapper">
        <div className="checkout-card-top-bar">
          <span className="secure-purchase-badge">✓ COMPRA 100% SEGURA</span>
          <span className="country-badge">BR Brasil [BR]</span>
        </div>

        {/* Product details */}
        <div className="checkout-product-box">
          {formData.generatedImage && (
            <div className="checkout-product-thumb-container" style={{ position: 'relative', width: '80px', height: '115px', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 4px 8px rgba(0,0,0,0.1)', border: '2px solid white', flexShrink: 0 }}>
              <img 
                src={formData.generatedImage} 
                alt="Figurinha Preview" 
                className="checkout-product-thumb" 
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', userSelect: 'none', pointerEvents: 'none' }}
                onContextMenu={(e) => e.preventDefault()}
                onDragStart={(e) => e.preventDefault()}
              />
              {/* Marca d'água no preview do checkout */}
              <div className="watermark-overlay-thumb" />
              {/* Blocker invisível por cima */}
              <div 
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 15, cursor: 'default', background: 'transparent' }} 
                onContextMenu={(e) => e.preventDefault()}
                onDragStart={(e) => e.preventDefault()}
              />
            </div>
          )}
          <div className="checkout-product-details">
            <h3 className="product-title">Figurinha Personalizada COPA 2026</h3>
            <div className="product-prices">
              <span className="price-old">de R$ 29,90</span>
              <span className="price-new">{totalReais}</span>
              {paymentMethod === 'card' && <span className="price-installments">ou 2x {(totalCents / 200).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>}
            </div>
            <span className="product-promo-tag">APROVEITE O VALOR PROMOCIONAL. CONCLUA SUA INSCRIÇÃO.</span>
          </div>
        </div>

        {/* Form fields */}
        <form onSubmit={handlePaymentSubmit} className="checkout-form-container">
          <div className="checkout-section-title">Cadastre seus dados</div>
          
          <div className="checkout-grid" style={{ marginBottom: '1.5rem', gap: '1rem' }}>
            <div className="input-wrapper">
              <input 
                type="text" 
                className="checkout-input" 
                placeholder="Seu Nome Completo"
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
                disabled={loading}
              />
            </div>
            
            <div className="checkout-grid checkout-grid-2col" style={{ gap: '1rem' }}>
              <div className="input-wrapper">
                <input 
                  type="email" 
                  className="checkout-input" 
                  placeholder="E-mail"
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                  disabled={loading}
                />
              </div>
              <div className="input-wrapper">
                <input 
                  type="email" 
                  className="checkout-input" 
                  placeholder="Confirme seu E-mail"
                  value={confirmEmail} 
                  onChange={(e) => setConfirmEmail(e.target.value)} 
                  required 
                  disabled={loading}
                />
              </div>
            </div>

            <div className="checkout-grid checkout-grid-2col" style={{ gap: '1rem' }}>
              <div className="input-wrapper">
                <input 
                  type="text" 
                  className="checkout-input" 
                  placeholder="CPF/CNPJ" 
                  value={cpf} 
                  onChange={handleCpfChange} 
                  required 
                  disabled={loading}
                />
              </div>
              <div className="input-wrapper">
                <div className="input-wrapper-phone">
                  <div className="phone-prefix">
                    <span style={{ fontSize: '0.6rem', color: '#6b7280', display: 'block', fontWeight: 'bold' }}>BR</span>
                    <span style={{ fontSize: '0.8rem', color: '#1f2937', fontWeight: 'bold' }}>+55</span>
                  </div>
                  <input 
                    type="text" 
                    className="checkout-input" 
                    placeholder="Celular com (DDD)" 
                    value={phone} 
                    onChange={handlePhoneChange} 
                    required 
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="checkout-section-title">Escolha a forma de pagamento</div>
          
          <div className="checkout-payment-tabs">
            <button 
              type="button"
              className={`payment-tab-btn ${paymentMethod === 'card' ? 'active' : ''}`}
              onClick={() => { setPaymentMethod('card'); setError(null); }}
              disabled={loading}
            >
              <div className="payment-tab-icon">💳</div>
              <div className="payment-tab-info">
                <span className="payment-tab-title">Cartão de Crédito</span>
                <span className="payment-tab-sub">Pagamento no cartão</span>
              </div>
            </button>
            
            <button 
              type="button"
              className={`payment-tab-btn ${paymentMethod === 'pix' ? 'active' : ''}`}
              onClick={() => { setPaymentMethod('pix'); setError(null); }}
              disabled={loading}
            >
              <div className="payment-tab-icon" style={{ color: '#00a651' }}>⚡</div>
              <div className="payment-tab-info">
                <span className="payment-tab-title">Pagar com Pix</span>
                <span className="payment-tab-sub">Transação imediata</span>
              </div>
            </button>
          </div>

          {/* Payment Tab Contents */}
          {paymentMethod === 'pix' ? (
            <div className="pix-benefits-wrapper">
              <div className="pix-benefit-item">
                <span className="pix-benefit-icon">⚡</span>
                <div className="pix-benefit-info">
                  <span className="pix-benefit-title">Imediato</span>
                  <span className="pix-benefit-desc">Receba seu pagamento em poucos segundos sem custos adicionais.</span>
                </div>
              </div>
              <div className="pix-benefit-item">
                <span className="pix-benefit-icon">✨</span>
                <div className="pix-benefit-info">
                  <span className="pix-benefit-title">Simples</span>
                  <span className="pix-benefit-desc">Para pagar basta abrir o aplicativo do seu banco, procurar pelo PIX e escanear o QR Code.</span>
                </div>
              </div>
              <div className="pix-benefit-item">
                <span className="pix-benefit-icon">🛡️</span>
                <div className="pix-benefit-info">
                  <span className="pix-benefit-title">Seguro</span>
                  <span className="pix-benefit-desc">O pagamento com PIX foi desenvolvido pelo Banco Central para facilitar suas compras.</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="card-section-wrapper">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="input-wrapper">
                  <label>Número do Cartão</label>
                  <div className="stripe-card-element-container">
                    <CardNumberElement 
                      onChange={handleStripeCardChange}
                      options={{
                        showIcon: true,
                        style: {
                          base: {
                            fontSize: '16px',
                            color: '#333333',
                            fontFamily: 'sans-serif',
                            '::placeholder': { color: '#aab7c4' }
                          },
                          invalid: { color: '#fa755a', iconColor: '#fa755a' }
                        }
                      }}
                    />
                  </div>
                </div>
                
                <div className="input-wrapper">
                  <label>Nome do Titular do Cartão</label>
                  <input 
                    type="text" 
                    className="checkout-input" 
                    placeholder="NOME IMPRESSO NO CARTÃO" 
                    value={cardName} 
                    onChange={(e) => setCardName(e.target.value)} 
                    required 
                    disabled={loading}
                  />
                </div>

                <div className="checkout-grid checkout-grid-2col" style={{ gap: '1rem' }}>
                  <div className="input-wrapper">
                    <label>Validade (MM/AA)</label>
                    <div className="stripe-card-element-container">
                      <CardExpiryElement 
                        options={{
                          style: {
                            base: {
                              fontSize: '16px',
                              color: '#333333',
                              fontFamily: 'sans-serif',
                              '::placeholder': { color: '#aab7c4' }
                            },
                            invalid: { color: '#fa755a', iconColor: '#fa755a' }
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="input-wrapper">
                    <label>CVV</label>
                    <div className="stripe-card-element-container">
                      <CardCvcElement 
                        options={{
                          style: {
                            base: {
                              fontSize: '16px',
                              color: '#333333',
                              fontFamily: 'sans-serif',
                              '::placeholder': { color: '#aab7c4' }
                            },
                            invalid: { color: '#fa755a', iconColor: '#fa755a' }
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="input-wrapper">
                  <label>Opções de Parcelamento</label>
                  <select 
                    className="checkout-input" 
                    value={installments} 
                    onChange={(e) => setInstallments(e.target.value)}
                    disabled={loading}
                  >
                    <option value="1">1x de {totalReais} à vista</option>
                    <option value="2">2x de {(totalCents / 200).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</option>
                  </select>
                </div>
              </div>

              {/* Animated Credit Card Mockup */}
              <div className="card-mockup-wrapper">
                <div className="credit-card-mockup">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div className="card-mock-chip"></div>
                    <div className="card-mock-logo">VISA/MC</div>
                  </div>
                  <div className="card-mock-number">
                    {cardNumberText}
                  </div>
                  <div className="card-mock-bottom">
                    <div>
                      <span className="card-mock-label">Titular do Cartão</span>
                      <div className="card-mock-name">
                        {cardName || 'NOME COMPLETO'}
                      </div>
                    </div>
                    <div>
                      <span className="card-mock-label">Validade</span>
                      <div className="card-mock-valid">
                        {cardExpiryText}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Order Bumps */}
          <div className="order-bumps-container">
            <h4 className="order-bumps-title">Aproveite e leve também:</h4>
            <div className="order-bumps-select-all" onClick={toggleAllBumps}>
              <div className="order-bump-checkbox"></div>
              <span>Selecionar Todas ({selectedBumpsCount}/5)</span>
            </div>
            
            <div className="order-bump-list">
              {orderBumpsList.map((bump, index) => (
                <div 
                  key={bump.id} 
                  className={`order-bump-card ${selectedBumps[index] ? 'selected' : ''}`}
                >
                  <div className="order-bump-banner">{bump.banner}</div>
                  <div className="order-bump-body" onClick={() => handleBumpChange(index)}>
                    <div className="order-bump-checkbox"></div>
                    {bump.image && (
                      <img src={bump.image} alt={bump.name} className="order-bump-thumb" />
                    )}
                    <div className="order-bump-details">
                      <span className="order-bump-item-title">{bump.name}</span>
                      {bump.badge && (
                        <span className="order-bump-badge-tag">{bump.badge}</span>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span className="order-bump-item-price">{bump.priceDisplay}</span>
                        {bump.oldPriceDisplay && (
                          <span className="order-bump-item-old-price">{bump.oldPriceDisplay}</span>
                        )}
                        {bump.discountTag && (
                          <span className="order-bump-item-discount">{bump.discountTag}</span>
                        )}
                      </div>
                      <span className="order-bump-item-desc">{bump.desc}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Purchase Details Box */}
          <div className="purchase-details-box">
            <h4 className="purchase-details-title">DETALHES DA COMPRA</h4>
            <div className="purchase-details-list">
              <div className="purchase-details-row">
                <span className="purchase-details-item-name">Figurinha Personalizada COPA 2026</span>
                <span className="purchase-details-item-price">R$ 12,90</span>
              </div>
              {selectedBumps.map((sel, idx) => {
                if (!sel) return null;
                const bump = orderBumpsList[idx];
                return (
                  <div key={bump.id} className="purchase-details-row">
                    <span className="purchase-details-item-name">{bump.name}</span>
                    <span className="purchase-details-item-price">{bump.priceDisplay}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submit Button */}
          {error && (
            <div className="checkout-error" style={{ marginTop: '1.5rem' }}>
              <span>⚠️</span> {error}
            </div>
          )}

          <button 
            type="submit" 
            className="checkout-submit-btn" 
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner spinner-large"></span>
                PROCESSANDO...
              </>
            ) : (
              paymentMethod === 'pix' ? 'GERAR QR CODE PIX' : 'COMPRAR AGORA'
            )}
          </button>
          
          <div className="secure-badge-footer">
            🔒 Esta Página é Segura
          </div>
        </form>
      </div>

      {/* PIX Modal Popup Overlay */}
      {pixData && (
        <div className="pix-modal-overlay">
          <div className="pix-modal-content">
            <button type="button" className="pix-modal-close" onClick={() => setPixData(null)}>✕</button>
            
            <div className="pix-qr-container">
              <h3 className="pix-modal-title">Pague com o PIX</h3>
              <p className="pix-instruction-main">Escaneie o código QR ou copie o código abaixo para pagar</p>
              
              <div className="pix-qr-image-wrapper">
                <img src={pixData.brCodeBase64} alt="PIX QR Code" />
              </div>
              
              <p className="pix-instruction-sub">
                Abra o app do seu banco, escolha "Pagar com Pix" e aponte a câmera ou selecione "Pix Copia e Cola".
              </p>
              
              <div className="pix-copia-cola-wrapper">
                <input 
                  type="text" 
                  readOnly 
                  className="pix-copia-cola-input" 
                  value={pixData.brCode} 
                  onClick={(e) => e.target.select()}
                />
                <button type="button" className="pix-copy-btn" onClick={copyToClipboard}>
                  {copied ? 'Copiado!' : 'Copiar Código'}
                </button>
              </div>

              {/* Botão de verificação manual */}
              <button 
                type="button" 
                className="pix-check-payment-btn" 
                onClick={checkPaymentManual} 
                disabled={checkingPayment}
              >
                {checkingPayment ? (
                  <>
                    <span className="spinner"></span>
                    Verificando...
                  </>
                ) : (
                  'Já paguei (Verificar pagamento)'
                )}
              </button>

              {error && (
                <div className="checkout-error" style={{ marginTop: '0.2rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
                  <span>⚠️</span> {error}
                </div>
              )}
              
              <div className="pix-status-polling">
                <span className="spinner"></span>
                Aguardando confirmação do pagamento...
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CheckoutForm({ formData, onSuccess, onClose }) {
  return (
    <Elements stripe={stripePromise}>
      <CheckoutContent formData={formData} onSuccess={onSuccess} onClose={onClose} />
    </Elements>
  );
}
