        // Proteção contra Clickjacking e enquadramento não autorizado
        if (window.top !== window.self) {
            window.top.location = window.self.location;
        }

        let lastActivityTime = Date.now();

        let state = {
            currentUser: null,
            users: [],
            bids: [],
            logs: [],
            adminPreviewMode: 'real',
            currentDocViewingId: null
        };

        // --- NÚCLEO CRIPTOGRÁFICO (Web Crypto API - SHA-256) ---
        async function hashPassword(password, salt = 'PMG_GOIANA_SALT_2026_CLASSIFIED') {
            const encoder = new TextEncoder();
            const data = encoder.encode(password + salt);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }

        // --- VALIDAÇÃO DE SEGURANÇA E HIGIENIZAÇÃO (XSS / REGEX) ---
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

        /* --- MÁSCARA DE ENTRADA (Telefone) --- */
        function aplicarMascaraTelefone(input) {
            let digitos = input.value.replace(/\D/g, '').slice(0, 11);
            if (digitos.length > 10) {
                input.value = digitos.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
            } else if (digitos.length > 5) {
                input.value = digitos.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
            } else if (digitos.length > 2) {
                input.value = digitos.replace(/(\d{2})(\d{0,5})/, '($1) $2');
            } else if (digitos.length > 0) {
                input.value = `(${digitos}`;
            } else {
                input.value = '';
            }
        }

        /* --- CONTADOR DE CARACTERES (Limite de Caracteres) --- */
        function atualizarContador(inputId, contadorId) {
            const campo = document.getElementById(inputId);
            const contador = document.getElementById(contadorId);
            if (campo && contador) contador.innerText = campo.value.length;
        }

        /* --- FEEDBACK DE CARREGAMENTO (Resiliência e Feedback / Defensive UI) --- */
        function mostrarCarregando(mensagem) {
            document.getElementById('loading-mensagem').innerText = mensagem || 'Processando sua solicitação...';
            document.getElementById('loading-overlay').classList.remove('hidden');
        }

        function ocultarCarregando() {
            document.getElementById('loading-overlay').classList.add('hidden');
        }

        function aguardar(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        /* --- TOASTS DE SISTEMA (avisos não-bloqueantes) --- */
        function mostrarToast(mensagem, tipo = 'erro') {
            const area = document.getElementById('toast-area');
            if (!area) return;
            const toast = document.createElement('div');
            toast.className = `toast toast-${tipo}`;
            toast.innerText = mensagem;
            area.appendChild(toast);
            setTimeout(() => toast.remove(), 6000);
        }

        /* --- PÁGINAS DE ERRO CUSTOMIZADAS (Resiliência e Feedback) ---
           Nunca exibimos ao usuário o erro técnico/stack trace: ele fica
           apenas no console (para o desenvolvedor). O usuário vê só um
           aviso amigável e genérico. */
        window.addEventListener('error', (event) => {
            console.error('Erro não tratado capturado:', event.error || event.message);
            mostrarToast('Ocorreu um erro inesperado. Se o problema persistir, recarregue a página.', 'erro');
            ocultarCarregando();
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error('Promise rejeitada sem tratamento:', event.reason);
            mostrarToast('Não foi possível concluir a operação. Tente novamente.', 'erro');
            ocultarCarregando();
        });

        function validarEmail(email) {
            const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            return re.test(String(email).toLowerCase());
        }

        function validarComplexidadeSenha(senha) {
            // Mínimo 8 caracteres, 1 maiúscula, 1 minúscula, 1 número, 1 caractere especial
            const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#._-])[A-Za-z\d@$!%*?&#._-]{8,}$/;
            return re.test(senha);
        }

        // --- CONTROLE DE ACESSO NO NÍVEL DE FUNÇÃO (RBAC SERVERSIDE-LIKE GUARD) ---
        function verificarPermissaoAdmin() {
            if (!state.currentUser || state.currentUser.perfil !== 'admin') {
                alert('Acesso Negado: Você não possui privilégios de Administrador para realizar esta ação.');
                registrarLog(
                    state.currentUser ? state.currentUser.email : 'SISTEMA_ANONIMO',
                    'Acesso Não Autorizado Interceptado',
                    'Falha',
                    'Tentativa de violação de perfil executada no console ou interface.'
                );
                return false;
            }
            return true;
        }

        // --- PREVENÇÃO DE FORÇA BRUTA (RATE LIMITING) ---
        function verificarBloqueioTentativas(email) {
            const key = 'PMG_SCL_LOCK_' + sanitizeId(email);
            const lockData = JSON.parse(localStorage.getItem(key) || '{}');
            if (lockData.lockedUntil && Date.now() < lockData.lockedUntil) {
                const minutosRestantes = Math.ceil((lockData.lockedUntil - Date.now()) / 60000);
                return `Conta temporariamente bloqueada por repetidas falhas de autenticação. Tente novamente em ${minutosRestantes} minuto(s).`;
            }
            return null;
        }

        function registrarTentativaFalhada(email) {
            const key = 'PMG_SCL_LOCK_' + sanitizeId(email);
            const lockData = JSON.parse(localStorage.getItem(key) || '{"attempts": 0}');
            lockData.attempts = (lockData.attempts || 0) + 1;
            if (lockData.attempts >= MAX_LOGIN_ATTEMPTS) {
                lockData.lockedUntil = Date.now() + LOCKOUT_TIME_MS;
            }
            localStorage.setItem(key, JSON.stringify(lockData));
        }

        function limparTentativasFalhadas(email) {
            localStorage.removeItem('PMG_SCL_LOCK_' + sanitizeId(email));
        }

        // --- MONITOR DE INATIVIDADE E SESSÃO ---
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
                        registrarLog(state.currentUser.email, 'Encaminhado para Logout', 'Sucesso', 'Sessão encerrada por inatividade do usuário.');
                        alert('Sua sessão foi encerrada automaticamente por inatividade.');
                        logout();
                    }
                }
            }, 30000);
        }

        window.addEventListener('DOMContentLoaded', async () => {
            await carregarDadosStorage();
            verificarSessao();
            iniciarMonitorInatividade();
        });

        async function carregarDadosStorage() {
            const rawUsers = localStorage.getItem(STORAGE_KEY_USERS);
            const rawBids = localStorage.getItem(STORAGE_KEY_BIDS);
            const rawLogs = localStorage.getItem(STORAGE_KEY_LOGS);

            if (!rawUsers || !rawBids) {
                await restaurarDadosIniciaisSeed();
            } else {
                state.users = JSON.parse(rawUsers);
                state.bids = JSON.parse(rawBids);
                state.logs = rawLogs ? JSON.parse(rawLogs) : [];
            }
        }

        async function restaurarDadosIniciaisSeed() {
            const hashAdmin = await hashPassword('Admin@123');
            const hashCompleto = await hashPassword('Usuario@123');
            const hashRestrito = await hashPassword('Usuario@123');

            const seedUsers = [
                {
                    id: 'usr-admin',
                    nome: 'Administrador Geral',
                    email: 'admin@goiana.pe.gov.br',
                    senhaHash: hashAdmin,
                    perfil: 'admin',
                    nivelAcesso: 'completo',
                    status: 'ativo',
                    aceiteTermo: { aceito: true, dataHora: new Date().toISOString(), versao: '1.0-2026' },
                    dataCriacao: new Date().toISOString()
                },
                {
                    id: 'usr-completo',
                    nome: 'João Silva (Acesso Completo)',
                    email: 'completo@exemplo.com',
                    senhaHash: hashCompleto,
                    perfil: 'comum',
                    nivelAcesso: 'completo',
                    status: 'ativo',
                    aceiteTermo: { aceito: true, dataHora: new Date().toISOString(), versao: '1.0-2026' },
                    dataCriacao: new Date().toISOString()
                },
                {
                    id: 'usr-restrito',
                    nome: 'Maria Souza (Acesso Restrito)',
                    email: 'restrito@exemplo.com',
                    senhaHash: hashRestrito,
                    perfil: 'comum',
                    nivelAcesso: 'restrito',
                    status: 'ativo',
                    aceiteTermo: { aceito: true, dataHora: new Date().toISOString(), versao: '1.0-2026' },
                    dataCriacao: new Date().toISOString()
                }
            ];

            const seedBids = [
                {
                    id: 'lic-001',
                    numero: 'PE-001/2026',
                    ano: 2026,
                    processo: 'PA-012/2026',
                    modalidade: 'Pregão Eletrônico',
                    objeto: 'Aquisição de gêneros alimentícios para atendimento ao programa de merenda escolar do município de Goiana.',
                    orgao: 'Secretaria Municipal de Educação',
                    dataPublicacao: '2026-01-10',
                    dataAbertura: '2026-02-01T09:00',
                    localSessao: 'Portal de Compras Governamentais - Sala Virtual 01',
                    situacao: 'Aberta',
                    valorEstimado: 1250000.00,
                    visivelComum: 'sim',
                    conteudoIntegral: 'CONTEÚDO CONFIDENCIAL E INTEGRAL DO EDITAL PE-001/2026:\nItem 1: Arroz tipo 1 (50.000 kg);\nItem 2: Feijão Carioca (30.000 kg);\nCláusula de Entrega: Parcelada em até 5 dias após requisição.',
                    assinaturas: [
                        { nome: 'Carlos Eduardo Ramos', funcao: 'Pregoeiro Oficial', data: '2026-01-09' }
                    ]
                },
                {
                    id: 'lic-002',
                    numero: 'CC-002/2026',
                    ano: 2026,
                    processo: 'PA-045/2026',
                    modalidade: 'Concorrência',
                    objeto: 'Reforma e ampliação da Unidade Básica de Saúde (UBS) do distrito de Tejucupapo.',
                    orgao: 'Secretaria de Infraestrutura e Obras',
                    dataPublicacao: '2026-01-15',
                    dataAbertura: '2026-02-20T10:00',
                    localSessao: 'Auditório da Prefeitura de Goiana',
                    situacao: 'Em Andamento',
                    valorEstimado: 890000.50,
                    visivelComum: 'sim',
                    conteudoIntegral: 'CONTEÚDO INTEGRAL DA CONCORRÊNCIA CC-002/2026:\nMemorial descritivo de engenharia, planta baixa, cronograma físico-financeiro.',
                    assinaturas: [
                        { nome: 'Ana Lucia Albuquerque', funcao: 'Engenheira Chefe', data: '2026-01-14' }
                    ]
                }
            ];

            state.users = seedUsers;
            state.bids = seedBids;
            state.logs = [];

            salvarDadosStorage();
            registrarLog('SISTEMA', 'Restauração Inicial de Segurança', 'Sucesso', 'Base reinicializada com suporte a criptografia SHA-256 e termos de uso.');
        }

        function salvarDadosStorage() {
            localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(state.users));
            localStorage.setItem(STORAGE_KEY_BIDS, JSON.stringify(state.bids));
            localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(state.logs));
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

        function solicitarRedefinicaoSenha() {
            const email = document.getElementById('reset-email').value.trim().toLowerCase();
            if (!validarEmail(email)) {
                alert('Informe um endereço de e-mail válido.');
                return;
            }
            registrarLog(email, 'Solicitação de Redefinição de Senha', 'Sucesso', 'Token enviado para homologação administrativa');
            alert(`Solicitação registrada para o e-mail: ${email}. Por razões de segurança, entre em contato com o Administrador para autorizar e redefinir sua chave.`);
            fecharModais();
        }

        async function executarCadastro() {
            const nome = document.getElementById('cad-nome').value.trim();
            const email = document.getElementById('cad-email').value.trim().toLowerCase();
            const telefone = document.getElementById('cad-telefone').value.trim();
            const senha = document.getElementById('cad-senha').value;
            const senhaConf = document.getElementById('cad-senha-conf').value;
            const termoAceito = document.getElementById('cad-termo').checked;

            if (!nome || !email || !senha) {
                alert('Preencha todos os campos obrigatórios.');
                return;
            }

            if (!validarEmail(email)) {
                alert('Informe um endereço de e-mail válido.');
                return;
            }

            if (!validarComplexidadeSenha(senha)) {
                alert('A senha informada não atende aos requisitos mínimos de segurança:\n- Mínimo de 8 caracteres\n- Pelo menos 1 letra maiúscula\n- Pelo menos 1 letra minúscula\n- Pelo menos 1 número\n- Pelo menos 1 caractere especial (@$!%*?&#._-)');
                return;
            }

            if (senha !== senhaConf) {
                alert('A confirmação da senha não confere com a senha digitada.');
                return;
            }

            if (!termoAceito) {
                alert('É obrigatório aceitar os Termos de Uso e Política de Privacidade para cadastrar uma conta.');
                return;
            }

            const existe = state.users.some(u => u.email.toLowerCase() === email);
            if (existe) {
                alert('Este endereço de e-mail já está cadastrado.');
                return;
            }

            mostrarCarregando('Criando sua conta...');
            document.getElementById('btn-cadastro').disabled = true;

            const hashedSenha = await hashPassword(senha);

            const novoUsuario = {
                id: 'usr-' + Date.now(),
                nome: escapeHTML(nome),
                email: email,
                telefone: escapeHTML(telefone),
                senhaHash: hashedSenha,
                perfil: 'comum',
                nivelAcesso: 'restrito',
                status: 'ativo',
                aceiteTermo: {
                    aceito: true,
                    dataHora: new Date().toISOString(),
                    versao: '1.0-2026'
                },
                dataCriacao: new Date().toISOString()
            };

            state.users.push(novoUsuario);
            salvarDadosStorage();

            registrarLog(email, 'Novo Cadastro de Usuário', 'Sucesso', 'Conta criada com aceite dos Termos v1.0');

            state.currentUser = novoUsuario;
            const sessionData = {
                userId: novoUsuario.id,
                expiresAt: Date.now() + SESSION_TTL_MS
            };
            localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(sessionData));

            document.getElementById('view-login').classList.add('hidden');
            document.getElementById('app-main-structure').classList.remove('hidden');

            atualizarInterfaceUsuario();
            navegarPara('dashboard');

            ocultarCarregando();
            document.getElementById('btn-cadastro').disabled = false;
            alert(`Bem-vindo ao SCL, ${novoUsuario.nome}! Sua conta foi cadastrada com sucesso e os Termos de Uso foram registrados.`);
        }

        async function executarLogin() {
            const emailInput = document.getElementById('login-email').value.trim().toLowerCase();
            const senhaInput = document.getElementById('login-senha').value;
            const lembrar = document.getElementById('login-lembrar').checked;

            if (!emailInput || !senhaInput) {
                alert('Preencha os campos de usuário e senha.');
                return;
            }

            const mensagemBloqueio = verificarBloqueioTentativas(emailInput);
            if (mensagemBloqueio) {
                alert(mensagemBloqueio);
                registrarLog(emailInput, 'Tentativa em Conta Bloqueada', 'Falha', 'Bloqueio temporário por brute-force.');
                return;
            }

            mostrarCarregando('Autenticando...');
            document.getElementById('btn-login').disabled = true;

            const hashInput = await hashPassword(senhaInput);
            const user = state.users.find(u => u.email.toLowerCase() === emailInput && u.senhaHash === hashInput);

            if (!user) {
                ocultarCarregando();
                document.getElementById('btn-login').disabled = false;
                registrarTentativaFalhada(emailInput);
                alert('Credenciais incorretas. Verifique e tente novamente.');
                registrarLog(emailInput, 'Tentativa de Login Falhada', 'Falha', 'Senha incorreta ou usuário inexistente.');
                return;
            }

            if (user.status === 'bloqueado') {
                ocultarCarregando();
                document.getElementById('btn-login').disabled = false;
                alert('Esta conta de usuário encontra-se bloqueada. Entre em contato com a administração.');
                registrarLog(emailInput, 'Tentativa de Login Usuário Bloqueado', 'Falha', 'Acesso negado por status inativo/bloqueado.');
                return;
            }

            limparTentativasFalhadas(emailInput);
            state.currentUser = user;

            const sessionTTL = lembrar ? SESSION_TTL_MS : (30 * 60 * 1000); // 2h se lembrar, 30 min padrão
            const sessionData = {
                userId: user.id,
                expiresAt: Date.now() + sessionTTL
            };
            localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(sessionData));

            document.getElementById('view-login').classList.add('hidden');
            document.getElementById('app-main-structure').classList.remove('hidden');

            registrarLog(user.email, 'Login Efetuado', 'Sucesso', 'Sessão iniciada com validação criptográfica SHA-256.');

            atualizarInterfaceUsuario();
            navegarPara('dashboard');

            ocultarCarregando();
            document.getElementById('btn-login').disabled = false;
        }

        function verificarSessao() {
            const rawSession = localStorage.getItem(STORAGE_KEY_SESSION);
            if (rawSession) {
                try {
                    const sessionData = JSON.parse(rawSession);
                    if (sessionData.expiresAt && Date.now() < sessionData.expiresAt) {
                        const user = state.users.find(u => u.id === sessionData.userId);
                        if (user && user.status === 'ativo') {
                            state.currentUser = user;
                            document.getElementById('view-login').classList.add('hidden');
                            document.getElementById('app-main-structure').classList.remove('hidden');
                            atualizarInterfaceUsuario();
                            navegarPara('dashboard');
                            return;
                        }
                    }
                } catch (e) {
                    localStorage.removeItem(STORAGE_KEY_SESSION);
                }
            }
            document.getElementById('view-login').classList.remove('hidden');
            document.getElementById('app-main-structure').classList.add('hidden');
        }

        function logout() {
            if (state.currentUser) {
                registrarLog(state.currentUser.email, 'Logout', 'Sucesso', 'Sessão encerrada voluntariamente.');
            }
            state.currentUser = null;
            localStorage.removeItem(STORAGE_KEY_SESSION);
            location.reload();
        }

        function navegarPara(secao) {
            if (secao === 'usuarios' && !verificarPermissaoAdmin()) {
                return;
            }
            if (secao === 'config' && !verificarPermissaoAdmin()) {
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

        function renderizarDashboard() {
            document.getElementById('dash-welcome').innerText = `Olá, ${escapeHTML(state.currentUser.nome)}`;
            document.getElementById('dash-access-desc').innerText = `Perfil: ${state.currentUser.perfil === 'admin' ? 'Administrador' : 'Usuário Comum'} | Nível de acesso: ${escapeHTML(state.currentUser.nivelAcesso.toUpperCase())}.`;

            const visibleBids = state.bids.filter(b => state.currentUser.perfil === 'admin' || b.visivelComum === 'sim');
            document.getElementById('m-licitacoes-num').innerText = visibleBids.length;

            if (state.currentUser.nivelAcesso === 'completo' || state.currentUser.perfil === 'admin') {
                document.getElementById('m-docs-completos').innerText = visibleBids.length;
                document.getElementById('m-docs-restritos').innerText = 0;
            } else {
                document.getElementById('m-docs-completos').innerText = 0;
                document.getElementById('m-docs-restritos').innerText = visibleBids.length;
            }

            document.getElementById('m-total-usuarios').innerText = state.users.length;

            const recent = state.logs
                .filter(l => l.usuario === state.currentUser.email)
                .slice(-5)
                .reverse();

            const tbody = document.getElementById('dash-recent-actions');
            tbody.innerHTML = recent.map(l => `
                <tr>
                    <td>${new Date(l.dataHora).toLocaleString('pt-BR')}</td>
                    <td>${escapeHTML(l.acao)}</td>
                    <td>${escapeHTML(l.alvo)}</td>
                    <td><span class="badge ${l.resultado === 'Sucesso' ? 'badge-success' : 'badge-danger'}">${escapeHTML(l.resultado)}</span></td>
                </tr>
            `).join('') || '<tr><td colspan="4" class="text-center">Nenhuma ação recente registrada.</td></tr>';
        }

        function renderizarLicitacoes() {
            filtrarLicitacoes();
        }

        function filtrarLicitacoes() {
            const query = document.getElementById('filter-search').value.toLowerCase();
            const mod = document.getElementById('filter-modalidade').value;
            const sit = document.getElementById('filter-situacao').value;

            const filtradas = state.bids.filter(b => {
                const matchUserVis = state.currentUser.perfil === 'admin' || b.visivelComum === 'sim';
                const matchQuery = b.numero.toLowerCase().includes(query) || b.objeto.toLowerCase().includes(query) || b.processo.toLowerCase().includes(query);
                const matchMod = !mod || b.modalidade === mod;
                const matchSit = !sit || b.situacao === sit;
                return matchUserVis && matchQuery && matchMod && matchSit;
            });

            const tbody = document.getElementById('tbody-licitacoes');
            tbody.innerHTML = filtradas.map(b => {
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
        }

        function visualizarDocumento(bidId) {
            const safeId = sanitizeId(bidId);
            state.currentDocViewingId = safeId;
            const bid = state.bids.find(b => b.id === safeId);
            if (!bid) return;

            let nivelEfetivo = state.currentUser.nivelAcesso;
            if (state.currentUser.perfil === 'admin') {
                if (state.adminPreviewMode !== 'real') {
                    nivelEfetivo = state.adminPreviewMode;
                } else {
                    nivelEfetivo = 'completo';
                }
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

            if (nivelEfetivo === 'completo') {
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
            registrarLog(state.currentUser.email, 'Consulta de Licitação', 'Sucesso', `Visualizou edital ${bid.numero}`);
        }

        function alterarModoPreviewAdmin() {
            if (!verificarPermissaoAdmin()) return;
            state.adminPreviewMode = document.getElementById('select-admin-preview-mode').value;
            if (state.currentDocViewingId) {
                visualizarDocumento(state.currentDocViewingId);
            }
        }

        function abrirModalNovaLicitacao() {
            if (!verificarPermissaoAdmin()) return;
            document.getElementById('form-licitacao').reset();
            document.getElementById('lic-id').value = '';
            document.getElementById('modal-lic-form-title').innerText = 'Cadastrar Licitação';
            document.getElementById('modal-licitacao-form').classList.remove('hidden');
        }

        function abrirModalEditarLicitacao(id) {
            if (!verificarPermissaoAdmin()) return;
            const safeId = sanitizeId(id);
            const bid = state.bids.find(b => b.id === safeId);
            if (!bid) return;

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
            document.getElementById('lic-conteudo').value = bid.conteudoIntegral;

            document.getElementById('modal-lic-form-title').innerText = 'Editar Licitação';
            document.getElementById('modal-licitacao-form').classList.remove('hidden');
        }

        async function salvarLicitacao() {
            if (!verificarPermissaoAdmin()) return;
            mostrarCarregando('Salvando licitação...');
            document.getElementById('btn-salvar-licitacao').disabled = true;
            await aguardar(300);

            const id = document.getElementById('lic-id').value;

            const newBid = {
                id: id ? sanitizeId(id) : 'lic-' + Date.now(),
                numero: escapeHTML(document.getElementById('lic-num').value.trim()),
                ano: parseInt(document.getElementById('lic-ano').value),
                processo: escapeHTML(document.getElementById('lic-processo').value.trim()),
                modalidade: escapeHTML(document.getElementById('lic-modalidade').value),
                objeto: escapeHTML(document.getElementById('lic-objeto').value.trim()),
                orgao: escapeHTML(document.getElementById('lic-orgao').value.trim()),
                valorEstimado: parseFloat(document.getElementById('lic-valor').value) || 0,
                dataPublicacao: document.getElementById('lic-data-pub').value,
                dataAbertura: document.getElementById('lic-data-abertura').value,
                situacao: document.getElementById('lic-situacao').value,
                visivelComum: document.getElementById('lic-visivel').value,
                conteudoIntegral: escapeHTML(document.getElementById('lic-conteudo').value.trim()),
                assinaturas: [{ nome: escapeHTML(state.currentUser.nome), funcao: 'Servidor Autenticado', data: new Date().toISOString().split('T')[0] }]
            };

            if (id) {
                const idx = state.bids.findIndex(b => b.id === id);
                if (idx !== -1) state.bids[idx] = newBid;
            } else {
                state.bids.push(newBid);
            }

            salvarDadosStorage();
            fecharModais();
            renderizarLicitacoes();
            registrarLog(state.currentUser.email, 'Gravou Licitação', 'Sucesso', `Registro ${newBid.numero}`);
            ocultarCarregando();
            document.getElementById('btn-salvar-licitacao').disabled = false;
            alert('Licitação gravada com sucesso!');
        }

        function excluirLicitacao(id) {
            if (!verificarPermissaoAdmin()) return;
            const safeId = sanitizeId(id);
            if (!confirm('Tem certeza de que deseja remover esta licitação?')) return;
            state.bids = state.bids.filter(b => b.id !== safeId);
            salvarDadosStorage();
            renderizarLicitacoes();
            registrarLog(state.currentUser.email, 'Removeu Licitação', 'Sucesso', `ID ${safeId}`);
        }

        function renderizarUsuarios() {
            if (!verificarPermissaoAdmin()) return;
            const tbody = document.getElementById('tbody-usuarios');
            tbody.innerHTML = state.users.map(u => {
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
        }

        function abrirModalNovoUsuario() {
            if (!verificarPermissaoAdmin()) return;
            document.getElementById('form-usuario').reset();
            document.getElementById('usr-id').value = '';
            document.getElementById('usr-senha').value = '';
            document.getElementById('modal-user-form-title').innerText = 'Novo Usuário';
            document.getElementById('modal-usuario-form').classList.remove('hidden');
        }

        function abrirModalEditarUsuario(id) {
            if (!verificarPermissaoAdmin()) return;
            const safeId = sanitizeId(id);
            const user = state.users.find(u => u.id === safeId);
            if (!user) return;

            document.getElementById('usr-id').value = user.id;
            document.getElementById('usr-nome').value = user.nome;
            document.getElementById('usr-email').value = user.email;
            document.getElementById('usr-telefone').value = user.telefone || '';
            document.getElementById('usr-perfil').value = user.perfil;
            document.getElementById('usr-nivel').value = user.nivelAcesso;
            document.getElementById('usr-status').value = user.status;
            document.getElementById('usr-senha').value = '';

            document.getElementById('modal-user-form-title').innerText = 'Editar Usuário';
            document.getElementById('modal-usuario-form').classList.remove('hidden');
        }

        async function salvarUsuario() {
            if (!verificarPermissaoAdmin()) return;
            const id = document.getElementById('usr-id').value;
            const email = document.getElementById('usr-email').value.trim().toLowerCase();
            const telefone = document.getElementById('usr-telefone').value.trim();
            const senha = document.getElementById('usr-senha').value;

            if (!validarEmail(email)) {
                alert('Informe um e-mail válido.');
                return;
            }

            if (senha && !validarComplexidadeSenha(senha)) {
                alert('A nova senha não atende aos critérios de complexidade configurados.');
                return;
            }

            mostrarCarregando('Salvando usuário...');
            document.getElementById('btn-salvar-usuario').disabled = true;
            await aguardar(300);

            if (id) {
                const safeId = sanitizeId(id);
                const idx = state.users.findIndex(u => u.id === safeId);
                if (idx !== -1) {
                    const user = state.users[idx];
                    user.nome = escapeHTML(document.getElementById('usr-nome').value.trim());
                    user.email = email;
                    user.telefone = escapeHTML(telefone);
                    user.perfil = document.getElementById('usr-perfil').value;
                    user.nivelAcesso = document.getElementById('usr-nivel').value;
                    user.status = document.getElementById('usr-status').value;
                    if (senha) {
                        user.senhaHash = await hashPassword(senha);
                    }
                    state.users[idx] = user;
                }
            } else {
                if (!senha) {
                    ocultarCarregando();
                    document.getElementById('btn-salvar-usuario').disabled = false;
                    alert('Para novos cadastros de usuários, a senha é obrigatória.');
                    return;
                }
                const newUser = {
                    id: 'usr-' + Date.now(),
                    nome: escapeHTML(document.getElementById('usr-nome').value.trim()),
                    email: email,
                    telefone: escapeHTML(telefone),
                    senhaHash: await hashPassword(senha),
                    perfil: document.getElementById('usr-perfil').value,
                    nivelAcesso: document.getElementById('usr-nivel').value,
                    status: document.getElementById('usr-status').value,
                    aceiteTermo: { aceito: true, dataHora: new Date().toISOString(), versao: '1.0-2026' },
                    dataCriacao: new Date().toISOString()
                };
                state.users.push(newUser);
            }

            salvarDadosStorage();
            fecharModais();
            renderizarUsuarios();
            registrarLog(state.currentUser.email, 'Alteração de Usuário', 'Sucesso', `Usuário ${email}`);
            ocultarCarregando();
            document.getElementById('btn-salvar-usuario').disabled = false;
            alert('Cadastro de usuário atualizado com sucesso!');
        }

        function excluirUsuario(id) {
            if (!verificarPermissaoAdmin()) return;
            const safeId = sanitizeId(id);
            if (safeId === state.currentUser.id) {
                alert('Não é permitido excluir o usuário da própria sessão ativa.');
                return;
            }
            if (!confirm('Confirma a exclusão deste usuário do sistema?')) return;
            state.users = state.users.filter(u => u.id !== safeId);
            salvarDadosStorage();
            renderizarUsuarios();
            registrarLog(state.currentUser.email, 'Exclusão de Usuário', 'Sucesso', `ID ${safeId}`);
        }

        function renderizarHistorico() {
            const tbody = document.getElementById('tbody-historico');
            const logsExibicao = state.currentUser.perfil === 'admin' 
                ? state.logs 
                : state.logs.filter(l => l.usuario === state.currentUser.email);

            tbody.innerHTML = logsExibicao.slice().reverse().map(l => `
                <tr>
                    <td>${new Date(l.dataHora).toLocaleString('pt-BR')}</td>
                    <td>${escapeHTML(l.usuario)}</td>
                    <td>${escapeHTML(l.acao)}</td>
                    <td>${escapeHTML(l.alvo)}</td>
                    <td><span class="badge ${l.resultado === 'Sucesso' ? 'badge-success' : 'badge-danger'}">${escapeHTML(l.resultado)}</span></td>
                </tr>
            `).join('') || '<tr><td colspan="5" class="text-center">Nenhum registro de auditoria.</td></tr>';
        }

        function registrarLog(usuario, acao, resultado, alvo) {
            const logEntry = {
                id: 'log-' + Date.now(),
                dataHora: new Date().toISOString(),
                usuario: escapeHTML(usuario),
                acao: escapeHTML(acao),
                resultado: escapeHTML(resultado),
                alvo: escapeHTML(alvo)
            };
            state.logs.push(logEntry);
            localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(state.logs));
        }

        function limparHistoricoAuditoria() {
            if (!verificarPermissaoAdmin()) return;
            if (!confirm('Deseja realmente purgar a Trilha de Auditoria? Esta ação ficará gravada.')) return;
            state.logs = [];
            salvarDadosStorage();
            registrarLog(state.currentUser.email, 'Purga de Auditoria', 'Sucesso', 'Histórico zerado por administrador.');
            renderizarHistorico();
        }

        function exportarBackupJSON() {
            if (!verificarPermissaoAdmin()) return;
            const safeUsers = state.users.map(u => {
                const { senhaHash, ...usrWithoutPass } = u;
                return usrWithoutPass;
            });

            const backupData = {
                users: safeUsers,
                bids: state.bids,
                logs: state.logs,
                exportDate: new Date().toISOString(),
                exportedBy: state.currentUser.email
            };

            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `PMG_SCL_Backup_Classificado.json`;
            a.click();
            URL.revokeObjectURL(url);
            registrarLog(state.currentUser.email, 'Exportou Backup', 'Sucesso', 'Arquivo JSON sanitizado gerado.');
        }

        function importarBackupJSON(event) {
            if (!verificarPermissaoAdmin()) return;
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async function(e) {
                try {
                    const data = JSON.parse(e.target.result);
                    if (Array.isArray(data.bids)) state.bids = data.bids;
                    if (Array.isArray(data.logs)) state.logs = data.logs;
                    salvarDadosStorage();
                    registrarLog(state.currentUser.email, 'Importou Backup', 'Sucesso', 'Restauração concluída.');
                    alert('Backup importado com sucesso!');
                    location.reload();
                } catch (err) {
                    alert('Erro ao importar arquivo: Formato JSON inválido.');
                }
            };
            reader.readAsText(file);
        }

        function limparTodoLocalStorage() {
            if (!verificarPermissaoAdmin()) return;
            if (confirm('Atenção: Todos os dados locais serão zerados. Deseja prosseguir?')) {
                localStorage.clear();
                location.reload();
            }
        }

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
