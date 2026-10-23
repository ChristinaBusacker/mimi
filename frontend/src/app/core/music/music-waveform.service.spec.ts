import { audioWaveform } from './music-waveform.service';

describe('audioWaveform', () => {
  it('extracts actual amplitudes and retains quiet/loud regions', () => {
    const samples = new Float32Array(9600);
    for (let i = 0; i < samples.length; i++) samples[i] = i < 4800 ? 0.05 : 0.8;
    const buffer = { numberOfChannels: 1, length: samples.length, getChannelData: () => samples } as AudioBuffer;
    const peaks = audioWaveform(buffer);
    expect(peaks).toHaveLength(96);
    expect(peaks[10]).toBeLessThan(peaks[80]);
    expect(peaks.every((peak) => peak >= 0.06 && peak <= 1)).toBe(true);
  });

  it('handles silence without division by zero', () => {
    const samples = new Float32Array(960);
    const buffer = { numberOfChannels: 1, length: samples.length, getChannelData: () => samples } as AudioBuffer;
    expect(audioWaveform(buffer).every((peak) => peak === 0.06)).toBe(true);
  });
});
