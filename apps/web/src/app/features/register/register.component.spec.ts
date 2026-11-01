import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RegisterComponent } from './register.component';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('deve rejeitar senha com menos de 8 caracteres', () => {
    component.form.controls.senha.setValue('1234567');
    expect(component.form.controls.senha.invalid).toBe(true);

    component.form.controls.senha.setValue('12345678');
    expect(component.form.controls.senha.valid).toBe(true);
  });
});