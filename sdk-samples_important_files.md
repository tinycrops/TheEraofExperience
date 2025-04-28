# Important Files Directory Tree

```
Directory structure:
└── sdk-samples/
    ├── chats.ts
    ├── embed_content.ts
    ├── generate_content_streaming.ts
    ├── generate_content_with_code_execution.ts
    ├── generate_content_with_file_upload.ts
    ├── generate_content_with_function_calling.ts
    ├── generate_content_with_response_schema.ts
    ├── generate_content_with_search_grounding.ts
    ├── generate_content_with_system_instructions.ts
    ├── generate_content_with_text.ts
    ├── generate_content_with_text_vertex_apikey.ts
    ├── generate_image.ts
    ├── generate_video.ts
    ├── get_model_info.ts
    ├── live_client_content.ts
    ├── tsconfig.json
    └── web/
        └── src/
            ├── App.tsx
            ├── GenerateContentText.tsx
            ├── ImageUpload.tsx
            ├── TextAndImage.tsx
            ├── UploadFile.tsx
            ├── Video.tsx
            ├── main.tsx
            └── scss/

```

# Important Files Content

================================================
File: sdk-samples/chats.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {GoogleGenAI} from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION;
const GOOGLE_GENAI_USE_VERTEXAI = process.env.GOOGLE_GENAI_USE_VERTEXAI;

async function createChatFromMLDev() {
  const ai = new GoogleGenAI({vertexai: false, apiKey: GEMINI_API_KEY});

  const chat = ai.chats.create({model: 'gemini-2.0-flash'});

  const response = await chat.sendMessage({message: 'Why is the sky blue?'});
  console.debug('chat response 1: ', response.text);
  const response2 = await chat.sendMessage({message: 'Why is the sunset red?'});
  console.debug('chat response 2: ', response2.text);

  const history = chat.getHistory();
  for (const content of history) {
    console.debug('chat history: ', JSON.stringify(content, null, 2));
  }
}

async function createChatStreamFromMLDev() {
  const ai = new GoogleGenAI({vertexai: false, apiKey: GEMINI_API_KEY});
  const chat = ai.chats.create({model: 'gemini-2.0-flash'});
  const response = await chat.sendMessageStream({
    message: 'Why is the sky blue?',
  });
  for await (const chunk of response) {
    console.debug('chat response 1 chunk: ', chunk.text);
  }
  const response2 = await chat.sendMessageStream({
    message: 'Why is the sunset red?',
  });
  for await (const chunk of response2) {
    console.debug('chat response 2 chunk: ', chunk.text);
  }
  const history = chat.getHistory();
  for (const content of history) {
    console.debug('chat history: ', JSON.stringify(content, null, 2));
  }
}

async function createChatFromVertexAI() {
  const ai = new GoogleGenAI({
    vertexai: true,
    project: GOOGLE_CLOUD_PROJECT,
    location: GOOGLE_CLOUD_LOCATION,
  });

  const chat = ai.chats.create({model: 'gemini-2.0-flash'});

  const response = await chat.sendMessage({message: 'Why is the sky blue?'});
  console.debug('chat response 1: ', response.text);
  const response2 = await chat.sendMessage({message: 'Why is the sunset red?'});
  console.debug('chat response 2: ', response2.text);

  const history = chat.getHistory();
  for (const content of history) {
    console.debug('chat history: ', JSON.stringify(content, null, 2));
  }
}

async function createChatStreamFromVertexAI() {
  const ai = new GoogleGenAI({
    vertexai: true,
    project: GOOGLE_CLOUD_PROJECT,
    location: GOOGLE_CLOUD_LOCATION,
  });
  const chat = ai.chats.create({model: 'gemini-2.0-flash'});
  const response = await chat.sendMessageStream({
    message: 'Why is the sky blue?',
  });
  for await (const chunk of response) {
    console.debug('chat response 1 chunk: ', chunk.text);
  }
  const response2 = await chat.sendMessageStream({
    message: 'Why is the sunset red?',
  });
  for await (const chunk of response2) {
    console.debug('chat response 2 chunk: ', chunk.text);
  }
  const history = chat.getHistory();
  for (const content of history) {
    console.debug('chat history: ', JSON.stringify(content, null, 2));
  }
}

async function main() {
  if (GOOGLE_GENAI_USE_VERTEXAI) {
    await createChatFromVertexAI().catch((e) => console.error('got error', e));
    await createChatStreamFromVertexAI().catch((e) =>
      console.error('got error', e),
    );
  } else {
    await createChatFromMLDev().catch((e) => console.error('got error', e));
    await createChatStreamFromMLDev().catch((e) =>
      console.error('got error', e),
    );
  }
}

main();



================================================
File: sdk-samples/embed_content.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {GoogleGenAI} from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION;
const GOOGLE_GENAI_USE_VERTEXAI = process.env.GOOGLE_GENAI_USE_VERTEXAI;

async function embedContentFromMLDev() {
  const ai = new GoogleGenAI({vertexai: false, apiKey: GEMINI_API_KEY});

  const response = await ai.models.embedContent({
    model: 'text-embedding-004',
    contents: 'Hello world!',
  });

  console.debug(JSON.stringify(response));
}

async function embedContentFromVertexAI() {
  const ai = new GoogleGenAI({
    vertexai: true,
    project: GOOGLE_CLOUD_PROJECT,
    location: GOOGLE_CLOUD_LOCATION,
  });

  const response = await ai.models.embedContent({
    model: 'text-embedding-004',
    contents: 'Hello world!',
  });

  console.debug(JSON.stringify(response));
}

async function main() {
  if (GOOGLE_GENAI_USE_VERTEXAI) {
    await embedContentFromVertexAI().catch((e) =>
      console.error('got error', e),
    );
  } else {
    await embedContentFromMLDev().catch((e) => console.error('got error', e));
  }
}

main();



================================================
File: sdk-samples/generate_content_streaming.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {GoogleGenAI, Modality} from '@google/genai';
import * as fs from 'fs';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION;
const GOOGLE_GENAI_USE_VERTEXAI = process.env.GOOGLE_GENAI_USE_VERTEXAI;

async function generateContentFromMLDev() {
  const ai = new GoogleGenAI({vertexai: false, apiKey: GEMINI_API_KEY});

  const response = await ai.models.generateContentStream({
    model: 'gemini-2.0-flash-exp',
    contents:
      'Generate a story about a cute baby turtle in a 3d digital art style. For each scene, generate an image.',
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });

  let i = 0;
  for await (const chunk of response) {
    const text = chunk.text;
    const data = chunk.data;
    if (text) {
      console.debug(text);
    } else if (data) {
      const fileName = `generate_content_streaming_image_${i++}.png`;
      console.debug(`Writing response image to file: ${fileName}.`);
      fs.writeFileSync(fileName, data);
    }
  }
}

async function generateContentFromVertexAI() {
  const ai = new GoogleGenAI({
    vertexai: true,
    project: GOOGLE_CLOUD_PROJECT,
    location: GOOGLE_CLOUD_LOCATION,
  });

  const response = await ai.models.generateContentStream({
    model: 'gemini-2.0-flash-exp',
    contents:
      'Generate a story about a cute baby turtle in a 3d digital art style. For each scene, generate an image.',
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });

  let i = 0;
  for await (const chunk of response) {
    const text = chunk.text;
    const data = chunk.data;
    if (text) {
      console.debug(text);
    } else if (data) {
      const fileName = `generate_content_streaming_image_${i++}.png`;
      console.debug(`Writing response image to file: ${fileName}.`);
      fs.writeFileSync(fileName, data);
    }
  }
}

async function main() {
  if (GOOGLE_GENAI_USE_VERTEXAI) {
    await generateContentFromVertexAI().catch((e) =>
      console.error('got error', e),
    );
  } else {
    await generateContentFromMLDev().catch((e) =>
      console.error('got error', e),
    );
  }
}

main();



================================================
File: sdk-samples/generate_content_with_code_execution.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {GoogleGenAI} from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION;
const GOOGLE_GENAI_USE_VERTEXAI = process.env.GOOGLE_GENAI_USE_VERTEXAI;

async function generateContentFromMLDev() {
  const ai = new GoogleGenAI({vertexai: false, apiKey: GEMINI_API_KEY});

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents:
      'What is the sum of the first 50 prime numbers? Generate and run code for the calculation, and make sure you get all 50.',
    config: {
      tools: [{codeExecution: {}}],
    },
  });

  console.debug(response.executableCode);
  console.debug(response.codeExecutionResult);
}

async function generateContentFromVertexAI() {
  const ai = new GoogleGenAI({
    vertexai: true,
    project: GOOGLE_CLOUD_PROJECT,
    location: GOOGLE_CLOUD_LOCATION,
  });

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents:
      'What is the sum of the first 50 prime numbers? Generate and run code for the calculation, and make sure you get all 50.',
    config: {
      tools: [{codeExecution: {}}],
    },
  });

  console.debug(response.executableCode);
  console.debug(response.codeExecutionResult);
}

async function main() {
  if (GOOGLE_GENAI_USE_VERTEXAI) {
    await generateContentFromVertexAI().catch((e) =>
      console.error('got error', e),
    );
  } else {
    await generateContentFromMLDev().catch((e) =>
      console.error('got error', e),
    );
  }
}

main();



================================================
File: sdk-samples/generate_content_with_file_upload.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {ContentListUnion, createPartFromUri, GoogleGenAI} from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_GENAI_USE_VERTEXAI = process.env.GOOGLE_GENAI_USE_VERTEXAI;

async function generateContentFromFileUploadMLDev() {
  const ai = new GoogleGenAI({vertexai: false, apiKey: GEMINI_API_KEY});
  const testFile = new Blob(
    [
      'The Whispering Woods In the heart of Eldergrove, there stood a forest whispered about by the villagers. They spoke of trees that could talk and streams that sang. Young Elara, curious and adventurous, decided to explore the woods one crisp autumn morning. As she wandered deeper, the leaves rustled with excitement, revealing hidden paths. Elara noticed the trees bending slightly as if beckoning her to come closer. When she paused to listen, she heard soft murmurs—stories of lost treasures and forgotten dreams. Drawn by the enchanting sounds, she followed a narrow trail until she stumbled upon a shimmering pond. At its edge, a wise old willow tree spoke, “Child of the village, what do you seek?” “I seek adventure,” Elara replied, her heart racing. “Adventure lies not in faraway lands but within your spirit,” the willow said, swaying gently. “Every choice you make is a step into the unknown.” With newfound courage, Elara left the woods, her mind buzzing with possibilities. The villagers would say the woods were magical, but to Elara, it was the spark of her imagination that had transformed her ordinary world into a realm of endless adventures. She smiled, knowing her journey was just beginning',
    ],
    {type: 'text/plain'},
  );

  // Upload the file.
  const file = await ai.files.upload({
    file: testFile,
    config: {
      displayName: 'generate_file.txt',
    },
  });

  // Wait for the file to be processed.
  let getFile = await ai.files.get({name: file.name as string});
  while (getFile.state === 'PROCESSING') {
    getFile = await ai.files.get({name: file.name as string});
    console.log(`current file status: ${getFile.state}`);
    console.log('File is still processing, retrying in 5 seconds');

    await new Promise((resolve) => {
      setTimeout(resolve, 5000);
    });
  }
  if (file.state === 'FAILED') {
    throw new Error('File processing failed.');
  }

  // Add the file to the contents.
  const content: ContentListUnion = [
    'Summarize the story in a single sentence.',
  ];

  if (file.uri && file.mimeType) {
    const fileContent = createPartFromUri(file.uri, file.mimeType);
    content.push(fileContent);
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: content,
  });

  console.debug(response.text);
}

async function main() {
  if (GOOGLE_GENAI_USE_VERTEXAI) {
    throw new Error('Vertex AI is not supported for this sample.');
  } else {
    await generateContentFromFileUploadMLDev().catch((e) =>
      console.error('got error', e),
    );
  }
}

main();



================================================
File: sdk-samples/generate_content_with_function_calling.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  FunctionCallingConfigMode,
  FunctionDeclaration,
  GoogleGenAI,
  Type,
} from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION;
const GOOGLE_GENAI_USE_VERTEXAI = process.env.GOOGLE_GENAI_USE_VERTEXAI;

async function generateContentFromMLDev() {
  const ai = new GoogleGenAI({vertexai: false, apiKey: GEMINI_API_KEY});

  const controlLightFunctionDeclaration: FunctionDeclaration = {
    name: 'controlLight',
    parameters: {
      type: Type.OBJECT,
      description: 'Set the brightness and color temperature of a room light.',
      properties: {
        brightness: {
          type: Type.NUMBER,
          description:
            'Light level from 0 to 100. Zero is off and 100 is full brightness.',
        },
        colorTemperature: {
          type: Type.STRING,
          description:
            'Color temperature of the light fixture which can be `daylight`, `cool` or `warm`.',
        },
      },
      required: ['brightness', 'colorTemperature'],
    },
  };
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: 'Dim the lights so the room feels cozy and warm.',
    config: {
      tools: [{functionDeclarations: [controlLightFunctionDeclaration]}],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.ANY,
          allowedFunctionNames: ['controlLight'],
        },
      },
    },
  });

  console.debug(response.functionCalls);
}

async function generateContentFromVertexAI() {
  const ai = new GoogleGenAI({
    vertexai: true,
    project: GOOGLE_CLOUD_PROJECT,
    location: GOOGLE_CLOUD_LOCATION,
  });

  const controlLightFunctionDeclaration: FunctionDeclaration = {
    name: 'controlLight',
    parameters: {
      type: Type.OBJECT,
      description: 'Set the brightness and color temperature of a room light.',
      properties: {
        brightness: {
          type: Type.NUMBER,
          description:
            'Light level from 0 to 100. Zero is off and 100 is full brightness.',
        },
        colorTemperature: {
          type: Type.STRING,
          description:
            'Color temperature of the light fixture which can be `daylight`, `cool` or `warm`.',
        },
      },
      required: ['brightness', 'colorTemperature'],
    },
  };
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: 'Dim the lights so the room feels cozy and warm.',
    config: {
      tools: [{functionDeclarations: [controlLightFunctionDeclaration]}],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.ANY,
          allowedFunctionNames: ['controlLight'],
        },
      },
    },
  });

  console.debug(response.functionCalls);
}

async function main() {
  if (GOOGLE_GENAI_USE_VERTEXAI) {
    await generateContentFromVertexAI().catch((e) =>
      console.error('got error', e),
    );
  } else {
    await generateContentFromMLDev().catch((e) =>
      console.error('got error', e),
    );
  }
}

main();



================================================
File: sdk-samples/generate_content_with_response_schema.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {GoogleGenAI, Type} from '@google/genai';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION;
const GOOGLE_GENAI_USE_VERTEXAI = process.env.GOOGLE_GENAI_USE_VERTEXAI;

async function generateContentFromMLDev() {
  const ai = new GoogleGenAI({vertexai: false, apiKey: GOOGLE_API_KEY});

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: 'List 3 popular cookie recipes.',
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            'recipeName': {
              type: Type.STRING,
              description: 'Name of the recipe',
              nullable: false,
            },
          },
          required: ['recipeName'],
        },
      },
    },
  });

  console.debug(response.text);
}

async function generateContentFromVertexAI() {
  const ai = new GoogleGenAI({
    vertexai: true,
    project: GOOGLE_CLOUD_PROJECT,
    location: GOOGLE_CLOUD_LOCATION,
  });

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: 'List 3 popular cookie recipes.',
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            'recipeName': {
              type: Type.STRING,
              description: 'Name of the recipe',
              nullable: false,
            },
          },
          required: ['recipeName'],
        },
      },
    },
  });

  console.debug(response.text);
}

async function main() {
  if (GOOGLE_GENAI_USE_VERTEXAI) {
    await generateContentFromVertexAI().catch((e) =>
      console.error('got error', e),
    );
  } else {
    await generateContentFromMLDev().catch((e) =>
      console.error('got error', e),
    );
  }
}

main();



================================================
File: sdk-samples/generate_content_with_search_grounding.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {GoogleGenAI} from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION;
const GOOGLE_GENAI_USE_VERTEXAI = process.env.GOOGLE_GENAI_USE_VERTEXAI;

async function generateContentFromMLDev() {
  const ai = new GoogleGenAI({vertexai: false, apiKey: GEMINI_API_KEY});
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents:
      'What is the sum of the first 50 prime numbers? Generate and run code for the calculation, and make sure you get all 50.',
    config: {
      tools: [{googleSearch: {}}],
    },
  });
  console.debug(JSON.stringify(response?.candidates?.[0]?.groundingMetadata));
}

async function generateContentFromVertexAI() {
  const ai = new GoogleGenAI({
    vertexai: true,
    project: GOOGLE_CLOUD_PROJECT,
    location: GOOGLE_CLOUD_LOCATION,
  });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents:
      'What is the sum of the first 50 prime numbers? Generate and run code for the calculation, and make sure you get all 50.',
    config: {
      tools: [{googleSearch: {}}],
    },
  });
  console.debug(JSON.stringify(response?.candidates?.[0]?.groundingMetadata));
}

async function main() {
  if (GOOGLE_GENAI_USE_VERTEXAI) {
    await generateContentFromVertexAI().catch((e) =>
      console.error('got error', e),
    );
  } else {
    await generateContentFromMLDev().catch((e) =>
      console.error('got error', e),
    );
  }
}

main();



================================================
File: sdk-samples/generate_content_with_system_instructions.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {GoogleGenAI} from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION;
const GOOGLE_GENAI_USE_VERTEXAI = process.env.GOOGLE_GENAI_USE_VERTEXAI;

async function generateContentFromMLDev() {
  const ai = new GoogleGenAI({vertexai: false, apiKey: GEMINI_API_KEY});
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: 'high',
    config: {systemInstruction: 'I say high you say low.'},
  });
  console.debug(response.text);
}

async function generateContentFromVertexAI() {
  const ai = new GoogleGenAI({
    vertexai: true,
    project: GOOGLE_CLOUD_PROJECT,
    location: GOOGLE_CLOUD_LOCATION,
  });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: 'high',
    config: {systemInstruction: 'I say high you say low.'},
  });
  console.debug(response.text);
}

async function main() {
  if (GOOGLE_GENAI_USE_VERTEXAI) {
    await generateContentFromVertexAI().catch((e) =>
      console.error('got error', e),
    );
  } else {
    await generateContentFromMLDev().catch((e) =>
      console.error('got error', e),
    );
  }
}

main();



================================================
File: sdk-samples/generate_content_with_text.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {GoogleGenAI} from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION;
const GOOGLE_GENAI_USE_VERTEXAI = process.env.GOOGLE_GENAI_USE_VERTEXAI;

async function generateContentFromMLDev() {
  const ai = new GoogleGenAI({vertexai: false, apiKey: GEMINI_API_KEY});
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: 'why is the sky blue?',
  });
  console.debug(response.text);
}

async function generateContentFromVertexAI() {
  const ai = new GoogleGenAI({
    vertexai: true,
    project: GOOGLE_CLOUD_PROJECT,
    location: GOOGLE_CLOUD_LOCATION,
  });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: 'why is the sky blue?',
  });
  console.debug(response.text);
}

async function main() {
  if (GOOGLE_GENAI_USE_VERTEXAI) {
    await generateContentFromVertexAI().catch((e) =>
      console.error('got error', e),
    );
  } else {
    await generateContentFromMLDev().catch((e) =>
      console.error('got error', e),
    );
  }
}

main();



================================================
File: sdk-samples/generate_content_with_text_vertex_apikey.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {GoogleGenAI} from '@google/genai';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_GENAI_USE_VERTEXAI = process.env.GOOGLE_GENAI_USE_VERTEXAI;

async function generateContentFromVertexAI() {
  const ai = new GoogleGenAI({
    vertexai: true,
    apiKey: GOOGLE_API_KEY,
  });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-001',
    contents: 'why is the sky blue?',
  });
  console.debug(response.text);
}

async function main() {
  if (GOOGLE_GENAI_USE_VERTEXAI) {
    await generateContentFromVertexAI().catch((e) =>
      console.error('got error', e),
    );
  } else {
    console.log('Test is for Vertex AI API key only.');
  }
}

main();



================================================
File: sdk-samples/generate_image.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {GoogleGenAI} from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION;
const GOOGLE_GENAI_USE_VERTEXAI = process.env.GOOGLE_GENAI_USE_VERTEXAI;

async function generateContentFromMLDev() {
  const ai = new GoogleGenAI({vertexai: false, apiKey: GEMINI_API_KEY});
  const response = await ai.models.generateImages({
    model: 'imagen-3.0-generate-002',
    prompt: 'Robot holding a red skateboard',
    config: {
      numberOfImages: 1,
      includeRaiReason: true,
    },
  });

  console.debug(response?.generatedImages?.[0]?.image?.imageBytes);
}

async function generateContentFromVertexAI() {
  const ai = new GoogleGenAI({
    vertexai: true,
    project: GOOGLE_CLOUD_PROJECT,
    location: GOOGLE_CLOUD_LOCATION,
  });
  const response = await ai.models.generateImages({
    model: 'imagen-3.0-generate-002',
    prompt: 'Robot holding a red skateboard',
    config: {
      numberOfImages: 1,
      includeRaiReason: true,
    },
  });

  console.debug(response?.generatedImages?.[0]?.image?.imageBytes);
}

async function main() {
  if (GOOGLE_GENAI_USE_VERTEXAI) {
    await generateContentFromVertexAI().catch((e) =>
      console.error('got error', e),
    );
  } else {
    await generateContentFromMLDev().catch((e) =>
      console.error('got error', e),
    );
  }
}

main();



================================================
File: sdk-samples/generate_video.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {GoogleGenAI} from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION;
const GOOGLE_GENAI_USE_VERTEXAI = process.env.GOOGLE_GENAI_USE_VERTEXAI;

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateContentFromMLDev() {
  const ai = new GoogleGenAI({vertexai: false, apiKey: GEMINI_API_KEY});
  let operation = await ai.models.generateVideos({
    model: 'veo-2.0-generate-001',
    prompt: 'Man with a dog',
    config: {
      numberOfVideos: 1,
    },
  });

  while (!operation.done) {
    console.log('Waiting for completion');
    await delay(1000);
    operation = await ai.operations.getVideosOperation({operation: operation});
  }

  const response = operation.response;
  const fileName = response?.generatedVideos?.[0].video?.uri;
  console.log(fileName);
}

async function generateContentFromVertexAI() {
  const ai = new GoogleGenAI({
    vertexai: true,
    project: GOOGLE_CLOUD_PROJECT,
    location: GOOGLE_CLOUD_LOCATION,
  });
  let operation = await ai.models.generateVideos({
    model: 'veo-2.0-generate-001',
    prompt: 'Man with a dog',
  });

  while (!operation.done) {
    console.log('Waiting for completion');
    await delay(1000);
    operation = await ai.operations.getVideosOperation({operation: operation});
  }

  const response = operation.response;
  const fileName = response?.generatedVideos?.[0].video?.uri;
  console.log(fileName);
}

async function main() {
  if (GOOGLE_GENAI_USE_VERTEXAI) {
    await generateContentFromVertexAI().catch((e) =>
      console.error('got error', e),
    );
  } else {
    await generateContentFromMLDev().catch((e) =>
      console.error('got error', e),
    );
  }
}

main();



================================================
File: sdk-samples/get_model_info.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {GoogleGenAI} from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION;
const GOOGLE_GENAI_USE_VERTEXAI = process.env.GOOGLE_GENAI_USE_VERTEXAI;

function configureClient(): GoogleGenAI {
  if (GOOGLE_GENAI_USE_VERTEXAI) {
    return new GoogleGenAI({
      vertexai: true,
      project: GOOGLE_CLOUD_PROJECT,
      location: GOOGLE_CLOUD_LOCATION,
    });
  }
  return new GoogleGenAI({vertexai: false, apiKey: GEMINI_API_KEY});
}

async function main() {
  const ai = configureClient();
  const modelInfo = await ai.models.get({model: 'gemini-2.0-flash'});
  console.log(modelInfo);
}

main();



================================================
File: sdk-samples/live_client_content.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {GoogleGenAI, LiveServerMessage, Modality} from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION;
const GOOGLE_GENAI_USE_VERTEXAI = process.env.GOOGLE_GENAI_USE_VERTEXAI;

async function live(client: GoogleGenAI, model: string) {
  const responseQueue: LiveServerMessage[] = [];

  // This should use an async queue.
  async function waitMessage(): Promise<LiveServerMessage> {
    let done = false;
    let message: LiveServerMessage | undefined = undefined;
    while (!done) {
      message = responseQueue.shift();
      if (message) {
        console.debug('Received: %s\n', JSON.stringify(message, null, 4));
        done = true;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    return message!;
  }

  async function handleTurn(): Promise<LiveServerMessage[]> {
    const turn: LiveServerMessage[] = [];
    let done = false;
    while (!done) {
      const message = await waitMessage();
      turn.push(message);
      if (message.serverContent && message.serverContent.turnComplete) {
        done = true;
      }
    }
    return turn;
  }

  const session = await client.live.connect({
    model: model,
    callbacks: {
      onopen: function () {
        console.debug('Opened');
      },
      onmessage: function (message: LiveServerMessage) {
        responseQueue.push(message);
      },
      onerror: function (e: ErrorEvent) {
        console.debug('Error:', e.message);
      },
      onclose: function (e: CloseEvent) {
        console.debug('Close:', e.reason);
      },
    },
    config: {responseModalities: [Modality.TEXT]},
  });

  const simple = 'Hello world';
  console.log('-'.repeat(80));
  console.log(`Sent: ${simple}`);
  session.sendClientContent({turns: simple});

  await handleTurn();

  const turns = [
    'This image is just black, can you see it?',
    {
      inlineData: {
        // 2x2 black PNG, base64 encoded.
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAC0lEQVR4nGNgQAYAAA4AAamRc7EAAAAASUVORK5CYII=',
        mimeType: 'image/png',
      },
    },
  ];
  console.log('-'.repeat(80));
  console.log(`Sent: ${turns}`);
  session.sendClientContent({turns: turns});

  await handleTurn();

  session.close();
}

async function main() {
  if (GOOGLE_GENAI_USE_VERTEXAI) {
    const client = new GoogleGenAI({
      vertexai: true,
      project: GOOGLE_CLOUD_PROJECT,
      location: GOOGLE_CLOUD_LOCATION,
    });
    const model = 'gemini-2.0-flash-live-preview-04-09';
    await live(client, model).catch((e) => console.error('got error', e));
  } else {
    const client = new GoogleGenAI({
      vertexai: false,
      apiKey: GEMINI_API_KEY,
    });
    const model = 'gemini-2.0-flash-live-001';
    await live(client, model).catch((e) => console.error('got error', e));
  }
}

main();



================================================
File: sdk-samples/tsconfig.json
================================================
{
  "compilerOptions": {
    "target": "es2016",
    "module": "nodenext",
    "outDir": "./build",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true
  },
  "include": ["*.ts"]
}



================================================
File: sdk-samples/web/src/App.tsx
================================================
import {ChangeEvent, useState} from 'react';
import './App.css';
import GenerateContentText from './GenerateContentText';
import TextAndImage from './TextAndImage';
import UploadFile from './UploadFile';
import {VideoGeneration} from './Video';

function App() {
  const [apiKey, setApiKey] = useState('');
  const [vertexai, setVertexai] = useState<boolean>(false);

  const handleKeyChange = (event: ChangeEvent<HTMLInputElement>) => {
    setApiKey(event.target.value);
  };

  const handleVertexaiChange = (value: boolean) => {
    setVertexai(value);
  };

  return (
    <>
      <h1>Google GenAI TypeScript SDK demo</h1>
      <div className="card">
        <form>
          <label htmlFor="apikey">API key:</label>
          <input
            className="form-control"
            id="apikey"
            type="password"
            onChange={handleKeyChange}
            value={apiKey}
          />
        </form>
        <br />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}>
          <label htmlFor="backend">Backend:</label>

          <div style={{flexDirection: 'column'}}>
            <div style={{display: 'flex', alignItems: 'center'}}>
              <input
                type="radio"
                value="false"
                checked={vertexai === false}
                onChange={() => handleVertexaiChange(false)}
              />
              <label style={{marginLeft: '5px'}}>Gemini Developer API</label>
            </div>
            <div style={{display: 'flex', alignItems: 'center'}}>
              <input
                type="radio"
                value="true"
                checked={vertexai === true}
                onChange={() => handleVertexaiChange(true)}
              />
              <label style={{marginLeft: '5px'}}>Vertex AI API</label>
            </div>
          </div>
        </div>
      </div>
      <GenerateContentText apiKey={apiKey} vertexai={vertexai} />
      <UploadFile apiKey={apiKey} vertexai={vertexai} />
      <TextAndImage apiKey={apiKey} vertexai={vertexai} />
      <VideoGeneration apiKey={apiKey} vertexai={vertexai} />
    </>
  );
}

export default App;



================================================
File: sdk-samples/web/src/GenerateContentText.tsx
================================================
import {GoogleGenAI} from '@google/genai';
import {ChangeEvent, useState} from 'react';
import './App.css';

export default function GenerateContentText({
  apiKey,
  vertexai,
}: {
  apiKey: string;
  vertexai: boolean;
}) {
  const [prompt, setPrompt] = useState('');
  const [modelResponse, setModelResponse] = useState('');

  const handlePromptChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(event.target.value);
  };

  const handleSend = async () => {
    const ai = new GoogleGenAI({vertexai: vertexai, apiKey: apiKey});
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-001',
      contents: prompt,
    });
    setModelResponse(response.text ?? 'Empty response');
  };

  return (
    <>
      <div className="card">
        <h2 className="card-title">Text generation sample</h2>
        <form>
          <label htmlFor="prompt" className="form-label">
            Prompt:
          </label>
          <textarea
            className="form-control"
            id="prompt1"
            onChange={handlePromptChange}
          />
          <button
            type="button"
            style={{marginTop: '10px', marginBottom: '10px'}}
            className="btn btn-primary"
            onClick={handleSend}>
            Send
          </button>
          <br />
          <label htmlFor="response" className="form-label">
            Response:
          </label>
          <div className="card">{modelResponse}</div>
        </form>
      </div>
    </>
  );
}



================================================
File: sdk-samples/web/src/ImageUpload.tsx
================================================
import {File as GenAIFile} from '@google/genai';
import React, {useCallback, useRef, useState} from 'react';

interface ImageUploadProps {
  onUploadSuccess?: (response: GenAIFile) => void;
  onUploadError?: (error: Error) => void;
  ai: any;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  onUploadSuccess,
  onUploadError,
  ai,
}) => {
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedImageUri, setUploadedImageUri] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setFileToUpload(file);
      setUploadedImageUri(null);
    }
  };

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      const file = event.dataTransfer.files[0];
      setFileToUpload(file);
      setUploadedImageUri(null);
    }
  }, []);

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
    },
    [],
  );

  const handleUpload = async () => {
    if (!fileToUpload) return;

    setIsUploading(true);
    try {
      const response = await ai.files.upload({file: fileToUpload});
      setIsUploading(false);

      if (response && response.uri) {
        setUploadedImageUri(response.uri);
      }

      if (onUploadSuccess) {
        onUploadSuccess(response);
      }
    } catch (error) {
      setIsUploading(false);
      if (onUploadError) {
        if (error instanceof Error) {
          onUploadError(error);
        } else {
          onUploadError(new Error('An unknown error occurred during upload.'));
        }
      }
      console.error('Upload error:', error);
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      style={{
        border: '2px dashed #ccc',
        padding: '20px',
        textAlign: 'center',
        cursor: 'pointer',
      }}>
      {fileToUpload ? ( // Show preview if available
        <div>
          <img
            src={URL.createObjectURL(fileToUpload)}
            alt="Preview"
            style={{maxWidth: '300px', maxHeight: '300px'}}
          />
          {isUploading ? ( // Show uploading indicator if uploading
            <div className="d-flex justify-content-center align-items-center">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <span className="ms-2">Uploading...</span>
            </div>
          ) : uploadedImageUri ? ( // Show Upload new Image button if uploaded
            <div>
              <p>Image uploaded successfully!</p>
              <button
                className="btn btn-secondary mt-2"
                onClick={() => {
                  setUploadedImageUri(null);
                  setFileToUpload(null);
                }}>
                Upload new Image
              </button>
            </div>
          ) : (
            // Show upload button if not uploading and no uploaded image
            <div>
              <p>File: {fileToUpload?.name}</p>
              <button className="btn btn-primary" onClick={handleUpload}>
                Upload
              </button>
            </div>
          )}
        </div>
      ) : (
        // Show file selection if no preview
        <div>
          <p>Drag and drop an image here, or click to select a file.</p>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            ref={fileInputRef}
            style={{display: 'none'}}
          />
          <button
            className="btn btn-outline-secondary"
            onClick={() => fileInputRef.current?.click()}>
            Select File
          </button>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;



================================================
File: sdk-samples/web/src/TextAndImage.tsx
================================================
import {
  ContentListUnion,
  File,
  GenerateContentResponse,
  GoogleGenAI,
  createPartFromUri,
} from '@google/genai';
import {ChangeEvent, useState} from 'react';
import './App.css';
import {ImageUpload} from './ImageUpload';

export default function TextAndImage({
  apiKey,
  vertexai,
}: {
  apiKey: string;
  vertexai: boolean;
}) {
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [inputImage, setInputImage] = useState<File | null>(null);
  const [modelResponse, setModelResponse] = useState<
    GenerateContentResponse | string | null
  >(null);

  const ai = new GoogleGenAI({vertexai: vertexai, apiKey: apiKey});

  const handleUploadSuccess = (response: any) => {
    setUploadStatus('Image uploaded successfully!');
    setInputImage(response);
  };

  const handlePromptChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(event.target.value);
  };

  const handleSend = async () => {
    if (
      inputImage == null ||
      inputImage.uri == null ||
      inputImage.mimeType == null
    ) {
      console.log('Missing input image', inputImage);
      return;
    }
    const contents: ContentListUnion = [prompt];
    contents.push(createPartFromUri(inputImage.uri, inputImage.mimeType));
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: contents,
        config: {
          responseModalities: ['image', 'text'],
          responseMimeType: 'text/plain',
        },
      });
      setModelResponse(response);
    } catch (error) {
      console.error('Error generating content:', error);
      setModelResponse(
        `Generate content failed with error: ${(error as Error).message}`,
      );
    }
  };

  const handleUploadError = (error: Error) => {
    console.error('Upload error:', error.message);
    setUploadStatus(`Upload failed: ${error.message}`);
  };

  return (
    <div className="card">
      <h2 className="card-title">Text+Image -&gt; Text+Image Example</h2>
      <br />
      <div>
        <ImageUpload
          onUploadSuccess={handleUploadSuccess}
          onUploadError={handleUploadError}
          ai={ai}
        />
        <label htmlFor="prompt" className="form-label">
          Prompt:
        </label>
        <textarea
          className="form-control"
          id="prompt2"
          onChange={handlePromptChange}
        />
        {uploadStatus && <p className="mt-3">{uploadStatus}</p>}
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSend}
          style={{marginTop: '10px', marginBottom: '10px'}}>
          Send
        </button>
      </div>
      {modelResponse &&
      modelResponse instanceof GenerateContentResponse &&
      modelResponse.candidates ? (
        <div className="mt-4">
          <h2>Response:</h2>
          {modelResponse.candidates.map((candidate, candidateIndex) => (
            <div key={`candidate-${candidateIndex}`}>
              {candidate.content &&
                candidate.content.parts &&
                candidate.content.parts.map((part, partIndex) => (
                  <div key={`part-${partIndex}`}>
                    {part.text && <p>{part.text}</p>}
                    {part.inlineData &&
                      part.inlineData.data &&
                      part.inlineData.mimeType && (
                        <img
                          src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`}
                          alt="Generated Image"
                          className="img-fluid"
                        />
                      )}
                  </div>
                ))}
            </div>
          ))}
        </div>
      ) : (
        modelResponse &&
        typeof modelResponse === 'string' && (
          <div className="mt-4">
            <h2>Response:</h2>
            {modelResponse}
          </div>
        )
      )}
    </div>
  );
}



================================================
File: sdk-samples/web/src/UploadFile.tsx
================================================
import {
  ContentListUnion,
  File,
  GoogleGenAI,
  createPartFromUri,
} from '@google/genai';
import {ChangeEvent, useState} from 'react';
import './App.css';

export default function UploadFile({
  apiKey,
  vertexai,
}: {
  apiKey: string;
  vertexai: boolean;
}) {
  const [modelResponse, setModelResponse] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null); // Use File type

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      // Update uploaded file
      const ai = new GoogleGenAI({vertexai: vertexai, apiKey: apiKey});
      try {
        const response = await ai.files.upload({file: event.target.files[0]});
        setUploadedFile(response);
      } catch (error) {
        console.error('Upload error:', error);
        setModelResponse(
          `Upload failed with error: ${(error as Error).message}`,
        );
      }
    }
  };

  const handleDescribe = async () => {
    try {
      const ai = new GoogleGenAI({vertexai: false, apiKey: apiKey});
      const contents: ContentListUnion = ['Describe the file'];

      if (uploadedFile) {
        const resolvedFile = await uploadedFile;
        if (resolvedFile.uri && resolvedFile.mimeType) {
          const fileContent = createPartFromUri(
            resolvedFile.uri,
            resolvedFile.mimeType,
          );
          contents.push(fileContent);
        }

        let getFile = await ai.files.get({
          name: resolvedFile.name as string,
        });
        while (getFile.state === 'PROCESSING') {
          getFile = await ai.files.get({name: resolvedFile.name as string});
          console.log(getFile);
          console.log('File is still processing, retrying in 5 seconds');

          await new Promise((resolve) => {
            setTimeout(resolve, 5000);
          });
        }
        if (resolvedFile.state === 'FAILED') {
          setModelResponse('File processing failed.');
          return;
        }
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: contents,
      });

      const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
      setModelResponse(text ?? 'Empty response');
    } catch (error) {
      console.error('Describe error:', error);
      setModelResponse('Description failed.');
    }
  };

  return (
    <>
      <div className="card">
        <div>
          <h2 className="card-title">File upload sample</h2>
          <form>
            <label htmlFor="srcFile" style={{marginRight: '10px'}}>
              Upload file:
            </label>
            <input
              type="file"
              id="srcFile"
              className="form-control"
              onChange={handleFileUpload}
              style={{marginRight: '10px'}}
            />
            <button
              type="button"
              style={{marginTop: '10px', marginBottom: '10px'}}
              className="btn btn-primary"
              onClick={handleDescribe}>
              Describe
            </button>
          </form>
        </div>
        <label htmlFor="response" className="form-label">
          Response:
        </label>
        <div className="card">{modelResponse ?? 'Response'}</div>
      </div>
    </>
  );
}



================================================
File: sdk-samples/web/src/Video.tsx
================================================
import {GoogleGenAI, Video} from '@google/genai';
import React, {useState} from 'react';

interface VideoProps {
  apiKey: string;
  vertexai: boolean;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
export const VideoGeneration: React.FC<VideoProps> = ({apiKey, vertexai}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [video, setVideo] = useState<Video | null | undefined>(null);
  const [videoPrompt, setPrompt] = useState('');
  const [error, setError] = useState<Error | null>(null);

  const handlePromptChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setPrompt(event.target.value);
  };

  const handleGenerate = async () => {
    if (!prompt) return;

    setIsGenerating(true);
    const ai = new GoogleGenAI({vertexai: vertexai, apiKey: apiKey});
    try {
      var operation = await ai.models.generateVideos({
        model: 'veo-2.0-generate-001',
        prompt: videoPrompt,
        config: {
          numberOfVideos: 1,
        },
      });

      while (!operation.done) {
        console.log('Waiting for completion');
        await delay(1000);
        operation = await ai.operations.getVideosOperation({
          operation: operation,
        });
      }
      setIsGenerating(false);
      setVideo(operation.response?.generatedVideos?.[0].video);
    } catch (error) {
      setIsGenerating(false);
      if (error instanceof Error) {
        setError(error);
      } else {
        setError(new Error('An unknown error occurred during upload.'));
      }
    }
  };
  return (
    <div className="card">
      <h2 className="card-title">Veo</h2>
      <br />
      <div
        style={{
          border: '2px dashed #ccc',
          padding: '20px',
          textAlign: 'center',
          cursor: 'pointer',
        }}>
        <form>
          <label htmlFor="videoPrompt" className="form-label">
            Prompt:
          </label>
          <textarea
            className="form-control"
            id="videoPrompt"
            onChange={handlePromptChange}
          />
          <button
            type="button"
            style={{marginTop: '10px', marginBottom: '10px'}}
            className="btn btn-primary"
            onClick={handleGenerate}>
            Generate
          </button>
        </form>
        {video ? (
          <div>
            <video
              controls
              controlsList="nodownload"
              src={`${video.uri}&key=${apiKey}`}
              style={{maxWidth: '300px', maxHeight: '300px'}}
            />
          </div>
        ) : null}
        {isGenerating ? (
          <div>
            <p>Generating video...</p>
          </div>
        ) : null}
        {error ? (
          <div>
            <p>Error: {`${error}`}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};



================================================
File: sdk-samples/web/src/main.tsx
================================================
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
// Import our custom CSS
import './scss/styles.scss';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);



