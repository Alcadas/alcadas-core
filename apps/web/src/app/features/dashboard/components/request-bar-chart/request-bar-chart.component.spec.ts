import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RequestBarChartComponent } from './request-bar-chart.component';

describe('RequestBarChartComponent', () => {
  let component: RequestBarChartComponent;
  let fixture: ComponentFixture<RequestBarChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RequestBarChartComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RequestBarChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the request bar chart component', () => {
    expect(component).toBeTruthy();
  });

  it('should compute svg bars correctly from input data', () => {
    const bars = component.svgBars();
    expect(bars.length).toBe(component.data().length);
    expect(bars[0].width).toBeGreaterThan(0);
    expect(bars[0].height).toBeGreaterThan(0);
  });

  it('should calculate accepted average line Y coordinate', () => {
    const avgY = component.averageY();
    expect(avgY).toBeGreaterThan(component.marginTop);
    expect(avgY).toBeLessThan(component.marginTop + component.chartHeight);
  });

  it('should filter items by threshold', () => {
    component.setFilter('DENTRO');
    expect(component.displayedItems().every((i) => i.value <= component.acceptedAverage())).toBe(true);

    component.setFilter('ACIMA');
    expect(component.displayedItems().every((i) => i.value > component.acceptedAverage())).toBe(true);

    component.setFilter('TODOS');
    expect(component.displayedItems().length).toBe(component.data().length);
  });

  it('should handle hover events', () => {
    const bar = component.svgBars()[0];
    component.onBarHover(bar);
    expect(component.hoveredBar()).toBe(bar);

    component.onBarLeave();
    expect(component.hoveredBar()).toBeNull();
  });
});
