const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const db = require('./db');

function limparBanco() {
  db.exec(`
    DELETE FROM assinaturas;
    DELETE FROM licitacoes;
    DELETE FROM logs;
    DELETE FROM usuarios;
    DELETE FROM login_locks;
  `);
}

function seed() {
  const agora = new Date().toISOString();

  const usuarios = [
    {
      id: 'usr-admin',
      nome: 'Administrador Geral',
      email: 'admin@goiana.pe.gov.br',
      senha: 'Admin@123',
      perfil: 'admin',
      nivel_acesso: 'completo'
    },
    {
      id: 'usr-completo',
      nome: 'João Silva (Acesso Completo)',
      email: 'completo@exemplo.com',
      senha: 'Usuario@123',
      perfil: 'comum',
      nivel_acesso: 'completo'
    },
    {
      id: 'usr-restrito',
      nome: 'Maria Souza (Acesso Restrito)',
      email: 'restrito@exemplo.com',
      senha: 'Usuario@123',
      perfil: 'comum',
      nivel_acesso: 'restrito'
    }
  ];

  const insertUsuario = db.prepare(`
    INSERT INTO usuarios (id, nome, email, senha_hash, perfil, nivel_acesso, status, termo_aceito, termo_data_hora, termo_versao, data_criacao)
    VALUES (@id, @nome, @email, @senha_hash, @perfil, @nivel_acesso, 'ativo', 1, @agora, '1.0-2026', @agora)
  `);

  for (const u of usuarios) {
    insertUsuario.run({
      id: u.id,
      nome: u.nome,
      email: u.email,
      senha_hash: bcrypt.hashSync(u.senha, 10),
      perfil: u.perfil,
      nivel_acesso: u.nivel_acesso,
      agora
    });
  }

  const licitacoes = [
    {
      id: 'lic-001',
      numero: 'PE-001/2026',
      ano: 2026,
      processo: 'PA-012/2026',
      modalidade: 'Pregão Eletrônico',
      objeto: 'Aquisição de gêneros alimentícios para atendimento ao programa de merenda escolar do município de Goiana.',
      orgao: 'Secretaria Municipal de Educação',
      data_publicacao: '2026-01-10',
      data_abertura: '2026-02-01T09:00',
      local_sessao: 'Portal de Compras Governamentais - Sala Virtual 01',
      situacao: 'Aberta',
      valor_estimado: 1250000.0,
      visivel_comum: 'sim',
      conteudo_integral:
        'CONTEÚDO CONFIDENCIAL E INTEGRAL DO EDITAL PE-001/2026:\nItem 1: Arroz tipo 1 (50.000 kg);\nItem 2: Feijão Carioca (30.000 kg);\nCláusula de Entrega: Parcelada em até 5 dias após requisição.',
      assinaturas: [{ nome: 'Carlos Eduardo Ramos', funcao: 'Pregoeiro Oficial', data: '2026-01-09' }]
    },
    {
      id: 'lic-002',
      numero: 'CC-002/2026',
      ano: 2026,
      processo: 'PA-045/2026',
      modalidade: 'Concorrência',
      objeto: 'Reforma e ampliação da Unidade Básica de Saúde (UBS) do distrito de Tejucupapo.',
      orgao: 'Secretaria de Infraestrutura e Obras',
      data_publicacao: '2026-01-15',
      data_abertura: '2026-02-20T10:00',
      local_sessao: 'Auditório da Prefeitura de Goiana',
      situacao: 'Em Andamento',
      valor_estimado: 890000.5,
      visivel_comum: 'sim',
      conteudo_integral:
        'CONTEÚDO INTEGRAL DA CONCORRÊNCIA CC-002/2026:\nMemorial descritivo de engenharia, planta baixa, cronograma físico-financeiro.',
      assinaturas: [{ nome: 'Ana Lucia Albuquerque', funcao: 'Engenheira Chefe', data: '2026-01-14' }]
    }
  ];

  const insertLicitacao = db.prepare(`
    INSERT INTO licitacoes (id, numero, ano, processo, modalidade, objeto, orgao, valor_estimado, data_publicacao, data_abertura, local_sessao, situacao, visivel_comum, conteudo_integral, criado_por, criado_em)
    VALUES (@id, @numero, @ano, @processo, @modalidade, @objeto, @orgao, @valor_estimado, @data_publicacao, @data_abertura, @local_sessao, @situacao, @visivel_comum, @conteudo_integral, 'SISTEMA', @agora)
  `);
  const insertAssinatura = db.prepare(`
    INSERT INTO assinaturas (licitacao_id, nome, funcao, data) VALUES (?, ?, ?, ?)
  `);

  for (const l of licitacoes) {
    const { assinaturas: assinaturasDaLicitacao, ...campos } = l;
    insertLicitacao.run({ ...campos, agora });
    for (const a of assinaturasDaLicitacao) {
      insertAssinatura.run(l.id, a.nome, a.funcao, a.data);
    }
  }

  db.prepare(`
    INSERT INTO logs (id, data_hora, usuario, acao, resultado, alvo)
    VALUES (?, ?, 'SISTEMA', 'Restauração Inicial do Banco de Dados', 'Sucesso', 'Base reinicializada com dados de demonstração.')
  `).run(randomUUID(), agora);
}

function restaurarPadrao() {
  const transacao = db.transaction(() => {
    limparBanco();
    seed();
  });
  transacao();
}

if (require.main === module) {
  restaurarPadrao();
  console.log('Banco de dados populado com os dados iniciais (seed).');
  console.log('Login admin: admin@goiana.pe.gov.br / Admin@123');
  console.log('Login completo: completo@exemplo.com / Usuario@123');
  console.log('Login restrito: restrito@exemplo.com / Usuario@123');
}

module.exports = { seed, restaurarPadrao, limparBanco };
