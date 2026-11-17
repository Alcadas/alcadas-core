import {
  BadRequestException,
  Body,
  Controller,
  Get,
  INestApplication,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import axios, { AxiosInstance } from 'axios';
import { configurarApp } from './configurar-app';
import { LinhaLogRequisicao, resolverRequestId, sanitizarRota } from './log-requisicoes';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Dados pessoais e segredos usados nos cenários — nenhum deles pode aparecer no log (RNF09). */
const PII = {
  nome: 'Mariana Vasconcelos',
  email: 'mariana.vasconcelos@startop.com.br',
  senha: 'S3nh@-Sup3r-Secreta',
  token: 'eyJhbGciOiJSUzI1NiJ9.eyJ1aWQiOiJ1c3ItMDEifQ.assinatura-super-secreta',
  justificativa: 'Compra urgente de notebooks para a diretoria financeira',
};

@Controller('eco')
class EcoController {
  @Get()
  listar(@Query('busca') busca?: string): { busca?: string } {
    return { busca };
  }

  @Post()
  criar(@Body() corpo: Record<string, unknown>): Record<string, unknown> {
    return corpo;
  }

  @Get('usuarios/:id')
  usuario(@Param('id') id: string): { id: string } {
    return { id };
  }

  @Post('invalido')
  invalido(): never {
    throw new BadRequestException(`E-mail ${PII.email} inválido`);
  }

  @Get('falha')
  falha(): never {
    throw new TypeError(`falha interna ao processar ${PII.email} com senha ${PII.senha}`);
  }
}

describe('Logs JSON estruturados com requestId (Issue #35 / RNF09)', () => {
  let app: INestApplication;
  let http: AxiosInstance;
  let linhas: string[];
  const envOriginal = { ...process.env };

  /** A linha é escrita no evento `finish`, que pode vir logo depois de o cliente receber a resposta. */
  async function aguardarLinhas(quantidade: number): Promise<LinhaLogRequisicao[]> {
    for (let tentativa = 0; tentativa < 50 && linhas.length < quantidade; tentativa++) {
      await new Promise((resolver) => setTimeout(resolver, 10));
    }
    return linhas.map((linha) => JSON.parse(linha) as LinhaLogRequisicao);
  }

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['WEB_URL'] = 'https://alcadas-app.web.app';
    process.env['FIREBASE_HOSTING_SITE'] = 'alcadas-app';

    const modulo = await Test.createTestingModule({ controllers: [EcoController] }).compile();
    app = modulo.createNestApplication();
    configurarApp(app, { escreverLog: (linha) => linhas.push(linha) });
    await app.listen(0);

    const endereco = app.getHttpServer().address() as { port: number };
    http = axios.create({ baseURL: `http://127.0.0.1:${endereco.port}`, validateStatus: () => true });
  });

  beforeEach(() => {
    linhas = [];
  });

  afterAll(async () => {
    process.env = envOriginal;
    await app.close();
  });

  it('gera exatamente uma linha JSON por requisição com requestId, método, rota, status e latência', async () => {
    const res = await http.post('/api/eco', { valor: 10 });
    const [linha, ...resto] = await aguardarLinhas(1);

    expect(res.status).toBe(201);
    expect(resto).toHaveLength(0);
    expect(linha).toEqual({
      timestamp: expect.any(String),
      severity: 'INFO',
      requestId: res.headers['x-request-id'],
      metodo: 'POST',
      rota: '/api/eco',
      status: 201,
      duracaoMs: expect.any(Number),
    });
    expect(linha.duracaoMs).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(Date.parse(linha.timestamp))).toBe(false);
  });

  it('devolve X-Request-Id em toda resposta: sucesso, 4xx, 404, 5xx e preflight de CORS', async () => {
    const respostas = await Promise.all([
      http.get('/api/eco'),
      http.post('/api/eco/invalido'),
      http.get('/api/rota-que-nao-existe'),
      http.get('/api/eco/falha'),
      http.options('/api/eco', {
        headers: { Origin: 'https://alcadas-app.web.app', 'Access-Control-Request-Method': 'POST' },
      }),
    ]);

    expect(respostas.map((r) => r.status)).toEqual([200, 400, 404, 500, 204]);
    for (const resposta of respostas) {
      expect(resposta.headers['x-request-id']).toMatch(UUID_V4);
    }
    const ids = new Set(respostas.map((r) => r.headers['x-request-id']));
    expect(ids.size).toBe(respostas.length);
    expect(await aguardarLinhas(respostas.length)).toHaveLength(respostas.length);
  });

  it('reaproveita um X-Request-Id recebido em formato seguro e descarta os demais', async () => {
    const aceito = await http.get('/api/eco', { headers: { 'X-Request-Id': 'front-2f4c9a10-77' } });
    const recusado = await http.get('/api/eco', { headers: { 'X-Request-Id': PII.email } });

    expect(aceito.headers['x-request-id']).toBe('front-2f4c9a10-77');
    expect(recusado.headers['x-request-id']).toMatch(UUID_V4);
  });

  it('registra 5xx como ERROR apenas com o tipo do erro, sem a mensagem', async () => {
    const res = await http.get('/api/eco/falha');
    const [linha] = await aguardarLinhas(1);

    expect(res.status).toBe(500);
    expect(linha).toMatchObject({ severity: 'ERROR', status: 500, rota: '/api/eco/falha', erro: 'TypeError' });
    expect(res.data.message).toBe('Erro interno do servidor');
  });

  it('registra 4xx como WARNING', async () => {
    await http.get('/api/rota-que-nao-existe');
    const [linha] = await aguardarLinhas(1);
    expect(linha).toMatchObject({ severity: 'WARNING', status: 404 });
  });

  it('nunca grava dados pessoais: corpo, query, cabeçalhos, caminho e mensagens de erro ficam fora', async () => {
    const cabecalhos = { Authorization: `Bearer ${PII.token}`, Cookie: `sessao=${PII.token}` };

    await http.post(
      '/api/eco',
      {
        nome: PII.nome,
        email: PII.email,
        senha: PII.senha,
        password: PII.senha,
        justificativa: PII.justificativa,
      },
      { headers: cabecalhos },
    );
    await http.get('/api/eco', {
      headers: cabecalhos,
      params: { busca: PII.nome, email: PII.email, token: PII.token },
    });
    await http.get(`/api/eco/usuarios/${encodeURIComponent(PII.email)}`, { headers: cabecalhos });
    await http.get(`/api/eco/usuarios/${PII.token}`, { headers: cabecalhos });
    await http.post('/api/eco/invalido', { email: PII.email }, { headers: cabecalhos });
    await http.get('/api/eco/falha', { headers: cabecalhos });

    const registros = await aguardarLinhas(6);
    expect(registros).toHaveLength(6);

    const saida = linhas.join('\n');
    for (const [campo, valor] of Object.entries(PII)) {
      expect({ campo, vazou: saida.includes(valor) }).toEqual({ campo, vazou: false });
      expect({ campo, vazou: saida.includes(encodeURIComponent(valor)) }).toEqual({ campo, vazou: false });
    }
    expect(saida).not.toMatch(/Bearer|Cookie|sessao=|startop\.com\.br/i);

    // Só os campos da lista fechada aparecem.
    const camposPermitidos = ['timestamp', 'severity', 'requestId', 'metodo', 'rota', 'status', 'duracaoMs', 'erro'];
    for (const registro of registros) {
      expect(Object.keys(registro).every((campo) => camposPermitidos.includes(campo))).toBe(true);
    }
    expect(registros.map((r) => r.rota)).toEqual([
      '/api/eco',
      '/api/eco',
      '/api/eco/usuarios/:email',
      '/api/eco/usuarios/:oculto',
      '/api/eco/invalido',
      '/api/eco/falha',
    ]);
  });

  describe('CORS aplicado pela mesma configuração (Issue #34)', () => {
    it.each(['https://alcadas-app.web.app', 'https://alcadas-app--pr12-abc123.web.app'])(
      'libera a origem da equipe %s',
      async (origem) => {
        const res = await http.get('/api/eco', { headers: { Origin: origem } });
        expect(res.headers['access-control-allow-origin']).toBe(origem);
        expect(res.headers['access-control-expose-headers']).toContain('X-Request-Id');
      },
    );

    it.each([
      'https://site-qualquer.com',
      'http://localhost:4200',
      'https://outro-projeto--pr12-abc123.web.app',
      'https://alcadas-app--pr12-abc123.web.app.evil.com',
    ])('não devolve Access-Control-Allow-Origin para %s', async (origem) => {
      const res = await http.get('/api/eco', { headers: { Origin: origem } });
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});

describe('sanitizarRota', () => {
  it('descarta a query string e o fragmento', () => {
    expect(sanitizarRota('/api/solicitacoes?status=PENDENTE&email=a@b.com#topo')).toBe('/api/solicitacoes');
  });

  it('mantém identificadores comuns de rota', () => {
    expect(sanitizarRota('/api/saas/tenants/startop')).toBe('/api/saas/tenants/startop');
    expect(sanitizarRota('/api/solicitacoes/sol-001/trilha')).toBe('/api/solicitacoes/sol-001/trilha');
  });

  it('oculta segmentos com e-mail, token ou tamanho anormal', () => {
    expect(sanitizarRota('/api/usuarios/ana%40startop.com.br')).toBe('/api/usuarios/:email');
    expect(sanitizarRota(`/api/x/${'a'.repeat(80)}`)).toBe('/api/x/:oculto');
  });

  it('assume a raiz quando a URL não vem definida', () => {
    expect(sanitizarRota(undefined)).toBe('/');
  });
});

describe('resolverRequestId', () => {
  it('gera UUID v4 quando nada é recebido', () => {
    expect(resolverRequestId(undefined)).toMatch(UUID_V4);
  });

  it('recusa valores com espaço, quebra de linha ou caracteres fora do formato', () => {
    for (const invalido of ['curto', 'tem espaco aqui', 'linha\nnova-123456', 'a@b.com-12345', 'x'.repeat(65)]) {
      expect(resolverRequestId(invalido)).toMatch(UUID_V4);
    }
  });
});
