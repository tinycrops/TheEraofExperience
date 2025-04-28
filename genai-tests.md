Directory structure:
└── test/
    ├── _fake_auth.ts
    ├── _generate_test_file.ts
    ├── generate_report.sh
    ├── packaging/
    │   └── test_packaging.sh
    ├── system/
    │   ├── node/
    │   │   ├── chats_test.ts
    │   │   ├── client_test.ts
    │   │   ├── hello_are_you_there.pcm
    │   │   └── live_test.ts
    │   └── web/
    │       ├── chats_test.ts
    │       └── client_test.ts
    └── unit/
        ├── api_client_test.ts
        ├── chats_test.ts
        ├── file_test.ts
        ├── live_test.ts
        ├── models_test.ts
        ├── pagers_test.ts
        ├── schema_helper_test.ts
        ├── transformers_test.ts
        ├── types_test.ts
        ├── node/
        │   ├── base_url_test.ts
        │   ├── client_test.ts
        │   ├── node_auth_test.ts
        │   └── node_upload_test.ts
        └── web/
            ├── base_url_test.ts
            └── web_auth_test.ts


Files Content:

================================================
FILE: test/_fake_auth.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {Auth} from '../src/_auth';

const GOOGLE_API_KEY_HEADER = 'x-goog-api-key';
const AUTHORIZATION_HEADER = 'Authorization';

/**
 * A mock implementation of the Auth interface for testing purposes.
 */
export class FakeAuth implements Auth {
  constructor(private readonly apiKey?: string) {}

  async addAuthHeaders(headers: Headers): Promise<void> {
    if (this.apiKey !== undefined) {
      if (headers.get(GOOGLE_API_KEY_HEADER) !== null) {
        return;
      }
      headers.append(GOOGLE_API_KEY_HEADER, this.apiKey);
      return;
    }

    if (headers.get(AUTHORIZATION_HEADER) !== null) {
      return;
    }
    headers.append(AUTHORIZATION_HEADER, `Bearer token`);
  }
}



================================================
FILE: test/_generate_test_file.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export async function createZeroFilledTempFile(size: number): Promise<string> {
  if (size < 0) {
    throw new Error('Size must be non-negative.');
  }

  const tempFilePath = path.join(os.tmpdir(), `temp-${Math.random()}.txt`);
  const chunkSize = Math.min(size, 1024 * 1024); // 1MB chunk size

  const fileHandle = await fs.promises.open(tempFilePath, 'w');

  try {
    const buffer = Buffer.alloc(chunkSize, 0);
    let remainingSize = size;

    while (remainingSize > 0) {
      const writeSize = Math.min(remainingSize, chunkSize);
      await fileHandle.write(buffer, 0, writeSize);
      remainingSize -= writeSize;
    }

    return tempFilePath;
  } finally {
    await fileHandle.close();
  }
}



================================================
FILE: test/generate_report.sh
================================================
#  @license
#  Copyright 2025 Google LLC
#  SPDX-License-Identifier: Apache-2.0

#!/bin/bash
set -x
# The directory of the script.
DIR=$(dirname "${BASH_SOURCE[0]}")

# The temp directory used, within $DIR omit the -p parameter to create a
# temporary directory in the default location
WORK_DIR=`mktemp -d -p "$DIR"`
DEFAULT_NYC_OUTPUT_DIR="${PWD}/.nyc_output/"

# Check if tmp dir was created.
if [[ ! "$WORK_DIR" || ! -d "$WORK_DIR" ]]; then
  echo "Could not create temp dir"
  exit 1
fi

# Deletes the temp directory.
function cleanup {
  echo "Cleaning up temp working directory $WORK_DIR" and default output directory for nyc $DEFAULT_NYC_OUTPUT_DIR
  rm -rf "$WORK_DIR"
  rm -Rf DEFAULT_NYC_OUTPUT_DIR
  echo "Deleted temp working directory $WORK_DIR"
}

# Register the cleanup function to be called on the EXIT signal.
trap cleanup EXIT


UNIT=coverage-unit-test
TABLE=coverage-table-test

# TODO(b/398045499): Add live tests back to the coverage report.
ALL_TESTS_IN_UNIT_EXCEPT_LIVE_TESTS=$(find test/unit/ -type f -name "*_test.ts" ! -name "live_test.ts" )

# Generate the reports for each test suite separately to avoid covering each
# other.
nyc --reporter=json --report-dir=./${WORK_DIR}/${UNIT} --require ts-node/register jasmine dist/test/unit/**/*_test.js ${ALL_TESTS_IN_UNIT_EXCEPT_LIVE_TESTS}
nyc --reporter=json --report-dir=./${WORK_DIR}/${TABLE} --require ts-node/register jasmine test/g3/table_test.ts

# Move all the generated coverage reports to the same directory to merge reports.
mv ./${WORK_DIR}/${UNIT}/coverage-final.json  ./${WORK_DIR}/${UNIT}-coverage-report.json
mv ./${WORK_DIR}/${TABLE}/coverage-final.json  ./${WORK_DIR}/${TABLE}-coverage-report.json

# Clean up the directory to avoid contamination, nyc will generate this
# directory everytime.
rm -Rf DEFAULT_NYC_OUTPUT_DIR || true

# Merge the reports into one file.
nyc merge ./${WORK_DIR} --output-file=${DEFAULT_NYC_OUTPUT_DIR}/coverage-report.json

# Convert and present the merged report in ./.nyc_output
nyc report --reporter=text --reporter=lcov --report-dir=${DEFAULT_NYC_OUTPUT_DIR}




================================================
FILE: test/packaging/test_packaging.sh
================================================
#!/usr/bin/env bash

set -ex

npm pack

PACKAGE_VERSION=$(jq -r .version package.json)
TARBALL="google-genai-${PACKAGE_VERSION}.tgz"

# Verify that the tarball exists
if [ ! -f "${TARBALL}" ]; then
  echo "Error: Tarball ${TARBALL} was not created."
  exit 1
fi

cd sdk-samples
npm install "../${TARBALL}"
npm run build



================================================
FILE: test/system/node/chats_test.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleGenAI} from '../../../src/node/node_client';
import {Tool, Type} from '../../../src/types';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;

const function_calling: Tool = {
  functionDeclarations: [
    {
      description: 'Custom divide function',
      name: 'customDivide',
      parameters: {
        type: Type.OBJECT,
        properties: {
          numerator: {
            type: Type.NUMBER,
          },
          denominator: {
            type: Type.NUMBER,
          },
        },
      },
    },
  ],
};

describe('sendMessage', () => {
  const testCases = [
    {
      name: 'Google AI with text',
      client: new GoogleGenAI({vertexai: false, apiKey: GEMINI_API_KEY}),
      model: 'gemini-2.0-flash',
      config: {},
      history: [],
      messages: ['why is the sky blue?'],
    },
    {
      name: 'Vertex AI with text',
      client: new GoogleGenAI({vertexai: true, project: GOOGLE_CLOUD_PROJECT}),
      model: 'gemini-2.0-flash',
      config: {},
      history: [],
      messages: ['why is the sky blue?'],
    },
    {
      name: 'Google AI with config',
      client: new GoogleGenAI({vertexai: false, apiKey: GEMINI_API_KEY}),
      model: 'gemini-2.0-flash',
      config: {temperature: 0.5, maxOutputTokens: 20},
      history: [],
      messages: ['why is the sky blue?'],
    },
    {
      name: 'Vertex AI with config',
      client: new GoogleGenAI({vertexai: true, project: GOOGLE_CLOUD_PROJECT}),
      model: 'gemini-2.0-flash',
      config: {temperature: 0.5, maxOutputTokens: 20},
      history: [],
      messages: ['why is the sky blue?'],
    },
    {
      name: 'Google AI with history',
      client: new GoogleGenAI({vertexai: false, apiKey: GEMINI_API_KEY}),
      model: 'gemini-2.0-flash',
      config: {},
      history: [
        {parts: [{text: 'a=5'}], role: 'user'},
        {parts: [{text: 'b=10'}], role: 'user'},
      ],
      messages: ['what is the value of a+b?'],
    },
    {
      name: 'Vertex AI with history',
      client: new GoogleGenAI({vertexai: true, project: GOOGLE_CLOUD_PROJECT}),
      model: 'gemini-2.0-flash',
      config: {},
      history: [
        {parts: [{text: 'a=5'}], role: 'user'},
        {parts: [{text: 'b=10'}], role: 'user'},
      ],
      messages: ['what is the value of a+b?'],
    },
    {
      name: 'Google AI multiple messages',
      client: new GoogleGenAI({vertexai: false, apiKey: GEMINI_API_KEY}),
      model: 'gemini-2.0-flash',
      config: {},
      history: [],
      messages: [
        'Tell me a story in 100 words?',
        'What is the title of the story?',
      ],
    },
    {
      name: 'Vertex AI multilple messages',
      client: new GoogleGenAI({vertexai: true, project: GOOGLE_CLOUD_PROJECT}),
      model: 'gemini-2.0-flash',
      config: {},
      history: [],
      messages: [
        'Tell me a story in 100 words?',
        'What is the title of the story?',
      ],
    },
  ];

  testCases.forEach(async (testCase) => {
    it(testCase.name, async () => {
      const client = testCase.client;
      const chat = client.chats.create({
        model: testCase.model,
        config: testCase.config,
        history: testCase.history,
      });
      for (const message of testCase.messages) {
        const response = await chat.sendMessage({message});
        console.log('chat.sendMessage response: ', response.text);
        expect(response.text).not.toBeNull();
      }
      const comprehensiveHistory = chat.getHistory();
      expect(comprehensiveHistory.length).toBeGreaterThan(0);
      const curatedHistory = chat.getHistory(true);
      expect(curatedHistory.length).toBeGreaterThan(0);
    });
  });

  testCases.forEach(async (testCase) => {
    it(testCase.name + ' stream', async () => {
      const client = testCase.client;
      const chat = client.chats.create({
        model: testCase.model,
        config: testCase.config,
        history: testCase.history,
      });
      for (const message of testCase.messages) {
        const response = await chat.sendMessageStream({message});
        for await (const chunk of response) {
          console.log('chat.sendMessageStream response chunk: ', chunk.text);
          expect(chunk.text).not.toBeNull();
        }
      }
      const comprehensiveHistory = chat.getHistory();
      expect(comprehensiveHistory.length).toBeGreaterThan(0);
      const curatedHistory = chat.getHistory(true);
      expect(curatedHistory.length).toBeGreaterThan(0);
    });
  });

  it('Google AI array of strings', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: GEMINI_API_KEY});
    const chat = client.chats.create({model: 'gemini-2.0-flash'});
    const response = await chat.sendMessage({
      message: ['why is the sky blue?', 'Can the sky appear in other colors?'],
    });
    console.log('chat.sendMessage response: ', response.text);
  });

  it('Vertex AI array of strings', async () => {
    const client = new GoogleGenAI({
      vertexai: true,
      project: GOOGLE_CLOUD_PROJECT,
    });
    const chat = client.chats.create({model: 'gemini-2.0-flash'});
    const response = await chat.sendMessage({
      message: ['why is the sky blue?', 'Can the sky appear in other colors?'],
    });
    console.log('chat.sendMessage response: ', response.text);
  });
});

describe('chats function calling', () => {
  const testCases = [
    {
      name: 'Google AI with function calling',
      client: new GoogleGenAI({vertexai: false, apiKey: GEMINI_API_KEY}),
      model: 'gemini-2.0-flash',
      config: {tools: [function_calling]},
      history: [],
      messages: ['what is the result of 100/2', 'what is the result of 50/2?'],
    },
    {
      name: 'Vertex AI with function calling',
      client: new GoogleGenAI({vertexai: true, project: GOOGLE_CLOUD_PROJECT}),
      model: 'gemini-2.0-flash',
      config: {tools: [function_calling]},
      history: [],
      messages: ['what is the result of 100/2', 'what is the result of 50/2?'],
    },
  ];

  testCases.forEach(async (testCase) => {
    it(testCase.name, async () => {
      const client = testCase.client;
      const chat = client.chats.create({
        model: testCase.model,
        config: testCase.config,
        history: testCase.history,
      });
      for (const message of testCase.messages) {
        const response = await chat.sendMessage({message});
        console.log(
          'chat.sendMessage function calls: ',
          response.functionCalls,
        );
        expect(response.functionCalls).not.toBeNull();
      }
    });
  });

  testCases.forEach(async (testCase) => {
    it(testCase.name + ' stream', async () => {
      const client = testCase.client;
      const chat = client.chats.create({
        model: testCase.model,
        config: testCase.config,
        history: testCase.history,
      });
      for (const message of testCase.messages) {
        const response = await chat.sendMessageStream({message});
        for await (const chunk of response) {
          console.log(
            'chat.sendMessageStream function calls: ',
            chunk.functionCalls,
          );
          expect(chunk.functionCalls).not.toBeNull();
        }
      }
    });
  });
});



================================================
FILE: test/system/node/client_test.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {fail} from 'assert';
import {GoogleAuthOptions} from 'google-auth-library';
import {z} from 'zod';

import {GoogleGenAI} from '../../../src/node/node_client';
import {
  functionDeclarationFromZodFunction,
  responseSchemaFromZodType,
} from '../../../src/schema_helper';
import {
  FunctionCallingConfigMode,
  GenerateContentResponse,
  Part,
} from '../../../src/types';
import {createZeroFilledTempFile} from '../../_generate_test_file';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION;

jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000; // 30 seconds

describe('generateContent', () => {
  it('ML Dev should generate content with specified parameters', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: GOOGLE_API_KEY});
    const response = await client.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: 'why is the sky blue?',
      config: {maxOutputTokens: 20, candidateCount: 1},
    });
    expect(response.candidates!.length).toBe(
      1,
      'Expected 1 candidate got ' + response.candidates!.length,
    );
    expect(response.usageMetadata!.candidatesTokenCount).toBeLessThanOrEqual(
      20,
      'Expected candidatesTokenCount to be less than or equal to 20, got ' +
        response.usageMetadata!.candidatesTokenCount,
    );
    console.info(
      'ML Dev should generate content with specified parameters\n',
      response.text,
    );
  });

  it('Vertex AI should generate content with specified parameters', async () => {
    const client = new GoogleGenAI({
      vertexai: true,
      project: GOOGLE_CLOUD_PROJECT,
      location: GOOGLE_CLOUD_LOCATION,
    });
    const response = await client.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: 'why is the sky blue?',
      config: {maxOutputTokens: 20, candidateCount: 1},
    });
    expect(response.candidates!.length).toBe(
      1,
      'Expected 1 candidate got ' + response.candidates!.length,
    );
    expect(response.usageMetadata!.candidatesTokenCount).toBeLessThanOrEqual(
      20,
      'Expected candidatesTokenCount to be less than or equal to 20, got ' +
        response.usageMetadata!.candidatesTokenCount,
    );
    console.info(
      'Vertex AI should generate content with specified parameters\n',
      response.text,
    );
  });

  it('ML Dev should generate content with system instruction', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: GOOGLE_API_KEY});
    const response = await client.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: 'high',
      config: {systemInstruction: 'I say high you say low'},
    });
    const responseText = response.text;
    expect(responseText?.includes('low') ?? false).toBe(
      true,
      `Expected response to include "low", but got ${responseText}`,
    );
    console.info(
      'ML Dev should generate content with system instruction\n',
      responseText,
    );
  });

  it('Vertex AI should generate content with system instruction', async () => {
    const client = new GoogleGenAI({
      vertexai: true,
      project: GOOGLE_CLOUD_PROJECT,
      location: GOOGLE_CLOUD_LOCATION,
    });
    const response = await client.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: 'high',
      config: {systemInstruction: 'I say high you say low.'},
    });
    const responseText = response.text;
    expect(responseText?.includes('low') ?? false).toBe(
      true,
      `Expected response to include "low", but got ${responseText}`,
    );
    console.info(
      'Vertex AI should generate content with system instruction\n',
      responseText,
    );
  });
  it('Vertex AI should use application default credentials when no auth options are provided', async () => {
    const client = new GoogleGenAI({
      vertexai: true,
      project: GOOGLE_CLOUD_PROJECT,
      location: GOOGLE_CLOUD_LOCATION,
    });
    await client.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: 'high',
      config: {systemInstruction: 'I say high you say low.'},
    });
    console.info(
      'Vertex AI should use application default credentials when no auth options are provided\n',
    );
  });
  it('Vertex AI should allow user provided googleAuth objects', async () => {
    const googleAuthOptions: GoogleAuthOptions = {
      credentials: {
        client_email: 'test-sa@appspot.gserviceaccount.com',
        private_key: '',
      },
    };
    const client = new GoogleGenAI({
      vertexai: true,
      project: GOOGLE_CLOUD_PROJECT,
      location: GOOGLE_CLOUD_LOCATION,
      googleAuthOptions: googleAuthOptions,
    });
    try {
      await client.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: 'why is the sky blue?',
        config: {maxOutputTokens: 20, candidateCount: 1},
      });
      console.info('Vertex AI should allow user provided googleAuth objects\n');
    } catch (error: unknown) {
      if (error instanceof Error) {
        // When a service account is passed in via client_email, a private_key
        // field is required.
        expect(
          error.message.includes(
            'The incoming JSON object does not contain a private_key field',
          ),
        );
      }
    }
  });
  it('ML Dev should generate content with given zod schema', async () => {
    const innerObject = z.object({
      innerString: z.string(),
      innerNumber: z.number(),
    });
    const nullableInnerObject = z.object({
      innerString: z.string(),
      innerNumber: z.number(),
    });
    const nestedSchema = z.object({
      simpleString: z.string().describe('This is a simple string'),
      stringDatatime: z.string().datetime(),
      stringWithEnum: z.enum(['enumvalue1', 'enumvalue2', 'enumvalue3']),
      stringWithLength: z.string().min(1).max(10),
      simpleNumber: z.number(),
      simpleInteger: z.number().int(),
      integerInt64: z.number().int(),
      numberWithMinMax: z.number().min(1).max(10),
      simpleBoolean: z.boolean(),
      arrayFiled: z.array(z.string()),
      unionField: z.union([z.string(), z.number()]),
      nullableField: z.string().nullable(),
      nullableArrayField: z.array(z.string()).nullable(),
      nullableObjectField: nullableInnerObject.nullable(),
      inner: innerObject,
    });
    const client = new GoogleGenAI({vertexai: false, apiKey: GOOGLE_API_KEY});
    const response = await client.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: 'populate the following object',
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchemaFromZodType(
          client.vertexai,
          nestedSchema,
        ),
      },
    });
    const parsedResponse = JSON.parse(
      response.candidates![0].content!['parts']![0].text as string,
    );
    console.log('mldev response', parsedResponse);
    const validationResult = nestedSchema.safeParse(parsedResponse);
    expect(validationResult.success).toEqual(true);
  });

  it('Vertex AI should generate content with given zod schema', async () => {
    const innerObject = z.object({
      innerString: z.string(),
      innerNumber: z.number(),
    });
    const nullableInnerObject = z.object({
      innerString: z.string(),
      innerNumber: z.number(),
    });
    const nestedSchema = z.object({
      simpleString: z.string().default('default'),
      stringDatetime: z.string().datetime(),
      stringWithEnum: z.enum(['enumvalue1', 'enumvalue2', 'enumvalue3']),
      stringWithLength: z.string().min(1).max(10),
      simpleNumber: z.number(),
      simpleInteger: z.number().int(),
      integerInt64: z.number().int(),
      numberWithMinMax: z.number().min(1).max(10),
      simpleBoolean: z.boolean(),
      arrayFiled: z.array(z.string()),
      unionField: z.union([z.string(), z.number()]),
      nullableField: z.string().nullable(),
      nullableArrayField: z.array(z.string()).nullable(),
      nullableObjectField: nullableInnerObject.nullable(),
      inner: innerObject,
    });

    const client = new GoogleGenAI({
      vertexai: true,
      project: GOOGLE_CLOUD_PROJECT,
      location: GOOGLE_CLOUD_LOCATION,
    });
    const response = await client.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: 'populate the following object',
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchemaFromZodType(
          client.vertexai,
          nestedSchema,
        ),
      },
    });
    const parsedResponse = JSON.parse(
      response.candidates![0].content!['parts']![0].text as string,
    );
    console.log('vertex ai response', parsedResponse);
    const validationResult = nestedSchema.safeParse(parsedResponse);
    expect(validationResult.success).toEqual(true);
  });
  it('ML Dev should generate function call with given zod function schema', async () => {
    const stringArgument = z.object({
      firstString: z.string(),
      secondString: z.string(),
    });
    const concatStringFunction = z
      .function()
      .args(stringArgument)
      .returns(z.void())
      .describe('this is a concat string function');
    const client = new GoogleGenAI({vertexai: false, apiKey: GOOGLE_API_KEY});
    const response = await client.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: 'put word: hello and word: world into a string',
      config: {
        tools: [
          {
            functionDeclarations: [
              functionDeclarationFromZodFunction(client.vertexai, {
                name: 'concatStringFunction',
                zodFunctionSchema: concatStringFunction,
              }),
            ],
          },
        ],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.ANY,
            allowedFunctionNames: ['concatStringFunction'],
          },
        },
      },
    });
    const functionCallResponse =
      response.candidates![0].content!['parts']![0].functionCall;
    expect(functionCallResponse!.name).toEqual('concatStringFunction');
    const parsedArgument = stringArgument.safeParse(
      functionCallResponse!.args!,
    );
    expect(parsedArgument.success).toEqual(true);
    expect(parsedArgument.data).toEqual({
      firstString: 'hello',
      secondString: 'world',
    });
  });
});
it('ML Dev should generate function call with given zod function schema no separate function parameter def', async () => {
  const concatStringFunction = z
    .function()
    .args(z.object({firstString: z.string(), secondString: z.string()}))
    .returns(z.void())
    .describe('this is a concat string function');
  const client = new GoogleGenAI({vertexai: false, apiKey: GOOGLE_API_KEY});
  const response = await client.models.generateContent({
    model: 'gemini-1.5-flash',
    contents: 'put word: hello and word: world into a string',
    config: {
      tools: [
        {
          functionDeclarations: [
            functionDeclarationFromZodFunction(client.vertexai, {
              name: 'concatStringFunction',
              zodFunctionSchema: concatStringFunction,
            }),
          ],
        },
      ],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.ANY,
          allowedFunctionNames: ['concatStringFunction'],
        },
      },
    },
  });
  const functionCallResponse =
    response.candidates![0].content!['parts']![0].functionCall;
  expect(functionCallResponse!.name).toEqual('concatStringFunction');
  const parsedArgument =
    concatStringFunction._def.args._def.items![0].safeParse(
      functionCallResponse!.args!,
    );
  expect(parsedArgument.success).toEqual(true);
  expect(parsedArgument.data).toEqual({
    firstString: 'hello',
    secondString: 'world',
  });
});
it('Vertex AI should generate function call with given zod function schema', async () => {
  const stringArgument = z.object({
    firstString: z.string(),
    secondString: z.string(),
  });
  const concatStringFunction = z
    .function()
    .args(stringArgument)
    .returns(z.string())
    .describe('this is a concat string function');
  const client = new GoogleGenAI({
    vertexai: true,
    project: GOOGLE_CLOUD_PROJECT,
    location: GOOGLE_CLOUD_LOCATION,
  });
  const response = await client.models.generateContent({
    model: 'gemini-1.5-flash',
    contents: 'put word: hello and word: world into a string',
    config: {
      tools: [
        {
          functionDeclarations: [
            functionDeclarationFromZodFunction(client.vertexai, {
              name: 'concatStringFunction',
              zodFunctionSchema: concatStringFunction,
            }),
          ],
        },
      ],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.ANY,
          allowedFunctionNames: ['concatStringFunction'],
        },
      },
    },
  });
  const functionCallResponse =
    response.candidates![0].content!['parts']![0].functionCall;
  expect(functionCallResponse!.name).toEqual('concatStringFunction');
  const parsedArgument = stringArgument.safeParse(functionCallResponse!.args!);
  expect(parsedArgument.success).toEqual(true);
  expect(parsedArgument.data).toEqual({
    firstString: 'hello',
    secondString: 'world',
  });
});

describe('generateContentStream', () => {
  it('ML Dev should stream generate content with specified parameters', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: GOOGLE_API_KEY});
    const response = await client.models.generateContentStream({
      model: 'gemini-1.5-flash',
      contents: 'why is the sky blue?',
      config: {candidateCount: 1, maxOutputTokens: 200},
    });
    let i = 1;
    let finalChunk: GenerateContentResponse | undefined = undefined;
    console.info(
      'ML Dev should stream generate content with specified parameters',
    );
    for await (const chunk of response) {
      expect(chunk.text).toBeDefined();
      console.info(`stream chunk ${i}`, chunk.text);
      expect(chunk.candidates!.length).toBe(
        1,
        'Expected 1 candidate got ' + chunk.candidates!.length,
      );
      i++;
      finalChunk = chunk;
    }
    expect(finalChunk?.usageMetadata!.candidatesTokenCount).toBeLessThanOrEqual(
      250, // sometimes backend returns a little more than 200 tokens
      'Expected candidatesTokenCount to be less than or equal to 250, got ' +
        finalChunk?.usageMetadata!.candidatesTokenCount,
    );
  });

  it('Vertex AI should stream generate content with specified parameters', async () => {
    const client = new GoogleGenAI({
      vertexai: true,
      project: GOOGLE_CLOUD_PROJECT,
      location: GOOGLE_CLOUD_LOCATION,
    });
    const response = await client.models.generateContentStream({
      model: 'gemini-1.5-flash',
      contents: 'why is the sky blue?',
      config: {candidateCount: 1, maxOutputTokens: 200},
    });
    let i = 1;
    let finalChunk: GenerateContentResponse | undefined = undefined;
    console.info(
      'Vertex AI should stream generate content with specified parameters',
    );
    for await (const chunk of response) {
      console.info(`stream chunk ${i}`, chunk.text);
      expect(chunk.candidates!.length).toBe(
        1,
        'Expected 1 candidate got ' + chunk.candidates!.length,
      );
      i++;
      finalChunk = chunk;
    }
    expect(finalChunk?.usageMetadata!.candidatesTokenCount).toBeLessThanOrEqual(
      250, // sometimes backend returns a little more than 200 tokens
      'Expected candidatesTokenCount to be less than or equal to 250, got ' +
        finalChunk?.usageMetadata!.candidatesTokenCount,
    );
  });

  it('ML Dev should stream generate content with system instruction', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: GOOGLE_API_KEY});
    const response = await client.models.generateContentStream({
      model: 'gemini-1.5-flash',
      contents: 'high',
      config: {
        systemInstruction:
          'I say high you say low, and then tell me why is the sky blue.',
        candidateCount: 1,
        maxOutputTokens: 200,
      },
    });
    let i = 1;
    let finalChunk: GenerateContentResponse | undefined = undefined;
    console.info(
      'ML Dev should stream generate content with system instruction',
    );
    for await (const chunk of response) {
      console.info(`stream chunk ${i}`, chunk.text);
      expect(chunk.candidates!.length).toBe(
        1,
        'Expected 1 candidate got ' + chunk.candidates!.length,
      );
      i++;
      finalChunk = chunk;
    }
    expect(finalChunk?.usageMetadata!.candidatesTokenCount).toBeLessThanOrEqual(
      250, // sometimes backend returns a little more than 200 tokens
      'Expected candidatesTokenCount to be less than or equal to 250, got ' +
        finalChunk?.usageMetadata!.candidatesTokenCount,
    );
  });

  it('Vertex AI should stream generate content with system instruction', async () => {
    const client = new GoogleGenAI({
      vertexai: true,
      project: GOOGLE_CLOUD_PROJECT,
      location: GOOGLE_CLOUD_LOCATION,
    });
    const response = await client.models.generateContentStream({
      model: 'gemini-1.5-flash',
      contents: 'high',
      config: {
        systemInstruction:
          'I say high you say low, then tell me why is the sky blue.',
        maxOutputTokens: 200,
        candidateCount: 1,
      },
    });
    let i = 1;
    let finalChunk: GenerateContentResponse | undefined = undefined;
    console.info(
      'Vertex AI should stream generate content with system instruction',
    );
    for await (const chunk of response) {
      console.info(`stream chunk ${i}`, chunk.text);
      expect(chunk.candidates!.length).toBe(
        1,
        'Expected 1 candidate got ' + chunk.candidates!.length,
      );
      i++;
      finalChunk = chunk;
    }
    expect(finalChunk?.usageMetadata!.candidatesTokenCount).toBeLessThanOrEqual(
      250, // sometimes backend returns a little more than 200 tokens
      'Expected candidatesTokenCount to be less than or equal to 250, got ' +
        finalChunk?.usageMetadata!.candidatesTokenCount,
    );
  });
});

describe('generateImages', () => {
  it('ML Dev should generate image with specified parameters', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: GOOGLE_API_KEY});
    const response = await client.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: 'Robot holding a red skateboard',
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        includeSafetyAttributes: true,
      },
    });
    expect(response?.generatedImages!.length).toBe(
      1,
      'Expected 1 generated image got ' + response?.generatedImages!.length,
    );
    expect(response?.generatedImages?.[0]?.image?.imageBytes).toEqual(
      jasmine.anything(),
      'Expected image bytes to be non-empty',
    );
    expect(response?.positivePromptSafetyAttributes).toEqual(
      jasmine.anything(),
      'Expected positive prompt safety attributes to be non-empty',
    );
  });

  it('Vertex AI should generate images with specified parameters', async () => {
    const client = new GoogleGenAI({
      vertexai: true,
      project: GOOGLE_CLOUD_PROJECT,
      location: GOOGLE_CLOUD_LOCATION,
    });
    const response = await client.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: 'Robot holding a red skateboard',
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        includeSafetyAttributes: true,
      },
    });
    expect(response?.generatedImages!.length).toBe(
      1,
      'Expected 1 generated image got ' + response?.generatedImages!.length,
    );
    expect(response?.generatedImages?.[0]?.image?.imageBytes).toEqual(
      jasmine.anything(),
      'Expected image bytes to be non-empty',
    );
    expect(response?.positivePromptSafetyAttributes).toEqual(
      jasmine.anything(),
      'Expected positive prompt safety attributes to be non-empty',
    );
  });
});

describe('test async performance', () => {
  beforeAll(function () {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 15000; // 15 seconds
  });
  it('generate content should complete in less than 10 seconds', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: GOOGLE_API_KEY});
    async function firstAsyncFunc() {
      client.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: 'high',
        config: {
          systemInstruction: 'I say high you say low.',
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 5000)); // artificially add 5 seconds delay
    }
    async function secondAsyncFunc() {
      client.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: 'high',
        config: {
          systemInstruction: 'I say high you say low.',
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 10000)); // artificially add 10 seconds timeout
    }
    const startTime = performance.now(); // Record start time
    try {
      await Promise.all([firstAsyncFunc(), secondAsyncFunc()]);
    } catch (e) {
      fail('Test failed due to error: ' + e);
    } finally {
      const endTime = performance.now(); // Record end time
      const timeDelta = endTime - startTime;
      expect(timeDelta).toBeLessThanOrEqual(
        10030,
        'Expected timeDelta to be less than or equal to 10030, got ' +
          timeDelta,
      );
    }
  });
  it('stream generate content should complete in less than 10 seconds', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: GOOGLE_API_KEY});
    async function firstAsyncFunc() {
      client.models.generateContentStream({
        model: 'gemini-1.5-flash',
        contents: 'high',
        config: {
          systemInstruction: 'I say high you say low.',
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 5000)); // artificially add 5 seconds delay
    }
    async function secondAsyncFunc() {
      client.models.generateContentStream({
        model: 'gemini-1.5-flash',
        contents: 'high',
        config: {
          systemInstruction: 'I say high you say low.',
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 10000)); // artificially add 10 seconds timeout
    }
    const startTime = performance.now(); // Record start time
    try {
      await Promise.all([firstAsyncFunc(), secondAsyncFunc()]);
    } catch (e) {
      fail('Test failed due to error: ' + e);
    } finally {
      const endTime = performance.now(); // Record end time
      const timeDelta = endTime - startTime;
      expect(timeDelta).toBeLessThanOrEqual(
        10050,
        'Expected timeDelta to be less than or equal to 10050, got ' +
          timeDelta,
      );
    }
  });
});

describe('test forward compatibility', () => {
  it('generate content should not return thought field', async () => {
    const client = new GoogleGenAI({
      vertexai: false,
      apiKey: GOOGLE_API_KEY,
      httpOptions: {apiVersion: 'v1alpha'},
    });
    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash-thinking-exp',
      contents: 'What is the sum of natural numbers from 1 to 100?',
      config: {
        maxOutputTokens: 20,
        candidateCount: 1,
        thinkingConfig: {includeThoughts: true},
      },
    });
    expect(JSON.stringify(response)).not.toContain(
      '"thought":true',
      'Expected response to not contain field "thought',
    );
  });
});

describe('countTokens', () => {
  it('ML Dev should count tokens with specified parameters', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: GOOGLE_API_KEY});

    const response = await client.models.countTokens({
      model: 'gemini-1.5-flash',
      contents: 'The quick brown fox jumps over the lazy dog.',
    });
    expect(response!.totalTokens ?? 0).toBeGreaterThan(
      0,
      'Expected totalTokens to be nonzero, got ' + response.totalTokens,
    );
    console.info(
      'ML Dev should count tokens with specified parameters\n',
      JSON.stringify(response),
    );
  });

  it('Vertex AI should count tokens with specified parameters', async () => {
    const client = new GoogleGenAI({
      vertexai: true,
      project: GOOGLE_CLOUD_PROJECT,
      location: GOOGLE_CLOUD_LOCATION,
    });

    const response = await client.models.countTokens({
      model: 'gemini-1.5-flash',
      contents: 'The quick brown fox jumps over the lazy dog.',
    });
    expect(response!.totalTokens ?? 0).toBeGreaterThan(
      0,
      'Expected totalTokens to be nonzero, got ' + response.totalTokens,
    );
    console.info(
      'Vertex AI should count tokens with specified parameters\n',
      JSON.stringify(response),
    );
  });
});

describe('embedContent', () => {
  it('Vertex AI should embed content with specified parameters', async () => {
    const client = new GoogleGenAI({
      vertexai: true,
      project: GOOGLE_CLOUD_PROJECT,
      location: GOOGLE_CLOUD_LOCATION,
    });

    const response = await client.models.embedContent({
      model: 'text-embedding-004',
      contents: 'Hello world',
    });
    expect(response!.embeddings!.length).toBeGreaterThan(
      0,
      'Expected embeddings to be nonempty, got ' + response!.embeddings!.length,
    );
    console.info(
      'Vertex AI should embed content with specified parameters\n',
      JSON.stringify(response),
    );
  });
});

describe('computeTokens', () => {
  it('Vertex AI should compute tokens with specified parameters', async () => {
    const client = new GoogleGenAI({
      vertexai: true,
      project: GOOGLE_CLOUD_PROJECT,
      location: GOOGLE_CLOUD_LOCATION,
    });

    const response = await client.models.computeTokens({
      model: 'gemini-1.5-flash',
      contents: 'The quick brown fox jumps over the lazy dog.',
    });
    expect(response!.tokensInfo!.length).toBeGreaterThan(
      0,
      'Expected tokensInfo to be nonempty, got ' + response!.tokensInfo!.length,
    );
    console.info(
      'Vertex AI should compute tokens with specified parameters\n',
      JSON.stringify(response),
    );
  });
});

describe('cachedContent', () => {
  it('Vertex AI should cache content with specified parameters', async () => {
    const client = new GoogleGenAI({
      vertexai: true,
      project: GOOGLE_CLOUD_PROJECT,
      location: GOOGLE_CLOUD_LOCATION,
    });

    const cachedContent1: Part = {
      fileData: {
        fileUri: 'gs://cloud-samples-data/generative-ai/pdf/2403.05530.pdf',
        mimeType: 'application/pdf',
      },
    };

    const cachedContent2: Part = {
      fileData: {
        fileUri: 'gs://cloud-samples-data/generative-ai/pdf/2312.11805v3.pdf',
        mimeType: 'application/pdf',
      },
    };

    const cache = await client.caches.create({
      model: 'gemini-1.5-pro-002',
      config: {contents: [cachedContent1, cachedContent2]},
    });
    expect(cache.name).toBeDefined();

    const getResponse = await client.caches.get({name: cache.name ?? ''});
    expect(getResponse.name).toBe(
      cache.name,
      'Expected getResponse to contain the created cache name.',
    );
  });

  it('Vertex AI should return list of caches', async () => {
    const client = new GoogleGenAI({
      vertexai: true,
      project: GOOGLE_CLOUD_PROJECT,
      location: GOOGLE_CLOUD_LOCATION,
    });

    const response = await client.caches.list();
    const pager = await client.caches.list({
      config: {pageSize: 2},
    });
    let page = pager.page;
    for (const cache of page) {
      console.log(cache.name);
    }
    while (pager.hasNextPage()) {
      page = await pager.nextPage();
      for (const cache of page) {
        console.log(cache.name);
      }
    }

    expect(response.pageLength).toBeGreaterThan(0);
    expect(pager.pageLength).toBeGreaterThan(0);
  });
});

describe('files', () => {
  it('ML Dev list files with specified parameters', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: GOOGLE_API_KEY});
    const response = await client.files.list({config: {'pageSize': 2}});
    expect(response!.pageLength ?? 0).toBeGreaterThan(
      0,
      'Expected at least one file has more than 2 pages, got ' +
        response!.pageLength,
    );
    console.info(
      'ML Dev should list files with specified parameters\n',
      JSON.stringify(response),
    );
  });
  it('ML Dev list files with pagers', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: GOOGLE_API_KEY});
    const pager = await client.files.list({config: {pageSize: 2}});
    let page = pager.page;
    for (const file of page) {
      console.log(file.name);
    }
    while (pager.hasNextPage()) {
      for (const file of page) {
        console.log(file.name);
      }
      page = await pager.nextPage();
    }

    expect(pager.pageLength).toBeGreaterThan(0);
  });
  it('ML Dev should upload the file from a string path and get just uploaded file with specified parameters', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: GOOGLE_API_KEY});
    // generate a temp file
    const filePath = await createZeroFilledTempFile(1024 * 1024 * 10);

    // upload the file
    const file = await client.files.upload({
      file: filePath,
      config: {displayName: 'generate_file_test.txt'},
    });
    expect(file.name?.startsWith('files/'))
      .withContext(`File name "${file.name}" should start with "files/"}`)
      .toBeTrue();

    // get the file just uploaded
    const getFile = await client.files.get({name: file.name as string});
    console.log('getFile', getFile);
    expect(getFile.name).toBe(file.name);
  });
  it('ML Dev should upload the file from a Blob and get just uploaded file with specified parameters', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: GOOGLE_API_KEY});
    // generate a temp file
    const fileBlob = new Blob([new Uint8Array(1024 * 1024 * 30)], {
      type: 'text/plain',
    });

    // upload the file
    const file = await client.files.upload({
      file: fileBlob,
      config: {displayName: 'upload_blob_test.txt'},
    });
    expect(file.name?.startsWith('files/'))
      .withContext(`File name "${file.name}" should start with "files/"}`)
      .toBeTrue();

    // get the file just uploaded
    const getFile = await client.files.get({name: file.name as string});
    console.log('getFile', getFile);
    expect(getFile.name).toBe(file.name);
  });
});



================================================
FILE: test/system/node/hello_are_you_there.pcm
================================================
[Non-text file]


================================================
FILE: test/system/node/live_test.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';

import {GoogleGenAIOptions} from '../../../src/client';
import {Session} from '../../../src/live';
import {GoogleGenAI} from '../../../src/node/node_client';
import * as types from '../../../src/types';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION;

const VERTEX_MODEL = 'gemini-2.0-flash-live-preview-04-09';
const MLDEV_MODEL = 'gemini-2.0-flash-live-001';

function loadFileAsBase64(filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Construct the full path to the file
    const filePath = path.join(__dirname, filename);

    fs.readFile(filePath, (err, data) => {
      if (err) {
        reject(err); // Reject if there's an error reading the file
        return;
      }
      // Encode the file content to base64
      const base64Data = data.toString('base64');
      resolve(base64Data); // Resolve with the base64 string
    });
  });
}

class SessionWithQueue {
  private messageQueue: types.LiveServerMessage[] = [];
  private messageResolver: ((message: types.LiveServerMessage) => void) | null =
    null;
  private session: Session | null = null;

  public client: GoogleGenAI; // Explicitly define properties
  public model: string;
  public config?: types.LiveConnectConfig;

  constructor(
    client: GoogleGenAI, // Remove 'public' keyword here
    model: string,
    config?: types.LiveConnectConfig,
  ) {
    this.client = client; // Assign to the class properties
    this.model = model;
    this.config = config;
  }

  async initializeSession(): Promise<void> {
    this.session = await this.client.live.connect({
      model: this.model,
      config: this.config,
      callbacks: {
        onopen: null,
        onmessage: (message: types.LiveServerMessage) => {
          if (this.messageResolver) {
            this.messageResolver(message);
            this.messageResolver = null; // Clear resolver after fulfilling
          } else {
            this.messageQueue.push(message);
          }
        },
        onerror: null,
        onclose: null,
      },
    });
  }

  sendClientContent(params: types.LiveSendClientContentParameters) {
    if (this.session === null) {
      throw new Error('Session is uninitialized. Cannot send client content.');
    }
    return this.session.sendClientContent(params);
  }

  sendRealtimeInput(params: types.LiveSendRealtimeInputParameters) {
    if (this.session === null) {
      throw new Error('Session is uninitialized. Cannot send client content.');
    }
    return this.session.sendRealtimeInput(params);
  }

  sendToolResponse(params: types.LiveSendToolResponseParameters) {
    if (this.session === null) {
      throw new Error('Session is uninitialized. Cannot send client content.');
    }
    return this.session.sendToolResponse(params);
  }

  close() {
    if (this.session === null) {
      throw new Error('Session is uninitialized. Cannot send client content.');
    }
    return this.session.close();
  }

  async receive(): Promise<types.LiveServerMessage> {
    return new Promise((resolve) => {
      if (this.messageQueue.length > 0) {
        resolve(this.messageQueue.shift()!);
      } else {
        this.messageResolver = resolve;
      }
    });
  }
}

async function make_session_with_queue(
  client: GoogleGenAI,
  model: string,
  config?: types.LiveConnectConfig,
): Promise<SessionWithQueue> {
  const session = new SessionWithQueue(client, model, config);
  await session.initializeSession();
  return session;
}

describe('live', () => {
  it('ML Dev should initialize from environment variables', async () => {
    const client = new GoogleGenAI({vertexai: false});
    expect(client.live).not.toBeNull();
  });

  it('ML Dev should send text in async session', async () => {
    const clientOpts: GoogleGenAIOptions = {
      vertexai: false,
      apiKey: GOOGLE_API_KEY,
    };
    const client = new GoogleGenAI(clientOpts);
    const session = await make_session_with_queue(client, MLDEV_MODEL);

    session.sendClientContent({
      turns: 'Hello what should we talk about?',
      turnComplete: true,
    });
    const setupMessage = await session.receive();
    expect(setupMessage.setupComplete).not.toBeNull();

    const message = await session.receive();
    expect(message.serverContent).not.toBeNull();

    session.close();

    console.log('Mldev ok');
  });

  it('Vertex should send text in async session', async () => {
    const clientOpts: GoogleGenAIOptions = {
      vertexai: true,
      project: GOOGLE_CLOUD_PROJECT,
      location: GOOGLE_CLOUD_LOCATION,
    };
    const client = new GoogleGenAI(clientOpts);
    const session = await make_session_with_queue(client, VERTEX_MODEL);

    session.sendClientContent({
      turns: 'Hello what should we talk about?',
      turnComplete: true,
    });
    const setupMessage = await session.receive();
    expect(setupMessage.setupComplete).not.toBeNull();

    const message = await session.receive();
    expect(message.serverContent).not.toBeNull();

    session.close();
    console.log('Vertex ok');
  });

  it('ML Dev should send content dict in async session', async () => {
    const clientOpts: GoogleGenAIOptions = {
      vertexai: false,
      apiKey: GOOGLE_API_KEY,
    };
    const client = new GoogleGenAI(clientOpts);
    const session = await make_session_with_queue(client, MLDEV_MODEL);

    session.sendClientContent({
      turns: [
        {parts: [{text: 'Hello what should we talk about?'}], role: 'user'},
      ],
      turnComplete: true,
    });
    const setupMessage = await session.receive();
    expect(setupMessage.setupComplete).not.toBeNull();

    const message = await session.receive();
    expect(message.serverContent).not.toBeNull();

    session.close();
  });

  it('Vertex should send content dict in async session', async () => {
    const clientOpts: GoogleGenAIOptions = {
      vertexai: true,
      project: GOOGLE_CLOUD_PROJECT,
      location: GOOGLE_CLOUD_LOCATION,
    };
    const client = new GoogleGenAI(clientOpts);
    const session = await make_session_with_queue(client, VERTEX_MODEL);

    session.sendClientContent({
      turns: [
        {parts: [{text: 'Hello what should we talk about?'}], role: 'user'},
      ],
      turnComplete: true,
    });
    const setupMessage = await session.receive();
    expect(setupMessage.setupComplete).not.toBeNull();

    const message = await session.receive();
    expect(message.serverContent).not.toBeNull();

    session.close();
  });

  it('ML Dev should receive transcription in async session with transcription enabled', async () => {
    const clientOpts: GoogleGenAIOptions = {
      vertexai: false,
      apiKey: GOOGLE_API_KEY,
    };
    const client = new GoogleGenAI(clientOpts);
    const config: types.LiveConnectConfig = {
      outputAudioTranscription: {},
    };
    const session = await make_session_with_queue(client, MLDEV_MODEL, config);

    session.sendClientContent({
      turns: 'Hello what should we talk about?',
      turnComplete: true,
    });
    const setupMessage = await session.receive();
    expect(setupMessage.setupComplete).not.toBeNull();

    // First message could be empty.
    await session.receive();
    const message = await session.receive();
    expect(message.serverContent).not.toBeNull();
    console.log(
      'ML Dev should receive transcription in async session with transcription enabled',
    );
    console.log(message);

    session.close();

    console.log('Mldev ok');
  });

  it('Vertex should receive transcription in async session with transcription enabled', async () => {
    const clientOpts: GoogleGenAIOptions = {
      vertexai: true,
      project: GOOGLE_CLOUD_PROJECT,
      location: GOOGLE_CLOUD_LOCATION,
    };
    const client = new GoogleGenAI(clientOpts);
    const config: types.LiveConnectConfig = {
      outputAudioTranscription: {},
    };
    const session = await make_session_with_queue(client, VERTEX_MODEL, config);

    session.sendClientContent({
      turns: 'Hello what should we talk about?',
      turnComplete: true,
    });
    const setupMessage = await session.receive();
    expect(setupMessage.setupComplete).not.toBeNull();

    // First message could be empty.
    await session.receive();
    const message = await session.receive();
    expect(message.serverContent).not.toBeNull();
    console.log(
      'Vertex should receive transcription in async session with transcription enabled',
    );
    console.log(message);

    session.close();
    console.log('Vertex ok');
  });

  it('ML Dev should return error for invalid input in async session', async () => {
    const clientOpts: GoogleGenAIOptions = {
      vertexai: false,
      apiKey: GOOGLE_API_KEY,
    };
    const client = new GoogleGenAI(clientOpts);
    const session = await make_session_with_queue(client, MLDEV_MODEL);

    try {
      session.sendToolResponse({
        functionResponses: {name: 'name', response: {response: {}}},
      });
    } catch (e: unknown) {
      if (e instanceof Error) {
        expect(e.message).toContain('FunctionResponse request must have an');
      }
    }
    session.close();
  });

  it('Vertex should return error for invalid input in async session', async () => {
    const clientOpts: GoogleGenAIOptions = {
      vertexai: true,
      project: GOOGLE_CLOUD_PROJECT,
      location: GOOGLE_CLOUD_LOCATION,
    };
    const client = new GoogleGenAI(clientOpts);
    const session = await make_session_with_queue(client, VERTEX_MODEL);

    try {
      session.sendToolResponse({
        functionResponses: {name: 'name', response: {response: {}}},
      });
    } catch (e: unknown) {
      if (e instanceof Error) {
        expect(e.message).toContain('FunctionResponse request must have an');
      }
    }

    session.close();
  });

  it('Vertex should initialize session with publishers prefix', async () => {
    const clientOpts: GoogleGenAIOptions = {
      vertexai: true,
      project: GOOGLE_CLOUD_PROJECT,
      location: GOOGLE_CLOUD_LOCATION,
    };
    const client = new GoogleGenAI(clientOpts);
    const session = await make_session_with_queue(
      client,
      'publishers/google/models/gemini-2.0-flash-live-preview-04-09',
    );
    const setupMessage = await session.receive();
    expect(setupMessage.setupComplete).not.toBeNull();

    session.close();
  });

  it('Vertex should initialize session without prefix', async () => {
    const clientOpts: GoogleGenAIOptions = {
      vertexai: true,
      project: GOOGLE_CLOUD_PROJECT,
      location: GOOGLE_CLOUD_LOCATION,
    };
    const client = new GoogleGenAI(clientOpts);
    const session = await make_session_with_queue(client, VERTEX_MODEL);
    const setupMessage = await session.receive();
    expect(setupMessage.setupComplete).not.toBeNull();

    session.close();
  });

  it('ML Dev should send tool response', async () => {
    const clientOpts: GoogleGenAIOptions = {
      vertexai: false,
      apiKey: GOOGLE_API_KEY,
    };
    const client = new GoogleGenAI(clientOpts);
    const session = await make_session_with_queue(client, MLDEV_MODEL, {
      tools: [
        {
          functionDeclarations: [
            {
              name: 'get_current_weather',
              description: 'Get the current weather in a given location',
              parameters: {
                type: types.Type.OBJECT,
                properties: {
                  location: {
                    type: types.Type.STRING,
                    description: 'The city and state, e.g. San Francisco, CA',
                  },
                  unit: {
                    type: types.Type.STRING,
                    enum: ['celsius', 'fahrenheit'],
                  },
                },
                required: ['location'],
              },
            },
          ],
        },
      ],
    });

    session.sendClientContent({
      turns: [
        {
          parts: [{text: 'what is the weather in Redmond Washington'}],
          role: 'user',
        },
      ],
      turnComplete: true,
    });
    const setupMessage = await session.receive();
    expect(setupMessage.setupComplete).not.toBeNull();

    const message = await session.receive();
    expect(message.toolCall).not.toBeNull();

    session.close();
  });

  it('Vertex should send tool response', async () => {
    const clientOpts: GoogleGenAIOptions = {
      vertexai: true,
      project: GOOGLE_CLOUD_PROJECT,
      location: GOOGLE_CLOUD_LOCATION,
    };
    const client = new GoogleGenAI(clientOpts);
    const session = await make_session_with_queue(client, VERTEX_MODEL, {
      tools: [
        {
          functionDeclarations: [
            {
              name: 'get_current_weather',
              description: 'Get the current weather in a given location',
              parameters: {
                type: types.Type.OBJECT,
                properties: {
                  location: {
                    type: types.Type.STRING,
                    description: 'The city and state, e.g. San Francisco, CA',
                  },
                  unit: {
                    type: types.Type.STRING,
                    enum: ['celsius', 'fahrenheit'],
                  },
                },
                required: ['location'],
              },
            },
          ],
        },
      ],
    });

    session.sendClientContent({
      turns: [
        {
          parts: [{text: 'what is the weather in Redmond Washington'}],
          role: 'user',
        },
      ],
      turnComplete: true,
    });
    const setupMessage = await session.receive();
    expect(setupMessage.setupComplete).not.toBeNull();

    const message = await session.receive();
    expect(message.toolCall).not.toBeNull();

    session.close();
  });

  it('ML Dev should send tool response with function responses', async () => {
    const clientOpts: GoogleGenAIOptions = {
      vertexai: false,
      apiKey: GOOGLE_API_KEY,
    };
    const client = new GoogleGenAI(clientOpts);
    const session = await make_session_with_queue(client, MLDEV_MODEL);

    session.sendToolResponse({
      functionResponses: [
        {
          'id': 'function-call-1',
          'name': 'getStatus',
          'response': {
            'mood': 'happy',
          },
        },
      ],
    });
    session.close();
  });

  it('Vertex should send tool response with function responses', async () => {
    const clientOpts: GoogleGenAIOptions = {
      vertexai: true,
      project: GOOGLE_CLOUD_PROJECT,
      location: GOOGLE_CLOUD_LOCATION,
    };
    const client = new GoogleGenAI(clientOpts);
    const session = await make_session_with_queue(client, VERTEX_MODEL);

    session.sendToolResponse({
      functionResponses: [
        {
          'name': 'getStatus',
          'response': {
            'mood': 'happy',
          },
        },
      ],
    });
    session.close();
  });

  it('Vertex should respond to realtime media-audio input', async () => {
    //  If you need to generate any other audio files this command was useful:
    //
    //  ffmpeg -i hello_are_you_there.wav -f s16le -acodec pcm_s16le -ar 16000 hello_are_you_there.pcm
    const audioBase64 = await loadFileAsBase64('hello_are_you_there.pcm');
    const clientOpts: GoogleGenAIOptions = {
      vertexai: true,
      project: GOOGLE_CLOUD_PROJECT,
      location: GOOGLE_CLOUD_LOCATION,
    };
    const client = new GoogleGenAI(clientOpts);
    const session = await make_session_with_queue(client, VERTEX_MODEL, {
      responseModalities: [types.Modality.TEXT],
    });

    session.sendRealtimeInput({
      media: {
        data: audioBase64,
        mimeType: 'audio/pcm;rate=16000',
      },
    });
    const setupMessage = await session.receive();
    expect(setupMessage.setupComplete).not.toBeNull();

    const message = await session.receive();
    expect(message.serverContent).not.toBeNull();

    session.close();
  });

  it('MLDev should respond to realtime media-audio input', async () => {
    const audioBase64 = await loadFileAsBase64('hello_are_you_there.wav');

    const clientOpts: GoogleGenAIOptions = {
      vertexai: false,
      apiKey: GOOGLE_API_KEY,
    };
    const client = new GoogleGenAI(clientOpts);
    const session = await make_session_with_queue(client, MLDEV_MODEL, {
      responseModalities: [types.Modality.TEXT],
    });

    session.sendRealtimeInput({
      media: {
        data: audioBase64,
        mimeType: 'audio/pcm;rate=16000',
      },
    });
    const setupMessage = await session.receive();
    expect(setupMessage.setupComplete).not.toBeNull();

    const message = await session.receive();
    expect(message.serverContent).not.toBeNull();

    session.close();
  });

  it('MLDev should reply to realtime audio input', async () => {
    const audioBase64 = await loadFileAsBase64('hello_are_you_there.wav');
    const clientOpts: GoogleGenAIOptions = {
      vertexai: false,
      apiKey: GOOGLE_API_KEY,
    };
    const client = new GoogleGenAI(clientOpts);
    const session = await make_session_with_queue(client, MLDEV_MODEL, {
      responseModalities: [types.Modality.TEXT],
    });

    session.sendRealtimeInput({
      audio: {
        data: audioBase64,
        mimeType: 'audio/pcm;rate=16000',
      },
    });
    const setupMessage = await session.receive();
    expect(setupMessage.setupComplete).not.toBeNull();

    const message = await session.receive();
    expect(message.serverContent).not.toBeNull();

    session.close();
  });

  it('MLDev should reply to realtime text input', async () => {
    const clientOpts: GoogleGenAIOptions = {
      vertexai: false,
      apiKey: GOOGLE_API_KEY,
    };
    const client = new GoogleGenAI(clientOpts);
    const session = await make_session_with_queue(client, MLDEV_MODEL, {
      responseModalities: [types.Modality.TEXT],
    });

    session.sendRealtimeInput({
      text: 'Are you there Gemini?',
    });
    const setupMessage = await session.receive();
    expect(setupMessage.setupComplete).not.toBeNull();

    const message = await session.receive();
    expect(message.serverContent).not.toBeNull();

    session.close();
  });

  it('MLDev handle activity start and end', async () => {
    const audioBase64 = await loadFileAsBase64('hello_are_you_there.wav');

    const clientOpts: GoogleGenAIOptions = {
      vertexai: false,
      apiKey: GOOGLE_API_KEY,
    };
    const client = new GoogleGenAI(clientOpts);
    const session = await make_session_with_queue(client, MLDEV_MODEL, {
      responseModalities: [types.Modality.TEXT],
      realtimeInputConfig: {automaticActivityDetection: {disabled: true}},
    } as types.LiveConnectConfig);

    session.sendRealtimeInput({
      activityStart: {},
    } as types.LiveSendRealtimeInputParameters);
    session.sendRealtimeInput({
      audio: {
        data: audioBase64,
        mimeType: 'audio/pcm;rate=16000',
      },
    });
    session.sendRealtimeInput({
      activityEnd: {},
    } as types.LiveSendRealtimeInputParameters);

    const setupMessage = await session.receive();
    expect(setupMessage.setupComplete).not.toBeNull();

    const message = await session.receive();
    expect(message.serverContent).not.toBeNull();

    session.close();
  });
});



================================================
FILE: test/system/web/chats_test.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {Tool, Type} from '../../../src/types';
import {GoogleGenAI} from '../../../src/web/web_client';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const function_calling: Tool = {
  functionDeclarations: [
    {
      description: 'Custom divide function',
      name: 'customDivide',
      parameters: {
        type: Type.OBJECT,
        properties: {
          numerator: {
            type: Type.NUMBER,
          },
          denominator: {
            type: Type.NUMBER,
          },
        },
      },
    },
  ],
};

describe('sendMessage', () => {
  const testCases = [
    {
      name: 'Google AI with text',
      client: new GoogleGenAI({vertexai: false, apiKey: GEMINI_API_KEY}),
      model: 'gemini-2.0-flash',
      config: {},
      history: [],
      messages: ['why is the sky blue?'],
    },
    {
      name: 'Google AI with config',
      client: new GoogleGenAI({vertexai: false, apiKey: GEMINI_API_KEY}),
      model: 'gemini-2.0-flash',
      config: {temperature: 0.5, maxOutputTokens: 20},
      history: [],
      messages: ['why is the sky blue?'],
    },
    {
      name: 'Google AI with history',
      client: new GoogleGenAI({vertexai: false, apiKey: GEMINI_API_KEY}),
      model: 'gemini-2.0-flash',
      config: {},
      history: [
        {parts: [{text: 'a=5'}], role: 'user'},
        {parts: [{text: 'b=10'}], role: 'user'},
      ],
      messages: ['what is the value of a+b?'],
    },
    {
      name: 'Google AI multiple messages',
      client: new GoogleGenAI({vertexai: false, apiKey: GEMINI_API_KEY}),
      model: 'gemini-2.0-flash',
      config: {},
      history: [],
      messages: [
        'Tell me a story in 100 words?',
        'What is the title of the story?',
      ],
    },
  ];

  testCases.forEach(async (testCase) => {
    it(testCase.name, async () => {
      const client = testCase.client;
      const chat = client.chats.create({
        model: testCase.model,
        config: testCase.config,
        history: testCase.history,
      });
      for (const message of testCase.messages) {
        const response = await chat.sendMessage({message});
        console.log('chat.sendMessage response: ', response.text);
        expect(response.text).not.toBeNull();
      }
      const comprehensiveHistory = chat.getHistory();
      expect(comprehensiveHistory.length).toBeGreaterThan(0);
      const curatedHistory = chat.getHistory(true);
      expect(curatedHistory.length).toBeGreaterThan(0);
    });
  });

  testCases.forEach(async (testCase) => {
    it(testCase.name + ' stream', async () => {
      const client = testCase.client;
      const chat = client.chats.create({
        model: testCase.model,
        config: testCase.config,
        history: testCase.history,
      });
      for (const message of testCase.messages) {
        const response = await chat.sendMessageStream({message});
        for await (const chunk of response) {
          console.log('chat.sendMessageStream response chunk: ', chunk.text);
          expect(chunk.text).not.toBeNull();
        }
      }
      const comprehensiveHistory = chat.getHistory();
      expect(comprehensiveHistory.length).toBeGreaterThan(0);
      const curatedHistory = chat.getHistory(true);
      expect(curatedHistory.length).toBeGreaterThan(0);
    });
  });

  it('Google AI array of strings', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: GEMINI_API_KEY});
    const chat = client.chats.create({model: 'gemini-2.0-flash'});
    const response = await chat.sendMessage({
      message: ['why is the sky blue?', 'Can the sky appear in other colors?'],
    });
    console.log('chat.sendMessage response: ', response.text);
  });
});

describe('chats function calling', () => {
  const testCases = [
    {
      name: 'Google AI with function calling',
      client: new GoogleGenAI({vertexai: false, apiKey: GEMINI_API_KEY}),
      model: 'gemini-2.0-flash',
      config: {tools: [function_calling]},
      history: [],
      messages: ['what is the result of 100/2', 'what is the result of 50/2?'],
    },
  ];

  testCases.forEach(async (testCase) => {
    it(testCase.name, async () => {
      const client = testCase.client;
      const chat = client.chats.create({
        model: testCase.model,
        config: testCase.config,
        history: testCase.history,
      });
      for (const message of testCase.messages) {
        const response = await chat.sendMessage({message});
        console.log(
          'chat.sendMessage function calls: ',
          response.functionCalls,
        );
        expect(response.functionCalls).not.toBeNull();
      }
    });
  });

  testCases.forEach(async (testCase) => {
    it(testCase.name + ' stream', async () => {
      const client = testCase.client;
      const chat = client.chats.create({
        model: testCase.model,
        config: testCase.config,
        history: testCase.history,
      });
      for (const message of testCase.messages) {
        const response = await chat.sendMessageStream({message});
        for await (const chunk of response) {
          console.log(
            'chat.sendMessageStream function calls: ',
            chunk.functionCalls,
          );
          expect(chunk.functionCalls).not.toBeNull();
        }
      }
    });
  });
});



================================================
FILE: test/system/web/client_test.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {fail} from 'assert';
import {z} from 'zod';

import {
  functionDeclarationFromZodFunction,
  responseSchemaFromZodType,
} from '../../../src/schema_helper';
import {
  FunctionCallingConfigMode,
  GenerateContentResponse,
} from '../../../src/types';
import {GoogleGenAI} from '../../../src/web/web_client';
import {createZeroFilledTempFile} from '../../_generate_test_file';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION;

jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000; // 30 seconds

describe('generateContent', () => {
  it('ML Dev should generate content with specified parameters', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: GOOGLE_API_KEY});
    const response = await client.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: 'why is the sky blue?',
      config: {maxOutputTokens: 20, candidateCount: 1},
    });
    expect(response.candidates!.length).toBe(
      1,
      'Expected 1 candidate got ' + response.candidates!.length,
    );
    expect(response.usageMetadata!.candidatesTokenCount).toBeLessThanOrEqual(
      20,
      'Expected candidatesTokenCount to be less than or equal to 20, got ' +
        response.usageMetadata!.candidatesTokenCount,
    );
    console.info(
      'ML Dev should generate content with specified parameters\n',
      response.text,
    );
  });

  it('ML Dev should generate content with system instruction', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: GOOGLE_API_KEY});
    const response = await client.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: 'high',
      config: {systemInstruction: 'I say high you say low'},
    });
    const responseText = response.text;
    expect(responseText?.includes('low') ?? false).toBe(
      true,
      `Expected response to include "low", but got ${responseText}`,
    );
    console.info(
      'ML Dev should generate content with system instruction\n',
      responseText,
    );
  });
  it('ML Dev should generate content with given zod schema', async () => {
    const innerObject = z.object({
      innerString: z.string(),
      innerNumber: z.number(),
    });
    const nullableInnerObject = z.object({
      innerString: z.string(),
      innerNumber: z.number(),
    });
    const nestedSchema = z.object({
      simpleString: z.string().describe('This is a simple string'),
      stringDatatime: z.string().datetime(),
      stringWithEnum: z.enum(['enumvalue1', 'enumvalue2', 'enumvalue3']),
      stringWithLength: z.string().min(1).max(10),
      simpleNumber: z.number(),
      simpleInteger: z.number().int(),
      integerInt64: z.number().int(),
      numberWithMinMax: z.number().min(1).max(10),
      simpleBoolean: z.boolean(),
      arrayFiled: z.array(z.string()),
      unionField: z.union([z.string(), z.number()]),
      nullableField: z.string().nullable(),
      nullableArrayField: z.array(z.string()).nullable(),
      nullableObjectField: nullableInnerObject.nullable(),
      inner: innerObject,
    });
    const client = new GoogleGenAI({vertexai: false, apiKey: GOOGLE_API_KEY});
    const response = await client.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: 'populate the following object',
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchemaFromZodType(
          client.vertexai,
          nestedSchema,
        ),
      },
    });
    const parsedResponse = JSON.parse(
      response.candidates![0].content!['parts']![0].text as string,
    );
    console.log('mldev response', parsedResponse);
    const validationResult = nestedSchema.safeParse(parsedResponse);
    expect(validationResult.success).toEqual(true);
  });
  it('ML Dev should generate function call with given zod function schema', async () => {
    const stringArgument = z.object({
      firstString: z.string(),
      secondString: z.string(),
    });
    const concatStringFunction = z
      .function()
      .args(stringArgument)
      .returns(z.void())
      .describe('this is a concat string function');
    const client = new GoogleGenAI({vertexai: false, apiKey: GOOGLE_API_KEY});
    const response = await client.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: 'put word: hello and word: world into a string',
      config: {
        tools: [
          {
            functionDeclarations: [
              functionDeclarationFromZodFunction(client.vertexai, {
                name: 'concatStringFunction',
                zodFunctionSchema: concatStringFunction,
              }),
            ],
          },
        ],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.ANY,
            allowedFunctionNames: ['concatStringFunction'],
          },
        },
      },
    });
    const functionCallResponse =
      response.candidates![0].content!['parts']![0].functionCall;
    expect(functionCallResponse!.name).toEqual('concatStringFunction');
    const parsedArgument = stringArgument.safeParse(
      functionCallResponse!.args!,
    );
    expect(parsedArgument.success).toEqual(true);
    expect(parsedArgument.data).toEqual({
      firstString: 'hello',
      secondString: 'world',
    });
  });
});

describe('generateContentStream', () => {
  it('ML Dev should stream generate content with specified parameters', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: GOOGLE_API_KEY});
    const response = await client.models.generateContentStream({
      model: 'gemini-1.5-flash',
      contents: 'why is the sky blue?',
      config: {candidateCount: 1, maxOutputTokens: 200},
    });
    let i = 1;
    let finalChunk: GenerateContentResponse | undefined = undefined;
    console.info(
      'ML Dev should stream generate content with specified parameters',
    );
    for await (const chunk of response) {
      expect(chunk.text).toBeDefined();
      console.info(`stream chunk ${i}`, chunk.text);
      expect(chunk.candidates!.length).toBe(
        1,
        'Expected 1 candidate got ' + chunk.candidates!.length,
      );
      i++;
      finalChunk = chunk;
    }
    expect(finalChunk?.usageMetadata!.candidatesTokenCount).toBeLessThanOrEqual(
      250, // sometimes backend returns a little more than 200 tokens
      'Expected candidatesTokenCount to be less than or equal to 250, got ' +
        finalChunk?.usageMetadata!.candidatesTokenCount,
    );
  });

  it('ML Dev should stream generate content with system instruction', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: GOOGLE_API_KEY});
    const response = await client.models.generateContentStream({
      model: 'gemini-1.5-flash',
      contents: 'high',
      config: {
        systemInstruction:
          'I say high you say low, and then tell me why is the sky blue.',
        candidateCount: 1,
        maxOutputTokens: 200,
      },
    });
    let i = 1;
    let finalChunk: GenerateContentResponse | undefined = undefined;
    console.info(
      'ML Dev should stream generate content with system instruction',
    );
    for await (const chunk of response) {
      console.info(`stream chunk ${i}`, chunk.text);
      expect(chunk.candidates!.length).toBe(
        1,
        'Expected 1 candidate got ' + chunk.candidates!.length,
      );
      i++;
      finalChunk = chunk;
    }
    expect(finalChunk?.usageMetadata!.candidatesTokenCount).toBeLessThanOrEqual(
      250, // sometimes backend returns a little more than 200 tokens
      'Expected candidatesTokenCount to be less than or equal to 250, got ' +
        finalChunk?.usageMetadata!.candidatesTokenCount,
    );
  });
});

describe('generateImages', () => {
  it('ML Dev should generate image with specified parameters', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: GOOGLE_API_KEY});
    const response = await client.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: 'Robot holding a red skateboard',
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        includeSafetyAttributes: true,
      },
    });
    expect(response?.generatedImages!.length).toBe(
      1,
      'Expected 1 generated image got ' + response?.generatedImages!.length,
    );
    expect(response?.generatedImages?.[0]?.image?.imageBytes).toEqual(
      jasmine.anything(),
      'Expected image bytes to be non-empty',
    );
    expect(response?.positivePromptSafetyAttributes).toEqual(
      jasmine.anything(),
      'Expected positive prompt safety attributes to be non-empty',
    );
  });
});

describe('test async performance', () => {
  beforeAll(function () {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 15000; // 15 seconds
  });
  it('generate content should complete in less than 10 seconds', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: GOOGLE_API_KEY});
    async function firstAsyncFunc() {
      client.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: 'high',
        config: {
          systemInstruction: 'I say high you say low.',
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 5000)); // artificially add 5 seconds delay
    }
    async function secondAsyncFunc() {
      client.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: 'high',
        config: {
          systemInstruction: 'I say high you say low.',
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 10000)); // artificially add 10 seconds timeout
    }
    const startTime = performance.now(); // Record start time
    try {
      await Promise.all([firstAsyncFunc(), secondAsyncFunc()]);
    } catch (e) {
      fail('Test failed due to error: ' + e);
    } finally {
      const endTime = performance.now(); // Record end time
      const timeDelta = endTime - startTime;
      expect(timeDelta).toBeLessThanOrEqual(
        10030,
        'Expected timeDelta to be less than or equal to 10030, got ' +
          timeDelta,
      );
    }
  });
  it('stream generate content should complete in less than 10 seconds', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: GOOGLE_API_KEY});
    async function firstAsyncFunc() {
      client.models.generateContentStream({
        model: 'gemini-1.5-flash',
        contents: 'high',
        config: {
          systemInstruction: 'I say high you say low.',
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 5000)); // artificially add 5 seconds delay
    }
    async function secondAsyncFunc() {
      client.models.generateContentStream({
        model: 'gemini-1.5-flash',
        contents: 'high',
        config: {
          systemInstruction: 'I say high you say low.',
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 10000)); // artificially add 10 seconds timeout
    }
    const startTime = performance.now(); // Record start time
    try {
      await Promise.all([firstAsyncFunc(), secondAsyncFunc()]);
    } catch (e) {
      fail('Test failed due to error: ' + e);
    } finally {
      const endTime = performance.now(); // Record end time
      const timeDelta = endTime - startTime;
      expect(timeDelta).toBeLessThanOrEqual(
        10050,
        'Expected timeDelta to be less than or equal to 10050, got ' +
          timeDelta,
      );
    }
  });
});

describe('test forward compatibility', () => {
  it('generate content should not return thought field', async () => {
    const client = new GoogleGenAI({
      vertexai: false,
      apiKey: GOOGLE_API_KEY,
      httpOptions: {apiVersion: 'v1alpha'},
    });
    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash-thinking-exp',
      contents: 'What is the sum of natural numbers from 1 to 100?',
      config: {
        maxOutputTokens: 20,
        candidateCount: 1,
        thinkingConfig: {includeThoughts: true},
      },
    });
    expect(JSON.stringify(response)).not.toContain(
      '"thought":true',
      'Expected response to not contain field "thought',
    );
  });
});

describe('countTokens', () => {
  it('ML Dev should count tokens with specified parameters', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: GOOGLE_API_KEY});

    const response = await client.models.countTokens({
      model: 'gemini-1.5-flash',
      contents: 'The quick brown fox jumps over the lazy dog.',
    });
    expect(response!.totalTokens ?? 0).toBeGreaterThan(
      0,
      'Expected totalTokens to be nonzero, got ' + response.totalTokens,
    );
    console.info(
      'ML Dev should count tokens with specified parameters\n',
      JSON.stringify(response),
    );
  });
});

describe('files', () => {
  it('ML Dev list files with specified parameters', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: GOOGLE_API_KEY});
    const response = await client.files.list({config: {'pageSize': 2}});
    expect(response!.pageLength ?? 0).toBeGreaterThan(
      0,
      'Expected at least one file has more than 2 pages, got ' +
        response!.pageLength,
    );
    console.info(
      'ML Dev should list files with specified parameters\n',
      JSON.stringify(response),
    );
  });
  it('ML Dev list files with pagers', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: GOOGLE_API_KEY});
    const pager = await client.files.list({config: {pageSize: 2}});
    let page = pager.page;
    for (const file of page) {
      console.log(file.name);
    }
    while (pager.hasNextPage()) {
      for (const file of page) {
        console.log(file.name);
      }
      page = await pager.nextPage();
    }

    expect(pager.pageLength).toBeGreaterThan(0);
  });
  it('ML Dev should fail when provided with a string file path', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: GOOGLE_API_KEY});
    // generate a temp file
    const filePath = await createZeroFilledTempFile(1024 * 1024 * 10);

    // upload the file
    try {
      await client.files.upload({
        file: filePath,
        config: {displayName: 'generate_file_test.txt'},
      });
    } catch (e) {
      expect((e as Error).message).toBe(
        'File path is not supported in browser uploader.',
      );
    }
  });
  it('ML Dev should upload the file from a Blob and get just uploaded file with specified parameters', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: GOOGLE_API_KEY});
    // generate a temp file
    const fileBlob = new Blob([new Uint8Array(1024 * 1024 * 30)], {
      type: 'text/plain',
    });

    // upload the file
    const file = await client.files.upload({
      file: fileBlob,
      config: {displayName: 'upload_blob_test.txt'},
    });
    expect(file.name?.startsWith('files/'))
      .withContext(`File name "${file.name}" should start with "files/"}`)
      .toBeTrue();

    // get the file just uploaded
    const getFile = await client.files.get({name: file.name as string});
    console.log('getFile', getFile);
    expect(getFile.name).toBe(file.name);
  });
});

describe('client initialization', () => {
  it('Vertex AI should fail since no API key provided', async () => {
    expect(
      () =>
        new GoogleGenAI({
          vertexai: true,
          project: GOOGLE_CLOUD_PROJECT,
          location: GOOGLE_CLOUD_LOCATION,
        }),
    ).toThrowError('An API Key must be set when running in a browser');
  });
});



================================================
FILE: test/unit/api_client_test.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {Readable} from 'stream';

import {ApiClient} from '../../src/_api_client';
import {CrossUploader} from '../../src/cross/_cross_uploader';
import * as types from '../../src/types';
import {FakeAuth} from '../_fake_auth';

const fetchOkOptions = {
  status: 200,
  statusText: 'OK',
  ok: true,
  headers: {'Content-Type': 'application/json'},
  url: 'some-url',
};

const fetch500Options = {
  status: 500,
  statusText: 'Internal Server Error',
  ok: false,
  headers: {'Content-Type': 'application/json'},
  url: 'some-url',
};

const fetch400Options = {
  status: 400,
  statusText: 'Bad Request',
  ok: false,
  headers: {'Content-Type': 'application/json'},
  url: 'some-url',
};

const mockGenerateContentResponse: types.GenerateContentResponse =
  Object.setPrototypeOf(
    {
      candidates: [
        {
          content: {
            parts: [
              {
                text: 'The',
              },
            ],
            role: 'model',
          },
          finishReason: types.FinishReason.STOP,
          index: 0,
        },
      ],
      usageMetadata: {
        promptTokenCount: 8,
        candidatesTokenCount: 1,
        totalTokenCount: 9,
      },
    },
    types.GenerateContentResponse.prototype,
  );

describe('processStreamResponse', () => {
  const apiClient = new ApiClient({
    auth: new FakeAuth(),
    uploader: new CrossUploader(),
  });

  it('should throw an error if the chunk does not start with the data prefix', async () => {
    const invalidChunk = 'invalid chunk';
    const stream = new Readable();
    stream.push(invalidChunk);
    stream.push(null); // signal end of stream
    const readableStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => controller.enqueue(chunk));
        stream.on('end', () => controller.close());
        stream.on('error', (err) => controller.error(err));
      },
    });
    const response = new Response(readableStream);

    const generator = apiClient.processStreamResponse(response);

    await expectAsync(generator.next()).toBeRejectedWithError(
      'Incomplete JSON segment at the end',
    );
  });

  it('should throw an error if the chunk cannot be parsed as JSON', async () => {
    const invalidChunk = 'data: invalid chunk';
    const stream = new Readable();
    stream.push(invalidChunk);
    stream.push(null); // signal end of stream
    const readableStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => controller.enqueue(chunk));
        stream.on('end', () => controller.close());
        stream.on('error', (err) => controller.error(err));
      },
    });
    const response = new Response(readableStream);

    const generator = apiClient.processStreamResponse(response);

    await expectAsync(generator.next()).toBeRejectedWithError(
      'Incomplete JSON segment at the end',
    );
  });

  it('should throw an error if encountering an error while parsing the chunk', async () => {
    const validChunk =
      'data: {"candidates": [{"content": {"parts": [{"text": "The"}],"role": "model"},"finishReason": "STOP","index": 0}],"usageMetadata": {"promptTokenCount": 8,"candidatesTokenCount": 1,"totalTokenCount": 9}}\n\n';
    const invalidChunk =
      '{"error": {"code": 500, "message": "Internal error", "status": "INTERNAL"}}';
    const stream = new Readable();
    stream.push(validChunk);
    stream.push(invalidChunk);
    stream.push(null); // signal end of stream
    const readableStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => controller.enqueue(chunk));
        stream.on('end', () => controller.close());
        stream.on('error', (err) => controller.error(err));
      },
    });
    const response = new Response(readableStream);

    const expectedResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: 'The',
              },
            ],
            role: 'model',
          },
          finishReason: 'STOP' as types.FinishReason,
          index: 0,
        },
      ],
      usageMetadata: {
        promptTokenCount: 8,
        candidatesTokenCount: 1,
        totalTokenCount: 9,
      },
    };
    const generator = apiClient.processStreamResponse(response);
    const resultHttpResponse = await generator.next();
    const result = await resultHttpResponse.value.json();
    expect(result).toEqual(expectedResponse);

    await expectAsync(generator.next()).toBeRejectedWithError(
      'got status: INTERNAL. {"error":{"code":500,"message":"Internal error","status":"INTERNAL"}}',
    );
  });

  it('should yield the json chunk data', async () => {
    const validChunk1 =
      'data: {"candidates": [{"content": {"parts": [{"text": "The"}],"role": "model"},"finishReason": "STOP","index": 0}],"usageMetadata": {"promptTokenCount": 8,"candidatesTokenCount": 1,"totalTokenCount": 9}}\n\n';
    const validChunk2 =
      'data: {"candidates": [{"content": {"parts": [{"text": "The"}],"role": "model"},"finishReason": "STOP","index": 0}],"usageMetadata": {"promptTokenCount": 8,"candidatesTokenCount": 1,"totalTokenCount": 9}}\r\r';
    const validChunk3 =
      'data: {"candidates": [{"content": {"parts": [{"text": "The"}],"role": "model"},"finishReason": "STOP","index": 0}],"usageMetadata": {"promptTokenCount": 8,"candidatesTokenCount": 1,"totalTokenCount": 9}}\r\n\r\n';
    const validChunks = [validChunk1, validChunk2, validChunk3];
    for (const validChunk of validChunks) {
      const stream = new Readable();
      stream.push(validChunk);
      stream.push(null); // signal end of stream
      const readableStream = new ReadableStream({
        start(controller) {
          stream.on('data', (chunk) => controller.enqueue(chunk));
          stream.on('end', () => controller.close());
          stream.on('error', (err) => controller.error(err));
        },
      });
      const response = new Response(readableStream);
      const expectedResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: 'The',
                },
              ],
              role: 'model',
            },
            finishReason: 'STOP' as types.FinishReason,
            index: 0,
          },
        ],
        usageMetadata: {
          promptTokenCount: 8,
          candidatesTokenCount: 1,
          totalTokenCount: 9,
        },
      };
      const generator = apiClient.processStreamResponse(response);
      const resultHttpResponse = await generator.next();
      const result = await resultHttpResponse.value.json();
      expect(result).toEqual(expectedResponse);
    }
  });

  it('should yield all expected chunks', async () => {
    const chunk1 =
      'data: {"candidates": [{"content": {"parts": [{"text": "One"}],"role": "model"},"finishReason": "STOP","index": 0}],"usageMetadata": {"promptTokenCount": 8,"candidatesTokenCount": 1,"totalTokenCount": 9}}\n\n';
    const chunk2 =
      'data: {"candidates": [{"content": {"parts": [{"text": "Two"}],"role": "model"},"finishReason": "STOP","index": 0}],"usageMetadata": {"promptTokenCount": 8,"candidatesTokenCount": 1,"totalTokenCount": 9}}\r\r';
    const chunk3 =
      'data: {"candidates": [{"content": {"parts": [{"text": "Three"}],"role": "model"},"finishReason": "STOP","index": 0}],"usageMetadata": {"promptTokenCount": 8,"candidatesTokenCount": 1,"totalTokenCount": 9}}\r\n\r\n';
    const chunks = [chunk1, chunk2, chunk3];
    const stream = new Readable();
    for (const chunk of chunks) {
      stream.push(chunk);
    }
    stream.push(null); // signal end of stream
    const readableStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => controller.enqueue(chunk));
        stream.on('end', () => controller.close());
        stream.on('error', (err) => controller.error(err));
      },
    });
    const response = new Response(readableStream);

    const streamResponse = await apiClient.processStreamResponse(response);

    let count = 0;
    const expectedText = ['One', 'Two', 'Three'];
    for await (const jsonChunk of streamResponse) {
      const typedChunk = new types.GenerateContentResponse();
      const jsonChunkData = await jsonChunk.json();
      Object.assign(typedChunk, jsonChunkData);
      expect(typedChunk.text).toEqual(expectedText[count]);
      count++;
    }
    expect(count).toEqual(3);
  });

  it('should yield valid json split into multiple chunk data', async () => {
    const validChunk1 =
      'data: {"candidates": [{"content": {"parts": [{"text": "The"}],"role": "model"},"finishReason": "STOP","index": 0}],';
    const validChunk2 =
      '"usageMetadata": {"promptTokenCount": 8,"candidatesTokenCount": 1,"totalTokenCount": 9}}\n\n';
    const stream = new Readable();
    stream.push(validChunk1);
    stream.push(validChunk2);
    stream.push(null); // signal end of stream
    const readableStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => controller.enqueue(chunk));
        stream.on('end', () => controller.close());
        stream.on('error', (err) => controller.error(err));
      },
    });
    const response = new Response(readableStream);
    const expectedResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: 'The',
              },
            ],
            role: 'model',
          },
          finishReason: types.FinishReason.STOP,
          index: 0,
        },
      ],
      usageMetadata: {
        promptTokenCount: 8,
        candidatesTokenCount: 1,
        totalTokenCount: 9,
      },
    };
    const generator = apiClient.processStreamResponse(response);
    const resultHttpResponse = await generator.next();
    const result = await resultHttpResponse.value.json();
    expect(result).toEqual(expectedResponse);
  });
});

describe('ApiClient', () => {
  describe('constructor', () => {
    it('should initialize with provided values', () => {
      const client = new ApiClient({
        auth: new FakeAuth(),
        project: 'project-from-opts',
        location: 'location-from-opts',
        apiKey: 'apikey-from-opts',
        vertexai: false,
        apiVersion: 'v1beta',
        uploader: new CrossUploader(),
      });

      expect(client.isVertexAI()).toBe(false);
      expect(client.getProject()).toBe('project-from-opts');
      expect(client.getLocation()).toBe('location-from-opts');
      expect(client.getApiKey()).toBe('apikey-from-opts');
      expect(client.getRequestUrl()).toBe(
        'https://generativelanguage.googleapis.com/v1beta',
      );
      expect(client.getApiVersion()).toBe('v1beta');
    });

    it('should initialize with Vertex AI if specified', () => {
      const client = new ApiClient({
        auth: new FakeAuth(),
        project: 'vertex-project',
        location: 'vertex-location',
        vertexai: true,
        apiVersion: 'v1beta1',
        apiKey: 'apikey-from-opts',
        uploader: new CrossUploader(),
      });

      expect(client.isVertexAI()).toBe(true);
      expect(client.getProject()).toBe('vertex-project');
      expect(client.getLocation()).toBe('vertex-location');
      expect(client.getApiKey()).toBeUndefined(); // API key is ignored when setting opts.vertexai
      expect(client.getRequestUrl()).toBe(
        'https://vertex-location-aiplatform.googleapis.com/v1beta1',
      );
      expect(client.getApiVersion()).toBe('v1beta1');
    });

    it('should not have api key if project/location is provided for vertexai', () => {
      const client = new ApiClient({
        auth: new FakeAuth(),
        project: 'vertex-project',
        location: 'vertex-location',
        vertexai: true,
        apiVersion: 'v1beta1',
        apiKey: 'apikey-from-opts',
        uploader: new CrossUploader(),
      });
      expect(client.isVertexAI()).toBe(true);
      expect(client.getProject()).toBe('vertex-project');
      expect(client.getLocation()).toBe('vertex-location');
      expect(client.getApiKey()).toBeUndefined();
      expect(client.getRequestUrl()).toBe(
        'https://vertex-location-aiplatform.googleapis.com/v1beta1',
      );
      expect(client.getApiVersion()).toBe('v1beta1');
    });
    it('should use default value if not provided', () => {
      const client = new ApiClient({
        auth: new FakeAuth(),
        project: 'env-project',
        uploader: new CrossUploader(),
      });
      // baseUrl is based on apiVersion
      expect(client.getRequestUrl()).toContain('/v1');
      expect(client.isVertexAI()).toBeFalse();
    });

    it('should set websocket protocol to ws when base URL is http', () => {
      const client = new ApiClient({
        auth: new FakeAuth(),
        project: 'project-from-opts',
        location: 'location-from-opts',
        apiKey: 'apikey-from-opts',
        vertexai: false,
        apiVersion: 'v1beta',
        httpOptions: {
          baseUrl: 'http://custom-base-url.googleapis.com',
        },
        uploader: new CrossUploader(),
      });

      expect(client.getWebsocketBaseUrl()).toBe(
        'ws://custom-base-url.googleapis.com/',
      );
    });

    it('should set websocket protocol to wss when base URL is https', () => {
      const client = new ApiClient({
        auth: new FakeAuth(),
        project: 'project-from-opts',
        location: 'location-from-opts',
        apiKey: 'apikey-from-opts',
        vertexai: false,
        apiVersion: 'v1beta',
        httpOptions: {
          baseUrl: 'https://custom-base-url.googleapis.com',
        },
        uploader: new CrossUploader(),
      });

      expect(client.getWebsocketBaseUrl()).toBe(
        'wss://custom-base-url.googleapis.com/',
      );
    });

    it('should override base URL with provided values', () => {
      const client = new ApiClient({
        auth: new FakeAuth(),
        project: 'project-from-opts',
        location: 'location-from-opts',
        apiKey: 'apikey-from-opts',
        vertexai: false,
        apiVersion: 'v1beta',
        httpOptions: {
          baseUrl: 'https://custom-base-url.googleapis.com',
        },
        uploader: new CrossUploader(),
      });

      expect(client.isVertexAI()).toBe(false);
      expect(client.getProject()).toBe('project-from-opts');
      expect(client.getLocation()).toBe('location-from-opts');
      expect(client.getApiKey()).toBe('apikey-from-opts');
      expect(client.getRequestUrl()).toBe(
        'https://custom-base-url.googleapis.com/v1beta',
      );
      expect(client.getWebsocketBaseUrl()).toBe(
        'wss://custom-base-url.googleapis.com/',
      );
      expect(client.getApiVersion()).toBe('v1beta');
    });

    it('should override API version with provided values', () => {
      const client = new ApiClient({
        auth: new FakeAuth(),
        project: 'project-from-opts',
        location: 'location-from-opts',
        apiKey: 'apikey-from-opts',
        vertexai: false,
        apiVersion: 'v1beta',
        httpOptions: {
          apiVersion: 'v1',
        },
        uploader: new CrossUploader(),
      });

      expect(client.isVertexAI()).toBe(false);
      expect(client.getProject()).toBe('project-from-opts');
      expect(client.getLocation()).toBe('location-from-opts');
      expect(client.getApiKey()).toBe('apikey-from-opts');
      expect(client.getRequestUrl()).toBe(
        'https://generativelanguage.googleapis.com/v1',
      );
      expect(client.getWebsocketBaseUrl()).toBe(
        'wss://generativelanguage.googleapis.com/',
      );
      expect(client.getApiVersion()).toBe('v1');
    });

    it('should return default HTTP headers', () => {
      const client = new ApiClient({
        auth: new FakeAuth(),
        project: 'vertex-project',
        location: 'vertex-location',
        vertexai: true,
        apiVersion: 'v1beta1',
        uploader: new CrossUploader(),
      });

      expect(client.isVertexAI()).toBe(true);
      expect(client.getProject()).toBe('vertex-project');
      expect(client.getLocation()).toBe('vertex-location');
      expect(client.getApiKey()).toBeUndefined(); // API key is ignored when setting opts.vertexai
      expect(client.getRequestUrl()).toBe(
        'https://vertex-location-aiplatform.googleapis.com/v1beta1',
      );
      const headers = client.getHeaders();
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['User-Agent']).toContain('google-genai-sdk/');
      expect(headers['x-goog-api-client']).toContain('google-genai-sdk/');
      expect(client.getApiVersion()).toBe('v1beta1');
    });

    it('should append HTTP headers with duplicate keys', () => {
      const httpOptions: types.HttpOptions = {
        headers: {
          'google-custom-header': 'custom-value',
          'Content-Type': 'text/plain',
        },
      };

      const client = new ApiClient({
        auth: new FakeAuth(),
        project: 'project-from-opts',
        location: 'location-from-opts',
        vertexai: false,
        apiVersion: 'v1beta',
        httpOptions: httpOptions,
        uploader: new CrossUploader(),
      });

      expect(client.isVertexAI()).toBe(false);
      expect(client.getProject()).toBe('project-from-opts');
      expect(client.getLocation()).toBe('location-from-opts');
      expect(client.getRequestUrl()).toBe(
        'https://generativelanguage.googleapis.com/v1beta',
      );
      const headers = client.getHeaders();
      expect(headers['Content-Type']).toBe('text/plain');
      expect(headers['User-Agent']).toContain('google-genai-sdk/');
      expect(headers['x-goog-api-client']).toContain('google-genai-sdk/');
      expect(headers['google-custom-header']).toBe('custom-value');
      expect(client.getApiVersion()).toBe('v1beta');
    });

    it('should append default HTTP headers with provided values MLDev', () => {
      const httpOptions: types.HttpOptions = {
        headers: {
          'x-goog-api-key': 'apikey-from-user',
        },
      };

      const client = new ApiClient({
        auth: new FakeAuth(),
        project: 'project-from-opts',
        location: 'location-from-opts',
        apiKey: 'apikey-from-opts',
        vertexai: false,
        apiVersion: 'v1beta',
        httpOptions: httpOptions,
        uploader: new CrossUploader(),
      });

      expect(client.isVertexAI()).toBe(false);
      expect(client.getProject()).toBe('project-from-opts');
      expect(client.getLocation()).toBe('location-from-opts');
      expect(client.getApiKey()).toBe('apikey-from-opts');
      expect(client.getRequestUrl()).toBe(
        'https://generativelanguage.googleapis.com/v1beta',
      );
      const headers = client.getHeaders();
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['x-goog-api-key']).toBe('apikey-from-user');
      expect(headers['User-Agent']).toContain('google-genai-sdk/');
      expect(headers['x-goog-api-client']).toContain('google-genai-sdk/');
      expect(client.getApiVersion()).toBe('v1beta');
    });

    it('should append default HTTP headers with provided values Vertex', () => {
      const httpOptions: types.HttpOptions = {
        headers: {
          Authorization: 'User Token',
        },
      };

      const client = new ApiClient({
        auth: new FakeAuth(),
        project: 'vertex-project',
        location: 'vertex-location',
        vertexai: true,
        apiVersion: 'v1beta1',
        httpOptions: httpOptions,
        uploader: new CrossUploader(),
      });

      expect(client.isVertexAI()).toBe(true);
      expect(client.getProject()).toBe('vertex-project');
      expect(client.getLocation()).toBe('vertex-location');
      expect(client.getApiKey()).toBeUndefined(); // API key is ignored when setting opts.vertexai
      expect(client.getRequestUrl()).toBe(
        'https://vertex-location-aiplatform.googleapis.com/v1beta1',
      );
      const headers = client.getHeaders();
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['Authorization']).toBe('User Token');
      expect(headers['User-Agent']).toContain('google-genai-sdk/');
      expect(headers['x-goog-api-client']).toContain('google-genai-sdk/');
      expect(client.getApiVersion()).toBe('v1beta1');
    });
  });

  describe('post/get methods', () => {
    it('should prepend base resource path if vertexai is true and path does not start with "projects/"', async () => {
      const client = new ApiClient({
        auth: new FakeAuth(),
        vertexai: true,
        uploader: new CrossUploader(),
      });
      spyOn(client, 'getBaseResourcePath').and.returnValue(
        'base-resource-path',
      );
      spyOn(global, 'fetch').and.returnValue(
        Promise.resolve(
          new Response(
            JSON.stringify(mockGenerateContentResponse),
            fetchOkOptions,
          ),
        ),
      );
      await client.request({
        path: 'test-path',
        body: JSON.stringify({data: 'test'}),
        httpMethod: 'POST',
      });
      expect(client.getBaseResourcePath).toHaveBeenCalled();
    });
    it('should append query parameters to URL', async () => {
      const client = new ApiClient({
        auth: new FakeAuth('test-api-key'),
        apiKey: 'test-api-key',
        uploader: new CrossUploader(),
      });
      const queryParams: Record<string, string> = {
        'param1': 'value1',
        'param2': 'value2',
      };
      spyOn(global, 'fetch').and.returnValue(
        Promise.resolve(
          new Response(
            JSON.stringify(mockGenerateContentResponse),
            fetchOkOptions,
          ),
        ),
      );
      await client.request({
        path: 'test-path',
        queryParams: queryParams,
        httpMethod: 'GET',
      });
      expect(global.fetch).toHaveBeenCalledWith(
        jasmine.stringMatching(/param1=value1&param2=value2/),
        jasmine.any(Object),
      );
    });
    it('should throw an error if request body is not empty for GET request', async () => {
      const client = new ApiClient({
        auth: new FakeAuth('test-api-key'),
        apiKey: 'test-api-key',
        uploader: new CrossUploader(),
      });
      await client
        .request({
          path: 'test-path',
          body: JSON.stringify({data: 'test'}),
          httpMethod: 'GET',
        })
        .catch((e) => {
          expect(e.message).toEqual(
            'Request body should be empty for GET request, but got non empty request body',
          );
        });
    });
    it('should include AbortSignal when timeout is set', async () => {
      const client = new ApiClient({
        auth: new FakeAuth('test-api-key'),
        apiKey: 'test-api-key',
        httpOptions: {timeout: 1000},
        uploader: new CrossUploader(),
      });
      const fetchSpy = spyOn(global, 'fetch').and.returnValue(
        Promise.resolve(
          new Response(
            JSON.stringify(mockGenerateContentResponse),
            fetchOkOptions,
          ),
        ),
      );
      await client.request({path: 'test-path', httpMethod: 'POST'});
      const fetchArgs = fetchSpy.calls.allArgs();
      // @ts-expect-error TS2532: Object is possibly 'undefined'.
      expect(fetchArgs[0][1].signal instanceof AbortSignal).toBeTrue();
      // @ts-expect-error TS2532: Object is possibly 'undefined'.
      expect(fetchArgs[0][1].signal.aborted).toBeFalse();
    });
    it('should include AbortSignal when AbortSignal is set from request', async () => {
      const externalAbortController = new AbortController();
      const client = new ApiClient({
        auth: new FakeAuth('test-api-key'),
        apiKey: 'test-api-key',
        uploader: new CrossUploader(),
      });
      const fetchSpy = spyOn(global, 'fetch').and.returnValue(
        Promise.resolve(
          new Response(
            JSON.stringify(mockGenerateContentResponse),
            fetchOkOptions,
          ),
        ),
      );
      await client.request({
        path: 'test-path',
        httpMethod: 'POST',
        abortSignal: externalAbortController.signal,
      });

      externalAbortController.abort();

      const fetchArgs = fetchSpy.calls.allArgs();
      // @ts-expect-error TS2532: Object is possibly 'undefined'.
      expect(fetchArgs[0][1].signal instanceof AbortSignal).toBeTrue();
      // @ts-expect-error TS2532: Object is possibly 'undefined'.
      expect(fetchArgs[0][1].signal.aborted).toBeTrue();
    });
    it('should apply requestHttpOptions when provided', async () => {
      const client = new ApiClient({
        auth: new FakeAuth('test-api-key'),
        apiKey: 'test-api-key',
        uploader: new CrossUploader(),
      });
      const queryParams: Record<string, string> = {
        'param1': 'value1',
        'param2': 'value2',
      };
      const fetchSpy = spyOn(global, 'fetch').and.returnValue(
        Promise.resolve(
          new Response(
            JSON.stringify(mockGenerateContentResponse),
            fetchOkOptions,
          ),
        ),
      );
      const timeoutSpy = spyOn(global, 'setTimeout');

      await client.request({
        path: 'test-path',
        queryParams: queryParams,
        httpMethod: 'GET',
        httpOptions: {
          baseUrl: 'https://custom-request-base-url.googleapis.com',
          apiVersion: 'v1alpha',
          timeout: 1001,
          headers: {'google-custom-header': 'custom-header-value'},
        },
      });

      const fetchArgs = fetchSpy.calls.first().args;
      const requestInit = fetchArgs[1] as RequestInit;
      const headers = requestInit.headers as Headers;
      const timeoutArgs = timeoutSpy.calls.first().args;
      expect(headers.get('Content-Type')).toBe('application/json');
      expect(headers.get('x-goog-api-key')).toBe('test-api-key');
      expect(headers.get('User-Agent')).toContain('google-genai-sdk/');
      expect(headers.get('x-goog-api-client')).toContain('google-genai-sdk/');
      expect(headers.get('google-custom-header')).toBe('custom-header-value');
      expect(timeoutArgs[1]).toEqual(1001);
      expect(headers.get('X-Server-Timeout')).toBe('2'); // Rounds up to 2s.
      expect(fetchArgs[0]).toEqual(
        'https://custom-request-base-url.googleapis.com/v1alpha/test-path?param1=value1&param2=value2',
      );
    });
    it('should set bearer token for vertexai', async () => {
      const client = new ApiClient({
        auth: new FakeAuth(),
        apiKey: 'test-api-key',
        vertexai: true,
        uploader: new CrossUploader(),
      });
      const queryParams: Record<string, string> = {
        'param1': 'value1',
        'param2': 'value2',
      };
      const fetchSpy = spyOn(global, 'fetch').and.returnValue(
        Promise.resolve(
          new Response(
            JSON.stringify(mockGenerateContentResponse),
            fetchOkOptions,
          ),
        ),
      );

      await client.request({
        path: 'test-path',
        queryParams: queryParams,
        httpMethod: 'GET',
      });

      const fetchArgs = fetchSpy.calls.first().args;
      const requestInit = fetchArgs[1] as RequestInit;
      const headers = requestInit.headers as Headers;
      expect(headers.get('Content-Type')).toBe('application/json');
      expect(headers.get('Authorization')).toBe('Bearer token');
      expect(headers.get('User-Agent')).toContain('google-genai-sdk/');
      expect(headers.get('x-goog-api-client')).toContain('google-genai-sdk/');
    });
    it('should merge request http options and client http options', async () => {
      const client = new ApiClient({
        auth: new FakeAuth('test-api-key'),
        apiKey: 'test-api-key',
        httpOptions: {
          baseUrl: 'https://custom-client-base-url.googleapis.com',
        },
        uploader: new CrossUploader(),
      });
      const queryParams: Record<string, string> = {
        'param1': 'value1',
        'param2': 'value2',
      };
      const fetchSpy = spyOn(global, 'fetch').and.returnValue(
        Promise.resolve(
          new Response(
            JSON.stringify(mockGenerateContentResponse),
            fetchOkOptions,
          ),
        ),
      );
      const timeoutSpy = spyOn(global, 'setTimeout');

      await client.request({
        path: 'test-path',
        queryParams: queryParams,
        httpMethod: 'GET',
        httpOptions: {
          headers: {'google-custom-header': 'custom-header-value'},
          timeout: 1001,
          apiVersion: 'v1alpha',
        },
      });

      const fetchArgs = fetchSpy.calls.first().args;
      const requestInit = fetchArgs[1] as RequestInit;
      const headers = requestInit.headers as Headers;
      expect(headers.get('Content-Type')).toBe('application/json');
      expect(headers.get('x-goog-api-key')).toBe('test-api-key');
      expect(headers.get('User-Agent')).toContain('google-genai-sdk/');
      expect(headers.get('x-goog-api-client')).toContain('google-genai-sdk/');
      expect(headers.get('google-custom-header')).toBe('custom-header-value');
      const timeoutArgs = timeoutSpy.calls.first().args;
      expect(timeoutArgs[1]).toEqual(1001);
      expect(fetchArgs[0]).toEqual(
        'https://custom-client-base-url.googleapis.com/v1alpha/test-path?param1=value1&param2=value2',
      );
    });
    it('should not override the client http options permanently', async () => {
      const client = new ApiClient({
        auth: new FakeAuth('test-api-key'),
        apiKey: 'test-api-key',
        httpOptions: {
          baseUrl: 'https://custom-client-base-url.googleapis.com',
          apiVersion: 'v1beta1',
          timeout: 1000,
          headers: {'google-custom-header': 'custom-header-value'},
        },
        uploader: new CrossUploader(),
      });
      const queryParams: Record<string, string> = {
        'param1': 'value1',
        'param2': 'value2',
      };
      const fetchSpy = spyOn(global, 'fetch').and.returnValues(
        Promise.resolve(
          new Response(
            JSON.stringify(mockGenerateContentResponse),
            fetchOkOptions,
          ),
        ),
        Promise.resolve(
          new Response(
            JSON.stringify(mockGenerateContentResponse),
            fetchOkOptions,
          ),
        ),
      );
      const timeoutSpy = spyOn(global, 'setTimeout');

      await client.request({
        path: 'test-path',
        queryParams: queryParams,
        httpOptions: {
          baseUrl: 'https://custom-request-base-url.googleapis.com',
          apiVersion: 'v1alpha',
          timeout: 1002,
          headers: {'google-custom-header': 'custom-header-request-value'},
        },
        httpMethod: 'GET',
      });

      const fetchArgs = fetchSpy.calls.mostRecent().args;
      const requestInit = fetchArgs[1] as RequestInit;
      const headers = requestInit.headers as Headers;
      expect(headers.get('Content-Type')).toBe('application/json');
      expect(headers.get('x-goog-api-key')).toBe('test-api-key');
      expect(headers.get('User-Agent')).toContain('google-genai-sdk/');
      expect(headers.get('x-goog-api-client')).toContain('google-genai-sdk/');
      expect(headers.get('google-custom-header')).toBe(
        'custom-header-request-value',
      );
      const timeoutArgs = timeoutSpy.calls.mostRecent().args;
      expect(timeoutArgs[1]).toEqual(1002);
      expect(fetchArgs[0]).toEqual(
        'https://custom-request-base-url.googleapis.com/v1alpha/test-path?param1=value1&param2=value2',
      );

      await client.request({
        path: 'test-path',
        queryParams: queryParams,
        httpMethod: 'GET',
      });

      const secondFetchArgs = fetchSpy.calls.mostRecent().args;
      const secondRequestInit = fetchArgs[1] as RequestInit;
      const secondHeaders = secondRequestInit.headers as Headers;
      expect(secondHeaders.get('Content-Type')).toBe('application/json');
      expect(secondHeaders.get('x-goog-api-key')).toBe('test-api-key');
      expect(secondHeaders.get('User-Agent')).toContain('google-genai-sdk/');
      expect(secondHeaders.get('x-goog-api-client')).toContain(
        'google-genai-sdk/',
      );
      expect(secondHeaders.get('google-custom-header')).toBe(
        'custom-header-request-value',
      );
      const secondTimeoutArgs = timeoutSpy.calls.mostRecent().args;
      expect(secondTimeoutArgs[1]).toEqual(1000);
      expect(secondFetchArgs[0]).toEqual(
        'https://custom-client-base-url.googleapis.com/v1beta1/test-path?param1=value1&param2=value2',
      );
    });
    it('should use baseUrl and path correctly when apiVersion is set to empty string', async () => {
      const client = new ApiClient({
        auth: new FakeAuth('test-api-key'),
        apiKey: 'test-api-key',
        httpOptions: {
          baseUrl: 'https://custom-client-base-url.googleapis.com',
        },
        uploader: new CrossUploader(),
      });

      spyOn(global, 'fetch').and.returnValue(
        Promise.resolve(
          new Response(
            JSON.stringify(mockGenerateContentResponse),
            fetchOkOptions,
          ),
        ),
      );
      const json = {data: 'test'};
      await client.request({
        path: 'test-path/shouldBeUsedVersion',
        body: JSON.stringify(json),
        httpOptions: {
          apiVersion: '',
          headers: {'google-custom-header': 'custom-header-request-value'},
        },
        httpMethod: 'POST',
      });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://custom-client-base-url.googleapis.com/test-path/shouldBeUsedVersion',
        jasmine.any(Object),
      );
    });
    it('should use baseUrl and path correctly when apiVersion is set to empty string and baseUrl ends with a slash', async () => {
      const client = new ApiClient({
        auth: new FakeAuth('test-api-key'),
        apiKey: 'test-api-key',
        httpOptions: {
          baseUrl: 'https://custom-client-base-url.googleapis.com/',
        },
        uploader: new CrossUploader(),
      });

      spyOn(global, 'fetch').and.returnValue(
        Promise.resolve(
          new Response(
            JSON.stringify(mockGenerateContentResponse),
            fetchOkOptions,
          ),
        ),
      );
      const json = {data: 'test'};
      await client.request({
        path: 'test-path/shouldBeUsedVersion',
        body: JSON.stringify(json),
        httpOptions: {
          apiVersion: '',
          headers: {'google-custom-header': 'custom-header-request-value'},
        },
        httpMethod: 'POST',
      });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://custom-client-base-url.googleapis.com/test-path/shouldBeUsedVersion',
        jasmine.any(Object),
      );
    });
    it('should use baseUrl when path and apiVersion are both set to empty string in the request http options', async () => {
      const client = new ApiClient({
        auth: new FakeAuth('test-api-key'),
        apiKey: 'test-api-key',
        httpOptions: {
          baseUrl: 'https://custom-client-base-url.googleapis.com',
        },
        uploader: new CrossUploader(),
      });

      spyOn(global, 'fetch').and.returnValue(
        Promise.resolve(
          new Response(
            JSON.stringify(mockGenerateContentResponse),
            fetchOkOptions,
          ),
        ),
      );
      await client.request({
        path: '',
        body: 'test-content-string',
        httpOptions: {
          apiVersion: '',
          baseUrl:
            'https://custom-client-base-url-set-in-request-path.googleapis.com/test-path/shouldBeUsedVersion',
          headers: {'google-custom-header': 'custom-header-request-value'},
        },
        httpMethod: 'POST',
      });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://custom-client-base-url-set-in-request-path.googleapis.com/test-path/shouldBeUsedVersion',
        jasmine.any(Object),
      );
    });
    it('should consutruct correct url when path, baseUrl and apiVersion are set.', async () => {
      const client = new ApiClient({
        auth: new FakeAuth('test-api-key'),
        apiKey: 'test-api-key',
        httpOptions: {
          baseUrl:
            'https://custom-client-base-url-set-in-client-options.googleapis.com',
        },
        uploader: new CrossUploader(),
      });

      spyOn(global, 'fetch').and.returnValue(
        Promise.resolve(
          new Response(
            JSON.stringify(mockGenerateContentResponse),
            fetchOkOptions,
          ),
        ),
      );
      await client.request({
        path: 'custom-correct-path',
        body: 'test-content-string',
        httpOptions: {
          apiVersion: 'custom-correct-version',
          baseUrl:
            'https://custom-client-base-url-set-in-request.googleapis.com',
          headers: {'google-custom-header': 'custom-header-request-value'},
        },
        httpMethod: 'POST',
      });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://custom-client-base-url-set-in-request.googleapis.com/custom-correct-version/custom-correct-path',
        jasmine.any(Object),
      );
    });
    it('should return HttpResponse with proper headers', async () => {
      const client = new ApiClient({
        auth: new FakeAuth('test-api-key'),
        apiKey: 'test-api-key',
        httpOptions: {
          baseUrl: 'https://custom-client-base-url.googleapis.com',
        },
        uploader: new CrossUploader(),
      });
      const customHeaders = {
        'content-type': 'application/json',
        'x-custom-header': 'custom-value',
      };
      const customResponse = new Response(
        JSON.stringify(mockGenerateContentResponse),
        {
          status: 200,
          statusText: 'OK',
          headers: customHeaders,
        },
      );
      spyOn(global, 'fetch').and.returnValue(Promise.resolve(customResponse));

      const postResponse = await client.request({
        path: 'test-path',
        httpMethod: 'GET',
      });

      expect(postResponse instanceof types.HttpResponse).toBeTrue();
      expect(postResponse.headers).toEqual(customHeaders);
      expect(postResponse.headers?.['x-custom-header']).toBe('custom-value');
    });
  });
  it('should construct correct URL for public API calls', async () => {
    const client = new ApiClient({
      auth: new FakeAuth('test-api-key'),
      apiKey: 'test-api-key',
      httpOptions: {
        baseUrl: 'https://custom-client-base-url.googleapis.com',
      },
      uploader: new CrossUploader(),
    });

    spyOn(global, 'fetch').and.returnValue(
      Promise.resolve(
        new Response(
          JSON.stringify(mockGenerateContentResponse),
          fetchOkOptions,
        ),
      ),
    );

    const testPath = 'test-public-api-path';
    const apiVersion = 'v1';
    await client.request({
      path: testPath,
      httpMethod: 'GET',
      httpOptions: {
        apiVersion: apiVersion,
      },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `https://custom-client-base-url.googleapis.com/${apiVersion}/${testPath}`,
      jasmine.any(Object),
    );
  });
  it('should not prepend project/location to path if path already contains it for requestStream', async () => {
    const client = new ApiClient({
      auth: new FakeAuth(),
      vertexai: true,
      project: 'test-project',
      location: 'test-location',
      uploader: new CrossUploader(),
    });
    const fetchSpy = spyOn(global, 'fetch').and.returnValue(
      Promise.resolve(
        new Response(
          JSON.stringify(mockGenerateContentResponse),
          fetchOkOptions,
        ),
      ),
    );
    await client.requestStream({
      path: 'projects/test-project/locations/test-location/test-path',
      httpMethod: 'POST',
    });
    const fetchArgs = fetchSpy.calls.first().args;
    expect(fetchArgs[0]).toBe(
      'https://test-location-aiplatform.googleapis.com/v1beta1/projects/test-project/locations/test-location/test-path?alt=sse',
    );
  });
  it('should not prepend project/location to path if path already contains it for request', async () => {
    const client = new ApiClient({
      auth: new FakeAuth(),
      vertexai: true,
      project: 'test-project',
      location: 'test-location',
      uploader: new CrossUploader(),
    });
    const fetchSpy = spyOn(global, 'fetch').and.returnValue(
      Promise.resolve(
        new Response(
          JSON.stringify(mockGenerateContentResponse),
          fetchOkOptions,
        ),
      ),
    );
    await client.request({
      path: 'projects/test-project/locations/test-location/test-path',
      httpMethod: 'POST',
    });
    const fetchArgs = fetchSpy.calls.first().args;
    expect(fetchArgs[0]).toBe(
      'https://test-location-aiplatform.googleapis.com/v1beta1/projects/test-project/locations/test-location/test-path',
    );
  });
  it('should not prepend project/location to path if path starts with publishers/google/models for request', async () => {
    const client = new ApiClient({
      auth: new FakeAuth(),
      vertexai: true,
      project: 'test-project',
      location: 'test-location',
      uploader: new CrossUploader(),
    });
    const fetchSpy = spyOn(global, 'fetch').and.returnValue(
      Promise.resolve(
        new Response(
          JSON.stringify(mockGenerateContentResponse),
          fetchOkOptions,
        ),
      ),
    );
    await client.request({
      path: 'publishers/google/models/test-model',
      httpMethod: 'GET',
    });
    const fetchArgs = fetchSpy.calls.first().args;
    expect(fetchArgs[0]).toBe(
      'https://test-location-aiplatform.googleapis.com/v1beta1/publishers/google/models/test-model',
    );
  });
  describe('requestStream', () => {
    it('should throw ServerError if response is 500', async () => {
      const client = new ApiClient({
        auth: new FakeAuth('test-api-key'),
        apiKey: 'test-api-key',
        uploader: new CrossUploader(),
      });
      spyOn(global, 'fetch').and.returnValue(
        Promise.resolve(new Response(JSON.stringify({}), fetch500Options)),
      );
      await client
        .requestStream({path: 'test-path', httpMethod: 'POST'})
        .catch((e) => {
          expect(e.name).toEqual('ServerError');
          expect(e.message).toContain('Internal Server Error');
        });
    });
    it('should throw ClientError if response is 400', async () => {
      const client = new ApiClient({
        auth: new FakeAuth('test-api-key'),
        apiKey: 'test-api-key',
        uploader: new CrossUploader(),
      });
      spyOn(global, 'fetch').and.returnValue(
        Promise.resolve(new Response(JSON.stringify({}), fetch400Options)),
      );
      await client
        .requestStream({path: 'test-path', httpMethod: 'POST'})
        .catch((e) => {
          expect(e.name).toEqual('ClientError');
          expect(e.message).toContain('Bad Request');
        });
    });
    it('should yield data if response is ok', async () => {
      const validChunk1 =
        'data: {"candidates": [{"content": {"parts": [{"text": "The"}],"role": "model"},"finishReason": "STOP","index": 0}],';
      const validChunk2 =
        '"usageMetadata": {"promptTokenCount": 8,"candidatesTokenCount": 1,"totalTokenCount": 9}}\n\n';
      const stream = new Readable();
      stream.push(validChunk1);
      stream.push(validChunk2);
      stream.push(null); // signal end of stream
      const readableStream = new ReadableStream({
        start(controller) {
          stream.on('data', (chunk) => controller.enqueue(chunk));
          stream.on('end', () => controller.close());
          stream.on('error', (err) => controller.error(err));
        },
      });
      const response = new Response(readableStream, fetchOkOptions);
      const client = new ApiClient({
        auth: new FakeAuth('test-api-key'),
        apiKey: 'test-api-key',
        uploader: new CrossUploader(),
      });
      spyOn(global, 'fetch').and.returnValue(Promise.resolve(response));
      const generator = await client.requestStream({
        path: 'test-path',
        httpMethod: 'POST',
      });
      const resultHttpResponse = await generator.next();
      const result = await resultHttpResponse.value.json();
      expect(result).toEqual({
        candidates: [
          {
            content: {parts: [{text: 'The'}], role: 'model'},
            finishReason: 'STOP',
            index: 0,
          },
        ],
        usageMetadata: {
          promptTokenCount: 8,
          candidatesTokenCount: 1,
          totalTokenCount: 9,
        },
      });
    });
    it('should use global endpoint for api keys on vertexai', async () => {
      const client = new ApiClient({
        auth: new FakeAuth('test-api-key'),
        vertexai: true,
        apiKey: 'test-api-key',
        uploader: new CrossUploader(),
      });
      const fetchSpy = spyOn(global, 'fetch').and.returnValue(
        Promise.resolve(
          new Response(
            JSON.stringify(mockGenerateContentResponse),
            fetchOkOptions,
          ),
        ),
      );
      await client.requestStream({path: 'test-path', httpMethod: 'POST'});
      const fetchArgs = fetchSpy.calls.first().args;
      expect(fetchArgs[0]).toBe(
        'https://aiplatform.googleapis.com/v1beta1/test-path?alt=sse',
      );
    });
    it('should use project resource path when project is provided', async () => {
      const client = new ApiClient({
        auth: new FakeAuth(),
        vertexai: true,
        project: 'test-project',
        location: 'test-location',
        uploader: new CrossUploader(),
      });
      const fetchSpy = spyOn(global, 'fetch').and.returnValue(
        Promise.resolve(
          new Response(
            JSON.stringify(mockGenerateContentResponse),
            fetchOkOptions,
          ),
        ),
      );
      await client.requestStream({path: 'test-path', httpMethod: 'POST'});
      const fetchArgs = fetchSpy.calls.first().args;
      expect(fetchArgs[0]).toBe(
        'https://test-location-aiplatform.googleapis.com/v1beta1/projects' +
          '/test-project/locations/test-location/test-path?alt=sse',
      );
    });
    it('should include AbortSignal when timeout is set', async () => {
      const client = new ApiClient({
        auth: new FakeAuth('test-api-key'),
        apiKey: 'test-api-key',
        httpOptions: {timeout: 1000},
        uploader: new CrossUploader(),
      });
      const fetchSpy = spyOn(global, 'fetch').and.returnValue(
        Promise.resolve(
          new Response(
            JSON.stringify(mockGenerateContentResponse),
            fetchOkOptions,
          ),
        ),
      );
      await client.requestStream({path: 'test-path', httpMethod: 'POST'});
      const fetchArgs = fetchSpy.calls.first().args;
      expect(fetchArgs[0]).toBe(
        'https://generativelanguage.googleapis.com/v1beta/test-path?alt=sse',
      );
      // @ts-expect-error TS2532: Object is possibly 'undefined'.
      expect(fetchArgs[1].signal instanceof AbortSignal).toBeTrue();
      // @ts-expect-error TS2532: Object is possibly 'undefined'.
      expect(fetchArgs[1].signal.aborted).toBeFalse();
    });
    it('should apply requestHttpOptions when provided', async () => {
      const client = new ApiClient({
        auth: new FakeAuth('test-api-key'),
        apiKey: 'test-api-key',
        uploader: new CrossUploader(),
      });
      const fetchSpy = spyOn(global, 'fetch').and.returnValue(
        Promise.resolve(
          new Response(
            JSON.stringify(mockGenerateContentResponse),
            fetchOkOptions,
          ),
        ),
      );
      const timeoutSpy = spyOn(global, 'setTimeout');

      await client.requestStream({
        path: 'test-path',
        httpMethod: 'POST',
        httpOptions: {
          baseUrl: 'https://custom-request-base-url.googleapis.com',
          headers: {'google-custom-header': 'custom-header-value'},
          apiVersion: 'v1alpha',
          timeout: 1001,
        },
      });

      const fetchArgs = fetchSpy.calls.first().args;
      const requestInit = fetchArgs[1] as RequestInit;
      const headers = requestInit.headers as Headers;
      expect(headers.get('Content-Type')).toBe('application/json');
      expect(headers.get('x-goog-api-key')).toBe('test-api-key');
      expect(headers.get('User-Agent')).toContain('google-genai-sdk/');
      expect(headers.get('x-goog-api-client')).toContain('google-genai-sdk/');
      expect(headers.get('google-custom-header')).toBe('custom-header-value');
      const timeoutArgs = timeoutSpy.calls.first().args;
      expect(timeoutArgs[1]).toEqual(1001);
      expect(fetchArgs[0]).toEqual(
        'https://custom-request-base-url.googleapis.com/v1alpha/test-path?alt=sse',
      );
    });
    it('should set bearer token for vertexai', async () => {
      const client = new ApiClient({
        auth: new FakeAuth(),
        apiKey: 'test-api-key',
        vertexai: true,
        uploader: new CrossUploader(),
      });
      const fetchSpy = spyOn(global, 'fetch').and.returnValue(
        Promise.resolve(
          new Response(
            JSON.stringify(mockGenerateContentResponse),
            fetchOkOptions,
          ),
        ),
      );

      await client.requestStream({path: 'test-path', httpMethod: 'POST'});

      const fetchArgs = fetchSpy.calls.first().args;
      const requestInit = fetchArgs[1] as RequestInit;
      const headers = requestInit.headers as Headers;
      expect(headers.get('Content-Type')).toBe('application/json');
      expect(headers.get('Authorization')).toBe('Bearer token');
      expect(headers.get('User-Agent')).toContain('google-genai-sdk/');
      expect(headers.get('x-goog-api-client')).toContain('google-genai-sdk/');
    });
    it('should merge request http options and client http options', async () => {
      const client = new ApiClient({
        auth: new FakeAuth('test-api-key'),
        apiKey: 'test-api-key',
        httpOptions: {
          baseUrl: 'https://custom-client-base-url.googleapis.com',
        },
        uploader: new CrossUploader(),
      });
      const queryParams = {'param1': 'value1', 'param2': 'value2'};
      const fetchSpy = spyOn(global, 'fetch').and.returnValue(
        Promise.resolve(
          new Response(
            JSON.stringify(mockGenerateContentResponse),
            fetchOkOptions,
          ),
        ),
      );
      const timeoutSpy = spyOn(global, 'setTimeout');

      await client.requestStream({
        path: 'test-path',
        queryParams: queryParams,
        httpOptions: {
          headers: {'google-custom-header': 'custom-header-value'},
          timeout: 1001,
          apiVersion: 'v1alpha',
        },
        httpMethod: 'GET',
      });

      const fetchArgs = fetchSpy.calls.first().args;
      const requestInit = fetchArgs[1] as RequestInit;
      const headers = requestInit.headers as Headers;
      expect(headers.get('Content-Type')).toBe('application/json');
      expect(headers.get('x-goog-api-key')).toBe('test-api-key');
      expect(headers.get('User-Agent')).toContain('google-genai-sdk/');
      expect(headers.get('x-goog-api-client')).toContain('google-genai-sdk/');
      expect(headers.get('google-custom-header')).toBe('custom-header-value');
      const timeoutArgs = timeoutSpy.calls.first().args;
      expect(timeoutArgs[1]).toEqual(1001);
      expect(fetchArgs[0]).toEqual(
        'https://custom-client-base-url.googleapis.com/v1alpha/test-path?alt=sse',
      );
    });
    it('should not override the client http options permanently', async () => {
      const client = new ApiClient({
        auth: new FakeAuth('test-api-key'),
        apiKey: 'test-api-key',
        httpOptions: {
          baseUrl: 'https://custom-client-base-url.googleapis.com',
          apiVersion: 'v1beta1',
          timeout: 1000,
          headers: {'google-custom-header': 'custom-header-value'},
        },
        uploader: new CrossUploader(),
      });
      const queryParams: Record<string, string> = {
        'param1': 'value1',
        'param2': 'value2',
      };
      const fetchSpy = spyOn(global, 'fetch').and.returnValue(
        Promise.resolve(
          new Response(
            JSON.stringify(mockGenerateContentResponse),
            fetchOkOptions,
          ),
        ),
      );
      const timeoutSpy = spyOn(global, 'setTimeout');

      await client.requestStream({
        path: 'test-path',
        queryParams: queryParams,
        httpMethod: 'POST',
        httpOptions: {
          baseUrl: 'https://custom-request-base-url.googleapis.com',
          apiVersion: 'v1alpha',
          timeout: 1002,
          headers: {'google-custom-header': 'custom-header-request-value'},
        },
      });

      const fetchArgs = fetchSpy.calls.mostRecent().args;
      const requestInit = fetchArgs[1] as RequestInit;
      const headers = requestInit.headers as Headers;
      expect(headers.get('Content-Type')).toBe('application/json');
      expect(headers.get('x-goog-api-key')).toBe('test-api-key');
      expect(headers.get('User-Agent')).toContain('google-genai-sdk/');
      expect(headers.get('x-goog-api-client')).toContain('google-genai-sdk/');
      expect(headers.get('google-custom-header')).toBe(
        'custom-header-request-value',
      );
      const timeoutArgs = timeoutSpy.calls.mostRecent().args;
      expect(timeoutArgs[1]).toEqual(1002);
      expect(fetchArgs[0]).toEqual(
        'https://custom-request-base-url.googleapis.com/v1alpha/test-path?alt=sse',
      );

      await client.requestStream({
        path: 'test-path',
        queryParams: queryParams,
        httpMethod: 'POST',
      });

      const secondFetchArgs = fetchSpy.calls.mostRecent().args;
      const secondRequestInit = fetchArgs[1] as RequestInit;
      const secondHeaders = secondRequestInit.headers as Headers;
      expect(secondHeaders.get('Content-Type')).toBe('application/json');
      expect(secondHeaders.get('x-goog-api-key')).toBe('test-api-key');
      expect(secondHeaders.get('User-Agent')).toContain('google-genai-sdk/');
      expect(secondHeaders.get('x-goog-api-client')).toContain(
        'google-genai-sdk/',
      );
      expect(secondHeaders.get('google-custom-header')).toBe(
        'custom-header-request-value',
      );
      const secondTimeoutArgs = timeoutSpy.calls.mostRecent().args;
      expect(secondTimeoutArgs[1]).toEqual(1000);
      expect(secondFetchArgs[0]).toEqual(
        'https://custom-client-base-url.googleapis.com/v1beta1/test-path?alt=sse',
      );
    });
  });
});



================================================
FILE: test/unit/chats_test.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleGenAI} from '../../src/client';
import {Models} from '../../src/models';
import {
  Content,
  FinishReason,
  GenerateContentResponse,
  Type,
} from '../../src/types';

function buildGenerateContentResponse(
  content: Content,
  finishReason?: FinishReason,
): GenerateContentResponse {
  const response = new GenerateContentResponse();
  response.candidates = [
    {
      content,
    },
  ];
  if (finishReason !== undefined) {
    response.candidates[0].finishReason = finishReason;
  }
  return response;
}

describe('sendMessage invalid response', () => {
  const testCases = [
    {
      name: 'GenerateContent returns default response',
      response: new GenerateContentResponse(),
    },
    {
      name: 'GenerateContent returns empty candidates',
      response: Object.setPrototypeOf(
        {candidates: []},
        GenerateContentResponse.prototype,
      ),
    },
    {
      name: 'GenerateContent returns default candidate',
      response: Object.setPrototypeOf(
        {candidates: [{}]},
        GenerateContentResponse.prototype,
      ),
    },
    {
      name: 'GenerateContent returns default content',
      response: buildGenerateContentResponse({}),
    },
    {
      name: 'GenerateContent returns default part',
      response: buildGenerateContentResponse({parts: [{}], role: 'model'}),
    },
    {
      name: 'GenerateContent returns part with empty text',
      response: buildGenerateContentResponse({
        parts: [{text: ''}],
        role: 'model',
      }),
    },
  ];

  testCases.forEach(async (testCase) => {
    it(testCase.name, async () => {
      const client = new GoogleGenAI({vertexai: false, apiKey: 'fake-api-key'});
      const modelsModule = client.models;
      spyOn(modelsModule, 'generateContent').and.returnValue(
        Promise.resolve(testCase.response),
      );
      const chat = client.chats.create({model: 'gemini-1.5-flash'});
      let response = await chat.sendMessage({message: 'send message 1'});
      expect(response).toEqual(testCase.response);
      response = await chat.sendMessage({message: 'send message 2'});
      expect(modelsModule.generateContent).toHaveBeenCalledWith({
        model: 'gemini-1.5-flash',
        contents: [{role: 'user', parts: [{text: 'send message 1'}]}],
        config: {},
      });
      // Verify that invalid response and request are not added to the
      expect(modelsModule.generateContent).toHaveBeenCalledWith({
        model: 'gemini-1.5-flash',
        contents: [{role: 'user', parts: [{text: 'send message 2'}]}],
        config: {},
      });
    });
  });
});

describe('sendMessage valid response', () => {
  it('GenerateContent returns valid response', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: 'fake-api-key'});
    const validResponse = Object.setPrototypeOf(
      {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [
                {
                  text: 'valid response 1',
                },
              ],
            },
          },
        ],
      },
      GenerateContentResponse.prototype,
    );
    const modelsModule = client.models;
    spyOn(modelsModule, 'generateContent').and.returnValue(
      Promise.resolve(validResponse),
    );
    const chat = client.chats.create({model: 'gemini-1.5-flash'});
    let response = await chat.sendMessage({message: 'send message 1'});
    expect(response).toEqual(validResponse);
    response = await chat.sendMessage({message: 'send message 2'});
    expect(modelsModule.generateContent).toHaveBeenCalledWith({
      model: 'gemini-1.5-flash',
      contents: [{role: 'user', parts: [{text: 'send message 1'}]}],
      config: {},
    });
    // Verify that valid response and request are added to the history.
    expect(modelsModule.generateContent).toHaveBeenCalledWith({
      model: 'gemini-1.5-flash',
      contents: [
        {role: 'user', parts: [{text: 'send message 1'}]},
        {role: 'model', parts: [{text: 'valid response 1'}]},
        {role: 'user', parts: [{text: 'send message 2'}]},
      ],
      config: {},
    });
  });
});

describe('GenerateContent response schema', () => {
  it('smoke test GenerateContent response schema with Array', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: 'fake-api-key'});
    const validResponse = Object.setPrototypeOf(
      {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [
                {
                  text: '[{"recipeName": "recipe1"},{"recipeName": "recipe2"},{"recipeName": "recipe3"}]',
                },
              ],
            },
          },
        ],
      },
      GenerateContentResponse.prototype,
    );
    const modelsModule = client.models;
    spyOn(modelsModule, 'generateContent').and.returnValue(
      Promise.resolve(validResponse),
    );
    const request = {
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
    };
    const response = await client.models.generateContent(request);

    expect(response).toEqual(validResponse);
    // Verify that valid response and request are added to the history.
    expect(modelsModule.generateContent).toHaveBeenCalledWith(request);
  });
});

describe('sendMessage config', () => {
  let client: GoogleGenAI;
  let modelsModule: Models;
  let modelsSpy: jasmine.Spy;
  const response = new GenerateContentResponse();
  response.candidates = [
    {
      content: {
        role: 'model',
        parts: [
          {
            text: 'valid response',
          },
        ],
      },
    },
  ];

  beforeEach(() => {
    client = new GoogleGenAI({vertexai: false, apiKey: 'fake-api-key'});
    modelsModule = client.models;
    modelsSpy = spyOn(modelsModule, 'generateContent').and.returnValue(
      Promise.resolve(response),
    );
  });

  it('use default config', async () => {
    const defaultConfig = {candidateCount: 1};
    const chat = client.chats.create({
      model: 'gemini-1.5-flash',
      config: defaultConfig,
    });
    await chat.sendMessage({message: 'send message'});

    expect(modelsModule.generateContent).toHaveBeenCalledWith(
      jasmine.objectContaining({config: defaultConfig}),
    );
  });

  it('use per-request config', async () => {
    const defaultConfig = {candidateCount: 1};
    const requestConfig = {candidateCount: 2};
    const chat = client.chats.create({
      model: 'gemini-1.5-flash',
      config: defaultConfig,
    });
    await chat.sendMessage({message: 'send message', config: requestConfig});
    await chat.sendMessage({message: 'send message'});

    const calls = modelsSpy.calls.allArgs();
    expect(calls.length).toBe(2);
    expect(calls[0][0]['config']).toEqual(requestConfig);
    expect(calls[1][0]['config']).toEqual(defaultConfig);
  });
});

describe('sendMessageStream config', () => {
  let client: GoogleGenAI;
  let modelsModule: Models;
  let modelsSpy: jasmine.Spy;
  const chunk = new GenerateContentResponse();
  chunk.candidates = [
    {
      content: {
        role: 'model',
        parts: [
          {
            text: 'valid response',
          },
        ],
      },
    },
  ];
  async function* mockStreamResponse() {
    yield chunk;
  }

  beforeEach(() => {
    client = new GoogleGenAI({vertexai: false, apiKey: 'fake-api-key'});
    modelsModule = client.models;
    modelsSpy = spyOn(modelsModule, 'generateContentStream').and.returnValue(
      Promise.resolve(mockStreamResponse()),
    );
  });

  it('use default config', async () => {
    const defaultConfig = {candidateCount: 1};
    const chat = client.chats.create({
      model: 'gemini-1.5-flash',
      config: defaultConfig,
    });
    await chat.sendMessageStream({message: 'send message'});

    expect(modelsModule.generateContentStream).toHaveBeenCalledWith(
      jasmine.objectContaining({config: defaultConfig}),
    );
  });

  it('use per-request config', async () => {
    const defaultConfig = {candidateCount: 1};
    const requestConfig = {candidateCount: 2};
    const chat = client.chats.create({
      model: 'gemini-1.5-flash',
      config: defaultConfig,
    });
    await chat.sendMessageStream({
      message: 'send message',
      config: requestConfig,
    });
    await chat.sendMessageStream({message: 'send message'});

    const calls = modelsSpy.calls.allArgs();
    expect(calls.length).toBe(2);
    expect(calls[0][0]['config']).toEqual(requestConfig);
    expect(calls[1][0]['config']).toEqual(defaultConfig);
  });
});

describe('sendMessageStream invalid response', () => {
  const responseChunk1 = Object.setPrototypeOf(
    {
      candidates: [
        {
          content: {
            role: 'model',
            parts: [
              {
                text: 'response chunk 1',
              },
            ],
          },
        },
      ],
    },
    GenerateContentResponse.prototype,
  );
  const responseChunk2 = Object.setPrototypeOf(
    {
      candidates: [
        {
          content: {
            role: 'model',
            parts: [
              {
                text: '',
              },
            ],
          },
        },
      ],
    },
    GenerateContentResponse.prototype,
  );

  async function* mockStreamResponse() {
    yield responseChunk1;
    yield responseChunk2;
  }

  it('Chunk with empty text', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: 'fake-api-key'});
    const modelsModule = client.models;
    spyOn(modelsModule, 'generateContentStream').and.returnValue(
      Promise.resolve(mockStreamResponse()),
    );
    const chat = client.chats.create({model: 'gemini-1.5-flash'});
    await chat.sendMessageStream({message: 'send message 1'});
    await chat.sendMessageStream({message: 'send message 2'});
    expect(modelsModule.generateContentStream).toHaveBeenCalledWith({
      model: 'gemini-1.5-flash',
      contents: [{role: 'user', parts: [{text: 'send message 1'}]}],
      config: {},
    });
    // Verify that invalid response and request are not added to the history.
    expect(modelsModule.generateContentStream).toHaveBeenCalledWith({
      model: 'gemini-1.5-flash',
      contents: [{role: 'user', parts: [{text: 'send message 2'}]}],
      config: {},
    });
  });
});

describe('sendMessageStream valid response', () => {
  const responseChunk1 = buildGenerateContentResponse({
    parts: [{text: 'response chunk 1'}],
    role: 'model',
  });

  const responseChunk2 = buildGenerateContentResponse(
    {
      parts: [{text: 'response chunk 2'}],
      role: 'model',
    },
    FinishReason.STOP,
  );

  async function* mockStreamResponse() {
    yield responseChunk1;
    yield responseChunk2;
  }

  it('GenerateContentStream with finish reason', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: 'fake-api-key'});
    const modelsModule = client.models;
    const modelsSpy = spyOn(
      modelsModule,
      'generateContentStream',
    ).and.returnValue(Promise.resolve(mockStreamResponse()));
    const chat = client.chats.create({model: 'gemini-1.5-flash'});
    const response1 = await chat.sendMessageStream({message: 'send message 1'});
    const chunks1 = [];
    for await (const chunk of response1) {
      chunks1.push(chunk);
    }
    const response2 = await chat.sendMessageStream({message: 'send message 2'});
    const chunks2 = [];
    for await (const chunk of response2) {
      chunks2.push(chunk);
    }

    expect(chunks1).toEqual([responseChunk1, responseChunk2]);
    expect(chunks2).toEqual([]);
    const calls = modelsSpy.calls.allArgs();
    expect(calls[0][0]['contents']).toEqual([
      {role: 'user', parts: [{text: 'send message 1'}]},
    ]);
    expect(calls[1][0]['contents']).toEqual([
      {role: 'user', parts: [{text: 'send message 1'}]},
      {role: 'model', parts: [{text: 'response chunk 1'}]},
      {role: 'model', parts: [{text: 'response chunk 2'}]},
      {role: 'user', parts: [{text: 'send message 2'}]},
    ]);
  });
});

describe('create chat with history', () => {
  it('throws error if history not start with a user turn', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: 'fake-api-key'});
    const history = [{role: 'model', parts: [{text: 'some model response'}]}];

    expect(() =>
      client.chats.create({model: 'gemini-1.5-flash', history}),
    ).toThrowError('History must start with a user turn.');
  });

  it('throws error if history contains invalid role', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: 'fake-api-key'});
    const history = [
      {role: 'user', parts: [{text: 'user content'}]},
      {role: 'unknown_role', parts: [{text: 'unknown role response'}]},
    ];

    expect(() =>
      client.chats.create({model: 'gemini-1.5-flash', history}),
    ).toThrowError('Role must be user or model, but got unknown_role.');
  });

  it('derives curated history with invalid model response', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: 'fake-api-key'});
    const comprehensiveHistory = [
      {role: 'user', parts: [{text: 'user content 1'}]},
      {role: 'model', parts: []},
      {role: 'user', parts: [{text: 'user content 2'}]},
      {role: 'model', parts: [{text: 'valid model response'}]},
    ];
    const chat = client.chats.create({
      model: 'gemini-1.5-flash',
      history: comprehensiveHistory,
    });

    expect(chat.getHistory()).toEqual(comprehensiveHistory);
    expect(chat.getHistory(true)).toEqual(comprehensiveHistory.slice(2));
  });

  it('derives curated history with valid model response', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: 'fake-api-key'});
    const comprehensiveHistory = [
      {role: 'user', parts: [{text: 'user content 1'}]},
      {role: 'model', parts: [{text: 'valid model response 1'}]},
      {role: 'user', parts: [{text: 'user content 2'}]},
      {
        role: 'model',
        parts: [{functionCall: {name: 'foo', args: {'param': 'bar'}}}],
      },
      {role: 'user', parts: [{text: 'user content 2'}]},
      {
        role: 'model',
        parts: [{functionResponse: {name: 'foo', response: {'result': 'bar'}}}],
      },
    ];
    const chat = client.chats.create({
      model: 'gemini-1.5-flash',
      history: comprehensiveHistory,
    });

    expect(chat.getHistory()).toEqual(comprehensiveHistory);
    expect(chat.getHistory(true)).toEqual(comprehensiveHistory);
  });
});

describe('getHistory', () => {
  const existingInputContent = {
    role: 'user',
    parts: [{text: 'existing user content'}],
  };
  const existingOutputContent = {
    role: 'model',
    parts: [{text: 'existing model response'}],
  };

  async function* mockStreamResponse() {
    yield buildGenerateContentResponse({
      parts: [{text: 'streaming response chunk 1'}],
      role: 'model',
    });
    yield buildGenerateContentResponse(
      {parts: [{text: 'streaming response chunk 2'}], role: 'model'},
      FinishReason.STOP,
    );
  }

  it('appends to history when sendMessage is called', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: 'fake-api-key'});
    const modelsModule = client.models;
    const mockResponse = buildGenerateContentResponse({
      parts: [{text: 'new model response'}],
      role: 'model',
    });
    spyOn(modelsModule, 'generateContent').and.returnValue(
      Promise.resolve(mockResponse),
    );
    const chat = client.chats.create({
      model: 'gemini-1.5-flash',
      history: [existingInputContent, existingOutputContent],
    });

    await chat.sendMessage({message: 'new user content'});

    const expectedHistory = [
      existingInputContent,
      existingOutputContent,
      {role: 'user', parts: [{text: 'new user content'}]},
      {role: 'model', parts: [{text: 'new model response'}]},
    ];
    expect(chat.getHistory()).toEqual(expectedHistory);
    expect(chat.getHistory(true)).toEqual(expectedHistory);
  });

  it('appends to history when sendMessageStream is called', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: 'fake-api-key'});
    const modelsModule = client.models;
    spyOn(modelsModule, 'generateContentStream').and.returnValue(
      Promise.resolve(mockStreamResponse()),
    );
    const chat = client.chats.create({
      model: 'gemini-1.5-flash',
      history: [existingInputContent, existingOutputContent],
    });

    const chunks = await chat.sendMessageStream({message: 'new user content'});
    for await (const _chunk of chunks) {
      // No-op, consumes all chunks from the stream.
    }

    const expectedHistory = [
      existingInputContent,
      existingOutputContent,
      {role: 'user', parts: [{text: 'new user content'}]},
      {
        role: 'model',
        parts: [{text: 'streaming response chunk 1'}],
      },
      {
        role: 'model',
        parts: [{text: 'streaming response chunk 2'}],
      },
    ];
    expect(chat.getHistory()).toEqual(expectedHistory);
    expect(chat.getHistory(true)).toEqual(expectedHistory);
  });

  it('invalid model response is not added to curated history', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: 'fake-api-key'});
    const modelsModule = client.models;
    const invalidContent = {parts: [{text: ''}], role: 'model'};
    const mockResponse = buildGenerateContentResponse(invalidContent);
    spyOn(modelsModule, 'generateContent').and.returnValue(
      Promise.resolve(mockResponse),
    );
    const chat = client.chats.create({
      model: 'gemini-1.5-flash',
    });

    await chat.sendMessage({message: 'new user content'});

    const expectedComprehensiveHistory = [
      {role: 'user', parts: [{text: 'new user content'}]},
      invalidContent,
    ];
    expect(chat.getHistory()).toEqual(expectedComprehensiveHistory);
    expect(chat.getHistory(true)).toEqual([]);
  });

  it('inserts an empty model content when response is empty.', async () => {
    const client = new GoogleGenAI({vertexai: false, apiKey: 'fake-api-key'});
    const modelsModule = client.models;
    spyOn(modelsModule, 'generateContent').and.returnValue(
      Promise.resolve(new GenerateContentResponse()),
    );
    const chat = client.chats.create({
      model: 'gemini-1.5-flash',
    });

    await chat.sendMessage({message: 'new user content'});

    const expectedComprehensiveHistory = [
      {role: 'user', parts: [{text: 'new user content'}]},
      {role: 'model', parts: []},
    ];
    expect(chat.getHistory()).toEqual(expectedComprehensiveHistory);
    expect(chat.getHistory(true)).toEqual([]);
  });
});



================================================
FILE: test/unit/file_test.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleGenAI} from '../../src/node';
import {createZeroFilledTempFile} from '../_generate_test_file';

describe('File', () => {
  let client: GoogleGenAI;
  beforeEach(() => {
    client = new GoogleGenAI({vertexai: false, apiKey: 'fake-api-key'});
  });

  describe('delete', () => {
    it('It should delete the file by given config', async () => {
      const deleteUrl =
        'https://generativelanguage.googleapis.com/v1beta/files/6h7lat0gfq5n';
      const deleteOkoptions = {
        status: 200,
        statusText: 'OK',
        ok: true,
        headers: {
          'Content-Type': 'application/json',
        },
        url: 'some-url',
      };

      spyOn(global, 'fetch').and.returnValue(
        Promise.resolve(new Response('{}', deleteOkoptions)),
      );
      await client.files.delete({
        name: 'files/6h7lat0gfq5n',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        jasmine.stringMatching(deleteUrl),
        jasmine.any(Object),
      );
    });
  });
  describe('upload', () => {
    const DEFAULT_CHUNK_SIZE = 1024 * 1024 * 8; // bytes
    const TEST_FILE_SIZE = 1024 * 1024 * 30; // bytes
    const DEFAULT_TEST_MIMETYPE = 'text/plain';
    const TEST_CREATE_URL =
      'https://generativelanguage.googleapis.com/upload/v1beta/files';
    const TEST_UPLOAD_URL =
      'https://generativelanguage.googleapis.com/upload/v1beta/files?upload_id=test-upload-id&upload_protocol=resumable';

    const createUrlOkoptions = {
      status: 200,
      statusText: 'OK',
      ok: true,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-upload-url': TEST_UPLOAD_URL,
      },
      url: 'some-url',
    };
    const uploadOkOptions = {
      status: 200,
      statusText: 'OK',
      ok: true,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-upload-status': 'active',
      },
      url: 'some-url',
    };
    const lastCorrectFetchOkOptions = {
      status: 200,
      statusText: 'OK',
      ok: true,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-upload-status': 'final',
      },
      url: 'some-url',
    };
    const mockResponse = new Response(
      JSON.stringify({
        data: 'data1',
      }),
      uploadOkOptions,
    );
    const fileSize = TEST_FILE_SIZE;
    describe('Node_client', () => {
      it('It should upload the file from a string path.', async () => {
        const filePath = await createZeroFilledTempFile(TEST_FILE_SIZE);
        const numRequests = Math.ceil(TEST_FILE_SIZE / DEFAULT_CHUNK_SIZE);

        // one initial request to get the upload url, and then the rest
        // of the requests to upload the file.
        const mockResponses = [
          Promise.resolve(new Response('', createUrlOkoptions)),
        ];

        for (let i = 0; i < numRequests - 1; i++) {
          mockResponses.push(Promise.resolve(mockResponse));
        }
        mockResponses.push(
          Promise.resolve(
            new Response(
              JSON.stringify({
                data: 'data12',
              }),
              lastCorrectFetchOkOptions,
            ),
          ),
        );

        const fetchSpy = spyOn(global, 'fetch').and.returnValues(
          ...mockResponses,
        );

        await client.files.upload({file: filePath});
        expect(fetchSpy).toHaveBeenCalledTimes(numRequests + 1);

        const allArgs = fetchSpy.calls.allArgs();

        // make sure we get the correct create url. mimeType and fileSize in the
        // first request.
        expect(allArgs[0][0]).toBe(TEST_CREATE_URL);
        expect(allArgs[0][1]?.['body']).toContain(DEFAULT_TEST_MIMETYPE);
        expect(allArgs[0][1]?.['body']).toContain(TEST_FILE_SIZE);

        let byteProcessed = 0;
        for (let i = 1; i < numRequests + 1; i++) {
          // make sure we get the correct upload url in the first
          // request.
          expect(allArgs[i][0]).toBe(TEST_UPLOAD_URL);
          expect(allArgs[i][1]?.['body']).toBeInstanceOf(Blob);
          const body = allArgs[i][1]?.['body'] as Blob;
          expect(
            body?.size ==
              Math.min(DEFAULT_CHUNK_SIZE, fileSize - byteProcessed),
          ).toBeTrue();
          byteProcessed += body?.size;
        }
        // make sure we have processed all the bytes.
        expect(byteProcessed).toBe(fileSize);
      });

      it('It should upload the file from a blob.', async () => {
        const testBlob = new Blob([new Uint8Array(fileSize)], {
          type: DEFAULT_TEST_MIMETYPE,
        });
        const numRequests = Math.ceil(TEST_FILE_SIZE / DEFAULT_CHUNK_SIZE);

        // one initial request to get the upload url, and then the rest
        // of the requests to upload the file.
        const mockResponses = [
          Promise.resolve(new Response('', createUrlOkoptions)),
        ];

        for (let i = 0; i < numRequests - 1; i++) {
          mockResponses.push(Promise.resolve(mockResponse));
        }
        mockResponses.push(
          Promise.resolve(
            new Response(
              JSON.stringify({
                data: 'data12',
              }),
              lastCorrectFetchOkOptions,
            ),
          ),
        );

        const fetchSpy = spyOn(global, 'fetch').and.returnValues(
          ...mockResponses,
        );

        await client.files.upload({file: testBlob});

        expect(fetchSpy).toHaveBeenCalledTimes(numRequests + 1);
        const allArgs = fetchSpy.calls.allArgs();

        // make sure we get the correct create url. mimeType and fileSize in the
        // first request.
        expect(allArgs[0][0]).toBe(TEST_CREATE_URL);
        expect(allArgs[0][1]?.['body']).toContain(DEFAULT_TEST_MIMETYPE);
        expect(allArgs[0][1]?.['body']).toContain(TEST_FILE_SIZE);
        let byteProcessed = 0;
        for (let i = 1; i < numRequests + 1; i++) {
          // make sure we get the correct upload url in the first
          // request.
          expect(allArgs[i][0]).toBe(TEST_UPLOAD_URL);
          expect(allArgs[i][1]?.['body']).toBeInstanceOf(Blob);
          const body = allArgs[i][1]?.['body'] as Blob;
          expect(
            body?.size ==
              Math.min(DEFAULT_CHUNK_SIZE, fileSize - byteProcessed),
          ).toBeTrue();
          byteProcessed += body?.size;
        }
        expect(byteProcessed).toBe(fileSize);
      });
    });
  });
});



================================================
FILE: test/unit/live_test.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {ApiClient, SDK_VERSION} from '../../src/_api_client';
import {
  WebSocket,
  WebSocketCallbacks,
  WebSocketFactory,
} from '../../src/_websocket';
import * as converters from '../../src/converters/_live_converters';
import {CrossUploader} from '../../src/cross/_cross_uploader';
import {Live} from '../../src/live';
import * as types from '../../src/types';
import {FakeAuth} from '../_fake_auth';

class FakeWebSocketFactory implements WebSocketFactory {
  create(
    url: string,
    headers: Record<string, string>,
    callbacks: WebSocketCallbacks,
  ) {
    return new FakeWebSocket(url, headers, callbacks);
  }
}

class FakeWebSocket implements WebSocket {
  constructor(
    private readonly url: string,
    private readonly headers: Record<string, string>,
    private callbacks: WebSocketCallbacks,
  ) {}

  connect(): void {
    this.callbacks.onopen();
  }
  send(message: string): void {
    this.callbacks.onmessage({data: message});
  }
  close(): void {
    this.callbacks.onclose('');
  }
}

describe('live', () => {
  it('connect uses default callbacks if not provided', async () => {
    const apiClient = new ApiClient({
      auth: new FakeAuth(),
      apiKey: 'test-api-key',
      uploader: new CrossUploader(),
    });
    const websocketFactory = new FakeWebSocketFactory();
    const live = new Live(apiClient, new FakeAuth(), websocketFactory);

    const websocketFactorySpy = spyOn(
      websocketFactory,
      'create',
    ).and.callThrough();

    // Default callbacks are used.
    const session = await live.connect({
      model: 'models/gemini-2.0-flash-live-001',
      callbacks: {
        onmessage: function (e: types.LiveServerMessage) {
          void e;
        },
      },
    });

    const websocketFactorySpyCall = websocketFactorySpy.calls.all()[0];
    expect(websocketFactorySpyCall.args[0]).toBe(
      'wss://generativelanguage.googleapis.com//ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=test-api-key',
    );
    expect(JSON.stringify(websocketFactorySpyCall.args[1])).toBe(
      `{"content-type":"application/json","user-agent":"google-genai-sdk/${SDK_VERSION} undefined","x-goog-api-client":"google-genai-sdk/${SDK_VERSION} undefined"}`,
    );
    // Check that the onopen callback is wrapped to call the provided callbacks
    // and then resolve the onopen promise. The string is not fully checked to
    // avoid issues with whitespace.
    const onopenString = JSON.stringify(
      websocketFactorySpyCall.args[2].onopen.toString(),
    );
    expect(onopenString).toContain(
      '(_a = callbacks === null || callbacks === void 0 ? void 0 : callbacks.onopen) === null || _a === void 0 ? void 0 : _a.call(callbacks);',
    );
    expect(onopenString).toContain('onopenResolve({});');
    expect(
      JSON.stringify(websocketFactorySpyCall.args[2].onclose.toString()),
    ).toContain('void e;');
    expect(session).toBeDefined();
  });

  it('connect should rely on provided callbacks', async () => {
    const apiClient = new ApiClient({
      auth: new FakeAuth(),
      apiKey: 'test-api-key',
      uploader: new CrossUploader(),
    });
    const websocketFactory = new FakeWebSocketFactory();
    const live = new Live(apiClient, new FakeAuth(), websocketFactory);

    try {
      await live.connect({
        model: 'models/gemini-2.0-flash-live-001',
        callbacks: {
          onopen: () => {
            throw new Error('custom onopen error');
          },
          onmessage: function (e: types.LiveServerMessage) {
            void e;
          },
        },
      });
    } catch (e: unknown) {
      if (e instanceof Error) {
        expect(e.message).toBe('custom onopen error');
      }
    }
  });

  it('connect should send setup message', async () => {
    const apiClient = new ApiClient({
      auth: new FakeAuth(),
      apiKey: 'test-api-key',
      uploader: new CrossUploader(),
    });
    const websocketFactory = new FakeWebSocketFactory();
    const live = new Live(apiClient, new FakeAuth(), websocketFactory);

    let websocket = new FakeWebSocket(
      '',
      {},
      {
        onopen: function () {},
        onmessage: function (e: MessageEvent) {
          console.debug(e.data);
        },
        onerror: function (e: ErrorEvent) {
          console.debug(e.message);
        },
        onclose: function (e: CloseEvent) {
          console.debug(e.reason);
        },
      },
    );
    spyOn(websocket, 'connect').and.callThrough();
    let websocketSpy = spyOn(websocket, 'send').and.callThrough();
    const websocketFactorySpy = spyOn(websocketFactory, 'create').and.callFake(
      (url, headers, callbacks) => {
        // Update the websocket spy instance with callbacks provided by
        // the websocket factory.
        websocket = new FakeWebSocket(url, headers, callbacks);
        spyOn(websocket, 'connect').and.callThrough();
        websocketSpy = spyOn(websocket, 'send').and.callThrough();
        return websocket;
      },
    );

    const session = await live.connect({
      model: 'models/gemini-2.0-flash-live-001',
      callbacks: {
        onmessage: function (e: types.LiveServerMessage) {
          void e;
        },
      },
    });

    const websocketFactorySpyCall = websocketFactorySpy.calls.all()[0];
    expect(websocketFactorySpyCall.args[0]).toBe(
      'wss://generativelanguage.googleapis.com//ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=test-api-key',
    );
    expect(JSON.stringify(websocketFactorySpyCall.args[1])).toBe(
      `{"content-type":"application/json","user-agent":"google-genai-sdk/${SDK_VERSION} undefined","x-goog-api-client":"google-genai-sdk/${SDK_VERSION} undefined"}`,
    );
    // Check that the onopen callback is wrapped to call the provided callbacks
    // and then resolve the onopen promise. The string is not fully checked to
    // avoid issues with whitespace.
    const onopenString = JSON.stringify(
      websocketFactorySpyCall.args[2].onopen.toString(),
    );
    expect(onopenString).toContain(
      '(_a = callbacks === null || callbacks === void 0 ? void 0 : callbacks.onopen) === null || _a === void 0 ? void 0 : _a.call(callbacks);',
    );
    expect(onopenString).toContain('onopenResolve({});');
    expect(
      JSON.stringify(websocketFactorySpyCall.args[2].onerror.toString()),
    ).toContain('void e;');
    expect(
      JSON.stringify(websocketFactorySpyCall.args[2].onclose.toString()),
    ).toContain('void e;');
    expect(websocket.connect).toHaveBeenCalled();
    const websocketSpyCall = websocketSpy.calls.all()[0];
    expect(websocketSpyCall.args[0]).toBe(
      '{"setup":{"model":"models/gemini-2.0-flash-live-001"}}',
    );
    expect(session).toBeDefined();
  });

  it('connect Gemini should fail with setup message using transparent', async () => {
    const apiClient = new ApiClient({
      auth: new FakeAuth(),
      apiKey: 'test-api-key',
      uploader: new CrossUploader(),
    });
    const websocketFactory = new FakeWebSocketFactory();
    const live = new Live(apiClient, new FakeAuth(), websocketFactory);

    let websocket = new FakeWebSocket(
      '',
      {},
      {
        onopen: function () {},
        onmessage: function (_e: MessageEvent) {},
        onerror: function (_e: ErrorEvent) {},
        onclose: function (_e: CloseEvent) {},
      },
    );
    spyOn(websocket, 'connect').and.callThrough();
    spyOn(websocketFactory, 'create').and.callFake(
      (url, headers, callbacks) => {
        // Update the websocket spy instance with callbacks provided by
        // the websocket factory.
        websocket = new FakeWebSocket(url, headers, callbacks);
        spyOn(websocket, 'connect').and.callThrough();
        return websocket;
      },
    );

    try {
      await live.connect({
        model: 'models/gemini-2.0-flash-live-001',
        config: {
          sessionResumption: {
            handle: 'test_handle',
            transparent: true,
          },
        },
        callbacks: {
          onmessage: function (e: types.LiveServerMessage) {
            void e;
          },
        },
      });
    } catch (e: unknown) {
      if (e instanceof Error) {
        expect(e.message).toBe(
          'transparent parameter is not supported in Gemini API.',
        );
      }
    }
  });

  it('connect Vertex should send setup message with session resumption config', async () => {
    const apiClient = new ApiClient({
      auth: new FakeAuth(),
      apiKey: 'test-api-key',
      uploader: new CrossUploader(),
      vertexai: true,
      project: 'test-project',
      location: 'test-location',
    });
    const websocketFactory = new FakeWebSocketFactory();
    const live = new Live(apiClient, new FakeAuth(), websocketFactory);

    let websocket = new FakeWebSocket(
      '',
      {},
      {
        onopen: function () {},
        onmessage: function (_e: MessageEvent) {},
        onerror: function (_e: ErrorEvent) {},
        onclose: function (_e: CloseEvent) {},
      },
    );
    spyOn(websocket, 'connect').and.callThrough();
    let websocketSpy = spyOn(websocket, 'send').and.callThrough();
    spyOn(websocketFactory, 'create').and.callFake(
      (url, headers, callbacks) => {
        // Update the websocket spy instance with callbacks provided by
        // the websocket factory.
        websocket = new FakeWebSocket(url, headers, callbacks);
        spyOn(websocket, 'connect').and.callThrough();
        websocketSpy = spyOn(websocket, 'send').and.callThrough();
        return websocket;
      },
    );

    const session = await live.connect({
      model: 'models/gemini-2.0-flash-live-preview-04-09',
      config: {
        sessionResumption: {
          handle: 'test_handle',
          transparent: true,
        },
      },
      callbacks: {
        onmessage: function (e: types.LiveServerMessage) {
          void e;
        },
      },
    });

    const websocketSpyCall = websocketSpy.calls.all()[0];
    expect(websocketSpyCall.args[0]).toBe(
      '{"setup":{"model":"models/gemini-2.0-flash-live-preview-04-09","generationConfig":{"responseModalities":["AUDIO"]},"sessionResumption":{"handle":"test_handle","transparent":true}}}',
    );
    expect(session).toBeDefined();
  });

  it('connect should send setup message with context window compression config', async () => {
    const apiClient = new ApiClient({
      auth: new FakeAuth(),
      apiKey: 'test-api-key',
      uploader: new CrossUploader(),
      vertexai: true,
      project: 'test-project',
      location: 'test-location',
    });
    const websocketFactory = new FakeWebSocketFactory();
    const live = new Live(apiClient, new FakeAuth(), websocketFactory);

    let websocket = new FakeWebSocket(
      '',
      {},
      {
        onopen: function () {},
        onmessage: function (_e: MessageEvent) {},
        onerror: function (_e: ErrorEvent) {},
        onclose: function (_e: CloseEvent) {},
      },
    );
    spyOn(websocket, 'connect').and.callThrough();
    let websocketSpy = spyOn(websocket, 'send').and.callThrough();
    spyOn(websocketFactory, 'create').and.callFake(
      (url, headers, callbacks) => {
        // Update the websocket spy instance with callbacks provided by
        // the websocket factory.
        websocket = new FakeWebSocket(url, headers, callbacks);
        spyOn(websocket, 'connect').and.callThrough();
        websocketSpy = spyOn(websocket, 'send').and.callThrough();
        return websocket;
      },
    );

    const session = await live.connect({
      model: 'models/gemini-2.0-flash-live-001',
      config: {
        contextWindowCompression: {
          triggerTokens: '1000',
          slidingWindow: {
            targetTokens: '10',
          },
        },
      },
      callbacks: {
        onmessage: function (e: types.LiveServerMessage) {
          void e;
        },
      },
    });

    const websocketSpyCall = websocketSpy.calls.all()[0];
    expect(websocketSpyCall.args[0]).toBe(
      '{"setup":{"model":"models/gemini-2.0-flash-live-001","generationConfig":{"responseModalities":["AUDIO"]},"contextWindowCompression":{"triggerTokens":"1000","slidingWindow":{"targetTokens":"10"}}}}',
    );
    expect(session).toBeDefined();
  });

  it('connect should send setup message with realtime input config', async () => {
    const apiClient = new ApiClient({
      auth: new FakeAuth(),
      apiKey: 'test-api-key',
      uploader: new CrossUploader(),
      vertexai: true,
      project: 'test-project',
      location: 'test-location',
    });
    const websocketFactory = new FakeWebSocketFactory();
    const live = new Live(apiClient, new FakeAuth(), websocketFactory);

    let websocket = new FakeWebSocket(
      '',
      {},
      {
        onopen: function () {},
        onmessage: function (_e: MessageEvent) {},
        onerror: function (_e: ErrorEvent) {},
        onclose: function (_e: CloseEvent) {},
      },
    );
    spyOn(websocket, 'connect').and.callThrough();
    let websocketSpy = spyOn(websocket, 'send').and.callThrough();
    spyOn(websocketFactory, 'create').and.callFake(
      (url, headers, callbacks) => {
        // Update the websocket spy instance with callbacks provided by
        // the websocket factory.
        websocket = new FakeWebSocket(url, headers, callbacks);
        spyOn(websocket, 'connect').and.callThrough();
        websocketSpy = spyOn(websocket, 'send').and.callThrough();
        return websocket;
      },
    );

    const session = await live.connect({
      model: 'models/gemini-2.0-flash-live-001',
      config: {
        realtimeInputConfig: {
          automaticActivityDetection: {
            startOfSpeechSensitivity:
              types.StartSensitivity.START_SENSITIVITY_HIGH,
            endOfSpeechSensitivity: types.EndSensitivity.END_SENSITIVITY_HIGH,
          },
          activityHandling: types.ActivityHandling.NO_INTERRUPTION,
          turnCoverage: types.TurnCoverage.TURN_INCLUDES_ALL_INPUT,
        },
      },
      callbacks: {
        onmessage: function (e: types.LiveServerMessage) {
          void e;
        },
      },
    });

    const websocketSpyCall = websocketSpy.calls.all()[0];
    expect(websocketSpyCall.args[0]).toBe(
      '{"setup":{"model":"models/gemini-2.0-flash-live-001","generationConfig":{"responseModalities":["AUDIO"]},"realtimeInputConfig":{"automaticActivityDetection":{"startOfSpeechSensitivity":"START_SENSITIVITY_HIGH","endOfSpeechSensitivity":"END_SENSITIVITY_HIGH"},"activityHandling":"NO_INTERRUPTION","turnCoverage":"TURN_INCLUDES_ALL_INPUT"}}}',
    );
    expect(session).toBeDefined();
  });

  it('connect should send setup message with top level generation config', async () => {
    const apiClient = new ApiClient({
      auth: new FakeAuth(),
      apiKey: 'test-api-key',
      uploader: new CrossUploader(),
      vertexai: true,
      project: 'test-project',
      location: 'test-location',
    });
    const websocketFactory = new FakeWebSocketFactory();
    const live = new Live(apiClient, new FakeAuth(), websocketFactory);

    let websocket = new FakeWebSocket(
      '',
      {},
      {
        onopen: function () {},
        onmessage: function (_e: MessageEvent) {},
        onerror: function (_e: ErrorEvent) {},
        onclose: function (_e: CloseEvent) {},
      },
    );
    spyOn(websocket, 'connect').and.callThrough();
    let websocketSpy = spyOn(websocket, 'send').and.callThrough();
    spyOn(websocketFactory, 'create').and.callFake(
      (url, headers, callbacks) => {
        // Update the websocket spy instance with callbacks provided by
        // the websocket factory.
        websocket = new FakeWebSocket(url, headers, callbacks);
        spyOn(websocket, 'connect').and.callThrough();
        websocketSpy = spyOn(websocket, 'send').and.callThrough();
        return websocket;
      },
    );

    const session = await live.connect({
      model: 'models/gemini-2.0-flash-live-001',
      config: {
        temperature: 0.5,
        seed: 12,
        topP: 0.9,
        topK: 3,
      },
      callbacks: {
        onmessage: function (e: types.LiveServerMessage) {
          void e;
        },
      },
    });

    const websocketSpyCall = websocketSpy.calls.all()[0];
    expect(websocketSpyCall.args[0]).toBe(
      '{"setup":{"model":"models/gemini-2.0-flash-live-001","generationConfig":{"responseModalities":["AUDIO"],"temperature":0.5,"topP":0.9,"topK":3,"seed":12}}}',
    );
    expect(session).toBeDefined();
  });

  it('connect should send setup message with speech config', async () => {
    const apiClient = new ApiClient({
      auth: new FakeAuth(),
      apiKey: 'test-api-key',
      uploader: new CrossUploader(),
      vertexai: true,
      project: 'test-project',
      location: 'test-location',
    });
    const websocketFactory = new FakeWebSocketFactory();
    const live = new Live(apiClient, new FakeAuth(), websocketFactory);

    let websocket = new FakeWebSocket(
      '',
      {},
      {
        onopen: function () {},
        onmessage: function (_e: MessageEvent) {},
        onerror: function (_e: ErrorEvent) {},
        onclose: function (_e: CloseEvent) {},
      },
    );
    spyOn(websocket, 'connect').and.callThrough();
    let websocketSpy = spyOn(websocket, 'send').and.callThrough();
    spyOn(websocketFactory, 'create').and.callFake(
      (url, headers, callbacks) => {
        // Update the websocket spy instance with callbacks provided by
        // the websocket factory.
        websocket = new FakeWebSocket(url, headers, callbacks);
        spyOn(websocket, 'connect').and.callThrough();
        websocketSpy = spyOn(websocket, 'send').and.callThrough();
        return websocket;
      },
    );

    const session = await live.connect({
      model: 'models/gemini-2.0-flash-live-001',
      config: {
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'en-default',
            },
          },
          languageCode: 'en-US',
        },
      },
      callbacks: {
        onmessage: function (e: types.LiveServerMessage) {
          void e;
        },
      },
    });

    const websocketSpyCall = websocketSpy.calls.all()[0];
    expect(websocketSpyCall.args[0]).toBe(
      '{"setup":{"model":"models/gemini-2.0-flash-live-001","generationConfig":{"responseModalities":["AUDIO"],"speechConfig":{"voiceConfig":{"prebuiltVoiceConfig":{"voiceName":"en-default"}},"languageCode":"en-US"}}}}',
    );
    expect(session).toBeDefined();
  });

  it('session should return goAway message', async () => {
    const apiClient = new ApiClient({
      auth: new FakeAuth(),
      apiKey: 'test-api-key',
      uploader: new CrossUploader(),
    });
    const websocketFactory = new FakeWebSocketFactory();
    const live = new Live(apiClient, new FakeAuth(), websocketFactory);

    spyOn(websocketFactory, 'create').and.callFake(
      (url, headers, callbacks) => {
        const websocket = new FakeWebSocket(url, headers, callbacks);
        websocket.send('{"goAway":{"timeLeft":"10s"}}');
        return websocket;
      },
    );

    const incomingMessages: types.LiveServerMessage[] = [];

    await live.connect({
      model: 'models/gemini-2.0-flash-live-001',
      callbacks: {
        onmessage: function (e: types.LiveServerMessage) {
          incomingMessages.push(e);
        },
      },
    });

    expect(incomingMessages.length).toBe(2); // Setup message and goAway message.
    const liveServerMessage = incomingMessages[0];
    expect(liveServerMessage.goAway).toBeDefined();
    expect(liveServerMessage.goAway!.timeLeft).toBe('10s');
  });

  it('connect should send setup message with audio transcription config', async () => {
    const apiClient = new ApiClient({
      auth: new FakeAuth(),
      apiKey: 'test-api-key',
      uploader: new CrossUploader(),
      vertexai: true,
      project: 'test-project',
      location: 'test-location',
    });
    const websocketFactory = new FakeWebSocketFactory();
    const live = new Live(apiClient, new FakeAuth(), websocketFactory);

    let websocket = new FakeWebSocket(
      '',
      {},
      {
        onopen: function () {},
        onmessage: function (_e: MessageEvent) {},
        onerror: function (_e: ErrorEvent) {},
        onclose: function (_e: CloseEvent) {},
      },
    );
    spyOn(websocket, 'connect').and.callThrough();
    let websocketSpy = spyOn(websocket, 'send').and.callThrough();
    spyOn(websocketFactory, 'create').and.callFake(
      (url, headers, callbacks) => {
        // Update the websocket spy instance with callbacks provided by
        // the websocket factory.
        websocket = new FakeWebSocket(url, headers, callbacks);
        spyOn(websocket, 'connect').and.callThrough();
        websocketSpy = spyOn(websocket, 'send').and.callThrough();
        return websocket;
      },
    );

    const session = await live.connect({
      model: 'models/gemini-2.0-flash-live-001',
      config: {
        outputAudioTranscription: {},
      },
      callbacks: {
        onmessage: function (e: types.LiveServerMessage) {
          void e;
        },
      },
    });

    const websocketSpyCall = websocketSpy.calls.all()[0];
    expect(websocketSpyCall.args[0]).toBe(
      '{"setup":{"model":"models/gemini-2.0-flash-live-001","generationConfig":{"responseModalities":["AUDIO"]},"outputAudioTranscription":{}}}',
    );
    expect(session).toBeDefined();
  });

  it('session should return session resumption update message', async () => {
    const apiClient = new ApiClient({
      auth: new FakeAuth(),
      apiKey: 'test-api-key',
      uploader: new CrossUploader(),
    });
    const websocketFactory = new FakeWebSocketFactory();
    const live = new Live(apiClient, new FakeAuth(), websocketFactory);

    spyOn(websocketFactory, 'create').and.callFake(
      (url, headers, callbacks) => {
        const websocket = new FakeWebSocket(url, headers, callbacks);
        websocket.send(
          '{"sessionResumptionUpdate":{"newHandle": "test_handle", "resumable": true, "lastConsumedClientMessageIndex": "123456789"}}',
        );
        return websocket;
      },
    );

    const incomingMessages: types.LiveServerMessage[] = [];

    await live.connect({
      model: 'models/gemini-2.0-flash-live-001',
      callbacks: {
        onmessage: function (e: types.LiveServerMessage) {
          incomingMessages.push(e);
        },
      },
    });

    expect(incomingMessages.length).toBe(2); // Setup message and session resumption update message.
    const liveServerMessage = incomingMessages[0];
    expect(liveServerMessage.sessionResumptionUpdate).toBeDefined();
    expect(liveServerMessage.sessionResumptionUpdate!.newHandle).toBe(
      'test_handle',
    );
    expect(liveServerMessage.sessionResumptionUpdate!.resumable).toBe(true);
    expect(
      liveServerMessage.sessionResumptionUpdate!.lastConsumedClientMessageIndex,
    ).toBe('123456789');
  });

  it('Converters should block bad MimeTypes', async () => {
    const apiClient = new ApiClient({
      auth: new FakeAuth(),
      apiKey: 'test-api-key',
      uploader: new CrossUploader(),
    });

    expect(() => {
      converters.liveSendRealtimeInputParametersToMldev(apiClient, {
        audio: {data: 'AAAA', mimeType: 'image/png'},
      } as types.LiveSendRealtimeInputParameters);
    }).toThrowError(Error, 'Unsupported mime type: image/png');
  });
});

// TODO: b/395958466 - Add unit tests for Session.



================================================
FILE: test/unit/models_test.ts
================================================
import {z} from 'zod';

import {GoogleGenAI} from '../../src/client';
import {
  functionDeclarationFromZodFunction,
  responseSchemaFromZodType,
} from '../../src/schema_helper';
import * as types from '../../src/types';

const fetchOkOptions = {
  status: 200,
  statusText: 'OK',
  ok: true,
  headers: {'Content-Type': 'application/json'},
  url: 'some-url',
};

const mockGenerateContentResponse: types.GenerateContentResponse =
  Object.setPrototypeOf(
    {
      candidates: [
        {
          content: {
            parts: [
              {
                text: 'The',
              },
            ],
            role: 'model',
          },
          finishReason: types.FinishReason.STOP,
          index: 0,
        },
      ],
      usageMetadata: {
        promptTokenCount: 8,
        candidatesTokenCount: 1,
        totalTokenCount: 9,
      },
    },
    types.GenerateContentResponse.prototype,
  );

describe('generateContent', () => {
  describe('can use the results from responseSchemaFromZodType in responseSchema field', () => {
    it('should process simple zod object', async () => {
      const client = new GoogleGenAI({vertexai: false, apiKey: 'fake-api-key'});
      const zodSchema = z.object({
        simpleString: z.string(),
        stringDateTime: z.string().datetime(),
        stringWithLength: z.string().min(1).max(10),
        simpleNumber: z.number(),
        simpleInteger: z.number().int(),
        integerInt64: z.bigint(),
        numberWithMinMax: z.number().min(1).max(10),
        simpleBoolean: z.boolean(),
      });
      const expected: types.Schema = {
        type: types.Type.OBJECT,
        properties: {
          simpleString: {type: types.Type.STRING},
          stringDateTime: {type: types.Type.STRING, format: 'date-time'},
          stringWithLength: {
            type: types.Type.STRING,
            minLength: '1',
            maxLength: '10',
          },
          simpleNumber: {type: types.Type.NUMBER},
          simpleInteger: {type: types.Type.INTEGER},
          integerInt64: {type: types.Type.INTEGER, format: 'int64'},
          numberWithMinMax: {type: types.Type.NUMBER, minimum: 1, maximum: 10},
          simpleBoolean: {type: types.Type.BOOLEAN},
        },
        required: [
          'simpleString',
          'stringDateTime',
          'stringWithLength',
          'simpleNumber',
          'simpleInteger',
          'integerInt64',
          'numberWithMinMax',
          'simpleBoolean',
        ],
      };

      const fetchSpy = spyOn(global, 'fetch').and.returnValue(
        Promise.resolve(
          new Response(
            JSON.stringify(mockGenerateContentResponse),
            fetchOkOptions,
          ),
        ),
      );
      await client.models.generateContent({
        model: 'gemini-1.5-flash-exp',
        contents: 'why is the sky blue?',
        config: {
          responseSchema: responseSchemaFromZodType(client.vertexai, zodSchema),
        },
      });
      const parsedSchema = (
        (
          JSON.parse(
            fetchSpy.calls.allArgs()[0][1]?.['body'] as string,
          ) as Record<string, unknown>
        )['generationConfig']! as Record<string, unknown>
      )['responseSchema'];
      expect(parsedSchema).toEqual(expected);
    });
    it('should process zod object with nested objects', async () => {
      const client = new GoogleGenAI({vertexai: false, apiKey: 'fake-api-key'});
      const innerObject = z.object({
        innerString: z.string(),
        innerNumber: z.number(),
      });
      const nestedSchema = z.object({
        simpleString: z.string(),
        stringDateTime: z.string().datetime(),
        stringWithLength: z.string().min(1).max(10),
        nestedObject: innerObject,
      });
      const expected: types.Schema = {
        type: types.Type.OBJECT,
        properties: {
          simpleString: {type: types.Type.STRING},
          stringDateTime: {type: types.Type.STRING, format: 'date-time'},
          stringWithLength: {
            type: types.Type.STRING,
            minLength: '1',
            maxLength: '10',
          },
          nestedObject: {
            type: types.Type.OBJECT,
            properties: {
              innerString: {type: types.Type.STRING},
              innerNumber: {type: types.Type.NUMBER},
            },
            required: ['innerString', 'innerNumber'],
          },
        },
        required: [
          'simpleString',
          'stringDateTime',
          'stringWithLength',
          'nestedObject',
        ],
      };
      const fetchSpy = spyOn(global, 'fetch').and.returnValue(
        Promise.resolve(
          new Response(
            JSON.stringify(mockGenerateContentResponse),
            fetchOkOptions,
          ),
        ),
      );
      await client.models.generateContent({
        model: 'gemini-1.5-flash-exp',
        contents: 'why is the sky blue?',
        config: {
          responseSchema: responseSchemaFromZodType(
            client.vertexai,
            nestedSchema,
          ),
        },
      });
      const parsedSchema = (
        (
          JSON.parse(
            fetchSpy.calls.allArgs()[0][1]?.['body'] as string,
          ) as Record<string, unknown>
        )['generationConfig']! as Record<string, unknown>
      )['responseSchema'];
      expect(parsedSchema).toEqual(expected);
    });
  });
  describe('can use the results from functionDeclarationFromZodFunction in functionDeclarations field', () => {
    it('should not throw error when wrapping zod function with the helper function', async () => {
      const client = new GoogleGenAI({vertexai: false, apiKey: 'fake-api-key'});
      const zodFunction = z
        .function()
        .args(z.object({numberField: z.number()}))
        .returns(z.void())
        .describe('this is a setParameter function');

      const expected: types.FunctionDeclaration = {
        description: 'this is a setParameter function',
        name: 'setParameterFunction',
        parameters: {
          type: types.Type.OBJECT,
          properties: {
            numberField: {
              type: types.Type.NUMBER,
            },
          },
          required: ['numberField'],
        },
      };

      const fetchSpy = spyOn(global, 'fetch').and.returnValue(
        Promise.resolve(
          new Response(
            JSON.stringify(mockGenerateContentResponse),
            fetchOkOptions,
          ),
        ),
      );

      await client.models.generateContent({
        model: 'gemini-1.5-flash-exp',
        contents: 'Dim the lights so the room feels cozy and warm.',
        config: {
          tools: [
            {
              functionDeclarations: [
                functionDeclarationFromZodFunction(client.vertexai, {
                  name: 'setParameterFunction',
                  zodFunctionSchema: zodFunction,
                }),
              ],
            },
          ],
          toolConfig: {
            functionCallingConfig: {
              mode: types.FunctionCallingConfigMode.ANY,
              allowedFunctionNames: ['setParameterFunction'],
            },
          },
        },
      });

      const parsedTools = (
        JSON.parse(
          fetchSpy.calls.allArgs()[0][1]?.['body'] as string,
        ) as Record<string, unknown>
      )['tools'] as unknown[];
      const parsedFunctionDeclarations = (
        (parsedTools[0] as Record<string, unknown>)[
          'functionDeclarations'
        ] as unknown[]
      )[0];

      expect(parsedFunctionDeclarations).toEqual(expected);
    });
  });
});



================================================
FILE: test/unit/pagers_test.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {PagedItem, Pager} from '../../src/pagers';
import {File, ListFilesParameters, ListFilesResponse} from '../../src/types';

class FakeFiles {
  private responseIndex = 0;
  constructor(private readonly responses: ListFilesResponse[]) {}

  list = async (params: ListFilesParameters = {}): Promise<Pager<File>> => {
    return new Pager<File>(
      PagedItem.PAGED_ITEM_FILES,
      (x: ListFilesParameters) => this.listInternal(x),
      await this.listInternal(params),
      params,
    );
  };

  private async listInternal(
    _params: ListFilesParameters,
  ): Promise<ListFilesResponse> {
    return Promise.resolve(this.responses[this.responseIndex++]);
  }
}

function buildListFilesResponse(
  pageIndex: string,
  numOfFiles: number,
  nextPageToken?: string,
): ListFilesResponse {
  const files = [];
  for (let i = 1; i <= numOfFiles; i++) {
    files.push({name: `files/${pageIndex}/${i}`} as File);
  }
  return {nextPageToken, files} as ListFilesResponse;
}

describe('Iterate items', () => {
  const testCases = [
    {
      name: 'empty response',
      params: {},
      responses: [new ListFilesResponse()],
      expectedFiles: [],
      expectedPages: 1,
    },
    {
      name: 'page size smaller than total files size',
      params: {config: {pageSize: 2}},
      responses: [
        buildListFilesResponse('page1', 2, 'token1'),
        buildListFilesResponse('page2', 1),
      ],
      expectedFiles: ['files/page1/1', 'files/page1/2', 'files/page2/1'],
      expectedPages: 2,
    },
    {
      name: 'page size greater than total files size',
      params: {config: {pageSize: 5}},
      responses: [buildListFilesResponse('page1', 2)],
      expectedFiles: ['files/page1/1', 'files/page1/2'],
      expectedPages: 1,
    },
    {
      name: 'page size equals to total files size',
      params: {config: {pageSize: 2}},
      responses: [buildListFilesResponse('page1', 2)],
      expectedFiles: ['files/page1/1', 'files/page1/2'],
      expectedPages: 1,
    },
  ];

  testCases.forEach(async (testCase) => {
    it(testCase.name + ' with iterator', async () => {
      const files = new FakeFiles(testCase.responses);
      const pager = await files.list(testCase.params);

      const fileNames = [];
      for await (const file of pager) {
        fileNames.push(file.name);
      }

      expect(fileNames).toEqual(testCase.expectedFiles);
    });

    it(testCase.name + ' with pager', async () => {
      const files = new FakeFiles(testCase.responses);
      const pager = await files.list(testCase.params);

      const fileNames = [];
      let page = pager.page;
      for (const file of page) {
        fileNames.push(file.name);
      }
      let numOfPages = 1;
      while (pager.hasNextPage()) {
        page = await pager.nextPage();
        numOfPages++;
        for (const file of page) {
          fileNames.push(file.name);
        }
      }

      expect(fileNames).toEqual(testCase.expectedFiles);
      expect(numOfPages).toEqual(testCase.expectedPages);
    });
  });
});

describe('Pager properties', () => {
  it('init values', async () => {
    const firstPageResponse = buildListFilesResponse('page1', 2, 'token1');
    const secondPageResponse = buildListFilesResponse('page2', 2);
    const params = {config: {pageSize: 10}};
    const pager = new Pager<File>(
      PagedItem.PAGED_ITEM_FILES,
      (_unused: ListFilesParameters) => Promise.resolve(secondPageResponse),
      firstPageResponse,
      params,
    );

    expect(pager.page).toEqual(firstPageResponse['files'] as File[]);
    expect(pager.name).toEqual('files');
    expect(pager.pageSize).toEqual(10);
    expect(pager.params).toEqual(params);
    expect(pager.pageLength).toEqual(2);
    expect(pager.getItem(0)).toEqual({name: 'files/page1/1'});
  });

  it('next page', async () => {
    const firstPageResponse = buildListFilesResponse('page1', 2, 'token1');
    const secondPageResponse = buildListFilesResponse('page2', 1);
    const params = {config: {pageSize: 10}};
    const pager = new Pager<File>(
      PagedItem.PAGED_ITEM_FILES,
      (_unused: ListFilesParameters) => Promise.resolve(secondPageResponse),
      firstPageResponse,
      params,
    );
    await pager.nextPage();

    expect(pager.page).toEqual(secondPageResponse['files'] as File[]);
    expect(pager.name).toEqual('files');
    expect(pager.pageSize).toEqual(10);
    expect(pager.params).toEqual(params);
    expect(pager.pageLength).toEqual(1);
    expect(pager.getItem(0)).toEqual({name: 'files/page2/1'});
  });
});



================================================
FILE: test/unit/schema_helper_test.ts
================================================
import {z, ZodError} from 'zod';

import {
  functionDeclarationFromZodFunction,
  responseSchemaFromZodType,
} from '../../src/schema_helper';
import * as types from '../../src/types';
describe('schema helper', () => {
  describe('responseSchemaFromZodType can convert zod schema to Google AI schema', () => {
    // throw zod error whe item is not JSONSchema.
    it('should throw zod error for tuple schema due to item field data type mismatch', () => {
      const tupleSchema = z.object({
        tupleField: z.tuple([z.string(), z.number()]),
      });
      expect(() => responseSchemaFromZodType(true, tupleSchema)).toThrowError(
        ZodError,
      );
      expect(() => responseSchemaFromZodType(false, tupleSchema)).toThrowError(
        ZodError,
      );
    });
    it('should throw zod error for set schema due to unsupported property: uniqueItems', () => {
      const setSchema = z.object({
        setField: z.set(z.string()),
      });
      expect(() => responseSchemaFromZodType(true, setSchema)).toThrowError(
        ZodError,
      );
      expect(() => responseSchemaFromZodType(false, setSchema)).toThrowError(
        ZodError,
      );
    });
    it('should not throw zod error for supported schema.', () => {
      const supportedSchema = z.object({
        simpleString: z.string().describe('This is a simple string'),
        stringWithRegex: z.string().regex(/^[a-zA-Z]{1,10}$/),
        stringDateTime: z.string().datetime(),
        stringWithEnum: z.enum(['enumvalue1', 'enumvalue2', 'enumvalue3']),
        stringWithLength: z.string().min(1).max(10),
        simpleNumber: z.number(),
        simpleInteger: z.number().int(),
        integerInt64: z.bigint(),
        numberWithMinMax: z.number().min(1).max(10),
        simpleBoolean: z.boolean(),
      });
      expect(() =>
        responseSchemaFromZodType(true, supportedSchema),
      ).not.toThrowError(ZodError);
      expect(() =>
        responseSchemaFromZodType(false, supportedSchema),
      ).not.toThrowError(ZodError);
    });
    it('should throw zod error for nested zod object referred twice due to unsupported property: $ref', () => {
      const innerObject = z.object({
        innerString: z.string(),
        innerNumber: z.number(),
      });
      const nestedSchema = z.object({
        simpleString: z.string().describe('This is a simple string'),
        simpleInteger: z.number().int(),
        inner: innerObject,
        notherInner: innerObject,
      });
      expect(() => responseSchemaFromZodType(true, nestedSchema)).toThrowError(
        ZodError,
      );
      expect(() => responseSchemaFromZodType(false, nestedSchema)).toThrowError(
        ZodError,
      );
    });
    it('should throw zod error for all fields that failed validation together', () => {
      const unsupportedSchema = z.object({
        setField: z.set(z.string()),
        tupleField: z.tuple([z.string(), z.number()]),
        recordField: z.record(z.string()),
      });
      //  ZodError: [
      //   {
      //     "code": "unrecognized_keys",
      //     "keys": [
      //       "uniqueItems"
      //     ],
      //     "path": [
      //       "properties",
      //       "setField"
      //     ],
      //     "message": "Unrecognized key(s) in object: 'uniqueItems'"
      //   },
      //   {
      //     "code": "invalid_type",
      //     "expected": "object",
      //     "received": "array",
      //     "path": [
      //       "properties",
      //       "tupleField",
      //       "items"
      //     ],
      //     "message": "Expected object, received array"
      //   },
      //   {
      //     "code": "invalid_type",
      //     "expected": "boolean",
      //     "received": "object",
      //     "path": [
      //       "properties",
      //       "recordField",
      //       "additionalProperties"
      //     ],
      //     "message": "Expected boolean, received object"
      //   }
      // ]
      // Above is the error message from responseSchemaFromZodType, it lists all
      // incompatible fields
      let vertextZodError: ZodError = new ZodError([]);
      try {
        responseSchemaFromZodType(true, unsupportedSchema);
      } catch (error) {
        vertextZodError = error as ZodError;
      }
      expect(() =>
        responseSchemaFromZodType(true, unsupportedSchema),
      ).toThrowError(ZodError);
      expect(vertextZodError.errors.length).toBe(3);

      let genaiZodError: ZodError = new ZodError([]);
      try {
        responseSchemaFromZodType(false, unsupportedSchema);
      } catch (error) {
        genaiZodError = error as ZodError;
      }
      expect(() =>
        responseSchemaFromZodType(false, unsupportedSchema),
      ).toThrowError(ZodError);
      expect(genaiZodError.errors.length).toBe(3);
    });
    it('should process simple zod object, with optional fields', () => {
      const zodSchema = z.object({
        // required, properties, type: object
        simpleString: z.string().describe('This is a simple string'), // description, type: string
        stringWithRegex: z.string().regex(/^[a-zA-Z]{1,10}$/), // regex, type: string
        stringDateTime: z.string().datetime(), // format: date-time, type: string
        stringWithEnum: z.enum(['enumvalue1', 'enumvalue2', 'enumvalue3']), // enum, type: string
        stringWithLength: z.string().min(1).max(10), // minLength, maxLength, type: string
        optionalNumber: z.number().optional(), // optional,type: number
        simpleNumber: z.number(), // type: number
        simpleInteger: z.number().int(), // type: integer
        integerInt64: z.bigint(), // format: int64, type: integer
        numberWithMinMax: z.number().min(1).max(10), // minimum, maximum, type: number
        simpleBoolean: z.boolean(), // type: boolean
        optionalBoolean: z.boolean().optional(), // optional, type: boolean
      });
      const expected: types.Schema = {
        type: types.Type.OBJECT,
        properties: {
          simpleString: {
            type: types.Type.STRING,
            description: 'This is a simple string',
          },
          stringWithRegex: {
            type: types.Type.STRING,
            pattern: '^[a-zA-Z]{1,10}$',
          },
          stringDateTime: {type: types.Type.STRING, format: 'date-time'},
          stringWithEnum: {
            type: types.Type.STRING,
            format: 'enum',
            enum: ['enumvalue1', 'enumvalue2', 'enumvalue3'],
          },
          stringWithLength: {
            type: types.Type.STRING,
            minLength: '1',
            maxLength: '10',
          },
          optionalNumber: {type: types.Type.NUMBER},
          simpleNumber: {type: types.Type.NUMBER},
          simpleInteger: {type: types.Type.INTEGER},
          integerInt64: {type: types.Type.INTEGER, format: 'int64'},
          numberWithMinMax: {type: types.Type.NUMBER, minimum: 1, maximum: 10},
          simpleBoolean: {type: types.Type.BOOLEAN},
          optionalBoolean: {type: types.Type.BOOLEAN},
        },
        required: [
          'simpleString',
          'stringWithRegex',
          'stringDateTime',
          'stringWithEnum',
          'stringWithLength',
          'simpleNumber',
          'simpleInteger',
          'integerInt64',
          'numberWithMinMax',
          'simpleBoolean',
        ],
      };
      expect(responseSchemaFromZodType(false, zodSchema)).toEqual(expected);
      expect(responseSchemaFromZodType(true, zodSchema)).toEqual(expected);
    });
    it('should process nested zod object if it was only referred once', () => {
      const innerObject = z.object({
        innerString: z.string(),
        innerNumber: z.number(),
      });
      const nestedSchema = z.object({
        simpleString: z.string().describe('This is a simple string'),
        simpleInteger: z.number().int(),
        inner: innerObject,
      });

      const expected: types.Schema = {
        type: types.Type.OBJECT,
        properties: {
          simpleString: {
            type: types.Type.STRING,
            description: 'This is a simple string',
          },
          simpleInteger: {type: types.Type.INTEGER},
          inner: {
            type: types.Type.OBJECT,
            properties: {
              innerString: {
                type: types.Type.STRING,
              },
              innerNumber: {type: types.Type.NUMBER},
            },
            required: ['innerString', 'innerNumber'],
          },
        },
        required: ['simpleString', 'simpleInteger', 'inner'],
      };
      expect(responseSchemaFromZodType(false, nestedSchema)).toEqual(expected);
      expect(responseSchemaFromZodType(true, nestedSchema)).toEqual(expected);
    });
    it('should process primitive types directly', () => {
      const stringDirectly = z
        .string()
        .min(1)
        .max(10)
        .regex(/^[a-zA-Z]{1,10}$/)
        .describe('This is a simple string');
      const numberDirectly = z
        .number()
        .min(1)
        .max(10)
        .describe('This is a simple number');
      const integerDirectly = z.bigint().describe('This is a simple integer');
      const booleanDirectly = z.boolean().describe('This is a simple boolean');

      const expectedStringDirectly = {
        type: types.Type.STRING,
        minLength: '1',
        maxLength: '10',
        pattern: '^[a-zA-Z]{1,10}$',
        description: 'This is a simple string',
      };
      expect(responseSchemaFromZodType(false, stringDirectly)).toEqual(
        expectedStringDirectly,
      );
      expect(responseSchemaFromZodType(true, stringDirectly)).toEqual(
        expectedStringDirectly,
      );

      const expectedNumberDirectly = {
        type: types.Type.NUMBER,
        minimum: 1,
        maximum: 10,
        description: 'This is a simple number',
      };
      expect(responseSchemaFromZodType(false, numberDirectly)).toEqual(
        expectedNumberDirectly,
      );
      expect(responseSchemaFromZodType(true, numberDirectly)).toEqual(
        expectedNumberDirectly,
      );

      const expectedIntegerDirectly = {
        type: types.Type.INTEGER,
        format: 'int64',
        description: 'This is a simple integer',
      };
      expect(responseSchemaFromZodType(false, integerDirectly)).toEqual(
        expectedIntegerDirectly,
      );
      expect(responseSchemaFromZodType(true, integerDirectly)).toEqual(
        expectedIntegerDirectly,
      );

      const expectedBooleanDirectly = {
        type: types.Type.BOOLEAN,
        description: 'This is a simple boolean',
      };
      expect(responseSchemaFromZodType(false, booleanDirectly)).toEqual(
        expectedBooleanDirectly,
      );
      expect(responseSchemaFromZodType(true, booleanDirectly)).toEqual(
        expectedBooleanDirectly,
      );
    });
    it('should process array of primitives', () => {
      const zodSchema = z.object({
        // items, type: array
        stringArray: z.array(z.string()).max(10).min(1),
        numberArray: z.array(z.number()).max(15).min(6),
      });

      const expected = {
        type: types.Type.OBJECT,
        properties: {
          stringArray: {
            type: types.Type.ARRAY,
            minItems: '1',
            maxItems: '10',
            items: {
              type: types.Type.STRING,
            },
          },
          numberArray: {
            type: types.Type.ARRAY,
            minItems: '6',
            maxItems: '15',
            items: {
              type: types.Type.NUMBER,
            },
          },
        },
        required: ['stringArray', 'numberArray'],
      };

      expect(responseSchemaFromZodType(true, zodSchema)).toEqual(expected);
      expect(responseSchemaFromZodType(false, zodSchema)).toEqual(expected);
    });
    it('should process zod array of objects', () => {
      const innerObject = z.object({
        simpleString: z.string(),
        anotherString: z.string(),
      });
      const objectArray = z.object({
        arrayOfObjects: z.array(innerObject),
      });
      expect(responseSchemaFromZodType(true, objectArray)).toEqual({
        type: types.Type.OBJECT,
        properties: {
          arrayOfObjects: {
            type: types.Type.ARRAY,
            items: {
              type: types.Type.OBJECT,
              properties: {
                simpleString: {
                  type: types.Type.STRING,
                },
                anotherString: {type: types.Type.STRING},
              },
              required: ['simpleString', 'anotherString'],
            },
          },
        },
        required: ['arrayOfObjects'],
      });
    });
    it('ML dev should throw error and vertex ai should not throw error for when there is default value', () => {
      const innerObject = z.object({
        simpleString: z.string().default('default'),
        anotherString: z.string(),
      });
      const objectArray = z.object({
        arrayOfObjects: z.array(innerObject),
      });
      expect(() => responseSchemaFromZodType(false, objectArray)).toThrowError(
        'Default value is not supported for Gemini API.',
      );
      expect(responseSchemaFromZodType(true, objectArray)).toEqual({
        type: types.Type.OBJECT,
        properties: {
          arrayOfObjects: {
            type: types.Type.ARRAY,
            items: {
              type: types.Type.OBJECT,
              properties: {
                simpleString: {
                  type: types.Type.STRING,
                  default: 'default',
                },
                anotherString: {type: types.Type.STRING},
              },
              required: ['anotherString'],
            },
          },
        },
        required: ['arrayOfObjects'],
      });
    });
    it('should process primitive nullables', () => {
      /*
      Resulted JSONSchema:
      {
        type: 'object',
        properties: { nullablePrimitives: { type: [string, null] } },
        required: [ 'nullablePrimitives' ],
        additionalProperties: false
      }
      */
      const objectNullable = z.object({
        nullablePrimitives: z.string().nullable(),
      });

      const expected = {
        type: types.Type.OBJECT,
        properties: {
          nullablePrimitives: {
            type: types.Type.STRING,
            nullable: true,
          },
        },
        required: ['nullablePrimitives'],
      };
      expect(responseSchemaFromZodType(true, objectNullable)).toEqual(expected);
      expect(responseSchemaFromZodType(false, objectNullable)).toEqual(
        expected,
      );
    });
    it('should throw error when there is only null in the type', () => {
      const objectNullable = z.object({
        nullValue: z.null(),
      });

      expect(() =>
        responseSchemaFromZodType(true, objectNullable),
      ).toThrowError(
        'type: null can not be the only possible type for the field.',
      );
      expect(() =>
        responseSchemaFromZodType(false, objectNullable),
      ).toThrowError(
        'type: null can not be the only possible type for the field.',
      );
    });
    it('should process nullable array and remove anyOf filed when necessary', () => {
      /*
         Resulted JSONSchema:
         { anyOf: [ { type: 'array', items: {type: 'string'} }, { type: 'null' }
         ]
         }
         */
      const nullableArray = z.array(z.string()).nullable();
      const expected = {
        type: types.Type.ARRAY,
        items: {
          type: types.Type.STRING,
        },
        nullable: true,
      };
      expect(responseSchemaFromZodType(true, nullableArray)).toEqual(expected);
      expect(responseSchemaFromZodType(false, nullableArray)).toEqual(expected);
    });
    it('should process nullable object and remove anyOf filed when necessary', () => {
      /*
         Resulted JSONSchema:
         {
           type: 'object',
           properties: { nullableObject: { anyOf: [{ type: 'object',
         properties: { simpleString: { type: 'string' } } }, { type: 'null' } ]
         } }, required: [ 'nullableObject' ], additionalProperties: false
         }
         */
      const innerObject = z.object({
        simpleString: z.string().nullable(),
      });
      const objectNullable = z.object({
        nullableObject: innerObject.nullable(),
      });

      const expected = {
        type: types.Type.OBJECT,
        properties: {
          nullableObject: {
            type: types.Type.OBJECT,
            properties: {
              simpleString: {
                type: types.Type.STRING,
                nullable: true,
              },
            },
            required: ['simpleString'],
            nullable: true,
          },
        },
        required: ['nullableObject'],
      };
      expect(responseSchemaFromZodType(true, objectNullable)).toEqual(expected);
      expect(responseSchemaFromZodType(false, objectNullable)).toEqual(
        expected,
      );
    });
    it('should process union consist of only not-nullable primitive types without additional fields', () => {
      /*
          Resulted JSONSchema:
          {
           type: 'object',
           properties: { unionPrimitivesField: { type: [string, number, boolean]
          }
          }, required: [ 'unionPrimitivesField' ], additionalProperties: false
          }
          */
      const unionPrimitives = z.object({
        unionPrimitivesField: z.union([z.string(), z.number(), z.boolean()]),
      });

      const expected = {
        type: types.Type.OBJECT,
        properties: {
          unionPrimitivesField: {
            anyOf: [
              {type: types.Type.STRING},
              {type: types.Type.NUMBER},
              {type: types.Type.BOOLEAN},
            ],
          },
        },
        required: ['unionPrimitivesField'],
      };
      expect(responseSchemaFromZodType(true, unionPrimitives)).toEqual(
        expected,
      );
      expect(responseSchemaFromZodType(false, unionPrimitives)).toEqual(
        expected,
      );
    });
    it('should process union consist of only not-nullable primitive types without additional fields, one of the union type is null', () => {
      /*
         Resulted JSONSchema:
         {
           type: 'object',
           properties: { unionPrimitivesField: { type: [string, number, null] }
         }, equired: [ 'unionPrimitivesField' ], additionalProperties: false
         }
         */
      const unionPrimitives = z.object({
        unionPrimitivesField: z.union([z.string(), z.number(), z.null()]),
      });

      const expected = {
        type: types.Type.OBJECT,
        properties: {
          unionPrimitivesField: {
            anyOf: [{type: types.Type.STRING}, {type: types.Type.NUMBER}],
            nullable: true,
          },
        },
        required: ['unionPrimitivesField'],
      };
      expect(responseSchemaFromZodType(true, unionPrimitives)).toEqual(
        expected,
      );
      expect(responseSchemaFromZodType(false, unionPrimitives)).toEqual(
        expected,
      );
    });
    it('should process union primitive types, one of the union type is nullable, and one of the union type is null', () => {
      /*
          Resulted JSONSchema:
         {
         type: 'object',
         properties: { unionPrimitivesField: { anyOf: [{ type: [string,
         null]}, { type: 'number' }, { type: 'null' }] } }, required: [
         'unionPrimitivesField' ], additionalProperties: false
         }
          */
      const unionPrimitives = z.object({
        unionPrimitivesField: z.union([
          z.string().nullable(),
          z.number(),
          z.null(),
        ]),
      });

      const expected = {
        type: types.Type.OBJECT,
        properties: {
          unionPrimitivesField: {
            anyOf: [
              {type: types.Type.STRING, nullable: true},
              {type: types.Type.NUMBER},
            ],
            nullable: true,
          },
        },
        required: ['unionPrimitivesField'],
      };
      expect(responseSchemaFromZodType(true, unionPrimitives)).toEqual(
        expected,
      );
      expect(responseSchemaFromZodType(false, unionPrimitives)).toEqual(
        expected,
      );
    });
    it('should process union primitive types, when types in the union are primitives without any additional fields, one of them is nullable', () => {
      /*
          Resulted JSONSchema:
          {
          type: 'object',
          properties: { unionPrimitivesField: { anyOf: [{ type: [string,
          null]}, { type: 'number' }] } }, required: [ 'unionPrimitivesField' ],
          additionalProperties: false
          }
          */
      const unionPrimitives = z.object({
        unionPrimitivesField: z.union([z.string().nullable(), z.number()]),
      });

      const expected = {
        type: types.Type.OBJECT,
        properties: {
          unionPrimitivesField: {
            anyOf: [
              {type: types.Type.STRING, nullable: true},
              {type: types.Type.NUMBER},
            ],
          },
        },
        required: ['unionPrimitivesField'],
      };
      expect(responseSchemaFromZodType(true, unionPrimitives)).toEqual(
        expected,
      );
      expect(responseSchemaFromZodType(false, unionPrimitives)).toEqual(
        expected,
      );
    });
    it('should process union primitive types, when types in the union are primitives without any additional fields, both of them is nullable', () => {
      /*
         Resulted JSONSchema:
         {
           type: 'object',
           properties: { unionPrimitivesField: { anyOf: [{ type: [string,
           null]}, { type: [number, null] }] } }, required: [
           'unionPrimitivesField' ], additionalProperties: false
         }
         */
      const unionPrimitives = z.object({
        unionPrimitivesField: z.union([
          z.string().nullable(),
          z.number().nullable(),
        ]),
      });

      const expected = {
        type: types.Type.OBJECT,
        properties: {
          unionPrimitivesField: {
            anyOf: [
              {type: types.Type.STRING, nullable: true},
              {type: types.Type.NUMBER, nullable: true},
            ],
          },
        },
        required: ['unionPrimitivesField'],
      };
      expect(responseSchemaFromZodType(true, unionPrimitives)).toEqual(
        expected,
      );
      expect(responseSchemaFromZodType(false, unionPrimitives)).toEqual(
        expected,
      );
    });
    it('should process union primitive types, when types in the union are primitives with additional fields, not nullable', () => {
      /*
               Resulted JSONSchema:
               {
                type: 'object',
                properties: { unionPrimitivesField: { anyOf: [{type: 'string',
               pattern: '^[a-zA-Z]{1,10}$'}, {type: 'number'}}] } }, required: [
               'unionPrimitivesField' ], additionalProperties: false
               }
               */
      const unionPrimitives = z.object({
        unionPrimitivesField: z.union([
          z.string().regex(/^[a-zA-Z]{1,10}$/),
          z.number(),
        ]),
      });

      const expected = {
        type: types.Type.OBJECT,
        properties: {
          unionPrimitivesField: {
            anyOf: [
              {
                type: types.Type.STRING,
                pattern: '^[a-zA-Z]{1,10}$',
              },
              {type: types.Type.NUMBER},
            ],
          },
        },
        required: ['unionPrimitivesField'],
      };
      expect(responseSchemaFromZodType(true, unionPrimitives)).toEqual(
        expected,
      );
      expect(responseSchemaFromZodType(false, unionPrimitives)).toEqual(
        expected,
      );
    });
    it('should process union objects', () => {
      /*
      Resulted JSONSchema:
      {
      type: 'object',
      properties: { unionPrimitivesField: { anyOf: [Array] } },
      required: [ 'unionPrimitivesField' ],
      additionalProperties: false
      }
      */
      const innerObject = z.object({
        simpleString: z.string(),
      });
      const unionPrimitivesAndObjects = z.object({
        unionPrimitivesObjectsField: z.union([
          z.string(),
          z.number(),
          innerObject,
        ]),
      });

      const expected = {
        type: types.Type.OBJECT,
        properties: {
          unionPrimitivesObjectsField: {
            anyOf: [
              {type: types.Type.STRING},
              {type: types.Type.NUMBER},
              {
                type: types.Type.OBJECT,
                properties: {
                  simpleString: {
                    type: types.Type.STRING,
                  },
                },
                required: ['simpleString'],
              },
            ],
          },
        },
        required: ['unionPrimitivesObjectsField'],
      };
      expect(
        responseSchemaFromZodType(true, unionPrimitivesAndObjects),
      ).toEqual(expected);
      expect(
        responseSchemaFromZodType(false, unionPrimitivesAndObjects),
      ).toEqual(expected);
    });
    it('should process union array and objects', () => {
      /*
      Resulted JSONSchema:
      {
      type: 'object',
      properties: { uninonField: { anyOf: [Array, Object] } },
      required: [ 'uninonField' ],
      additionalProperties: false
      }
      */
      const innerObject = z.object({
        simpleString: z.string(),
      });
      const uninonArrayAndObjects = z.object({
        uninonField: z.union([z.array(z.string()), innerObject]),
      });

      const expected = {
        type: types.Type.OBJECT,
        properties: {
          uninonField: {
            anyOf: [
              {
                type: types.Type.ARRAY,
                items: {
                  type: types.Type.STRING,
                },
              },
              {
                type: types.Type.OBJECT,
                properties: {
                  simpleString: {
                    type: types.Type.STRING,
                  },
                },
                required: ['simpleString'],
              },
            ],
          },
        },
        required: ['uninonField'],
      };
      expect(responseSchemaFromZodType(true, uninonArrayAndObjects)).toEqual(
        expected,
      );
      expect(responseSchemaFromZodType(false, uninonArrayAndObjects)).toEqual(
        expected,
      );
    });
  });
  describe('functionDeclarationFromZodFunction can convert zod function to FunctionDeclaration', () => {
    it('throw error when the function has more than one parameter value', () => {
      const testParameter = z.object({
        numberField: z
          .number()
          .min(0)
          .max(100)
          .describe('this is a number field'),
      });
      const setParameterFunction = z
        .function()
        .args(testParameter, z.string())
        .returns(z.void())
        .describe('this is a setParameter function');

      expect(() => {
        functionDeclarationFromZodFunction(true, {
          name: 'setParameterFunction',
          zodFunctionSchema: setParameterFunction,
        });
      }).toThrowError(
        'Multiple positional parameters are not supported at the moment. Function parameters must be defined using a single object with named properties.',
      );
      expect(() => {
        functionDeclarationFromZodFunction(false, {
          name: 'setParameterFunction',
          zodFunctionSchema: setParameterFunction,
        });
      }).toThrowError(
        'Multiple positional parameters are not supported at the moment. Function parameters must be defined using a single object with named properties.',
      );
    });
    it('throw error when the function parameter is not object', () => {
      const setParameterFunction = z
        .function()
        .args(z.string())
        .returns(z.void())
        .describe('this is a setParameter function');

      expect(() => {
        functionDeclarationFromZodFunction(true, {
          name: 'setParameterFunction',
          zodFunctionSchema: setParameterFunction,
        });
      }).toThrowError(
        'Function parameter is not object and not void, please check the parameter type.',
      );
      expect(() => {
        functionDeclarationFromZodFunction(false, {
          name: 'setParameterFunction',
          zodFunctionSchema: setParameterFunction,
        });
      }).toThrowError(
        'Function parameter is not object and not void, please check the parameter type.',
      );
    });
    it('should process function with object parameters and return value', () => {
      const setParameter = z.object({
        numberField: z
          .number()
          .min(0)
          .max(100)
          .describe('this is a number field'),
        stringEnumField: z
          .enum(['daylight', 'cool', 'warm'])
          .describe('this is a string enum field'),
        booleanField: z.boolean().describe('this is a boolean field'),
      });

      const returnValue = z.object({
        numberField: z
          .number()
          .min(0)
          .max(100)
          .describe('this is a return number field'),
      });
      const setParameterFunction = z
        .function()
        .args(setParameter)
        .returns(returnValue)
        .describe('this is a setParameter function');

      const expected = {
        description: 'this is a setParameter function',
        name: 'setParameterFunction',
        parameters: {
          type: types.Type.OBJECT,
          properties: {
            numberField: {
              type: types.Type.NUMBER,
              minimum: 0,
              maximum: 100,
              description: 'this is a number field',
            },
            stringEnumField: {
              type: types.Type.STRING,
              enum: ['daylight', 'cool', 'warm'],
              format: 'enum',
              description: 'this is a string enum field',
            },
            booleanField: {
              type: types.Type.BOOLEAN,
              description: 'this is a boolean field',
            },
          },
          required: ['numberField', 'stringEnumField', 'booleanField'],
        },
        response: {
          type: types.Type.OBJECT,
          properties: {
            numberField: {
              type: types.Type.NUMBER,
              minimum: 0,
              maximum: 100,
              description: 'this is a return number field',
            },
          },
          required: ['numberField'],
        },
      };
      expect(
        functionDeclarationFromZodFunction(true, {
          name: 'setParameterFunction',
          zodFunctionSchema: setParameterFunction,
        }),
      ).toEqual(expected);
      expect(
        functionDeclarationFromZodFunction(false, {
          name: 'setParameterFunction',
          zodFunctionSchema: setParameterFunction,
        }),
      ).toEqual(expected);
    });
    it('should process function with object parameters that have two fields with the same type', () => {
      const setParameter = z.object({
        numberFieldOne: z
          .number()
          .min(0)
          .max(100)
          .describe('this is a number field'),
        numberFieldTwo: z
          .number()
          .min(0)
          .max(100)
          .describe('this is the other number field'),
      });

      const returnValue = z.object({
        numberField: z
          .number()
          .min(0)
          .max(100)
          .describe('this is a return number field'),
      });
      const setParameterFunction = z
        .function()
        .args(setParameter)
        .returns(returnValue)
        .describe('this is a setParameter function');

      const expected = {
        description: 'this is a setParameter function',
        name: 'setParameterFunction',
        parameters: {
          type: types.Type.OBJECT,
          properties: {
            numberFieldOne: {
              type: types.Type.NUMBER,
              minimum: 0,
              maximum: 100,
              description: 'this is a number field',
            },
            numberFieldTwo: {
              type: types.Type.NUMBER,
              minimum: 0,
              maximum: 100,
              description: 'this is the other number field',
            },
          },
          required: ['numberFieldOne', 'numberFieldTwo'],
        },
        response: {
          type: types.Type.OBJECT,
          properties: {
            numberField: {
              type: types.Type.NUMBER,
              minimum: 0,
              maximum: 100,
              description: 'this is a return number field',
            },
          },
          required: ['numberField'],
        },
      };
      expect(
        functionDeclarationFromZodFunction(true, {
          name: 'setParameterFunction',
          zodFunctionSchema: setParameterFunction,
        }),
      ).toEqual(expected);
      expect(
        functionDeclarationFromZodFunction(false, {
          name: 'setParameterFunction',
          zodFunctionSchema: setParameterFunction,
        }),
      ).toEqual(expected);
    });
    it('should process function with void as parameters and have return value', () => {
      const returnValue = z.object({
        numberField: z
          .number()
          .min(0)
          .max(100)
          .describe('this is a return number field'),
      });
      const setParameterFunction = z
        .function()
        .args(z.void())
        .returns(returnValue)
        .describe('this is a setParameter function');

      const expected = {
        description: 'this is a setParameter function',
        name: 'setParameterFunction',
        response: {
          type: types.Type.OBJECT,
          properties: {
            numberField: {
              type: types.Type.NUMBER,
              minimum: 0,
              maximum: 100,
              description: 'this is a return number field',
            },
          },
          required: ['numberField'],
        },
      };
      expect(
        functionDeclarationFromZodFunction(true, {
          name: 'setParameterFunction',
          zodFunctionSchema: setParameterFunction,
        }),
      ).toEqual(expected);
      expect(
        functionDeclarationFromZodFunction(false, {
          name: 'setParameterFunction',
          zodFunctionSchema: setParameterFunction,
        }),
      ).toEqual(expected);
    });
    it('should process function with no parameters and have return value', () => {
      const returnValue = z.object({
        valueField: z
          .number()
          .min(0)
          .max(100)
          .describe('this is a return number field'),
      });
      const setParameterFunction = z
        .function()
        .args()
        .returns(returnValue)
        .describe('this is a setParameter function');

      const expected = {
        description: 'this is a setParameter function',
        name: 'setParameterFunction',
        response: {
          type: types.Type.OBJECT,
          properties: {
            valueField: {
              type: types.Type.NUMBER,
              minimum: 0,
              maximum: 100,
              description: 'this is a return number field',
            },
          },
          required: ['valueField'],
        },
      };
      expect(
        functionDeclarationFromZodFunction(true, {
          name: 'setParameterFunction',
          zodFunctionSchema: setParameterFunction,
        }),
      ).toEqual(expected);
      expect(
        functionDeclarationFromZodFunction(false, {
          name: 'setParameterFunction',
          zodFunctionSchema: setParameterFunction,
        }),
      ).toEqual(expected);
    });
    it('should process function with parameters and return value to void', () => {
      const setParameter = z.object({
        numberField: z
          .number()
          .min(0)
          .max(100)
          .describe('this is a number field'),
        stringEnumField: z
          .enum(['daylight', 'cool', 'warm'])
          .describe('this is a string enum field'),
        booleanField: z.boolean().describe('this is a boolean field'),
      });

      const setParameterFunction = z
        .function()
        .args(setParameter)
        .returns(z.void())
        .describe('this is a setParameter function');

      const expected = {
        description: 'this is a setParameter function',
        name: 'setParameterFunction',
        parameters: {
          type: types.Type.OBJECT,
          properties: {
            numberField: {
              type: types.Type.NUMBER,
              minimum: 0,
              maximum: 100,
              description: 'this is a number field',
            },
            stringEnumField: {
              type: types.Type.STRING,
              enum: ['daylight', 'cool', 'warm'],
              format: 'enum',
              description: 'this is a string enum field',
            },
            booleanField: {
              type: types.Type.BOOLEAN,
              description: 'this is a boolean field',
            },
          },
          required: ['numberField', 'stringEnumField', 'booleanField'],
        },
      };
      expect(
        functionDeclarationFromZodFunction(true, {
          name: 'setParameterFunction',
          zodFunctionSchema: setParameterFunction,
        }),
      ).toEqual(expected);
      expect(
        functionDeclarationFromZodFunction(false, {
          name: 'setParameterFunction',
          zodFunctionSchema: setParameterFunction,
        }),
      ).toEqual(expected);
    });
  });
});



================================================
FILE: test/unit/transformers_test.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {ApiClient} from '../../src/_api_client';
import {
  tContent,
  tContents,
  tModel,
  tPart,
  tParts,
  tSchema,
  tSpeechConfig,
  tTool,
} from '../../src/_transformers';
import * as types from '../../src/types';

import {CrossUploader} from '../../src/cross/_cross_uploader';
import {FakeAuth} from '../_fake_auth';

describe('tModel', () => {
  it('empty string', () => {
    expect(() => {
      tModel(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        '',
      );
    }).toThrowError('model is required and must be a string');
  });
  it('returns model name for MLDev starting with models', () => {
    expect(
      tModel(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        'models/gemini-2.0-flash',
      ),
    ).toEqual('models/gemini-2.0-flash');
  });
  it('returns model name for MLDev starting with tunedModels', () => {
    expect(
      tModel(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        'tunedModels/gemini-2.0-flash',
      ),
    ).toEqual('tunedModels/gemini-2.0-flash');
  });
  it('returns model prefix for MLDev', () => {
    expect(
      tModel(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        'gemini-2.0-flash',
      ),
    ).toEqual('models/gemini-2.0-flash');
  });
  it('returns model name for Vertex starting with publishers', () => {
    expect(
      tModel(
        new ApiClient({
          auth: new FakeAuth(),
          vertexai: true,
          uploader: new CrossUploader(),
        }),
        'publishers/gemini-2.0-flash',
      ),
    ).toEqual('publishers/gemini-2.0-flash');
  });
  it('returns model name for Vertex starting with projects', () => {
    expect(
      tModel(
        new ApiClient({
          auth: new FakeAuth(),
          vertexai: true,
          uploader: new CrossUploader(),
        }),
        'projects/gemini-2.0-flash',
      ),
    ).toEqual('projects/gemini-2.0-flash');
  });
  it('returns model name for Vertex starting with models', () => {
    expect(
      tModel(
        new ApiClient({
          auth: new FakeAuth(),
          vertexai: true,
          uploader: new CrossUploader(),
        }),
        'models/gemini-2.0-flash',
      ),
    ).toEqual('models/gemini-2.0-flash');
  });
  it('returns publisher prefix for Vertex with slash', () => {
    expect(
      tModel(
        new ApiClient({
          auth: new FakeAuth(),
          vertexai: true,
          uploader: new CrossUploader(),
        }),
        'google/gemini-2.0-flash',
      ),
    ).toEqual('publishers/google/models/gemini-2.0-flash');
  });
  it('returns publisher prefix for Vertex', () => {
    expect(
      tModel(
        new ApiClient({
          auth: new FakeAuth(),
          vertexai: true,
          uploader: new CrossUploader(),
        }),
        'gemini-2.0-flash',
      ),
    ).toEqual('publishers/google/models/gemini-2.0-flash');
  });
});

describe('tSpeechConfig', () => {
  it('string to speechConfig', () => {
    const speechConfig = {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: 'voice-name',
        },
      },
    };
    expect(
      tSpeechConfig(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        'voice-name',
      ),
    ).toEqual(speechConfig);
  });
});

describe('tTool', () => {
  it('no change', () => {
    const tool = {functionDeclarations: [{name: 'function-name'}]};
    expect(
      tTool(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        tool,
      ),
    ).toEqual(tool);
  });
});

describe('tSchema', () => {
  it('no change', () => {
    const schema = {
      title: 'title',
      default: 'default',
    } as types.Schema;
    expect(
      tSchema(
        new ApiClient({
          auth: new FakeAuth(),
          vertexai: true,
          uploader: new CrossUploader(),
        }),
        schema,
      ),
    ).toEqual(schema);
    expect(
      tSchema(
        new ApiClient({
          auth: new FakeAuth(),
          vertexai: false,
          uploader: new CrossUploader(),
        }),
        schema,
      ),
    ).toEqual(schema);
  });
  it('processes anyOf', () => {
    const schema = {
      type: 'OBJECT',
      anyOf: [{type: 'STRING'}, {type: 'NUMBER'}],
    } as types.Schema;
    expect(
      tSchema(
        new ApiClient({
          auth: new FakeAuth(),
          vertexai: true,
          uploader: new CrossUploader(),
        }),
        schema,
      ),
    ).toEqual(schema);
    expect(
      tSchema(
        new ApiClient({
          auth: new FakeAuth(),
          vertexai: false,
          uploader: new CrossUploader(),
        }),
        schema,
      ),
    ).toEqual(schema);
  });
  it('processes items', () => {
    const schema = {
      type: 'OBJECT',
      properties: {
        type: {
          type: 'ARRAY',
          items: {
            type: 'STRING',
          },
        },
      },
    } as types.Schema;
    expect(
      tSchema(
        new ApiClient({
          auth: new FakeAuth(),
          vertexai: true,
          uploader: new CrossUploader(),
        }),
        schema,
      ),
    ).toEqual(schema);
    expect(
      tSchema(
        new ApiClient({
          auth: new FakeAuth(),
          vertexai: false,
          uploader: new CrossUploader(),
        }),
        schema,
      ),
    ).toEqual(schema);
  });
  it('process properties', () => {
    const schema = {
      type: 'OBJECT',
      properties: {
        type: {
          type: 'STRING',
        },
      },
    } as types.Schema;
    expect(
      tSchema(
        new ApiClient({
          auth: new FakeAuth(),
          vertexai: true,
          uploader: new CrossUploader(),
        }),
        schema,
      ),
    ).toEqual(schema);
    expect(
      tSchema(
        new ApiClient({
          auth: new FakeAuth(),
          vertexai: false,
          uploader: new CrossUploader(),
        }),
        schema,
      ),
    ).toEqual(schema);
  });
});

describe('tPart', () => {
  it('null', () => {
    expect(() => {
      tPart(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        null,
      );
    }).toThrowError('PartUnion is required');
  });

  it('undefined', () => {
    expect(() => {
      tPart(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        undefined,
      );
    }).toThrowError('PartUnion is required');
  });

  it('string', () => {
    expect(
      tPart(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        'test string',
      ),
    ).toEqual({text: 'test string'});
  });

  it('part object', () => {
    expect(
      tPart(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        {text: 'test string'},
      ),
    ).toEqual({text: 'test string'});
  });

  it('int', () => {
    expect(() => {
      tPart(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        // @ts-expect-error: escaping to test unsupported type
        123,
      );
    }).toThrowError('Unsupported part type: number');
  });
});

describe('tParts', () => {
  it('null', () => {
    expect(() => {
      tParts(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        null,
      );
    }).toThrowError('PartListUnion is required');
  });

  it('undefined', () => {
    expect(() => {
      tParts(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        undefined,
      );
    }).toThrowError('PartListUnion is required');
  });

  it('empty array', () => {
    expect(() => {
      tParts(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        [],
      );
    }).toThrowError('PartListUnion is required');
  });

  it('string array', () => {
    expect(
      tParts(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        ['test string 1', 'test string 2'],
      ),
    ).toEqual([{text: 'test string 1'}, {text: 'test string 2'}]);
  });

  it('string and part object', () => {
    expect(
      tParts(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        ['test string 1', {text: 'test string 2'}],
      ),
    ).toEqual([{text: 'test string 1'}, {text: 'test string 2'}]);
  });

  it('int', () => {
    expect(() => {
      tParts(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        // @ts-expect-error: escaping to test unsupported type
        123,
      );
    }).toThrowError('Unsupported part type: number');
  });

  it('int in array', () => {
    expect(() => {
      tParts(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        // @ts-expect-error: escaping to test unsupported type
        [123],
      );
    }).toThrowError('Unsupported part type: number');
  });
});

describe('tContent', () => {
  it('null', () => {
    expect(() => {
      tContent(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        // @ts-expect-error: escaping to test unsupported type
        null,
      );
    }).toThrowError('ContentUnion is required');
  });

  it('undefined', () => {
    expect(() => {
      tContent(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        undefined,
      );
    }).toThrowError('ContentUnion is required');
  });

  it('empty array', () => {
    expect(() => {
      tContent(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        [],
      );
    }).toThrowError('PartListUnion is required');
  });

  it('number', () => {
    expect(() => {
      tContent(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        // @ts-expect-error: escaping to test unsupported type
        123,
      );
    }).toThrowError('Unsupported part type: number');
  });

  it('text part', () => {
    expect(
      tContent(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        {text: 'test string'},
      ),
    ).toEqual({role: 'user', parts: [{text: 'test string'}]});
  });

  it('content', () => {
    expect(
      tContent(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        {
          role: 'user',
          parts: [{text: 'test string'}],
        },
      ),
    ).toEqual({role: 'user', parts: [{text: 'test string'}]});
  });

  it('string', () => {
    expect(
      tContent(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        'test string',
      ),
    ).toEqual({role: 'user', parts: [{text: 'test string'}]});
  });
});

describe('tContents', () => {
  it('null', () => {
    expect(() => {
      tContents(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        // @ts-expect-error: escaping to test error
        null,
      );
    }).toThrowError('contents are required');
  });

  it('undefined', () => {
    expect(() => {
      tContents(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        undefined,
      );
    }).toThrowError('contents are required');
  });

  it('empty array', () => {
    expect(() => {
      tContents(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        [],
      );
    }).toThrowError('contents are required');
  });

  it('content', () => {
    expect(
      tContents(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        {
          role: 'user',
          parts: [{text: 'test string'}],
        },
      ),
    ).toEqual([{role: 'user', parts: [{text: 'test string'}]}]);
  });

  it('text part', () => {
    expect(
      tContents(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        {text: 'test string'},
      ),
    ).toEqual([{role: 'user', parts: [{text: 'test string'}]}]);
  });

  it('function call part', () => {
    expect(() => {
      tContents(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        {
          functionCall: {name: 'function-name', args: {arg1: 'arg1'}},
        },
      );
    }).toThrowError(
      'To specify functionCall or functionResponse parts, please wrap them in a Content object, specifying the role for them',
    );
  });

  it('function call part in array', () => {
    expect(() => {
      tContents(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        [
          {
            functionCall: {name: 'function-name', args: {arg1: 'arg1'}},
          },
          {text: 'test string'},
        ],
      );
    }).toThrowError(
      'To specify functionCall or functionResponse parts, please wrap them, and any other parts, in Content objects as appropriate, specifying the role for them',
    );
  });

  it('function response part', () => {
    expect(() => {
      tContents(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        {
          functionResponse: {
            name: 'name1',
            response: {result: {answer: 'answer1'}},
          },
        },
      );
    }).toThrowError(
      'To specify functionCall or functionResponse parts, please wrap them in a Content object, specifying the role for them',
    );
  });

  it('function response part in array', () => {
    expect(() => {
      tContents(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        [
          {
            functionResponse: {
              name: 'name1',
              response: {result: {answer: 'answer1'}},
            },
          },
          {text: 'test string'},
        ],
      );
    }).toThrowError(
      'To specify functionCall or functionResponse parts, please wrap them, and any other parts, in Content objects as appropriate, specifying the role for them',
    );
  });

  it('string', () => {
    expect(
      tContents(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        'test string',
      ),
    ).toEqual([{role: 'user', parts: [{text: 'test string'}]}]);
  });

  it('array of contents', () => {
    expect(
      tContents(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        [
          {role: 'user', parts: [{text: 'test string 1'}]},
          {role: 'model', parts: [{text: 'test string 2'}]},
        ],
      ),
    ).toEqual([
      {role: 'user', parts: [{text: 'test string 1'}]},
      {role: 'model', parts: [{text: 'test string 2'}]},
    ]);
  });

  it('array of text parts', () => {
    expect(
      tContents(
        new ApiClient({auth: new FakeAuth(), uploader: new CrossUploader()}),
        [{text: 'test string 1'}, {text: 'test string 2'}],
      ),
    ).toEqual([
      {
        role: 'user',
        parts: [{text: 'test string 1'}, {text: 'test string 2'}],
      },
    ]);
  });
});



================================================
FILE: test/unit/types_test.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Candidate,
  Content,
  GenerateContentResponse,
  Language,
  Outcome,
  Part,
  createModelContent,
  createPartFromBase64,
  createPartFromCodeExecutionResult,
  createPartFromExecutableCode,
  createPartFromFunctionCall,
  createPartFromFunctionResponse,
  createPartFromText,
  createPartFromUri,
  createUserContent,
} from '../../src/types';

describe('GenerateContentResponse.text', () => {
  it('should return undefined when candidates is undefined', () => {
    const response = new GenerateContentResponse();
    expect(response.text).toBeUndefined();
  });

  it('should return undefined when candidates is an empty array', () => {
    const response = new GenerateContentResponse();
    response.candidates = [];
    expect(response.text).toBeUndefined();
  });

  it('should return undefined when content is undefined', () => {
    const response = new GenerateContentResponse();
    response.candidates = [{} as Candidate];
    expect(response.text).toBeUndefined();
  });

  it('should return undefined when content.parts is undefined', () => {
    const response = new GenerateContentResponse();
    response.candidates = [{content: {} as Content} as Candidate];
    expect(response.text).toBeUndefined();
  });

  it('should return undefined when content.parts is empty array', () => {
    const response = new GenerateContentResponse();
    response.candidates = [{content: {parts: []}} as Candidate];
    expect(response.text).toBeUndefined();
  });

  it('should use first candidate when there are multiple candidates', () => {
    const response = new GenerateContentResponse();
    response.candidates = [
      {content: {parts: [{text: 'First candidate'}]}} as Candidate,
      {content: {parts: [{text: 'Second candidate'}]}} as Candidate,
    ];
    spyOn(console, 'warn');

    expect(response.text).toBe('First candidate');
    expect(console.warn).toHaveBeenCalledWith(
      'there are multiple candidates in the response, returning text from the first one.',
    );
  });

  it('should return concatenated text from valid text parts', () => {
    const response = new GenerateContentResponse();
    response.candidates = [
      {
        content: {
          parts: [{text: 'Hello '}, {text: 'world!'}],
        },
      } as Candidate,
    ];
    expect(response.text).toBe('Hello world!');
  });

  it('should log a warning when parts contain invalid fields', () => {
    const response = new GenerateContentResponse();
    response.candidates = [
      {
        content: {
          parts: [
            {text: 'Hello '},
            {
              inlineData: {
                data: 'world!',
                mimeType: 'text/plain',
              },
            },
          ],
        },
      } as Candidate,
    ];
    spyOn(console, 'warn');

    expect(response.text).toEqual('Hello ');
    expect(console.warn).toHaveBeenCalledWith(
      'there are non-text parts inlineData in the response, returning concatenation of all text parts. Please refer to the non text parts for a full response from model.',
    );
  });

  it('should skip parts with thought set to true', () => {
    const response = new GenerateContentResponse();
    response.candidates = [
      {
        content: {
          parts: [{text: 'Hello '}, {text: 'world!', thought: true}],
        },
      } as Candidate,
    ];
    expect(response.text).toBe('Hello ');
  });
});

describe('GenerateContentResponse.data', () => {
  it('should return undefined when candidates is undefined', () => {
    const response = new GenerateContentResponse();
    expect(response.data).toBeUndefined();
  });

  it('should return undefined when candidates is an empty array', () => {
    const response = new GenerateContentResponse();
    response.candidates = [];
    expect(response.data).toBeUndefined();
  });

  it('should return undefined when content is undefined', () => {
    const response = new GenerateContentResponse();
    response.candidates = [{} as Candidate];
    expect(response.data).toBeUndefined();
  });

  it('should return undefined when content.parts is undefined', () => {
    const response = new GenerateContentResponse();
    response.candidates = [{content: {} as Content} as Candidate];
    expect(response.data).toBeUndefined();
  });

  it('should return undefined when content.parts is empty array', () => {
    const response = new GenerateContentResponse();
    response.candidates = [{content: {parts: []}} as Candidate];
    expect(response.data).toBeUndefined();
  });

  it('should use first candidate when there are multiple candidates', () => {
    const response = new GenerateContentResponse();
    response.candidates = [
      {
        content: {
          parts: [
            {inlineData: {data: 'SGVsbG8gV29ybGQh', mimeType: 'text/plain'}},
          ],
        },
      } as Candidate,
      {
        content: {
          parts: [
            {
              inlineData: {
                data: 'WW91IGFyZSBhd2Vzb21lIQ==',
                mimeType: 'text/plain',
              },
            },
          ],
        },
      } as Candidate,
    ];
    spyOn(console, 'warn');

    expect(response.data).toBe('SGVsbG8gV29ybGQh');
    expect(console.warn).toHaveBeenCalledWith(
      'there are multiple candidates in the response, returning data from the first one.',
    );
  });

  it('should return concatenated inline data from valid data parts', () => {
    const response = new GenerateContentResponse();
    response.candidates = [
      {
        content: {
          parts: [
            {inlineData: {data: 'SGVsbG8gV29ybGQh', mimeType: 'text/plain'}},
            {
              inlineData: {
                data: 'WW91IGFyZSBhd2Vzb21lIQ==',
                mimeType: 'text/plain',
              },
            },
          ],
        },
      } as Candidate,
    ];
    expect(response.data).toBe('SGVsbG8gV29ybGQhWW91IGFyZSBhd2Vzb21lIQ==');
  });

  it('should log a warning when parts contain invalid fields', () => {
    const response = new GenerateContentResponse();
    response.candidates = [
      {
        content: {
          parts: [
            {text: 'Hello '},
            {
              inlineData: {
                data: 'SGVsbG8gV29ybGQh',
                mimeType: 'text/plain',
              },
            },
          ],
        },
      } as Candidate,
    ];
    spyOn(console, 'warn');

    expect(response.data).toEqual('SGVsbG8gV29ybGQh');
    expect(console.warn).toHaveBeenCalledWith(
      'there are non-data parts text in the response, returning concatenation of all data parts. Please refer to the non data parts for a full response from model.',
    );
  });
});

describe('GenerateContentResponse.functionCalls', () => {
  it('should return undefined when candidates is undefined', () => {
    const response = new GenerateContentResponse();
    expect(response.functionCalls).toBeUndefined();
  });

  it('should return undefined when candidates is an empty array', () => {
    const response = new GenerateContentResponse();
    response.candidates = [];
    expect(response.functionCalls).toBeUndefined();
  });

  it('should return undefined when candidates[0].content.parts is an empty array', () => {
    const response = new GenerateContentResponse();
    response.candidates = [{content: {parts: []}}];
    expect(response.functionCalls).toBeUndefined();
  });

  it('should use the first candidate when there are multiple candidates', () => {
    const response = new GenerateContentResponse();
    response.candidates = [
      {content: {parts: [{functionCall: {name: 'func1'}}]}},
      {content: {parts: [{functionCall: {name: 'func2'}}]}},
    ];
    spyOn(console, 'warn');

    expect(response.functionCalls).toEqual([{name: 'func1'}]);
    expect(console.warn).toHaveBeenCalledWith(
      'there are multiple candidates in the response, returning function calls from the first one.',
    );
  });

  it('should return an array of function calls when candidates[0].content.parts contains valid function calls', () => {
    const response = new GenerateContentResponse();
    response.candidates = [
      {
        content: {
          parts: [
            {functionCall: {name: 'func1'}},
            {functionCall: {name: 'func2'}},
          ],
        },
      },
    ];
    expect(response.functionCalls).toEqual([{name: 'func1'}, {name: 'func2'}]);
  });

  it('should return undefined when candidates[0].content.parts contains no function calls', () => {
    const response = new GenerateContentResponse();
    response.candidates = [
      {content: {parts: [{text: 'text1'}, {text: 'text2'}]}},
    ];
    expect(response.functionCalls).toBeUndefined();
  });
  it('should filter out filter out undefined function calls', () => {
    const response = new GenerateContentResponse();
    response.candidates = [
      {
        content: {
          parts: [{functionCall: {name: 'func1'}}, {functionCall: undefined}],
        },
      },
    ];
    expect(response.functionCalls).toEqual([{name: 'func1'}]);
  });
});

describe('GenerateContentResponse.executableCode', () => {
  it('should return undefined when candidates is undefined', () => {
    const response = new GenerateContentResponse();
    expect(response.executableCode).toBeUndefined();
  });

  it('should return undefined when candidates is an empty array', () => {
    const response = new GenerateContentResponse();
    response.candidates = [];
    expect(response.executableCode).toBeUndefined();
  });

  it('should return undefined when candidates[0].content.parts is an empty array', () => {
    const response = new GenerateContentResponse();
    response.candidates = [{content: {parts: []}}];
    expect(response.executableCode).toBeUndefined();
  });

  it('should use the first candidate when there are multiple candidates', () => {
    const response = new GenerateContentResponse();
    response.candidates = [
      {content: {parts: [{executableCode: {code: 'print("Hello world!")'}}]}},
      {content: {parts: [{executableCode: {code: 'print("Goodbye world!")'}}]}},
    ];
    spyOn(console, 'warn');

    expect(response.executableCode).toBe('print("Hello world!")');
    expect(console.warn).toHaveBeenCalledWith(
      'there are multiple candidates in the response, returning executable code from the first one.',
    );
  });

  it('should return the executable code when candidates[0].content.parts contains valid executable code parts', () => {
    const response = new GenerateContentResponse();
    response.candidates = [
      {
        content: {
          parts: [{executableCode: {code: 'print("Hello world!")'}}],
        },
      },
    ];
    expect(response.executableCode).toBe('print("Hello world!")');
  });

  it('should return undefined when candidates[0].content.parts contains no executable code parts', () => {
    const response = new GenerateContentResponse();
    response.candidates = [
      {content: {parts: [{text: 'text1'}, {text: 'text2'}]}},
    ];
    expect(response.executableCode).toBeUndefined();
  });
});

describe('GenerateContentResponse.codeExecutionResult', () => {
  it('should return undefined when candidates is undefined', () => {
    const response = new GenerateContentResponse();
    expect(response.codeExecutionResult).toBeUndefined();
  });

  it('should return undefined when candidates is an empty array', () => {
    const response = new GenerateContentResponse();
    response.candidates = [];
    expect(response.codeExecutionResult).toBeUndefined();
  });

  it('should return undefined when candidates[0].content.parts is an empty array', () => {
    const response = new GenerateContentResponse();
    response.candidates = [{content: {parts: []}}];
    expect(response.codeExecutionResult).toBeUndefined();
  });

  it('should use the first candidate when there are multiple candidates', () => {
    const response = new GenerateContentResponse();
    response.candidates = [
      {
        content: {
          parts: [{codeExecutionResult: {output: 'Hello world!'}}],
        },
      },
      {
        content: {
          parts: [{codeExecutionResult: {output: 'Goodbye world!'}}],
        },
      },
    ];
    spyOn(console, 'warn');

    expect(response.codeExecutionResult).toBe('Hello world!');
    expect(console.warn).toHaveBeenCalledWith(
      'there are multiple candidates in the response, returning code execution result from the first one.',
    );
  });

  it('should return the output of the code execution result part when candidates[0].content.parts contains valid code execution result parts', () => {
    const response = new GenerateContentResponse();
    response.candidates = [
      {
        content: {
          parts: [{codeExecutionResult: {output: 'Hello world!'}}],
        },
      },
    ];
    expect(response.codeExecutionResult).toBe('Hello world!');
  });

  it('should return undefined when candidates[0].content.parts contains no code execution result parts', () => {
    const response = new GenerateContentResponse();
    response.candidates = [
      {content: {parts: [{text: 'text1'}, {text: 'text2'}]}},
    ];
    expect(response.codeExecutionResult).toBeUndefined();
  });
});

describe('createPart usability functions', () => {
  it('createPartFromText should create a text part', () => {
    const part = createPartFromText('Hello world!');
    const expectedPart: Part = {
      text: 'Hello world!',
    };

    expect(part).toEqual(expectedPart);
  });

  it('createPartFromUri should create a file data part', () => {
    const part = createPartFromUri('gs://bucket/file.txt', 'text/plain');
    const expectedPart: Part = {
      fileData: {
        fileUri: 'gs://bucket/file.txt',
        mimeType: 'text/plain',
      },
    };

    expect(part).toEqual(expectedPart);
  });

  it('createPartFromFunctionCall should create a function call part', () => {
    const part = createPartFromFunctionCall('func1', {
      param1: 'value1',
      param2: 'value2',
    });
    const expectedPart: Part = {
      functionCall: {
        name: 'func1',
        args: {
          param1: 'value1',
          param2: 'value2',
        },
      },
    };

    expect(part).toEqual(expectedPart);
  });

  it('createPartFromFunctionResponse should create a function response part', () => {
    const part = createPartFromFunctionResponse('id1', 'func1', {
      output: 'value1',
    });
    const expectedPart: Part = {
      functionResponse: {
        id: 'id1',
        name: 'func1',
        response: {
          output: 'value1',
        },
      },
    };

    expect(part).toEqual(expectedPart);
  });

  it('createPartFromBase64 should create an inline data part', () => {
    const part = createPartFromBase64('dGVzdA==', 'text/plain');
    const expectedPart: Part = {
      inlineData: {
        data: 'dGVzdA==',
        mimeType: 'text/plain',
      },
    };

    expect(part).toEqual(expectedPart);
  });

  it('createPartFromCodeExecutionResult should create a code execution result part', () => {
    const part = createPartFromCodeExecutionResult(
      Outcome.OUTCOME_OK,
      'Hello world!',
    );
    const expectedPart: Part = {
      codeExecutionResult: {
        outcome: Outcome.OUTCOME_OK,
        output: 'Hello world!',
      },
    };

    expect(part).toEqual(expectedPart);
  });

  it('createPartFromExecutableCode should create an executable code part', () => {
    const part = createPartFromExecutableCode(
      'print("Hello world!")',
      Language.PYTHON,
    );
    const expectedPart: Part = {
      executableCode: {
        code: 'print("Hello world!")',
        language: Language.PYTHON,
      },
    };

    expect(part).toEqual(expectedPart);
  });
});

describe('createUserContent', () => {
  it('should throw an error when partOrString is number type', () => {
    // @ts-expect-error: Expected to throw an error.
    expect(() => createUserContent(123)).toThrow(
      new Error('partOrString must be a Part object, string, or array'),
    );
  });
  it('should throw an error when partOrString is empty array', () => {
    expect(() => createUserContent([])).toThrow(
      new Error('partOrString cannot be an empty array'),
    );
  });
  it('should throw an error when partOrString array contains unsupported type', () => {
    // @ts-expect-error: Expected to throw an error.
    expect(() => createUserContent([123])).toThrow(
      new Error('element in PartUnion must be a Part object or string'),
    );
  });
  it('should throw an error when partOrString array contains unsupported object', () => {
    expect(() => createUserContent([{}])).toThrow(
      new Error('element in PartUnion must be a Part object or string'),
    );
  });
  it('should throw an error when partOrString is unsupported object', () => {
    expect(() => createUserContent({})).toThrow(
      new Error('partOrString must be a Part object, string, or array'),
    );
  });
  it('should create a user content object from a string', () => {
    expect(createUserContent('Hello world!')).toEqual({
      role: 'user',
      parts: [{text: 'Hello world!'}],
    });
  });
  it('should create a user content object from a Part object', () => {
    expect(
      createUserContent({
        fileData: {
          fileUri: 'gs://bucket/file.txt',
          mimeType: 'text/plain',
        },
      }),
    ).toEqual({
      role: 'user',
      parts: [
        {
          fileData: {
            fileUri: 'gs://bucket/file.txt',
            mimeType: 'text/plain',
          },
        },
      ],
    });
  });
});
describe('createModelContent', () => {
  it('should throw an error when partOrString is number type', () => {
    // @ts-expect-error: Expected to throw an error.
    expect(() => createModelContent(123)).toThrow(
      new Error('partOrString must be a Part object, string, or array'),
    );
  });
  it('should throw an error when partOrString is empty array', () => {
    expect(() => createModelContent([])).toThrow(
      new Error('partOrString cannot be an empty array'),
    );
  });
  it('should throw an error when partOrString array contains unsupported type', () => {
    // @ts-expect-error: Expected to throw an error.
    expect(() => createModelContent([123])).toThrow(
      new Error('element in PartUnion must be a Part object or string'),
    );
  });
  it('should throw an error when partOrString array contains unsupported object', () => {
    expect(() => createModelContent([{}])).toThrow(
      new Error('element in PartUnion must be a Part object or string'),
    );
  });
  it('should throw an error when partOrString is unsupported object', () => {
    expect(() => createModelContent({})).toThrow(
      new Error('partOrString must be a Part object, string, or array'),
    );
  });
  it('should create a model content object from a string', () => {
    expect(createModelContent('Hello world!')).toEqual({
      role: 'model',
      parts: [{text: 'Hello world!'}],
    });
  });
  it('should create a model content object from a Part object', () => {
    expect(
      createModelContent({
        fileData: {
          fileUri: 'gs://bucket/file.txt',
          mimeType: 'text/plain',
        },
      }),
    ).toEqual({
      role: 'model',
      parts: [
        {
          fileData: {
            fileUri: 'gs://bucket/file.txt',
            mimeType: 'text/plain',
          },
        },
      ],
    });
  });
});



================================================
FILE: test/unit/node/base_url_test.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {setDefaultBaseUrls} from '../../../src/_base_url';
import {GoogleGenAI} from '../../../src/node/node_client';

describe('setDefaultBaseUrls', () => {
  afterEach(() => {
    delete process.env['GOOGLE_GEMINI_BASE_URL'];
    delete process.env['GOOGLE_VERTEX_BASE_URL'];

    setDefaultBaseUrls({});
  });

  it('should set default base Gemini URL', () => {
    setDefaultBaseUrls({geminiUrl: 'https://gemini.google.com'});
    const client = new GoogleGenAI({});
    expect(client['apiClient'].getBaseUrl()).toBe('https://gemini.google.com');
  });
  it('should set default base Vertex URL', () => {
    setDefaultBaseUrls({vertexUrl: 'https://vertexai.googleapis.com'});
    const client = new GoogleGenAI({vertexai: true});
    expect(client['apiClient'].getBaseUrl()).toBe(
      'https://vertexai.googleapis.com',
    );
  });
  it('should set default base Gemini URL from environment variables', () => {
    process.env['GOOGLE_GEMINI_BASE_URL'] = 'https://gemini.google.com';
    const client = new GoogleGenAI({});
    expect(client['apiClient'].getBaseUrl()).toBe('https://gemini.google.com');
  });
  it('should set default base Vertex URL from environment variables', () => {
    process.env['GOOGLE_VERTEX_BASE_URL'] = 'https://vertexai.googleapis.com';
    const client = new GoogleGenAI({vertexai: true});
    expect(client['apiClient'].getBaseUrl()).toBe(
      'https://vertexai.googleapis.com',
    );
  });
  it('should not override base URL if set via httpOptions', () => {
    setDefaultBaseUrls({vertexUrl: 'https://vertexai.googleapis.com'});
    const client = new GoogleGenAI({
      httpOptions: {baseUrl: 'https://gemini.google.com'},
    });
    expect(client['apiClient'].getBaseUrl()).toBe('https://gemini.google.com');
  });
});



================================================
FILE: test/unit/node/client_test.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {setDefaultBaseUrls} from '../../../src/_base_url';
import {NodeUploader} from '../../../src/node/_node_uploader';
import {GoogleGenAI} from '../../../src/node/node_client';

describe('Client', () => {
  afterEach(() => {
    delete process.env['GOOGLE_API_KEY'];
    delete process.env['GOOGLE_GENAI_USE_VERTEXAI'];
    delete process.env['GOOGLE_CLOUD_PROJECT'];
    delete process.env['GOOGLE_CLOUD_LOCATION'];
    delete process.env['GOOGLE_GEMINI_BASE_URL'];
    delete process.env['GOOGLE_VERTEX_BASE_URL'];

    setDefaultBaseUrls({});
  });

  it('should initialize without any options', () => {
    const client = new GoogleGenAI({});
    expect(client).toBeDefined();
  });

  it('should set apiKey from environment', () => {
    process.env['GOOGLE_API_KEY'] = 'test_api_key';
    const client = new GoogleGenAI({});
    expect(client['apiKey']).toBe('test_api_key');
  });

  it('should set vertexai from environment', () => {
    process.env['GOOGLE_GENAI_USE_VERTEXAI'] = 'false';
    let client = new GoogleGenAI({});
    expect(client.vertexai).toBe(false);

    process.env['GOOGLE_GENAI_USE_VERTEXAI'] = 'true';
    client = new GoogleGenAI({});
    expect(client.vertexai).toBe(true);
  });

  it('should set project from environment', () => {
    process.env['GOOGLE_CLOUD_PROJECT'] = 'test_project';
    const client = new GoogleGenAI({});
    expect(client['project']).toBe('test_project');
  });

  it('should set location from environment', () => {
    process.env['GOOGLE_CLOUD_LOCATION'] = 'test_location';
    const client = new GoogleGenAI({});
    expect(client['location']).toBe('test_location');
  });

  it('should prioritize constructor options over environment variables', () => {
    process.env['GOOGLE_API_KEY'] = 'env_api_key';
    process.env['GOOGLE_GENAI_USE_VERTEXAI'] = 'true';
    process.env['GOOGLE_CLOUD_PROJECT'] = 'env_project';
    process.env['GOOGLE_CLOUD_LOCATION'] = 'env_location';

    const client = new GoogleGenAI({
      vertexai: true,
      project: 'constructor_project',
      location: 'constructor_location',
    });

    expect(client.vertexai).toBe(true);
    expect(client['apiKey']).toBeUndefined();
    expect(client['project']).toBe('constructor_project');
    expect(client['location']).toBe('constructor_location');
  });
  it('should not allow both project and apikey in constructor', () => {
    expect(() => {
      new GoogleGenAI({
        apiKey: 'constructor_api_key',
        vertexai: true,
        project: 'constructor_project',
        location: 'constructor_location',
      });
    }).toThrowError(
      'Project/location and API key are mutually exclusive in the client initializer.',
    );
  });
  it('should prioritize explicit api key over implicit project/location', () => {
    process.env['GOOGLE_GENAI_USE_VERTEXAI'] = 'true';
    process.env['GOOGLE_CLOUD_PROJECT'] = 'env_project';
    process.env['GOOGLE_CLOUD_LOCATION'] = 'env_location';

    const client = new GoogleGenAI({
      vertexai: true,
      apiKey: 'constructor_api_key',
    });

    expect(client.vertexai).toBe(true);
    expect(client['apiKey']).toBe('constructor_api_key');
    expect(client['project']).toBeUndefined();
    expect(client['location']).toBeUndefined();
  });
  it('should prioritize explicit project/location over implicit api key', () => {
    process.env['GOOGLE_GENAI_USE_VERTEXAI'] = 'true';
    process.env['GOOGLE_API_KEY'] = 'env_api_key';

    const client = new GoogleGenAI({
      vertexai: true,
      project: 'constructor_project',
      location: 'constructor_location',
    });

    expect(client.vertexai).toBe(true);
    expect(client['apiKey']).toBeUndefined();
    expect(client['project']).toBe('constructor_project');
    expect(client['location']).toBe('constructor_location');
  });
  it('should prioritize implicit project/location over implicit api key', () => {
    process.env['GOOGLE_GENAI_USE_VERTEXAI'] = 'true';
    process.env['GOOGLE_API_KEY'] = 'env_api_key';
    process.env['GOOGLE_CLOUD_PROJECT'] = 'env_project';
    process.env['GOOGLE_CLOUD_LOCATION'] = 'env_location';

    const client = new GoogleGenAI({
      vertexai: true,
    });

    expect(client.vertexai).toBe(true);
    expect(client['apiKey']).toBeUndefined();
    expect(client['project']).toBe('env_project');
    expect(client['location']).toBe('env_location');
  });
  it('should set uploader by default', () => {
    const client = new GoogleGenAI({});
    expect(client['apiClient'].clientOptions.uploader).toBeInstanceOf(
      NodeUploader,
    );
  });
  it('should persist base URL specified from HttpOptions Mldev', () => {
    setDefaultBaseUrls({
      geminiUrl: 'https://custom-gemini-base-url.googleapis.com',
      vertexUrl: 'https://custom-vertex-base-url.googleapis.com',
    });
    process.env['GOOGLE_GEMINI_BASE_URL'] =
      'https://gemini-base-url.googleapis.com';
    process.env['GOOGLE_VERTEX_BASE_URL'] =
      'https://vertex-base-url.googleapis.com';

    const client = new GoogleGenAI({
      httpOptions: {baseUrl: 'https://original-gemini-base-url.googleapis.com'},
    });

    expect(client['apiClient'].getBaseUrl()).toBe(
      'https://original-gemini-base-url.googleapis.com',
    );
  });
  it('should persist base URL specified from HttpOptions Vertex', () => {
    setDefaultBaseUrls({
      geminiUrl: 'https://custom-gemini-base-url.googleapis.com',
      vertexUrl: 'https://custom-vertex-base-url.googleapis.com',
    });
    process.env['GOOGLE_GEMINI_BASE_URL'] =
      'https://gemini-base-url.googleapis.com';
    process.env['GOOGLE_VERTEX_BASE_URL'] =
      'https://vertex-base-url.googleapis.com';

    const client = new GoogleGenAI({
      vertexai: true,
      httpOptions: {baseUrl: 'https://original-vertex-base-url.googleapis.com'},
    });

    expect(client['apiClient'].getBaseUrl()).toBe(
      'https://original-vertex-base-url.googleapis.com',
    );
  });
  it('should override base URL with values from getDefaultBaseUrls Mldev', () => {
    setDefaultBaseUrls({
      geminiUrl: 'https://custom-gemini-base-url.googleapis.com',
      vertexUrl: 'https://custom-vertex-base-url.googleapis.com',
    });
    process.env['GOOGLE_GEMINI_BASE_URL'] =
      'https://gemini-base-url.googleapis.com';
    process.env['GOOGLE_VERTEX_BASE_URL'] =
      'https://vertex-base-url.googleapis.com';

    const client = new GoogleGenAI({});

    expect(client['apiClient'].getBaseUrl()).toBe(
      'https://custom-gemini-base-url.googleapis.com',
    );
  });
  it('should override base URL with values from getDefaultBaseUrls Vertex', () => {
    setDefaultBaseUrls({
      geminiUrl: 'https://custom-gemini-base-url.googleapis.com',
      vertexUrl: 'https://custom-vertex-base-url.googleapis.com',
    });
    process.env['GOOGLE_GEMINI_BASE_URL'] =
      'https://gemini-base-url.googleapis.com';
    process.env['GOOGLE_VERTEX_BASE_URL'] =
      'https://vertex-base-url.googleapis.com';

    const client = new GoogleGenAI({
      vertexai: true,
    });

    expect(client['apiClient'].getBaseUrl()).toBe(
      'https://custom-vertex-base-url.googleapis.com',
    );
  });
  it('should override base URL with values from environment variables Mldev', () => {
    process.env['GOOGLE_GEMINI_BASE_URL'] =
      'https://gemini-base-url.googleapis.com';
    process.env['GOOGLE_VERTEX_BASE_URL'] =
      'https://vertex-base-url.googleapis.com';

    const client = new GoogleGenAI({});

    expect(client['apiClient'].getBaseUrl()).toBe(
      'https://gemini-base-url.googleapis.com',
    );
  });
  it('should override base URL with values from environment variables Vertex', () => {
    process.env['GOOGLE_GEMINI_BASE_URL'] =
      'https://gemini-base-url.googleapis.com';
    process.env['GOOGLE_VERTEX_BASE_URL'] =
      'https://vertex-base-url.googleapis.com';

    const client = new GoogleGenAI({
      vertexai: true,
    });

    expect(client['apiClient'].getBaseUrl()).toBe(
      'https://vertex-base-url.googleapis.com',
    );
  });
});



================================================
FILE: test/unit/node/node_auth_test.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleAuth, GoogleAuthOptions} from 'google-auth-library';

import {GOOGLE_API_KEY_HEADER, NodeAuth} from '../../../src/node/_node_auth';

const REQUIRED_VERTEX_AI_SCOPE =
  'https://www.googleapis.com/auth/cloud-platform';

const AUTHORIZATION_HEADER = 'Authorization';

describe('NodeAuth', () => {
  it('should throw an error if the scopes do not include the required scope when custom scopes are provided', () => {
    const customScope = 'https://www.googleapis.com/auth/other-scope';
    const authOptions: GoogleAuthOptions = {scopes: [customScope]};
    expect(() => new NodeAuth({googleAuthOptions: authOptions})).toThrowError(
      `Invalid auth scopes. Scopes must include: ${REQUIRED_VERTEX_AI_SCOPE}`,
    );
  });
});

interface NodeAuthWithGoogleAuth {
  googleAuth: jasmine.SpyObj<GoogleAuth>;
}

describe('addAuthHeaders', () => {
  let googleAuthMock: jasmine.SpyObj<GoogleAuth>;

  beforeEach(() => {
    googleAuthMock = jasmine.createSpyObj('GoogleAuth', ['getRequestHeaders']);
  });

  it('should add an auth request headers if it does not already exist', async () => {
    const nodeAuth = new NodeAuth({});
    (nodeAuth as unknown as NodeAuthWithGoogleAuth).googleAuth = googleAuthMock; // Inject the mock
    googleAuthMock.getRequestHeaders.and.resolveTo({'foo': '1', 'bar': '2'});
    const headers = new Headers();

    await nodeAuth.addAuthHeaders(headers);

    expect(headers.get('foo')).toBe('1');
    expect(headers.get('bar')).toBe('2');
    expect(googleAuthMock.getRequestHeaders).toHaveBeenCalled();
  });

  it('should not add an Authorization header if it already exists', async () => {
    const nodeAuth = new NodeAuth({});
    (nodeAuth as unknown as NodeAuthWithGoogleAuth).googleAuth = googleAuthMock; // Inject the mock
    const headers = new Headers();
    headers.append(AUTHORIZATION_HEADER, 'Existing Token');

    await nodeAuth.addAuthHeaders(headers);

    expect(headers.get(AUTHORIZATION_HEADER)).toBe('Existing Token');
  });

  it('should add an x-goog-api-key header if apiKey is provided', async () => {
    const apiKey = 'test-api-key';
    const nodeAuth = new NodeAuth({apiKey: apiKey});
    (nodeAuth as unknown as NodeAuthWithGoogleAuth).googleAuth = googleAuthMock; // Inject the mock
    googleAuthMock.getRequestHeaders.and.resolveTo({'foo': '1'});
    const headers = new Headers();

    await nodeAuth.addAuthHeaders(headers);

    expect(headers.get(GOOGLE_API_KEY_HEADER)).toBe(apiKey);
  });

  it('should not add an x-goog-api-key header if it already exists', async () => {
    const apiKey = 'test-api-key';
    const nodeAuth = new NodeAuth({apiKey: apiKey});
    (nodeAuth as unknown as NodeAuthWithGoogleAuth).googleAuth = googleAuthMock; // Inject the mock
    googleAuthMock.getRequestHeaders.and.resolveTo({'foo': '1'});
    const headers = new Headers();
    headers.append(GOOGLE_API_KEY_HEADER, 'Existing Key');

    await nodeAuth.addAuthHeaders(headers);

    expect(headers.get(GOOGLE_API_KEY_HEADER)).toBe('Existing Key');
  });

  it('should not call googleAuth.getRequestHeaders if apiKey is provided', async () => {
    const apiKey = 'test-api-key';
    const nodeAuth = new NodeAuth({apiKey: apiKey});
    (nodeAuth as unknown as NodeAuthWithGoogleAuth).googleAuth = googleAuthMock; // Inject the mock
    const headers = new Headers();

    await nodeAuth.addAuthHeaders(headers);

    expect(googleAuthMock.getRequestHeaders).not.toHaveBeenCalled();
  });
});



================================================
FILE: test/unit/node/node_upload_test.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleGenAI} from '../../../src/node/node_client';
import {createZeroFilledTempFile} from '../../_generate_test_file';

const DEFAULT_CHUNK_SIZE = 1024 * 1024 * 8; // bytes
const TEST_FILE_SIZE = 1024 * 1024 * 30; // bytes
const DEFAULT_TEST_MIMETYPE = 'text/plain';
const TEST_UPLOAD_URL =
  'https://generativelanguage.googleapis.com/upload/v1beta/files?upload_id=test-upload-id&upload_protocol=resumable';
const fetchOkOptions = {
  status: 200,
  statusText: 'OK',
  ok: true,
  headers: {
    'Content-Type': 'application/json',
    'x-goog-upload-status': 'active',
  },
  url: 'some-url',
};
const lastCorrectFetchOkOptions = {
  status: 200,
  statusText: 'OK',
  ok: true,
  headers: {
    'Content-Type': 'application/json',
    'x-goog-upload-status': 'final',
  },
  url: 'some-url',
};
const mockResponse = new Response(
  JSON.stringify({
    data: 'data1',
  }),
  fetchOkOptions,
);

describe('Node uploader', () => {
  describe('Input is a string path', () => {
    let filePath: string;
    const fileSize = TEST_FILE_SIZE;
    beforeAll(async () => {
      filePath = await createZeroFilledTempFile(TEST_FILE_SIZE);
    });

    it('should get the file stat of a file', async () => {
      const client = new GoogleGenAI({vertexai: false, apiKey: 'fake-api-key'});
      const fileStats =
        await client['apiClient'].clientOptions.uploader?.stat(filePath);
      expect(fileStats?.size).toBe(fileSize);
      expect(fileStats?.type).toBe(DEFAULT_TEST_MIMETYPE);
    });
    it('should upload the file as stream with exact DEFAULT_CHUNK_SIZE except the last chunk', async () => {
      const client = new GoogleGenAI({vertexai: false, apiKey: 'fake-api-key'});
      const numRequests = Math.ceil(TEST_FILE_SIZE / DEFAULT_CHUNK_SIZE);

      const mockResponses = [];
      for (let i = 0; i < numRequests - 1; i++) {
        mockResponses.push(Promise.resolve(mockResponse));
      }
      mockResponses.push(
        Promise.resolve(
          new Response(
            JSON.stringify({
              data: 'data12',
            }),
            lastCorrectFetchOkOptions,
          ),
        ),
      );
      const fetchSpy = spyOn(global, 'fetch').and.returnValues(
        ...mockResponses,
      );

      const uploader = client['apiClient'].clientOptions.uploader;
      if (uploader === undefined) {
        throw new Error('Uploader is not set.');
      }

      await uploader.upload(filePath, TEST_UPLOAD_URL, client['apiClient']);
      expect(fetchSpy).toHaveBeenCalledTimes(numRequests);
      const allArgs = fetchSpy.calls.allArgs();
      let byteProcessed = 0;

      for (let i = 0; i < numRequests; i++) {
        expect(allArgs[i][1]?.['body']).toBeInstanceOf(Blob);
        const body = allArgs[i][1]?.['body'] as Blob;
        expect(
          body?.size == Math.min(DEFAULT_CHUNK_SIZE, fileSize - byteProcessed),
        ).toBeTrue();
        byteProcessed += body?.size;
      }
      expect(byteProcessed).toBe(fileSize);
      console.log(`byteProcessed: ${byteProcessed}, fileSize: ${fileSize}`);
    });
  });

  describe('Input is a blob', () => {
    let testBlob: Blob;
    const fileSize = TEST_FILE_SIZE;
    beforeEach(() => {
      testBlob = new Blob([new Uint8Array(fileSize)], {
        type: DEFAULT_TEST_MIMETYPE,
      });
    });
    it('should get the file stat of a file', async () => {
      const client = new GoogleGenAI({vertexai: false, apiKey: 'fake-api-key'});
      const fileStats =
        await client['apiClient'].clientOptions.uploader?.stat(testBlob);
      expect(fileStats?.size).toBe(fileSize);
      expect(fileStats?.type).toBe(DEFAULT_TEST_MIMETYPE);
    });
    it('should get a readable stream of a file with exact DEFAULT_CHUNK_SIZE except the last chunk', async () => {
      const client = new GoogleGenAI({vertexai: false, apiKey: 'fake-api-key'});
      const numRequests = Math.ceil(TEST_FILE_SIZE / DEFAULT_CHUNK_SIZE);

      const mockResponses = [];
      for (let i = 0; i < numRequests - 1; i++) {
        mockResponses.push(Promise.resolve(mockResponse));
      }
      mockResponses.push(
        Promise.resolve(
          new Response(
            JSON.stringify({
              data: 'data22',
            }),
            lastCorrectFetchOkOptions,
          ),
        ),
      );
      const fetchSpy = spyOn(global, 'fetch').and.returnValues(
        ...mockResponses,
      );

      const uploader = client['apiClient'].clientOptions.uploader;
      if (uploader === undefined) {
        throw new Error('Uploader is not set.');
      }
      await uploader.upload(testBlob, TEST_UPLOAD_URL, client['apiClient']);
      expect(fetchSpy).toHaveBeenCalledTimes(numRequests);
      const allArgs = fetchSpy.calls.allArgs();
      let byteProcessed = 0;
      for (let i = 0; i < numRequests; i++) {
        expect(allArgs[i][1]?.['body']).toBeInstanceOf(Blob);
        const body = allArgs[i][1]?.['body'] as Blob;
        expect(
          body?.size == Math.min(DEFAULT_CHUNK_SIZE, fileSize - byteProcessed),
        ).toBeTrue();
        byteProcessed += body?.size;
      }
      expect(byteProcessed).toBe(fileSize);
      console.log(`byteProcessed: ${byteProcessed}, fileSize: ${fileSize}`);
    });
  });
});



================================================
FILE: test/unit/web/base_url_test.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {setDefaultBaseUrls} from '../../../src/_base_url';
import {GoogleGenAI} from '../../../src/web/web_client';

describe('setDefaultBaseUrls', () => {
  afterEach(() => {
    setDefaultBaseUrls({});
  });

  it('should set default base Gemini URL', () => {
    setDefaultBaseUrls({geminiUrl: 'https://gemini.google.com'});
    const client = new GoogleGenAI({apiKey: 'constructor_api_key'});
    expect(client['apiClient'].getBaseUrl()).toBe('https://gemini.google.com');
  });
  it('should set default base Vertex URL', () => {
    setDefaultBaseUrls({vertexUrl: 'https://vertexai.googleapis.com'});
    const client = new GoogleGenAI({
      apiKey: 'constructor_api_key',
      vertexai: true,
    });
    expect(client['apiClient'].getBaseUrl()).toBe(
      'https://vertexai.googleapis.com',
    );
  });
  it('should not override base URL if set via httpOptions', () => {
    setDefaultBaseUrls({vertexUrl: 'https://vertexai.googleapis.com'});
    const client = new GoogleGenAI({
      apiKey: 'constructor_api_key',
      httpOptions: {baseUrl: 'https://gemini.google.com'},
    });
    expect(client['apiClient'].getBaseUrl()).toBe('https://gemini.google.com');
  });
});



================================================
FILE: test/unit/web/web_auth_test.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {GOOGLE_API_KEY_HEADER, WebAuth} from '../../../src/web/_web_auth';

describe('WebAuth', () => {
  it('should add an x-goog-api-key header', async () => {
    const apiKey = 'test-api-key';
    const nodeAuth = new WebAuth(apiKey);
    const headers = new Headers();

    await nodeAuth.addAuthHeaders(headers);

    expect(headers.get(GOOGLE_API_KEY_HEADER)).toBe(apiKey);
  });

  it('should not add an x-goog-api-key header if it already exists', async () => {
    const apiKey = 'test-api-key';
    const nodeAuth = new WebAuth(apiKey);
    const headers = new Headers();
    headers.append(GOOGLE_API_KEY_HEADER, 'Existing Key');

    await nodeAuth.addAuthHeaders(headers);

    expect(headers.get(GOOGLE_API_KEY_HEADER)).toBe('Existing Key');
  });
});


