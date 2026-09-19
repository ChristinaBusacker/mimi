import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HeartBackground } from './heart-background';

describe('HeartBackground', () => {
  let component: HeartBackground;
  let fixture: ComponentFixture<HeartBackground>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeartBackground],
    }).compileComponents();

    fixture = TestBed.createComponent(HeartBackground);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
