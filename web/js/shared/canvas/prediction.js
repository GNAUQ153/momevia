export const PREDICTION_KIND = 'prediction-choice';
export const predictionFields = Object.freeze({ question: 500, optionA: 120, optionB: 120, reason: 1000, endingA: 1000, endingB: 1000 });
export const predictionCard = doc => doc.elements.find(e => e.type === 'interaction' && e.props.kind === PREDICTION_KIND);
export const normalizeChoice = text => text.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('vi');
export const emptyPrediction = () => ({ ...Object.fromEntries(Object.keys(predictionFields).map(key => [key, ''])), prediction: null });
export const predictionResult = (props, choice) => {
  if (!['A', 'B'].includes(choice) || !['A', 'B'].includes(props.prediction)) throw new Error('Invalid prediction choice');
  return { choice, chosenLabel: props['option' + choice], prediction: props.prediction,
    predictedLabel: props['option' + props.prediction], reason: props.reason, ending: props['ending' + choice] };
};
