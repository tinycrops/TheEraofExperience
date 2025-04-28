import { ReplayBuffer, Transition } from '../src/rl_core';

describe('ReplayBuffer', () => {
  let buffer: ReplayBuffer;
  
  beforeEach(() => {
    buffer = new ReplayBuffer(5); // Small buffer for testing
  });
  
  test('adds transitions to the buffer', () => {
    const transition: Transition = {
      obs: { state: 'initial' },
      action: { action: 'test' },
      reward: 1.0
    };
    
    buffer.add(transition);
    
    expect(buffer.size()).toBe(1);
  });
  
  test('respects maximum size', () => {
    // Add 6 transitions to a buffer with max size 5
    for (let i = 0; i < 6; i++) {
      buffer.add({
        obs: { state: `state-${i}` },
        action: { action: `action-${i}` },
        reward: i
      });
    }
    
    expect(buffer.size()).toBe(5);
  });
  
  test('samples correct number of transitions', () => {
    // Add some transitions
    for (let i = 0; i < 5; i++) {
      buffer.add({
        obs: { state: `state-${i}` },
        action: { action: `action-${i}` },
        reward: i
      });
    }
    
    const samples = buffer.sample(3);
    expect(samples.length).toBe(3);
  });
  
  test('clears the buffer', () => {
    // Add some transitions
    for (let i = 0; i < 3; i++) {
      buffer.add({
        obs: { state: `state-${i}` },
        action: { action: `action-${i}` },
        reward: i
      });
    }
    
    expect(buffer.size()).toBe(3);
    buffer.clear();
    expect(buffer.size()).toBe(0);
  });
  
  test('handles sampling from empty buffer', () => {
    const samples = buffer.sample(3);
    expect(samples.length).toBe(0);
  });
}); 