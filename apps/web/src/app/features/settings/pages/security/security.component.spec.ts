import { TestBed } from '@angular/core/testing';
import { SettingsService } from '../../services/settings.service';
import { SecurityComponent } from './security.component';

describe('SecurityComponent', () => {
  let settings: { alterarSenhaDaContaLogada: jest.Mock };

  function criar() {
    TestBed.configureTestingModule({
      imports: [SecurityComponent],
      providers: [{ provide: SettingsService, useValue: settings }],
    });
    const fixture = TestBed.createComponent(SecurityComponent);
    fixture.detectChanges();
    return fixture;
  }

  function preencher(
    fixture: ReturnType<typeof criar>,
    currentPassword: string,
    newPassword: string,
    confirmPassword = newPassword,
  ): void {
    fixture.componentInstance.form.setValue({ currentPassword, newPassword, confirmPassword });
  }

  beforeEach(() => {
    settings = { alterarSenhaDaContaLogada: jest.fn() };
  });

  it.each([
    ['curta', 'ab1'],
    ['sem número', 'abcdefg'],
    ['sem letra', '1234567'],
  ])('não aceita nova senha %s', (_caso, senha) => {
    const fixture = criar();
    preencher(fixture, '123456', senha);
    fixture.componentInstance.save();
    expect(settings.alterarSenhaDaContaLogada).not.toHaveBeenCalled();
  });

  it('não aceita confirmação diferente', () => {
    const fixture = criar();
    preencher(fixture, '123456', 'senha123', 'senha124');
    fixture.componentInstance.save();
    expect(settings.alterarSenhaDaContaLogada).not.toHaveBeenCalled();
  });

  it('troca a senha, limpa o formulário e mostra sucesso', () => {
    const fixture = criar();
    preencher(fixture, '123456', 'senha123');
    fixture.componentInstance.save();
    fixture.detectChanges();

    expect(settings.alterarSenhaDaContaLogada).toHaveBeenCalledWith('123456', 'senha123');
    expect(fixture.componentInstance.form.controls.newPassword.value).toBe('');
    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain(
      'Senha atualizada com sucesso.',
    );
  });

  it('mostra o erro quando a senha atual está incorreta', () => {
    settings.alterarSenhaDaContaLogada.mockImplementation(() => {
      throw new Error('Senha atual incorreta.');
    });
    const fixture = criar();
    preencher(fixture, 'errada1', 'senha123');
    fixture.componentInstance.save();
    fixture.detectChanges();

    expect(fixture.componentInstance.saved()).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Senha atual incorreta.',
    );
  });
});
