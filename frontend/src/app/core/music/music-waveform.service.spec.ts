import { audioWaveform, visibleWaveform } from './music-waveform.service';

describe('audioWaveform', () => {
  it('extracts actual amplitudes and retains quiet/loud regions', () => {
    const samples = new Float32Array(9600);
    for (let i = 0; i < samples.length; i++) samples[i] = i < 4800 ? 0.05 : 0.8;
    const buffer = { numberOfChannels: 1, length: samples.length, getChannelData: () => samples } as AudioBuffer;
    const peaks = audioWaveform(buffer);
    expect(peaks).toHaveLength(512);
    expect(peaks[50]).toBeLessThan(peaks[450]);
    expect(peaks.every((peak) => peak >= 0.06 && peak <= 1)).toBe(true);
  });

  it('handles silence without division by zero', () => {
    const samples = new Float32Array(960);
    const buffer = { numberOfChannels: 1, length: samples.length, getChannelData: () => samples } as AudioBuffer;
    expect(audioWaveform(buffer).every((peak) => peak === 0.06)).toBe(true);
  });
});


describe('visibleWaveform', () => {
  it('uses the source envelope and adapts to a narrow layout', () => {
    const source = Array.from({ length: 512 }, (_, i) => i < 256 ? 0.1 : 0.9);
    const displayed = visibleWaveform(source, 128);
    expect(displayed).toHaveLength(128);
    expect(displayed[10]).toBeLessThan(displayed[110]);
  });

  it('preserves the loudest transient while aggregating a small group', () => {
    const source = Array(512).fill(0.06);
    source[20] = 1;
    const displayed = visibleWaveform(source, 128);
    expect(displayed[5]).toBeGreaterThan(displayed[6]);
    expect(displayed.every((sample) => sample >= 0.06 && sample <= 1)).toBe(true);
  });

  it('handles invalid dimensions and empty input', () => {
    expect(visibleWaveform([], 120)).toEqual([]);
    expect(visibleWaveform([0.2], 0)).toEqual([]);
  });
});
