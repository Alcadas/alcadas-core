import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RightDrawerComponent } from './right-drawer.component';

describe('RightDrawerComponent', () => {
  let component: RightDrawerComponent;
  let fixture: ComponentFixture<RightDrawerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RightDrawerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RightDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the right drawer component', () => {
    expect(component).toBeTruthy();
  });

  it('should not be open by default', () => {
    expect(component.isOpen()).toBe(false);
  });

  it('should emit closed on backdrop click when closeOnBackdrop is true', () => {
    jest.spyOn(component.closed, 'emit');
    component.onBackdropClick();
    expect(component.closed.emit).toHaveBeenCalled();
  });

  it('should emit closed on escape key when drawer is open', () => {
    jest.spyOn(component.closed, 'emit');
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    component.onEscape();
    expect(component.closed.emit).toHaveBeenCalled();
  });
});
