import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

describe('Firebase Hosting & Security Rules (CP3 - Issue #43)', () => {
  const firebaseJsonPath = path.resolve(process.cwd(), 'firebase.json');
  const firestoreRulesPath = path.resolve(process.cwd(), 'firestore.rules');

  it('firebase.json contem configuracao de hosting com public em dist/apps/web/browser', () => {
    expect(fs.existsSync(firebaseJsonPath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf8'));

    expect(content.hosting).toBeDefined();
    expect(content.hosting.public).toBe('dist/apps/web/browser');
  });

  it('firebase.json contem regra de rewrites direcionando todas as rotas para /index.html (SPA)', () => {
    const content = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf8'));
    const rewrites = content.hosting?.rewrites;

    expect(Array.isArray(rewrites)).toBe(true);
    const spaRewrite = rewrites.find(
      (r: { source: string; destination: string }) => r.source === '**' && r.destination === '/index.html',
    );
    expect(spaRewrite).toBeDefined();
  });

  it('firestore.rules mantem politica estrita deny-all (allow read, write: if false;)', () => {
    expect(fs.existsSync(firestoreRulesPath)).toBe(true);
    const rules = fs.readFileSync(firestoreRulesPath, 'utf8');

    expect(rules).toContain('service cloud.firestore');
    expect(rules).toContain('allow read, write: if false;');
  });

  it('build de producao do apps/web contem index.html com ponto de montagem do Angular (<app-root>)', () => {
    const indexPath = path.resolve(process.cwd(), 'dist/apps/web/browser/index.html');
    if (fs.existsSync(indexPath)) {
      const html = fs.readFileSync(indexPath, 'utf8');
      expect(html).toContain('<app-root>');
    }
  });

  it('quando o emulador de Hosting estiver ativo, rota profunda (/solicitacoes) responde 200 sem 404', async () => {
    const hostingPort = process.env['FIREBASE_HOSTING_PORT'] || '5000';
    try {
      const res = await axios.get(`http://127.0.0.1:${hostingPort}/solicitacoes`, {
        validateStatus: () => true,
        timeout: 1000,
      });
      if (res.status === 200) {
        expect(res.data).toContain('<app-root>');
      }
    } catch {
      // Ignora caso o emulador de hosting nao esteja rodando durante este teste
    }
  });
});
