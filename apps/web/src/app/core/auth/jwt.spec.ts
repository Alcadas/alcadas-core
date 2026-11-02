import { criarJwtDeTeste } from '../testing/fake-jwt';
import { lerClaimsDoJwt } from './jwt';

describe('lerClaimsDoJwt', () => {
  it('lê as claims do payload, inclusive com acentos', () => {
    expect(lerClaimsDoJwt(criarJwtDeTeste({ tenantId: 'startop', name: 'Conceição' }))).toEqual({
      tenantId: 'startop',
      name: 'Conceição',
    });
  });

  it('devolve null para token malformado', () => {
    expect(lerClaimsDoJwt('nao-e-um-jwt')).toBeNull();
    expect(lerClaimsDoJwt('a.###.c')).toBeNull();
  });
});
