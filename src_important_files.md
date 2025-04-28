# Important Files Directory Tree

```
Directory structure:
└── src/
    ├── chats.ts
    ├── client.ts
    ├── converters/
    ├── cross/
    ├── node/
    └── web/

```

# Important Files Content

================================================
File: src/chats.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {ApiClient} from './_api_client';
import * as t from './_transformers';
import {Models} from './models';
import * as types from './types';

/**
 * Returns true if the response is valid, false otherwise.
 */
function isValidResponse(response: types.GenerateContentResponse): boolean {
  if (response.candidates == undefined || response.candidates.length === 0) {
    return false;
  }
  const content = response.candidates[0]?.content;
  if (content === undefined) {
    return false;
  }
  return isValidContent(content);
}

function isValidContent(content: types.Content): boolean {
  if (content.parts === undefined || content.parts.length === 0) {
    return false;
  }
  for (const part of content.parts) {
    if (part === undefined || Object.keys(part).length === 0) {
      return false;
    }
    if (part.text !== undefined && part.text === '') {
      return false;
    }
  }
  return true;
}

/**
 * Validates the history contains the correct roles.
 *
 * @remarks
 * Expects the history to start with a user turn and then alternate between
 * user and model turns.
 *
 * @throws Error if the history does not start with a user turn.
 * @throws Error if the history contains an invalid role.
 */
function validateHistory(history: types.Content[]) {
  // Empty history is valid.
  if (history.length === 0) {
    return;
  }
  if (history[0].role !== 'user') {
    throw new Error('History must start with a user turn.');
  }
  for (const content of history) {
    if (content.role !== 'user' && content.role !== 'model') {
      throw new Error(`Role must be user or model, but got ${content.role}.`);
    }
  }
}

/**
 * Extracts the curated (valid) history from a comprehensive history.
 *
 * @remarks
 * The model may sometimes generate invalid or empty contents(e.g., due to safty
 * filters or recitation). Extracting valid turns from the history
 * ensures that subsequent requests could be accpeted by the model.
 */
function extractCuratedHistory(
  comprehensiveHistory: types.Content[],
): types.Content[] {
  if (comprehensiveHistory === undefined || comprehensiveHistory.length === 0) {
    return [];
  }
  const curatedHistory: types.Content[] = [];
  const length = comprehensiveHistory.length;
  let i = 0;
  let userInput = comprehensiveHistory[0];
  while (i < length) {
    if (comprehensiveHistory[i].role === 'user') {
      userInput = comprehensiveHistory[i];
      i++;
    } else {
      const modelOutput: types.Content[] = [];
      let isValid = true;
      while (i < length && comprehensiveHistory[i].role === 'model') {
        modelOutput.push(comprehensiveHistory[i]);
        if (isValid && !isValidContent(comprehensiveHistory[i])) {
          isValid = false;
        }
        i++;
      }
      if (isValid) {
        curatedHistory.push(userInput);
        curatedHistory.push(...modelOutput);
      }
    }
  }
  return curatedHistory;
}

/**
 * A utility class to create a chat session.
 */
export class Chats {
  private readonly modelsModule: Models;
  private readonly apiClient: ApiClient;

  constructor(modelsModule: Models, apiClient: ApiClient) {
    this.modelsModule = modelsModule;
    this.apiClient = apiClient;
  }

  /**
   * Creates a new chat session.
   *
   * @remarks
   * The config in the params will be used for all requests within the chat
   * session unless overridden by a per-request `config` in
   * @see {@link types.SendMessageParameters#config}.
   *
   * @param params - Parameters for creating a chat session.
   * @returns A new chat session.
   *
   * @example
   * ```ts
   * const chat = ai.chats.create({
   *   model: 'gemini-2.0-flash'
   *   config: {
   *     temperature: 0.5,
   *     maxOutputTokens: 1024,
   *   }
   * });
   * ```
   */
  create(params: types.CreateChatParameters) {
    return new Chat(
      this.apiClient,
      this.modelsModule,
      params.model,
      params.config,
      params.history,
    );
  }
}

/**
 * Chat session that enables sending messages to the model with previous
 * conversation context.
 *
 * @remarks
 * The session maintains all the turns between user and model.
 */
export class Chat {
  // A promise to represent the current state of the message being sent to the
  // model.
  private sendPromise: Promise<void> = Promise.resolve();

  constructor(
    private readonly apiClient: ApiClient,
    private readonly modelsModule: Models,
    private readonly model: string,
    private readonly config: types.GenerateContentConfig = {},
    private history: types.Content[] = [],
  ) {
    validateHistory(history);
  }

  /**
   * Sends a message to the model and returns the response.
   *
   * @remarks
   * This method will wait for the previous message to be processed before
   * sending the next message.
   *
   * @see {@link Chat#sendMessageStream} for streaming method.
   * @param params - parameters for sending messages within a chat session.
   * @returns The model's response.
   *
   * @example
   * ```ts
   * const chat = ai.chats.create({model: 'gemini-2.0-flash'});
   * const response = await chat.sendMessage({
   *   message: 'Why is the sky blue?'
   * });
   * console.log(response.text);
   * ```
   */
  async sendMessage(
    params: types.SendMessageParameters,
  ): Promise<types.GenerateContentResponse> {
    await this.sendPromise;
    const inputContent = t.tContent(this.apiClient, params.message);
    const responsePromise = this.modelsModule.generateContent({
      model: this.model,
      contents: this.getHistory(true).concat(inputContent),
      config: params.config ?? this.config,
    });
    this.sendPromise = (async () => {
      const response = await responsePromise;
      const outputContent = response.candidates?.[0]?.content;
      const modelOutput = outputContent ? [outputContent] : [];
      this.recordHistory(inputContent, modelOutput);
      return;
    })();
    await this.sendPromise;
    return responsePromise;
  }

  /**
   * Sends a message to the model and returns the response in chunks.
   *
   * @remarks
   * This method will wait for the previous message to be processed before
   * sending the next message.
   *
   * @see {@link Chat#sendMessage} for non-streaming method.
   * @param params - parameters for sending the message.
   * @return The model's response.
   *
   * @example
   * ```ts
   * const chat = ai.chats.create({model: 'gemini-2.0-flash'});
   * const response = await chat.sendMessageStream({
   *   message: 'Why is the sky blue?'
   * });
   * for await (const chunk of response) {
   *   console.log(chunk.text);
   * }
   * ```
   */
  async sendMessageStream(
    params: types.SendMessageParameters,
  ): Promise<AsyncGenerator<types.GenerateContentResponse>> {
    await this.sendPromise;
    const inputContent = t.tContent(this.apiClient, params.message);
    const streamResponse = this.modelsModule.generateContentStream({
      model: this.model,
      contents: this.getHistory(true).concat(inputContent),
      config: params.config ?? this.config,
    });
    this.sendPromise = streamResponse.then(() => undefined);
    const response = await streamResponse;
    const result = this.processStreamResponse(response, inputContent);
    return result;
  }

  /**
   * Returns the chat history.
   *
   * @remarks
   * The history is a list of contents alternating between user and model.
   *
   * There are two types of history:
   * - The `curated history` contains only the valid turns between user and
   * model, which will be included in the subsequent requests sent to the model.
   * - The `comprehensive history` contains all turns, including invalid or
   *   empty model outputs, providing a complete record of the history.
   *
   * The history is updated after receiving the response from the model,
   * for streaming response, it means receiving the last chunk of the response.
   *
   * The `comprehensive history` is returned by default. To get the `curated
   * history`, set the `curated` parameter to `true`.
   *
   * @param curated - whether to return the curated history or the comprehensive
   *     history.
   * @return History contents alternating between user and model for the entire
   *     chat session.
   */
  getHistory(curated: boolean = false): types.Content[] {
    return curated ? extractCuratedHistory(this.history) : this.history;
  }

  private async *processStreamResponse(
    streamResponse: AsyncGenerator<types.GenerateContentResponse>,
    inputContent: types.Content,
  ) {
    const outputContent: types.Content[] = [];
    for await (const chunk of streamResponse) {
      if (isValidResponse(chunk)) {
        const content = chunk.candidates?.[0]?.content;
        if (content !== undefined) {
          outputContent.push(content);
        }
      }
      yield chunk;
    }
    this.recordHistory(inputContent, outputContent);
  }

  private recordHistory(
    userInput: types.Content,
    modelOutput: types.Content[],
  ) {
    let outputContents: types.Content[] = [];
    if (
      modelOutput.length > 0 &&
      modelOutput.every((content) => content.role === 'model')
    ) {
      outputContents = modelOutput;
    } else {
      // Appends an empty content when model returns empty response, so that the
      // history is always alternating between user and model.
      outputContents.push({
        role: 'model',
        parts: [],
      } as types.Content);
    }
    this.history.push(userInput);
    this.history.push(...outputContents);
  }
}



================================================
File: src/client.ts
================================================
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleAuthOptions} from 'google-auth-library';

import {ApiClient} from './_api_client';
import {Caches} from './caches';
import {Chats} from './chats';
import {crossError} from './cross/_cross_error';
import {CrossUploader} from './cross/_cross_uploader';
import {CrossWebSocketFactory} from './cross/_cross_websocket';
import {Files} from './files';
import {Live} from './live';
import {Models} from './models';
import {Operations} from './operations';
import {Tunings} from './tunings';
import {HttpOptions} from './types';
import {WebAuth} from './web/_web_auth';

const LANGUAGE_LABEL_PREFIX = 'gl-node/';

/**
 * Google Gen AI SDK's configuration options.
 *
 * See {@link GoogleGenAI} for usage samples.
 */
export interface GoogleGenAIOptions {
  /**
   * Optional. Determines whether to use the Vertex AI or the Gemini API.
   *
   * @remarks
   * When true, the {@link https://cloud.google.com/vertex-ai/docs/reference/rest | Vertex AI API} will used.
   * When false, the {@link https://cloud.google.com/vertex-ai/docs/reference/rest | Gemini API} will be used.
   *
   * If unset, default SDK behavior is to use the Gemini API service.
   */
  vertexai?: boolean;
  /**
   * Optional. The Google Cloud project ID for Vertex AI clients.
   *
   * @remarks
   * Only supported on Node runtimes, ignored on browser runtimes.
   */
  project?: string;
  /**
   * Optional. The Google Cloud project region for Vertex AI clients.
   *
   * @remarks
   * Only supported on Node runtimes, ignored on browser runtimes.
   *
   */
  location?: string;
  /**
   * The API Key, required for Gemini API clients.
   *
   * @remarks
   * Required on browser runtimes.
   */
  apiKey?: string;
  /**
   * Optional. The API version to use.
   *
   * @remarks
   * If unset, the default API version will be used.
   */
  apiVersion?: string;
  /**
   * Optional. Authentication options defined by the by google-auth-library for Vertex AI clients.
   *
   * @remarks
   * @see {@link https://github.com/googleapis/google-auth-library-nodejs/blob/v9.15.0/src/auth/googleauth.ts | GoogleAuthOptions interface in google-auth-library-nodejs}.
   *
   * Only supported on Node runtimes, ignored on browser runtimes.
   *
   */
  googleAuthOptions?: GoogleAuthOptions;
  /**
   * Optional. A set of customizable configuration for HTTP requests.
   */
  httpOptions?: HttpOptions;
}

/**
 * The Google GenAI SDK.
 *
 * @remarks
 * Provides access to the GenAI features through either the {@link https://cloud.google.com/vertex-ai/docs/reference/rest | Gemini API}
 * or the {@link https://cloud.google.com/vertex-ai/docs/reference/rest | Vertex AI API}.
 *
 * The {@link GoogleGenAIOptions.vertexai} value determines which of the API services to use.
 *
 * When using the Gemini API, a {@link GoogleGenAIOptions.apiKey} must also be set,
 * when using Vertex AI {@link GoogleGenAIOptions.project} and {@link GoogleGenAIOptions.location} must also be set.
 *
 * @example
 * Initializing the SDK for using the Gemini API:
 * ```ts
 * import {GoogleGenAI} from '@google/genai';
 * const ai = new GoogleGenAI({apiKey: 'GEMINI_API_KEY'});
 * ```
 *
 * @example
 * Initializing the SDK for using the Vertex AI API:
 * ```ts
 * import {GoogleGenAI} from '@google/genai';
 * const ai = new GoogleGenAI({
 *   vertexai: true,
 *   project: 'PROJECT_ID',
 *   location: 'PROJECT_LOCATION'
 * });
 * ```
 *
 */
export class GoogleGenAI {
  protected readonly apiClient: ApiClient;
  private readonly apiKey?: string;
  public readonly vertexai: boolean;
  private readonly apiVersion?: string;
  readonly models: Models;
  readonly live: Live;
  readonly chats: Chats;
  readonly caches: Caches;
  readonly files: Files;
  readonly operations: Operations;
  readonly tunings: Tunings;

  constructor(options: GoogleGenAIOptions) {
    if (options.apiKey == null) {
      throw new Error(
        `An API Key must be set when running in an unspecified environment.\n + ${crossError().message}`,
      );
    }
    this.vertexai = options.vertexai ?? false;
    this.apiKey = options.apiKey;
    this.apiVersion = options.apiVersion;
    const auth = new WebAuth(this.apiKey);
    this.apiClient = new ApiClient({
      auth: auth,
      apiVersion: this.apiVersion,
      apiKey: this.apiKey,
      vertexai: this.vertexai,
      httpOptions: options.httpOptions,
      userAgentExtra: LANGUAGE_LABEL_PREFIX + 'cross',
      uploader: new CrossUploader(),
    });
    this.models = new Models(this.apiClient);
    this.live = new Live(this.apiClient, auth, new CrossWebSocketFactory());
    this.chats = new Chats(this.models, this.apiClient);
    this.caches = new Caches(this.apiClient);
    this.files = new Files(this.apiClient);
    this.operations = new Operations(this.apiClient);
    this.tunings = new Tunings(this.apiClient);
  }
}






