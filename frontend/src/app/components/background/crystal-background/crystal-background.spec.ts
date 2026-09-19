import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CrystalBackground } from './crystal-background';

describe('CrystalBackground', () => {
  let component: CrystalBackground;
  let fixture: ComponentFixture<CrystalBackground>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrystalBackground],
    }).compileComponents();

    fixture = TestBed.createComponent(CrystalBackground);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
