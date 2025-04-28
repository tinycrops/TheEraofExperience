import { calcReward, conversationQualityReward, taskCompletionReward } from '../src/reward_functions';

describe('Reward Functions', () => {
  test('conversationQualityReward returns a value between 0.5 and 1', async () => {
    const observation = { message: 'test' };
    const action = { turns: [{ parts: [{ text: 'response' }] }] };
    
    const reward = await conversationQualityReward(observation, action);
    
    expect(reward).toBeGreaterThanOrEqual(0.5);
    expect(reward).toBeLessThanOrEqual(1.0);
  });
  
  test('taskCompletionReward returns 0 or 1', async () => {
    const observation = { message: 'test' };
    const action = { turns: [{ parts: [{ text: 'response' }] }] };
    
    const reward = await taskCompletionReward(observation, action);
    
    expect(reward === 0 || reward === 1).toBeTruthy();
  });
  
  test('calcReward combines rewards with appropriate weights', async () => {
    const observation = { message: 'test' };
    const action = { turns: [{ parts: [{ text: 'response' }] }] };
    
    const reward = await calcReward(observation, action);
    
    // Since our mock rewards are between 0.5-1 for conversation and 0-1 for task,
    // and weights are 0.7 and 0.3 respectively, the total should be between 0.35 and 1
    expect(reward).toBeGreaterThanOrEqual(0.35);
    expect(reward).toBeLessThanOrEqual(1.0);
  });
}); 