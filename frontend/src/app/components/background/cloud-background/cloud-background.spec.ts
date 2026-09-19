import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CloudBackground } from './cloud-background';

describe('CloudBackground', () => {
  let component: CloudBackground;
  let fixture: ComponentFixture<CloudBackground>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CloudBackground],
    }).compileComponents();

    fixture = TestBed.createComponent(CloudBackground);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
