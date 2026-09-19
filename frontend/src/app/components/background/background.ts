import { Component } from '@angular/core';
import { HeartBackground } from './heart-background/heart-background';
import { CrystalBackground } from './crystal-background/crystal-background';
import { SkylineBackground } from './skyline-background/skyline-background';
import { CloudBackground } from './cloud-background/cloud-background';

@Component({
  imports: [HeartBackground, CrystalBackground, SkylineBackground, CloudBackground],
  selector: 'app-background',
  styleUrl: './background.scss',
  templateUrl: './background.html',
})
export class Background {}
