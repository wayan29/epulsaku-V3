
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [
    googleAI()
  ],
  // Models and embedders are now specified directly in the flows/prompts that use them.
  // This provides more granular control and is the recommended approach for Genkit v1.x.
});
