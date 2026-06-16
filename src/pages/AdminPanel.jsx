import React, { useState, useEffect } from 'react';
import './AdminPanel.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const orderBumpsList = [
  { id: 1, name: 'Pacote figurinha COPA 2026 - PDF IMPRESSÃO', price: 490 },
  { id: 2, name: 'Álbum da Copa de Casal 2026 - Dia dos Namorados (PDF Editável)', price: 1990 },
  { id: 3, name: 'FIGURINHAS DA SELEÇÃO BRASILEIRA 2026 - PDF Impressão', price: 1390 },
  { id: 4, name: 'Edição Especial: TODAS figurinhas do Neymar (HOLO e Normais) (PDF)', price: 990 },
  { id: 5, name: 'COMBO - TODAS FIGURINHAS DA COPA 2026 (Especiais Coca, Holo, Normais, Capas) (PDF)', price: 4990 }
];

export default function AdminPanel({ onClose }) {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, paid, pending, unpaid
  
  // Image modal state
  const [selectedImage, setSelectedImage] = useState(null);

  // Check sessionStorage on mount
  useEffect(() => {
    const cachedPass = sessionStorage.getItem('admin_pass');
    if (cachedPass === '240374') {
      setIsAuthenticated(true);
      fetchOrders(cachedPass);
    }
  }, []);

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (password === '240374') {
      setIsAuthenticated(true);
      sessionStorage.setItem('admin_pass', password);
      setLoginError('');
      fetchOrders(password);
    } else {
      setLoginError('Senha inválida.');
    }
  };

  const fetchOrders = async (pass) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/admin/orders`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${pass}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setOrders(data.orders || []);
      } else {
        setError(data.error || 'Erro ao carregar dados.');
      }
    } catch (err) {
      console.error(err);
      setError('Erro de conexão ao carregar dados do servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword('');
    sessionStorage.removeItem('admin_pass');
    setOrders([]);
  };

  // Calculations for Stats
  const totalGenerations = orders.length;
  const paidOrders = orders.filter(o => o.status === 'paid');
  const totalPaidCount = paidOrders.length;
  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const unpaidCount = orders.filter(o => o.status === 'unpaid').length;
  
  const conversionRate = totalGenerations > 0 ? ((totalPaidCount / totalGenerations) * 100).toFixed(1) : 0;
  const totalRevenueCents = paidOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
  const totalRevenue = (totalRevenueCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Order Bump calculations
  const bumpCounts = [0, 0, 0, 0, 0];
  paidOrders.forEach(o => {
    if (o.selectedBumps && Array.isArray(o.selectedBumps)) {
      o.selectedBumps.forEach((selected, idx) => {
        if (selected && idx < 5) {
          bumpCounts[idx] += 1;
        }
      });
    }
  });

  // Filtered orders list
  const filteredOrders = orders.filter(order => {
    const nameMatch = (order.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const emailMatch = (order.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const queryMatch = nameMatch || emailMatch;

    if (statusFilter === 'all') return queryMatch;
    return queryMatch && order.status === statusFilter;
  });

  const formatDate = (isoString) => {
    if (!isoString) return '---';
    try {
      const date = new Date(isoString);
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return isoString;
    }
  };

  const formatAmount = (cents) => {
    if (!cents) return 'R$ 0,00';
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'paid': return 'badge-paid';
      case 'pending': return 'badge-pending';
      default: return 'badge-unpaid';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'paid': return 'Pago';
      case 'pending': return 'Pendente';
      default: return 'Não Pago';
    }
  };

  const getBumpsDisplayString = (bumps) => {
    if (!bumps || !Array.isArray(bumps)) return 'Nenhum';
    const active = [];
    bumps.forEach((selected, idx) => {
      if (selected && idx < 5) {
        // Short version of the name
        const shortName = idx === 0 ? 'Pacote' :
                          idx === 1 ? 'Casal' :
                          idx === 2 ? 'Seleção' :
                          idx === 3 ? 'Neymar' : 'Combo';
        active.push(shortName);
      }
    });
    return active.length > 0 ? active.join(', ') : 'Nenhum';
  };

  if (!isAuthenticated) {
    return (
      <div className="admin-login-container">
        <div className="admin-login-card">
          <h2 className="admin-login-title font-heading text-blue">PAINEL ADMINISTRATIVO</h2>
          <p className="admin-login-subtitle">Insira a senha de acesso para visualizar os dados.</p>
          <form onSubmit={handleLoginSubmit}>
            <input
              type="password"
              placeholder="Digite a senha..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="admin-login-input"
              autoFocus
            />
            {loginError && <p className="admin-error-message">⚠️ {loginError}</p>}
            <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
              <button type="button" className="admin-btn-back" onClick={onClose}>
                VOLTAR AO SITE
              </button>
              <button type="submit" className="admin-btn-submit">
                ACESSAR 🔑
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-container">
      {/* Top Navbar */}
      <header className="admin-header">
        <div className="admin-header-title">
          <h1 className="font-heading">Painel de Controle</h1>
          <span className="admin-badge">Admin</span>
        </div>
        <div className="admin-header-actions">
          <button className="admin-btn-refresh" onClick={() => fetchOrders(sessionStorage.getItem('admin_pass'))}>
            🔄 Atualizar
          </button>
          <button className="admin-btn-logout" onClick={handleLogout}>
            Sair🚪
          </button>
          <button className="admin-btn-close" onClick={onClose}>
            Fechar X
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="admin-main">
        {/* Stats Grid */}
        <section className="admin-stats-grid">
          <div className="admin-stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-content">
              <h3>Total Gerados</h3>
              <div className="stat-number">{totalGenerations}</div>
              <p className="stat-sub">Stickers criados no total</p>
            </div>
          </div>
          <div className="admin-stat-card card-paid">
            <div className="stat-icon icon-paid">💰</div>
            <div className="stat-content">
              <h3>Faturamento</h3>
              <div className="stat-number">{totalRevenue}</div>
              <p className="stat-sub">{totalPaidCount} pedidos aprovados</p>
            </div>
          </div>
          <div className="admin-stat-card card-conversion">
            <div className="stat-icon icon-conversion">📈</div>
            <div className="stat-content">
              <h3>Conversão</h3>
              <div className="stat-number">{conversionRate}%</div>
              <p className="stat-sub">Vendas / Criações</p>
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="stat-icon">🕒</div>
            <div className="stat-content">
              <h3>Não Pagos</h3>
              <div className="stat-number">{unpaidCount + pendingCount}</div>
              <p className="stat-sub">{unpaidCount} puros + {pendingCount} pendentes</p>
            </div>
          </div>
        </section>

        {/* Order Bump Breakdown */}
        <section className="admin-section">
          <h2 className="admin-section-title font-heading text-blue">Vendas de Order Bumps</h2>
          <div className="bump-stats-container">
            {orderBumpsList.map((bump, idx) => {
              const count = bumpCounts[idx];
              const percentage = totalPaidCount > 0 ? ((count / totalPaidCount) * 100).toFixed(1) : 0;
              return (
                <div key={bump.id} className="bump-stat-item">
                  <div className="bump-stat-header">
                    <span className="bump-name">{bump.name}</span>
                    <span className="bump-numbers"><strong>{count}</strong> ({percentage}%)</span>
                  </div>
                  <div className="bump-stat-progress-bar">
                    <div className="bump-stat-progress-fill" style={{ width: `${percentage}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Table & Controls Section */}
        <section className="admin-section">
          <div className="table-controls">
            <div className="search-box">
              <input
                type="text"
                placeholder="Buscar por e-mail ou nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="admin-search-input"
              />
            </div>
            <div className="filter-tabs">
              <button 
                className={`filter-tab-btn ${statusFilter === 'all' ? 'active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                Todos ({totalGenerations})
              </button>
              <button 
                className={`filter-tab-btn badge-paid ${statusFilter === 'paid' ? 'active' : ''}`}
                onClick={() => setStatusFilter('paid')}
              >
                Pagos ({totalPaidCount})
              </button>
              <button 
                className={`filter-tab-btn badge-pending ${statusFilter === 'pending' ? 'active' : ''}`}
                onClick={() => setStatusFilter('pending')}
              >
                Pendentes ({pendingCount})
              </button>
              <button 
                className={`filter-tab-btn badge-unpaid ${statusFilter === 'unpaid' ? 'active' : ''}`}
                onClick={() => setStatusFilter('unpaid')}
              >
                Não Pagos ({unpaidCount})
              </button>
            </div>
          </div>

          {loading ? (
            <div className="admin-loading-spinner">Carregando dados dos pedidos...</div>
          ) : error ? (
            <div className="admin-error-box">⚠️ {error}</div>
          ) : filteredOrders.length === 0 ? (
            <div className="admin-empty-box">Nenhum registro encontrado.</div>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Sticker</th>
                    <th>Email</th>
                    <th>Nome</th>
                    <th>Status</th>
                    <th>Método</th>
                    <th>Bumps</th>
                    <th>Total</th>
                    <th>Dados Extras</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order, index) => (
                    <tr key={order.orderId || index}>
                      <td className="cell-date">{formatDate(order.createdAt)}</td>
                      <td className="cell-thumbnail">
                        {order.generatedImage ? (
                          <div className="thumbnail-wrapper" onClick={() => setSelectedImage(order.generatedImage)}>
                            <img src={order.generatedImage} alt="Sticker" />
                            <div className="thumbnail-hover-overlay">🔍</div>
                          </div>
                        ) : (
                          <span className="no-image">Sem foto</span>
                        )}
                      </td>
                      <td className="cell-email">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span>{order.email || '---'}</span>
                          {order.email && (
                            <button 
                              className="btn-copy-email" 
                              onClick={() => {
                                navigator.clipboard.writeText(order.email);
                                alert('E-mail copiado!');
                              }}
                              title="Copiar e-mail"
                            >
                              📋
                            </button>
                          )}
                        </div>
                      </td>
                      <td>{order.name || '---'}</td>
                      <td>
                        <span className={`status-badge ${getStatusBadgeClass(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </span>
                      </td>
                      <td>
                        <span className="payment-method-badge">
                          {order.paymentMethod ? (order.paymentMethod.toUpperCase()) : '---'}
                        </span>
                      </td>
                      <td className="cell-bumps" title={getBumpsDisplayString(order.selectedBumps)}>
                        {getBumpsDisplayString(order.selectedBumps)}
                      </td>
                      <td className="cell-amount">{formatAmount(order.amount)}</td>
                      <td className="cell-details">
                        <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>
                          <div><strong>Time:</strong> {order.club || '---'}</div>
                          <div><strong>Idade:</strong> {order.birthday || '---'}</div>
                          <div><strong>Dim:</strong> {order.height ? `${order.height}cm` : '---'} | {order.weight ? `${order.weight}kg` : '---'}</div>
                          {order.cpf && <div><strong>CPF:</strong> {order.cpf}</div>}
                          {order.phone && <div><strong>Cel:</strong> {order.phone}</div>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* Image Preview Modal */}
      {selectedImage && (
        <div className="admin-image-modal" onClick={() => setSelectedImage(null)}>
          <div className="modal-body-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-preview-btn" onClick={() => setSelectedImage(null)}>✕ Fechar</button>
            <img src={selectedImage} alt="Sticker Ampliado" className="preview-large-sticker" />
          </div>
        </div>
      )}
    </div>
  );
}
