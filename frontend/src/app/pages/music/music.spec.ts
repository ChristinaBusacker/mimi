import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Music } from './music';

describe('Music', () => {
  let component: Music;
  let fixture: ComponentFixture<Music>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Music],
    }).compileComponents();

    fixture = TestBed.createComponent(Music);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
