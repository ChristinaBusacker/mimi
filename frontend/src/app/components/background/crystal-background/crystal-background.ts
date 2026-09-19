import { ChangeDetectionStrategy, Component } from '@angular/core';

interface CrystalInstance {
  id: string;
  position: 'left' | 'right';
  layer: 'back' | 'front';
  rotation: number;
  scale: number;
  bottom: string;
  offset: string;
  blur: number;
  zIndex: number;
}

@Component({
  imports: [],
  selector: 'app-crystal-background',
  styleUrl: './crystal-background.scss',
  templateUrl: './crystal-background.html',
})
export class CrystalBackground {
  protected readonly crystals: CrystalInstance[] = [
    {
      id: 'left-back',
      position: 'left',
      layer: 'back',
      rotation: 33.49,
      scale: 0.96,
      bottom: '15vh',
      offset: '-6vw',
      blur: 0,
      zIndex: 1,
    },
    {
      id: 'left-front',
      position: 'left',
      layer: 'front',
      rotation: 0,
      scale: 1.16,
      bottom: '-4vh',
      offset: '-8vw',
      blur: 2,
      zIndex: 2,
    },
    {
      id: 'right-back',
      position: 'right',
      layer: 'back',
      rotation: -40,
      scale: 0.94,
      bottom: '20vh',
      offset: '-10vw',
      blur: 0,
      zIndex: 1,
    },
    {
      id: 'right-front',
      position: 'right',
      layer: 'front',
      rotation: 0,
      scale: 1.12,
      bottom: '-6vh',
      offset: '-8vw',
      blur: 2,
      zIndex: 2,
    },
  ];
}
