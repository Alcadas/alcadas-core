import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PageHeaderComponent } from './page-header.component';

describe('PageHeaderComponent', () => {
  let component: PageHeaderComponent;
  let fixture: ComponentFixture<PageHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageHeaderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PageHeaderComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('breadcrumbCurrent', 'Minhas Solicitações');
    fixture.detectChanges();
  });

  it('should create the page header component', () => {
    expect(component).toBeTruthy();
  });

  it('should emit search query change', () => {
    jest.spyOn(component.searchQueryChange, 'emit');
    component.onSearchInput('teste');
    expect(component.searchQueryChange.emit).toHaveBeenCalledWith('teste');
  });

  it('should clear search query on clearSearch', () => {
    jest.spyOn(component.searchQueryChange, 'emit');
    component.clearSearch();
    expect(component.searchQueryChange.emit).toHaveBeenCalledWith('');
  });

  it('should emit tab change on selectTab', () => {
    jest.spyOn(component.tabChange, 'emit');
    component.selectTab('aprovadas');
    expect(component.tabChange.emit).toHaveBeenCalledWith('aprovadas');
  });
});
