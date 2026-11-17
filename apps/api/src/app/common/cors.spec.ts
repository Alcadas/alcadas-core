import { padraoCanaisDePreview, resolverOrigensCors } from './cors';

describe('CORS restrito aos domínios da equipe (Issue #34)', () => {
  describe('padraoCanaisDePreview', () => {
    const padrao = padraoCanaisDePreview('alcadas-app') as RegExp;

    it.each([
      'https://alcadas-app--pr12-abc123.web.app',
      'https://alcadas-app--pr7-9f8e7d6c.web.app',
      'https://alcadas-app--homologacao-1a2b3c.web.app',
    ])('aceita o canal de preview %s', (origem) => {
      expect(padrao.test(origem)).toBe(true);
    });

    it.each([
      ['outro projeto', 'https://outro-projeto--pr12-abc123.web.app'],
      ['http sem TLS', 'http://alcadas-app--pr12-abc123.web.app'],
      ['sufixo malicioso', 'https://alcadas-app--pr12-abc123.web.app.evil.com'],
      ['prefixo malicioso', 'https://evil.com/https://alcadas-app--pr12-abc123.web.app'],
      ['subdomínio extra', 'https://x.alcadas-app--pr12-abc123.web.app'],
      ['domínio parecido', 'https://alcadas-app--pr12-abc123.webxapp'],
      ['site qualquer', 'https://site-qualquer.com'],
    ])('recusa %s', (_caso, origem) => {
      expect(padrao.test(origem)).toBe(false);
    });

    it('não gera padrão para nome de site ausente ou inválido', () => {
      expect(padraoCanaisDePreview(undefined)).toBeNull();
      expect(padraoCanaisDePreview('')).toBeNull();
      expect(padraoCanaisDePreview('.*')).toBeNull();
      expect(padraoCanaisDePreview('alcadas-app|evil')).toBeNull();
    });
  });

  describe('resolverOrigensCors', () => {
    it('usa as origens de WEB_URL e o padrão de preview do site de hosting', () => {
      const origens = resolverOrigensCors({
        NODE_ENV: 'production',
        WEB_URL: 'https://alcadas-app.web.app, https://alcadas-app.firebaseapp.com/',
        FIREBASE_HOSTING_SITE: 'alcadas-app',
      });

      expect(origens.slice(0, 2)).toEqual([
        'https://alcadas-app.web.app',
        'https://alcadas-app.firebaseapp.com',
      ]);
      expect(origens[2]).toBeInstanceOf(RegExp);
      expect((origens[2] as RegExp).test('https://alcadas-app--pr1-abc.web.app')).toBe(true);
    });

    it('cai no FIREBASE_PROJECT_ID quando FIREBASE_HOSTING_SITE não está definido', () => {
      const origens = resolverOrigensCors({ NODE_ENV: 'production', FIREBASE_PROJECT_ID: 'meu-projeto' });
      expect(origens).toHaveLength(1);
      expect((origens[0] as RegExp).test('https://meu-projeto--pr3-xyz.web.app')).toBe(true);
    });

    it('em produção não libera localhost por padrão', () => {
      expect(resolverOrigensCors({ NODE_ENV: 'production' })).toEqual([]);
    });

    it('em desenvolvimento libera o frontend local quando WEB_URL não está definida', () => {
      expect(resolverOrigensCors({ NODE_ENV: 'development' })).toEqual(['http://localhost:4200']);
    });
  });
});
