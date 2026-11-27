import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { TourService } from './core/services/tour.service';

describe('App', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('não exibe boas-vindas nem tour antes do login (#109)', () => {
    const tourService = TestBed.inject(TourService);
    tourService.openWelcomeModal();
    tourService.startTour('onboarding');

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('app-welcome-modal')).toBeNull();
    expect(el.querySelector('app-tour-overlay')).toBeNull();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });
});
