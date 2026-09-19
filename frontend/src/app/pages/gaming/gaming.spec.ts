import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Gaming } from './gaming';

describe('Gaming', () => {
  let component: Gaming;
  let fixture: ComponentFixture<Gaming>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Gaming],
    }).compileComponents();

    fixture = TestBed.createComponent(Gaming);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
