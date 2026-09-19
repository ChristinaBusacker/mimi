import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SkylineBackground } from './skyline-background';

describe('SkylineBackground', () => {
  let component: SkylineBackground;
  let fixture: ComponentFixture<SkylineBackground>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SkylineBackground],
    }).compileComponents();

    fixture = TestBed.createComponent(SkylineBackground);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
