// Proteção contra Clickjacking e enquadramento não autorizado
if (window.top !== window.self) {
    window.top.location = window.self.location;
}

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // Logout automático após 15 min de inatividade
let lastActivityTime = Date.now();

let state = {
    currentUser: null,
    adminPreviewMode: 'real',
    currentDocViewingId: null
};

/* --- CHAMADAS À API --- */
async function api(metodo, url, corpo) {
    const opcoes = {
        method: metodo,
        headers: { 'Content-Type': 'application/json' }
    };
    if (corpo !== undefined) opcoes.body = JSON.stringify(corpo);

    const resp = await fetch(url, opcoes);
    let dados = null;
    try {
        dados = await resp.json();
    } catch (e) {
        dados = null;
    }
    if (!resp.ok) {
        const erro = new Error((dados && dados.erro) || `Erro na requisição (${resp.status})`);
        erro.status = resp.status;
        erro.dados = dados;
        throw erro;
    }
    return dados;
}

/* --- SANITIZAÇÃO NO CLIENTE (defesa em profundidade contra XSS) --- */
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/`/g, "&#x60;")
        .replace(/\//g, "&#x2F;");
}

function sanitizeId(id) {
    return String(id || '').replace(/[^a-zA-Z0-9_-]/g, '');
}

/* --- MONITOR DE INATIVIDADE --- */
function reiniciarTimerInatividade() {
    lastActivityTime = Date.now();
}

function iniciarMonitorInatividade() {
    ['mousemove', 'keydown', 'click', 'scroll'].forEach(evt => {
        window.addEventListener(evt, reiniciarTimerInatividade, { passive: true });
    });

    setInterval(() => {
        if (state.currentUser) {
            if (Date.now() - lastActivityTime > IDLE_TIMEOUT_MS) {
                alert('Sua sessão foi encerrada automaticamente por inatividade.');
                logout();
            }
        }
    }, 30000);
}

window.addEventListener('DOMContentLoaded', async () => {
    iniciarMonitorInatividade();
    await verificarSessao();
});

async function verificarSessao() {
    try {
        const { usuario } = await api('GET', '/api/auth/me');
        state.currentUser = usuario;
        mostrarApp();
    } catch (e) {
        mostrarLogin();
    }
}

function mostrarLogin() {
    document.getElementById('view-login').classList.remove('hidden');
    document.getElementById('app-main-structure').classList.add('hidden');
}

function mostrarApp() {
    document.getElementById('view-login').classList.add('hidden');
    document.getElementById('app-main-structure').classList.remove('hidden');
    atualizarInterfaceUsuario();
    navegarPara('dashboard');
}

/* --- CONTROLE DE AUTENTICAÇÃO E CADASTRO --- */
function alternarAbaAuth(aba) {
    const formLogin = document.getElementById('form-login');
    const formCadastro = document.getElementById('form-cadastro');
    const tabLoginBtn = document.getElementById('tab-login-btn');
    const tabCadastroBtn = document.getElementById('tab-cadastro-btn');

    if (aba === 'cadastro') {
        formLogin.classList.add('hidden');
        formCadastro.classList.remove('hidden');
        tabLoginBtn.style.color = 'var(--text-muted)';
        tabLoginBtn.style.borderBottom = 'none';
        tabCadastroBtn.style.color = 'var(--primary)';
        tabCadastroBtn.style.borderBottom = '2px solid var(--primary)';
    } else {
        formCadastro.classList.add('hidden');
        formLogin.classList.remove('hidden');
        tabCadastroBtn.style.color = 'var(--text-muted)';
        tabCadastroBtn.style.borderBottom = 'none';
        tabLoginBtn.style.color = 'var(--primary)';
        tabLoginBtn.style.borderBottom = '2px solid var(--primary)';
    }
}

function abrirModalTermos() {
    document.getElementById('modal-termos').classList.remove('hidden');
}
function fecharModalTermos() {
    document.getElementById('modal-termos').classList.add('hidden');
}
function aceitarTermosNoModal() {
    const chk = document.getElementById('cad-termo');
    if (chk) chk.checked = true;
    fecharModalTermos();
}
function abrirEsqueciSenha() {
    document.getElementById('modal-esqueci-senha').classList.remove('hidden');
}

async function solicitarRedefinicaoSenha() {
    const email = document.getElementById('reset-email').value.trim().toLowerCase();
    try {
        const resp = await api('POST', '/api/auth/esqueci-senha', { email });
        alert(resp.mensagem);
        fecharModais();
    } catch (e) {
        alert(e.message);
    }
}

async function executarCadastro() {
    const nome = document.getElementById('cad-nome').value.trim();
    const email = document.getElementById('cad-email').value.trim().toLowerCase();
    const senha = document.getElementById('cad-senha').value;
    const senhaConf = document.getElementById('cad-senha-conf').value;
    const termoAceito = document.getElementById('cad-termo').checked;

    if (senha !== senhaConf) {
        alert('A confirmação da senha não confere com a senha digitada.');
        return;
    }

    try {
        const { usuario } = await api('POST', '/api/auth/registrar', { nome, email, senha, senhaConf, termoAceito });
        state.currentUser = usuario;
        mostrarApp();
        alert(`Bem-vindo ao SCL, ${usuario.nome}! Sua conta foi cadastrada com sucesso.`);
    } catch (e) {
        alert(e.message);
    }
}

async function executarLogin() {
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const senha = document.getElementById('login-senha').value;
    const lembrar = document.getElementById('login-lembrar').checked;

    if (!email || !senha) {
        alert('Preencha os campos de usuário e senha.');
        return;
    }

    try {
        const { usuario } = await api('POST', '/api/auth/login', { email, senha, lembrar });
        state.currentUser = usuario;
        mostrarApp();
    } catch (e) {
        alert(e.message);
    }
}

async function logout() {
    try {
        await api('POST', '/api/auth/logout');
    } catch (e) {
        // ignora falha de rede no logout
    }
    state.currentUser = null;
    location.reload();
}

/* --- NAVEGAÇÃO --- */
function navegarPara(secao) {
    if ((secao === 'usuarios' || secao === 'config') && state.currentUser.perfil !== 'admin') {
        alert('Acesso Negado: Você não possui privilégios de Administrador para acessar esta seção.');
        return;
    }

    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.sidebar-nav li a').forEach(el => el.classList.remove('active'));

    const targetSec = document.getElementById(`sec-${secao}`);
    const targetNav = document.getElementById(`nav-${secao}`);

    if (targetSec) targetSec.classList.remove('hidden');
    if (targetNav) targetNav.classList.add('active');

    if (secao === 'dashboard') renderizarDashboard();
    if (secao === 'licitacoes') renderizarLicitacoes();
    if (secao === 'usuarios') renderizarUsuarios();
    if (secao === 'historico') renderizarHistorico();
}

function atualizarInterfaceUsuario() {
    if (!state.currentUser) return;

    document.getElementById('header-user-name').innerText = state.currentUser.nome;
    document.getElementById('header-user-role').innerText = `${state.currentUser.perfil === 'admin' ? 'Administrador' : 'Usuário Comum'} (${state.currentUser.nivelAcesso.toUpperCase()})`;

    const adminElements = document.querySelectorAll('.admin-only');
    adminElements.forEach(el => {
        if (state.currentUser.perfil === 'admin') {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });
}

/* --- DASHBOARD --- */
async function renderizarDashboard() {
    document.getElementById('dash-welcome').innerText = `Olá, ${escapeHTML(state.currentUser.nome)}`;
    document.getElementById('dash-access-desc').innerText = `Perfil: ${state.currentUser.perfil === 'admin' ? 'Administrador' : 'Usuário Comum'} | Nível de acesso: ${escapeHTML(state.currentUser.nivelAcesso.toUpperCase())}.`;

    try {
        const dados = await api('GET', '/api/dashboard');
        document.getElementById('m-licitacoes-num').innerText = dados.licitacoesVisiveis;
        document.getElementById('m-docs-completos').innerText = dados.docsCompletos;
        document.getElementById('m-docs-restritos').innerText = dados.docsRestritos;
        document.getElementById('m-total-usuarios').innerText = dados.totalUsuarios;

        const tbody = document.getElementById('dash-recent-actions');
        tbody.innerHTML = dados.acoesRecentes.map(l => `
            <tr>
                <td>${new Date(l.dataHora).toLocaleString('pt-BR')}</td>
                <td>${escapeHTML(l.acao)}</td>
                <td>${escapeHTML(l.alvo)}</td>
                <td><span class="badge ${l.resultado === 'Sucesso' ? 'badge-success' : 'badge-danger'}">${escapeHTML(l.resultado)}</span></td>
            </tr>
        `).join('') || '<tr><td colspan="4" class="text-center">Nenhuma ação recente registrada.</td></tr>';
    } catch (e) {
        alert(e.message);
    }
}

/* --- LICITAÇÕES --- */
function renderizarLicitacoes() {
    filtrarLicitacoes();
}

async function filtrarLicitacoes() {
    const search = document.getElementById('filter-search').value;
    const modalidade = document.getElementById('filter-modalidade').value;
    const situacao = document.getElementById('filter-situacao').value;

    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (modalidade) params.set('modalidade', modalidade);
    if (situacao) params.set('situacao', situacao);

    try {
        const { licitacoes } = await api('GET', `/api/licitacoes?${params.toString()}`);
        const tbody = document.getElementById('tbody-licitacoes');
        tbody.innerHTML = licitacoes.map(b => {
            const safeId = sanitizeId(b.id);
            return `
            <tr>
                <td><strong>${escapeHTML(b.numero)}</strong><br><small style="color:var(--text-muted)">Processo: ${escapeHTML(b.processo)}</small></td>
                <td>${escapeHTML(b.modalidade)}</td>
                <td style="max-width: 300px;">${escapeHTML(b.objeto)}</td>
                <td>${escapeHTML(b.orgao)}</td>
                <td>${new Date(b.dataAbertura).toLocaleString('pt-BR')}</td>
                <td><span class="badge ${b.situacao === 'Aberta' ? 'badge-success' : 'badge-info'}">${escapeHTML(b.situacao)}</span></td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="visualizarDocumento('${safeId}')">🔍 Visualizar</button>
                    ${state.currentUser.perfil === 'admin' ? `
                        <button class="btn btn-secondary btn-sm" onclick="abrirModalEditarLicitacao('${safeId}')">✏️</button>
                        <button class="btn btn-danger btn-sm" onclick="excluirLicitacao('${safeId}')">🗑️</button>
                    ` : ''}
                </td>
            </tr>
        `}).join('') || '<tr><td colspan="7" class="text-center">Nenhuma licitação encontrada.</td></tr>';
    } catch (e) {
        alert(e.message);
    }
}

async function visualizarDocumento(bidId) {
    const safeId = sanitizeId(bidId);
    state.currentDocViewingId = safeId;

    let bid;
    try {
        const previewParam = state.currentUser.perfil === 'admin' && state.adminPreviewMode !== 'real'
            ? `?previewMode=${state.adminPreviewMode}` : '';
        const resp = await api('GET', `/api/licitacoes/${safeId}${previewParam}`);
        bid = resp.licitacao;
    } catch (e) {
        alert(e.message);
        return;
    }

    document.getElementById('modal-doc-title').innerText = `Licitação ${bid.numero}`;
    const body = document.getElementById('modal-doc-body');

    let html = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 0.875rem;">
            <div><strong>Número:</strong> ${escapeHTML(bid.numero)}</div>
            <div><strong>Processo:</strong> ${escapeHTML(bid.processo)}</div>
            <div><strong>Modalidade:</strong> ${escapeHTML(bid.modalidade)}</div>
            <div><strong>Órgão:</strong> ${escapeHTML(bid.orgao)}</div>
            <div><strong>Abertura:</strong> ${new Date(bid.dataAbertura).toLocaleString('pt-BR')}</div>
            <div><strong>Valor Estimado:</strong> ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(bid.valorEstimado)}</div>
            <div style="grid-column: span 2;"><strong>Objeto:</strong> ${escapeHTML(bid.objeto)}</div>
        </div>
        <hr style="margin: 16px 0;">
    `;

    if (!bid.restrito) {
        html += `
            <div class="doc-preview-box">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <h4 style="color: var(--primary-dark);">📄 Conteúdo Integral do Documento</h4>
                    <button class="btn btn-accent btn-sm" onclick="alert('Iniciando o download seguro do documento.')">📥 Baixar PDF</button>
                </div>
                <p style="white-space: pre-line; font-family: monospace; font-size: 0.85rem; background: white; padding: 12px; border: 1px solid var(--border-color); border-radius: 4px;">${escapeHTML(bid.conteudoIntegral)}</p>
            </div>
        `;
    } else {
        html += `
            <div class="restricted-alert-box">
                🔒 <strong>ACESSO RESTRITO AO CONTEÚDO INTEGRAL:</strong><br>
                Seu perfil possui autorização para consultar exclusivamente os metadados públicos deste processo licitatório.
            </div>
        `;
    }

    body.innerHTML = html;
    document.getElementById('modal-doc-details').classList.remove('hidden');
}

function alterarModoPreviewAdmin() {
    if (state.currentUser.perfil !== 'admin') return;
    state.adminPreviewMode = document.getElementById('select-admin-preview-mode').value;
    if (state.currentDocViewingId) {
        visualizarDocumento(state.currentDocViewingId);
    }
}

function abrirModalNovaLicitacao() {
    document.getElementById('form-licitacao').reset();
    document.getElementById('lic-id').value = '';
    document.getElementById('modal-lic-form-title').innerText = 'Cadastrar Licitação';
    document.getElementById('modal-licitacao-form').classList.remove('hidden');
}

async function abrirModalEditarLicitacao(id) {
    const safeId = sanitizeId(id);
    let bid;
    try {
        const resp = await api('GET', `/api/licitacoes/${safeId}?previewMode=completo`);
        bid = resp.licitacao;
    } catch (e) {
        alert(e.message);
        return;
    }

    document.getElementById('lic-id').value = bid.id;
    document.getElementById('lic-num').value = bid.numero;
    document.getElementById('lic-ano').value = bid.ano;
    document.getElementById('lic-processo').value = bid.processo;
    document.getElementById('lic-modalidade').value = bid.modalidade;
    document.getElementById('lic-objeto').value = bid.objeto;
    document.getElementById('lic-orgao').value = bid.orgao;
    document.getElementById('lic-valor').value = bid.valorEstimado;
    document.getElementById('lic-data-pub').value = bid.dataPublicacao;
    document.getElementById('lic-data-abertura').value = bid.dataAbertura;
    document.getElementById('lic-situacao').value = bid.situacao;
    document.getElementById('lic-visivel').value = bid.visivelComum;
    document.getElementById('lic-conteudo').value = bid.conteudoIntegral || '';

    document.getElementById('modal-lic-form-title').innerText = 'Editar Licitação';
    document.getElementById('modal-licitacao-form').classList.remove('hidden');
}

async function salvarLicitacao() {
    const id = document.getElementById('lic-id').value;

    const payload = {
        numero: document.getElementById('lic-num').value.trim(),
        ano: parseInt(document.getElementById('lic-ano').value, 10),
        processo: document.getElementById('lic-processo').value.trim(),
        modalidade: document.getElementById('lic-modalidade').value,
        objeto: document.getElementById('lic-objeto').value.trim(),
        orgao: document.getElementById('lic-orgao').value.trim(),
        valorEstimado: parseFloat(document.getElementById('lic-valor').value) || 0,
        dataPublicacao: document.getElementById('lic-data-pub').value,
        dataAbertura: document.getElementById('lic-data-abertura').value,
        situacao: document.getElementById('lic-situacao').value,
        visivelComum: document.getElementById('lic-visivel').value,
        conteudoIntegral: document.getElementById('lic-conteudo').value.trim()
    };

    try {
        if (id) {
            await api('PUT', `/api/licitacoes/${sanitizeId(id)}`, payload);
        } else {
            await api('POST', '/api/licitacoes', payload);
        }
        fecharModais();
        renderizarLicitacoes();
        alert('Licitação gravada com sucesso!');
    } catch (e) {
        alert(e.message);
    }
}

async function excluirLicitacao(id) {
    const safeId = sanitizeId(id);
    if (!confirm('Tem certeza de que deseja remover esta licitação?')) return;
    try {
        await api('DELETE', `/api/licitacoes/${safeId}`);
        renderizarLicitacoes();
    } catch (e) {
        alert(e.message);
    }
}

/* --- USUÁRIOS --- */
async function renderizarUsuarios() {
    try {
        const { usuarios } = await api('GET', '/api/usuarios');
        const tbody = document.getElementById('tbody-usuarios');
        tbody.innerHTML = usuarios.map(u => {
            const safeId = sanitizeId(u.id);
            return `
            <tr>
                <td><strong>${escapeHTML(u.nome)}</strong><br><small style="color:var(--text-muted)">${escapeHTML(u.email)}</small></td>
                <td><span class="badge ${u.perfil === 'admin' ? 'badge-info' : 'badge-secondary'}">${escapeHTML(u.perfil.toUpperCase())}</span></td>
                <td><span class="badge ${u.nivelAcesso === 'completo' ? 'badge-success' : 'badge-warning'}">${escapeHTML(u.nivelAcesso.toUpperCase())}</span></td>
                <td><span class="badge ${u.status === 'ativo' ? 'badge-success' : 'badge-danger'}">${escapeHTML(u.status.toUpperCase())}</span></td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="abrirModalEditarUsuario('${safeId}')">✏️ Editar</button>
                    ${u.id !== state.currentUser.id ? `<button class="btn btn-danger btn-sm" onclick="excluirUsuario('${safeId}')">🗑️</button>` : ''}
                </td>
            </tr>
        `}).join('');
    } catch (e) {
        alert(e.message);
    }
}

function abrirModalNovoUsuario() {
    document.getElementById('form-usuario').reset();
    document.getElementById('usr-id').value = '';
    document.getElementById('usr-senha').value = '';
    document.getElementById('modal-user-form-title').innerText = 'Novo Usuário';
    document.getElementById('modal-usuario-form').classList.remove('hidden');
}

async function abrirModalEditarUsuario(id) {
    const safeId = sanitizeId(id);
    let usuario;
    try {
        const { usuarios } = await api('GET', '/api/usuarios');
        usuario = usuarios.find(u => u.id === safeId);
    } catch (e) {
        alert(e.message);
        return;
    }
    if (!usuario) return;

    document.getElementById('usr-id').value = usuario.id;
    document.getElementById('usr-nome').value = usuario.nome;
    document.getElementById('usr-email').value = usuario.email;
    document.getElementById('usr-perfil').value = usuario.perfil;
    document.getElementById('usr-nivel').value = usuario.nivelAcesso;
    document.getElementById('usr-status').value = usuario.status;
    document.getElementById('usr-senha').value = '';

    document.getElementById('modal-user-form-title').innerText = 'Editar Usuário';
    document.getElementById('modal-usuario-form').classList.remove('hidden');
}

async function salvarUsuario() {
    const id = document.getElementById('usr-id').value;
    const payload = {
        nome: document.getElementById('usr-nome').value.trim(),
        email: document.getElementById('usr-email').value.trim().toLowerCase(),
        senha: document.getElementById('usr-senha').value,
        perfil: document.getElementById('usr-perfil').value,
        nivelAcesso: document.getElementById('usr-nivel').value,
        status: document.getElementById('usr-status').value
    };

    try {
        if (id) {
            await api('PUT', `/api/usuarios/${sanitizeId(id)}`, payload);
        } else {
            await api('POST', '/api/usuarios', payload);
        }
        fecharModais();
        renderizarUsuarios();
        alert('Cadastro de usuário atualizado com sucesso!');
    } catch (e) {
        alert(e.message);
    }
}

async function excluirUsuario(id) {
    const safeId = sanitizeId(id);
    if (safeId === state.currentUser.id) {
        alert('Não é permitido excluir o usuário da própria sessão ativa.');
        return;
    }
    if (!confirm('Confirma a exclusão deste usuário do sistema?')) return;
    try {
        await api('DELETE', `/api/usuarios/${safeId}`);
        renderizarUsuarios();
    } catch (e) {
        alert(e.message);
    }
}

/* --- HISTÓRICO / AUDITORIA --- */
async function renderizarHistorico() {
    try {
        const { logs } = await api('GET', '/api/logs');
        const tbody = document.getElementById('tbody-historico');
        tbody.innerHTML = logs.map(l => `
            <tr>
                <td>${new Date(l.dataHora).toLocaleString('pt-BR')}</td>
                <td>${escapeHTML(l.usuario)}</td>
                <td>${escapeHTML(l.acao)}</td>
                <td>${escapeHTML(l.alvo)}</td>
                <td><span class="badge ${l.resultado === 'Sucesso' ? 'badge-success' : 'badge-danger'}">${escapeHTML(l.resultado)}</span></td>
            </tr>
        `).join('') || '<tr><td colspan="5" class="text-center">Nenhum registro de auditoria.</td></tr>';
    } catch (e) {
        alert(e.message);
    }
}

async function limparHistoricoAuditoria() {
    if (!confirm('Deseja realmente purgar a Trilha de Auditoria? Esta ação ficará gravada.')) return;
    try {
        await api('DELETE', '/api/logs');
        renderizarHistorico();
    } catch (e) {
        alert(e.message);
    }
}

/* --- CONFIGURAÇÕES / BACKUP --- */
async function exportarBackupJSON() {
    try {
        const backupData = await api('GET', '/api/backup/exportar');
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PMG_SCL_Backup.json`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        alert(e.message);
    }
}

function importarBackupJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const data = JSON.parse(e.target.result);
            await api('POST', '/api/backup/importar', data);
            alert('Backup importado com sucesso!');
            location.reload();
        } catch (err) {
            alert('Erro ao importar arquivo: ' + err.message);
        }
    };
    reader.readAsText(file);
}

async function restaurarDadosIniciaisSeed() {
    if (!confirm('Atenção: Todos os dados de licitações e usuários cadastrados serão substituídos pelos dados padrão de demonstração. Deseja prosseguir?')) return;
    try {
        await api('POST', '/api/backup/restaurar-padrao');
        alert('Banco de dados restaurado para os valores padrão. Faça login novamente.');
        location.reload();
    } catch (e) {
        alert(e.message);
    }
}

/* --- UTILITÁRIOS DE INTERFACE --- */
function fecharModais() {
    document.querySelectorAll('.modal-overlay:not(#view-login)').forEach(m => m.classList.add('hidden'));
}

function alternarVisibilidadeSenha(inputId) {
    const input = document.getElementById(inputId);
    if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fecharModais();
});
